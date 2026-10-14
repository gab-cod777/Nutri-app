import { addDays, diffDays, startOfIsoWeek } from '../../utils/dates.js';
import { clamp, percentOf, round } from '../../utils/math.js';

export interface DatedValue {
  readonly date: string;
  readonly value: number;
}

/**
 * Media movel por janela de calendario (nao por quantidade de pontos).
 *
 * Para cada medida, faz a media das medidas dos `windowDays` dias terminando
 * nela. Janela por calendario e importante: quem se pesa 2x na semana nao pode
 * ter uma "media de 7 dias" que cobre 3 semanas.
 */
export function movingAverage(points: readonly DatedValue[], windowDays = 7): DatedValue[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((point) => {
    const window = sorted.filter((p) => {
      const age = diffDays(p.date, point.date);
      return age >= 0 && age < windowDays;
    });
    const avg = window.reduce((acc, p) => acc + p.value, 0) / window.length;
    return { date: point.date, value: round(avg, 2) };
  });
}

/** Agrega por semana ISO (media), datando cada ponto pela segunda-feira. */
export function aggregateByWeek(points: readonly DatedValue[]): DatedValue[] {
  const buckets = new Map<string, number[]>();
  for (const p of points) {
    const week = startOfIsoWeek(p.date);
    const bucket = buckets.get(week) ?? [];
    bucket.push(p.value);
    buckets.set(week, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      value: round(values.reduce((acc, v) => acc + v, 0) / values.length, 2),
    }));
}

export interface CalorieDay {
  readonly consumed: number;
  readonly target: number;
}

/** Tolerancia padrao de aderencia: +/-10% da meta. */
export const CALORIE_ADHERENCE_TOLERANCE = 0.1;

/**
 * Percentual de dias COM REGISTRO cujo consumo ficou dentro da tolerancia.
 *
 * Dias sem registro nao contam como "fora da meta": seriam falta de dado, nao
 * falta de aderencia. A falta de registro aparece no streak.
 */
export function calorieAdherencePercent(
  days: readonly CalorieDay[],
  tolerance = CALORIE_ADHERENCE_TOLERANCE,
): number {
  const logged = days.filter((d) => d.consumed > 0 && d.target > 0);
  const within = logged.filter((d) => Math.abs(d.consumed - d.target) <= d.target * tolerance);
  return clamp(percentOf(within.length, logged.length), 0, 100);
}

/** Treinos concluidos sobre planejados, limitado a 100%. */
export function workoutAdherencePercent(completed: number, planned: number): number {
  return clamp(percentOf(completed, planned), 0, 100);
}

/**
 * Dias consecutivos com registro, terminando hoje.
 *
 * Se hoje ainda nao tem registro, a sequencia conta a partir de ontem: as 9h
 * o usuario nao "perdeu" o streak so porque ainda nao tomou cafe.
 */
export function loggingStreakDays(loggedDates: Iterable<string>, today: string): number {
  const logged = new Set(loggedDates);
  let cursor = logged.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (logged.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Variacao entre o primeiro e o ultimo ponto da serie. Zero com menos de 2 pontos. */
export function seriesChange(points: readonly DatedValue[]): number {
  if (points.length < 2) return 0;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return round(sorted[sorted.length - 1]!.value - sorted[0]!.value, 2);
}
