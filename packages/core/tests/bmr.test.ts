import { describe, expect, it } from 'vitest';
import { calculateBMR, calculateLeanBodyMass } from '../src/domain/nutrition/bmr.js';
import { DomainError } from '../src/utils/errors.js';

describe('calculateBMR - Mifflin-St Jeor', () => {
  it('calcula para homem usando a constante +5', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    const result = calculateBMR({ sex: 'male', ageYears: 30, heightCm: 180, weightKg: 80 });
    expect(result.bmr).toBe(1780);
    expect(result.formula).toBe('mifflin_st_jeor');
    expect(result.leanBodyMassKg).toBeNull();
  });

  it('calcula para mulher usando a constante -161', () => {
    // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 -> 1330
    const result = calculateBMR({ sex: 'female', ageYears: 28, heightCm: 165, weightKg: 60 });
    expect(result.bmr).toBe(1330);
  });

  it('usa a media das constantes para sex "other"', () => {
    const male = calculateBMR({ sex: 'male', ageYears: 30, heightCm: 175, weightKg: 70 });
    const female = calculateBMR({ sex: 'female', ageYears: 30, heightCm: 175, weightKg: 70 });
    const other = calculateBMR({ sex: 'other', ageYears: 30, heightCm: 175, weightKg: 70 });

    expect(other.bmr).toBeGreaterThan(female.bmr);
    expect(other.bmr).toBeLessThan(male.bmr);
    expect(other.bmr).toBe(Math.round((male.bmr + female.bmr) / 2));
  });

  it('a TMB cai com a idade e sobe com peso e altura', () => {
    const base = { sex: 'male' as const, ageYears: 30, heightCm: 180, weightKg: 80 };
    expect(calculateBMR({ ...base, ageYears: 50 }).bmr).toBeLessThan(calculateBMR(base).bmr);
    expect(calculateBMR({ ...base, weightKg: 90 }).bmr).toBeGreaterThan(calculateBMR(base).bmr);
    expect(calculateBMR({ ...base, heightCm: 190 }).bmr).toBeGreaterThan(calculateBMR(base).bmr);
  });
});

describe('calculateBMR - Katch-McArdle', () => {
  it('escolhe Katch-McArdle automaticamente quando ha % de gordura', () => {
    // LBM = 80 * 0.8 = 64 -> 370 + 21.6*64 = 370 + 1382.4 = 1752.4 -> 1752
    const result = calculateBMR({
      sex: 'male',
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      bodyFatPercentage: 20,
    });
    expect(result.formula).toBe('katch_mcardle');
    expect(result.leanBodyMassKg).toBe(64);
    expect(result.bmr).toBe(1752);
  });

  it('respeita a formula pedida explicitamente, mesmo com % de gordura disponivel', () => {
    const result = calculateBMR({
      sex: 'male',
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      bodyFatPercentage: 20,
      formula: 'mifflin_st_jeor',
    });
    expect(result.formula).toBe('mifflin_st_jeor');
    expect(result.bmr).toBe(1780);
  });

  it('ignora o sexo: mesma massa magra, mesma TMB', () => {
    const shared = { ageYears: 30, heightCm: 170, weightKg: 70, bodyFatPercentage: 25 };
    expect(calculateBMR({ ...shared, sex: 'male' }).bmr).toBe(
      calculateBMR({ ...shared, sex: 'female' }).bmr,
    );
  });

  it('falha ao pedir Katch-McArdle sem % de gordura', () => {
    expect(() =>
      calculateBMR({
        sex: 'male',
        ageYears: 30,
        heightCm: 180,
        weightKg: 80,
        formula: 'katch_mcardle',
      }),
    ).toThrowError(DomainError);
  });
});

describe('validacao de entrada', () => {
  it.each([
    ['idade abaixo do minimo', { ageYears: 10 }],
    ['idade acima do maximo', { ageYears: 120 }],
    ['altura implausivel', { heightCm: 40 }],
    ['peso implausivel', { weightKg: 5 }],
  ])('rejeita %s', (_label, override) => {
    expect(() =>
      calculateBMR({ sex: 'male', ageYears: 30, heightCm: 180, weightKg: 80, ...override }),
    ).toThrowError(DomainError);
  });

  it('rejeita NaN', () => {
    expect(() =>
      calculateBMR({ sex: 'male', ageYears: Number.NaN, heightCm: 180, weightKg: 80 }),
    ).toThrowError(/numero finito/);
  });
});

describe('calculateLeanBodyMass', () => {
  it('desconta a gordura do peso total', () => {
    expect(calculateLeanBodyMass(100, 30)).toBe(70);
    expect(calculateLeanBodyMass(82.5, 18)).toBe(67.65);
  });
});
