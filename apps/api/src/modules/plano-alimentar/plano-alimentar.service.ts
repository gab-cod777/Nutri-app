import {
  buildPlanMeal,
  diffDays,
  DISCLAIMERS,
  generateMealPlan,
  MEAL_PLAN_GENERATOR_VERSION,
  roundNutrition,
  scaleNutritionByGrams,
  startOfIsoWeek,
  sumNutrition,
  toLocalDate,
  type GenerateMealPlanRequest,
  type MealContext,
  type MealPlan,
  type NutritionTotals,
  type PlanItem,
  type PlanMeal,
  type SwapMealRequest,
  type UpdateMealPlanItemInput,
} from '@nutrisnap/core';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { fromDbDate, toDbDate } from '../../lib/db-dates.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { requireProfile } from '../../lib/user-context.js';
import type { AlimentosRepository } from '../alimentos/alimentos.repository.js';
import type { DietaService } from '../dieta/dieta.service.js';
import type { MealPlanFull, PlanoAlimentarRepository } from './plano-alimentar.repository.js';

/** Quantas variantes a troca tenta ate achar uma refeicao realmente diferente. */
const MAX_SWAP_VARIANTS = 12;

const substitutesSchema = z
  .array(
    z.object({
      name: z.string(),
      grams: z.number(),
      per100g: z.object({ calories: z.number(), protein: z.number(), carbs: z.number(), fat: z.number(), fiber: z.number() }),
    }),
  )
  .catch([]);

/**
 * Plano alimentar (MVP item 9). Montado pelas regras de
 * `generateMealPlan` do core a partir da meta vigente e das restricoes do
 * perfil - na hora, sem chamada externa.
 */
