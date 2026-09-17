import { createFileRoute } from '@tanstack/react-router';
import { useRouter, useSearchParams } from 'next/navigation';

import { EtapeSkeleton } from '@/components/chues/etapes';
import { NouveauProspect } from '@/components/grand-public/nouveau-prospect';
import { ProspectCreateForm } from '@/components/prospects/prospect-create-form';
import { guardPermission } from '@/lib/guard';
import { readString } from '@/lib/search-params';

export const Route = createFileRoute('/_panneau/teleconseil/prospects/nouveau')({
  beforeLoad: guardPermission('prospects.superviser'),
  component: NouveauProspectPage,
  pendingComponent: Loading,
});

function Loading() {
  return <EtapeSkeleton />;
}

function NouveauProspectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const representantId = readString(searchParams, 'rep');
  const rawProjet = readString(searchParams, 'projet');

  if (rawProjet !== null && rawProjet.toLowerCase().includes('grand')) {
    return (
      <NouveauProspect
        onSaved={() => router.push('/teleconseil/prospects?projet=GRAND_PUBLIC')}
        onAnnuler={() => router.push('/teleconseil/prospects?projet=GRAND_PUBLIC')}
      />
    );
  }

  return <ProspectCreateForm representantId={representantId} />;
}
