import { createFileRoute } from '@tanstack/react-router';

import { DatabaseDumpSection } from '@/components/settings/database-dump-section';
import { PurgeCard } from '@/components/settings/purge-card';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/admin/parametres')({
  beforeLoad: guardPermission('exploitation.administrer'),
  component: ParametresPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-11 w-44" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

/** Suppression des données : même permission que les routes de purge et de copie de la base. */
function ParametresPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <p className="text-[0.9375rem] text-muted-foreground">
        Ces actions portent sur les données de tous les utilisateurs.
      </p>

      <PurgeCard />

      <DatabaseDumpSection />
    </div>
  );
}
