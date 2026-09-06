'use client';

import { ActivityIcon, ShieldCheckIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ActivityView } from '@/components/supervision/activity-view';
import { FichesRestees } from '@/components/supervision/fiches-restees';
import { SupervisionView } from '@/components/supervision/supervision-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Projet, Role } from '@/lib/types';

const VOLET_PARAM = 'volet';
const ACTIVITE = 'activite';
const COMPTES = 'comptes';

export function SupervisionTabs({ projet, role }: { projet: Projet; role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get(VOLET_PARAM) === COMPTES ? COMPTES : ACTIVITE;
  // La route de libération est fermée à la direction : lui montrer la liste
  // reviendrait à lui offrir un bouton que le serveur refuse.
  const peutLiberer = role === 'ADMIN' || role === 'SUPERVISEUR';

  function select(value: string): void {
    const next = new URLSearchParams(searchParams.toString());
    if (value === ACTIVITE) next.delete(VOLET_PARAM);
    else next.set(VOLET_PARAM, value);
    const query = next.toString();
    router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
  }

  return (
    <Tabs value={current} onValueChange={select} className="gap-6">
      <TabsList>
        <TabsTrigger value={ACTIVITE}>
          <ActivityIcon aria-hidden="true" />
          Activité
        </TabsTrigger>
        <TabsTrigger value={COMPTES}>
          <ShieldCheckIcon aria-hidden="true" />
          Comptes
        </TabsTrigger>
      </TabsList>

      {/* Chaque volet n'est monté que lorsqu'il est affiché : le volet Comptes
          se rafraîchit en boucle, et il le ferait derrière l'onglet Activité. */}
      <TabsContent value={ACTIVITE}>
        {current === ACTIVITE ? <ActivityView projet={projet} /> : null}
      </TabsContent>
      <TabsContent value={COMPTES}>
        {current === COMPTES ? (
          <div className="flex flex-col gap-6">
            {peutLiberer ? <FichesRestees /> : null}
            <SupervisionView />
          </div>
        ) : null}
      </TabsContent>
    </Tabs>
  );
}
