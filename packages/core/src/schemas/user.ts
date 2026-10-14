import { z } from 'zod';
import { nutritionTargetSchema } from './nutrition.js';
import { userProfileSchema } from './profile.js';

/**
 * Corpo de `POST /perfil` (onboarding).
 *
 * `healthDataConsent` e obrigatorio e literal `true`: peso, medidas e fotos de
 * refeicao sao dado pessoal sensivel (LGPD, art. 11). Sem consentimento
 * explicito o backend nao grava o perfil.
 */
export const onboardingRequestSchema = userProfileSchema.extend({
  healthDataConsent: z.literal(true, {
    errorMap: () => ({ message: 'O consentimento para tratamento de dados de saude e obrigatorio.' }),
  }),
});
export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;

/** Perfil como devolvido pela API. */
export const userProfileResponseSchema = userProfileSchema.extend({
  // Sem a regra de faixa etaria: um perfil gravado nao fica invalido ao envelhecer.
  birthDate: z.string().date(),
  onboardingCompletedAt: z.string().datetime().nullable(),
  healthDataConsentAt: z.string().datetime().nullable(),
});
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;

/** Resposta de `GET /perfil`, `POST /perfil` e `PUT /perfil`. */
export const meResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  profile: userProfileResponseSchema.nullable(),
  currentTarget: nutritionTargetSchema.nullable(),
  onboarding: z.object({
    completed: z.boolean(),
    completedAt: z.string().datetime().nullable(),
  }),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** Corpo de `POST /cadastro`. */
export const signUpRequestSchema = z.object({
  email: emailSchema,
  /** 8-128 caracteres. O limite superior evita custo abusivo no hash. */
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(128),
});
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;

/** Corpo de `POST /login`. */
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Resposta de `POST /cadastro` e `POST /login`. Guardar o token no SecureStore. */
export const authResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string(),
    onboardingCompleted: z.boolean(),
  }),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
