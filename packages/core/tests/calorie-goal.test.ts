import { describe, expect, it } from 'vitest';
import {
  calculateCalorieGoal,
  calculateSafetyFloor,
} from '../src/domain/nutrition/calorie-goal.js';
import { DomainError } from '../src/utils/errors.js';

const BASE = { tdee: 2800, bmr: 1800, sex: 'male' as const };

describe('calculateCalorieGoal', () => {
  it('aplica deficit de 18% no ritmo moderado para perda de peso', () => {
    const result = calculateCalorieGoal({ ...BASE, goal: 'lose_weight' });
    expect(result.targetCalories).toBe(2296); // 2800 * 0.82
    expect(result.direction).toBe('deficit');
    expect(result.adjustmentKcal).toBe(-504);
    expect(result.adjustmentPercent).toBe(-18);
    expect(result.warnings).toEqual([]);
  });

  it('aplica superavit para ganho de massa', () => {
    const result = calculateCalorieGoal({ ...BASE, goal: 'gain_muscle' });
    expect(result.targetCalories).toBe(3136); // 2800 * 1.12
    expect(result.direction).toBe('surplus');
    expect(result.projectedWeeklyWeightChangeKg).toBeGreaterThan(0);
  });

  it('mantem o TDEE quando o objetivo e manter o peso', () => {
    const result = calculateCalorieGoal({ ...BASE, goal: 'maintain_weight' });
    expect(result.targetCalories).toBe(2800);
    expect(result.direction).toBe('maintenance');
    expect(result.projectedWeeklyWeightChangeKg).toBe(0);
  });

  it('o ritmo agressivo gera deficit maior que o lento', () => {
    const slow = calculateCalorieGoal({ ...BASE, goal: 'lose_weight', pace: 'slow' });
    const aggressive = calculateCalorieGoal({ ...BASE, goal: 'lose_weight', pace: 'aggressive' });
    expect(aggressive.targetCalories).toBeLessThan(slow.targetCalories);
    expect(aggressive.warnings).toContain('aggressive_deficit');
  });

  it('projeta a variacao semanal de peso a partir do ajuste calorico', () => {
    const result = calculateCalorieGoal({ ...BASE, goal: 'lose_weight' });
    // -504 kcal/dia * 7 / 7700 = -0.458 kg/semana
    expect(result.projectedWeeklyWeightChangeKg).toBeCloseTo(-0.46, 2);
  });
});

describe('piso de seguranca', () => {
  it('nunca deixa a meta cair abaixo da TMB', () => {
    // TDEE baixo + deficit agressivo levaria a meta abaixo da TMB
    const result = calculateCalorieGoal({
      tdee: 1900,
      bmr: 1700,
      sex: 'male',
      goal: 'lose_weight',
      pace: 'aggressive',
    });
    expect(result.targetCalories).toBe(1700);
    expect(result.warnings).toContain('floor_applied');
    expect(result.warnings).toContain('below_bmr');
  });

  it('respeita o piso absoluto por sexo quando a TMB e muito baixa', () => {
    const result = calculateCalorieGoal({
      tdee: 1400,
      bmr: 1100,
      sex: 'female',
      goal: 'lose_weight',
      pace: 'aggressive',
    });
    expect(result.targetCalories).toBe(1200);
    expect(result.warnings).toContain('floor_applied');
  });

  it('calculateSafetyFloor devolve o maior entre TMB e piso absoluto', () => {
    expect(calculateSafetyFloor(1100, 'female')).toBe(1200);
    expect(calculateSafetyFloor(1900, 'female')).toBe(1900);
    expect(calculateSafetyFloor(1400, 'male')).toBe(1500);
  });
});

describe('meta manual', () => {
  it('respeita a meta definida pelo usuario e sinaliza o override', () => {
    const result = calculateCalorieGoal({
      ...BASE,
      goal: 'lose_weight',
      manualTargetCalories: 2500,
    });
    expect(result.targetCalories).toBe(2500);
    expect(result.warnings).toContain('manual_override');
  });

  it('aplica o piso tambem sobre a meta manual', () => {
    const result = calculateCalorieGoal({
      ...BASE,
      goal: 'lose_weight',
      manualTargetCalories: 900,
    });
    expect(result.targetCalories).toBe(1800); // TMB
    expect(result.warnings).toEqual(expect.arrayContaining(['manual_override', 'floor_applied']));
  });

  it('rejeita meta manual fora de faixa plausivel', () => {
    expect(() =>
      calculateCalorieGoal({ ...BASE, goal: 'lose_weight', manualTargetCalories: 50000 }),
    ).toThrowError(DomainError);
  });
});

describe('entradas invalidas', () => {
  it('rejeita TDEE e TMB nao positivos', () => {
    expect(() => calculateCalorieGoal({ ...BASE, tdee: 0, goal: 'lose_weight' })).toThrowError(
      DomainError,
    );
    expect(() => calculateCalorieGoal({ ...BASE, bmr: -1, goal: 'lose_weight' })).toThrowError(
      DomainError,
    );
  });
});
