import Constants from 'expo-constants';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** "http://192.168.0.15:8081/..." | "192.168.0.15:8081" | "exp://192.168.0.15:8081" -> "192.168.0.15" */
function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(?:[a-z]+:\/\/)?([^/:?#]+)/i.exec(value.trim());
  return match?.[1] ?? null;
}

/**
 * Celular/emulador: o IP do computador que serviu o JavaScript do app (o
 * Metro do `expo start`), visto pelo aparelho. A API roda no mesmo PC.
 */
export function devServerHost(): string | null {
  const candidates: (string | null | undefined)[] = [];
  try {
    // De onde o bundle JS foi baixado. Sempre presente em desenvolvimento.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const getDevServer = require('react-native/Libraries/Core/Devtools/getDevServer').default as () => {
      url: string;
      bundleLoadedFromServer: boolean;
    };
    const server = getDevServer();
    if (server.bundleLoadedFromServer) candidates.push(server.url);
  } catch {
    // API interna do RN indisponivel: seguimos para as outras fontes.
  }
  candidates.push(Constants.expoConfig?.hostUri, Constants.expoGoConfig?.debuggerHost, Constants.linkingUri);
  for (const candidate of candidates) {
    const host = hostOf(candidate);
    // localhost no celular/emulador e o proprio aparelho: nao serve.
    if (host && !LOCAL_HOSTS.has(host)) return host;
  }
  return null;
}
