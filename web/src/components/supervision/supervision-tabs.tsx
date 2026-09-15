'use client';

import { useSearchParams } from 'next/navigation';

import { ActivityView } from '@/components/supervision/activity-view';
import { SupervisionView } from '@/components/supervision/supervision-view';
import type { Projet } from '@/lib/types';

/** Le volet Présence (`?volet=comptes`) ou, par défaut, l'activité. Les onglets sont ceux du pilotage. */
export function SupervisionTabs({ projet }: { projet: Projet | null }) {
  const presence = useSearchParams().get('volet') === 'comptes';

  if (!presence) return <ActivityView projet={projet} />;
  return (
    <div className="flex flex-col gap-6">
      <SupervisionView />
    </div>
  );
}
