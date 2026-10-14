import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Token de acesso.
 * - Celular: armazenamento seguro do sistema (Keychain no iOS, Keystore no
 *   Android). Nunca AsyncStorage: la ele fica em texto puro.
 * - Navegador (versao web, usada para testar no PC): nao existe SecureStore;
 *   usamos sessionStorage, que some ao fechar a aba.
 */
const KEY = 'nutrix.session.v1';

export interface StoredSession {
  token: string;
  /** ISO-8601. Depois disso o token nao vale mais - nem tentamos usar. */
  expiresAt: string;
  userId: string;
  email: string;
}

const storage = {
  get: (): Promise<string | null> =>
    Platform.OS === 'web' ? Promise.resolve(window.sessionStorage.getItem(KEY)) : SecureStore.getItemAsync(KEY),
  set: (value: string): Promise<void> =>
    Platform.OS === 'web' ? Promise.resolve(window.sessionStorage.setItem(KEY, value)) : SecureStore.setItemAsync(KEY, value),
  remove: (): Promise<void> =>
    Platform.OS === 'web' ? Promise.resolve(window.sessionStorage.removeItem(KEY)) : SecureStore.deleteItemAsync(KEY),
};

export async function readSession(): Promise<StoredSession | null> {
  try {
    const raw = await storage.get();
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (!session.token || new Date(session.expiresAt).getTime() <= Date.now()) {
      await clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await storage.set(JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  try {
    await storage.remove();
  } catch {
    // nada salvo: ok
  }
}
