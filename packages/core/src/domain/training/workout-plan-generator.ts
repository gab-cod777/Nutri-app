import type { Equipment, Goal, MuscleGroup, TrainingExperience } from '../../schemas/enums.js';
import { DomainError } from '../../utils/errors.js';
import { estimateWorkoutDurationMinutes } from './workout-metrics.js';

/**
 * Gerador de plano de treino por regras.
 *
 * Deterministico: o mesmo perfil gera o mesmo plano (testavel, explicavel,
 * sem custo). As regras seguem recomendacoes gerais de treino resistido:
 * divisao pela frequencia, volume pelo nivel, faixa de repeticoes pelo
 * objetivo, compostos antes de isolados e sessao que cabe no tempo disponivel.
 * Nao e prescricao - o app exibe o disclaimer de treino.
 */
export const WORKOUT_GENERATOR_VERSION = 'treino-regras@1';

export interface CatalogExercise {
  readonly canonicalName: string;
  readonly primaryMuscle: MuscleGroup;
  readonly isCompound: boolean;
  /** 1 = iniciante, 2 = intermediario, 3 = avancado. */
  readonly difficultyLevel: number;
  readonly requiredEquipment: readonly Equipment[];
}

export interface WorkoutPlanGeneratorInput {
  readonly daysPerWeek: number;
  readonly experience: TrainingExperience;
  readonly goal: Goal;
  readonly sessionDurationMinutes: number;
  readonly availableEquipment: readonly Equipment[];
  readonly catalog: readonly CatalogExercise[];
}

export interface GeneratedExercise {
  readonly canonicalName: string;
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
  readonly restSeconds: number;
}

export interface GeneratedWorkout {
  readonly name: string;
  readonly dayIndex: number;
  readonly focusMuscles: MuscleGroup[];
  readonly estimatedDurationMinutes: number;
  readonly exercises: GeneratedExercise[];
}

export interface GeneratedWorkoutPlan {
  readonly name: string;
  readonly split: string;
  readonly rationale: string;
  readonly workouts: GeneratedWorkout[];
}

interface SessionTemplate {
  readonly key: string;
  readonly label: string;
  readonly slots: readonly MuscleGroup[];
}

const T = {
  fullA: { key: 'fullA', label: 'Corpo inteiro', slots: ['quads', 'chest', 'back', 'hamstrings', 'shoulders', 'abs', 'biceps', 'triceps'] },
  fullB: { key: 'fullB', label: 'Corpo inteiro', slots: ['glutes', 'back', 'chest', 'quads', 'shoulders', 'abs', 'triceps', 'biceps'] },
  fullC: { key: 'fullC', label: 'Corpo inteiro', slots: ['hamstrings', 'chest', 'back', 'quads', 'shoulders', 'abs', 'calves', 'biceps'] },
  upper: { key: 'upper', label: 'Superiores', slots: ['chest', 'back', 'shoulders', 'back', 'chest', 'biceps', 'triceps', 'shoulders'] },
  lower: { key: 'lower', label: 'Inferiores', slots: ['quads', 'hamstrings', 'glutes', 'quads', 'calves', 'abs', 'hamstrings', 'glutes'] },
  push: { key: 'push', label: 'Peito, ombros e triceps', slots: ['chest', 'shoulders', 'chest', 'triceps', 'shoulders', 'triceps', 'abs', 'chest'] },
  pull: { key: 'pull', label: 'Costas e biceps', slots: ['back', 'back', 'biceps', 'back', 'biceps', 'abs', 'forearms', 'shoulders'] },
  legs: { key: 'legs', label: 'Pernas', slots: ['quads', 'hamstrings', 'glutes', 'quads', 'calves', 'abs', 'hamstrings', 'glutes'] },
} satisfies Record<string, SessionTemplate>;

function chooseSplit(days: number, experience: TrainingExperience): { split: string; sessions: SessionTemplate[] } {
  switch (days) {
    case 1:
      return { split: 'Corpo inteiro', sessions: [T.fullA] };
    case 2:
      return { split: 'Corpo inteiro', sessions: [T.fullA, T.fullB] };
    case 3:
      return { split: 'Corpo inteiro', sessions: [T.fullA, T.fullB, T.fullC] };
    case 4:
      return { split: 'Superior/Inferior', sessions: [T.upper, T.lower, T.upper, T.lower] };
    case 5:
      return experience === 'beginner'
        ? { split: 'Superior/Inferior + corpo inteiro', sessions: [T.upper, T.lower, T.fullA, T.upper, T.lower] }
        : { split: 'Push/Pull/Legs + Superior/Inferior', sessions: [T.push, T.pull, T.legs, T.upper, T.lower] };
    case 6:
      return { split: 'Push/Pull/Legs', sessions: [T.push, T.pull, T.legs, T.push, T.pull, T.legs] };
    case 7:
      return { split: 'Push/Pull/Legs + corpo inteiro', sessions: [T.push, T.pull, T.legs, T.push, T.pull, T.legs, T.fullC] };
    default:
      throw new DomainError('invalid_days_per_week', 'Dias de treino por semana deve estar entre 1 e 7.', { days });
  }
}

