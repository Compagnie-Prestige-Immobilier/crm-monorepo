'use client';

import { HeadsetIcon, LandmarkIcon, MegaphoneIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { BanksPanel } from '@/components/stats/banks-panel';
import { CampaignsPanel } from '@/components/stats/campaigns-panel';
import { TeleconseilPanel } from '@/components/stats/teleconseil-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const VOLET_PARAM = 'volet';
const TELECONSEIL = 'teleconseil';
const BANQUES = 'banques';
const CAMPAGNES = 'campagnes';

const VOLETS: readonly string[] = [BANQUES, CAMPAGNES];

export function StatisticsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requested = searchParams.get(VOLET_PARAM);
  const current = requested !== null && VOLETS.includes(requested) ? requested : TELECONSEIL;

  function select(value: string): void {
    const next = new URLSearchParams(searchParams.toString());
    if (value === TELECONSEIL) next.delete(VOLET_PARAM);
    else next.set(VOLET_PARAM, value);
    const query = next.toString();
    router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
  }

  return (
    <Tabs value={current} onValueChange={select} className="gap-6">
      <TabsList>
        <TabsTrigger value={TELECONSEIL}>
          <HeadsetIcon aria-hidden="true" />
          Téléconseil
        </TabsTrigger>
        <TabsTrigger value={BANQUES}>
          <LandmarkIcon aria-hidden="true" />
          Banques
        </TabsTrigger>
        <TabsTrigger value={CAMPAGNES}>
          <MegaphoneIcon aria-hidden="true" />
          Campagnes
        </TabsTrigger>
      </TabsList>

      {/* Chaque volet n'est monté que lorsqu'il est affiché : sans cela, ouvrir
          l'écran lancerait les requêtes des trois volets, dont la plupart pour
          un onglet que personne ne regarde. Les calculs ajoutés (médianes,
          cohortes, ancienneté par étape) rendent la règle d'autant plus
          nécessaire. */}
      <TabsContent value={TELECONSEIL}>
        {current === TELECONSEIL ? <TeleconseilPanel /> : null}
      </TabsContent>
      <TabsContent value={BANQUES}>{current === BANQUES ? <BanksPanel /> : null}</TabsContent>
      <TabsContent value={CAMPAGNES}>
        {current === CAMPAGNES ? <CampaignsPanel /> : null}
      </TabsContent>
    </Tabs>
  );
}
