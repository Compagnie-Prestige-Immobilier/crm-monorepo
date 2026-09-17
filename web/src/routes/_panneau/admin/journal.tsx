import { createFileRoute } from '@tanstack/react-router';

import { JournalActionsView } from '@/components/exploitation/journal-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/admin/journal')({
  beforeLoad: guardPermission('exploitation.administrer'),
  component: JournalActionsView,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement du journal">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}
