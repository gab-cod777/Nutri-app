import { api, createTestContext, createUser, errorCode, HAS_DB, resetDatabase, type TestContext, type TestUser } from '../helpers/test-app.js';

describe.skipIf(!HAS_DB)('plano alimentar, treinos e progresso', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = createTestContext();
    await resetDatabase(ctx.prisma);
  });

  afterEach(() => ctx.setNow(null));

  describe('plano alimentar', () => {
    let user: TestUser;
    beforeAll(async () => {
      user = await createUser(ctx); // restricao: lactose_free, 4 refeicoes
    });

    it('gera na hora, respeitando meta, refeicoes por dia e restricoes', async () => {
      const res = await api(ctx, user.token).post('/plano-alimentar/gerar').send({ days: 7 });
      expect(res.status).toBe(201);
      const plan = res.body;
      expect(plan.days).toHaveLength(7);
      for (const day of plan.days) {
        expect(day.meals).toHaveLength(4);
        expect(Math.abs(day.totals.calories - plan.targetCalories) / plan.targetCalories).toBeLessThanOrEqual(0.1);
      }
      const foodIds = plan.days.flatMap((d: { meals: { items: { foodId: string }[] }[] }) =>
        d.meals.flatMap((m) => m.items.map((i) => i.foodId)),
      );
      const foods = await ctx.prisma.food.findMany({ where: { id: { in: foodIds } } });
      expect(foods.some((f) => f.tags.includes('lactose'))).toBe(false);
      expect(plan.disclaimer).toEqual(expect.any(String));
    });

    it('segundo plano exige force; com force, o anterior e arquivado', async () => {
      const again = await api(ctx, user.token).post('/plano-alimentar/gerar').send({});
      expect(again.status).toBe(409);
      expect(errorCode(again)).toBe('active_plan_exists');
      const forced = await api(ctx, user.token).post('/plano-alimentar/gerar').send({ force: true, days: 1 });
      expect(forced.status).toBe(201);
      expect(await ctx.prisma.mealPlan.count({ where: { userId: user.id, status: 'active' } })).toBe(1);
      expect(await ctx.prisma.mealPlan.count({ where: { userId: user.id, status: 'archived' } })).toBe(1);
    });

    it('trocar refeicao mantem itens travados e muda o resto; ajustar item recalcula totais', async () => {
      const plan = (await api(ctx, user.token).get('/plano-alimentar')).body;
      const lunch = plan.days[0].meals.find((m: { mealType: string }) => m.mealType === 'lunch');
      const kept = lunch.items[0];

      const swapped = await api(ctx, user.token).post(`/plano-alimentar/refeicoes/${lunch.id}/trocar`).send({ keepItemIds: [kept.id] });
      expect(swapped.status).toBe(200);
      const newLunch = swapped.body.days[0].meals.find((m: { id: string }) => m.id === lunch.id);
      expect(newLunch.items.map((i: { name: string }) => i.name)).toContain(kept.name);
      expect(newLunch.items.map((i: { name: string }) => i.name).sort()).not.toEqual(lunch.items.map((i: { name: string }) => i.name).sort());

      const item = newLunch.items.find((i: { unit: string }) => i.unit === 'g');
      const updated = await api(ctx, user.token).put(`/plano-alimentar/itens/${item.id}`).send({ quantity: item.grams + 100, unit: 'g', grams: item.grams + 100 });
      const after = updated.body.days[0].meals.find((m: { id: string }) => m.id === lunch.id);
      expect(after.totals.calories).toBeGreaterThan(newLunch.totals.calories);
    });

    it('outro usuario nao mexe no plano', async () => {
      const other = await createUser(ctx);
      const plan = (await api(ctx, user.token).get('/plano-alimentar')).body;
      const meal = plan.days[0].meals[0];
      expect((await api(ctx, other.token).post(`/plano-alimentar/refeicoes/${meal.id}/trocar`).send({})).status).toBe(404);
      expect((await api(ctx, other.token).put(`/plano-alimentar/itens/${meal.items[0].id}`).send({ quantity: 10, unit: 'g', grams: 10 })).status).toBe(404);
      expect((await api(ctx, other.token).get('/plano-alimentar')).status).toBe(404);
    });
  });

  describe('treinos', () => {
    let user: TestUser;
    beforeAll(async () => {
      user = await createUser(ctx); // 3x/semana, iniciante, academia
    });

    it('gera plano full body 3x com exercicios do catalogo e equipamento do usuario', async () => {
      const res = await api(ctx, user.token).post('/treinos/gerar').send({});
      expect(res.status).toBe(201);
      expect(res.body.split).toBe('Corpo inteiro');
      expect(res.body.workouts).toHaveLength(3);
      const equipment = res.body.workouts.flatMap((w: { exercises: { exercise: { requiredEquipment: string[] } }[] }) =>
        w.exercises.flatMap((e) => e.exercise.requiredEquipment),
      );
      expect(equipment).not.toContain('barbell'); // usuario nao tem barra
      expect((await api(ctx, user.token).get('/treinos/plano')).body.id).toBe(res.body.id);
    });

    it('GET /treino-dia: segunda = Treino A; terca = descanso com proximo treino', async () => {
      ctx.setNow(new Date('2026-09-28T12:00:00Z')); // segunda, 09h em Sao Paulo
      const monday = await api(ctx, user.token).get('/treino-dia');
      expect(monday.status).toBe(200);
      expect(monday.body).toMatchObject({ date: '2026-09-28', weekday: 0, isRestDay: false });
      expect(monday.body.workout.name).toMatch(/^Treino A/);

      ctx.setNow(new Date('2026-09-29T12:00:00Z')); // terca
      const tuesday = await api(ctx, user.token).get('/treino-dia');
      expect(tuesday.body).toMatchObject({ isRestDay: true, workout: null });
      expect(tuesday.body.nextWorkout).toMatchObject({ date: '2026-09-30', name: expect.stringMatching(/^Treino B/) });
    });

    it('execucao: iniciar (409 se ja ha um), registrar series (idempotente), concluir com volume', async () => {
      const plan = (await api(ctx, user.token).get('/treinos/plano')).body;
      const workout = plan.workouts[0];
      const [ex1, ex2] = workout.exercises;

      const start = await api(ctx, user.token).post(`/treinos/${workout.id}/iniciar`);
      expect(start.status).toBe(201);
      const logId = start.body.id;
      const dup = await api(ctx, user.token).post(`/treinos/${plan.workouts[1].id}/iniciar`);
      expect(dup.status).toBe(409);
      expect(errorCode(dup)).toBe('workout_in_progress');

      const sets = [
        { setNumber: 1, reps: 10, loadKg: 40 },
        { setNumber: 2, reps: 8, loadKg: 42.5 },
      ];
      const body = { workoutLogId: logId, workoutExerciseId: ex1.id, sets };
      await api(ctx, user.token).post(`/treinos/exercicios/${ex1.id}/registro`).send(body);
      const resend = await api(ctx, user.token).post(`/treinos/exercicios/${ex1.id}/registro`).send(body);
      expect(resend.status).toBe(200);
      expect(resend.body.exercises).toHaveLength(1);
      expect(resend.body.exercises[0].sets).toHaveLength(2); // reenvio nao duplica

      await api(ctx, user.token).post(`/treinos/exercicios/${ex2.id}/registro`).send({
        workoutLogId: logId, workoutExerciseId: ex2.id, sets: [{ setNumber: 1, reps: 12, loadKg: 10, isWarmup: true }, { setNumber: 2, reps: 12, loadKg: 20 }],
      });

      const done = await api(ctx, user.token).post(`/treinos/${workout.id}/concluir`).send({ durationSeconds: 2700, perceivedEffort: 7 });
      expect(done.status).toBe(200);
      // 10x40 + 8x42.5 + 12x20 (aquecimento fora) = 400 + 340 + 240
      expect(done.body).toMatchObject({ status: 'completed', totalVolumeKg: 980 });

      const historico = await api(ctx, user.token).get('/treinos/historico');
      expect(historico.body.items[0]).toMatchObject({ id: logId, status: 'completed' });

      // Detalhe do treino sugere carga a partir do ultimo registro.
      const detail = await api(ctx, user.token).get(`/treinos/${workout.id}`);
      expect(detail.body.lastLogs.find((l: { exerciseId: string }) => l.exerciseId === ex1.exerciseId).sets).toHaveLength(2);
    });

    it('registro com id de rota diferente do corpo -> 422; outro usuario -> 404', async () => {
      const plan = (await api(ctx, user.token).get('/treinos/plano')).body;
      const [ex1, ex2] = plan.workouts[1].exercises;
      const mismatch = await api(ctx, user.token).post(`/treinos/exercicios/${ex1.id}/registro`).send({
        workoutLogId: '00000000-0000-4000-8000-000000000000', workoutExerciseId: ex2.id, sets: [{ setNumber: 1, reps: 1 }],
      });
      expect(errorCode(mismatch)).toBe('id_mismatch');

      const other = await createUser(ctx);
      expect((await api(ctx, other.token).post(`/treinos/${plan.workouts[1].id}/iniciar`)).status).toBe(404);
      expect((await api(ctx, other.token).get(`/treinos/${plan.workouts[1].id}`)).status).toBe(404);
    });

    it('sem plano: /treino-dia -> 404', async () => {
      const fresh = await createUser(ctx);
      expect((await api(ctx, fresh.token).get('/treino-dia')).status).toBe(404);
    });
  });

  describe('progresso', () => {
    it('medidas (upsert por dia), media movel, calorias x meta e streak', async () => {
      const user = await createUser(ctx);
      ctx.setNow(new Date('2026-10-01T15:00:00Z'));
      for (const [date, value] of [['2026-09-25', 70], ['2026-09-28', 69.4], ['2026-10-01', 69]] as const) {
        expect((await api(ctx, user.token).post('/progresso/medidas').send({ metric: 'weight_kg', value, measuredOn: date })).status).toBe(200);
      }
      // repesagem no mesmo dia substitui
      await api(ctx, user.token).post('/progresso/medidas').send({ metric: 'weight_kg', value: 68.8, measuredOn: '2026-10-01' });

      const item = { nameSnapshot: 'arroz', per100gSnapshot: { calories: 128, protein: 2.5, carbs: 28, fat: 0.2 }, quantity: 200, unit: 'g', grams: 200, portionSource: 'manual_entry' };
      for (const day of ['2026-09-30', '2026-10-01']) {
        await api(ctx, user.token).post('/diario').send({ mealType: 'lunch', consumedAt: `${day}T15:00:00Z`, foods: [item] });
      }

      const res = await api(ctx, user.token).get('/progresso?granularity=day&from=2026-09-20&to=2026-10-01');
      expect(res.status).toBe(200);
      expect(res.body.weightSeries.map((p: { date: string; value: number }) => [p.date, p.value])).toEqual([
        ['2026-09-25', 70],
        ['2026-09-28', 69.4],
        ['2026-10-01', 68.8],
      ]);
      expect(res.body.weightTrendSeries).toHaveLength(3);
      expect(res.body.loggingStreakDays).toBe(2);
      expect(res.body.calorieSeries).toHaveLength(12);
      expect(res.body.calorieSeries.at(-1)).toMatchObject({ date: '2026-10-01', consumed: 256 });

      const logs = await ctx.prisma.progressLog.findMany({ where: { userId: user.id } });
      const other = await createUser(ctx);
      expect((await api(ctx, other.token).delete(`/progresso/medidas/${logs[0]!.id}`)).status).toBe(404);
      expect((await api(ctx, user.token).delete(`/progresso/medidas/${logs[0]!.id}`)).status).toBe(204);
    });
  });
});
