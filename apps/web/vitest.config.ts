import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // `e2e/` est joué par Playwright (`pnpm test:e2e`) contre une pile vivante.
    // L'y laisser ferait démarrer un navigateur pendant `pnpm test`.
    exclude: ['**/node_modules/**', '**/.next/**', 'e2e/**'],
    environment: 'node',
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.join(here, 'src'),
      /**
       * `server-only` lève à l'import dès qu'il n'est pas résolu via la
       * condition `react-server` — c'est précisément son rôle. Sous Vitest,
       * cela rendrait `src/lib/api/server.ts` et les Route Handlers
       * intestables. On le neutralise ici, et nulle part ailleurs : la
       * protection reste entière pour le build Next.
       */
      'server-only': path.join(here, 'src/test/server-only-stub.ts'),
    },
  },
});
