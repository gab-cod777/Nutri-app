import { describe, expect, it } from 'vitest';
import {
  buildAnalysisResult,
  computeOverallConfidence,
  suggestMealTypeByHour,
} from '../src/domain/nutrition/meal-analysis.js';
import { mealAnalysisModelOutputSchema, type MealAnalysisModelOutput } from '../src/schemas/ai.js';

function food(overrides: Partial<MealAnalysisModelOutput['foods'][number]> = {}) {
  return {
    name: 'arroz branco cozido',
    canonicalName: 'white_rice_cooked',
    category: 'grain' as const,
    preparationMethod: 'boiled' as const,
    estimatedGrams: 150,
    minGrams: 120,
    maxGrams: 200,
    per100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 },
    confidence: 0.85,
    notes: null,
    ...overrides,
  };
}

const baseOutput: MealAnalysisModelOutput = {
  isFood: true,
  rejectionReason: null,
  mealType: 'lunch',
  description: 'Arroz com frango grelhado',
  imageQuality: 'good',
  hiddenCalorieRisk: 'low',
  foods: [
    food(),
    food({
      name: 'file de frango grelhado',
      canonicalName: 'grilled_chicken_breast',
      category: 'protein',
      preparationMethod: 'grilled',
      estimatedGrams: 120,
      minGrams: 100,
      maxGrams: 150,
      per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
      confidence: 0.9,
    }),
  ],
};

