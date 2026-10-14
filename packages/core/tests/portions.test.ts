import { describe, expect, it } from 'vitest';
import {
  scaleNutritionByGrams,
  sumNutrition,
  toGrams,
} from '../src/domain/nutrition/portions.js';
import { DomainError } from '../src/utils/errors.js';

const RICE_PER_100 = { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 };

describe('toGrams', () => {
  it('mantem gramas e mililitros', () => {
    expect(toGrams(150, 'g')).toBe(150);
    expect(toGrams(200, 'ml')).toBe(200);
  });

  it('usa o gramsPerUnit do alimento quando disponivel', () => {
    expect(toGrams(2, 'unit', 50)).toBe(100); // 2 ovos de 50 g
    expect(toGrams(1, 'tablespoon', 13)).toBe(13); // colher de azeite
  });

  it('cai para a medida caseira padrao quando o alimento nao define peso', () => {
    expect(toGrams(1, 'tablespoon')).toBe(15);
    expect(toGrams(2, 'cup')).toBe(400);
  });

  it('falha quando a unidade nao tem peso definido nem padrao', () => {
    expect(() => toGrams(1, 'unit')).toThrowError(DomainError);
  });

  it('rejeita quantidade negativa', () => {
    expect(() => toGrams(-1, 'g')).toThrowError(DomainError);
  });
});

describe('scaleNutritionByGrams', () => {
  it('escala proporcionalmente a partir da base de 100 g', () => {
    expect(scaleNutritionByGrams(RICE_PER_100, 150)).toEqual({
      calories: 195,
      protein: 4.1,
      carbs: 42,
      fat: 0.5,
      fiber: 0.6,
    });
  });

  it('porcao zero devolve tudo zerado', () => {
    expect(scaleNutritionByGrams(RICE_PER_100, 0)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    });
  });

  it('trata fibra ausente como zero', () => {
    const semFibra = { calories: 100, protein: 5, carbs: 10, fat: 2 };
    expect(scaleNutritionByGrams(semFibra, 200).fiber).toBe(0);
  });

  it('rejeita gramas negativas', () => {
    expect(() => scaleNutritionByGrams(RICE_PER_100, -50)).toThrowError(DomainError);
  });
});

describe('sumNutrition', () => {
  it('soma varias porcoes', () => {
    const total = sumNutrition([
      { calories: 195, protein: 4.1, carbs: 42, fat: 0.5, fiber: 0.6 },
      { calories: 198, protein: 37.2, carbs: 0, fat: 4.3, fiber: 0 },
    ]);
    expect(total.calories).toBe(393);
    expect(total.protein).toBeCloseTo(41.3, 1);
  });

  it('lista vazia devolve zeros', () => {
    expect(sumNutrition([]).calories).toBe(0);
  });
});
