import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Rendu d'un écran du panel branché sur React Query.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Deux réglages sont indispensables, et aucun n'est cosmétique.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `retry: false` : le client de production réessaie une fois. Un test de la
 * branche d'ERREUR attendrait donc deux échecs et le délai entre eux, pour
 * finir en dépassement de temps sur un composant parfaitement correct.
 *
 * `staleTime: 0` avec un client NEUF à chaque rendu : le client de production
 * est un singleton de module. Partagé entre les tests, le premier remplirait le
 * cache et le second verrait des données qu'il n'a pas demandées : les tests
 * cesseraient d'être indépendants, et l'ordre d'exécution deviendrait
 * significatif.
 */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithQuery(ui: ReactElement, client: QueryClient = makeTestQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...render(ui, { wrapper }), client };
}
