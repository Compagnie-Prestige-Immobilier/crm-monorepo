import { createFileRoute } from '@tanstack/react-router';
import { useSearchParams } from 'next/navigation';

import { EtapeSkeleton } from '@/components/chues/etapes';
import { ProspectCreateForm } from '@/components/prospects/prospect-create-form';
import { guardRoles } from '@/lib/guard';
import { readString } from '@/lib/search-params';

export const Route = createFileRoute('/_panneau/chues/prospects/nouveau')({
  beforeLoad: guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'SUPERVISEUR', 'DIRECTION']),
  component: NouveauProspectPage,
  pendingComponent: Loading,
});

function Loading() {
  return <EtapeSkeleton />;
}

/** La page `(panel)/chues/prospects/nouveau` de la v1. */
function NouveauProspectPage() {
  const representantId = readString(useSearchParams(), 'rep');

  return <ProspectCreateForm representantId={representantId} />;
}
