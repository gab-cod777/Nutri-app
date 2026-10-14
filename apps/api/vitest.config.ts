import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Os testes de integracao compartilham um banco: arquivos rodam em serie.
    fileParallelism: false,
    setupFiles: ['tests/setup-env.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
