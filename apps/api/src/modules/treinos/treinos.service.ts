import {
  computeTrainingVolume,
  DISCLAIMERS,
  generateWorkoutPlan,
  nextTrainingDay,
  startOfIsoWeek,
  toLocalDate,
  weekdayOf,
  workoutIndexForDate,
  WORKOUT_GENERATOR_VERSION,
  type CompleteWorkoutInput,
  type GenerateWorkoutPlanRequest,
  type LastExerciseLog,
  type LogExerciseInput,
  type TreinoDiaResponse,
  type WorkoutDetail,
  type WorkoutLog,
  type WorkoutLogListResponse,
  type WorkoutLogsQuery,
  type WorkoutPlan,
  type WorkoutStatus,
} from '@nutrisnap/core';
import { Prisma, type PrismaClient } from '@prisma/client';
import { decodeCursor, encodeCursor, keysetCursorSchema } from '../../lib/cursor.js';
import { fromDbDate, toDbDate } from '../../lib/db-dates.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { getUserTimezone, requireProfile } from '../../lib/user-context.js';
import type { TreinosRepository, WorkoutFull, WorkoutLogFull, WorkoutPlanFull } from './treinos.repository.js';

/**
 * Treinos (tabela "Treinos" do guia): rotinas recomendadas pelo app e sua
 * execucao. O plano e montado pelas regras de `generateWorkoutPlan` do core
 * a partir do perfil e do catalogo de exercicios - na hora, sem chamada externa.
 */
