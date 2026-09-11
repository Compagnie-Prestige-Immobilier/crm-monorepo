'use client';

import { useQuery } from '@tanstack/react-query';
import { GaugeIcon, MegaphoneIcon, PhoneCallIcon, TrophyIcon } from 'lucide-react';

import { Kpi } from '@/components/bank/bank-kpi';
import { ChartCard } from '@/components/dashboard/chart-card';
import {
  AnneauDesFamilles,
  BarresEtCourbe,
  BarresHorizontales,
  type LigneCroisee,
  type Part,
} from '@/components/pilotage/qualite-charts';
import { QueryErrorState } from '@/components/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useChartTheme } from '@/lib/chart-theme';
import { CANAL_ICONES } from '@/lib/data/canaux-icones';
import { fetchQualiteDuMarketing, type QualiteDuMarketing } from '@/lib/data/chiffres';
import { formatNumber } from '@/lib/format';
const AIDE_SCORE =
  'Moyenne de deux parts : les prospects joints parmi ceux déjà appelés, et les prospects convertis sur tout ce que le marketing a amené. Sans aucun appel, il n’y a pas de score.';

function pourcent(part: number, total: number): string {
  return total === 0 ? '—' : `${String(Math.round((part / total) * 100))} %`;
}

function Entete({ marketing }: { marketing: QualiteDuMarketing }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        index={0}
        icon={GaugeIcon}
        label="Score du marketing"
        value={marketing.score === null ? '—' : `${String(marketing.score)} / 100`}
        hint="Joignabilité et conversions"
      />
      <Kpi
        index={1}
        icon={MegaphoneIcon}
        label="Prospects amenés"
        value={formatNumber(marketing.total)}
        hint={`${formatNumber(marketing.avecCanal)} portent un canal de provenance`}
      />
      <Kpi
        index={2}
        icon={PhoneCallIcon}
        label="Prospects joints"
        value={formatNumber(marketing.joints)}
        hint={`${pourcent(marketing.joints, marketing.eprouves)} des fiches appelées`}
      />
      <Kpi
        index={3}
        icon={TrophyIcon}
        label="Convertis"
        value={formatNumber(marketing.convertis)}
        hint={`${pourcent(marketing.convertis, marketing.total)} de ce qui a été amené`}
      />
    </div>
  );
}

/**
 * Ce que valent les prospects que le marketing amène : quel canal répond, et
 * lequel se convertit. Les deux projets sont comptés ensemble, un canal ne
 * choisissant pas le projet où sa fiche atterrit.
 */
export function PoleMarketing() {
  const theme = useChartTheme();
  const requete = useQuery({
    queryKey: ['stats', 'prospects', 'marketing'],
    queryFn: () => fetchQualiteDuMarketing(),
  });

  if (requete.isPending) {
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Chargement des indicateurs">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }
  if (requete.isError) {
    return <QueryErrorState error={requete.error} onRetry={() => void requete.refetch()} />;
  }

  const marketing = requete.data;
  const canaux: LigneCroisee[] = marketing.parCanal.slice(0, 12).map((canal) => ({
    label: canal.label,
    Joints: canal.joints,
    'Non joints': canal.prospects - canal.joints,
    courbe: canal.convertis,
  }));
  const couleurDEffet: Record<string, string> = {
    CLOSE_METHOD: theme.series[2] ?? '#1A6B44',
    CLOSE_REFUSED: theme.series[3] ?? '#B05070',
    SCHEDULE_CALLBACK: theme.series[1] ?? '#C8921A',
    CLOSE_WRONG_NUMBER: theme.series[0] ?? '#630210',
    KEEP_OPEN: theme.series[4] ?? '#8B5CF6',
  };
  const motifs: Part[] = marketing.parMotif
    .filter((motif) => motif.count > 0)
    .map((motif) => ({
      label: motif.label,
      value: motif.count,
      couleur: couleurDEffet[motif.effect] ?? theme.tick,
    }))
    .reverse();
  const familles: Part[] = [
    {
      label: 'Joints',
      value: marketing.joints,
      couleur: theme.series[2] ?? '#1A6B44',
    },
    {
      label: 'Appelés sans réponse',
      value: Math.max(0, marketing.eprouves - marketing.joints),
      couleur: theme.series[3] ?? '#B05070',
    },
    {
      label: 'Jamais appelés',
      value: Math.max(0, marketing.total - marketing.eprouves),
      couleur: theme.tick,
    },
  ];
  const rendement: Part[] = marketing.parCanal
    .filter((canal) => canal.prospects > 0)
    .map((canal) => ({
      label: canal.label,
      value: Math.round((canal.convertis / canal.prospects) * 100),
      icone: CANAL_ICONES[canal.code],
    }))
    .sort((a, b) => a.value - b.value)
    .slice(-12);

  return (
    <div className="flex flex-col gap-6">
      <Entete marketing={marketing} />

      <ChartCard
        title="Ce que chaque canal amène"
        description="Prospects joints et non joints, et la courbe de ceux qui se sont convertis"
        hauteur="haute"
        info="Les conversions suivent leur propre échelle : elles se comparent entre canaux, pas aux barres."
      >
        <BarresEtCourbe lignes={canaux} vide="Aucun canal de provenance renseigné." />
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Où en est ce que le marketing a amené"
          description="Toute la base, en trois parts"
          hauteur="haute"
          info="Un prospect joint a décroché, quelle qu’ait été sa réponse. Un prospect jamais appelé ne dit encore rien de la valeur du canal."
        >
          <AnneauDesFamilles parts={familles} vide="Aucun prospect à mesurer." />
        </ChartCard>
        <ChartCard
          title="Taux de conversion par canal"
          description="Part des prospects amenés qui se sont convertis"
          hauteur="haute"
          info="Un canal qui amène peu mais convertit beaucoup vaut mieux qu’un canal qui remplit la base sans résultat."
        >
          <BarresHorizontales
            parts={rendement}
            gauche={150}
            suffixe=" %"
            vide="Aucun canal de provenance renseigné."
          />
        </ChartCard>
        <ChartCard
          title="Motifs du dernier appel"
          description="Chaque prospect rangé sous le motif choisi par le téléconseiller"
          hauteur="haute"
          info="Les motifs viennent des listes de référence. « Jamais appelé » n’en est pas un : la fiche attend encore son premier appel."
        >
          <BarresHorizontales parts={motifs} gauche={150} vide="Aucun prospect à mesurer." />
        </ChartCard>
      </div>

      <p className="text-[0.8125rem] text-muted-foreground">{AIDE_SCORE}</p>
    </div>
  );
}
