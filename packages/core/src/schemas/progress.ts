import { z } from 'zod';
import { progressMetricSchema } from './enums.js';

/** Um registro de medida corporal. */
export const progressLogSchema = z.object({
  id: z.string().uuid(),
  metric: progressMetricSchema,
  value: z.number().positive().max(500),
  /** Dia da medicao (nao datetime): peso e medida diaria, nao instantanea. */
  measuredOn: z.string().date(),
  notes: z.string().trim().max(300).nullish(),
});
export type ProgressLog = z.infer<typeof progressLogSchema>;

export const createProgressLogSchema = progressLogSchema.omit({ id: true });
export type CreateProgressLogInput = z.infer<typeof createProgressLogSchema>;

export const progressQuerySchema = z.object({
  metric: progressMetricSchema.optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  /** Agregacao do grafico. 'week' suaviza a oscilacao diaria de agua. */
  granularity: z.enum(['day', 'week']).default('week'),
});
export type ProgressQuery = z.infer<typeof progressQuerySchema>;

/** Resposta de `GET /progresso`: series temporais + indicadores de aderencia. */
export const progressOverviewSchema = z.object({
  weightSeries: z.array(z.object({ date: z.string(), value: z.number() })),
  /** Media movel de 7 dias - o numero que o usuario deve olhar, nao o peso do dia. */
  weightTrendSeries: z.array(z.object({ date: z.string(), value: z.number() })),
  calorieSeries: z.array(
    z.object({ date: z.string(), consumed: z.number(), target: z.number() }),
  ),
  /** % de dias com registro dentro de +/-10% da meta calorica. */
  calorieAdherencePercent: z.number().min(0).max(100),
  /** % de treinos concluidos sobre os planejados no periodo. */
  workoutAdherencePercent: z.number().min(0).max(100),
  /** Dias consecutivos com pelo menos uma refeicao registrada. */
  loggingStreakDays: z.number().int().nonnegative(),
  weightChangeKg: z.number(),
});
export type ProgressOverview = z.infer<typeof progressOverviewSchema>;
