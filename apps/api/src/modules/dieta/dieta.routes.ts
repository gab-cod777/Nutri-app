import {
  dailySummaryQuerySchema,
  dailySummarySchema,
  energyPlanRequestSchema,
  energyPlanSchema,
  nutritionTargetSchema,
  toLocalDate,
} from '@nutrisnap/core';
import type { Router } from 'express';
import type { AppServices } from '../../app.js';
import { defineRoute } from '../../http/define-route.js';
import { notFound } from '../../lib/errors.js';
import { DEFAULT_TIMEZONE } from '../../lib/user-context.js';

/**
 * POST /calculo-fisico (guia): TMB + TDEE + meta + macros, sem efeito colateral.
 * Publica: e so matematica sobre os dados enviados - usada na previa do
 * onboarding, antes mesmo do cadastro.
 */
export function registerDietaPublicRoutes(router: Router, s: AppServices): void {
  defineRoute(router, {
    method: 'post',
    path: '/calculo-fisico',
    body: energyPlanRequestSchema,
    response: energyPlanSchema,
    handler: async ({ body }) => s.dieta.previewEnergyPlan(body, toLocalDate(s.now(), DEFAULT_TIMEZONE)),
  });
}

export function registerDietaRoutes(router: Router, s: AppServices): void {
  defineRoute(router, {
    method: 'get',
    path: '/dieta/meta',
    response: nutritionTargetSchema,
    handler: async ({ userId }) => {
      const target = await s.dieta.getCurrentTarget(userId);
      if (!target) throw notFound('Meta');
      return target;
    },
  });

  // Consumido, restante e por refeicao, comparado com a meta vigente NAQUELE dia.
  defineRoute(router, {
    method: 'get',
    path: '/dieta/resumo',
    query: dailySummaryQuerySchema,
    response: dailySummarySchema,
    handler: ({ query, userId }) => s.dieta.getDailySummary(userId, query.date),
  });
}
