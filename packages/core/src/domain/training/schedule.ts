import { addDays, diffDays, startOfIsoWeek } from '../../utils/dates.js';
import { DomainError } from '../../utils/errors.js';

/**
 * Dias da semana de treino (0 = segunda) para cada frequencia semanal.
 *
 * Espaca as sessoes para dar descanso entre elas: 3x = seg/qua/sex, 2x =
 * seg/qui. O treino N do plano (dayIndex N) cai no N-esimo dia desta lista.
 */
const SCHEDULES: Record<number, readonly number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function trainingWeekdays(daysPerWeek: number): readonly number[] {
  const schedule = SCHEDULES[daysPerWeek];
  if (!schedule) {
    throw new DomainError('invalid_days_per_week', 'Dias de treino por semana deve estar entre 1 e 7.', {
      daysPerWeek,
    });
  }
  return schedule;
}

/** Dia da semana (0 = segunda ... 6 = domingo) de uma data de calendario. */
export function weekdayOf(date: string): number {
  return diffDays(startOfIsoWeek(date), date);
}

/** Indice do treino agendado para a data, ou null em dia de descanso. */
export function workoutIndexForDate(daysPerWeek: number, date: string): number | null {
  const index = trainingWeekdays(daysPerWeek).indexOf(weekdayOf(date));
  return index === -1 ? null : index;
}

/** Proximo dia de treino estritamente depois de `date`. */
export function nextTrainingDay(daysPerWeek: number, date: string): { date: string; workoutIndex: number } {
  for (let i = 1; i <= 7; i += 1) {
    const candidate = addDays(date, i);
    const index = workoutIndexForDate(daysPerWeek, candidate);
    if (index !== null) return { date: candidate, workoutIndex: index };
  }
  // Inalcancavel: toda agenda tem ao menos um dia por semana.
  throw new DomainError('invalid_days_per_week', 'Agenda de treino vazia.');
}
