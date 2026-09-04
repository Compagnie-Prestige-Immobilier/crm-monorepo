'use client';

import type { ChartData, ChartOptions, Plugin } from 'chart.js';
import {
  Bar,
  Bubble,
  Chart as MixedChart,
  Doughnut,
  Line,
  PolarArea,
  Radar,
  Scatter,
} from 'react-chartjs-2';

import '@/components/dashboard/chart-setup';

import { axisScales, baseOptions, radialScale } from '@/components/dashboard/chart-options';
import type {
  CompositionLigne,
  DispositionPresentation,
  EquipeDatum,
  MatriceDatum,
  ScalaireDatum,
} from '@/components/accueil/tableau-de-bord/sources';
import { EmptyChart } from '@/components/dashboard/empty-chart';
import { AnimatedNumber } from '@/components/live/animated-number';
import { seriesBorderColor, seriesColor, useChartTheme, type ChartTheme } from '@/lib/chart-theme';
import { formatNumber } from '@/lib/format';
import type { NamedCount } from '@/lib/types';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

export interface ItemsChartProps {
  items: readonly NamedCount[];
  label?: string;
  presentation?: DispositionPresentation | undefined;
}

/**
 * `neutre` décline le bordeaux par luminosité, `categorielle` habille les
 * surfaces d'or par opacité — jamais le texte, `docs/design.md §2.3`.
 * `serie` retombe sur la palette CPI habituelle.
 */
function paletteFill(
  theme: ChartTheme,
  palette: DispositionPresentation['palette'],
  index: number,
): string {
  if (palette === 'neutre') {
    const base = theme.series[0] ?? '#630210';
    const niveau = Math.max(25, 85 - (index % 6) * 12);
    return `color-mix(in srgb, ${base} ${String(niveau)}%, white)`;
  }
  if (palette === 'categorielle') {
    const niveau = Math.max(35, 100 - (index % 5) * 15);
    return `color-mix(in srgb, ${theme.accentBorder} ${String(niveau)}%, transparent)`;
  }
  return seriesColor(theme, index);
}

function paletteBorder(
  theme: ChartTheme,
  palette: DispositionPresentation['palette'],
  index: number,
  repli: string,
): string {
  if (palette === 'neutre') return theme.series[0] ?? repli;
  if (palette === 'categorielle') return theme.accentBorder;
  return seriesBorderColor(theme, index, repli);
}

/**
 * Greffon local : Chart.js n'a pas d'étiquettes de données enregistrées ici,
 * et une dépendance de plus pour ça n'en vaut pas la peine. `disponible`
 * mesure l'espace par élément ; en dessous de 20 px l'étiquette déborderait
 * sur sa voisine, elle est sautée plutôt que dessinée illisible.
 */
function valeursAffichees(theme: ChartTheme): Plugin<'bar' | 'line'> {
  return {
    id: 'valeurs-affichees',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const horizontal = chart.options.indexAxis === 'y';
      ctx.save();
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = theme.tick;
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden || meta.data.length === 0) return;
        const disponible = (horizontal ? chartArea.height : chartArea.width) / meta.data.length;
        if (disponible < 20) return;
        meta.data.forEach((element, index) => {
          const value = dataset.data[index];
          if (typeof value !== 'number') return;
          const { x, y } = element.getProps(['x', 'y'], true) as { x: number; y: number };
          if (horizontal) {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatNumber(value), x + 6, y);
          } else {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(formatNumber(value), x, y - 6);
          }
        });
      });
      ctx.restore();
    },
  };
}

function valeursPlugins(theme: ChartTheme, actif: boolean | undefined): Plugin<'bar' | 'line'>[] {
  return actif === true ? [valeursAffichees(theme)] : [];
}

function itemsDataset(
  theme: ChartTheme,
  items: readonly NamedCount[],
  palette: DispositionPresentation['palette'],
) {
  return {
    data: items.map((item) => item.value),
    backgroundColor: items.map((_, index) => paletteFill(theme, palette, index)),
    borderColor: items.map((_, index) =>
      paletteBorder(theme, palette, index, seriesColor(theme, index)),
    ),
    borderWidth: 1,
    borderRadius: 6,
    borderSkipped: false as const,
  };
}

