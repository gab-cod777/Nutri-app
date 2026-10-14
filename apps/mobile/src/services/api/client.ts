import { apiErrorSchema } from '@nutrisnap/core';
import type { ZodType, ZodTypeDef } from 'zod';

import { API_URL } from '@/config/api';

import { ApiError, NetworkError } from './errors';

/**
 * Cliente HTTP unico do app. Nenhuma tela chama `fetch` direto.
 *
 * - base URL: `config/api.ts`
 * - autenticacao: `Authorization: Bearer <token>` com o token da sessao
 * - erros: `ApiError` (a API respondeu com erro) ou `NetworkError` (nao respondeu)
 * - respostas: validadas com os MESMOS schemas Zod do `@nutrisnap/core` que a
 *   API usa - se o contrato divergir, o erro aparece aqui, nao numa tela quebrada.
 */

type Schema<T> = ZodType<T, ZodTypeDef, unknown>;

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Corpo JSON. */
  body?: unknown;
  /** Corpo multipart (upload de foto). */
  form?: FormData;
  query?: Record<string, string | number | undefined>;
  schema?: Schema<T>;
  /** false nas rotas publicas (/cadastro, /login, /calculo-fisico). */
  auth?: boolean;
  timeoutMs?: number;
}

interface SessionHooks {
  getToken: () => string | null;
  /** Chamado quando uma rota autenticada responde 401 (token expirado/revogado). */
  onUnauthorized: () => void;
}

let session: SessionHooks = { getToken: () => null, onUnauthorized: () => {} };

export function configureApiSession(hooks: SessionHooks): void {
  session = hooks;
}

const DEFAULT_TIMEOUT_MS = 20_000;

export async function apiRequest<T = void>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const { method = 'GET', body, form, query, schema, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const url = `${API_URL}${path}${qs ? `?${qs}` : ''}`;

  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  // multipart: NAO definir content-type - o fetch gera o boundary.
  if (auth) {
    const token = session.getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    console.log('[API] request:', method, url);
    console.log('[API] hasForm:', !!form);
    console.log('[API] hasBody:', body !== undefined);

    response = await fetch(url, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });

    console.log('[API] response:', response.status, url);
  } catch (error) {
    console.error('[API] fetch error:', error);
    console.error('[API] aborted:', controller.signal.aborted);
    throw new NetworkError(controller.signal.aborted);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    const error = parsed.success
      ? new ApiError(response.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.requestId, parsed.data.error.details)
      : new ApiError(response.status, 'http_error', `HTTP ${response.status}`);
    if (response.status === 401 && auth) session.onUnauthorized();
    throw error;
  }

  if (!schema) return json as T;
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.warn(`[api] resposta fora do contrato em ${method} ${path}`, parsed.error.issues.slice(0, 3));
    throw new ApiError(response.status, 'invalid_response', 'Resposta fora do contrato.');
  }
  return parsed.data;
}
