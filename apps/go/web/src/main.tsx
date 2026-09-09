import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { EcranErreur, EcranIntrouvable } from '@/components/etats-router';
import { Toaster } from '@/components/ui/sonner';
import { initTheme } from '@/lib/theme';
import { routeTree } from '@/routeTree.gen';

import './styles.css';

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
});

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
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
