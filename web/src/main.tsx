import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRouter,
  parseSearchWith,
  RouterProvider,
  stringifySearchWith,
} from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';

import { EcranErreur, EcranIntrouvable } from '@/components/etats-router';
import { ExactAmountsProvider } from '@/components/money/exact-amounts';
import { installerRechargementPanneau } from '@/lib/api/version-panneau';
import { Toaster } from '@/components/ui/sonner';
import { initTheme } from '@/lib/theme';
import { routeTree } from '@/routeTree.gen';

import './styles.css';

// zod v4 sonde `Function("")` au chargement : la CSP du binaire le signalerait à chaque page.
z.config({ jitless: true });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
      // Hors ligne, une requête doit échouer et le dire, pas rester en pause sur un squelette.
      networkMode: 'always',
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultErrorComponent: EcranErreur,
  defaultNotFoundComponent: EcranIntrouvable,
  // Les critères sont des chaînes : le JSON par défaut lit « 6174e584 » comme Infinity.
  parseSearch: parseSearchWith((valeur) => valeur),
  stringifySearch: stringifySearchWith(String),
});

installerRechargementPanneau(router);

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('#root introuvable.');

initTheme();

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ExactAmountsProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ExactAmountsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
