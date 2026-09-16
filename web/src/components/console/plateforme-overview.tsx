'use client';

import { ResponsiveBar } from '@nivo/bar';
import { useQueries } from '@tanstack/react-query';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchProspectsAQualifier } from '@/lib/data/prospects';
import { formatNumber } from '@/lib/format';
import { useChartTheme } from '@/lib/chart-theme';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

const projets = [
  { value: null, label: 'Deux projets' },
  { value: 'CHUES' as const, label: 'CHUES' },
  { value: 'GRAND_PUBLIC' as const, label: 'Grand Public' },
] as const;

function themePour(theme: ReturnType<typeof useChartTheme>) {
  return {
    text: { fill: theme.tick, fontSize: 11 },
    axis: {
      domain: { line: { stroke: 'transparent' } },
      ticks: { line: { stroke: 'transparent' }, text: { fill: theme.tick } },
    },
    grid: { line: { stroke: theme.grid, strokeDasharray: '3 5' } },
    tooltip: { container: { background: theme.tooltipBackground, color: theme.tooltipForeground } },
  };
}

export function PlateformeOverview() {
  const resultats = useQueries({
    queries: projets.map((projet) => ({
      queryKey: ['plateforme-overview', projet.value],
      queryFn: async () => {
        const [tous, aAppeler] = await Promise.all([
          fetchProspectsAQualifier({ projet: projet.value, search: '', plateforme: true, page: 1 }),
          fetchProspectsAQualifier({
            projet: projet.value,
            search: '',
            plateforme: true,
            resteAAppeler: true,
            page: 1,
          }),
        ]);
        return { total: tous.total, aAppeler: aAppeler.total };
      },
      staleTime: 30_000,
    })),
  });

  const charge = resultats.some((resultat) => resultat.isPending);
  const total = resultats[0]?.data?.total ?? 0;
  const aAppeler = resultats[0]?.data?.aAppeler ?? 0;
  const appelees = Math.max(0, total - aAppeler);
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const barres = resultats.slice(1).map((resultat, index) => ({
    projet: projets[index + 1]?.label ?? '',
    'À appeler': resultat.data?.aAppeler ?? 0,
    Appelées: Math.max(0, (resultat.data?.total ?? 0) - (resultat.data?.aAppeler ?? 0)),
  }));

  return (
    <section className="flex flex-col gap-6" aria-labelledby="plateforme-apercu-titre">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          Pilotage CCP
        </p>
        <h1 id="plateforme-apercu-titre" className="mt-1 font-display text-3xl font-bold">
          Aperçu plateforme
        </h1>
        <p className="mt-2 text-muted-foreground">
          Un point rapide sur les inscriptions à traiter.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          title="Inscriptions"
          value={total}
          detail="CHUES et Grand Public"
          loading={charge}
        />
        <Metric
          title="À appeler"
          value={aAppeler}
          detail="Dans la file partagée"
          loading={charge}
        />
        <Metric
          title="Déjà appelées"
          value={appelees}
          detail="Depuis leur inscription"
          loading={charge}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>État de la file</CardTitle>
          <CardDescription>Les inscriptions les plus récentes, par projet.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72" aria-label="Graphique des inscriptions par projet">
            <ResponsiveBar
              data={barres}
              keys={['À appeler', 'Appelées']}
              indexBy="projet"
              groupMode="grouped"
              margin={{ top: 12, right: 16, bottom: 44, left: 44 }}
              padding={0.35}
              borderRadius={5}
              colors={[theme.series[0] ?? '#7f0018', theme.series[1] ?? '#d3a529']}
              enableLabel={false}
              axisBottom={{ tickSize: 0, tickPadding: 10 }}
              axisLeft={{ tickSize: 0, tickPadding: 8 }}
              theme={themePour(theme)}
              animate={!reducedMotion}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Metric({
  title,
  value,
  detail,
  loading,
}: {
  title: string;
  value: number;
  detail: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-4xl">{loading ? '…' : formatNumber(value)}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}
