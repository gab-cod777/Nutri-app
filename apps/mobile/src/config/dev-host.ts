/**
 * Web: o app roda no navegador do proprio PC, entao a API esta no mesmo
 * host da pagina (localhost ou o IP que voce digitou na barra de endereco).
 */
export function devServerHost(): string | null {
  return typeof window !== 'undefined' ? window.location.hostname : null;
}
