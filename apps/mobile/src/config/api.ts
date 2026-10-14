import { devServerHost } from './dev-host';

/** Porta padrao da API (apps/api, variavel PORT). */
const API_PORT = 3333;

/**
 * URL base da API, nesta ordem:
 *
 * 1. `EXPO_PUBLIC_API_URL` (apps/mobile/.env), se voce quiser forcar um endereco.
 * 2. Automatico:
 *    - celular (Expo Go) / emulador: o IP do PC que serve o app, porta 3333;
 *    - navegador (versao web): o mesmo host da pagina, porta 3333.
 * 3. Ultimo recurso: http://10.0.2.2:3333 (so funciona no EMULADOR Android).
 */
function resolveApiUrl(): string {
  // Expo so injeta variaveis EXPO_PUBLIC_* lidas de forma literal (process.env.EXPO_PUBLIC_X).
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const host = devServerHost();
  if (host) return `http://${host}:${API_PORT}`;

  return `http://10.0.2.2:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

// Aparece no terminal do `expo start` (e no console do navegador).
console.log(`[Nutrix] API: ${API_URL}`);
