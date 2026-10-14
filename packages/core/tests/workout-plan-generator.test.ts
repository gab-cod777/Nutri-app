import type { CatalogExercise } from '../src/domain/training/workout-plan-generator.js';
import { generateWorkoutPlan } from '../src/domain/training/workout-plan-generator.js';
import { estimateWorkoutDurationMinutes } from '../src/domain/training/workout-metrics.js';
import { DomainError } from '../src/utils/errors.js';

const ex = (canonicalName: string, primaryMuscle: CatalogExercise['primaryMuscle'], isCompound: boolean, eq: CatalogExercise['requiredEquipment'], difficultyLevel = 1): CatalogExercise => ({
  canonicalName, primaryMuscle, isCompound, requiredEquipment: eq, difficultyLevel,
});

const CATALOG: CatalogExercise[] = [
  ex('leg_press', 'quads', true, ['machines']),
  ex('goblet_squat', 'quads', true, ['dumbbells']),
  ex('barbell_back_squat', 'quads', true, ['barbell'], 3),
  ex('machine_chest_press', 'chest', true, ['machines']),
  ex('dumbbell_bench_press', 'chest', true, ['dumbbells', 'bench']),
  ex('push_up', 'chest', true, ['none']),
  ex('lat_pulldown', 'back', true, ['cable_machine']),
  ex('machine_row', 'back', true, ['machines']),
  ex('lying_leg_curl', 'hamstrings', false, ['machines']),
  ex('dumbbell_romanian_deadlift', 'hamstrings', true, ['dumbbells']),
  ex('glute_bridge', 'glutes', false, ['none']),
  ex('dumbbell_shoulder_press', 'shoulders', true, ['dumbbells']),
  ex('lateral_raise', 'shoulders', false, ['dumbbells']),
  ex('dumbbell_curl', 'biceps', false, ['dumbbells']),
  ex('triceps_pushdown', 'triceps', false, ['cable_machine']),
  ex('plank', 'abs', false, ['none']),
  ex('standing_calf_raise', 'calves', false, ['none']),
];

const base = {
  experience: 'beginner' as const,
  goal: 'gain_muscle' as const,
  sessionDurationMinutes: 60,
  availableEquipment: ['machines', 'dumbbells', 'cable_machine', 'bench'] as CatalogExercise['requiredEquipment'],
  catalog: CATALOG,
};

describe('generateWorkoutPlan', () => {
  it('3x iniciante: corpo inteiro, 3 treinos com dayIndex 0..2', () => {
    const plan = generateWorkoutPlan({ ...base, daysPerWeek: 3 });
    expect(plan.split).toBe('Corpo inteiro');
    expect(plan.workouts.map((w) => w.dayIndex)).toEqual([0, 1, 2]);
    expect(plan.workouts[0]!.name).toBe('Treino A - Corpo inteiro');
    for (const w of plan.workouts) {
      expect(w.exercises.length).toBeGreaterThanOrEqual(2);
      expect(w.exercises.length).toBeLessThanOrEqual(5);
      expect(new Set(w.exercises.map((e) => e.canonicalName)).size).toBe(w.exercises.length);
      expect(w.estimatedDurationMinutes).toBeLessThanOrEqual(60);
    }
  });

  it('respeita equipamento e nivel (sem barra livre para iniciante sem barra)', () => {
    const plan = generateWorkoutPlan({ ...base, daysPerWeek: 3 });
    const names = plan.workouts.flatMap((w) => w.exercises.map((e) => e.canonicalName));
    expect(names).not.toContain('barbell_back_squat');
  });

  it('variantes do mesmo molde escolhem exercicios diferentes (upper A vs upper B)', () => {
    const plan = generateWorkoutPlan({ ...base, experience: 'intermediate', daysPerWeek: 4 });
    expect(plan.split).toBe('Superior/Inferior');
    const [upperA, , upperB] = plan.workouts;
    expect(upperA!.exercises.map((e) => e.canonicalName)).not.toEqual(upperB!.exercises.map((e) => e.canonicalName));
  });

  it('compostos antes de isolados e prescricao pelo objetivo', () => {
    const plan = generateWorkoutPlan({ ...base, experience: 'intermediate', daysPerWeek: 3 });
    const first = plan.workouts[0]!.exercises[0]!;
    expect(first).toMatchObject({ sets: 3, repsMin: 6, repsMax: 10, restSeconds: 120 });
    const emagrecer = generateWorkoutPlan({ ...base, goal: 'lose_weight', daysPerWeek: 3 });
    expect(emagrecer.workouts[0]!.exercises[0]).toMatchObject({ repsMin: 8, repsMax: 12, restSeconds: 75 });
  });

  it('corta exercicios para caber em sessoes curtas', () => {
    const plan = generateWorkoutPlan({ ...base, experience: 'advanced', daysPerWeek: 6, sessionDurationMinutes: 25 });
    for (const w of plan.workouts) {
      expect(w.exercises.length).toBeGreaterThanOrEqual(2);
      const fits = estimateWorkoutDurationMinutes(w.exercises) <= 25;
      expect(fits || w.exercises.length === 2).toBe(true);
    }
  });

  it('so peso corporal: usa o que existe', () => {
    const plan = generateWorkoutPlan({ ...base, availableEquipment: [], daysPerWeek: 2 });
    const names = plan.workouts.flatMap((w) => w.exercises.map((e) => e.canonicalName));
    expect(names.every((n) => ['push_up', 'glute_bridge', 'plank', 'standing_calf_raise'].includes(n))).toBe(true);
  });

  it('e deterministico', () => {
    expect(generateWorkoutPlan({ ...base, daysPerWeek: 5 })).toEqual(generateWorkoutPlan({ ...base, daysPerWeek: 5 }));
  });

  it('catalogo insuficiente -> DomainError', () => {
    expect(() => generateWorkoutPlan({ ...base, catalog: [CATALOG[0]!], availableEquipment: ['machines'], daysPerWeek: 3 })).toThrow(DomainError);
  });
});
