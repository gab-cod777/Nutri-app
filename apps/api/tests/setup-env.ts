/**
 * Testes de integracao usam um Postgres real, apontado por TEST_DATABASE_URL.
 * Sem ele, os arquivos de integracao sao pulados (e o relatorio mostra isso).
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