describe('buildAnalysisResult', () => {
  it('calcula os totais a partir de per100g x gramas, sem confiar em aritmetica do modelo', () => {
    const result = buildAnalysisResult({ output: baseOutput, fallbackMealType: 'lunch' });

    // arroz: 130 * 1.5 = 195 kcal | frango: 165 * 1.2 = 198 kcal
    expect(result.foods[0]?.totals.calories).toBe(195);
    expect(result.foods[1]?.totals.calories).toBe(198);
    expect(result.totals.calories).toBe(393);
    expect(result.totals.protein).toBeCloseTo(2.7 * 1.5 + 31 * 1.2, 1);
  });

  it('deriva a faixa calorica de minGrams e maxGrams', () => {
    const result = buildAnalysisResult({ output: baseOutput, fallbackMealType: 'lunch' });
    // min: 130*1.2 + 165*1.0 = 156 + 165 = 321 | max: 130*2 + 165*1.5 = 260 + 247.5 = 508
    expect(result.totals.caloriesMin).toBe(321);
    expect(result.totals.caloriesMax).toBe(508);
    expect(result.totals.caloriesMin).toBeLessThan(result.totals.calories);
    expect(result.totals.caloriesMax).toBeGreaterThan(result.totals.calories);
  });

  it('nao pede confirmacao quando a analise e boa', () => {
    const result = buildAnalysisResult({
      output: baseOutput,
      fallbackMealType: 'lunch',
      resolveFoodId: () => '00000000-0000-4000-8000-000000000001',
    });
    expect(result.needsUserConfirmation).toBe(false);
    expect(result.confirmationReasons).toEqual([]);
  });

  it('pede confirmacao quando a confianca geral e baixa', () => {
    const output: MealAnalysisModelOutput = {
      ...baseOutput,
      foods: baseOutput.foods.map((f) => ({ ...f, confidence: 0.4 })),
    };
    const result = buildAnalysisResult({
      output,
      fallbackMealType: 'lunch',
      resolveFoodId: () => '00000000-0000-4000-8000-000000000001',
    });
    expect(result.needsUserConfirmation).toBe(true);
    expect(result.confirmationReasons).toContain('low_confidence');
  });

  it('pede confirmacao com foto ruim ou risco alto de calorias invisiveis', () => {
    const poorImage = buildAnalysisResult({
      output: { ...baseOutput, imageQuality: 'poor' },
      fallbackMealType: 'lunch',
      resolveFoodId: () => '00000000-0000-4000-8000-000000000001',
    });
    expect(poorImage.confirmationReasons).toContain('poor_image_quality');

    const hiddenCalories = buildAnalysisResult({
      output: { ...baseOutput, hiddenCalorieRisk: 'high' },
      fallbackMealType: 'lunch',
      resolveFoodId: () => '00000000-0000-4000-8000-000000000001',
    });
    expect(hiddenCalories.confirmationReasons).toContain('hidden_calories');
  });

  it('sinaliza quando a maioria das calorias nao casou com a base de alimentos', () => {
    const result = buildAnalysisResult({ output: baseOutput, fallbackMealType: 'lunch' });
    expect(result.confirmationReasons).toContain('no_match_in_database');
    expect(result.foods.every((f) => f.foodId === null)).toBe(true);
  });

  it('usa o mealType do app quando o modelo nao opina', () => {
    const result = buildAnalysisResult({
      output: { ...baseOutput, mealType: null },
      fallbackMealType: 'dinner',
    });
    expect(result.mealType).toBe('dinner');
  });

  it('gera clientId unico por alimento', () => {
    const result = buildAnalysisResult({ output: baseOutput, fallbackMealType: 'lunch' });
    const ids = result.foods.map((f) => f.clientId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('computeOverallConfidence', () => {
  it('pondera pela contribuicao calorica, nao por media simples', () => {
    const result = buildAnalysisResult({
      output: {
        ...baseOutput,
        foods: [
          food({ confidence: 0.9, estimatedGrams: 300 }), // 390 kcal, alta confianca
          food({
            name: 'alface',
            canonicalName: 'lettuce_raw',
            category: 'vegetable',
            preparationMethod: 'raw',
            confidence: 0.2,
            estimatedGrams: 30,
            minGrams: 20,
            maxGrams: 50,
            per100g: { calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3 },
          }), // 4.5 kcal, baixa confianca
        ],
      },
      fallbackMealType: 'lunch',
    });

    // Media simples daria 0.55; ponderada fica perto de 0.89
    expect(result.overallConfidence).toBeGreaterThan(0.85);
  });

  it('devolve 0 para lista vazia', () => {
    expect(computeOverallConfidence([])).toBe(0);
  });
});

describe('mealAnalysisModelOutputSchema', () => {
  it('aceita um output valido', () => {
    expect(() => mealAnalysisModelOutputSchema.parse(baseOutput)).not.toThrow();
  });

  it('rejeita isFood=true com lista de alimentos vazia', () => {
    const parsed = mealAnalysisModelOutputSchema.safeParse({ ...baseOutput, foods: [] });
    expect(parsed.success).toBe(false);
  });

  it('rejeita isFood=false com alimentos preenchidos', () => {
    const parsed = mealAnalysisModelOutputSchema.safeParse({ ...baseOutput, isFood: false });
    expect(parsed.success).toBe(false);
  });

  it('rejeita faixa incoerente (estimado fora de min/max)', () => {
    const parsed = mealAnalysisModelOutputSchema.safeParse({
      ...baseOutput,
      foods: [food({ estimatedGrams: 500, minGrams: 100, maxGrams: 200 })],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejeita canonicalName que nao e snake_case', () => {
    const parsed = mealAnalysisModelOutputSchema.safeParse({
      ...baseOutput,
      foods: [food({ canonicalName: 'Arroz Branco' })],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('suggestMealTypeByHour', () => {
  it.each([
    [3, 'supper'],
    [8, 'breakfast'],
    [11, 'morning_snack'],
    [13, 'lunch'],
    [16, 'afternoon_snack'],
    [20, 'dinner'],
    [23, 'supper'],
  ])('as %i h sugere %s', (hour, expected) => {
    expect(suggestMealTypeByHour(hour)).toBe(expected);
  });

  it('normaliza horas fora da faixa', () => {
    expect(suggestMealTypeByHour(-5)).toBe('supper');
    expect(suggestMealTypeByHour(99)).toBe('supper');
  });
});
