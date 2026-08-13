'use client';

import { BarController, LineController, type ChartData, type ChartOptions } from 'chart.js';
import { Bar, Chart as MixedChart, Doughnut } from 'react-chartjs-2';

import { Chart } from '@/components/dashboard/chart-setup';

/**
 * Contrôleurs du graphe MIXTE (barres + ligne).
 *
 * `chart-setup` n'enregistre que des éléments. Les composants typés de
 * react-chartjs-2 (`Bar`, `Doughnut`) enregistrent LEUR contrôleur à
 * l'importation ; le composant générique `Chart`, lui, n'en enregistre aucun.
 * Sans ces deux lignes, le graphe des encaissements lève « bar is not a
 * registered controller » à l'exécution — et seulement à l'exécution.
 */
Chart.register(BarController, LineController);

import {
  seriesBorderColor,
  seriesColor,
  useChartTheme,
  type ChartTheme,
} from '@/lib/chart-theme';
import { formatNumber, formatShortDate } from '@/lib/format';
import { formatXof, xofToChartNumber } from '@/lib/money';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

/**
 * Graphiques de Banque & Finance.
 *
 * Deux choses les distinguent de ceux du tableau de bord des prospects :
 *
 * 1. Ils sont CLIQUABLES. Un segment renvoie vers la liste filtrée sur ce même
 *    segment — « 42 rejets pour document manquant » mène aux 42 dossiers. Sans
 *    cela, l'agent lit un chiffre puis refait le filtre à la main, ce qui
 *    produit régulièrement une sélection différente de celle du graphique.
 * 2. Les montants passent par `xofToChartNumber`. C'est le SEUL endroit du
 *    panel où un montant devient un `number` — Chart.js ne trace rien d'autre —
 *    et la conversion est nommée pour ça. Tout ce qui est ÉCRIT (info-bulles,
 *    axes, totaux) repart de la chaîne d'origine via `formatXof`.
 *
 * Les couleurs sont lues sur `<html>` par `useChartTheme` (MutationObserver) :
 * un `<canvas>` n'est atteint ni par une classe Tailwind ni par une variable
 * CSS.
 */

/** Options communes. `onSelect` branche le clic sur un index de catégorie. */
function baseOptions(
  theme: ChartTheme,
  reducedMotion: boolean,
  onSelect?: (index: number) => void,
) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    // `prefers-reduced-motion` ne peut PAS atteindre un canvas depuis le CSS :
    // Chart.js anime en JavaScript. On coupe donc l'option ici, explicitement.
    animation: reducedMotion ? (false as const) : { duration: 220 },
    ...(onSelect === undefined
      ? {}
      : {
          onClick: (_event: unknown, elements: readonly { index: number }[]): void => {
            const first = elements[0];
            if (first !== undefined) onSelect(first.index);
          },
          onHover: (event: { native?: Event | null }, elements: readonly unknown[]): void => {
            const target = event.native?.target;
            if (target instanceof HTMLElement) {
              target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
            }
          },
        }),
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.tooltipBackground,
        titleColor: theme.tooltipForeground,
        bodyColor: theme.tooltipForeground,
        borderColor: theme.border,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
      },
    },
  };
}

function axisScales(theme: ChartTheme, horizontal: boolean) {
  const value = {
    beginAtZero: true,
    grid: { color: theme.grid, drawTicks: false },
    border: { display: false },
    ticks: { color: theme.tick, font: { size: 11 }, padding: 6 },
  };
  const category = {
    grid: { display: false },
    border: { color: theme.border },
    ticks: { color: theme.tick, font: { size: 11 }, autoSkipPadding: 12 },
  };
  return horizontal ? { x: value, y: category } : { x: category, y: value };
}

export interface ClickableSlice {
  label: string;
  value: number;
  /** Appelé au clic. Absent = tranche non cliquable. */
  onSelect?: (() => void) | undefined;
}

/** Barres horizontales cliquables — répartition par étape, par motif, par agent. */
export function BankRankChart({
  items,
  label,
}: {
  items: readonly ClickableSlice[];
  label: string;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();

  const options: ChartOptions<'bar'> = {
    ...baseOptions(theme, reducedMotion, (index) => {
      items[index]?.onSelect?.();
    }),
    indexAxis: 'y',
    scales: axisScales(theme, true),
  };

  return (
    <Bar
      options={options}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            label,
            data: items.map((item) => item.value),
            backgroundColor: items.map((_, index) => seriesColor(theme, index)),
            // §2.6 : la série or ne tient que par son contour `accent-border`.
            borderColor: items.map((_, index) =>
              seriesBorderColor(theme, index, seriesColor(theme, index)),
            ),
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
            barThickness: 18,
          },
        ],
      }}
    />
  );
}

