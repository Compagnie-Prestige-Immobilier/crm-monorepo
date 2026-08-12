import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Les tests d'intégration exigent un Postgres joignable ; ils ont leur
    // propre configuration (`pnpm test:integration`) pour que `pnpm test`
    // reste exécutable sans Docker.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.integration.test.ts'],
    environment: 'node',
  },
});
