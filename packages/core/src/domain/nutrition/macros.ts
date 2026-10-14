import type { Goal } from '../../schemas/enums.js';
import { DomainError } from '../../utils/errors.js';
import { clamp, percentOf, round } from '../../utils/math.js';
import {
  FAT_PERCENT_OF_CALORIES,
  FIBER_G_MAX,
  FIBER_G_MIN,
  FIBER_G_PER_1000_KCAL,
  KCAL_PER_GRAM,
  MIN_FAT_G_PER_KG,
  PROTEIN_G_PER_KG,
} from './constants.js';

/** Quantidades de macronutrientes em gramas. Estrutura usada em todo o app. */
export interface Macros {
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
}

export interface MacroTarget {
  readonly grams: number;
  readonly kcal: number;
  /** Participacao no total calorico, em %. */
  readonly percent: number;
}

export interface MacroTargets {
  readonly calories: number;
  readonly protein: MacroTarget;
  readonly carbs: MacroTarget;
  readonly fat: MacroTarget;
  readonly fiberGrams: number;
  /** Peso usado para dosar proteina/gordura. Difere do peso real quando ha % de gordura. */
  readonly referenceWeightKg: number;
}

export interface MacroTargetsInput {
  readonly targetCalories: number;
  readonly weightKg: number;
  readonly goal: Goal;
  readonly bodyFatPercentage?: number | null;
}

/** Converte gramas de macros em kcal usando os fatores de Atwater. */
export function caloriesFromMacros(macros: Macros): number {
  return round(
    macros.protein * KCAL_PER_GRAM.protein +
      macros.carbs * KCAL_PER_GRAM.carbs +
      macros.fat * KCAL_PER_GRAM.fat,
  );
}

/**
 * Peso de referencia para dosar proteina.
 *
 * Dosar proteina por peso total superestima em quem tem gordura corporal alta
 * (tecido adiposo demanda pouca proteina). Quando temos o % de gordura, usamos
 * massa magra * 1.25 - aproximacao do peso em uma composicao saudavel - limitada
 * ao peso real, para nunca aumentar a meta de quem ja e magro.
 */
export function calculateReferenceWeight(weightKg: number, bodyFatPercentage?: number | null): number {
  if (bodyFatPercentage === undefined || bodyFatPercentage === null || !Number.isFinite(bodyFatPercentage)) {
    return round(weightKg, 2);
  }
  const leanMass = weightKg * (1 - bodyFatPercentage / 100);
  return round(Math.min(weightKg, leanMass * 1.25), 2);
}

/**
 * Distribui a meta calorica em proteina, gordura e carboidrato.
 *
 * Ordem de prioridade quando as calorias sao apertadas:
 *   1. proteina (preserva massa magra em deficit)
 *   2. gordura ate o minimo essencial
 *   3. carboidrato absorve o que sobrar
 *
 * Se nem proteina + gordura minima couberem na meta, reduzimos proteina ate um
 * piso de 1.2 g/kg e devolvemos carboidrato zero, em vez de estourar as calorias.
 */
export function calculateMacroTargets(input: MacroTargetsInput): MacroTargets {
  const { targetCalories, weightKg, goal } = input;

  if (!Number.isFinite(targetCalories) || targetCalories < 800 || targetCalories > 10000) {
    throw new DomainError('invalid_target_calories', 'Meta calorica fora de uma faixa plausivel.', {
      targetCalories,
    });
  }
  const proteinPerKg = PROTEIN_G_PER_KG[goal];
  if (proteinPerKg === undefined) {
    throw new DomainError('invalid_goal', 'Objetivo desconhecido.', { goal });
  }

  const referenceWeightKg = calculateReferenceWeight(weightKg, input.bodyFatPercentage);

  let proteinG = referenceWeightKg * proteinPerKg;
  const minProteinG = referenceWeightKg * 1.2;
  const minFatG = weightKg * MIN_FAT_G_PER_KG;

  let fatG = Math.max((targetCalories * FAT_PERCENT_OF_CALORIES[goal]) / KCAL_PER_GRAM.fat, minFatG);

  // 1) Sobra depois de proteina e gordura. Se negativa, corta gordura ate o minimo.
  let remainingKcal = targetCalories - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat;
  if (remainingKcal < 0) {
    const reducibleFatKcal = (fatG - minFatG) * KCAL_PER_GRAM.fat;
    const cut = Math.min(reducibleFatKcal, -remainingKcal);
    fatG -= cut / KCAL_PER_GRAM.fat;
    remainingKcal += cut;
  }

  // 2) Ainda negativa: corta proteina ate o piso.
  if (remainingKcal < 0) {
    const reducibleProteinKcal = (proteinG - minProteinG) * KCAL_PER_GRAM.protein;
    const cut = Math.min(reducibleProteinKcal, -remainingKcal);
    proteinG -= cut / KCAL_PER_GRAM.protein;
    remainingKcal += cut;
  }

  const carbsG = Math.max(0, remainingKcal / KCAL_PER_GRAM.carbs);

  const protein = round(proteinG);
  const fat = round(fatG);
  const carbs = round(carbsG);

  const proteinKcal = round(protein * KCAL_PER_GRAM.protein);
  const carbsKcal = round(carbs * KCAL_PER_GRAM.carbs);
  const fatKcal = round(fat * KCAL_PER_GRAM.fat);

  const fiberGrams = round(
    clamp((targetCalories / 1000) * FIBER_G_PER_1000_KCAL, FIBER_G_MIN, FIBER_G_MAX),
  );

  return {
    calories: round(targetCalories),
    protein: { grams: protein, kcal: proteinKcal, percent: percentOf(proteinKcal, targetCalories) },
    carbs: { grams: carbs, kcal: carbsKcal, percent: percentOf(carbsKcal, targetCalories) },
    fat: { grams: fat, kcal: fatKcal, percent: percentOf(fatKcal, targetCalories) },
    fiberGrams,
    referenceWeightKg,
  };
}