export function BarresVerticalesChart({ items, label = 'Visites', presentation }: ItemsChartProps) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const options: ChartOptions<'bar'> = {
    ...baseOptions(theme, reducedMotion),
    scales: axisScales(theme),
  };
  return (
    <Bar
      options={options}
      plugins={valeursPlugins(theme, presentation?.valeurs)}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          { label, ...itemsDataset(theme, items, presentation?.palette), maxBarThickness: 42 },
        ],
      }}
    />
  );
}

export function BarresHorizontalesChart({
  items,
  label = 'Visites',
  presentation,
}: ItemsChartProps) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const options: ChartOptions<'bar'> = {
    ...baseOptions(theme, reducedMotion),
    indexAxis: 'y',
    scales: axisScales(theme, { horizontal: true }),
  };
  return (
    <Bar
      options={options}
      plugins={valeursPlugins(theme, presentation?.valeurs)}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          { label, ...itemsDataset(theme, items, presentation?.palette), barThickness: 18 },
        ],
      }}
    />
  );
}

export function BarresGroupeesChart({
  items,
  comparaison,
  presentation,
}: {
  items: readonly NamedCount[];
  comparaison?: readonly NamedCount[];
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const legende = presentation?.legende ?? comparaison !== undefined;
  const options: ChartOptions<'bar'> = {
    ...baseOptions(theme, reducedMotion),
    scales: axisScales(theme),
    plugins: {
      ...baseOptions(theme, reducedMotion).plugins,
      legend: { display: legende, position: 'top', labels: { color: theme.tick } },
    },
  };
  const comparaisonParId = new Map((comparaison ?? []).map((item) => [item.id, item.value]));
  return (
    <Bar
      options={options}
      plugins={valeursPlugins(theme, presentation?.valeurs)}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            label: 'Période affichée',
            data: items.map((item) => item.value),
            backgroundColor: paletteFill(theme, presentation?.palette, 0),
            borderRadius: 6,
            maxBarThickness: 24,
          },
          ...(comparaison === undefined
            ? []
            : [
                {
                  label: 'Comparaison',
                  data: items.map((item) => comparaisonParId.get(item.id) ?? 0),
                  backgroundColor: paletteFill(theme, presentation?.palette, 1),
                  borderRadius: 6,
                  maxBarThickness: 24,
                },
              ]),
        ],
      }}
    />
  );
}

function compositionDatasets(
  theme: ChartTheme,
  lignes: readonly CompositionLigne[],
  palette: DispositionPresentation['palette'],
) {
  const segmentIds = [
    ...new Set(lignes.flatMap((ligne) => ligne.segments.map((segment) => segment.id))),
  ];
  return segmentIds.map((segmentId, index) => ({
    label: lignes[0]?.segments.find((segment) => segment.id === segmentId)?.label ?? segmentId,
    data: lignes.map(
      (ligne) => ligne.segments.find((segment) => segment.id === segmentId)?.value ?? 0,
    ),
    backgroundColor: paletteFill(theme, palette, index),
    borderRadius: 4,
  }));
}

