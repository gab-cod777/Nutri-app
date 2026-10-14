import request from 'supertest';
import { api, createTestContext, createUser, errorCode, HAS_DB, ONBOARDING, resetDatabase, type TestContext } from '../helpers/test-app.js';

describe.skipIf(!HAS_DB)('auth, perfil e dieta', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = createTestContext();
    await resetDatabase(ctx.prisma);
  });

  describe('POST /cadastro e /login', () => {
    it('cadastra, devolve token e nunca expoe o hash', async () => {
      const res = await request(ctx.app).post('/cadastro').send({ email: '  Maria@Example.com ', password: 'senha-forte-123' });
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ email: 'maria@example.com', onboardingCompleted: false });
      expect(res.body.token).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toMatch(/scrypt|passwordHash|senha-forte/);

      const row = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.com' } });
      expect(row.passwordHash).toMatch(/^scrypt\$/);
    });

    it('e-mail repetido (case-insensitive) -> 409', async () => {
      await request(ctx.app).post('/cadastro').send({ email: 'dup@example.com', password: 'senha-forte-123' });
      const res = await request(ctx.app).post('/cadastro').send({ email: 'DUP@example.com', password: 'outra-senha-123' });
      expect(res.status).toBe(409);
      expect(errorCode(res)).toBe('email_in_use');
    });

    it('senha curta e e-mail invalido -> 422 com detalhes dos campos', async () => {
      const res = await request(ctx.app).post('/cadastro').send({ email: 'nao-e-email', password: '123' });
      expect(res.status).toBe(422);
      expect(errorCode(res)).toBe('validation_failed');
      const paths = res.body.error.details.issues.map((i: { path: string }) => i.path);
      expect(paths).toEqual(expect.arrayContaining(['email', 'password']));
      expect(res.body.error.requestId).toEqual(expect.any(String));
    });

    it('login ok; senha errada e e-mail inexistente dao a MESMA resposta', async () => {
      await request(ctx.app).post('/cadastro').send({ email: 'login@example.com', password: 'senha-forte-123' });
      const ok = await request(ctx.app).post('/login').send({ email: 'LOGIN@example.com', password: 'senha-forte-123' });
      expect(ok.status).toBe(200);

      const wrong = await request(ctx.app).post('/login').send({ email: 'login@example.com', password: 'errada-123' });
      const unknown = await request(ctx.app).post('/login').send({ email: 'ninguem@example.com', password: 'errada-123' });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.error.message).toBe(unknown.body.error.message);
      expect(errorCode(wrong)).toBe('invalid_credentials');
    });

    it('rate limit por IP em /login', async () => {
      const limited = createTestContext({ RATE_LIMIT_AUTH_PER_MINUTE: '3' });
      const statuses: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        statuses.push((await request(limited.app).post('/login').send({ email: 'x@example.com', password: 'y' })).status);
      }
      expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
      expect(statuses.slice(3)).toEqual([429, 429]);
    });
  });

  describe('protecao das rotas', () => {
    it('sem token, token invalido ou adulterado -> 401', async () => {
      expect((await request(ctx.app).get('/perfil')).status).toBe(401);
      expect(errorCode(await request(ctx.app).get('/perfil').set('authorization', 'Bearer lixo'))).toBe('invalid_token');

      const user = await createUser(ctx, { onboard: false });
      const [h, p, sig] = user.token.split('.');
      const payload = JSON.parse(Buffer.from(p!, 'base64url').toString());
      const tampered = `${h}.${Buffer.from(JSON.stringify({ ...payload, sub: '00000000-0000-4000-8000-000000000000' })).toString('base64url')}.${sig}`;
      expect((await request(ctx.app).get('/perfil').set('authorization', `Bearer ${tampered}`)).status).toBe(401);
    });

    it('POST /logout invalida os tokens ja emitidos', async () => {
      const user = await createUser(ctx, { onboard: false });
      expect((await api(ctx, user.token).post('/logout')).status).toBe(204);
      const res = await api(ctx, user.token).get('/perfil');
      expect(res.status).toBe(401);
      expect(errorCode(res)).toBe('token_revoked');
    });

    it('JSON malformado -> 400 no formato padrao', async () => {
      const res = await request(ctx.app).post('/login').set('content-type', 'application/json').send('{"email": ');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: 'malformed_request', requestId: expect.any(String) });
      expect(res.headers['x-request-id']).toBe(res.body.error.requestId);
    });

    it('GET /health informa banco e IA', async () => {
      expect((await request(ctx.app).get('/health')).body).toEqual({ status: 'ok', banco: 'ok', ia: 'ok' });
      ctx.vision.healthy = false;
      const down = await request(ctx.app).get('/health');
      ctx.vision.healthy = true;
      expect(down.status).toBe(503);
      expect(down.body).toEqual({ status: 'com_problema', banco: 'ok', ia: 'indisponivel' });
    });
  });

  describe('POST /calculo-fisico (publica)', () => {
    it('calcula TMB, TDEE, meta e macros com o core', async () => {
      const res = await request(ctx.app).post('/calculo-fisico').send({
        sex: 'male',
        birthDate: '1990-01-15',
        heightCm: 180,
        weightKg: 80,
        goal: 'lose_weight',
        pace: 'moderate',
        activityLevel: 'moderately_active',
      });
      expect(res.status).toBe(200);
      expect(res.body.bmr.formula).toBe('mifflin_st_jeor');
      expect(res.body.tdee.tdee).toBeGreaterThan(res.body.bmr.bmr);
      expect(res.body.calories.direction).toBe('deficit');
      expect(res.body.disclaimer).toEqual(expect.any(String));
    });

    it('fora da faixa fisica -> 422', async () => {
      const res = await request(ctx.app).post('/calculo-fisico').send({
        sex: 'male', birthDate: '1990-01-15', heightCm: 40, weightKg: 80, goal: 'lose_weight', activityLevel: 'sedentary',
      });
      expect(res.status).toBe(422);
    });
  });

  describe('perfil e metas', () => {
    it('onboarding exige consentimento LGPD', async () => {
      const user = await createUser(ctx, { onboard: false });
      const { healthDataConsent: _, ...semConsentimento } = ONBOARDING;
      const res = await api(ctx, user.token).post('/perfil').send(semConsentimento);
      expect(res.status).toBe(422);
    });

    it('onboarding grava perfil, meta, consentimento e peso inicial', async () => {
      const user = await createUser(ctx);
      const me = await api(ctx, user.token).get('/perfil');
      expect(me.status).toBe(200);
      expect(me.body.onboarding.completed).toBe(true);
      expect(me.body.profile.healthDataConsentAt).toEqual(expect.any(String));
      expect(me.body.currentTarget.calories).toBeGreaterThan(1000);
      expect(me.body).not.toHaveProperty('passwordHash');

      const meta = await api(ctx, user.token).get('/dieta/meta');
      expect(meta.body.id).toBe(me.body.currentTarget.id);
      const weights = await ctx.prisma.progressLog.count({ where: { userId: user.id, metric: 'weight_kg' } });
      expect(weights).toBe(1);
    });

    it('mudar peso encerra a meta anterior e cria uma nova; mudar so o nome nao', async () => {
      const user = await createUser(ctx);
      const before = (await api(ctx, user.token).get('/dieta/meta')).body;

      await api(ctx, user.token).put('/perfil').send({ displayName: 'Ana Maria' });
      expect((await api(ctx, user.token).get('/dieta/meta')).body.id).toBe(before.id);

      const res = await api(ctx, user.token).put('/perfil').send({ weightKg: 64 });
      expect(res.status).toBe(200);
      expect(res.body.currentTarget.id).not.toBe(before.id);
      expect(res.body.currentTarget.calories).toBeLessThan(before.calories);
      const old = await ctx.prisma.nutritionTarget.findUniqueOrThrow({ where: { id: before.id } });
      expect(old.effectiveTo).not.toBeNull();
    });

    it('fuso invalido -> 422; editar antes do onboarding -> 409', async () => {
      const user = await createUser(ctx);
      expect((await api(ctx, user.token).put('/perfil').send({ timezone: 'Lua/Base' })).status).toBe(422);
      const fresh = await createUser(ctx, { onboard: false });
      const res = await api(ctx, fresh.token).put('/perfil').send({ weightKg: 70 });
      expect(res.status).toBe(409);
      expect(errorCode(res)).toBe('onboarding_required');
      expect((await api(ctx, fresh.token).get('/dieta/resumo?date=2026-10-01')).status).toBe(409);
    });

    it('DELETE /perfil apaga a conta e todos os dados (LGPD)', async () => {
      const user = await createUser(ctx);
      await api(ctx, user.token).post('/diario').send({
        mealType: 'lunch',
        consumedAt: new Date().toISOString(),
        foods: [{ nameSnapshot: 'arroz', per100gSnapshot: { calories: 128, protein: 2.5, carbs: 28, fat: 0.2 }, quantity: 100, unit: 'g', grams: 100, portionSource: 'manual_entry' }],
      });
      expect((await api(ctx, user.token).delete('/perfil')).status).toBe(204);

      expect(await ctx.prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
      expect(await ctx.prisma.meal.count({ where: { userId: user.id } })).toBe(0);
      expect(await ctx.prisma.nutritionTarget.count({ where: { userId: user.id } })).toBe(0);
      expect((await api(ctx, user.token).get('/perfil')).status).toBe(401);
    });
  });
});
