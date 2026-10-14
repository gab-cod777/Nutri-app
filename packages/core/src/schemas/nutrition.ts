import { z } from 'zod';
import { goalPaceSchema, goalSchema, mealTypeSchema } from './enums.js';
import { activitySelectionSchema, goalSelectionSchema, physicalDataSchema } from './profile.js';

/**
 * Contratos de calculo fisico, meta e resumo diario (`/calculo-fisico`, `/dieta/*`).
 *
 * As respostas espelham as interfaces de `domain/nutrition/*` - o servidor
 * devolve o resultado das MESMAS funcoes que o app roda offline.
 */

/** Corpo de `POST /calculo-fisico`. Sem efeito colateral. */
export const energyPlanRequestSchema = physicalDataSchema
  .merge(goalSelectionSchema.pick({ goal: true, pace: true }))
  .merge(activitySelectionSchema.pick({ activityLevel: true }))
  .extend({
    /** Meta manual opcional. Ainda passa pelo piso de seguranca. */
    manualTargetCalories: z.number().int().min(800).max(10000).nullish(),
  });
export type EnergyPlanRequest = z.infer<typeof energyPlanRequestSchema>;

const nutritionTotalsSchema = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
});

const macroTargetSchema = z.object({
  grams: z.number(),
  kcal: z.number(),
  percent: z.number(),
});

export const calorieWarningSchema = z.enum([
  'floor_applied',
  'below_bmr',
  'aggressive_deficit',
  'aggressive_surplus',
  'manual_override',
]);

/** Espelha `EnergyPlan` de `domain/nutrition/energy-plan.ts`. */
export const energyPlanSchema = z.object({
  bmr: z.object({
    bmr: z.number(),
    formula: z.enum(['mifflin_st_jeor', 'katch_mcardle']),
    leanBodyMassKg: z.number().nullable(),
  }),
  tdee: z.object({
    tdee: z.number(),
    activityFactor: z.number(),
    activityKcal: z.number(),
  }),
  calories: z.object({
    targetCalories: z.number(),
    tdee: z.number(),
    bmr: z.number(),
    adjustmentKcal: z.number(),
    adjustmentPercent: z.number(),
    direction: z.enum(['deficit', 'surplus', 'maintenance']),
    projectedWeeklyWeightChangeKg: z.number(),
    safetyFloorCalories: z.number(),
    warnings: z.array(calorieWarningSchema),
  }),
  macros: z.object({
    calories: z.number(),
    protein: macroTargetSchema,
    carbs: macroTargetSchema,
    fat: macroTargetSchema,
    fiberGrams: z.number(),
    referenceWeightKg: z.number(),
  }),
  disclaimer: z.string(),
});
export type EnergyPlanResponse = z.infer<typeof energyPlanSchema>;

/** Meta calorica versionada (`NutritionTarget`). */
export const nutritionTargetSchema = z.object({
  id: z.string().uuid(),
  effectiveFrom: z.string().date(),
  /** Exclusivo. Nulo = meta vigente. */
  effectiveTo: z.string().date().nullable(),
  bmr: z.number(),
  tdee: z.number(),
  activityFactor: z.number(),
  bmrFormula: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  goal: goalSchema,
  pace: goalPaceSchema,
  isManualOverride: z.boolean(),
  warnings: z.array(z.string()),
  disclaimer: z.string(),
});
export type NutritionTarget = z.infer<typeof nutritionTargetSchema>;

const macroProgressSchema = z.object({
  consumed: z.number(),
  target: z.number(),
  remaining: z.number(),
  percent: z.number(),
});

/** Espelha `DailySummary` de `domain/nutrition/daily-summary.ts`. */
export const dailySummarySchema = z.object({
  date: z.string().date(),
  consumed: nutritionTotalsSchema,
  targets: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number().nullish(),
  }),
  calories: macroProgressSchema,
  protein: macroProgressSchema,
  carbs: macroProgressSchema,
  fat: macroProgressSchema,
  byMealType: z.array(
    z.object({
      mealType: mealTypeSchema,
      totals: nutritionTotalsSchema,
      entryCount: z.number().int().nonnegative(),
    }),
  ),
  isOverCalorieTarget: z.boolean(),
  /** Id da meta usada na comparacao - a meta vigente NAQUELE dia. */
  targetId: z.string().uuid(),
});
export type DailySummaryResponse = z.infer<typeof dailySummarySchema>;