export class PlanoAlimentarService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly repo: PlanoAlimentarRepository,
    private readonly foodsRepo: AlimentosRepository,
    private readonly dieta: DietaService,
    private readonly now: () => Date,
  ) {}

  async generate(userId: string, input: GenerateMealPlanRequest): Promise<MealPlan> {
    const profile = await requireProfile(this.prisma, userId);
    const target = await this.dieta.requireCurrentTarget(userId);
    if (!input.force && (await this.repo.findActive(userId))) {
      throw conflict('active_plan_exists', 'Ja existe um plano ativo. Envie force: true para gerar outro.');
    }

    const today = toLocalDate(this.now(), profile.timezone);
    const startsOn = startOfIsoWeek(today);
    const todayIndex = diffDays(startsOn, today);
    const dayIndexes = Array.from({ length: input.days }, (_, i) => (todayIndex + i) % 7);
    const ctx = await this.context(profile.restrictions, profile.dislikedFoods);

    const plan = generateMealPlan({
      targets: { calories: target.calories, protein: target.protein },
      mealsPerDay: profile.mealsPerDay,
      dayIndexes,
      ctx,
    });

    const planId = await this.prisma.$transaction(async (tx) => {
      await tx.mealPlan.updateMany({ where: { userId, status: 'active' }, data: { status: 'archived' } });
      const created = await tx.mealPlan.create({
        data: {
          userId,
          name: plan.name,
          status: 'active',
          startsOn: toDbDate(startsOn),
          targetCalories: target.calories,
          targetProtein: target.protein,
          targetCarbs: target.carbs,
          targetFat: target.fat,
          rationale: plan.rationale.slice(0, 500),
          generatorVersion: MEAL_PLAN_GENERATOR_VERSION,
        },
      });
      for (const day of plan.days) {
        await tx.mealPlanDay.create({
          data: {
            planId: created.id,
            dayIndex: day.dayIndex,
            ...totalsColumns(sumMeals(day.meals)),
            meals: { create: day.meals.map((meal) => mealRow(meal, ctx)) },
          },
        });
      }
      return created.id;
    });
    return this.requireActivePlan(userId, planId);
  }

  async current(userId: string): Promise<MealPlan> {
    const plan = await this.repo.findActive(userId);
    if (!plan) throw notFound('Plano alimentar');
    return toMealPlanDto(plan);
  }

  /** Troca UMA refeicao por outra do mesmo tipo e calorias parecidas. Itens travados ficam. */
  async swapMeal(userId: string, mealId: string, input: SwapMealRequest): Promise<MealPlan> {
    const meal = await this.repo.findMealInActivePlan(userId, mealId);
    if (!meal) throw notFound('Refeicao do plano');
    const itemIds = new Set(meal.items.map((i) => i.id));
    if (input.keepItemIds.some((id) => !itemIds.has(id))) {
      throw unprocessable('invalid_keep_item', 'keepItemIds contem item que nao pertence a esta refeicao.');
    }
    const profile = await requireProfile(this.prisma, userId);
    const ctx = await this.context(profile.restrictions, profile.dislikedFoods);

    const current = sumItems(meal.items);
    const keep: PlanItem[] = meal.items.filter((i) => input.keepItemIds.includes(i.id)).map(toPlanItem);
    const currentNames = new Set(meal.items.map((i) => i.food?.canonicalName ?? i.name));

    let replacement: PlanMeal | null = null;
    for (let variant = 1; variant <= MAX_SWAP_VARIANTS && !replacement; variant += 1) {
      const candidate = buildPlanMeal({
        mealType: meal.mealType,
        targets: { calories: current.calories, protein: current.protein },
        ctx,
        variant: variant + meal.items.length,
        keep,
      });
      const changed = candidate.items.some((i) => !currentNames.has(i.canonicalName));
      if (changed) replacement = candidate;
    }
    if (!replacement) {
      throw conflict('no_alternative', 'Nao ha outra combinacao de alimentos permitidos para esta refeicao.');
    }

    const chosen = replacement;
    await this.prisma.$transaction(async (tx) => {
      await tx.mealPlanItem.deleteMany({ where: { mealId: meal.id } });
      await tx.mealPlanItem.createMany({ data: chosen.items.map((i) => ({ ...itemRow(i, ctx), mealId: meal.id })) });
      await tx.mealPlanMeal.update({
        where: { id: meal.id },
        data: { name: chosen.name, preparationTip: chosen.preparationTip },
      });
      await recomputeTotals(tx, meal.id, meal.dayId);
    });
    return this.requireActivePlan(userId, meal.day.planId);
  }

  async updateItem(userId: string, itemId: string, input: UpdateMealPlanItemInput): Promise<MealPlan> {
    const item = await this.repo.findItemInActivePlan(userId, itemId);
    if (!item) throw notFound('Item do plano');
    if ((input.unit === 'g' || input.unit === 'ml') && Math.abs(input.grams - input.quantity) > 0.5) {
      throw unprocessable('grams_mismatch', 'Para unidade g/ml, grams deve ser igual a quantity.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.mealPlanItem.update({
        where: { id: item.id },
        data: { quantity: input.quantity, unit: input.unit, grams: input.grams },
      });
      await recomputeTotals(tx, item.mealId, item.meal.dayId);
    });
    return this.requireActivePlan(userId, item.meal.day.planId);
  }

  private async context(restrictions: MealContext['restrictions'], dislikedFoods: readonly string[]): Promise<MealContext & { ids: Map<string, string> }> {
    const foods = await this.foodsRepo.findPlanFoods();
    const ids = await this.foodsRepo.publicIdsByCanonicalName([...foods.keys()]);
    return { foods, restrictions, dislikedFoods, ids };
  }

  private async requireActivePlan(userId: string, planId: string): Promise<MealPlan> {
    const plan = await this.repo.findActiveById(userId, planId);
    if (!plan) throw notFound('Plano alimentar');
    return toMealPlanDto(plan);
  }
}

type ItemLike = {
  grams: number;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  fiberPer100: number;
};

function per100Of(item: ItemLike) {
  return { calories: item.caloriesPer100, protein: item.proteinPer100, carbs: item.carbsPer100, fat: item.fatPer100, fiber: item.fiberPer100 };
}

function sumItems(items: readonly ItemLike[]): NutritionTotals {
  return roundNutrition(sumNutrition(items.map((i) => scaleNutritionByGrams(per100Of(i), i.grams))));
}

