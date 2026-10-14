import { describe, expect, it } from 'vitest';
import { buildDailySummary } from '../src/domain/nutrition/daily-summary.js';
import { MEAL_TYPE_ORDER } from '../src/schemas/enums.js';

const TARGETS = { calories: 2200, protein: 160, carbs: 240, fat: 61, fiber: 30 };

const entry = (mealType: (typeof MEAL_TYPE_ORDER)[number], calories: number) => ({
  mealType,
  totals: { calories, protein: calories / 20, carbs: calories / 10, fat: calories / 40, fiber: 2 },
});

describe('buildDailySummary', () => {
  it('soma o consumo e calcula o restante', () => {
    const summary = buildDailySummary({
      date: '2026-09-10',
      targets: TARGETS,
      entries: [entry('breakfast', 450), entry('lunch', 700), entry('afternoon_snack', 300)],
    });

    expect(summary.consumed.calories).toBe(1450);
    expect(summary.calories.remaining).toBe(750);
    expect(summary.calories.percent).toBe(66);
    expect(summary.isOverCalorieTarget).toBe(false);
  });

  it('nao devolve restante negativo, mas marca o estouro da meta', () => {
    const summary = buildDailySummary({
      date: '2026-09-10',
      targets: TARGETS,
      entries: [entry('lunch', 2500)],
    });

    expect(summary.calories.remaining).toBe(0);
    expect(summary.calories.percent).toBeGreaterThan(100);
    expect(summary.isOverCalorieTarget).toBe(true);
  });

  it('devolve todas as refeicoes na ordem canonica, inclusive as vazias', () => {
    const summary = buildDailySummary({
      date: '2026-09-10',
      targets: TARGETS,
      entries: [entry('dinner', 600)],
    });

    expect(summary.byMealType.map((b) => b.mealType)).toEqual([...MEAL_TYPE_ORDER]);

    const breakfast = summary.byMealType.find((b) => b.mealType === 'breakfast');
    expect(breakfast?.entryCount).toBe(0);
    expect(breakfast?.totals.calories).toBe(0);

    const dinner = summary.byMealType.find((b) => b.mealType === 'dinner');
    expect(dinner?.entryCount).toBe(1);
    expect(dinner?.totals.calories).toBe(600);
  });

  it('agrupa varias entradas da mesma refeicao', () => {
    const summary = buildDailySummary({
      date: '2026-09-10',
      targets: TARGETS,
      entries: [entry('lunch', 400), entry('lunch', 250)],
    });

    const lunch = summary.byMealType.find((b) => b.mealType === 'lunch');
    expect(lunch?.entryCount).toBe(2);
    expect(lunch?.totals.calories).toBe(650);
  });

  it('dia sem registro devolve tudo zerado e a meta intacta', () => {
    const summary = buildDailySummary({ date: '2026-09-10', targets: TARGETS, entries: [] });

    expect(summary.consumed.calories).toBe(0);
    expect(summary.calories.remaining).toBe(2200);
    expect(summary.calories.percent).toBe(0);
    expect(summary.protein.remaining).toBe(160);
  });
});
