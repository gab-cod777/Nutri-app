import { z } from 'zod';

/**
 * Fonte unica de verdade dos enums do dominio.
 *
 * IMPORTANTE: os valores literais aqui devem ser identicos aos enums do
 * `apps/api/prisma/schema.prisma`. Sao os mesmos strings que trafegam na API,
 * ficam gravados no banco e sao usados como chave de traducao no app.
 * Nunca renomeie um valor sem uma migration de dados correspondente.
 */

export const sexSchema = z.enum(['male', 'female', 'other']);
export type Sex = z.infer<typeof sexSchema>;

/**
 * Niveis de atividade do multiplicador de Harris-Benedict/Mifflin.
 * A descricao textual de cada nivel vive no app (i18n), nao aqui.
 */
export const activityLevelSchema = z.enum([
  'sedentary', // trabalho sentado, pouca ou nenhuma atividade
  'lightly_active', // exercicio leve 1-3x/semana
  'moderately_active', // exercicio moderado 3-5x/semana
  'very_active', // exercicio intenso 6-7x/semana
  'extremely_active', // trabalho fisico pesado ou 2 treinos/dia
]);
export type ActivityLevel = z.infer<typeof activityLevelSchema>;

export const goalSchema = z.enum([
  'lose_weight',
  'gain_muscle',
  'maintain_weight',
  'improve_conditioning',
  'body_recomposition',
]);
export type Goal = z.infer<typeof goalSchema>;

/** Agressividade do deficit/superavit. Deixa o usuario escolher o ritmo. */
export const goalPaceSchema = z.enum(['slow', 'moderate', 'aggressive']);
export type GoalPace = z.infer<typeof goalPaceSchema>;

export const trainingExperienceSchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type TrainingExperience = z.infer<typeof trainingExperienceSchema>;

export const trainingLocationSchema = z.enum(['gym', 'home', 'outdoor', 'hybrid']);
export type TrainingLocation = z.infer<typeof trainingLocationSchema>;

export const equipmentSchema = z.enum([
  'none', // apenas peso corporal
  'dumbbells',
  'barbell',
  'kettlebell',
  'resistance_bands',
  'pull_up_bar',
  'bench',
  'cable_machine',
  'machines',
  'cardio_machine',
]);
export type Equipment = z.infer<typeof equipmentSchema>;

export const dietaryRestrictionSchema = z.enum([
  'vegetarian',
  'vegan',
  'lactose_free',
  'gluten_free',
  'nut_allergy',
  'seafood_allergy',
  'egg_allergy',
  'halal',
  'kosher',
  'low_sodium',
  'diabetic',
]);
export type DietaryRestriction = z.infer<typeof dietaryRestrictionSchema>;

export const mealTypeSchema = z.enum([
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'supper',
]);
export type MealType = z.infer<typeof mealTypeSchema>;

/** Ordem canonica das refeicoes no dia. Usada para ordenar o diario. */
export const MEAL_TYPE_ORDER: readonly MealType[] = [
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'supper',
] as const;

export const measureUnitSchema = z.enum([
  'g',
  'ml',
  'unit', // 1 ovo, 1 fatia, 1 pao frances
  'slice',
  'cup',
  'tablespoon',
  'teaspoon',
  'scoop',
]);
export type MeasureUnit = z.infer<typeof measureUnitSchema>;

export const foodCategorySchema = z.enum([
  'grain',
  'protein',
  'dairy',
  'vegetable',
  'fruit',
  'legume',
  'fat_oil',
  'beverage',
  'sweet',
  'ultra_processed',
  'supplement',
  'prepared_dish',
  'other',
]);
export type FoodCategory = z.infer<typeof foodCategorySchema>;

/** Procedencia do dado nutricional. Governa confianca e permissao de edicao. */
export const foodSourceSchema = z.enum([
  'internal', // curado por nos (base TACO/IBGE etc.)
  'external', // importado de base externa (ex.: OpenFoodFacts)
  'user', // criado pelo proprio usuario
  'ai_estimated', // inferido pela IA a partir de foto, sem match na base
]);
export type FoodSource = z.infer<typeof foodSourceSchema>;

/** Como a porcao de um alimento chegou ao diario. Alimenta metricas de qualidade da IA. */
export const portionSourceSchema = z.enum([
  'ai_estimate', // valor original da IA, aceito sem edicao
  'user_adjusted', // usuario corrigiu a estimativa da IA
  'manual_entry', // usuario buscou e adicionou na mao
  'barcode', // leitura de codigo de barras (V2)
  'meal_plan', // marcado como consumido a partir do plano alimentar
]);
export type PortionSource = z.infer<typeof portionSourceSchema>;

export const muscleGroupSchema = z.enum([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'full_body',
  'cardio',
]);
export type MuscleGroup = z.infer<typeof muscleGroupSchema>;

export const workoutStatusSchema = z.enum(['scheduled', 'in_progress', 'completed', 'skipped']);
export type WorkoutStatus = z.infer<typeof workoutStatusSchema>;

export const planStatusSchema = z.enum(['active', 'archived', 'generating', 'failed']);
export type PlanStatus = z.infer<typeof planStatusSchema>;

export const progressMetricSchema = z.enum([
  'weight_kg',
  'body_fat_percentage',
  'waist_cm',
  'hip_cm',
  'chest_cm',
  'arm_cm',
  'thigh_cm',
]);
export type ProgressMetric = z.infer<typeof progressMetricSchema>;
