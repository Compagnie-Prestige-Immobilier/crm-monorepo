import { createFileRoute, redirect } from '@tanstack/react-router';

import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { LotExportDetailView } from '@/components/lots-export/lot-export-detail-view';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/_panneau/grand-public/campagnes/$id')({
  // La v1 renvoyait un rôle refusé vers l'accueil du projet, sans écran de refus.
  beforeLoad: ({ context }) => {
    if (!['ADMIN', 'SUPERVISEUR', 'DIRECTION'].includes(context.user.role)) {
      throw redirect({ href: '/chues' });
    }
  },
  component: LotExportDetailPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-12 w-52" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <GrandPublicTableSkeleton />
    </div>
  );
}

/** La page `(panel)/grand-public/campagnes/[id]` de la v1. */
function LotExportDetailPage() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();

  return (
    <LotExportDetailView
      id={id}
      peutRegler={user.role === 'ADMIN' || user.role === 'SUPERVISEUR'}
    />
  );
}
