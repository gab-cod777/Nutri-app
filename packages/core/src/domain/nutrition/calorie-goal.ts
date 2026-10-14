import type { Goal, GoalPace, Sex } from '../../schemas/enums.js';
import { DomainError } from '../../utils/errors.js';
import { round } from '../../utils/math.js';
import {
  ABSOLUTE_CALORIE_FLOOR,
  GOAL_ADJUSTMENT_PERCENT,
  KCAL_PER_KG_BODY_MASS,
} from './constants.js';

export type CalorieWarning =
  | 'floor_applied'
  | 'below_bmr'
  | 'aggressive_deficit'
  | 'aggressive_surplus'
  | 'manual_override';

export interface CalorieGoalInput {
  readonly tdee: number;
  readonly bmr: number;
  readonly goal: Goal;
  /** Ritmo desejado. Default: 'moderate'. */
  readonly pace?: GoalPace;
  readonly sex: Sex;
  /**
   * Meta definida manualmente pelo usuario, em kcal. Quando presente, ignora
   * o calculo automatico mas AINDA aplica o piso de seguranca.
   */
  readonly manualTargetCalories?: number | null;
}

export interface CalorieGoalResult {
  /** Meta calorica diaria final, em kcal. */
  readonly targetCalories: number;
  readonly tdee: number;
  readonly bmr: number;
  /** Diferenca em kcal sobre o TDEE. Negativo = deficit. */
  readonly adjustmentKcal: number;
  /** Mesma diferenca em % do TDEE, arredondada a 1 casa. */
  readonly adjustmentPercent: number;
  readonly direction: 'deficit' | 'surplus' | 'maintenance';
  /**
   * Projecao de variacao de peso semanal em kg, derivada do deficit/superavit.
   * E uma extrapolacao linear e otimista - a UI deve apresentar como "estimativa".
   */
  readonly projectedWeeklyWeightChangeKg: number;
  /** Piso de seguranca aplicado a esta pessoa. */
  readonly safetyFloorCalories: number;
  readonly warnings: readonly CalorieWarning[];
}

/**
 * Piso calorico para a pessoa: nunca abaixo da propria TMB, nem abaixo do
 * piso absoluto por sexo.
 */
export function calculateSafetyFloor(bmr: number, sex: Sex): number {
  return Math.max(round(bmr), ABSOLUTE_CALORIE_FLOOR[sex]);
}

/**
 * Deriva a meta calorica diaria a partir do TDEE e do objetivo.
 *
 * Regras nao negociaveis desta funcao:
 *  1. A meta nunca fica abaixo do piso de seguranca (TMB / piso absoluto).
 *  2. Quando o piso morde, devolvemos o aviso 'floor_applied' - a UI precisa
 *     explicar por que o numero nao bateu com o ritmo escolhido, em vez de
 *     mostrar um valor silenciosamente diferente.
 *  3. Uma meta manual do usuario e respeitada, mas tambem passa pelo piso.
 */
export function calculateCalorieGoal(input: CalorieGoalInput): CalorieGoalResult {
  const { tdee, bmr, goal, sex } = input;

  if (!Number.isFinite(tdee) || tdee <= 0) {
    throw new DomainError('invalid_tdee', 'O TDEE deve ser um numero positivo.', { tdee });
  }
  if (!Number.isFinite(bmr) || bmr <= 0) {
    throw new DomainError('invalid_bmr', 'A TMB deve ser um numero positivo.', { bmr });
  }

  const paceTable = GOAL_ADJUSTMENT_PERCENT[goal];
  if (!paceTable) {
    throw new DomainError('invalid_goal', 'Objetivo desconhecido.', { goal });
  }

  const pace: GoalPace = input.pace ?? 'moderate';
  const warnings: CalorieWarning[] = [];
  const safetyFloorCalories = calculateSafetyFloor(bmr, sex);

  const hasManual =
    input.manualTargetCalories !== undefined &&
    input.manualTargetCalories !== null &&
    Number.isFinite(input.manualTargetCalories);

  let target: number;
  if (hasManual) {
    const manual = input.manualTargetCalories as number;
    if (manual <= 0 || manual > 10000) {
      throw new DomainError('invalid_manual_target', 'Meta manual fora de uma faixa plausivel.', {
        manualTargetCalories: manual,
      });
    }
    warnings.push('manual_override');
    target = round(manual);
  } else {
    target = round(tdee * (1 + paceTable[pace]));
  }

  if (target < safetyFloorCalories) {
    warnings.push('floor_applied');
    if (target < bmr) warnings.push('below_bmr');
    target = safetyFloorCalories;
  }

  const adjustmentKcal = round(target - tdee);
  const adjustmentPercent = round((adjustmentKcal / tdee) * 100, 1);

  if (adjustmentPercent <= -25) warnings.push('aggressive_deficit');
  if (adjustmentPercent >= 20) warnings.push('aggressive_surplus');

  const direction: CalorieGoalResult['direction'] =
    adjustmentKcal < -25 ? 'deficit' : adjustmentKcal > 25 ? 'surplus' : 'maintenance';

  return {
    targetCalories: target,
    tdee: round(tdee),
    bmr: round(bmr),
    adjustmentKcal,
    adjustmentPercent,
    direction,
    projectedWeeklyWeightChangeKg: round((adjustmentKcal * 7) / KCAL_PER_KG_BODY_MASS, 2),
    safetyFloorCalories,
    warnings,
  };
}
