import { createFileRoute } from '@tanstack/react-router';

import { PoleDeploiementView } from '@/components/pilotage/pole-deploiement-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/pole-deploiement')({
  beforeLoad: guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']),
  component: PoleDeploiementPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement du Pôle déploiement">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

function PoleDeploiementPage() {
  return <PoleDeploiementView />;
}
