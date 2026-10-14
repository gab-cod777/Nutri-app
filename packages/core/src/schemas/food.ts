import { z } from 'zod';
import { nutritionPer100Schema } from './ai.js';
import { foodCategorySchema, foodSourceSchema, measureUnitSchema } from './enums.js';

/**
 * Porcao pre-definida de um alimento ("1 fatia", "1 colher de sopa").
 * Permite que o usuario registre sem pensar em gramas - o app converte.
 */
export const foodServingSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(40),
  unit: measureUnitSchema,
  quantity: z.number().positive().max(1000),
  /** Peso em gramas de `quantity` unidades. E o que torna a conversao exata. */
  gramsEquivalent: z.number().positive().max(5000),
  isDefault: z.boolean().default(false),
});
export type FoodServing = z.infer<typeof foodServingSchema>;

export const foodSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  /** Nome canonico em ingles, snake_case. Chave de match com o output da IA. */
  canonicalName: z.string().regex(/^[a-z0-9_]+$/).max(60),
  brand: z.string().trim().max(80).nullish(),
  category: foodCategorySchema,
  source: foodSourceSchema,
  /** Codigo de barras. Nulo na maioria; preenchido em industrializados (V2). */
  barcode: z.string().regex(/^[0-9]{8,14}$/).nullish(),
  /** Unidade da base: 'g' para solidos, 'ml' para liquidos. */
  baseUnit: z.enum(['g', 'ml']),
  per100g: nutritionPer100Schema,
  servings: z.array(foodServingSchema).max(10).default([]),
  /** Alimentos criados pelo usuario ficam visiveis so para ele. */
  ownerId: z.string().uuid().nullish(),
  isVerified: z.boolean().default(false),
});
export type Food = z.infer<typeof foodSchema>;

export const createFoodSchema = foodSchema
  .omit({ id: true, ownerId: true, isVerified: true, source: true, servings: true })
  .extend({
    servings: z.array(foodServingSchema.omit({ id: true })).max(10).default([]),
  });
export type CreateFoodInput = z.infer<typeof createFoodSchema>;

/** Query de `GET /alimentos`. Busca textual com paginacao por cursor. */
export const searchFoodQuerySchema = z.object({
  q: z.string().trim().min(2).max(60),
  category: foodCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});
export type SearchFoodQuery = z.infer<typeof searchFoodQuerySchema>;

export const foodSearchResponseSchema = z.object({
  items: z.array(foodSchema),
  nextCursor: z.string().nullable(),
});
export type FoodSearchResponse = z.infer<typeof foodSearchResponseSchema>;
