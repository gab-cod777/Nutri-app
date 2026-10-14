import type {
  AnalyzedFood,
  DetectedFood,
  MealAnalysisModelOutput,
} from '../../schemas/ai.js';
import type { MealType } from '../../schemas/enums.js';
import { generateClientId } from '../../utils/id.js';
import { clamp, round } from '../../utils/math.js';
import { scaleNutritionByGrams } from './portions.js';

/**
 * Limiares que decidem se pedimos confirmacao ao usuario.
 *
 * Calibrar isto e trabalho de produto continuo: se pedirmos confirmacao demais,
 * o fluxo de 3 toques vira 8 e o usuario para de registrar; de menos, o diario
 * enche de numero errado e ele perde a confianca no app. Instrumente
 * `confirmationReasons` e a taxa de edicao real para ajustar.
 */
export const ANALYSIS_THRESHOLDS = {
  /** Abaixo disto o resultado inteiro pede confirmacao. */
  overallConfidence: 0.6,
  /** Fracao das calorias vindas de alimentos sem match na base que dispara aviso. */
  unmatchedCalorieShare: 0.5,
} as const;

export type ConfirmationReason =
  | 'low_confidence'
  | 'poor_image_quality'
  | 'hidden_calories'
  | 'no_match_in_database';

export interface AnalysisTotals {
  readonly calories: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
  readonly fiber: number;
  readonly caloriesMin: number;
  readonly caloriesMax: number;
}

/** Match opcional com a base de alimentos, resolvido por `canonicalName`. */
export type FoodMatchResolver = (food: DetectedFood) => string | null;

/**
 * Calcula os valores absolutos de um alimento detectado, a partir da
 * composicao por 100 g e da quantidade estimada.
 */
export function computeFoodTotals(food: DetectedFood, grams = food.estimatedGrams) {
  return scaleNutritionByGrams(food.per100g, grams);
}

/**
 * Confianca geral, ponderada pelas calorias de cada item.
 *
 * Media simples enganaria: errar a porcao do arroz (500 kcal) pesa muito mais
 * que errar a da alface (5 kcal).
 */
export function computeOverallConfidence(foods: readonly AnalyzedFood[]): number {
  if (foods.length === 0) return 0;

  const totalCalories = foods.reduce((acc, f) => acc + f.totals.calories, 0);
  if (totalCalories <= 0) {
    return round(foods.reduce((acc, f) => acc + f.confidence, 0) / foods.length, 2);
  }

  const weighted = foods.reduce((acc, f) => acc + f.confidence * f.totals.calories, 0);
  return round(clamp(weighted / totalCalories, 0, 1), 2);
}

/**
 * Transforma o output cru do modelo no resultado que o app consome:
 * resolve match com a base, calcula totais e faixa, e decide se pede confirmacao.
 *
 * Nenhuma aritmetica vem do modelo - tudo aqui e deterministico.
 */
export function buildAnalysisResult(params: {
  readonly output: MealAnalysisModelOutput;
  readonly fallbackMealType: MealType;
  readonly resolveFoodId?: FoodMatchResolver;
}): {
  readonly foods: AnalyzedFood[];
  readonly totals: AnalysisTotals;
  readonly overallConfidence: number;
  readonly needsUserConfirmation: boolean;
  readonly confirmationReasons: ConfirmationReason[];
  readonly mealType: MealType;
} {
  const { output, fallbackMealType, resolveFoodId } = params;

  const foods: AnalyzedFood[] = output.foods.map((food) => ({
    ...food,
    clientId: generateClientId('food'),
    foodId: resolveFoodId ? resolveFoodId(food) : null,
    totals: computeFoodTotals(food),
  }));

  const totals: AnalysisTotals = {
    calories: round(foods.reduce((acc, f) => acc + f.totals.calories, 0)),
    protein: round(foods.reduce((acc, f) => acc + f.totals.protein, 0), 1),
    carbs: round(foods.reduce((acc, f) => acc + f.totals.carbs, 0), 1),
    fat: round(foods.reduce((acc, f) => acc + f.totals.fat, 0), 1),
    fiber: round(foods.reduce((acc, f) => acc + f.totals.fiber, 0), 1),
    caloriesMin: round(
      foods.reduce((acc, f) => acc + scaleNutritionByGrams(f.per100g, f.minGrams).calories, 0),
    ),
    caloriesMax: round(
      foods.reduce((acc, f) => acc + scaleNutritionByGrams(f.per100g, f.maxGrams).calories, 0),
    ),
  };

  const overallConfidence = computeOverallConfidence(foods);

  const unmatchedCalories = foods
    .filter((f) => !f.foodId)
    .reduce((acc, f) => acc + f.totals.calories, 0);
  const unmatchedShare = totals.calories > 0 ? unmatchedCalories / totals.calories : 0;

  const confirmationReasons: ConfirmationReason[] = [];
  if (overallConfidence < ANALYSIS_THRESHOLDS.overallConfidence) {
    confirmationReasons.push('low_confidence');
  }
  if (output.imageQuality === 'poor') {
    confirmationReasons.push('poor_image_quality');
  }
  if (output.hiddenCalorieRisk === 'high') {
    confirmationReasons.push('hidden_calories');
  }
  if (unmatchedShare > ANALYSIS_THRESHOLDS.unmatchedCalorieShare) {
    confirmationReasons.push('no_match_in_database');
  }

  return {
    foods,
    totals,
    overallConfidence,
    needsUserConfirmation: confirmationReasons.length > 0,
    confirmationReasons,
    mealType: output.mealType ?? fallbackMealType,
  };
}

/**
 * Sugere o tipo de refeicao pelo horario local do usuario.
 *
 * Fonte de verdade sobre "que refeicao e essa" e o relogio do usuario, nao o
 * conteudo do prato: quem come ovo com pao as 20h esta jantando, e o modelo
 * chutaria "breakfast".
 */
export function suggestMealTypeByHour(hour: number): MealType {
  const h = clamp(Math.floor(hour), 0, 23);
  if (h < 6) return 'supper';
  if (h < 10) return 'breakfast';
  if (h < 12) return 'morning_snack';
  if (h < 15) return 'lunch';
  if (h < 18) return 'afternoon_snack';
  if (h < 22) return 'dinner';
  return 'supper';
}
