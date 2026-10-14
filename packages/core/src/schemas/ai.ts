import { z } from 'zod';
import { foodCategorySchema, mealTypeSchema } from './enums.js';

/**
 * Modo de preparo. Muda drasticamente a densidade calorica: 100 g de batata
 * cozida tem ~87 kcal, frita em imersao passa de 300 kcal. O modelo precisa
 * declarar isso explicitamente para o numero fazer sentido.
 */
export const preparationMethodSchema = z.enum([
  'raw',
  'boiled',
  'steamed',
  'grilled',
  'baked',
  'sauteed',
  'fried',
  'deep_fried',
  'breaded_fried',
  'stewed',
  'unknown',
]);
export type PreparationMethod = z.infer<typeof preparationMethodSchema>;

/** Risco de calorias invisiveis na foto (oleo de cocao, molho embaixo, manteiga). */
export const hiddenCalorieRiskSchema = z.enum(['low', 'medium', 'high']);
export type HiddenCalorieRisk = z.infer<typeof hiddenCalorieRiskSchema>;

export const imageQualitySchema = z.enum(['good', 'fair', 'poor']);
export type ImageQuality = z.infer<typeof imageQualitySchema>;

/** Composicao nutricional por 100 g - forma canonica em todo o sistema. */
export const nutritionPer100Schema = z.object({
  calories: z.number().min(0).max(900),
  protein: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
  fiber: z.number().min(0).max(80).default(0),
});

/**
 * Um alimento identificado na foto.
 *
 * DECISAO IMPORTANTE: pedimos ao modelo a composicao POR 100 g mais a
 * quantidade estimada em gramas - nunca as calorias absolutas do prato.
 *
 *  1. Tabela nutricional por 100 g e conhecimento memorizado, onde o modelo e
 *     confiavel. Multiplicar 137 g x 1.71 kcal/g e aritmetica, onde ele erra.
 *  2. Os totais viram calculo deterministico nosso (`scaleNutritionByGrams`),
 *     entao dois usuarios com o mesmo prato recebem o mesmo numero.
 *  3. Quando o usuario corrige a porcao de 150 g para 200 g, recalculamos
 *     localmente, na hora, sem nova chamada de IA (sem custo, sem latencia).
 */
export const detectedFoodSchema = z.object({
  /** Nome exibido ao usuario, em pt-BR. Ex.: "arroz branco cozido". */
  name: z.string().trim().min(2).max(80),
  /** Nome canonico em ingles, snake_case. Usado para casar com a base de alimentos. */
  canonicalName: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/, 'canonicalName deve ser snake_case em ingles')
    .max(60),
  category: foodCategorySchema,
  preparationMethod: preparationMethodSchema,
  estimatedGrams: z.number().min(1).max(3000),
  /** Faixa plausivel da porcao. maxGrams >= estimatedGrams >= minGrams. */
  minGrams: z.number().min(1).max(3000),
  maxGrams: z.number().min(1).max(3000),
  per100g: nutritionPer100Schema,
  /** 0 a 1. Quao seguro o modelo esta de que este alimento esta na foto nesta quantidade. */
  confidence: z.number().min(0).max(1),
  /** Observacao curta em pt-BR. Ex.: "parece ter molho, nao da para confirmar". */
  notes: z.string().trim().max(200).nullish(),
});
export type DetectedFood = z.infer<typeof detectedFoodSchema>;

/**
 * O que o servico de IA (Python, `apps/ia`) DEVE retornar em `resultado`.
 * A API valida a resposta com este schema antes de usar: output fora do
 * contrato vira 502 e nunca chega ao app nem ao banco.
 *
 * Sem totais: eles sao derivados por nos. Sem `needsUserConfirmation`: e uma
 * regra de produto, nao uma opiniao do modelo.
 */
