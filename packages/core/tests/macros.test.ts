import { describe, expect, it } from 'vitest';
import { KCAL_PER_GRAM } from '../src/domain/nutrition/constants.js';
import {
  caloriesFromMacros,
  calculateMacroTargets,
  calculateReferenceWeight,
} from '../src/domain/nutrition/macros.js';
import { DomainError } from '../src/utils/errors.js';

describe('calculateMacroTargets', () => {
  it('distribui as calorias entre os tres macros sem estourar a meta', () => {
    const result = calculateMacroTargets({
      targetCalories: 2300,
      weightKg: 80,
      goal: 'lose_weight',
    });

    // 80 kg * 2.0 g/kg = 160 g de proteina
    expect(result.protein.grams).toBe(160);
    // 25% de 2300 = 575 kcal / 9 = 63.9 g
    expect(result.fat.grams).toBe(64);
    expect(result.carbs.grams).toBeGreaterThan(0);

    const total = result.protein.kcal + result.carbs.kcal + result.fat.kcal;
    expect(Math.abs(total - 2300)).toBeLessThanOrEqual(10); // tolerancia de arredondamento
  });

  it('os percentuais somam aproximadamente 100', () => {
    const result = calculateMacroTargets({
      targetCalories: 2000,
      weightKg: 70,
      goal: 'maintain_weight',
    });
    const sum = result.protein.percent + result.carbs.percent + result.fat.percent;
    expect(sum).toBeGreaterThanOrEqual(97);
    expect(sum).toBeLessThanOrEqual(103);
  });

  it('prescreve mais proteina em recomposicao do que em manutencao', () => {
    const input = { targetCalories: 2200, weightKg: 75 };
    const recomp = calculateMacroTargets({ ...input, goal: 'body_recomposition' });
    const maintain = calculateMacroTargets({ ...input, goal: 'maintain_weight' });
    expect(recomp.protein.grams).toBeGreaterThan(maintain.protein.grams);
  });

  it('nunca devolve carboidrato negativo em meta calorica apertada', () => {
    const result = calculateMacroTargets({
      targetCalories: 1200,
      weightKg: 110,
      goal: 'lose_weight',
    });
    expect(result.carbs.grams).toBeGreaterThanOrEqual(0);
    const total = result.protein.kcal + result.carbs.kcal + result.fat.kcal;
    expect(total).toBeLessThanOrEqual(1200 + 15);
  });

  it('respeita o minimo de gordura essencial', () => {
    const result = calculateMacroTargets({
      targetCalories: 1500,
      weightKg: 95,
      goal: 'lose_weight',
    });
    expect(result.fat.grams).toBeGreaterThanOrEqual(Math.round(95 * 0.6) - 1);
  });

  it('escala a fibra com as calorias, dentro dos limites', () => {
    expect(calculateMacroTargets({ targetCalories: 1200, weightKg: 60, goal: 'lose_weight' }).fiberGrams)
      .toBeGreaterThanOrEqual(20);
    expect(calculateMacroTargets({ targetCalories: 4000, weightKg: 100, goal: 'gain_muscle' }).fiberGrams)
      .toBeLessThanOrEqual(45);
  });

  it('rejeita metas caloricas implausiveis', () => {
    expect(() =>
      calculateMacroTargets({ targetCalories: 300, weightKg: 70, goal: 'lose_weight' }),
    ).toThrowError(DomainError);
    expect(() =>
      calculateMacroTargets({ targetCalories: 20000, weightKg: 70, goal: 'lose_weight' }),
    ).toThrowError(DomainError);
  });
});

describe('calculateReferenceWeight', () => {
  it('usa o peso total quando nao ha % de gordura', () => {
    expect(calculateReferenceWeight(90)).toBe(90);
    expect(calculateReferenceWeight(90, null)).toBe(90);
  });

  it('desconta gordura excedente em quem tem % alto', () => {
    // LBM = 120 * 0.6 = 72 -> 72 * 1.25 = 90 (< 120, entao vale)
    expect(calculateReferenceWeight(120, 40)).toBe(90);
  });

  it('nunca aumenta a referencia de quem ja e magro', () => {
    // LBM = 70 * 0.9 = 63 -> 63 * 1.25 = 78.75, maior que 70 -> limita em 70
    expect(calculateReferenceWeight(70, 10)).toBe(70);
  });

  it('dosa menos proteina para quem tem gordura corporal alta', () => {
    const semGordura = calculateMacroTargets({
      targetCalories: 2200,
      weightKg: 120,
      goal: 'lose_weight',
    });
    const comGordura = calculateMacroTargets({
      targetCalories: 2200,
      weightKg: 120,
      goal: 'lose_weight',
      bodyFatPercentage: 40,
    });
    expect(comGordura.protein.grams).toBeLessThan(semGordura.protein.grams);
  });
});

describe('caloriesFromMacros', () => {
  it('usa os fatores de Atwater', () => {
    expect(caloriesFromMacros({ protein: 10, carbs: 10, fat: 10 })).toBe(
      10 * KCAL_PER_GRAM.protein + 10 * KCAL_PER_GRAM.carbs + 10 * KCAL_PER_GRAM.fat,
    );
  });
});
