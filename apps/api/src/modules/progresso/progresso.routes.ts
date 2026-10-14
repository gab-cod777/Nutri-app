import { createProgressLogSchema, idParamSchema, progressLogSchema, progressOverviewSchema, progressQuerySchema } from '@nutrisnap/core';
import type { Router } from 'express';
import type { AppServices } from '../../app.js';
import { defineRoute } from '../../http/define-route.js';

export function registerProgressoRoutes(router: Router, s: AppServices): void {
  // Peso (com media movel de 7 dias), calorias x meta, aderencia e streak.
  defineRoute(router, {
    method: 'get',
    path: '/progresso',
    query: progressQuerySchema,
    response: progressOverviewSchema,
    handler: ({ userId, query }) => s.progresso.overview(userId, query),
  });

  // Upsert por (metrica, dia): repesar no mesmo dia substitui.
  defineRoute(router, {
    method: 'post',
    path: '/progresso/medidas',
    body: createProgressLogSchema,
    response: progressLogSchema,
    handler: ({ userId, body }) => s.progresso.upsertLog(userId, body),
  });

  defineRoute(router, {
    method: 'delete',
    path: '/progresso/medidas/:id',
    params: idParamSchema,
    response: null,
    handler: ({ userId, params }) => s.progresso.deleteLog(userId, params.id),
  });
}
