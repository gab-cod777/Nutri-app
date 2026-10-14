import { DomainError } from './errors.js';

/**
 * Datas "de calendario" (YYYY-MM-DD) e conversao de instantes para o dia local
 * do usuario.
 *
 * O diario alimentar vira o dia no fuso do usuario, nao em UTC: quem janta as
 * 22h em Sao Paulo (01h UTC) precisa ver o jantar no dia certo. Funcoes puras -
 * o instante "agora" sempre chega por parametro.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** true quando `timeZone` e um identificador IANA reconhecido pelo runtime. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function localParts(instant: Date, timeZone: string): Record<string, string> {
  if (!isValidTimeZone(timeZone)) {
    throw new DomainError('invalid_timezone', `Fuso horario invalido: ${timeZone}.`, { timeZone });
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** Dia local (YYYY-MM-DD) de um instante no fuso informado. */
export function toLocalDate(instant: Date, timeZone: string): string {
  const p = localParts(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hora local (0-23) de um instante no fuso informado. */
export function localHour(instant: Date, timeZone: string): number {
  return Number(localParts(instant, timeZone).hour);
}

function parseDate(date: string): Date {
  if (!DATE_RE.test(date)) {
    throw new DomainError('invalid_date', `Data invalida: ${date}.`, { date });
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new DomainError('invalid_date', `Data invalida: ${date}.`, { date });
  }
  return parsed;
}

/** Soma `days` (pode ser negativo) a uma data de calendario. */
export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dias entre duas datas de calendario (`to - from`). */
export function diffDays(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

/** Todas as datas de `from` ate `to`, inclusive. Vazio se `to < from`. */
export function eachDay(from: string, to: string): string[] {
  const total = diffDays(from, to);
  const days: string[] = [];
  for (let i = 0; i <= total; i += 1) days.push(addDays(from, i));
  return days;
}

/** Segunda-feira da semana ISO que contem `date`. */
export function startOfIsoWeek(date: string): string {
  const weekday = parseDate(date).getUTCDay(); // 0 = domingo
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(date, offset);
}