function sumMeals(meals: readonly PlanMeal[]): NutritionTotals {
  return roundNutrition(sumNutrition(meals.flatMap((m) => m.items.map((i) => scaleNutritionByGrams(i.per100g, i.grams)))));
}

function totalsColumns(t: NutritionTotals) {
  return { totalCalories: t.calories, totalProtein: t.protein, totalCarbs: t.carbs, totalFat: t.fat };
}

function itemRow(item: PlanItem, ctx: { ids: Map<string, string> }) {
  return {
    foodId: ctx.ids.get(item.canonicalName) ?? null,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    grams: item.grams,
    preparationMethod: item.preparationMethod,
    caloriesPer100: item.per100g.calories,
    proteinPer100: item.per100g.protein,
    carbsPer100: item.per100g.carbs,
    fatPer100: item.per100g.fat,
    fiberPer100: item.per100g.fiber,
    // Coluna JSON: objetos simples, sem tipos de interface.
    substitutes: item.substitutes.map((sub) => ({
      name: sub.name,
      grams: sub.grams,
      per100g: {
        calories: sub.per100g.calories,
        protein: sub.per100g.protein,
        carbs: sub.per100g.carbs,
        fat: sub.per100g.fat,
        fiber: sub.per100g.fiber,
      },
    })) satisfies Prisma.InputJsonArray,
  };
}

function mealRow(meal: PlanMeal, ctx: { ids: Map<string, string> }) {
  return {
    mealType: meal.mealType,
    name: meal.name,
    suggestedTime: meal.suggestedTime,
    preparationTip: meal.preparationTip,
    ...totalsColumns(sumMeals([meal])),
    items: { create: meal.items.map((i) => itemRow(i, ctx)) },
  };
}

function toPlanItem(row: MealPlanFull['days'][number]['meals'][number]['items'][number]): PlanItem {
  return {
    canonicalName: row.food?.canonicalName ?? row.name,
    name: row.name,
    grams: row.grams,
    quantity: row.quantity,
    unit: row.unit,
    per100g: per100Of(row),
    preparationMethod: row.preparationMethod,
    substitutes: substitutesSchema.parse(row.substitutes),
  };
}

async function recomputeTotals(tx: Prisma.TransactionClient, mealId: string, dayId: string): Promise<void> {
  const mealItems = await tx.mealPlanItem.findMany({ where: { mealId } });
  await tx.mealPlanMeal.update({ where: { id: mealId }, data: totalsColumns(sumItems(mealItems)) });
  const dayItems = await tx.mealPlanItem.findMany({ where: { meal: { dayId } } });
  await tx.mealPlanDay.update({ where: { id: dayId }, data: totalsColumns(sumItems(dayItems)) });
}

/** Totais sempre derivados dos itens: as colunas denormalizadas nao tem fibra. */
export function toMealPlanDto(plan: MealPlanFull): MealPlan {
  return {
    id: plan.id,
    name: plan.name,
    status: plan.status,
    startsOn: fromDbDate(plan.startsOn),
    targetCalories: Math.max(1, Math.round(plan.targetCalories)),
    targetProtein: plan.targetProtein,
    targetCarbs: plan.targetCarbs,
    targetFat: plan.targetFat,
    days: plan.days.map((day) => ({
      id: day.id,
      dayIndex: day.dayIndex,
      totals: sumItems(day.meals.flatMap((m) => m.items)),
      meals: day.meals.map((meal) => ({
        id: meal.id,
        mealType: meal.mealType,
        name: meal.name,
        suggestedTime: meal.suggestedTime,
        preparationTip: meal.preparationTip,
        totals: sumItems(meal.items),
        items: meal.items.map((item) => ({
          id: item.id,
          foodId: item.foodId,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          grams: item.grams,
          per100g: per100Of(item),
          preparationMethod: item.preparationMethod,
          substitutes: substitutesSchema.parse(item.substitutes),
        })),
      })),
    })),
    disclaimer: DISCLAIMERS.mealPlan,
  };
}