export class TreinosService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly repo: TreinosRepository,
    private readonly now: () => Date,
  ) {}

  async generatePlan(userId: string, input: GenerateWorkoutPlanRequest): Promise<WorkoutPlan> {
    const profile = await requireProfile(this.prisma, userId);
    if (profile.trainingDaysPerWeek < 1) {
      throw unprocessable('no_training_days', 'Informe ao menos 1 dia de treino por semana no perfil.');
    }
    if (!input.force && (await this.repo.findActivePlan(userId))) {
      throw conflict('active_plan_exists', 'Ja existe um plano de treino ativo. Envie force: true para gerar outro.');
    }

    const catalog = await this.prisma.exercise.findMany({ orderBy: { canonicalName: 'asc' } });
    const generated = generateWorkoutPlan({
      daysPerWeek: profile.trainingDaysPerWeek,
      experience: profile.experience,
      goal: profile.goal,
      sessionDurationMinutes: profile.sessionDurationMinutes,
      availableEquipment: profile.availableEquipment,
      catalog,
    });
    const idByName = new Map(catalog.map((e) => [e.canonicalName, e.id]));
    const today = toLocalDate(this.now(), profile.timezone);

    await this.prisma.$transaction(async (tx) => {
      await tx.workoutPlan.updateMany({ where: { userId, status: 'active' }, data: { status: 'archived' } });
      await tx.workoutPlan.create({
        data: {
          userId,
          name: generated.name,
          split: generated.split.slice(0, 40),
          daysPerWeek: profile.trainingDaysPerWeek,
          status: 'active',
          startsOn: toDbDate(startOfIsoWeek(today)),
          rationale: generated.rationale.slice(0, 500),
          generatorVersion: WORKOUT_GENERATOR_VERSION,
          workouts: {
            create: generated.workouts.map((w) => ({
              name: w.name,
              dayIndex: w.dayIndex,
              focusMuscles: w.focusMuscles,
              estimatedDurationMinutes: w.estimatedDurationMinutes,
              exercises: {
                create: w.exercises.map((ex, order) => ({
                  exerciseId: idByName.get(ex.canonicalName)!,
                  order,
                  sets: ex.sets,
                  repsMin: ex.repsMin,
                  repsMax: ex.repsMax,
                  restSeconds: ex.restSeconds,
                })),
              },
            })),
          },
        },
      });
    });
    return this.currentPlan(userId);
  }

  async currentPlan(userId: string): Promise<WorkoutPlan> {
    const active = await this.repo.findActivePlan(userId);
    if (!active) throw notFound('Plano de treino');
    return this.toPlanDto(userId, active);
  }

  /** GET /treino-dia (guia): o treino agendado para hoje, ou descanso + proximo treino. */
  async treinoDoDia(userId: string): Promise<TreinoDiaResponse> {
    const plan = await this.repo.findActivePlan(userId);
    if (!plan) throw notFound('Plano de treino');
    const timezone = await getUserTimezone(this.prisma, userId);
    const today = toLocalDate(this.now(), timezone);
    const byIndex = new Map(plan.workouts.map((w) => [w.dayIndex, w]));

    const index = workoutIndexForDate(plan.daysPerWeek, today);
    const workout = index === null ? undefined : byIndex.get(index);
    const next = nextTrainingDay(plan.daysPerWeek, today);
    const nextWorkout = byIndex.get(next.workoutIndex);

    return {
      date: today,
      weekday: weekdayOf(today),
      isRestDay: !workout,
      workout: workout ? await this.getWorkout(userId, workout.id) : null,
      nextWorkout: nextWorkout ? { workoutId: nextWorkout.id, name: nextWorkout.name, date: next.date } : null,
      disclaimer: DISCLAIMERS.workoutPlan,
    };
  }

  async getWorkout(userId: string, workoutId: string): Promise<WorkoutDetail> {
    const workout = await this.repo.findWorkout(userId, workoutId);
    if (!workout) throw notFound('Treino');

    const exerciseIds = [...new Set(workout.exercises.map((e) => e.exerciseId))];
    const recent = await this.repo.findRecentExerciseLogs(userId, exerciseIds);
    const lastLogs: LastExerciseLog[] = [];
    const seen = new Set<string>();
    for (const log of recent) {
      const exerciseId = log.workoutExercise.exerciseId;
      if (seen.has(exerciseId) || log.sets.length === 0) continue;
      seen.add(exerciseId);
      lastLogs.push({
        exerciseId,
        performedOn: fromDbDate(log.workoutLog.localDate),
        sets: log.sets.map(toSetDto),
      });
    }

    const inProgress = await this.repo.findInProgressLog(userId);
    const statuses = await this.statusesFor(userId, [workout.id]);
    return {
      ...toWorkoutDto(workout, statuses.get(workout.id) ?? 'scheduled'),
      lastLogs,
      activeLogId: inProgress?.workoutId === workout.id ? inProgress.id : null,
    };
  }

  /** Abre uma execucao. No maximo uma em andamento por usuario (409). */
  async start(userId: string, workoutId: string): Promise<WorkoutLog> {
    const workout = await this.repo.findWorkout(userId, workoutId);
    if (!workout) throw notFound('Treino');
    const open = await this.repo.findInProgressLog(userId);
    if (open) {
      throw conflict('workout_in_progress', 'Ja existe um treino em andamento.', { workoutLogId: open.id });
    }
    const now = this.now();
    const timezone = await getUserTimezone(this.prisma, userId);
    try {
      const log = await this.prisma.workoutLog.create({
        data: {
          userId,
          workoutId,
          status: 'in_progress',
          startedAt: now,
          localDate: toDbDate(toLocalDate(now, timezone)),
        },
      });
      return this.requireLogDto(userId, log.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('workout_in_progress', 'Ja existe um treino em andamento.');
      }
      throw error;
    }
  }

  async complete(userId: string, workoutId: string, input: CompleteWorkoutInput): Promise<WorkoutLog> {
    const workout = await this.repo.findWorkout(userId, workoutId);
    if (!workout) throw notFound('Treino');
    const open = await this.repo.findInProgressLog(userId);
    if (!open || open.workoutId !== workoutId) {
      throw conflict('workout_not_started', 'Este treino nao esta em andamento.');
    }
    const sets = await this.prisma.setLog.findMany({ where: { exerciseLog: { workoutLogId: open.id } } });
    await this.prisma.workoutLog.update({
      where: { id: open.id },
      data: {
        status: 'completed',
        completedAt: this.now(),
        durationSeconds: input.durationSeconds,
        perceivedEffort: input.perceivedEffort ?? null,
        notes: input.notes ?? null,
        totalVolumeKg: computeTrainingVolume(sets),
      },
    });
    return this.requireLogDto(userId, open.id);
  }

  /**
   * Registra as series de um exercicio. Idempotente por (workoutLogId,
   * workoutExerciseId): reenviar o mesmo payload (sinal ruim na academia)
   * substitui as series em vez de duplicar.
   */
  async logExercise(userId: string, workoutExerciseId: string, input: LogExerciseInput): Promise<WorkoutLog> {
    if (input.workoutExerciseId !== workoutExerciseId) {
      throw unprocessable('id_mismatch', 'workoutExerciseId do corpo difere do da rota.');
    }
    const setNumbers = input.sets.map((s) => s.setNumber);
    if (new Set(setNumbers).size !== setNumbers.length) {
      throw unprocessable('duplicate_set_number', 'Cada serie deve ter um setNumber distinto.');
    }
    const log = await this.prisma.workoutLog.findFirst({ where: { id: input.workoutLogId, userId } });
    if (!log) throw notFound('Execucao de treino');
    if (log.status !== 'in_progress' && log.status !== 'completed') {
      throw conflict('workout_not_active', 'Esta execucao nao aceita mais registros.');
    }
    const exercise = await this.prisma.workoutExercise.findFirst({
      where: { id: workoutExerciseId, workoutId: log.workoutId },
    });
    if (!exercise) throw notFound('Exercicio do treino');

    const now = this.now();
    await this.prisma.$transaction(async (tx) => {
      const exerciseLog = await tx.exerciseLog.upsert({
        where: { workoutLogId_workoutExerciseId: { workoutLogId: log.id, workoutExerciseId } },
        create: { workoutLogId: log.id, workoutExerciseId, completedAt: now, notes: input.notes ?? null },
        update: { completedAt: now, notes: input.notes ?? null },
      });
      await tx.setLog.deleteMany({ where: { exerciseLogId: exerciseLog.id } });
      await tx.setLog.createMany({
        data: input.sets.map((s) => ({
          exerciseLogId: exerciseLog.id,
          setNumber: s.setNumber,
          reps: s.reps,
          loadKg: s.loadKg,
          rir: s.rir ?? null,
          isWarmup: s.isWarmup,
        })),
      });
      if (log.status === 'completed') {
        // Reenvio depois de concluir: mantem o volume total coerente.
        const sets = await tx.setLog.findMany({ where: { exerciseLog: { workoutLogId: log.id } } });
        await tx.workoutLog.update({ where: { id: log.id }, data: { totalVolumeKg: computeTrainingVolume(sets) } });
      }
    });
    return this.requireLogDto(userId, log.id);
  }

  async listLogs(userId: string, query: WorkoutLogsQuery): Promise<WorkoutLogListResponse> {
    const cursor = decodeCursor(query.cursor, keysetCursorSchema);
    const where: Prisma.WorkoutLogWhereInput =
      query.from || query.to
        ? {
            localDate: {
              ...(query.from ? { gte: toDbDate(query.from) } : {}),
              ...(query.to ? { lte: toDbDate(query.to) } : {}),
            },
          }
        : {};
    const rows = await this.repo.listLogs({
      userId,
      where,
      cursor: cursor ? { t: new Date(cursor.t), id: cursor.id } : null,
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    return {
      items: items.map(toLogDto),
      nextCursor:
        rows.length > query.limit && last ? encodeCursor({ t: last.startedAt.toISOString(), id: last.id }) : null,
    };
  }

  /** Status derivado: em andamento, concluido nesta semana ou agendado. */
  private async statusesFor(userId: string, workoutIds: readonly string[]): Promise<Map<string, WorkoutStatus>> {
    const timezone = await getUserTimezone(this.prisma, userId);
    const weekStart = startOfIsoWeek(toLocalDate(this.now(), timezone));
    const logs = await this.repo.findWorkoutStatuses(userId, workoutIds, toDbDate(weekStart));
    const result = new Map<string, WorkoutStatus>();
    for (const log of logs) {
      if (log.status === 'in_progress') result.set(log.workoutId, 'in_progress');
      else if (!result.has(log.workoutId)) result.set(log.workoutId, 'completed');
    }
    return result;
  }

  private async toPlanDto(userId: string, plan: WorkoutPlanFull): Promise<WorkoutPlan> {
    const statuses = await this.statusesFor(userId, plan.workouts.map((w) => w.id));
    return {
      id: plan.id,
      name: plan.name,
      daysPerWeek: plan.daysPerWeek,
      split: plan.split,
      status: plan.status,
      startsOn: fromDbDate(plan.startsOn),
      workouts: plan.workouts.map((w) => toWorkoutDto(w, statuses.get(w.id) ?? 'scheduled')),
      disclaimer: DISCLAIMERS.workoutPlan,
    };
  }

  private async requireLogDto(userId: string, logId: string): Promise<WorkoutLog> {
    const log = await this.repo.findLog(userId, logId);
    if (!log) throw notFound('Execucao de treino');
    return toLogDto(log);
  }
}

function toSetDto(s: { setNumber: number; reps: number; loadKg: number; rir: number | null; isWarmup: boolean }) {
  return { setNumber: s.setNumber, reps: s.reps, loadKg: s.loadKg, rir: s.rir, isWarmup: s.isWarmup };
}

function toWorkoutDto(workout: WorkoutFull, status: WorkoutStatus) {
  return {
    id: workout.id,
    planId: workout.planId,
    name: workout.name,
    dayIndex: workout.dayIndex,
    focusMuscles: workout.focusMuscles,
    estimatedDurationMinutes: workout.estimatedDurationMinutes,
    status,
    exercises: workout.exercises.map((we) => ({
      id: we.id,
      exerciseId: we.exerciseId,
      exercise: {
        id: we.exercise.id,
        name: we.exercise.name,
        canonicalName: we.exercise.canonicalName,
        primaryMuscle: we.exercise.primaryMuscle,
        secondaryMuscles: we.exercise.secondaryMuscles,
        requiredEquipment: we.exercise.requiredEquipment,
        instructions: we.exercise.instructions,
        commonMistakes: we.exercise.commonMistakes,
        isCompound: we.exercise.isCompound,
        difficultyLevel: we.exercise.difficultyLevel,
        demoVideoUrl: we.exercise.demoVideoUrl,
      },
      order: we.order,
      sets: we.sets,
      repsMin: we.repsMin,
      repsMax: we.repsMax,
      restSeconds: we.restSeconds,
      suggestedLoadKg: we.suggestedLoadKg,
      notes: we.notes,
    })),
  };
}

function toLogDto(log: WorkoutLogFull): WorkoutLog {
  return {
    id: log.id,
    workoutId: log.workoutId,
    workoutName: log.workout.name,
    status: log.status,
    startedAt: log.startedAt.toISOString(),
    completedAt: log.completedAt?.toISOString() ?? null,
    localDate: fromDbDate(log.localDate),
    durationSeconds: log.durationSeconds,
    perceivedEffort: log.perceivedEffort,
    notes: log.notes,
    totalVolumeKg: log.totalVolumeKg,
    exercises: [...log.exerciseLogs]
      .sort((a, b) => a.workoutExercise.order - b.workoutExercise.order)
      .map((el) => ({
        workoutExerciseId: el.workoutExerciseId,
        exerciseId: el.workoutExercise.exerciseId,
        completedAt: el.completedAt?.toISOString() ?? null,
        notes: el.notes,
        sets: el.sets.map(toSetDto),
      })),
  };
}