export function BarresEmpileesChart({
  lignes,
  presentation,
}: {
  lignes: readonly CompositionLigne[];
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const legende = presentation?.legende ?? true;
  const options: ChartOptions<'bar'> = {
    ...baseOptions(theme, reducedMotion),
    indexAxis: 'y',
    scales: axisScales(theme, { horizontal: true, empile: true }),
    plugins: {
      ...baseOptions(theme, reducedMotion).plugins,
      legend: { display: legende, position: 'top', labels: { color: theme.tick } },
    },
  };
  return (
    <Bar
      options={options}
      plugins={valeursPlugins(theme, presentation?.valeurs)}
      data={{
        labels: lignes.map((ligne) => ligne.ligne),
        datasets: compositionDatasets(theme, lignes, presentation?.palette),
      }}
    />
  );
}

export function Barres100Chart({
  lignes,
  presentation,
}: {
  lignes: readonly CompositionLigne[];
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const legende = presentation?.legende ?? true;
  const totaux = lignes.map((ligne) =>
    ligne.segments.reduce((somme, segment) => somme + segment.value, 0),
  );
  const datasets = compositionDatasets(theme, lignes, presentation?.palette).map((dataset) => ({
    ...dataset,
    data: dataset.data.map((value, index) => {
      const total = totaux[index] ?? 0;
      return total === 0 ? 0 : Math.round((value / total) * 100);
    }),
  }));
  const options: ChartOptions<'bar'> = {
    ...baseOptions(theme, reducedMotion),
    indexAxis: 'y',
    scales: axisScales(theme, { horizontal: true, empile: true, entier: false }),
    plugins: {
      ...baseOptions(theme, reducedMotion).plugins,
      legend: { display: legende, position: 'top', labels: { color: theme.tick } },
      tooltip: {
        ...baseOptions(theme, reducedMotion).plugins.tooltip,
        callbacks: {
          label: (context) => ` ${context.dataset.label ?? ''}: ${String(context.parsed.x)} %`,
        },
      },
    },
  };
  return (
    <Bar
      options={options}
      plugins={valeursPlugins(theme, presentation?.valeurs)}
      data={{ labels: lignes.map((ligne) => ligne.ligne), datasets }}
    />
  );
}

function serieOptions(
  theme: ChartTheme,
  reducedMotion: boolean,
  stepped: boolean,
  fill: boolean,
): ChartOptions<'line'> {
  return {
    ...baseOptions(theme, reducedMotion),
    scales: axisScales(theme),
    interaction: { mode: 'index', intersect: false },
    elements: { point: { radius: 0, hitRadius: 12, hoverRadius: 4 }, line: { stepped, fill } },
  };
}

export function CourbeChart({ items, label = 'Visites', presentation }: ItemsChartProps) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const accent = paletteFill(theme, presentation?.palette, 0);
  return (
    <Line
      options={serieOptions(theme, reducedMotion, false, false)}
      plugins={valeursPlugins(theme, presentation?.valeurs)}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            label,
            data: items.map((item) => item.value),
            borderColor: accent,
            borderWidth: 2,
            tension: 0.3,
          },
        ],
      }}
    />
  );
}

