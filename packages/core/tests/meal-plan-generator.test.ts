import { readFileSync } from 'node:fs';
import {
  buildPlanMeal,
  generateMealPlan,
  mealTotals,
  type MealContext,
  type PlanFood,
} from '../src/domain/nutrition/meal-plan-generator.js';
import { roundNutrition, sumNutrition } from '../src/domain/nutrition/portions.js';

// Fixture real: a mesma tabela usada pelo servico de IA e pelo seed do banco.
const table = JSON.parse(
  readFileSync(new URL('../../../apps/ia/app/dados/alimentos.json', import.meta.url), 'utf8'),
) as { foods: { canonicalName: string; name: string; category: PlanFood['category']; preparationMethod: PlanFood['preparationMethod']; per100g: PlanFood['per100g']; baseUnit: 'g' | 'ml'; portion: { defaultGrams: number }; tags: string[] }[] };
const FOODS = new Map<string, PlanFood>(
  table.foods.map((f) => [
    f.canonicalName,
    { ...f, typicalPortionGrams: f.portion.defaultGrams },
  ]),
);

const ctx = (over: Partial<MealContext> = {}): MealContext => ({ foods: FOODS, restrictions: [], dislikedFoods: [], ...over });
const dayTotals = (meals: Parameters<typeof mealTotals>[0][]) => roundNutrition(sumNutrition(meals.map(mealTotals)));

describe('generateMealPlan', () => {
  it.each([
    [1600, 110, 3, []],
    [2000, 130, 4, []],
    [2600, 160, 5, []],
    [3200, 180, 6, []],
    // Perda de peso com proteina alta (35% das kcal) e sem lactose: caso que ja estourou a meta.
    [1573, 136, 4, ['lactose_free']],
    [1500, 120, 5, ['vegetarian']],
    [1800, 100, 4, ['vegan', 'gluten_free']],
  ] as const)('%i kcal / %i g proteina / %i refeicoes / %j: cada dia fica a 10%% da meta', (calories, protein, mealsPerDay, restrictions) => {
    const plan = generateMealPlan({ targets: { calories, protein }, mealsPerDay, dayIndexes: [0, 1, 2, 3, 4, 5, 6], ctx: ctx({ restrictions: [...restrictions] }) });
    expect(plan.days).toHaveLength(7);
    for (const day of plan.days) {
      expect(day.meals).toHaveLength(mealsPerDay);
      const t = dayTotals(day.meals);
      expect(Math.abs(t.calories - calories) / calories).toBeLessThanOrEqual(0.1);
      expect(t.protein).toBeGreaterThanOrEqual(protein * 0.85);
    }
  });

  it('varia o cardapio entre dias e entre almoco e jantar', () => {
    const plan = generateMealPlan({ targets: { calories: 2000, protein: 130 }, mealsPerDay: 4, dayIndexes: [0, 1], ctx: ctx() });
    const lunch = (d: number) => plan.days[d]!.meals.find((m) => m.mealType === 'lunch')!;
    const dinner = plan.days[0]!.meals.find((m) => m.mealType === 'dinner')!;
    expect(lunch(0).name).not.toBe(lunch(1).name);
    expect(lunch(0).name).not.toBe(dinner.name);
  });

  it('vegano: nenhum item de origem animal', () => {
    const plan = generateMealPlan({ targets: { calories: 2000, protein: 100 }, mealsPerDay: 4, dayIndexes: [0, 1, 2], ctx: ctx({ restrictions: ['vegan'] }) });
    const items = plan.days.flatMap((d) => d.meals.flatMap((m) => m.items));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(FOODS.get(item.canonicalName)!.tags).not.toContain('animal');
  });

  it('sem lactose e sem gluten', () => {
    const plan = generateMealPlan({ targets: { calories: 2200, protein: 140 }, mealsPerDay: 5, dayIndexes: [0, 1, 2, 3, 4, 5, 6], ctx: ctx({ restrictions: ['lactose_free', 'gluten_free'] }) });
    for (const item of plan.days.flatMap((d) => d.meals.flatMap((m) => m.items))) {
      const tags = FOODS.get(item.canonicalName)!.tags;
      expect(tags).not.toContain('lactose');
      expect(tags).not.toContain('gluten');
    }
  });

  it('respeita alimentos que o usuario nao gosta (sem acento, por trecho do nome)', () => {
    const plan = generateMealPlan({ targets: { calories: 2000, protein: 130 }, mealsPerDay: 4, dayIndexes: [0, 1, 2, 3, 4, 5, 6], ctx: ctx({ dislikedFoods: ['feijão', 'tilapia'] }) });
    const names = plan.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.canonicalName)));
    expect(names.some((n) => n.includes('beans'))).toBe(false);
    expect(names).not.toContain('tilapia_fillet_grilled');
  });

  it('itens tem gramas multiplas de 5, unidade coerente e substitutos equivalentes', () => {
    const plan = generateMealPlan({ targets: { calories: 2000, protein: 130 }, mealsPerDay: 4, dayIndexes: [0], ctx: ctx() });
    for (const item of plan.days[0]!.meals.flatMap((m) => m.items)) {
      expect(item.grams % 5).toBe(0);
      expect(item.quantity).toBe(item.grams);
      for (const sub of item.substitutes) {
        const kcalItem = (item.per100g.calories * item.grams) / 100;
        const kcalSub = (sub.per100g.calories * sub.grams) / 100;
        expect(Math.abs(kcalItem - kcalSub)).toBeLessThanOrEqual(Math.max(20, kcalItem * 0.1));
      }
    }
  });
});

describe('buildPlanMeal (troca de refeicao)', () => {
  it('outra variante muda a refeicao e mantem itens travados', () => {
    const base = buildPlanMeal({ mealType: 'lunch', targets: { calories: 700, protein: 45 }, ctx: ctx(), variant: 0 });
    const rice = base.items.find((i) => i.canonicalName === 'white_rice_cooked')!;
    const swapped = buildPlanMeal({ mealType: 'lunch', targets: { calories: 700, protein: 45 }, ctx: ctx(), variant: 1, keep: [rice] });
    expect(swapped.items).toContainEqual(rice);
    // nenhum outro carboidrato principal quando o arroz esta travado
    expect(swapped.items.filter((i) => ['brown_rice_cooked', 'pasta_cooked', 'sweet_potato_boiled'].includes(i.canonicalName))).toHaveLength(0);
    expect(swapped.name).not.toBe(base.name);
    expect(Math.abs(mealTotals(swapped).calories - 700)).toBeLessThanOrEqual(70);
  });
});
