import type { Sex } from '../../schemas/enums.js';
import { assertInRange, DomainError } from '../../utils/errors.js';
import { round } from '../../utils/math.js';
import { INPUT_LIMITS } from './constants.js';

export type BmrFormula = 'mifflin_st_jeor' | 'katch_mcardle';

export interface BmrInput {
  readonly sex: Sex;
  readonly ageYears: number;
  readonly heightCm: number;
  readonly weightKg: number;
  /** Opcional. Quando informado e `formula` for 'auto', usamos Katch-McArdle. */
  readonly bodyFatPercentage?: number | null;
  /** 'auto' escolhe Katch-McArdle se houver % de gordura confiavel. Default: 'auto'. */
  readonly formula?: BmrFormula | 'auto';
}

export interface BmrResult {
  /** Taxa metabolica basal estimada, em kcal/dia. */
  readonly bmr: number;
  readonly formula: BmrFormula;
  /** Massa magra em kg. Null quando o % de gordura nao foi informado. */
  readonly leanBodyMassKg: number | null;
}

/**
 * Massa magra (Lean Body Mass) a partir do percentual de gordura.
 */
export function calculateLeanBodyMass(weightKg: number, bodyFatPercentage: number): number {
  assertInRange(weightKg, INPUT_LIMITS.weightKg, 'weightKg');
  assertInRange(bodyFatPercentage, INPUT_LIMITS.bodyFatPercentage, 'bodyFatPercentage');
  return round(weightKg * (1 - bodyFatPercentage / 100), 2);
}

/**
 * Mifflin-St Jeor (1990) - a formula preditiva com menor erro medio em
 * populacao geral (~10% de desvio individual).
 *
 *   homens:   10*kg + 6.25*cm - 5*idade + 5
 *   mulheres: 10*kg + 6.25*cm - 5*idade - 161
 *
 * Para `sex: 'other'` usamos a media das duas constantes (-78). Nao existe
 * formula validada para pessoas nao-binarias ou em terapia hormonal; a media
 * e a escolha menos enviesada, e a UI deve informar que o resultado tem margem
 * de erro maior. O usuario pode sobrescrever a meta manualmente.
 */
function mifflinStJeor(input: BmrInput): number {
  const { sex, ageYears, heightCm, weightKg } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  const sexConstant: Record<Sex, number> = { male: 5, female: -161, other: -78 };
  return base + sexConstant[sex];
}

/**
 * Katch-McArdle - baseada em massa magra, portanto independente de sexo.
 * Mais precisa que Mifflin QUANDO o percentual de gordura e confiavel
 * (DEXA, bioimpedancia decente). Com um chute do usuario, nao e.
 *
 *   BMR = 370 + 21.6 * massa magra (kg)
 */
function katchMcArdle(leanBodyMassKg: number): number {
  return 370 + 21.6 * leanBodyMassKg;
}

/**
 * Calcula a Taxa Metabolica Basal (TMB) - o gasto energetico em repouso absoluto.
 *
 * ATENCAO: e uma ESTIMATIVA populacional, nao uma medida. O erro individual
 * tipico e de +/- 10%, podendo passar de 20% em quem tem composicao corporal
 * atipica. Nunca apresente como valor clinico.
 */
export function calculateBMR(input: BmrInput): BmrResult {
  assertInRange(input.ageYears, INPUT_LIMITS.ageYears, 'ageYears');
  assertInRange(input.heightCm, INPUT_LIMITS.heightCm, 'heightCm');
  assertInRange(input.weightKg, INPUT_LIMITS.weightKg, 'weightKg');

  const hasBodyFat =
    input.bodyFatPercentage !== undefined &&
    input.bodyFatPercentage !== null &&
    Number.isFinite(input.bodyFatPercentage);

  const leanBodyMassKg = hasBodyFat
    ? calculateLeanBodyMass(input.weightKg, input.bodyFatPercentage as number)
    : null;

  const requested = input.formula ?? 'auto';
  const formula: BmrFormula =
    requested === 'auto' ? (leanBodyMassKg !== null ? 'katch_mcardle' : 'mifflin_st_jeor') : requested;

  if (formula === 'katch_mcardle' && leanBodyMassKg === null) {
    throw new DomainError(
      'missing_body_fat',
      'Katch-McArdle exige o percentual de gordura corporal.',
      { formula },
    );
  }

  const bmr = formula === 'katch_mcardle' ? katchMcArdle(leanBodyMassKg as number) : mifflinStJeor(input);

  return {
    bmr: round(bmr),
    formula,
    leanBodyMassKg,
  };
}
