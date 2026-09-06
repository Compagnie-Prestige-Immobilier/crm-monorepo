import {
  QueryClient,
  defaultShouldDehydrateQuery,
  environmentManager,
} from '@tanstack/react-query';
import { cache } from 'react';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
        // Hors ligne, une requête doit échouer et le dire, pas rester en pause sur un squelette.
        networkMode: 'always',
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  });
}

const getServerQueryClient = cache(makeQueryClient);

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) return getServerQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
