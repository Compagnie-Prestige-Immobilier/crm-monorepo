import { createFileRoute } from '@tanstack/react-router';

import { DumpCard } from '@/components/admin/dump-card';
import { PurgeCard } from '@/components/admin/purge-card';
import { guardRoles } from '@/lib/guard';
import { ADMIN_SEUL } from '@/lib/roles';

function Parametres() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <p className="text-[0.9375rem] text-muted-foreground">
        Ces actions portent sur les données de tous les utilisateurs.
      </p>
      <DumpCard />
      <PurgeCard />
    </div>
  );
}

export const Route = createFileRoute('/_panneau/admin/parametres')({
  beforeLoad: guardRoles(ADMIN_SEUL),
  component: Parametres,
});
