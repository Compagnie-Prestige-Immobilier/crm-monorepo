import { createFileRoute } from '@tanstack/react-router';

import { RepresentantsView } from '@/components/representants/representants-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';
import { canExportRepresentants, peut, readsOnly } from '@/lib/types';

export const Route = createFileRoute('/_panneau/teleconseil/representants/')({
  beforeLoad: guardPermission('fiches.tenir'),
  component: TeleconseilRepresentantsPage,
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

/** La page `/teleconseil/representants` unifiée. */
function TeleconseilRepresentantsPage() {
  const { user } = Route.useRouteContext();

  return (
    <RepresentantsView
      canAdminister={peut(user, 'imports.administrer')}
      readOnly={readsOnly(user.role)}
      canExport={canExportRepresentants(user.role)}
      campaignScoped={user.role === 'COMMERCIAL'}
    />
  );
}
