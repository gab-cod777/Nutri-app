import { toLocalDate } from '@nutrisnap/core';
import { VisionError } from '../../src/services/ia/vision-client.js';
import {
  api,
  createTestContext,
  createUser,
  errorCode,
  HAS_DB,
  JPEG_BYTES,
  PRATO_FEITO,
  resetDatabase,
  type TestContext,
  type TestUser,
} from '../helpers/test-app.js';

/** Imagem distinta por chamada (hash diferente), para nao cair no reuso de analise. */
let seq = 0;
function uniqueJpeg(): Buffer {
  seq += 1;
  return Buffer.concat([JPEG_BYTES, Buffer.from(`img-${seq}-${Date.now()}`)]);
}

function scan(ctx: TestContext, user: TestUser, photo: Buffer | null = uniqueJpeg(), fields: Record<string, string> = {}) {
  let req = api(ctx, user.token).post('/scan-prato');
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  return photo ? req.attach('foto', photo, { filename: 'prato.jpg', contentType: 'image/jpeg' }) : req;
}

describe.skipIf(!HAS_DB)('scan-prato + diario', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = createTestContext();
    await resetDatabase(ctx.prisma);
  });

  it('fluxo completo: foto -> estimativa -> usuario corrige -> diario -> resumo do dia', async () => {
    const user = await createUser(ctx);
    const today = toLocalDate(new Date(), 'America/Sao_Paulo');

    // 1) scan
    const scanRes = await scan(ctx, user, uniqueJpeg(), { mealType: 'lunch' });
    expect(scanRes.status).toBe(200);
    const analysis = scanRes.body;
    expect(analysis).toMatchObject({ isFood: true, mealType: 'lunch', disclaimer: expect.any(String) });
    expect(analysis.foods).toHaveLength(3);
    // Totais calculados pelo core: 150g arroz (192) + 100g feijao (76) + 120g frango (191)
    expect(analysis.totals.calories).toBe(459);
    // Alimentos casados com a base pelo canonicalName.
    expect(analysis.foods.every((f: { foodId: string | null }) => f.foodId)).toBe(true);
    expect(ctx.vision.calls.at(-1)).toMatchObject({ mediaType: 'image/jpeg' });

    // 2) usuario confirma corrigindo o arroz para 200 g e remove o feijao
    const [arroz, , frango] = analysis.foods;
    const toItem = (f: typeof arroz, grams: number, portionSource: string) => ({
      foodId: f.foodId,
      nameSnapshot: f.name,
      per100gSnapshot: f.per100g,
      quantity: grams,
      unit: 'g',
      grams,
      preparationMethod: f.preparationMethod,
      portionSource,
      aiConfidence: f.confidence,
      aiEstimatedGrams: f.estimatedGrams,
    });
    const saved = await api(ctx, user.token)
      .post('/diario')
      .send({
        mealType: 'lunch',
        consumedAt: new Date().toISOString(),
        analysisId: analysis.analysisId,
        title: analysis.description,
        foods: [toItem(arroz, 200, 'user_adjusted'), toItem(frango, 120, 'ai_estimate')],
        // campo que o cliente nao controla: deve ser ignorado
        totals: { calories: 1 },
      });
    expect(saved.status).toBe(201);
    // 200g arroz = 256 kcal; 120g frango = 191 kcal -> calculado no servidor
    expect(saved.body.totals.calories).toBe(447);
    expect(saved.body.localDate).toBe(today);
    expect(saved.body).not.toHaveProperty('userId');
    const stored = await ctx.prisma.mealAnalysis.findUniqueOrThrow({ where: { id: analysis.analysisId } });
    expect(stored.wasAccepted).toBe(true);

    // 3) a mesma analise nao vira duas refeicoes
    const again = await api(ctx, user.token).post('/diario').send({
      mealType: 'lunch', consumedAt: new Date().toISOString(), analysisId: analysis.analysisId, foods: [toItem(frango, 100, 'ai_estimate')],
    });
    expect(again.status).toBe(409);
    expect(errorCode(again)).toBe('analysis_already_used');

    // 4) aparece no diario e no resumo do dia, contra a meta do dia
    const diario = await api(ctx, user.token).get(`/diario?date=${today}`);
    expect(diario.body.items.map((m: { id: string }) => m.id)).toContain(saved.body.id);

    const resumo = await api(ctx, user.token).get(`/dieta/resumo?date=${today}`);
    expect(resumo.status).toBe(200);
    expect(resumo.body.consumed.calories).toBe(447);
    expect(resumo.body.calories.remaining).toBe(resumo.body.targets.calories - 447);
    expect(resumo.body.byMealType.find((b: { mealType: string }) => b.mealType === 'lunch').entryCount).toBe(1);

    // 5) editar recalcula os totais; excluir some do resumo
    const edited = await api(ctx, user.token).put(`/diario/${saved.body.id}`).send({ foods: [toItem(frango, 240, 'user_adjusted')] });
    expect(edited.body.totals.calories).toBe(382);
    expect((await api(ctx, user.token).delete(`/diario/${saved.body.id}`)).status).toBe(204);
    expect((await api(ctx, user.token).get(`/dieta/resumo?date=${today}`)).body.consumed.calories).toBe(0);
  });

  it('a mesma foto nao e analisada duas vezes (reuso pelo hash); com dica, e', async () => {
    const user = await createUser(ctx);
    const photo = uniqueJpeg();
    const first = await scan(ctx, user, photo);
    const callsAfterFirst = ctx.vision.calls.length;
    const second = await scan(ctx, user, photo);
    expect(second.body.analysisId).toBe(first.body.analysisId);
    expect(ctx.vision.calls.length).toBe(callsAfterFirst);

    const withHint = await scan(ctx, user, photo, { userHint: 'tinha molho branco' });
    expect(withHint.status).toBe(200);
    expect(ctx.vision.calls.length).toBe(callsAfterFirst + 1);
    expect(ctx.vision.calls.at(-1)!.userHint).toBe('tinha molho branco');
  });

  it('valida o upload: sem foto, nao-imagem e foto grande demais', async () => {
    const user = await createUser(ctx);
    const noPhoto = await scan(ctx, user, null, { mealType: 'lunch' });
    expect(noPhoto.status).toBe(422);
    expect(errorCode(noPhoto)).toBe('photo_required');

    const empty = await scan(ctx, user, Buffer.alloc(0));
    expect(empty.status).toBe(422);
    expect(errorCode(empty)).toBe('photo_empty');

    const notImage = await scan(ctx, user, Buffer.from('<html>prato.jpg</html>'));
    expect(notImage.status).toBe(422);
    expect(errorCode(notImage)).toBe('unsupported_image');

    const small = createTestContext({ MAX_MEAL_PHOTO_BYTES: '100000' });
    const big = await api(small, user.token)
      .post('/scan-prato')
      .attach('foto', Buffer.concat([JPEG_BYTES, Buffer.alloc(150_000)]), 'big.jpg');
    expect(big.status).toBe(413);
    expect(errorCode(big)).toBe('photo_too_large');
  });

  it('resposta invalida da IA nunca chega ao app: 502 + log validation_failed', async () => {
    const user = await createUser(ctx);
    ctx.vision.enqueue({ resultado: { ...PRATO_FEITO, foods: [{ ...PRATO_FEITO.foods[0]!, minGrams: 900 }] } });
    const res = await scan(ctx, user);
    expect(res.status).toBe(502);
    expect(errorCode(res)).toBe('ai_invalid_output');
    const log = await ctx.prisma.aiUsageLog.findFirstOrThrow({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    expect(log).toMatchObject({ status: 'validation_failed', model: 'fake-clip' });
    expect(await ctx.prisma.mealAnalysis.count({ where: { userId: user.id } })).toBe(0);
  });

  it('servico de IA fora do ar ou lento: 502 tratado + log', async () => {
    const user = await createUser(ctx);
    ctx.vision.enqueue(new VisionError('timeout', 'lento'), new VisionError('unavailable', 'fora'));
    const slow = await scan(ctx, user);
    const down = await scan(ctx, user);
    expect([slow.status, down.status]).toEqual([502, 502]);
    expect(slow.body.error.details).toEqual({ reason: 'timeout' });
    const statuses = (await ctx.prisma.aiUsageLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } })).map((l) => l.status);
    expect(statuses).toEqual(['timeout', 'provider_error']);
  });

  it('foto sem comida: 200 com isFood=false e motivo', async () => {
    const user = await createUser(ctx);
    ctx.vision.enqueue({
      resultado: { isFood: false, rejectionReason: 'A foto parece mostrar um teclado.', mealType: null, description: null, imageQuality: 'good', hiddenCalorieRisk: 'low', foods: [] },
    });
    const res = await scan(ctx, user);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isFood: false, foods: [], rejectionReason: expect.stringContaining('teclado') });
    // Nao da para salvar refeicao a partir de analise sem comida.
    const save = await api(ctx, user.token).post('/diario').send({
      mealType: 'lunch', consumedAt: new Date().toISOString(), analysisId: res.body.analysisId,
      foods: [{ nameSnapshot: 'x item', per100gSnapshot: { calories: 1, protein: 0, carbs: 0, fat: 0 }, quantity: 1, unit: 'g', grams: 1, portionSource: 'manual_entry' }],
    });
    expect(errorCode(save)).toBe('analysis_not_food');
  });

  it('cota diaria de analises por usuario -> 429', async () => {
    const limited = createTestContext({ RATE_LIMIT_SCAN_PER_DAY: '2' });
    const user = await createUser(limited);
    const statuses: number[] = [];
    for (let i = 0; i < 3; i += 1) statuses.push((await scan(limited, user)).status);
    expect(statuses).toEqual([200, 200, 429]);
  });

  describe('isolamento entre usuarios (nunca acessar dado de outro trocando o id)', () => {
    let ana: TestUser;
    let beto: TestUser;
    let mealId: string;
    let analysisId: string;

    beforeAll(async () => {
      ana = await createUser(ctx);
      beto = await createUser(ctx);
      analysisId = (await scan(ctx, ana)).body.analysisId;
      mealId = (
        await api(ctx, ana.token).post('/diario').send({
          mealType: 'dinner', consumedAt: new Date().toISOString(),
          foods: [{ nameSnapshot: 'sopa caseira', per100gSnapshot: { calories: 50, protein: 3, carbs: 6, fat: 1 }, quantity: 300, unit: 'g', grams: 300, portionSource: 'manual_entry' }],
        })
      ).body.id;
    });

    it('refeicao de outro usuario: GET/PUT/DELETE -> 404 (nao 403)', async () => {
      expect((await api(ctx, beto.token).get(`/diario/${mealId}`)).status).toBe(404);
      expect((await api(ctx, beto.token).put(`/diario/${mealId}`).send({ title: 'hack' })).status).toBe(404);
      expect((await api(ctx, beto.token).delete(`/diario/${mealId}`)).status).toBe(404);
      expect((await api(ctx, ana.token).get(`/diario/${mealId}`)).status).toBe(200);
    });

    it('lista e resumo so mostram os dados do proprio usuario', async () => {
      const list = await api(ctx, beto.token).get('/diario');
      expect(list.body.items.map((m: { id: string }) => m.id)).not.toContain(mealId);
    });

    it('nao usa analise de outro usuario', async () => {
      const res = await api(ctx, beto.token).post('/diario').send({
        mealType: 'lunch', consumedAt: new Date().toISOString(), analysisId,
        foods: [{ nameSnapshot: 'arroz', per100gSnapshot: { calories: 128, protein: 2.5, carbs: 28, fat: 0.2 }, quantity: 100, unit: 'g', grams: 100, portionSource: 'ai_estimate' }],
      });
      expect(res.status).toBe(404);
    });

    it('alimento privado: so o dono ve e usa', async () => {
      const food = await api(ctx, ana.token).post('/alimentos').send({
        name: 'Bolo da vovo', canonicalName: 'grandma_cake', category: 'sweet', baseUnit: 'g',
        per100g: { calories: 350, protein: 5, carbs: 50, fat: 14, fiber: 1 },
      });
      expect(food.status).toBe(201);
      expect((await api(ctx, beto.token).get(`/alimentos/${food.body.id}`)).status).toBe(404);
      const busca = await api(ctx, beto.token).get('/alimentos?q=bolo');
      expect(busca.body.items.map((f: { id: string }) => f.id)).not.toContain(food.body.id);
      const usar = await api(ctx, beto.token).post('/diario').send({
        mealType: 'supper', consumedAt: new Date().toISOString(),
        foods: [{ foodId: food.body.id, nameSnapshot: 'bolo', per100gSnapshot: { calories: 350, protein: 5, carbs: 50, fat: 14 }, quantity: 50, unit: 'g', grams: 50, portionSource: 'manual_entry' }],
      });
      expect(usar.status).toBe(404);
    });

    it('id que nao e UUID -> 422, sem chegar ao banco', async () => {
      expect((await api(ctx, ana.token).get('/diario/1%20OR%201=1')).status).toBe(422);
    });
  });

  it('busca de alimentos: publicos verificados/da base com trigram', async () => {
    const user = await createUser(ctx);
    const res = await api(ctx, user.token).get('/alimentos?q=arroz');
    expect(res.status).toBe(200);
    expect(res.body.items.map((f: { canonicalName: string }) => f.canonicalName)).toEqual(
      expect.arrayContaining(['white_rice_cooked', 'brown_rice_cooked']),
    );
    const typo = await api(ctx, user.token).get('/alimentos?q=frango grelhad');
    expect(typo.body.items[0]?.canonicalName).toBe('chicken_breast_grilled');
  });

  it('grams incoerente com quantity em g -> 422', async () => {
    const user = await createUser(ctx);
    const res = await api(ctx, user.token).post('/diario').send({
      mealType: 'lunch', consumedAt: new Date().toISOString(),
      foods: [{ nameSnapshot: 'arroz', per100gSnapshot: { calories: 128, protein: 2.5, carbs: 28, fat: 0.2 }, quantity: 100, unit: 'g', grams: 900, portionSource: 'manual_entry' }],
    });
    expect(errorCode(res)).toBe('grams_mismatch');
  });
});
