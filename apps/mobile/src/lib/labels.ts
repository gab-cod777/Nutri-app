import type {
  ActivityLevel,
  DietaryRestriction,
  Equipment,
  Goal,
  GoalPace,
  MealType,
  Sex,
  TrainingExperience,
  TrainingLocation,
} from '@nutrisnap/core';

/**
 * `packages/core` guarda so os valores canonicos dos enums (contrato com o
 * backend e o banco). A traducao pt-BR e responsabilidade do app - por isso
 * vive aqui, e nao no dominio.
 */
export const SEX_LABELS: Record<Sex, string> = {
  male: 'Masculino',
  female: 'Feminino',
  other: 'Outro',
};

export const GOAL_LABELS: Record<Goal, string> = {
  lose_weight: 'Perder peso',
  gain_muscle: 'Ganhar músculo',
  maintain_weight: 'Manter peso',
  improve_conditioning: 'Melhorar condicionamento',
  body_recomposition: 'Recomposição corporal',
};

export const GOAL_PACE_LABELS: Record<GoalPace, string> = {
  slow: 'Devagar',
  moderate: 'Moderado',
  aggressive: 'Agressivo',
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentário',
  lightly_active: 'Levemente ativo',
  moderately_active: 'Moderadamente ativo',
  very_active: 'Muito ativo',
  extremely_active: 'Extremamente ativo',
};

export const ACTIVITY_LEVEL_HINTS: Record<ActivityLevel, string> = {
  sedentary: 'Trabalho sentado, pouca ou nenhuma atividade',
  lightly_active: 'Exercício leve 1-3x por semana',
  moderately_active: 'Exercício moderado 3-5x por semana',
  very_active: 'Exercício intenso 6-7x por semana',
  extremely_active: 'Trabalho físico pesado ou 2 treinos por dia',
};

export const TRAINING_EXPERIENCE_LABELS: Record<TrainingExperience, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

export const TRAINING_LOCATION_LABELS: Record<TrainingLocation, string> = {
  gym: 'Academia',
  home: 'Em casa',
  outdoor: 'Ao ar livre',
  hybrid: 'Misto',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  none: 'Peso do corpo',
  dumbbells: 'Halteres',
  barbell: 'Barra',
  kettlebell: 'Kettlebell',
  resistance_bands: 'Faixas elásticas',
  pull_up_bar: 'Barra fixa',
  bench: 'Banco',
  cable_machine: 'Cross/polia',
  machines: 'Máquinas',
  cardio_machine: 'Cardio',
};

export const DIETARY_RESTRICTION_LABELS: Record<DietaryRestriction, string> = {
  vegetarian: 'Vegetariano',
  vegan: 'Vegano',
  lactose_free: 'Sem lactose',
  gluten_free: 'Sem glúten',
  nut_allergy: 'Alergia a castanhas',
  seafood_allergy: 'Alergia a frutos do mar',
  egg_allergy: 'Alergia a ovo',
  halal: 'Halal',
  kosher: 'Kosher',
  low_sodium: 'Baixo sódio',
  diabetic: 'Diabético',
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Café da manhã',
  morning_snack: 'Lanche da manhã',
  lunch: 'Almoço',
  afternoon_snack: 'Lanche da tarde',
  dinner: 'Jantar',
  supper: 'Ceia',
};
