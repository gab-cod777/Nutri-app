import { z } from 'zod';
import { nutritionPer100Schema, preparationMethodSchema } from './ai.js';
import { mealTypeSchema, measureUnitSchema, planStatusSchema } from './enums.js';

/** Um alimento dentro de uma refeicao do plano. */
export const mealPlanItemSchema = z.object({
  id: z.string().uuid(),
  foodId: z.string().uuid().nullish(),
  name: z.string().trim().min(2).max(120),
  quantity: z.number().positive().max(5000),
  unit: measureUnitSchema,
  grams: z.number().positive().max(5000),
  per100g: nutritionPer100Schema,
  preparationMethod: preparationMethodSchema.default('unknown'),
  /** Alternativas equivalentes em calorias/macros, para o botao "trocar alimento". */
  substitutes: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        grams: z.number().positive().max(5000),
        per100g: nutritionPer100Schema,
      }),
    )
    .max(3)
    .default([]),
});
export type MealPlanItem = z.infer<typeof mealPlanItemSchema>;

export const mealPlanMealSchema = z.object({
  id: z.string().uuid(),
  mealType: mealTypeSchema,
  name: z.string().trim().min(2).max(80),
  /** Horario sugerido no formato HH:mm. */
  suggestedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  items: z.array(mealPlanItemSchema).min(1).max(12),
  totals: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
  }),
  preparationTip: z.string().trim().max(300).nullish(),
});
export type MealPlanMeal = z.infer<typeof mealPlanMealSchema>;

export const mealPlanDaySchema = z.object({
  id: z.string().uuid(),
  /** 0 = segunda-feira. */
  dayIndex: z.number().int().min(0).max(6),
  meals: z.array(mealPlanMealSchema).min(2).max(8),
  totals: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
  }),
});
export type MealPlanDay = z.infer<typeof mealPlanDaySchema>;

export const mealPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  status: planStatusSchema,
  startsOn: z.string().date(),
  targetCalories: z.number().int().positive(),
  targetProtein: z.number().nonnegative(),
  targetCarbs: z.number().nonnegative(),
  targetFat: z.number().nonnegative(),
  days: z.array(mealPlanDaySchema).min(1).max(7),
  disclaimer: z.string(),
});
export type MealPlan = z.infer<typeof mealPlanSchema>;

/** Corpo de `POST /plano-alimentar/gerar`. O plano e montado por regras do core, na hora. */
export const generateMealPlanRequestSchema = z.object({
  /** Quantos dias gerar a partir de hoje. 7 = semana completa. */
  days: z.number().int().min(1).max(7).default(7),
  /** Substitui o plano ativo (o anterior e arquivado). */
  force: z.boolean().default(false),
});
export type GenerateMealPlanRequest = z.infer<typeof generateMealPlanRequestSchema>;

/** Corpo de `POST /plano-alimentar/refeicoes/:mealId/trocar`. */
export const swapMealRequestSchema = z.object({
  /** Trava alimentos que o usuario quer manter na refeicao. */
  keepItemIds: z.array(z.string().uuid()).max(12).default([]),
});
export type SwapMealRequest = z.infer<typeof swapMealRequestSchema>;

/** Corpo de `PUT /plano-alimentar/itens/:itemId`. Os totais sao recalculados pelo servidor. */
export const updateMealPlanItemSchema = z.object({
  quantity: z.number().positive().max(5000),
  unit: measureUnitSchema,
  grams: z.number().positive().max(5000),
});
export type UpdateMealPlanItemInput = z.infer<typeof updateMealPlanItemSchema>;
