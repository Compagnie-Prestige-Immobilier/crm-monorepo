'use client';

import { ApiError } from '@crm/api-client/query';
import { useQuery } from '@tanstack/react-query';

import { DatabaseDumpCard } from '@/components/settings/database-dump-card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDatabaseDump } from '@/lib/data/db-dump';
import { queryKeys } from '@/lib/query-keys';

/**
 * L'export intégral est FERMÉ par défaut : `DB_DUMP_ENABLED` vaut faux et la
 * route rend 404 ; l'espace de démonstration rend 403. Ce sont des réponses
 * normales, pas des pannes.
 */
function estIndisponible(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 403);
}

/**
 * Pas de carte du tout quand la fonction est fermée.
 *
 * Le passe-plat d'avant montrait à tout administrateur une carte rouge
 * « Introuvable » sans bouton de reprise, sur un déploiement pourtant conforme.
 * La même requête sert la carte : elles partagent la clé de cache.
 */
export function DatabaseDumpSection() {
  const dump = useQuery({
    queryKey: queryKeys.databaseDump,
    queryFn: () => fetchDatabaseDump(),
  });

  if (dump.isPending) return <Skeleton className="h-64 w-full" />;
  if (dump.isError && estIndisponible(dump.error)) return null;

  return <DatabaseDumpCard />;
}
