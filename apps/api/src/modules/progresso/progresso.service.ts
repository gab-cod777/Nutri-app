import {
  addDays,
  aggregateByWeek,
  calorieAdherencePercent,
  diffDays,
  eachDay,
  loggingStreakDays,
  movingAverage,
  seriesChange,
  workoutAdherencePercent,
  type CreateProgressLogInput,
  type DatedValue,
  type ProgressLog,
  type ProgressOverview,
  type ProgressQuery,
} from '@nutrisnap/core';
import type { NutritionTarget, PrismaClient, ProgressLog as ProgressLogRow } from '@prisma/client';
import { fromDbDate, toDbDate } from '../../lib/db-dates.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import { userToday } from '../../lib/user-context.js';
import type { DietaRepository } from '../dieta/dieta.repository.js';

/** Periodo padrao do grafico e limite maximo de uma consulta. */
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;
const TREND_WINDOW_DAYS = 7;

/**
 * Progresso: medidas corporais e agregacoes. As contas (media movel,
 * aderencia, streak) sao do core; aqui so buscamos e montamos as series.
 */
export class ProgressoService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly nutritionRepo: DietaRepository,
    private readonly now: () => Date,
  ) {}

  async overview(userId: string, query: ProgressQuery): Promise<ProgressOverview> {
    const today = await userToday(this.prisma, userId, this.now());
    const to = query.to ?? today;
    const from = query.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));
    const span = diffDays(from, to);
    if (span < 0) throw unprocessable('invalid_range', '`from` deve ser anterior ou igual a `to`.');
    if (span >= MAX_RANGE_DAYS) throw unprocessable('range_too_large', `Periodo maximo: ${MAX_RANGE_DAYS} dias.`);
    const metric = query.metric ?? 'weight_kg';

    // Busca alguns dias antes de `from` para a media movel do inicio do periodo ser correta.
    const logs = await this.prisma.progressLog.findMany({
      where: {
        userId,
        metric,
        measuredOn: { gte: toDbDate(addDays(from, -(TREND_WINDOW_DAYS - 1))), lte: toDbDate(to) },
      },
      orderBy: { measuredOn: 'asc' },
    });
    const allPoints: DatedValue[] = logs.map((l) => ({ date: fromDbDate(l.measuredOn), value: l.value }));
    const inRange = (p: DatedValue) => p.date >= from && p.date <= to;
    const points = allPoints.filter(inRange);
    const trend = movingAverage(allPoints, TREND_WINDOW_DAYS).filter(inRange);

    const [calorieSeries, workoutAdherence, streak] = await Promise.all([
      this.calorieSeries(userId, from, to),
      this.workoutAdherence(userId, from, to),
      this.streak(userId, today),
    ]);

    return {
      weightSeries: query.granularity === 'week' ? aggregateByWeek(points) : points,
      weightTrendSeries: query.granularity === 'week' ? aggregateByWeek(trend) : trend,
      calorieSeries,
      calorieAdherencePercent: calorieAdherencePercent(calorieSeries),
      workoutAdherencePercent: workoutAdherence,
      loggingStreakDays: streak,
      weightChangeKg: seriesChange(trend),
    };
  }

  /** Upsert por (usuario, metrica, dia): repesar no mesmo dia substitui. */
  async upsertLog(userId: string, input: CreateProgressLogInput): Promise<ProgressLog> {
    const measuredOn = toDbDate(input.measuredOn);
    const data = { value: input.value, notes: input.notes ?? null };
    const row = await this.prisma.progressLog.upsert({
      where: { userId_metric_measuredOn: { userId, metric: input.metric, measuredOn } },
      create: { ...data, userId, metric: input.metric, measuredOn },
      update: data,
    });
    return toLogDto(row);
  }

  async deleteLog(userId: string, id: string): Promise<void> {
    const result = await this.prisma.progressLog.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw notFound('Medida');
  }

  private async calorieSeries(userId: string, from: string, to: string) {
    const [grouped, targets] = await Promise.all([
      this.prisma.meal.groupBy({
        by: ['localDate'],
        where: { userId, localDate: { gte: toDbDate(from), lte: toDbDate(to) } },
        _sum: { totalCalories: true },
      }),
      this.nutritionRepo.findTargetsOverlapping(userId, from, to),
    ]);
    const first = targets.length > 0 ? null : await this.nutritionRepo.findFirstTarget(userId);
    const consumedByDay = new Map(grouped.map((g) => [fromDbDate(g.localDate), g._sum.totalCalories ?? 0]));
    return eachDay(from, to).map((date) => ({
      date,
      consumed: Math.round(consumedByDay.get(date) ?? 0),
      target: Math.round(targetFor(targets, date)?.calories ?? first?.calories ?? 0),
    }));
  }

  /** Concluidos / planejados (dias por semana do plano ativo x semanas do periodo). */
  private async workoutAdherence(userId: string, from: string, to: string): Promise<number> {
    const plan = await this.prisma.workoutPlan.findFirst({
      where: { userId, status: 'active' },
      select: { daysPerWeek: true },
    });
    if (!plan) return 0;
    const completed = await this.prisma.workoutLog.count({
      where: { userId, status: 'completed', localDate: { gte: toDbDate(from), lte: toDbDate(to) } },
    });
    const planned = Math.round((plan.daysPerWeek * (diffDays(from, to) + 1)) / 7);
    return workoutAdherencePercent(completed, Math.max(planned, 1));
  }

  private async streak(userId: string, today: string): Promise<number> {
    const rows = await this.prisma.meal.findMany({
      where: { userId, localDate: { gte: toDbDate(addDays(today, -(MAX_RANGE_DAYS - 1))), lte: toDbDate(today) } },
      select: { localDate: true },
      distinct: ['localDate'],
    });
    return loggingStreakDays(rows.map((r) => fromDbDate(r.localDate)), today);
  }
}

/** Mesma regra de `findTargetForDate`, aplicada em memoria: [effectiveFrom, effectiveTo). */
function targetFor(targets: readonly NutritionTarget[], date: string): NutritionTarget | undefined {
  let match: NutritionTarget | undefined;
  for (const t of targets) {
    const fromOk = fromDbDate(t.effectiveFrom) <= date;
    const toOk = t.effectiveTo === null || fromDbDate(t.effectiveTo) > date;
    if (fromOk && toOk) match = t; // ordenadas asc: a ultima que casa e a mais recente
  }
  return match ?? targets[0];
}

function toLogDto(row: ProgressLogRow): ProgressLog {
  return {
    id: row.id,
    metric: row.metric,
    value: row.value,
    measuredOn: fromDbDate(row.measuredOn),
    notes: row.notes,
  };
}
