import type { ActivityLevel } from '../../schemas/enums.js';
import { DomainError } from '../../utils/errors.js';
import { round } from '../../utils/math.js';
import { ACTIVITY_FACTORS } from './constants.js';

export interface TdeeInput {
  /** TMB em kcal/dia, vinda de `calculateBMR`. */
  readonly bmr: number;
  readonly activityLevel: ActivityLevel;
  /**
   * Gasto extra fixo, em kcal/dia, para casos que o multiplicador nao cobre
   * (ex.: usuario que anda 15 km/dia a trabalho). Opcional, default 0.
   */
  readonly extraDailyKcal?: number;
}

export interface TdeeResult {
  /** Gasto energetico total diario estimado, em kcal/dia. */
  readonly tdee: number;
  readonly activityFactor: number;
  /** kcal atribuidas a atividade (tdee - bmr). Util para explicar o numero na UI. */
  readonly activityKcal: number;
}

/**
 * Calcula o TDEE (Total Daily Energy Expenditure) multiplicando a TMB pelo
 * fator de atividade.
 *
 * O multiplicador embute NEAT + exercicio + efeito termico dos alimentos.
 * Por isso NAO somamos calorias de treino por cima: isso contaria o exercicio
 * duas vezes, erro classico em apps de dieta que gera superavit involuntario.
 */
export function calculateTDEE(input: TdeeInput): TdeeResult {
  if (!Number.isFinite(input.bmr) || input.bmr <= 0) {
    throw new DomainError('invalid_bmr', 'A TMB deve ser um numero positivo.', { bmr: input.bmr });
  }

  const activityFactor = ACTIVITY_FACTORS[input.activityLevel];
  if (activityFactor === undefined) {
    throw new DomainError('invalid_activity_level', 'Nivel de atividade desconhecido.', {
      activityLevel: input.activityLevel,
    });
  }

  const extra = input.extraDailyKcal ?? 0;
  if (!Number.isFinite(extra) || extra < 0 || extra > 2000) {
    throw new DomainError('invalid_extra_kcal', 'extraDailyKcal deve estar entre 0 e 2000.', {
      extraDailyKcal: extra,
    });
  }

  const tdee = round(input.bmr * activityFactor + extra);

  return {
    tdee,
    activityFactor,
    activityKcal: round(tdee - input.bmr),
  };
}

/**
 * Sugere um nivel de atividade a partir de respostas simples do onboarding.
 *
 * Existe para melhorar a UX: perguntar "voce e moderadamente ativo?" produz
 * respostas infladas. Perguntar "quantas vezes por semana voce treina?" e
 * "como e seu dia a dia?" produz uma estimativa melhor. O usuario ainda pode
 * sobrescrever a sugestao na tela.
 */
export function suggestActivityLevel(params: {
  readonly trainingDaysPerWeek: number;
  readonly dailyRoutine: 'desk_job' | 'on_feet' | 'physical_labor';
}): ActivityLevel {
  const days = Math.max(0, Math.min(7, Math.round(params.trainingDaysPerWeek)));

  if (params.dailyRoutine === 'physical_labor') {
    return days >= 5 ? 'extremely_active' : 'very_active';
  }
  if (params.dailyRoutine === 'on_feet') {
    if (days >= 6) return 'very_active';
    if (days >= 3) return 'moderately_active';
    return 'lightly_active';
  }
  // desk_job
  if (days >= 6) return 'very_active';
  if (days >= 3) return 'moderately_active';
  if (days >= 1) return 'lightly_active';
  return 'sedentary';
}
