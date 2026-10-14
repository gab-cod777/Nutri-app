import {
  createMealSchema,
  idParamSchema,
  listMealsQuerySchema,
  mealAnalysisResultSchema,
  mealListResponseSchema,
  mealSchema,
  scanPratoFieldsSchema,
  updateMealSchema,
} from '@nutrisnap/core';
import type { Router } from 'express';
import multer from 'multer';
import type { AppServices } from '../../app.js';
import { defineRoute } from '../../http/define-route.js';
import { perUser } from '../../http/rate-limit.js';

export function registerDiarioRoutes(router: Router, s: AppServices): void {
  // Foto em memoria (nao vai para disco nem e armazenada), com limite de tamanho.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: s.env.MAX_MEAL_PHOTO_BYTES, files: 1, fields: 4, fieldSize: 1024 },
  });

  /**
   * A rota magica do guia: o app manda a foto, a API repassa para o servico de
   * IA (Python) e devolve alimentos + macros. Nao salva no diario.
   */
  defineRoute(router, {
    method: 'post',
    path: '/scan-prato',
    body: scanPratoFieldsSchema,
    response: mealAnalysisResultSchema,
    middlewares: [perUser(s.env.RATE_LIMIT_SCAN_PER_MINUTE), upload.single('foto')],
    handler: ({ userId, body, req }) => s.scanPrato.scan(userId, req.file?.buffer, body),
  });

  // Salva o que o usuario confirmou (vindo do scan ou da busca manual).
  defineRoute(router, {
    method: 'post',
    path: '/diario',
    body: createMealSchema,
    response: mealSchema,
    status: 201,
    handler: ({ userId, body }) => s.diario.create(userId, body),
  });

  // Historico: `?date=YYYY-MM-DD` (um dia) ou `?from=&to=`. Paginado por cursor.
  defineRoute(router, {
    method: 'get',
    path: '/diario',
    query: listMealsQuerySchema,
    response: mealListResponseSchema,
    handler: ({ userId, query }) => s.diario.list(userId, query),
  });

  defineRoute(router, {
    method: 'get',
    path: '/diario/:id',
    params: idParamSchema,
    response: mealSchema,
    handler: ({ userId, params }) => s.diario.get(userId, params.id),
  });

  defineRoute(router, {
    method: 'put',
    path: '/diario/:id',
    params: idParamSchema,
    body: updateMealSchema,
    response: mealSchema,
    handler: ({ userId, params, body }) => s.diario.update(userId, params.id, body),
  });

  defineRoute(router, {
    method: 'delete',
    path: '/diario/:id',
    params: idParamSchema,
    response: null,
    handler: ({ userId, params }) => s.diario.delete(userId, params.id),
  });
}
