'use client';

import { useQuery } from '@tanstack/react-query';
import { GaugeIcon, PhoneCallIcon, UserPlusIcon, UsersRoundIcon } from 'lucide-react';

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
import { CHAMP_LABELS } from '@/components/representants/representant-detail-view';
import { Skeleton } from '@/components/ui/skeleton';
import { useChartTheme } from '@/lib/chart-theme';
import { fetchQualiteDeLaBase, type QualiteDeLaBase } from '@/lib/data/chiffres';
import { formatNumber } from '@/lib/format';

const AIDE_SCORE =
  'Moyenne de deux parts : les fiches jointes parmi celles déjà appelées, et les représentants qui ont apporté au moins un prospect sur toute la base. Une base jamais appelée n’a pas de score.';

const AIDE_STATUTS =
  'Le statut que le téléconseiller a choisi après l’appel, tel qu’il est défini dans les listes de référence.';

function pourcent(part: number, total: number): string {
  return total === 0 ? '—' : `${String(Math.round((part / total) * 100))} %`;
}

function Entete({ base }: { base: QualiteDeLaBase }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        index={0}
        icon={GaugeIcon}
        label="Score de la base"
        value={base.score === null ? '—' : `${String(base.score)} / 100`}
        hint="Joignabilité et prospects apportés"
      />
      <Kpi
        index={1}
        icon={UsersRoundIcon}
        label="Fiches éprouvées"
        value={formatNumber(base.eprouves)}
        hint={`${pourcent(base.eprouves, base.total)} des ${formatNumber(base.total)} fiches remises`}
      />
      <Kpi
        index={2}
        icon={PhoneCallIcon}
        label="Représentants joints"
        value={formatNumber(base.joints)}
        hint={`${pourcent(base.joints, base.eprouves)} des fiches appelées`}
      />
      <Kpi
        index={3}
        icon={UserPlusIcon}
        label="Prospects apportés"
        value={formatNumber(base.prospectsApportes)}
        hint={`Par ${formatNumber(base.productifs)} représentants`}
      />
    </div>
  );
}

/**
 * La qualité de la liste que les représentants nous remettent : qui répond,
 * qui apporte des prospects, et d'où viennent les fiches qui ne donnent rien.
 */
export function PoleDeploiement() {
  const theme = useChartTheme();
  const requete = useQuery({
    queryKey: ['stats', 'representants', 'qualite'],
    queryFn: () => fetchQualiteDeLaBase(),
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

  const base = requete.data;
  const couleurDEffet: Record<string, string> = {
    REACHED: theme.series[2] ?? '#1A6B44',
    REFUSED: theme.series[3] ?? '#B05070',
    SCHEDULE_CALLBACK: theme.series[1] ?? '#C8921A',
    UNREACHABLE: theme.series[4] ?? '#8B5CF6',
    WRONG_NUMBER: theme.series[0] ?? '#630210',
  };
  const statuts: Part[] = base.parStatut
    .filter((statut) => statut.count > 0)
    .map((statut) => ({
      label: statut.label,
      value: statut.count,
      couleur: couleurDEffet[statut.effect] ?? theme.tick,
    }))
    .reverse();
  // Les deux sections de la liste de référence : l'appel a abouti, ou non.
  const abouti = (effect: string): boolean => effect !== '' && effect !== 'UNREACHABLE';
  const compte = (garde: (effect: string) => boolean): number =>
    base.parStatut
      .filter((statut) => garde(statut.effect))
      .reduce((somme, s) => somme + s.count, 0);
  const familles: Part[] = [
    { label: 'Appel abouti', value: compte(abouti), couleur: theme.series[2] ?? '#1A6B44' },
    {
      label: 'Appel non abouti',
      value: compte((effect) => effect === 'UNREACHABLE'),
      couleur: theme.series[3] ?? '#B05070',
    },
    {
      label: 'Non qualifié',
      value: compte((effect) => effect === ''),
      couleur: theme.tick,
    },
  ];
  const champs: Part[] = base.completude
    .map((champ) => ({
      label: CHAMP_LABELS[champ.code] ?? champ.code,
      value: base.total === 0 ? 0 : Math.round((champ.count / base.total) * 100),
    }))
    .sort((a, b) => a.value - b.value);
  const departements: LigneCroisee[] = base.parDepartement.slice(0, 12).map((zone) => ({
    label: zone.label,
    Joints: zone.joints,
    'Non joints': zone.fiches - zone.joints,
    courbe: zone.prospects,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Entete base={base} />

      <ChartCard
        title="Ce que chaque département a remis"
        description="Fiches jointes et non jointes, et la courbe des prospects qu’elles ont apportés"
        hauteur="haute"
        info="Les prospects apportés suivent leur propre échelle : ils se comparent entre départements, pas aux barres."
      >
        <BarresEtCourbe lignes={departements} vide="Aucun département fourni." />
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Où en est la base"
          description="Toutes les fiches, en trois parts"
          hauteur="haute"
          info="Les deux sections de la liste des statuts de qualification, plus les fiches qu’aucun appel n’a encore qualifiées."
        >
          <AnneauDesFamilles parts={familles} vide="Aucune fiche à mesurer." />
        </ChartCard>
        <ChartCard
          title="Statuts de qualification"
          description="Ce que l’appel a conclu, fiche par fiche"
          hauteur="haute"
          info={AIDE_STATUTS}
        >
          <BarresHorizontales parts={statuts} gauche={150} vide="Aucune fiche qualifiée." />
        </ChartCard>
        <ChartCard
          title="Champs renseignés"
          description="Part des fiches qui portent l’information, du plus rare au plus courant"
          hauteur="haute"
          info="Un champ vide n’empêche pas d’appeler, mais il prive le téléconseiller de ce qui ouvre la conversation."
        >
          <BarresHorizontales
            parts={champs}
            gauche={150}
            suffixe=" %"
            vide="Aucune fiche à mesurer."
          />
        </ChartCard>
      </div>

      <p className="text-[0.8125rem] text-muted-foreground">{AIDE_SCORE}</p>
    </div>
  );
}
