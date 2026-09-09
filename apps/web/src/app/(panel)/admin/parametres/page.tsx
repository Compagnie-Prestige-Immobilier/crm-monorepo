import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect, unstable_rethrow } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { DemoModeCard } from '@/components/settings/demo-mode-card';
import { AndroidReleaseCard } from '@/components/settings/android-release-card';
import { DatabaseDumpSection } from '@/components/settings/database-dump-section';
import { PurgeCard } from '@/components/settings/purge-card';
import { getServerApiClient } from '@/lib/api/server';
import { fetchDemoStatus } from '@/lib/data/demo';
import { demoWorkspaceEnabled } from '@/lib/demo-workspace';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function ParametresPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les paramètres de la plateforme" />;
  }

  const demoEnabled = demoWorkspaceEnabled();
  const queryClient = getQueryClient();
  if (demoEnabled) {
    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.demoStatus,
        queryFn: () => fetchDemoStatus(getServerApiClient()),
      });
    } catch (error) {
      unstable_rethrow(error);
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <p className="text-[0.9375rem] text-muted-foreground">
        Ces actions portent sur les données de tous les utilisateurs.
      </p>

      {demoEnabled ? (
        <HydrationBoundary state={dehydrate(queryClient)}>
          <DemoModeCard />
        </HydrationBoundary>
      ) : null}

      <AndroidReleaseCard />

      {/* La carte de purge n'est pas préchargée côté serveur : son catalogue
          compte les lignes de vingt-trois tables, et ce décompte ne doit pas
          allonger le premier rendu d'un écran qu'on ouvre le plus souvent pour
          tout autre chose. */}
      <PurgeCard />

      {/* EN DERNIER, et sans mise en avant. L'export intégral produit une copie
          complète de la clientèle : ce n'est pas une commande de tous les
          jours, et la placer plus haut inviterait à la lancer par curiosité.
          Comme la purge, la carte n'est pas préchargée côté serveur : son état
          ne vaut rien tant que personne n'a demandé d'export.

          `DatabaseDumpSection` et non la carte directement : sans
          `DB_DUMP_ENABLED=true` dans l'environnement, il n'y a pas de carte du
          tout, et l'API rend 404 de son côté. */}
      <DatabaseDumpSection />
    </div>
  );
}
