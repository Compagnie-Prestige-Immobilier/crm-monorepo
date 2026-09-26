import { createFileRoute } from '@tanstack/react-router';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ENTITES, ImportsView } from '@/components/imports/imports-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';
import { readEnum } from '@/lib/search-params';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/admin/imports')({
  beforeLoad: guardPermission('imports.administrer'),
  component: ImportsPage,
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

/** La seule porte d'import ; `?entite=` choisit le classeur. */
function ImportsPage() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const pathname = usePathname();
  const lue = readEnum(useSearchParams(), 'entite', ENTITES) ?? 'prospects';
  const entite = lue === 'registre' && !peut(user, 'accueil.listes') ? 'prospects' : lue;

  return (
    <ImportsView
      entite={entite}
      onEntiteChange={(suivante) => {
        router.replace(`${pathname}?entite=${suivante}`, { scroll: false });
      }}
    />
  );
}
