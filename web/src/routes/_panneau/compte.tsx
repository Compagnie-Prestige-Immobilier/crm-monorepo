import { createFileRoute } from '@tanstack/react-router';

import { ChangePasswordCard } from '@/components/compte/change-password-card';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/_panneau/compte')({
  component: ComptePage,
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

/** La page `(panel)/compte` de la v1. */
function ComptePage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <ChangePasswordCard />
    </div>
  );
}
