import type { MeasureUnit } from '../../schemas/enums.js';
import { DomainError } from '../../utils/errors.js';
import { round } from '../../utils/math.js';

/** Valores nutricionais por 100 g (ou 100 ml) - forma canonica de armazenamento. */
export interface NutritionPer100 {
  readonly calories: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
  readonly fiber?: number | null;
}

/** Valores nutricionais absolutos de uma porcao ou de um conjunto de alimentos. */
export interface NutritionTotals {
  readonly calories: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
  readonly fiber: number;
}

export const EMPTY_NUTRITION: NutritionTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
};

/**
 * Peso medio de medidas caseiras, em gramas. Fallback quando o alimento nao
 * traz `gramsPerUnit` proprio.
 *
 * Sao aproximacoes grosseiras: uma colher de sopa de azeite (~13 g) e uma de
 * arroz (~25 g) pesam coisas diferentes. Sempre prefira o `gramsPerUnit`
 * cadastrado no alimento; este mapa existe so para nao travar o fluxo.
 */
export const HOUSEHOLD_MEASURE_GRAMS: Partial<Record<MeasureUnit, number>> = {
  cup: 200,
  tablespoon: 15,
  teaspoon: 5,
  scoop: 30,
  slice: 25,
};

/**
 * Converte uma quantidade em uma unidade qualquer para gramas.
 *
 * `ml` e tratado como 1 g/ml. Vale para agua, leite e refrigerante; erra em
 * oleo (~0.92) e mel (~1.4). Alimentos liquidos com densidade relevante devem
 * cadastrar `gramsPerUnit` explicitamente.
 */
export function toGrams(quantity: number, unit: MeasureUnit, gramsPerUnit?: number | null): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new DomainError('invalid_quantity', 'Quantidade deve ser um numero nao negativo.', {
      quantity,
    });
  }

  if (unit === 'g' || unit === 'ml') return round(quantity, 2);

  const perUnit =
    gramsPerUnit !== undefined && gramsPerUnit !== null && Number.isFinite(gramsPerUnit) && gramsPerUnit > 0
      ? gramsPerUnit
      : HOUSEHOLD_MEASURE_GRAMS[unit];

  if (perUnit === undefined) {
    throw new DomainError(
      'missing_grams_per_unit',
      `Nao ha peso definido para a unidade "${unit}" deste alimento.`,
      { unit },
    );
  }

  return round(quantity * perUnit, 2);
}

/** Escala valores por 100 g para uma quantidade em gramas. */
export function scaleNutritionByGrams(per100: NutritionPer100, grams: number): NutritionTotals {
  if (!Number.isFinite(grams) || grams < 0) {
    throw new DomainError('invalid_grams', 'Gramas deve ser um numero nao negativo.', { grams });
  }
  const factor = grams / 100;
  return {
    calories: round(per100.calories * factor),
    protein: round(per100.protein * factor, 1),
    carbs: round(per100.carbs * factor, 1),
    fat: round(per100.fat * factor, 1),
    fiber: round((per100.fiber ?? 0) * factor, 1),
  };
}

/** Soma varias porcoes em um total unico. */
export function sumNutrition(items: readonly NutritionTotals[]): NutritionTotals {
  return items.reduce<NutritionTotals>(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
      fiber: acc.fiber + item.fiber,
    }),
    EMPTY_NUTRITION,
  );
}

/** Arredonda um total para exibicao (kcal inteiras, macros com 1 casa). */
export function roundNutrition(totals: NutritionTotals): NutritionTotals {
  return {
    calories: round(totals.calories),
    protein: round(totals.protein, 1),
    carbs: round(totals.carbs, 1),
    fat: round(totals.fat, 1),
    fiber: round(totals.fiber, 1),
  };
}
