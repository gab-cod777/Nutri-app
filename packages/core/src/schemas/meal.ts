import { z } from 'zod';
import { nutritionPer100Schema, preparationMethodSchema } from './ai.js';
import { mealTypeSchema, measureUnitSchema, portionSourceSchema } from './enums.js';

/**
 * Um item dentro de uma refeicao.
 *
 * `foodId` pode ser nulo: quando a IA identifica algo que nao existe na base,
 * gravamos o snapshot nutricional inline (`nameSnapshot` + `per100gSnapshot`)
 * em vez de barrar o registro. Snapshot tambem protege o historico - se a base
 * corrigir as calorias do arroz amanha, o diario de ontem nao muda sozinho.
 */
export const mealFoodInputSchema = z.object({
  foodId: z.string().uuid().nullish(),
  nameSnapshot: z.string().trim().min(2).max(120),
  per100gSnapshot: nutritionPer100Schema,
  quantity: z.number().positive().max(5000),
  unit: measureUnitSchema,
  /** Quantidade convertida para gramas. Calculada pelo cliente, revalidada pela API. */
  grams: z.number().positive().max(5000),
  preparationMethod: preparationMethodSchema.default('unknown'),
  portionSource: portionSourceSchema,
  /** Confianca original da IA, preservada para medir qualidade do modelo. */
  aiConfidence: z.number().min(0).max(1).nullish(),
  /** Gramas originalmente estimadas pela IA, antes da correcao do usuario. */
  aiEstimatedGrams: z.number().positive().max(5000).nullish(),
});
export type MealFoodInput = z.infer<typeof mealFoodInputSchema>;

export const createMealSchema = z.object({
  mealType: mealTypeSchema,
  /** Momento do consumo em ISO-8601 com offset. Default: agora. */
  consumedAt: z.string().datetime({ offset: true }),
  title: z.string().trim().max(140).nullish(),
  notes: z.string().trim().max(500).nullish(),
  /** Vincula a refeicao a analise de IA (POST /scan-prato) que a originou. */
  analysisId: z.string().uuid().nullish(),
  foods: z.array(mealFoodInputSchema).min(1).max(30),
});
export type CreateMealInput = z.infer<typeof createMealSchema>;

export const updateMealSchema = createMealSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Envie ao menos um campo para atualizar.' },
);
export type UpdateMealInput = z.infer<typeof updateMealSchema>;

/** Query de `GET /diario`. `date` filtra pelo dia local do usuario. */
export const listMealsQuerySchema = z
  .object({
    date: z.string().date().optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    mealType: mealTypeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(200).optional(),
  })
  .refine((value) => !(value.date && (value.from || value.to)), {
    message: 'Use `date` ou o par `from`/`to`, nunca os dois.',
  });
export type ListMealsQuery = z.infer<typeof listMealsQuerySchema>;

export const dailySummaryQuerySchema = z.object({
  date: z.string().date(),
});
export type DailySummaryQuery = z.infer<typeof dailySummaryQuerySchema>;

/** Um item de refeicao como devolvido pela API (com totais calculados pelo servidor). */
export const mealFoodSchema = z.object({
  id: z.string().uuid(),
  foodId: z.string().uuid().nullable(),
  nameSnapshot: z.string(),
  per100gSnapshot: nutritionPer100Schema,
  quantity: z.number(),
  unit: measureUnitSchema,
  grams: z.number(),
  preparationMethod: preparationMethodSchema,
  portionSource: portionSourceSchema,
  aiConfidence: z.number().nullable(),
  aiEstimatedGrams: z.number().nullable(),
  totals: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
  }),
});
export type MealFood = z.infer<typeof mealFoodSchema>;

/** Refeicao salva no diario. */
export const mealSchema = z.object({
  id: z.string().uuid(),
  mealType: mealTypeSchema,
  consumedAt: z.string().datetime(),
  /** Dia local do usuario (fuso do perfil). */
  localDate: z.string().date(),
  title: z.string().nullable(),
  notes: z.string().nullable(),
  analysisId: z.string().uuid().nullable(),
  totals: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
  }),
  foods: z.array(mealFoodSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Meal = z.infer<typeof mealSchema>;

export const mealListResponseSchema = z.object({
  items: z.array(mealSchema),
  nextCursor: z.string().nullable(),
});
export type MealListResponse = z.infer<typeof mealListResponseSchema>;