export function AireChart({ items, label = 'Visites', presentation }: ItemsChartProps) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const accent = paletteFill(theme, presentation?.palette, 0);
  return (
    <Line
      options={serieOptions(theme, reducedMotion, false, true)}
      plugins={valeursPlugins(theme, presentation?.valeurs)}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            label,
            data: items.map((item) => item.value),
            borderColor: accent,
            backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`,
            borderWidth: 2,
            tension: 0.3,
          },
        ],
      }}
    />
  );
}

export function EscalierChart({ items, label = 'Visites', presentation }: ItemsChartProps) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const accent = paletteFill(theme, presentation?.palette, 0);
  return (
    <Line
      options={serieOptions(theme, reducedMotion, true, false)}
      plugins={valeursPlugins(theme, presentation?.valeurs)}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          { label, data: items.map((item) => item.value), borderColor: accent, borderWidth: 2 },
        ],
      }}
    />
  );
}

function partageOptions(
  theme: ChartTheme,
  reducedMotion: boolean,
  legende: boolean,
  position: 'right' | 'top',
): ChartOptions<'doughnut'> {
  const total = (items: readonly NamedCount[]) =>
    items.reduce((somme, item) => somme + item.value, 0);
  return {
    ...baseOptions(theme, reducedMotion),
    plugins: {
      ...baseOptions(theme, reducedMotion).plugins,
      legend: {
        display: legende,
        position,
        labels: {
          color: theme.tick,
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          font: { size: 11 },
        },
      },
      tooltip: {
        ...baseOptions(theme, reducedMotion).plugins.tooltip,
        callbacks: {
          label: (context) => {
            const items = context.chart.data.datasets[0]?.data as number[];
            const somme = total(items.map((value, id) => ({ id: String(id), label: '', value })));
            const part = somme === 0 ? 0 : Math.round((context.parsed / somme) * 100);
            return ` ${context.label}: ${formatNumber(context.parsed)} (${String(part)} %)`;
          },
        },
      },
    },
  };
}

export function AnneauChart({
  items,
  presentation,
}: {
  items: readonly NamedCount[];
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const legende = presentation?.legende ?? true;
  return (
    <Doughnut
      options={{ ...partageOptions(theme, reducedMotion, legende, 'right'), cutout: '62%' }}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            data: items.map((item) => item.value),
            backgroundColor: items.map((_, index) =>
              paletteFill(theme, presentation?.palette, index),
            ),
            borderColor: items.map((_, index) =>
              paletteBorder(theme, presentation?.palette, index, theme.tooltipBackground),
            ),
            borderWidth: 2,
          },
        ],
      }}
    />
  );
}

export function CamembertChart({
  items,
  presentation,
}: {
  items: readonly NamedCount[];
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const legende = presentation?.legende ?? true;
  return (
    <Doughnut
      options={{ ...partageOptions(theme, reducedMotion, legende, 'right'), cutout: '0%' }}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            data: items.map((item) => item.value),
            backgroundColor: items.map((_, index) =>
              paletteFill(theme, presentation?.palette, index),
            ),
            borderColor: items.map((_, index) =>
              paletteBorder(theme, presentation?.palette, index, theme.tooltipBackground),
            ),
            borderWidth: 2,
          },
        ],
      }}
    />
  );
}

export function AirePolaireChart({
  items,
  presentation,
}: {
  items: readonly NamedCount[];
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const legende = presentation?.legende ?? false;
  const options: ChartOptions<'polarArea'> = {
    ...baseOptions(theme, reducedMotion),
    scales: radialScale(theme),
    plugins: {
      ...baseOptions(theme, reducedMotion).plugins,
      legend: { display: legende, position: 'top', labels: { color: theme.tick } },
    },
  };
  return (
    <PolarArea
      options={options}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            data: items.map((item) => item.value),
            backgroundColor: items.map((_, index) =>
              presentation?.palette === undefined || presentation.palette === 'serie'
                ? `color-mix(in srgb, ${seriesColor(theme, index)} 55%, transparent)`
                : paletteFill(theme, presentation.palette, index),
            ),
            borderColor: items.map((_, index) =>
              paletteBorder(theme, presentation?.palette, index, seriesColor(theme, index)),
            ),
            borderWidth: 1,
          },
        ],
      }}
    />
  );
}

export function RadarChart({
  items,
  presentation,
}: {
  items: readonly NamedCount[];
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const accent = paletteFill(theme, presentation?.palette, 0);
  const options: ChartOptions<'radar'> = {
    ...baseOptions(theme, reducedMotion),
    scales: radialScale(theme),
    plugins: { ...baseOptions(theme, reducedMotion).plugins, legend: { display: false } },
  };
  return (
    <Radar
      options={options}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            data: items.map((item) => item.value),
            borderColor: accent,
            backgroundColor: `color-mix(in srgb, ${accent} 20%, transparent)`,
            borderWidth: 2,
          },
        ],
      }}
    />
  );
}

function matriceCoordonnees(matrice: MatriceDatum) {
  return matrice.cellules
    .filter((cellule) => cellule.value > 0)
    .map((cellule) => ({
      x: matrice.colonnes.indexOf(cellule.colonne),
      y: matrice.lignes.indexOf(cellule.ligne),
      value: cellule.value,
    }));
}

export function NuageChart({
  matrice,
  presentation,
}: {
  matrice: MatriceDatum;
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const options: ChartOptions<'scatter'> = {
    ...baseOptions(theme, reducedMotion),
    scales: {
      x: {
        ...axisScales(theme).x,
        ticks: { ...axisScales(theme).x.ticks, callback: (v) => matrice.colonnes[Number(v)] ?? '' },
      },
      y: {
        ...axisScales(theme).y,
        ticks: { ...axisScales(theme).y.ticks, callback: (v) => matrice.lignes[Number(v)] ?? '' },
      },
    },
  };
  return (
    <Scatter
      options={options}
      data={{
        datasets: [
          {
            label: 'Visites',
            data: matriceCoordonnees(matrice),
            backgroundColor: paletteFill(theme, presentation?.palette, 0),
          },
        ],
      }}
    />
  );
}

export function BullesChart({
  matrice,
  presentation,
}: {
  matrice: MatriceDatum;
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const points = matriceCoordonnees(matrice);
  const max = Math.max(1, ...points.map((point) => point.value));
  const accent = paletteFill(theme, presentation?.palette, 0);
  const options: ChartOptions<'bubble'> = {
    ...baseOptions(theme, reducedMotion),
    scales: {
      x: {
        ...axisScales(theme).x,
        ticks: { ...axisScales(theme).x.ticks, callback: (v) => matrice.colonnes[Number(v)] ?? '' },
      },
      y: {
        ...axisScales(theme).y,
        ticks: { ...axisScales(theme).y.ticks, callback: (v) => matrice.lignes[Number(v)] ?? '' },
      },
    },
  };
  return (
    <Bubble
      options={options}
      data={{
        datasets: [
          {
            label: 'Visites',
            data: points.map((point) => ({
              x: point.x,
              y: point.y,
              r: 4 + (point.value / max) * 16,
            })),
            backgroundColor: `color-mix(in srgb, ${accent} 55%, transparent)`,
            borderColor: accent,
          },
        ],
      }}
    />
  );
}

export function MixteChart({ items, label = 'Visites', presentation }: ItemsChartProps) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const legende = presentation?.legende ?? true;
  const cumulatif = items.reduce<number[]>(
    (suite, item) => [...suite, (suite.at(-1) ?? 0) + item.value],
    [],
  );
  const options: ChartOptions<'bar' | 'line'> = {
    ...baseOptions(theme, reducedMotion),
    scales: {
      x: axisScales(theme).x,
      y: { ...axisScales(theme).y, position: 'left' },
      yCumul: {
        position: 'right',
        grid: { display: false },
        border: { display: false },
        ticks: { color: theme.tick },
      },
    },
    plugins: {
      ...baseOptions(theme, reducedMotion).plugins,
      legend: { display: legende, position: 'top', labels: { color: theme.tick } },
    },
  };
  const data: ChartData<'bar' | 'line', number[], string> = {
    labels: items.map((item) => item.label),
    datasets: [
      {
        type: 'bar' as const,
        label,
        data: items.map((item) => item.value),
        backgroundColor: paletteFill(theme, presentation?.palette, 0),
        borderRadius: 6,
        maxBarThickness: 28,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'line' as const,
        label: 'Cumul',
        data: cumulatif,
        borderColor: paletteBorder(theme, presentation?.palette, 1, seriesColor(theme, 1)),
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        yAxisID: 'yCumul',
        order: 1,
      },
    ],
  };
  return (
    <MixedChart
      type="bar"
      options={options}
      data={data}
      plugins={valeursPlugins(theme, presentation?.valeurs)}
    />
  );
}

export function JaugeChart({
  valeur,
  max,
  libelle,
  presentation,
}: {
  valeur: number;
  max: number;
  libelle: string;
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const borne = Math.max(max, valeur, 1);
  const options: ChartOptions<'doughnut'> = {
    ...baseOptions(theme, reducedMotion),
    circumference: 180,
    rotation: 270,
    cutout: '70%',
    plugins: { ...baseOptions(theme, reducedMotion).plugins, legend: { display: false } },
  };
  return (
    <div className="relative flex h-full items-center justify-center">
      <Doughnut
        options={options}
        data={{
          labels: [libelle, 'Reste'],
          datasets: [
            {
              data: [valeur, Math.max(0, borne - valeur)],
              backgroundColor: [paletteFill(theme, presentation?.palette, 0), theme.grid],
              borderWidth: 0,
            },
          ],
        }}
      />
      <p className="absolute bottom-2 font-display text-[1.5rem] font-[800] tabular-nums">
        {formatNumber(valeur)}
      </p>
    </div>
  );
}

export function CarteDeChaleurTable({
  matrice,
  caption,
}: {
  matrice: MatriceDatum;
  caption: string;
}) {
  const max = Math.max(1, ...matrice.cellules.map((cellule) => cellule.value));
  const valeurDe = (ligne: string, colonne: string) =>
    matrice.cellules.find((cellule) => cellule.ligne === ligne && cellule.colonne === colonne)
      ?.value ?? 0;

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- zone défilable au clavier
    <div className="h-full overflow-auto" tabIndex={0}>
      <table className="w-full border-collapse text-[0.75rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Ligne</span>
            </th>
            {matrice.colonnes.map((colonne) => (
              <th
                key={colonne}
                scope="col"
                className="px-1.5 py-1 text-center font-[600] whitespace-nowrap"
              >
                {colonne}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrice.lignes.map((ligne) => (
            <tr key={ligne}>
              <th scope="row" className="px-1.5 py-1 text-left font-[600] whitespace-nowrap">
                {ligne}
              </th>
              {matrice.colonnes.map((colonne) => {
                const valeur = valeurDe(ligne, colonne);
                const opacite = valeur === 0 ? 0 : 0.15 + (valeur / max) * 0.75;
                return (
                  <td
                    key={colonne}
                    className="px-1.5 py-1 text-center tabular-nums"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--chart-1) ${String(opacite * 100)}%, transparent)`,
                    }}
                  >
                    {valeur === 0 ? '' : valeur}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableauWidget({
  items,
  entete,
  caption,
}: {
  items: readonly NamedCount[];
  entete: string;
  caption: string;
}) {
  const total = items.reduce((somme, item) => somme + item.value, 0);
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- zone défilable au clavier
    <div className="h-full overflow-auto" tabIndex={0}>
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border">
          <tr>
            <th scope="col" className="px-2 py-1.5 text-left font-[600]">
              {entete}
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-[600]">
              Visites
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-[600]">
              Part
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.id}>
              <th scope="row" className="px-2 py-1.5 text-left font-[400]">
                {item.label}
              </th>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(item.value)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {total === 0 ? '0 %' : `${String(Math.round((item.value / total) * 100))} %`}
              </td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-2 py-6 text-center text-muted-foreground">
                Aucune donnée sur la période.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Le tableau d'équipe : une ligne par personne, des colonnes d'unités
 * différentes. Les cellules arrivent déjà mises en forme, la source seule
 * sachant ce qui est un compte et ce qui est un pourcentage.
 */
