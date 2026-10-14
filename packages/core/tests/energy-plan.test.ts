import { describe, expect, it } from 'vitest';
import { buildEnergyPlan } from '../src/domain/nutrition/energy-plan.js';
import { userProfileSchema } from '../src/schemas/profile.js';

describe('buildEnergyPlan (integracao do pipeline)', () => {
  it('encadeia TMB -> TDEE -> meta -> macros de forma coerente', () => {
    const plan = buildEnergyPlan({
      sex: 'male',
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'moderately_active',
      goal: 'lose_weight',
      pace: 'moderate',
    });

    expect(plan.bmr.bmr).toBe(1780);
    expect(plan.tdee.tdee).toBe(2759);
    expect(plan.calories.targetCalories).toBe(2262); // 2759 * 0.82
    expect(plan.macros.calories).toBe(plan.calories.targetCalories);
    expect(plan.macros.protein.grams).toBe(160);
    expect(plan.disclaimer).toContain('estimativas');
  });

  it('a meta sempre respeita o piso, mesmo no cenario mais agressivo', () => {
    const plan = buildEnergyPlan({
      sex: 'female',
      ageYears: 55,
      heightCm: 150,
      weightKg: 48,
      activityLevel: 'sedentary',
      goal: 'lose_weight',
      pace: 'aggressive',
    });

    expect(plan.calories.targetCalories).toBeGreaterThanOrEqual(plan.calories.safetyFloorCalories);
    expect(plan.calories.warnings).toContain('floor_applied');
  });

  it('usa Katch-McArdle quando o perfil tem % de gordura', () => {
    const plan = buildEnergyPlan({
      sex: 'female',
      ageYears: 26,
      heightCm: 168,
      weightKg: 62,
      bodyFatPercentage: 24,
      activityLevel: 'very_active',
      goal: 'gain_muscle',
    });

    expect(plan.bmr.formula).toBe('katch_mcardle');
    expect(plan.bmr.leanBodyMassKg).toBeCloseTo(47.12, 2);
    expect(plan.calories.direction).toBe('surplus');
  });

  it('e deterministico: mesma entrada, mesma saida', () => {
    const input = {
      sex: 'male' as const,
      ageYears: 40,
      heightCm: 175,
      weightKg: 92,
      activityLevel: 'lightly_active' as const,
      goal: 'body_recomposition' as const,
    };
    expect(buildEnergyPlan(input)).toEqual(buildEnergyPlan(input));
  });
});

describe('userProfileSchema', () => {
  const validProfile = {
    displayName: 'Ana',
    sex: 'female',
    birthDate: '1996-04-12',
    heightCm: 165,
    weightKg: 62,
    goal: 'lose_weight',
    activityLevel: 'moderately_active',
    trainingDaysPerWeek: 4,
    availableEquipment: ['dumbbells'],
    experience: 'beginner',
    location: 'gym',
  };

  it('aceita um perfil valido e aplica os defaults', () => {
    const parsed = userProfileSchema.parse(validProfile);
    expect(parsed.pace).toBe('moderate');
    expect(parsed.mealsPerDay).toBe(4);
    expect(parsed.timezone).toBe('America/Sao_Paulo');
    expect(parsed.restrictions).toEqual([]);
  });

  it('rejeita idade fora da faixa suportada', () => {
    const tooYoung = { ...validProfile, birthDate: '2020-01-01' };
    expect(userProfileSchema.safeParse(tooYoung).success).toBe(false);
  });

  it('rejeita altura e peso implausiveis', () => {
    expect(userProfileSchema.safeParse({ ...validProfile, heightCm: 40 }).success).toBe(false);
    expect(userProfileSchema.safeParse({ ...validProfile, weightKg: 500 }).success).toBe(false);
  });

  it('exige ao menos um equipamento (peso corporal e uma opcao valida)', () => {
    expect(userProfileSchema.safeParse({ ...validProfile, availableEquipment: [] }).success).toBe(
      false,
    );
    expect(
      userProfileSchema.safeParse({ ...validProfile, availableEquipment: ['none'] }).success,
    ).toBe(true);
  });
});
