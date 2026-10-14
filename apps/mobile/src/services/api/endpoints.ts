import {
  authResponseSchema,
  dailySummarySchema,
  energyPlanSchema,
  foodSearchResponseSchema,
  mealAnalysisResultSchema,
  mealListResponseSchema,
  mealPlanSchema,
  mealSchema,
  meResponseSchema,
  nutritionTargetSchema,
  treinoDiaResponseSchema,
  workoutLogSchema,
  workoutPlanSchema,
  type CreateMealInput,
  type EnergyPlanRequest,
  type MealType,
  type OnboardingRequest,
  type SetLog,
  type UpdateMealInput,
  type UpdateUserProfileInput,
} from '@nutrisnap/core';

import { Platform } from 'react-native';

import { apiRequest } from './client';

import { File } from 'expo-file-system';

/**
 * Uma funcao por rota da API (docs/03-api.md). As telas usam isto via
 * TanStack Query (`queries.ts`); nao chamam `apiRequest` direto.
 */

// --- Sessao -----------------------------------------------------------------
export const authApi = {
  signUp: (email: string, password: string) =>
    apiRequest('/cadastro', { method: 'POST', auth: false, body: { email, password }, schema: authResponseSchema }),
  login: (email: string, password: string) =>
    apiRequest('/login', { method: 'POST', auth: false, body: { email, password }, schema: authResponseSchema }),
  logout: () => apiRequest('/logout', { method: 'POST' }),
};

// --- Perfil e dieta ---------------------------------------------------------
export const perfilApi = {
  get: () => apiRequest('/perfil', { schema: meResponseSchema }),
  onboarding: (input: OnboardingRequest) =>
    apiRequest('/perfil', { method: 'POST', body: input, schema: meResponseSchema }),
  update: (input: UpdateUserProfileInput) =>
    apiRequest('/perfil', { method: 'PUT', body: input, schema: meResponseSchema }),
  deleteAccount: () => apiRequest('/perfil', { method: 'DELETE' }),
};

export const dietaApi = {
  calculoFisico: (input: EnergyPlanRequest) =>
    apiRequest('/calculo-fisico', { method: 'POST', auth: false, body: input, schema: energyPlanSchema }),
  meta: () => apiRequest('/dieta/meta', { schema: nutritionTargetSchema }),
  resumo: (date: string) => apiRequest('/dieta/resumo', { query: { date }, schema: dailySummarySchema }),
};

// --- Diario e foto ----------------------------------------------------------
export const diarioApi = {
  list: (date: string) => apiRequest('/diario', { query: { date, limit: 100 }, schema: mealListResponseSchema }),
  create: (input: CreateMealInput) => apiRequest('/diario', { method: 'POST', body: input, schema: mealSchema }),
  update: (id: string, input: UpdateMealInput) =>
    apiRequest(`/diario/${id}`, { method: 'PUT', body: input, schema: mealSchema }),
  remove: (id: string) => apiRequest(`/diario/${id}`, { method: 'DELETE' }),
};

export interface PhotoFile {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export const scanApi = {
  scanPrato: async (photo: PhotoFile, fields: { mealType?: MealType; userHint?: string }) => {
    const form = new FormData();

    const type = photo.mimeType ?? 'image/jpeg';
    const name = photo.fileName ?? `prato.${type.split('/')[1] ?? 'jpg'}`;

    if (Platform.OS === 'web') {
      const blob = await (await fetch(photo.uri)).blob();
      form.append('foto', blob, name);
    } else {
      const file = new File(photo.uri as any);
      form.append('foto', file);
    }

    if (fields.mealType) form.append('mealType', fields.mealType);
    if (fields.userHint) form.append('userHint', fields.userHint);

    return apiRequest('/scan-prato', {
      method: 'POST',
      form,
      schema: mealAnalysisResultSchema,
      timeoutMs: 90_000,
    });
  },
};

export const alimentosApi = {
  search: (q: string) => apiRequest('/alimentos', { query: { q, limit: 30 }, schema: foodSearchResponseSchema }),
};

// --- Treino -----------------------------------------------------------------
export const treinosApi = {
  treinoDia: () => apiRequest('/treino-dia', { schema: treinoDiaResponseSchema }),
  plano: () => apiRequest('/treinos/plano', { schema: workoutPlanSchema }),
  gerar: (force = false) => apiRequest('/treinos/gerar', { method: 'POST', body: { force }, schema: workoutPlanSchema }),
  iniciar: (workoutId: string) =>
    apiRequest(`/treinos/${workoutId}/iniciar`, { method: 'POST', schema: workoutLogSchema }),
  registrar: (workoutExerciseId: string, workoutLogId: string, sets: SetLog[]) =>
    apiRequest(`/treinos/exercicios/${workoutExerciseId}/registro`, {
      method: 'POST',
      body: { workoutLogId, workoutExerciseId, sets },
      schema: workoutLogSchema,
    }),
  concluir: (workoutId: string, durationSeconds: number) =>
    apiRequest(`/treinos/${workoutId}/concluir`, {
      method: 'POST',
      body: { durationSeconds },
      schema: workoutLogSchema,
    }),
};

// --- Plano alimentar --------------------------------------------------------
export const planoAlimentarApi = {
  atual: () => apiRequest('/plano-alimentar', { schema: mealPlanSchema }),
  gerar: (force = false) =>
    apiRequest('/plano-alimentar/gerar', { method: 'POST', body: { days: 7, force }, schema: mealPlanSchema }),
  trocarRefeicao: (mealId: string) =>
    apiRequest(`/plano-alimentar/refeicoes/${mealId}/trocar`, { method: 'POST', body: {}, schema: mealPlanSchema }),
};
