import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api/errors';

/** Cache dos dados vindos da API. Estado de servidor mora aqui, nao no Zustand. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Erro 4xx (404 = "ainda nao existe", 401...) nao melhora com retentativa.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 1,
    },
    mutations: { retry: false },
  },
});
