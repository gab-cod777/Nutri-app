import { meResponseSchema, onboardingRequestSchema, updateUserProfileSchema } from '@nutrisnap/core';
import type { Router } from 'express';
import type { AppServices } from '../../app.js';
import { defineRoute } from '../../http/define-route.js';

export function registerPerfilRoutes(router: Router, s: AppServices): void {
  defineRoute(router, {
    method: 'get',
    path: '/perfil',
    response: meResponseSchema,
    handler: ({ userId }) => s.perfil.getMe(userId),
  });

  // Onboarding: perfil completo + consentimento LGPD; calcula e grava a primeira meta.
  defineRoute(router, {
    method: 'post',
    path: '/perfil',
    body: onboardingRequestSchema,
    response: meResponseSchema,
    handler: ({ userId, body }) => s.perfil.completeOnboarding(userId, body),
  });

  // Atualizacao parcial. Mudar peso/objetivo/atividade cria uma nova meta.
  defineRoute(router, {
    method: 'put',
    path: '/perfil',
    body: updateUserProfileSchema,
    response: meResponseSchema,
    handler: ({ userId, body }) => s.perfil.updateProfile(userId, body),
  });

  // Exclusao de conta (LGPD): apaga todos os dados.
  defineRoute(router, {
    method: 'delete',
    path: '/perfil',
    response: null,
    handler: ({ userId }) => s.perfil.deleteAccount(userId),
  });
}
