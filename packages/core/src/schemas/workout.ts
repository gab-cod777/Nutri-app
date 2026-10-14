import { z } from 'zod';
import { equipmentSchema, muscleGroupSchema, planStatusSchema, workoutStatusSchema } from './enums.js';

/** Exercicio no catalogo. Curado por nos - a IA seleciona, nao inventa. */
export const exerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  canonicalName: z.string().regex(/^[a-z0-9_]+$/).max(60),
  primaryMuscle: muscleGroupSchema,
  secondaryMuscles: z.array(muscleGroupSchema).max(4).default([]),
  requiredEquipment: z.array(equipmentSchema).min(1).max(4),
  /** Instrucoes de execucao, passo a passo. */
  instructions: z.array(z.string().trim().min(5).max(300)).max(8).default([]),
  /** Erros comuns. Exibidos na tela de execucao. */
  commonMistakes: z.array(z.string().trim().min(5).max(200)).max(5).default([]),
  isCompound: z.boolean(),
  difficultyLevel: z.number().int().min(1).max(3),
  demoVideoUrl: z.string().url().nullish(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

/** Prescricao de um exercicio dentro de um treino. */
export const workoutExerciseSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
  exercise: exerciseSchema.optional(),
  order: z.number().int().min(0).max(30),
  sets: z.number().int().min(1).max(10),
  repsMin: z.number().int().min(1).max(100),
  repsMax: z.number().int().min(1).max(100),
  restSeconds: z.number().int().min(0).max(600),
  /** Carga sugerida em kg. Nula na primeira execucao - o usuario define. */
  suggestedLoadKg: z.number().min(0).max(500).nullish(),
  notes: z.string().trim().max(200).nullish(),
});
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;

/** Uma sessao de treino ("Treino A - Peito e Triceps"). */
export const workoutSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  /** Posicao no ciclo semanal (0 = primeiro treino da semana). */
  dayIndex: z.number().int().min(0).max(6),
  focusMuscles: z.array(muscleGroupSchema).min(1).max(5),
  estimatedDurationMinutes: z.number().int().min(10).max(180),
  status: workoutStatusSchema.default('scheduled'),
  exercises: z.array(workoutExerciseSchema).min(1).max(15),
});
export type Workout = z.infer<typeof workoutSchema>;

export const workoutPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  daysPerWeek: z.number().int().min(1).max(7),
  /** Divisao usada: full body, upper/lower, push/pull/legs... */
  split: z.string().trim().max(40),
  status: planStatusSchema,
  startsOn: z.string().date(),
  workouts: z.array(workoutSchema).min(1).max(7),
  disclaimer: z.string(),
});
export type WorkoutPlan = z.infer<typeof workoutPlanSchema>;

/** Uma serie executada. */
export const setLogSchema = z.object({
  setNumber: z.number().int().min(1).max(20),
  reps: z.number().int().min(0).max(200),
  loadKg: z.number().min(0).max(500).default(0),
  /** Repeticoes em reserva (RIR). Base da progressao automatica. */
  rir: z.number().int().min(0).max(10).nullish(),
  isWarmup: z.boolean().default(false),
});
export type SetLog = z.infer<typeof setLogSchema>;

export const logExerciseSchema = z.object({
  workoutLogId: z.string().uuid(),
  workoutExerciseId: z.string().uuid(),
  sets: z.array(setLogSchema).min(1).max(20),
  notes: z.string().trim().max(200).nullish(),
});
export type LogExerciseInput = z.infer<typeof logExerciseSchema>;

export const completeWorkoutSchema = z.object({
  durationSeconds: z.number().int().min(0).max(36000),
  perceivedEffort: z.number().int().min(1).max(10).nullish(),
  notes: z.string().trim().max(500).nullish(),
});
export type CompleteWorkoutInput = z.infer<typeof completeWorkoutSchema>;

/** Corpo de `POST /treinos/gerar`. O plano e montado por regras do core, na hora. */
export const generateWorkoutPlanRequestSchema = z.object({
  /** Substitui o plano ativo (o anterior e arquivado). */
  force: z.boolean().default(false),
});
export type GenerateWorkoutPlanRequest = z.infer<typeof generateWorkoutPlanRequestSchema>;

/** Ultima execucao de um exercicio, para sugerir carga na proxima. */
export const lastExerciseLogSchema = z.object({
  exerciseId: z.string().uuid(),
  performedOn: z.string().date(),
  sets: z.array(setLogSchema),
});
export type LastExerciseLog = z.infer<typeof lastExerciseLogSchema>;

/** Resposta de `GET /treinos/:id`: prescricao + historico recente por exercicio. */
export const workoutDetailSchema = workoutSchema.extend({
  lastLogs: z.array(lastExerciseLogSchema),
  /** Execucao em andamento deste treino, se houver. */
  activeLogId: z.string().uuid().nullable(),
});
export type WorkoutDetail = z.infer<typeof workoutDetailSchema>;

/** Uma execucao de treino (`WorkoutLog`) com as series registradas. */
export const workoutLogSchema = z.object({
  id: z.string().uuid(),
  workoutId: z.string().uuid(),
  workoutName: z.string(),
  status: workoutStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  localDate: z.string().date(),
  durationSeconds: z.number().int().nullable(),
  perceivedEffort: z.number().int().nullable(),
  notes: z.string().nullable(),
  totalVolumeKg: z.number(),
  exercises: z.array(
    z.object({
      workoutExerciseId: z.string().uuid(),
      exerciseId: z.string().uuid(),
      completedAt: z.string().datetime().nullable(),
      notes: z.string().nullable(),
      sets: z.array(setLogSchema),
    }),
  ),
});
export type WorkoutLog = z.infer<typeof workoutLogSchema>;

/** Query de `GET /treinos/historico`. */
export const workoutLogsQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});
export type WorkoutLogsQuery = z.infer<typeof workoutLogsQuerySchema>;

export const workoutLogListResponseSchema = z.object({
  items: z.array(workoutLogSchema),
  nextCursor: z.string().nullable(),
});
export type WorkoutLogListResponse = z.infer<typeof workoutLogListResponseSchema>;

/** Resposta de `GET /treino-dia`: o treino agendado para hoje (ou descanso). */
export const treinoDiaResponseSchema = z.object({
  date: z.string().date(),
  /** 0 = segunda-feira. */
  weekday: z.number().int().min(0).max(6),
  isRestDay: z.boolean(),
  workout: workoutDetailSchema.nullable(),
  /** Proximo treino agendado (util em dia de descanso). */
  nextWorkout: z
    .object({ workoutId: z.string().uuid(), name: z.string(), date: z.string().date() })
    .nullable(),
  disclaimer: z.string(),
});
export type TreinoDiaResponse = z.infer<typeof treinoDiaResponseSchema>;
