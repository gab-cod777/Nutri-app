import { createFoodSchema, foodSchema, foodSearchResponseSchema, idParamSchema, searchFoodQuerySchema } from '@nutrisnap/core';
import type { Router } from 'express';
import type { AppServices } from '../../app.js';
import { defineRoute } from '../../http/define-route.js';
import { perUser } from '../../http/rate-limit.js';

export function registerAlimentosRoutes(router: Router, s: AppServices): void {
  // Busca manual (fallback quando a IA erra). Dispara a cada tecla: limite por usuario.
  defineRoute(router, {
    method: 'get',
    path: '/alimentos',
    query: searchFoodQuerySchema,
    response: foodSearchResponseSchema,
    middlewares: [perUser(s.env.RATE_LIMIT_FOOD_SEARCH_PER_MINUTE)],
    handler: ({ userId, query }) => s.alimentos.search(userId, query),
  });

  defineRoute(router, {
    method: 'get',
    path: '/alimentos/:id',
    params: idParamSchema,
    response: foodSchema,
    handler: ({ userId, params }) => s.alimentos.get(userId, params.id),
  });

  // Alimento privado do usuario (visivel so para ele).
  defineRoute(router, {
    method: 'post',
    path: '/alimentos',
    body: createFoodSchema,
    response: foodSchema,
    status: 201,
    handler: ({ userId, body }) => s.alimentos.create(userId, body),
  });
}
