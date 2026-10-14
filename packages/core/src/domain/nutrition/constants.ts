import type { ActivityLevel, Goal, GoalPace, Sex } from '../../schemas/enums.js';

/** Fatores de Atwater. kcal por grama de cada macronutriente. */
export const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
  alcohol: 7,
} as const;

/**
 * Energia aproximada armazenada em 1 kg de tecido adiposo.
 * Usado APENAS para projetar ritmo de perda/ganho. E uma aproximacao grosseira:
 * na pratica variacao de agua, glicogenio e adaptacao metabolica dominam
 * o resultado semana a semana.
 */
export const KCAL_PER_KG_BODY_MASS = 7700;

/** Multiplicadores de atividade aplicados sobre a TMB para obter o TDEE. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

/**
 * Ajuste calorico por objetivo, como percentual do TDEE.
 * Negativo = deficit, positivo = superavit.
 *
 * Valores conservadores de proposito: deficits acima de 25% aumentam perda de
 * massa magra e abandono; superavits acima de 20% viram gordura, nao musculo.
 */
export const GOAL_ADJUSTMENT_PERCENT: Record<Goal, Record<GoalPace, number>> = {
  lose_weight: { slow: -0.1, moderate: -0.18, aggressive: -0.25 },
  gain_muscle: { slow: 0.08, moderate: 0.12, aggressive: 0.18 },
  maintain_weight: { slow: 0, moderate: 0, aggressive: 0 },
  improve_conditioning: { slow: -0.03, moderate: 0, aggressive: 0.05 },
  body_recomposition: { slow: -0.05, moderate: -0.1, aggressive: -0.15 },
};

/**
 * Piso calorico absoluto por sexo. Abaixo disso fica dificil atingir as
 * necessidades de micronutrientes com alimentos comuns.
 * Nao e um limite clinico - e um guard-rail de produto.
 */
export const ABSOLUTE_CALORIE_FLOOR: Record<Sex, number> = {
  male: 1500,
  female: 1200,
  other: 1350,
};

/** Gramas de proteina por kg de peso de referencia, por objetivo. */
export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose_weight: 2.0,
  gain_muscle: 1.8,
  maintain_weight: 1.6,
  improve_conditioning: 1.6,
  body_recomposition: 2.2,
};

/** Percentual das calorias vindo de gordura, antes do balanceamento. */
export const FAT_PERCENT_OF_CALORIES: Record<Goal, number> = {
  lose_weight: 0.25,
  gain_muscle: 0.25,
  maintain_weight: 0.28,
  improve_conditioning: 0.25,
  body_recomposition: 0.25,
};

/** Minimo de gordura por kg de peso corporal (acidos graxos essenciais, hormonios). */
export const MIN_FAT_G_PER_KG = 0.6;

/** Fibra recomendada por 1000 kcal, com limites praticos. */
export const FIBER_G_PER_1000_KCAL = 14;
export const FIBER_G_MIN = 20;
export const FIBER_G_MAX = 45;

/** Faixas aceitas na validacao de entrada dos calculos. */
export const INPUT_LIMITS = {
  ageYears: { min: 13, max: 100 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
  bodyFatPercentage: { min: 3, max: 70 },
} as const;
