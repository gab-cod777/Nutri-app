import { toLocalDate } from '@nutrisnap/core';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth-store';

import { dietaApi, diarioApi, perfilApi, planoAlimentarApi, treinosApi } from './endpoints';

/** Chaves do cache. Invalidar a chave certa e o que mantem as telas em sincronia. */
export const queryKeys = {
  perfil: ['perfil'] as const,
  meta: ['dieta', 'meta'] as const,
  resumo: (date: string) => ['dieta', 'resumo', date] as const,
  diario: (date: string) => ['diario', date] as const,
  treinoDia: ['treinos', 'dia'] as const,
  planoTreino: ['treinos', 'plano'] as const,
  planoAlimentar: ['plano-alimentar'] as const,
};

function useSignedIn() {
  return useAuthStore((state) => state.status === 'signedIn');
}

export function usePerfil() {
  return useQuery({ queryKey: queryKeys.perfil, queryFn: perfilApi.get, enabled: useSignedIn() });
}

/** Fuso do dispositivo (IANA). Enviado no onboarding; define a "virada do dia" no servidor. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

/** "Hoje" no fuso do perfil - o mesmo criterio que a API usa para o dia do diario. */
export function useToday(): string {
  const { data } = usePerfil();
  return toLocalDate(new Date(), data?.profile?.timezone ?? deviceTimezone());
}

export function useResumo(date: string) {
  return useQuery({ queryKey: queryKeys.resumo(date), queryFn: () => dietaApi.resumo(date), enabled: useSignedIn() });
}

export function useDiario(date: string) {
  return useQuery({ queryKey: queryKeys.diario(date), queryFn: () => diarioApi.list(date), enabled: useSignedIn() });
}

export function useMeta() {
  return useQuery({ queryKey: queryKeys.meta, queryFn: dietaApi.meta, enabled: useSignedIn() });
}

export function useTreinoDia() {
  return useQuery({ queryKey: queryKeys.treinoDia, queryFn: treinosApi.treinoDia, enabled: useSignedIn() });
}

export function usePlanoTreino() {
  return useQuery({ queryKey: queryKeys.planoTreino, queryFn: treinosApi.plano, enabled: useSignedIn() });
}

export function usePlanoAlimentar() {
  return useQuery({ queryKey: queryKeys.planoAlimentar, queryFn: planoAlimentarApi.atual, enabled: useSignedIn() });
}