/** Anneau cliquable — part d'étape ou de banque. */
export function BankShareChart({ items }: { items: readonly ClickableSlice[] }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const total = items.reduce((sum, item) => sum + item.value, 0);

  const options: ChartOptions<'doughnut'> = {
    ...baseOptions(theme, reducedMotion, (index) => {
      items[index]?.onSelect?.();
    }),
    cutout: '62%',
    plugins: {
      ...baseOptions(theme, reducedMotion).plugins,
      legend: {
        display: true,
        position: 'right',
        labels: {
          color: theme.tick,
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 11 },
          padding: 12,
        },
      },
      tooltip: {
        ...baseOptions(theme, reducedMotion).plugins.tooltip,
        callbacks: {
          label: (context) => {
            const value = context.parsed;
            const share = total === 0 ? 0 : Math.round((value / total) * 100);
            return ` ${context.label}: ${formatNumber(value)} (${String(share)} %)`;
          },
        },
      },
    },
  };

  return (
    <Doughnut
      options={options}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            data: items.map((item) => item.value),
            backgroundColor: items.map((_, index) => seriesColor(theme, index)),
            // La part or prend `accent-border` (§2.6) : un séparateur couleur
            // carte ne la délimiterait pas sur un fond clair.
            borderColor: items.map((_, index) =>
              seriesBorderColor(theme, index, theme.tooltipBackground),
            ),
            borderWidth: 2,
          },
        ],
      }}
    />
  );
}

/**
 * Encaissements dans le temps : NOMBRE en barres, MONTANT en ligne.
 *
 * Deux axes verticaux, et c'est nécessaire ici : trois encaissements à
 * 40 millions et quarante encaissements à 200 000 francs racontent deux
 * histoires opposées, et un seul axe écraserait l'une des deux courbes contre
 * le zéro. L'info-bulle du montant repart de la CHAÎNE : `formatXof` sur la
 * valeur d'origine, jamais un `toLocaleString` sur le nombre tracé.
 */
export function CashingsOverTimeChart({
  buckets,
}: {
  buckets: readonly { bucket: string; cases: number; amountXof: string }[];
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();

  // `'bar' | 'line'` : le type UNION est ce qui autorise un jeu de données
  // `line` dans un graphe `bar`. Typé `'bar'` seul, TypeScript refuse le
  // second jeu — à raison, puisqu'il n'appartient pas au même contrôleur.
  const options: ChartOptions<'bar' | 'line'> = {
    ...baseOptions(theme, reducedMotion),
    scales: {
      x: {
        grid: { display: false },
        border: { color: theme.border },
        ticks: { color: theme.tick, font: { size: 11 }, autoSkipPadding: 12 },
      },
      y: {
        beginAtZero: true,
        position: 'left',
        grid: { color: theme.grid, drawTicks: false },
        border: { display: false },
        ticks: { color: theme.tick, font: { size: 11 }, precision: 0 },
        title: { display: true, text: 'Nombre', color: theme.tick, font: { size: 11 } },
      },
      yAmount: {
        beginAtZero: true,
        position: 'right',
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: theme.tick,
          font: { size: 11 },
          callback: (value) => formatNumber(Number(value)),
        },
        title: { display: true, text: 'FCFA', color: theme.tick, font: { size: 11 } },
      },
    },
    plugins: {
      ...baseOptions(theme, reducedMotion).plugins,
      tooltip: {
        ...baseOptions(theme, reducedMotion).plugins.tooltip,
        callbacks: {
          label: (context) => {
            if (context.datasetIndex === 1) {
              const raw = buckets[context.dataIndex]?.amountXof ?? '0';
              return ` Montant : ${formatXof(raw)}`;
            }
            return ` Encaissements : ${formatNumber(context.parsed.y ?? 0)}`;
          },
        },
      },
    },
  };

  const data: ChartData<'bar' | 'line', number[], string> = {
    labels: buckets.map((point) => formatShortDate(point.bucket.slice(0, 10))),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Encaissements',
        data: buckets.map((point) => point.cases),
        backgroundColor: seriesColor(theme, 0),
        borderColor: seriesBorderColor(theme, 0, seriesColor(theme, 0)),
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 28,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'line' as const,
        label: 'Montant',
        data: buckets.map((point) => xofToChartNumber(point.amountXof)),
        // Le trait de la courbe EST son contour : il prend donc
        // `accent-border`, seule teinte or autorisée pour un tracé (§2.6).
        borderColor: seriesBorderColor(theme, 1, seriesColor(theme, 1)),
        backgroundColor: seriesColor(theme, 1),
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 12,
        yAxisID: 'yAmount',
        order: 1,
      },
    ],
  };

  return <MixedChart type="bar" options={options} data={data} />;
}

/** Délai moyen de traitement par banque, en heures. */
export function MeanDelayChart({ items }: { items: readonly { label: string; hours: number }[] }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();

  const options: ChartOptions<'bar'> = {
    ...baseOptions(theme, reducedMotion),
    indexAxis: 'y',
    scales: axisScales(theme, true),
    plugins: {
      ...baseOptions(theme, reducedMotion).plugins,
      tooltip: {
        ...baseOptions(theme, reducedMotion).plugins.tooltip,
        callbacks: {
          // En heures ET en jours : « 137 heures » ne parle à personne, « 5,7
          // jours » se compare à un engagement de délai.
          label: (context) =>
            ` ${formatNumber(Math.round(context.parsed.x ?? 0))} h (${((context.parsed.x ?? 0) / 24).toFixed(1)} j)`,
        },
      },
    },
  };

  return (
    <Bar
      options={options}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            label: 'Heures',
            data: items.map((item) => item.hours),
            backgroundColor: items.map((_, index) => seriesColor(theme, index)),
            // §2.6 : la série or ne tient que par son contour `accent-border`.
            borderColor: items.map((_, index) =>
              seriesBorderColor(theme, index, seriesColor(theme, index)),
            ),
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
            barThickness: 18,
          },
        ],
      }}
    />
  );
}
