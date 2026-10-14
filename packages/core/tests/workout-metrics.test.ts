import {
  computeTrainingVolume,
  estimateWorkoutDurationMinutes,
} from '../src/domain/training/workout-metrics.js';
import { onboardingRequestSchema } from '../src/schemas/user.js';

describe('computeTrainingVolume', () => {
  it('soma reps x carga e ignora aquecimento', () => {
    expect(
      computeTrainingVolume([
        { reps: 10, loadKg: 20, isWarmup: true },
        { reps: 10, loadKg: 40 },
        { reps: 8, loadKg: 42.5 },
      ]),
    ).toBe(740);
  });

  it('peso corporal (carga 0) gera volume 0', () => {
    expect(computeTrainingVolume([{ reps: 15, loadKg: 0 }])).toBe(0);
  });
});

describe('estimateWorkoutDurationMinutes', () => {
  it('series x (execucao + descanso) + transicoes + aquecimento', () => {
    // 2 exercicios de 3 series, 90 s de descanso:
    // por exercicio: 3*40 + 2*90 + 60 = 360 s -> 720 s = 12 min + 5 = 17
    expect(
      estimateWorkoutDurationMinutes([
        { sets: 3, restSeconds: 90 },
        { sets: 3, restSeconds: 90 },
      ]),
    ).toBe(17);
  });

  it('respeita a faixa 10-180 do contrato', () => {
    expect(estimateWorkoutDurationMinutes([])).toBe(10);
    expect(estimateWorkoutDurationMinutes(Array.from({ length: 15 }, () => ({ sets: 10, restSeconds: 600 })))).toBe(180);
  });
});

describe('onboardingRequestSchema', () => {
  const base = {
    displayName: 'Ana',
    sex: 'female',
    birthDate: '1995-04-10',
    heightCm: 165,
    weightKg: 62,
    goal: 'lose_weight',
    activityLevel: 'lightly_active',
    trainingDaysPerWeek: 3,
    experience: 'beginner',
    location: 'gym',
    availableEquipment: ['machines'],
  };

  it('exige consentimento explicito de dados de saude', () => {
    expect(onboardingRequestSchema.safeParse(base).success).toBe(false);
    expect(onboardingRequestSchema.safeParse({ ...base, healthDataConsent: false }).success).toBe(false);
    expect(onboardingRequestSchema.safeParse({ ...base, healthDataConsent: true }).success).toBe(true);
  });
});
