import {
  buildDailySummary,
  buildEnergyPlan,
  DISCLAIMERS,
  yearsSince,
  type ActivityLevel,
  type DailySummaryResponse,
  type EnergyPlan,
  type EnergyPlanRequest,
  type Goal,
  type GoalPace,
  type NutritionTarget as NutritionTargetDto,
  type Sex,
} from '@nutrisnap/core';
import type { NutritionTarget, Prisma } from '@prisma/client';
import { fromDbDate } from '../../lib/db-dates.js';
import { conflict } from '../../lib/errors.js';
import type { DietaRepository } from './dieta.repository.js';

/** Dados do perfil que alimentam o calculo de energia. */
export interface EnergyInputs {
  readonly sex: Sex;
  readonly birthDate: string;
  readonly heightCm: number;
  readonly weightKg: number;
  readonly bodyFatPercentage?: number | null;
  readonly activityLevel: ActivityLevel;
  readonly goal: Goal;
  readonly pace: GoalPace;
}

/**
 * Orquestra os calculos do core com persistencia. Nenhuma formula vive aqui:
 * TMB, TDEE, meta, macros e resumo diario sao todos de `@nutrisnap/core`.
 */
export class DietaService {
  constructor(private readonly repo: DietaRepository) {}

  /** Idade calculada na data de referencia (`today`), nao no relogio do servidor. */
  computeEnergyPlan(inputs: EnergyInputs, today: string, manualTargetCalories?: number | null): EnergyPlan {
    return buildEnergyPlan({
      sex: inputs.sex,
      ageYears: yearsSince(new Date(`${inputs.birthDate}T00:00:00Z`), new Date(`${today}T00:00:00Z`)),
      heightCm: inputs.heightCm,
      weightKg: inputs.weightKg,
      bodyFatPercentage: inputs.bodyFatPercentage ?? null,
      activityLevel: inputs.activityLevel,
      goal: inputs.goal,
      pace: inputs.pace,
      manualTargetCalories: manualTargetCalories ?? null,
    });
  }

  previewEnergyPlan(input: EnergyPlanRequest, today: string): EnergyPlan {
    return this.computeEnergyPlan(input, today, input.manualTargetCalories);
  }

  /** Recalcula e grava uma nova meta vigente, encerrando a anterior. */
  async recalculateTarget(
    db: Prisma.TransactionClient,
    userId: string,
    inputs: EnergyInputs,
    today: string,
  ): Promise<NutritionTarget> {
    const plan = this.computeEnergyPlan(inputs, today);
    return this.repo.replaceCurrentTarget(db, userId, today, {
      bmr: plan.bmr.bmr,
      tdee: plan.tdee.tdee,
      activityFactor: plan.tdee.activityFactor,
      bmrFormula: plan.bmr.formula,
      calories: plan.calories.targetCalories,
      protein: plan.macros.protein.grams,
      carbs: plan.macros.carbs.grams,
      fat: plan.macros.fat.grams,
      fiber: plan.macros.fiberGrams,
      goal: inputs.goal,
      pace: inputs.pace,
      isManualOverride: false,
      warnings: [...plan.calories.warnings],
    });
  }

  async getCurrentTarget(userId: string): Promise<NutritionTargetDto | null> {
    const target = await this.repo.findCurrentTarget(userId);
    return target ? toTargetDto(target) : null;
  }

  async requireCurrentTarget(userId: string): Promise<NutritionTarget> {
    const target = await this.repo.findCurrentTarget(userId);
    if (!target) throw conflict('onboarding_required', 'Conclua o onboarding para ter uma meta calorica.');
    return target;
  }

  /** Resumo do dia comparado com a meta vigente NAQUELE dia. */
  async getDailySummary(userId: string, date: string): Promise<DailySummaryResponse> {
    const target = await this.repo.findTargetForDate(userId, date);
    if (!target) throw conflict('onboarding_required', 'Conclua o onboarding para ter uma meta calorica.');

    const meals = await this.repo.findMealTotalsForDate(userId, date);
    const summary = buildDailySummary({
      date,
      targets: {
        calories: target.calories,
        protein: target.protein,
        carbs: target.carbs,
        fat: target.fat,
        fiber: target.fiber,
      },
      entries: meals.map((m) => ({
        mealType: m.mealType,
        totals: {
          calories: m.totalCalories,
          protein: m.totalProtein,
          carbs: m.totalCarbs,
          fat: m.totalFat,
          fiber: m.totalFiber,
        },
      })),
    });
    return { ...summary, byMealType: [...summary.byMealType], targetId: target.id };
  }
}

export function toTargetDto(target: NutritionTarget): NutritionTargetDto {
  return {
    id: target.id,
    effectiveFrom: fromDbDate(target.effectiveFrom),
    effectiveTo: target.effectiveTo ? fromDbDate(target.effectiveTo) : null,
    bmr: target.bmr,
    tdee: target.tdee,
    activityFactor: target.activityFactor,
    bmrFormula: target.bmrFormula,
    calories: target.calories,
    protein: target.protein,
    carbs: target.carbs,
    fat: target.fat,
    fiber: target.fiber,
    goal: target.goal,
    pace: target.pace,
    isManualOverride: target.isManualOverride,
    warnings: target.warnings,
    disclaimer: DISCLAIMERS.energyEstimate,
  };
}
