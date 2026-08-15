'use client';

import { HeadsetIcon, LandmarkIcon, MegaphoneIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { BanksPanel } from '@/components/stats/banks-panel';
import { CampaignsPanel } from '@/components/stats/campaigns-panel';
import { TeleconseilPanel } from '@/components/stats/teleconseil-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Écran « Statistiques », trois volets.
 *
 * L'onglet courant vit dans l'URL et non dans un état React. Trois
 * conséquences, toutes voulues : un lien collé dans un message rouvre le bon
 * volet, le bouton « Précédent » revient à l'autre, et un rechargement de page
 * ne ramène pas l'utilisateur au premier onglet après qu'il a filtré.
 *
 * Les volets ne partagent PAS tous leur filtre : les prospects et les campagnes
 * se filtrent par représentant, syndicat et segment, les dossiers par étape,
 * banque et motif de rejet. Forcer un objet de filtre commun obligerait un
 * volet à ignorer la moitié des critères, et un critère ignoré mais affiché est
 * pire qu'un critère absent. Téléconseil et Campagnes partagent en revanche le
 * MÊME filtre prospects, à dessein : le critère « Campagne » de la barre du
 * haut restreint alors le pilotage à une campagne précise.
 */

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
    // `replace` et non `push` : changer d'onglet n'est pas une étape de
    // navigation, et empiler chaque bascule rendrait le bouton « Précédent »
    // inutilisable pour sortir de l'écran.
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