export function TableauEquipe({ donnee, caption }: { donnee: EquipeDatum; caption: string }) {
  if (donnee.lignes.length === 0) {
    return <EmptyChart message="Personne n’a travaillé sur la période." />;
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- zone défilable au clavier
    <div className="h-full overflow-auto" tabIndex={0}>
      <table className="min-w-[42rem] w-full text-[0.875rem]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 border-b border-border bg-card">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-[600]">
              Téléconseiller
            </th>
            {donnee.colonnes.map((colonne) => (
              <th key={colonne} scope="col" className="px-3 py-2 text-right font-[600]">
                {colonne}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {donnee.lignes.map((ligne) => (
            <tr key={ligne.id}>
              <th scope="row" className="px-3 py-2 text-left font-[400]">
                {ligne.nom}
              </th>
              {ligne.cellules.map((cellule) => (
                <td key={cellule.cle} className="px-3 py-2 text-right tabular-nums">
                  {cellule.texte}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {donnee.pied === undefined ? null : (
          <tfoot className="sticky bottom-0 border-t border-border bg-card font-[600]">
            <tr>
              <th scope="row" className="px-3 py-2 text-left">
                {donnee.pied.nom}
              </th>
              {donnee.pied.cellules.map((cellule) => (
                <td key={cellule.cle} className="px-3 py-2 text-right tabular-nums">
                  {cellule.texte}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function TuileWidget({
  valeur,
  affichage,
  libelle,
  detail,
}: {
  valeur: number;
  affichage?: ScalaireDatum['affichage'];
  libelle: string;
  detail?: string | undefined;
}) {
  const grand = affichage ?? { valeur, format: formatNumber };
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="font-display text-[2.25rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
        {typeof grand === 'string' ? (
          grand
        ) : (
          <AnimatedNumber value={grand.valeur} format={grand.format} />
        )}
      </p>
      {detail === undefined ? null : (
        <p className="mt-2 text-[0.8125rem] text-muted-foreground">{detail}</p>
      )}
      <span className="sr-only">{libelle}</span>
    </div>
  );
}

export function TuileCourbeWidget({
  valeur,
  libelle,
  serie,
  presentation,
}: {
  valeur: number;
  libelle: string;
  serie: readonly NamedCount[];
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const accent = paletteFill(theme, presentation?.palette, 0);
  const options: ChartOptions<'line'> = {
    ...baseOptions(theme, reducedMotion),
    scales: { x: { display: false }, y: { display: false } },
    elements: { point: { radius: 0 } },
  };
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <p className="font-display text-[2.25rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
        <AnimatedNumber value={valeur} />
      </p>
      <div className="h-16">
        <Line
          options={options}
          data={{
            labels: serie.map((point) => point.label),
            datasets: [
              {
                data: serie.map((point) => point.value),
                borderColor: accent,
                backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`,
                borderWidth: 2,
                fill: true,
                tension: 0.3,
              },
            ],
          }}
        />
      </div>
      <span className="sr-only">{libelle}</span>
    </div>
  );
}
