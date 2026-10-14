import type { ActivityLevel, Goal, GoalPace, Sex } from '../../schemas/enums.js';
import { DISCLAIMERS } from '../disclaimers.js';
import { calculateBMR, type BmrFormula, type BmrResult } from './bmr.js';
import { calculateCalorieGoal, type CalorieGoalResult } from './calorie-goal.js';
import { calculateMacroTargets, type MacroTargets } from './macros.js';
import { calculateTDEE, type TdeeResult } from './tdee.js';

export interface EnergyPlanInput {
  readonly sex: Sex;
  readonly ageYears: number;
  readonly heightCm: number;
  readonly weightKg: number;
  readonly bodyFatPercentage?: number | null;
  readonly activityLevel: ActivityLevel;
  readonly goal: Goal;
  readonly pace?: GoalPace;
  readonly formula?: BmrFormula | 'auto';
  readonly extraDailyKcal?: number;
  readonly manualTargetCalories?: number | null;
}

export interface EnergyPlan {
  readonly bmr: BmrResult;
  readonly tdee: TdeeResult;
  readonly calories: CalorieGoalResult;
  readonly macros: MacroTargets;
  readonly disclaimer: string;
}

/**
 * Pipeline completo: dados fisicos -> TMB -> TDEE -> meta calorica -> macros.
 *
 * E o unico ponto que o backend e o onboarding chamam. Manter a composicao
 * aqui garante que app e servidor nunca divirjam na ordem ou nos arredondamentos
 * (o usuario ve o mesmo numero offline e online).
 */
export function buildEnergyPlan(input: EnergyPlanInput): EnergyPlan {
  const bmr = calculateBMR({
    sex: input.sex,
    ageYears: input.ageYears,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    bodyFatPercentage: input.bodyFatPercentage,
    formula: input.formula ?? 'auto',
  });

  const tdee = calculateTDEE({
    bmr: bmr.bmr,
    activityLevel: input.activityLevel,
    extraDailyKcal: input.extraDailyKcal,
  });

  const calories = calculateCalorieGoal({
    tdee: tdee.tdee,
    bmr: bmr.bmr,
    goal: input.goal,
    pace: input.pace,
    sex: input.sex,
    manualTargetCalories: input.manualTargetCalories,
  });

  const macros = calculateMacroTargets({
    targetCalories: calories.targetCalories,
    weightKg: input.weightKg,
    goal: input.goal,
    bodyFatPercentage: input.bodyFatPercentage,
  });

  return { bmr, tdee, calories, macros, disclaimer: DISCLAIMERS.energyEstimate };
}
