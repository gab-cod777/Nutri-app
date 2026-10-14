import type { AuthResponse } from '@nutrisnap/core';
import { create } from 'zustand';

import { configureApiSession } from '@/services/api/client';
import { authApi } from '@/services/api/endpoints';
import { queryClient } from '@/services/query-client';
import { clearSession, readSession, saveSession } from '@/services/session/token-storage';

/**
 * Fonte UNICA do estado de autenticacao. Guarda so o necessario para navegar
 * (status + token + identificacao). Perfil, metas e diario vem da API via
 * TanStack Query - nao sao copiados para ca.
 */
type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  token: string | null;
  user: { id: string; email: string } | null;
  /** Motivo da ultima saida forcada (ex.: sessao expirada), para mostrar no login. */
  notice: string | null;
  bootstrap: () => Promise<void>;
  signIn: (auth: AuthResponse) => Promise<void>;
  signOut: (options?: { callApi?: boolean; notice?: string }) => Promise<void>;
  clearNotice: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'loading',
  token: null,
  user: null,
  notice: null,

  /** Ao abrir o app: le o token salvo. A validade e conferida no primeiro GET /perfil. */
  bootstrap: async () => {
    const stored = await readSession();
    if (stored) {
      set({ status: 'signedIn', token: stored.token, user: { id: stored.userId, email: stored.email } });
    } else {
      set({ status: 'signedOut', token: null, user: null });
    }
  },

  signIn: async (auth) => {
    await saveSession({ token: auth.token, expiresAt: auth.expiresAt, userId: auth.user.id, email: auth.user.email });
    queryClient.clear();
    set({ status: 'signedIn', token: auth.token, user: { id: auth.user.id, email: auth.user.email }, notice: null });
  },

  signOut: async ({ callApi = false, notice } = {}) => {
    if (callApi && get().token) {
      // POST /logout invalida o token no servidor. Se a rede falhar, saimos localmente mesmo assim.
      await authApi.logout().catch(() => undefined);
    }
    await clearSession();
    queryClient.clear();
    set({ status: 'signedOut', token: null, user: null, notice: notice ?? null });
  },

  clearNotice: () => set({ notice: null }),
}));

// O cliente HTTP le o token daqui e avisa quando a API recusar a sessao.
configureApiSession({
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => {
    if (useAuthStore.getState().status === 'signedIn') {
      void useAuthStore.getState().signOut({ notice: 'Sua sessão expirou. Entre novamente.' });
    }
  },
});
