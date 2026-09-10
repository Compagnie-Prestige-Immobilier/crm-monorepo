'use client';

import { Line } from 'react-chartjs-2';

import '@/components/dashboard/chart-setup';

import { axisScales, baseOptions } from '@/components/dashboard/chart-options';
import { EmptyChart } from '@/components/dashboard/empty-chart';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { seriesColor, useChartTheme } from '@/lib/chart-theme';
import type { Avancement, EnrolementIndicateurs } from '@/lib/data/enrolement';
import { formatNumber, formatShortDate } from '@/lib/format';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

type Entonnoir = EnrolementIndicateurs['entonnoir'];
type SerieJour = EnrolementIndicateurs['parJour'];

interface Etage {
  readonly cle: keyof Entonnoir;
  readonly label: string;
  readonly aide: string;
  readonly filtre: Avancement | undefined;
}

const ETAGES: readonly Etage[] = [
  {
    cle: 'inscriptions',
    label: 'Comptes créés',
    aide: 'Une inscription lue sur la plateforme.',
    filtre: undefined,
  },
  {
    cle: 'dossiersOuverts',
    label: 'Dossiers ouverts',
    aide: 'La personne a dépassé la simple création de compte.',
    filtre: 'ouvert',
  },
  {
    cle: 'dossiersSoumis',
    label: 'Dossiers soumis',
    aide: 'Le dossier est parti vers l’instruction.',
    filtre: 'soumis',
  },
  {
    cle: 'dossiersDecides',
    label: 'Décidés',
    aide: 'Une décision est datée sur la plateforme.',
    filtre: 'decide',
  },
];

/**
 * Un entonnoir mesure une seule chose à quatre profondeurs : le bordeaux se
 * décline par luminosité, il ne change pas de teinte comme le ferait une
 * palette catégorielle.
 */
function teinteEtage(index: number): string {
  return `color-mix(in srgb, var(--chart-1) ${String(90 - index * 18)}%, var(--card))`;
}

function Barre({ part, index }: { part: number; index: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${String(part > 0 ? Math.max(part, 2) : 0)}%`,
          background: teinteEtage(index),
        }}
      />
    </div>
  );
}

/**
 * Ce qui avance, étage par étage. La chute entre deux étages est l'information
 * que la cellule de pilotage cherche ; le cumul seul ne la montre pas.
 */
export function EntonnoirCarte({
  entonnoir,
  titre,
  actif,
  onChoisir,
}: {
  entonnoir: Entonnoir | undefined;
  titre?: string;
  actif?: Avancement | undefined;
  onChoisir?: ((avancement: Avancement | undefined) => void) | undefined;
}) {
  if (entonnoir === undefined) return <Skeleton className="h-64 w-full rounded-md" />;

  const total = entonnoir.inscriptions;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
          {titre ?? 'Avancement des dossiers'}
        </p>
        {total === 0 ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Aucune inscription sur la période retenue.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {ETAGES.map((etage, index) => {
              const valeur = entonnoir[etage.cle];
              const part = Math.round((valeur / total) * 1000) / 10;
              const contenu = (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.875rem]" title={etage.aide}>
                      {etage.label}
                    </span>
                    <span className="tabular-nums text-[0.875rem] font-[600]">
                      {formatNumber(valeur)}
                      <span className="ml-2 font-[400] text-muted-foreground">
                        {formatNumber(part)} %
                      </span>
                    </span>
                  </div>
                  <Barre part={part} index={index} />
                </>
              );
              return (
                <li key={etage.cle}>
                  {onChoisir === undefined ? (
                    <div className="flex flex-col gap-1.5">{contenu}</div>
                  ) : (
                    <button
                      type="button"
                      aria-pressed={actif === etage.filtre}
                      onClick={() => {
                        onChoisir(actif === etage.filtre ? undefined : etage.filtre);
                      }}
                      className={
                        actif === etage.filtre && etage.filtre !== undefined
                          ? 'flex w-full flex-col gap-1.5 rounded-md bg-secondary px-2 py-1.5 text-left'
                          : 'flex w-full flex-col gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary'
                      }
                    >
                      {contenu}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export interface SerieCourbe {
  readonly nom: string;
  readonly points: SerieJour;
}

/** Les jours sans inscription doivent rester visibles : ils font le rythme. */
function joursUnion(series: readonly SerieCourbe[]): string[] {
  return [...new Set(series.flatMap((serie) => serie.points.map((point) => point.jour)))].sort();
}

export function CourbeEnrolement({
  series,
  titre,
}: {
  series: readonly SerieCourbe[];
  titre: string;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const jours = joursUnion(series);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
          {titre}
        </p>
        <div className="h-56">
          {jours.length === 0 ? (
            <EmptyChart message="Aucune inscription datée sur la période retenue." />
          ) : (
            <Line
              options={{
                ...baseOptions(theme, reducedMotion),
                scales: axisScales(theme),
                plugins: {
                  ...baseOptions(theme, reducedMotion).plugins,
                  legend: { display: series.length > 1, labels: { color: theme.tick } },
                },
              }}
              data={{
                labels: jours.map((jour) => formatShortDate(jour)),
                datasets: series.map((serie, index) => ({
                  label: serie.nom,
                  data: jours.map(
                    (jour) => serie.points.find((point) => point.jour === jour)?.inscriptions ?? 0,
                  ),
                  borderColor: seriesColor(theme, index),
                  backgroundColor: seriesColor(theme, index),
                  tension: 0.3,
                  pointRadius: 2,
                })),
              }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
