import { describe, expect, it } from 'vitest';
import { calculateTDEE, suggestActivityLevel } from '../src/domain/nutrition/tdee.js';
import { DomainError } from '../src/utils/errors.js';

describe('calculateTDEE', () => {
  it('aplica o fator de atividade sobre a TMB', () => {
    const result = calculateTDEE({ bmr: 1780, activityLevel: 'moderately_active' });
    expect(result.activityFactor).toBe(1.55);
    expect(result.tdee).toBe(2759); // 1780 * 1.55 = 2759
    expect(result.activityKcal).toBe(979);
  });

  it('cresce monotonicamente com o nivel de atividade', () => {
    const bmr = 1600;
    const levels = [
      'sedentary',
      'lightly_active',
      'moderately_active',
      'very_active',
      'extremely_active',
    ] as const;

    const values = levels.map((activityLevel) => calculateTDEE({ bmr, activityLevel }).tdee);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
    expect(new Set(values).size).toBe(levels.length);
  });

  it('soma o gasto extra declarado', () => {
    const base = calculateTDEE({ bmr: 1500, activityLevel: 'sedentary' });
    const withExtra = calculateTDEE({ bmr: 1500, activityLevel: 'sedentary', extraDailyKcal: 300 });
    expect(withExtra.tdee - base.tdee).toBe(300);
  });

  it('rejeita TMB invalida e extras absurdos', () => {
    expect(() => calculateTDEE({ bmr: 0, activityLevel: 'sedentary' })).toThrowError(DomainError);
    expect(() => calculateTDEE({ bmr: -10, activityLevel: 'sedentary' })).toThrowError(DomainError);
    expect(() =>
      calculateTDEE({ bmr: 1500, activityLevel: 'sedentary', extraDailyKcal: 5000 }),
    ).toThrowError(DomainError);
  });
});

describe('suggestActivityLevel', () => {
  it('nao treina e trabalha sentado -> sedentario', () => {
    expect(suggestActivityLevel({ trainingDaysPerWeek: 0, dailyRoutine: 'desk_job' })).toBe(
      'sedentary',
    );
  });

  it('treina 4x e trabalha sentado -> moderado', () => {
    expect(suggestActivityLevel({ trainingDaysPerWeek: 4, dailyRoutine: 'desk_job' })).toBe(
      'moderately_active',
    );
  });

  it('trabalho fisico pesado nunca cai abaixo de muito ativo', () => {
    expect(suggestActivityLevel({ trainingDaysPerWeek: 0, dailyRoutine: 'physical_labor' })).toBe(
      'very_active',
    );
    expect(suggestActivityLevel({ trainingDaysPerWeek: 5, dailyRoutine: 'physical_labor' })).toBe(
      'extremely_active',
    );
  });

  it('normaliza entradas fora da faixa 0-7', () => {
    expect(suggestActivityLevel({ trainingDaysPerWeek: -3, dailyRoutine: 'desk_job' })).toBe(
      'sedentary',
    );
    expect(suggestActivityLevel({ trainingDaysPerWeek: 99, dailyRoutine: 'desk_job' })).toBe(
      'very_active',
    );
  });
});
