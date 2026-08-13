import {
  HeadsetIcon,
  MapPinnedIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from 'lucide-react';

import { AnimatedNumber } from '@/components/live/animated-number';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/format';
import { PROSPECT_STATUT_LABELS, type DashboardKpis, type ProspectStatut } from '@/lib/types';

/**
 * Indicateurs de tête.
 *
 * Chaque valeur vient telle quelle de `GET /analytics/totals`. Le panel ne
 * recalcule RIEN : un total dérivé côté écran finit toujours par diverger de la
 * liste affichée juste en dessous, et c'est le genre d'écart qu'un directeur
 * remarque avant nous.
 */
function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  index,
}: {
  label: string;
  value: number;
  hint?: string | undefined;
  icon: LucideIcon;
  index: number;
}) {
  return (
    <Card
      className="animate-rise"
      // Entrée échelonnée. `animation-fill-mode: backwards` est posé dans
      // globals.css : sans lui, chaque carte apparaît en clair une frame avant
      // le début de son délai.
      style={{ animationDelay: `${String(index * 60)}ms` }}
    >
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {/* `tabular-nums` : les chiffres gardent la même largeur pendant
              l'interpolation, si bien que la carte ne se décale jamais. */}
          <AnimatedNumber
            value={value}
            className="mt-1 block font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em] tabular-nums"
          />
          {hint !== undefined ? (
            <p className="mt-2 text-[0.75rem] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

const STATUT_VARIANT: Record<ProspectStatut, 'secondary' | 'info' | 'success' | 'destructive'> = {
  NOUVEAU: 'secondary',
  CONTACTE: 'info',
  CONVERTI: 'success',
  PERDU: 'destructive',
};

export function KpiCards({ kpis }: { kpis: DashboardKpis }) {
  const parStatut: readonly [ProspectStatut, number][] = [
    ['NOUVEAU', kpis.nouveau],
    ['CONTACTE', kpis.contacte],
    ['CONVERTI', kpis.converti],
    ['PERDU', kpis.perdu],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          label="Prospects"
          value={kpis.prospects}
          hint={`${formatNumber(kpis.prospects7Jours)} sur 7 jours`}
          icon={UsersIcon}
        />
        <KpiCard
          index={1}
          label="Représentants"
          value={kpis.representants}
          icon={UsersRoundIcon}
        />
        <KpiCard
          index={2}
          label="Téléconseillers actifs"
          value={kpis.commerciauxActifs}
          icon={HeadsetIcon}
        />
        <KpiCard
          index={3}
          label="Départements couverts"
          value={kpis.departementsCouverts}
          icon={MapPinnedIcon}
        />
      </div>

      {/* La répartition par statut n'a pas besoin d'un graphique : quatre
          nombres se lisent plus vite qu'un anneau à quatre parts. */}
      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="Répartition des prospects par statut"
      >
        {parStatut.map(([statut, count]) => (
          <Badge key={statut} variant={STATUT_VARIANT[statut]} className="gap-1.5 py-1">
            {PROSPECT_STATUT_LABELS[statut]}
            {/* Sans `opacity-80`. Le compte est le chiffre que l'utilisateur
                est venu chercher, à 12 px : l'atténuation le faisait tomber à
                3,59:1 (info), 3,74:1 (succès) et 4,08:1 (destructif) en clair,
                sous les 4,5:1 exigés. Les couleurs de badge sont déjà calibrées
                pleines. */}
            <span className="tabular-nums">{formatNumber(count)}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((index) => (
        <Card key={index}>
          <CardContent className="flex items-start justify-between gap-3">
            <div className="w-full">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-20" />
              <Skeleton className="mt-3 h-3 w-32" />
            </div>
            <Skeleton className="size-10 rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
