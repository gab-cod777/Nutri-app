import {
  generateMealPlanRequestSchema,
  mealPlanSchema,
  swapMealRequestSchema,
  updateMealPlanItemSchema,
} from '@nutrisnap/core';
import type { Router } from 'express';
import { z } from 'zod';
import type { AppServices } from '../../app.js';
import { defineRoute } from '../../http/define-route.js';

const mealParams = z.object({ mealId: z.string().uuid() });
const itemParams = z.object({ itemId: z.string().uuid() });

export function registerPlanoAlimentarRoutes(router: Router, s: AppServices): void {
  defineRoute(router, {
    method: 'post',
    path: '/plano-alimentar/gerar',
    body: generateMealPlanRequestSchema,
    response: mealPlanSchema,
    status: 201,
    handler: ({ userId, body }) => s.planoAlimentar.generate(userId, body),
  });

  defineRoute(router, {
    method: 'get',
    path: '/plano-alimentar',
    response: mealPlanSchema,
    handler: ({ userId }) => s.planoAlimentar.current(userId),
  });

  defineRoute(router, {
    method: 'post',
    path: '/plano-alimentar/refeicoes/:mealId/trocar',
    params: mealParams,
    body: swapMealRequestSchema,
    response: mealPlanSchema,
    handler: ({ userId, params, body }) => s.planoAlimentar.swapMeal(userId, params.mealId, body),
  });

  defineRoute(router, {
    method: 'put',
    path: '/plano-alimentar/itens/:itemId',
    params: itemParams,
    body: updateMealPlanItemSchema,
    response: mealPlanSchema,
    handler: ({ userId, params, body }) => s.planoAlimentar.updateItem(userId, params.itemId, body),
  });
}
