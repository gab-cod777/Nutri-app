import {
  roundNutrition,
  scaleNutritionByGrams,
  sumNutrition,
  toLocalDate,
  type CreateMealInput,
  type ListMealsQuery,
  type Meal,
  type MealFoodInput,
  type MealListResponse,
  type UpdateMealInput,
} from '@nutrisnap/core';
import type { Prisma, PrismaClient } from '@prisma/client';
import { decodeCursor, encodeCursor, keysetCursorSchema } from '../../lib/cursor.js';
import { fromDbDate, toDbDate } from '../../lib/db-dates.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { getUserTimezone } from '../../lib/user-context.js';
import type { AlimentosRepository } from '../alimentos/alimentos.repository.js';
import type { DiarioRepository, MealWithFoods } from './diario.repository.js';

/** Tolerancia entre `quantity` e `grams` quando a unidade ja e g/ml. */
const GRAMS_TOLERANCE = 0.5;

/**
 * Diario alimentar (tabela "Diario Alimentar" do guia). A refeicao e um FATO
 * confirmado pelo usuario; os totais sao sempre recalculados aqui a partir do
 * snapshot por 100 g x gramas - nunca aceitos do cliente.
 */
export class DiarioService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly repo: DiarioRepository,
    private readonly foodsRepo: AlimentosRepository,
  ) {}

  async create(userId: string, input: CreateMealInput): Promise<Meal> {
    await this.assertFoodsUsable(userId, input.foods);

    if (input.analysisId) {
      const analysis = await this.repo.findAnalysis(userId, input.analysisId);
      if (!analysis) throw notFound('Analise');
      if (analysis.meal) {
        throw conflict('analysis_already_used', 'Esta analise ja foi salva como refeicao.', {
          mealId: analysis.meal.id,
        });
      }
      if (!analysis.isFood) throw unprocessable('analysis_not_food', 'A analise nao identificou comida.');
    }

    const timezone = await getUserTimezone(this.prisma, userId);
    const consumedAt = new Date(input.consumedAt);
    const foods = input.foods.map(toMealFoodRow);

    const meal = await this.prisma.$transaction(async (tx) => {
      const created = await this.repo.create(tx, {
        userId,
        mealType: input.mealType,
        consumedAt,
        localDate: toDbDate(toLocalDate(consumedAt, timezone)),
        title: input.title ?? null,
        notes: input.notes ?? null,
        analysisId: input.analysisId ?? null,
        ...totalsOf(foods),
        foods: { createMany: { data: foods } },
      });
      if (input.analysisId) await this.repo.markAnalysisAccepted(tx, input.analysisId);
      return created;
    });
    return toMealDto(meal);
  }

  async get(userId: string, id: string): Promise<Meal> {
    const meal = await this.repo.findById(userId, id);
    if (!meal) throw notFound('Refeicao');
    return toMealDto(meal);
  }

  async list(userId: string, query: ListMealsQuery): Promise<MealListResponse> {
    const cursor = decodeCursor(query.cursor, keysetCursorSchema);
    const where: Prisma.MealWhereInput = {
      ...(query.mealType ? { mealType: query.mealType } : {}),
      ...(query.date ? { localDate: toDbDate(query.date) } : {}),
      ...(query.from || query.to
        ? {
            localDate: {
              ...(query.from ? { gte: toDbDate(query.from) } : {}),
              ...(query.to ? { lte: toDbDate(query.to) } : {}),
            },
          }
        : {}),
    };
    const rows = await this.repo.list({
      userId,
      where,
      cursor: cursor ? { t: new Date(cursor.t), id: cursor.id } : null,
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    return {
      items: items.map(toMealDto),
      nextCursor:
        rows.length > query.limit && last ? encodeCursor({ t: last.consumedAt.toISOString(), id: last.id }) : null,
    };
  }

  async update(userId: string, id: string, input: UpdateMealInput): Promise<Meal> {
    const meal = await this.repo.findById(userId, id);
    if (!meal) throw notFound('Refeicao');

    if (input.analysisId !== undefined && input.analysisId !== meal.analysisId) {
      throw unprocessable('analysis_immutable', 'A analise de origem de uma refeicao nao pode ser trocada.');
    }
    if (input.foods) await this.assertFoodsUsable(userId, input.foods);

    const foods = input.foods ? input.foods.map(toMealFoodRow) : null;
    const data: Prisma.MealUncheckedUpdateInput = {
      mealType: input.mealType,
      title: input.title,
      notes: input.notes,
      ...(foods ? totalsOf(foods) : {}),
    };
    if (input.consumedAt) {
      const consumedAt = new Date(input.consumedAt);
      const timezone = await getUserTimezone(this.prisma, userId);
      data.consumedAt = consumedAt;
      data.localDate = toDbDate(toLocalDate(consumedAt, timezone));
    }

    const updated = await this.prisma.$transaction((tx) => this.repo.update(tx, meal.id, data, foods));
    return toMealDto(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.repo.delete(userId, id))) throw notFound('Refeicao');
  }

  /**
   * Cada item: gramas coerentes com a quantidade quando a unidade e g/ml, e
   * `foodId` (se houver) visivel ao usuario. Alimento privado de outro usuario
   * responde 404 como se nao existisse.
   */
  private async assertFoodsUsable(userId: string, foods: readonly MealFoodInput[]): Promise<void> {
    foods.forEach((food, index) => {
      if ((food.unit === 'g' || food.unit === 'ml') && Math.abs(food.grams - food.quantity) > GRAMS_TOLERANCE) {
        throw unprocessable('grams_mismatch', 'Para unidade g/ml, grams deve ser igual a quantity.', { index });
      }
    });
    const ids = [...new Set(foods.map((f) => f.foodId).filter((id): id is string => Boolean(id)))];
    const visible = await this.foodsRepo.findVisibleIds(userId, ids);
    if (ids.some((id) => !visible.has(id))) throw notFound('Alimento');
  }
}

