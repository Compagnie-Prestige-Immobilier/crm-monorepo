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

/**
 * `showBanks` : les analyses bancaires n'acceptent AUCUN filtre de projet
 * (`GET /api/v1/bank-cases/analytics`). Hors CHUES, l'onglet montrerait les
 * encaissements CHUES sous une autre étiquette : il vaut mieux ne pas l'offrir
 * que de le remplir d'un chiffre faux.
 */
export function StatisticsView({ showBanks = true }: { showBanks?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const volets: readonly string[] = showBanks ? [BANQUES, CAMPAGNES] : [CAMPAGNES];
  const requested = searchParams.get(VOLET_PARAM);
  const current = requested !== null && volets.includes(requested) ? requested : TELECONSEIL;

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
        {showBanks ? (
          <TabsTrigger value={BANQUES}>
            <LandmarkIcon aria-hidden="true" />
            Banques
          </TabsTrigger>
        ) : null}
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
      {showBanks ? (
        <TabsContent value={BANQUES}>{current === BANQUES ? <BanksPanel /> : null}</TabsContent>
      ) : null}
      <TabsContent value={CAMPAGNES}>
        {current === CAMPAGNES ? <CampaignsPanel /> : null}
      </TabsContent>
    </Tabs>
  );
}
