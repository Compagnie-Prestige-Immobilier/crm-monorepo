import { createFileRoute, redirect } from '@tanstack/react-router';

import { RegistreImportView } from '@/components/accueil/registre-import-view';
import { Skeleton } from '@/components/ui/skeleton';
import { type Contexte, guardPermission } from '@/lib/guard';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/accueil/import')({
  beforeLoad: (contexte: Contexte) => {
    guardPermission('accueil.listes')(contexte);
    if (peut(contexte.context.user, 'imports.administrer')) {
      throw redirect({ href: '/admin/imports?entite=registre', replace: true });
    }
  },
  component: RegistreImportPage,
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

/** L'aller-retour du registre pour qui n'a pas la porte d'import de l'administration. */
function RegistreImportPage() {
  return <RegistreImportView />;
}
