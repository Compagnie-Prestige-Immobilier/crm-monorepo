'use client';

import type { ChartData, ChartOptions } from 'chart.js';
import { Bar, Chart as MixedChart, Doughnut } from 'react-chartjs-2';

import '@/components/dashboard/chart-setup';

import { axisScales, baseOptions } from '@/components/dashboard/chart-options';
import { seriesBorderColor, seriesColor, useChartTheme } from '@/lib/chart-theme';
import { formatNumber, formatShortDate } from '@/lib/format';
import { formatXof, formatXofAxisTick, xofToChartNumber } from '@/lib/money';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

export interface ClickableSlice {
  label: string;
  value: number;
  onSelect?: (() => void) | undefined;
}

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
    scales: axisScales(theme, { horizontal: true }),
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

export function CashingsOverTimeChart({
  buckets,
}: {
  buckets: readonly { bucket: string; cases: number; amountXof: string }[];
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();

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
          callback: (value) => formatXofAxisTick(Number(value)),
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

export function MeanDelayChart({ items }: { items: readonly { label: string; hours: number }[] }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();

  const options: ChartOptions<'bar'> = {
    ...baseOptions(theme, reducedMotion),
    indexAxis: 'y',
    scales: axisScales(theme, { horizontal: true }),
    plugins: {
      ...baseOptions(theme, reducedMotion).plugins,
      tooltip: {
        ...baseOptions(theme, reducedMotion).plugins.tooltip,
        callbacks: {
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
