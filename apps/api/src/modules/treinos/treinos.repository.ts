import type { Prisma, PrismaClient } from '@prisma/client';

export const workoutPlanInclude = {
  workouts: {
    orderBy: { dayIndex: 'asc' },
    include: { exercises: { orderBy: { order: 'asc' }, include: { exercise: true } } },
  },
} satisfies Prisma.WorkoutPlanInclude;
export type WorkoutPlanFull = Prisma.WorkoutPlanGetPayload<{ include: typeof workoutPlanInclude }>;

export const workoutInclude = {
  exercises: { orderBy: { order: 'asc' }, include: { exercise: true } },
} satisfies Prisma.WorkoutInclude;
export type WorkoutFull = Prisma.WorkoutGetPayload<{ include: typeof workoutInclude }>;

export const workoutLogInclude = {
  workout: { select: { name: true } },
  exerciseLogs: {
    include: { sets: { orderBy: { setNumber: 'asc' } }, workoutExercise: { select: { exerciseId: true, order: true } } },
  },
} satisfies Prisma.WorkoutLogInclude;
export type WorkoutLogFull = Prisma.WorkoutLogGetPayload<{ include: typeof workoutLogInclude }>;

/** Unico ponto que toca planos, treinos e logs de treino. Tudo filtrado por `userId`. */
export class TreinosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findActivePlan(userId: string): Promise<WorkoutPlanFull | null> {
    return this.prisma.workoutPlan.findFirst({ where: { userId, status: 'active' }, include: workoutPlanInclude });
  }





  /** Treino de um plano do usuario (ativo ou arquivado - o historico continua acessivel). */
  findWorkout(userId: string, workoutId: string): Promise<WorkoutFull | null> {
    return this.prisma.workout.findFirst({ where: { id: workoutId, plan: { userId } }, include: workoutInclude });
  }

  findInProgressLog(userId: string) {
    return this.prisma.workoutLog.findFirst({ where: { userId, status: 'in_progress' } });
  }

  findLog(userId: string, logId: string): Promise<WorkoutLogFull | null> {
    return this.prisma.workoutLog.findFirst({ where: { id: logId, userId }, include: workoutLogInclude });
  }

  /** Ultimas series concluidas de cada exercicio (por exerciseId, em qualquer treino). */
  findRecentExerciseLogs(userId: string, exerciseIds: readonly string[]) {
    return this.prisma.exerciseLog.findMany({
      where: {
        workoutLog: { userId, status: 'completed' },
        workoutExercise: { exerciseId: { in: [...exerciseIds] } },
      },
      orderBy: { workoutLog: { startedAt: 'desc' } },
      take: 200,
      include: {
        sets: { orderBy: { setNumber: 'asc' } },
        workoutExercise: { select: { exerciseId: true } },
        workoutLog: { select: { localDate: true } },
      },
    });
  }

  listLogs(params: {
    userId: string;
    where: Prisma.WorkoutLogWhereInput;
    cursor: { t: Date; id: string } | null;
    take: number;
  }): Promise<WorkoutLogFull[]> {
    const keyset: Prisma.WorkoutLogWhereInput = params.cursor
      ? {
          OR: [
            { startedAt: { lt: params.cursor.t } },
            { startedAt: params.cursor.t, id: { lt: params.cursor.id } },
          ],
        }
      : {};
    return this.prisma.workoutLog.findMany({
      where: { AND: [{ userId: params.userId }, params.where, keyset] },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: params.take,
      include: workoutLogInclude,
    });
  }

  findWorkoutStatuses(userId: string, workoutIds: readonly string[], since: Date) {
    return this.prisma.workoutLog.findMany({
      where: {
        userId,
        workoutId: { in: [...workoutIds] },
        OR: [{ status: 'in_progress' }, { status: 'completed', localDate: { gte: since } }],
      },
      select: { workoutId: true, status: true },
    });
  }
}