type MealFoodRow = Prisma.MealFoodCreateManyMealInput & {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

function toMealFoodRow(food: MealFoodInput): MealFoodRow {
  const totals = scaleNutritionByGrams(food.per100gSnapshot, food.grams);
  return {
    foodId: food.foodId ?? null,
    nameSnapshot: food.nameSnapshot,
    caloriesPer100: food.per100gSnapshot.calories,
    proteinPer100: food.per100gSnapshot.protein,
    carbsPer100: food.per100gSnapshot.carbs,
    fatPer100: food.per100gSnapshot.fat,
    fiberPer100: food.per100gSnapshot.fiber,
    quantity: food.quantity,
    unit: food.unit,
    grams: food.grams,
    preparationMethod: food.preparationMethod,
    portionSource: food.portionSource,
    aiConfidence: food.aiConfidence ?? null,
    aiEstimatedGrams: food.aiEstimatedGrams ?? null,
    ...totals,
  };
}

function totalsOf(foods: readonly MealFoodRow[]) {
  const t = roundNutrition(sumNutrition(foods));
  return {
    totalCalories: t.calories,
    totalProtein: t.protein,
    totalCarbs: t.carbs,
    totalFat: t.fat,
    totalFiber: t.fiber,
  };
}

export function toMealDto(meal: MealWithFoods): Meal {
  return {
    id: meal.id,
    mealType: meal.mealType,
    consumedAt: meal.consumedAt.toISOString(),
    localDate: fromDbDate(meal.localDate),
    title: meal.title,
    notes: meal.notes,
    analysisId: meal.analysisId,
    totals: {
      calories: meal.totalCalories,
      protein: meal.totalProtein,
      carbs: meal.totalCarbs,
      fat: meal.totalFat,
      fiber: meal.totalFiber,
    },
    foods: meal.foods.map((f) => ({
      id: f.id,
      foodId: f.foodId,
      nameSnapshot: f.nameSnapshot,
      per100gSnapshot: {
        calories: f.caloriesPer100,
        protein: f.proteinPer100,
        carbs: f.carbsPer100,
        fat: f.fatPer100,
        fiber: f.fiberPer100,
      },
      quantity: f.quantity,
      unit: f.unit,
      grams: f.grams,
      preparationMethod: f.preparationMethod,
      portionSource: f.portionSource,
      aiConfidence: f.aiConfidence,
      aiEstimatedGrams: f.aiEstimatedGrams,
      totals: { calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber },
    })),
    createdAt: meal.createdAt.toISOString(),
    updatedAt: meal.updatedAt.toISOString(),
  };
}