const EXERCISES_PER_SESSION: Record<TrainingExperience, number> = { beginner: 5, intermediate: 6, advanced: 7 };
const MAX_DIFFICULTY: Record<TrainingExperience, number> = { beginner: 1, intermediate: 2, advanced: 3 };

function prescription(
  exercise: CatalogExercise,
  experience: TrainingExperience,
  goal: Goal,
): Omit<GeneratedExercise, 'canonicalName'> {
  const endurance = goal === 'lose_weight' || goal === 'improve_conditioning';
  const isCore = exercise.primaryMuscle === 'abs' || exercise.primaryMuscle === 'calves';

  const sets =
    experience === 'advanced' ? (exercise.isCompound ? 4 : 3) : experience === 'intermediate' ? 3 : exercise.isCompound ? 3 : 2;

  let reps: [number, number];
  if (isCore) reps = [12, 20];
  else if (exercise.isCompound) {
    reps = experience === 'beginner' ? [8, 12] : endurance ? [10, 15] : goal === 'gain_muscle' ? [6, 10] : [8, 12];
  } else reps = endurance ? [12, 20] : [10, 15];

  const rest = endurance ? (exercise.isCompound ? 75 : 45) : exercise.isCompound ? 120 : 60;
  return { sets, repsMin: reps[0], repsMax: reps[1], restSeconds: rest };
}

export function generateWorkoutPlan(input: WorkoutPlanGeneratorInput): GeneratedWorkoutPlan {
  const { split, sessions } = chooseSplit(input.daysPerWeek, input.experience);
  const available = new Set<Equipment>([...input.availableEquipment, 'none']);
  const maxDifficulty = MAX_DIFFICULTY[input.experience];

  const usable = input.catalog
    .filter((e) => e.requiredEquipment.length > 0 && e.requiredEquipment.every((r) => available.has(r)))
    .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
  // Permite um nivel acima quando nao ha nada no nivel do usuario para o musculo.
  const byMuscle = (muscle: MuscleGroup, allowHarder: boolean) =>
    usable.filter((e) => e.primaryMuscle === muscle && e.difficultyLevel <= maxDifficulty + (allowHarder ? 1 : 0));

  if (usable.length < 2) {
    throw new DomainError('insufficient_catalog', 'Nao ha exercicios suficientes para o equipamento informado.');
  }

  const templateUse = new Map<string, number>();
  const workouts = sessions.map((template, dayIndex) => {
    const variant = templateUse.get(template.key) ?? 0;
    templateUse.set(template.key, variant + 1);

    const used = new Set<string>();
    const chosen: CatalogExercise[] = [];
    const muscleCount = new Map<MuscleGroup, number>();
    for (const [slotIndex, muscle] of template.slots.entries()) {
      if (chosen.length >= EXERCISES_PER_SESSION[input.experience]) break;
      let candidates = byMuscle(muscle, false).filter((e) => !used.has(e.canonicalName));
      if (candidates.length === 0) candidates = byMuscle(muscle, true).filter((e) => !used.has(e.canonicalName));
      if (candidates.length === 0) continue;
      // Compostos no inicio da sessao; isolados depois.
      const preferCompound = slotIndex < 3;
      candidates.sort((a, b) => Number(b.isCompound === preferCompound) - Number(a.isCompound === preferCompound));
      const occurrence = muscleCount.get(muscle) ?? 0;
      muscleCount.set(muscle, occurrence + 1);
      const pick = candidates[(variant + occurrence) % candidates.length]!;
      used.add(pick.canonicalName);
      chosen.push(pick);
    }
    // Catalogo pobre para os musculos do template: completa com o que houver.
    for (const extra of usable) {
      if (chosen.length >= 2) break;
      if (!used.has(extra.canonicalName)) {
        used.add(extra.canonicalName);
        chosen.push(extra);
      }
    }

    let exercises = chosen.map((e) => ({ canonicalName: e.canonicalName, ...prescription(e, input.experience, input.goal) }));
    // Corta exercicios do fim ate caber no tempo disponivel (minimo 2).
    while (exercises.length > 2 && estimateWorkoutDurationMinutes(exercises) > input.sessionDurationMinutes) {
      exercises = exercises.slice(0, -1);
    }

    const kept = new Set(exercises.map((e) => e.canonicalName));
    const focus = [...new Set(chosen.filter((e) => kept.has(e.canonicalName)).map((e) => e.primaryMuscle))].slice(0, 5);
    return {
      name: `Treino ${String.fromCharCode(65 + dayIndex)} - ${template.label}`,
      dayIndex,
      focusMuscles: focus.length > 0 ? focus : (['full_body'] as MuscleGroup[]),
      estimatedDurationMinutes: estimateWorkoutDurationMinutes(exercises),
      exercises,
    };
  });

  return {
    name: `Plano ${split}`,
    split,
    rationale: `Divisao ${split.toLowerCase()} para ${input.daysPerWeek} treino(s) por semana, com volume para nivel ${
      { beginner: 'iniciante', intermediate: 'intermediario', advanced: 'avancado' }[input.experience]
    } e sessoes de ate ${input.sessionDurationMinutes} minutos.`,
    workouts,
  };
}