export const mealAnalysisModelOutputSchema = z
  .object({
    /** false quando a foto nao tem comida identificavel. */
    isFood: z.boolean(),
    /** Preenchido apenas quando isFood = false. Ex.: "a foto mostra um teclado". */
    rejectionReason: z.string().trim().max(200).nullish(),
    /** Palpite do modelo pelo conteudo do prato. O app sobrescreve pelo horario local. */
    mealType: mealTypeSchema.nullish(),
    /** Descricao curta do prato, em pt-BR. Vira o titulo da refeicao. */
    description: z.string().trim().max(140).nullish(),
    imageQuality: imageQualitySchema,
    hiddenCalorieRisk: hiddenCalorieRiskSchema,
    foods: z.array(detectedFoodSchema).max(15),
  })
  .refine((value) => value.isFood === (value.foods.length > 0), {
    message: 'foods deve estar vazio quando isFood = false, e nao vazio quando isFood = true.',
    path: ['foods'],
  })
  .refine((value) => value.foods.every((f) => f.minGrams <= f.estimatedGrams && f.estimatedGrams <= f.maxGrams), {
    message: 'Cada alimento deve satisfazer minGrams <= estimatedGrams <= maxGrams.',
    path: ['foods'],
  });
export type MealAnalysisModelOutput = z.infer<typeof mealAnalysisModelOutputSchema>;

/** Totais calculados por nos a partir do output do modelo. */
export const analysisTotalsSchema = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  /** Faixa calorica derivada de min/maxGrams. E isso que a UI mostra em destaque. */
  caloriesMin: z.number(),
  caloriesMax: z.number(),
});

/**
 * Um alimento ja enriquecido: output do modelo + totais calculados +
 * vinculo com a base de alimentos quando houve match.
 */
export const analyzedFoodSchema = detectedFoodSchema.extend({
  /** Id temporario para o app manipular a lista antes de salvar. */
  clientId: z.string().min(1),
  /** Id na base de alimentos quando `canonicalName` casou. Null = estimativa pura da IA. */
  foodId: z.string().uuid().nullish(),
  totals: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
  }),
});
export type AnalyzedFood = z.infer<typeof analyzedFoodSchema>;

/** Resposta de `POST /scan-prato`. */
export const mealAnalysisResultSchema = z.object({
  analysisId: z.string().uuid(),
  isFood: z.boolean(),
  rejectionReason: z.string().nullish(),
  mealType: mealTypeSchema,
  description: z.string().nullish(),
  imageQuality: imageQualitySchema,
  hiddenCalorieRisk: hiddenCalorieRiskSchema,
  foods: z.array(analyzedFoodSchema),
  totals: analysisTotalsSchema,
  /** Media das confiancas ponderada pelas calorias de cada item. */
  overallConfidence: z.number().min(0).max(1),
  /**
   * Regra de produto: quando true, a UI abre direto o passo de ajuste de porcao
   * em vez do resumo pronto para salvar.
   */
  needsUserConfirmation: z.boolean(),
  /** Motivos legiveis para a confirmacao ser necessaria. */
  confirmationReasons: z.array(
    z.enum(['low_confidence', 'poor_image_quality', 'hidden_calories', 'no_match_in_database']),
  ),
  disclaimer: z.string(),
  /** Milissegundos gastos no servico de IA. Alimenta metricas de UX. */
  processingMs: z.number().int().nonnegative(),
});
export type MealAnalysisResult = z.infer<typeof mealAnalysisResultSchema>;

/**
 * Campos de texto de `POST /scan-prato` (multipart/form-data). A foto vai no
 * campo de arquivo `foto`; nao e armazenada.
 */
export const scanPratoFieldsSchema = z.object({
  /** Tipo da refeicao pelo horario local (o app envia). Default: deduzido pela hora. */
  mealType: mealTypeSchema.optional(),
  /** Contexto opcional digitado pelo usuario: "tinha molho branco". */
  userHint: z.string().trim().max(200).optional(),
});
export type ScanPratoFields = z.infer<typeof scanPratoFieldsSchema>;
