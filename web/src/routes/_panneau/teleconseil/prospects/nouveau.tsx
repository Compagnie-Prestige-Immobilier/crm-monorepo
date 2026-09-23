import { createFileRoute } from '@tanstack/react-router';
import { useRouter, useSearchParams } from 'next/navigation';

import { EtapeSkeleton } from '@/components/chues/etapes';
import { NouveauProspectConsole } from '@/components/prospects/nouveau-prospect-console';
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
  return (
    <NouveauProspectConsole
      representantId={representantId}
      onSaved={() => router.push('/teleconseil/prospects')}
      onAnnuler={() => router.push('/teleconseil/prospects')}
    />
  );
}
