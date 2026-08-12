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
        // Le rendu serveur produit déjà des données fraîches ; un staleTime nul
        // les ferait refetcher immédiatement à l'hydratation, pour rien.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      dehydrate: {
        // Les requêtes encore en vol sont transmises au client, qui reprend le
        // streaming là où le serveur l'a laissé.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  });
}

/**
 * UN QueryClient PAR REQUÊTE côté serveur.
 *
 * `cache()` de React mémorise par passe de rendu serveur, donc par requête
 * HTTP. Un simple singleton de module serait partagé par toutes les requêtes
 * du processus Node : le cache rempli par la session d'un administrateur
 * servirait la requête suivante, d'un autre utilisateur. C'est une fuite de
 * données inter-comptes, pas une optimisation.
 */
const getServerQueryClient = cache(makeQueryClient);

/**
 * Côté navigateur, à l'inverse, un singleton de module est exactement ce qu'on
 * veut : un seul onglet, un seul utilisateur, et le cache doit survivre à la
 * navigation. Il est créé paresseusement pour ne pas être instancié pendant le
 * rendu suspendu initial.
 */
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) return getServerQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
