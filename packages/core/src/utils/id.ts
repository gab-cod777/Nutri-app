/**
 * Gera um id opaco para uso no cliente (chaves de lista, itens em rascunho).
 *
 * Usa `crypto.randomUUID` quando disponivel (Node 19+, Hermes com polyfill do
 * expo-crypto) e cai para um id aleatorio simples caso contrario. Nao use isto
 * para nada que precise de unicidade global ou seguranca - ids de banco sao
 * gerados pelo Postgres.
 */
export function generateClientId(prefix = 'c'): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoRef?.randomUUID === 'function') {
    return `${prefix}_${cryptoRef.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
