import { authResponseSchema, loginRequestSchema, signUpRequestSchema } from '@nutrisnap/core';
import type { Router } from 'express';
import type { AppServices } from '../../app.js';
import { defineRoute } from '../../http/define-route.js';
import { perIp } from '../../http/rate-limit.js';

/** Rotas publicas de autenticacao. */
export function registerAuthPublicRoutes(router: Router, s: AppServices): void {
  const authLimit = perIp(s.env.RATE_LIMIT_AUTH_PER_MINUTE);

  defineRoute(router, {
    method: 'post',
    path: '/cadastro',
    body: signUpRequestSchema,
    response: authResponseSchema,
    status: 201,
    middlewares: [authLimit],
    handler: ({ body }) => s.auth.signUp(body),
  });

  defineRoute(router, {
    method: 'post',
    path: '/login',
    body: loginRequestSchema,
    response: authResponseSchema,
    middlewares: [authLimit],
    handler: ({ body }) => s.auth.login(body),
  });
}

export function registerAuthPrivateRoutes(router: Router, s: AppServices): void {
  defineRoute(router, {
    method: 'post',
    path: '/logout',
    response: null,
    handler: ({ userId }) => s.auth.logout(userId),
  });
}
