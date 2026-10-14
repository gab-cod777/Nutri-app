import { clamp, round } from '../../utils/math.js';

export interface VolumeSet {
  readonly reps: number;
  readonly loadKg: number;
  readonly isWarmup?: boolean;
}

/**
 * Volume de treino (tonelagem): soma de reps x carga das series de trabalho.
 *
 * Series de aquecimento ficam de fora - incluir aquecimento infla o volume de
 * quem aquece mais e distorce o grafico de progressao.
 */
export function computeTrainingVolume(sets: readonly VolumeSet[]): number {
  return round(
    sets.filter((s) => !s.isWarmup).reduce((acc, s) => acc + Math.max(0, s.reps) * Math.max(0, s.loadKg), 0),
    1,
  );
}

export interface PrescribedExercise {
  readonly sets: number;
  readonly restSeconds: number;
}

/** Tempo medio de execucao de uma serie, em segundos. */
export const SET_WORK_SECONDS = 40;
/** Troca de exercicio/equipamento, em segundos. */
export const EXERCISE_TRANSITION_SECONDS = 60;
/** Aquecimento geral antes do treino, em minutos. */
export const WARMUP_MINUTES = 5;

/**
 * Duracao estimada de uma sessao a partir da prescricao.
 *
 * Nao pedimos isso ao modelo: e aritmetica (series x (execucao + descanso)), e
 * o modelo nao faz aritmetica neste sistema. Resultado limitado a 10-180 min,
 * a mesma faixa aceita pelo contrato do treino.
 */
export function estimateWorkoutDurationMinutes(exercises: readonly PrescribedExercise[]): number {
  const seconds = exercises.reduce((acc, ex) => {
    const sets = Math.max(0, ex.sets);
    const rests = Math.max(0, sets - 1) * Math.max(0, ex.restSeconds);
    return acc + sets * SET_WORK_SECONDS + rests + EXERCISE_TRANSITION_SECONDS;
  }, 0);
  return clamp(Math.round(seconds / 60 + WARMUP_MINUTES), 10, 180);
}
