'use client';

import { useSearchParams } from 'next/navigation';

import { ActivityView } from '@/components/supervision/activity-view';
import { FichesRestees } from '@/components/supervision/fiches-restees';
import { SupervisionView } from '@/components/supervision/supervision-view';
import type { Projet, Role } from '@/lib/types';

/** Le volet Présence (`?volet=comptes`) ou, par défaut, l'activité. Les onglets sont ceux du pilotage. */
export function SupervisionTabs({ projet, role }: { projet: Projet; role: Role }) {
  const presence = useSearchParams().get('volet') === 'comptes';
  // La route de libération est fermée à la direction : lui montrer la liste
  // reviendrait à lui offrir un bouton que le serveur refuse.
  const peutLiberer = role === 'ADMIN' || role === 'SUPERVISEUR';

  if (!presence) return <ActivityView projet={projet} />;
  return (
    <div className="flex flex-col gap-6">
      {peutLiberer ? <FichesRestees /> : null}
      <SupervisionView />
    </div>
  );
}
