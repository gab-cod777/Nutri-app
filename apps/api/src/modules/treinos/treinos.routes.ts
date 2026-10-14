import {
  completeWorkoutSchema,
  generateWorkoutPlanRequestSchema,
  idParamSchema,
  logExerciseSchema,
  treinoDiaResponseSchema,
  workoutDetailSchema,
  workoutLogListResponseSchema,
  workoutLogSchema,
  workoutLogsQuerySchema,
  workoutPlanSchema,
} from '@nutrisnap/core';
import type { Router } from 'express';
import { z } from 'zod';
import type { AppServices } from '../../app.js';
import { defineRoute } from '../../http/define-route.js';

const workoutExerciseParams = z.object({ workoutExerciseId: z.string().uuid() });

export function registerTreinosRoutes(router: Router, s: AppServices): void {
  // Treino do dia (guia): agendado para hoje pelo plano ativo, ou descanso.
  defineRoute(router, {
    method: 'get',
    path: '/treino-dia',
    response: treinoDiaResponseSchema,
    handler: ({ userId }) => s.treinos.treinoDoDia(userId),
  });

  defineRoute(router, {
    method: 'post',
    path: '/treinos/gerar',
    body: generateWorkoutPlanRequestSchema,
    response: workoutPlanSchema,
    status: 201,
    handler: ({ userId, body }) => s.treinos.generatePlan(userId, body),
  });

  defineRoute(router, {
    method: 'get',
    path: '/treinos/plano',
    response: workoutPlanSchema,
    handler: ({ userId }) => s.treinos.currentPlan(userId),
  });

  // Historico de treinos executados. Declarado antes de /treinos/:id.
  defineRoute(router, {
    method: 'get',
    path: '/treinos/historico',
    query: workoutLogsQuerySchema,
    response: workoutLogListResponseSchema,
    handler: ({ userId, query }) => s.treinos.listLogs(userId, query),
  });

  defineRoute(router, {
    method: 'get',
    path: '/treinos/:id',
    params: idParamSchema,
    response: workoutDetailSchema,
    handler: ({ userId, params }) => s.treinos.getWorkout(userId, params.id),
  });

  defineRoute(router, {
    method: 'post',
    path: '/treinos/:id/iniciar',
    params: idParamSchema,
    response: workoutLogSchema,
    status: 201,
    handler: ({ userId, params }) => s.treinos.start(userId, params.id),
  });

  defineRoute(router, {
    method: 'post',
    path: '/treinos/:id/concluir',
    params: idParamSchema,
    body: completeWorkoutSchema,
    response: workoutLogSchema,
    handler: ({ userId, params, body }) => s.treinos.complete(userId, params.id, body),
  });

  // Registra as series de um exercicio. Idempotente: reenvio substitui, nao duplica.
  defineRoute(router, {
    method: 'post',
    path: '/treinos/exercicios/:workoutExerciseId/registro',
    params: workoutExerciseParams,
    body: logExerciseSchema,
    response: workoutLogSchema,
    handler: ({ userId, params, body }) => s.treinos.logExercise(userId, params.workoutExerciseId, body),
  });
}
