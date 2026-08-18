'use client';

import type { ChartOptions } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

import '@/components/dashboard/chart-setup';

import { seriesBorderColor, seriesColor, useChartTheme, type ChartTheme } from '@/lib/chart-theme';
import { formatNumber, formatShortDate } from '@/lib/format';
import type { NamedCount, TimeSeriePoint } from '@/lib/types';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

function baseOptions(theme: ChartTheme, reducedMotion: boolean) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion ? (false as const) : { duration: 220 },
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

export function ProspectsTrendChart({ points }: { points: readonly TimeSeriePoint[] }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const accent = seriesColor(theme, 0);

  const options: ChartOptions<'line'> = {
    ...baseOptions(theme, reducedMotion),
    scales: axisScales(theme, false),
    interaction: { mode: 'index', intersect: false },
    elements: { point: { radius: 0, hitRadius: 12, hoverRadius: 4 } },
  };

  return (
    <Line
      options={options}
      data={{
        labels: points.map((p) => formatShortDate(p.date)),
        datasets: [
          {
            label: 'Prospects cumulés',
            data: points.map((p) => p.cumulative),
            borderColor: accent,
            backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
          },
        ],
      }}
    />
  );
}

export function RankBarChart({ items, label }: { items: readonly NamedCount[]; label: string }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();

  const options: ChartOptions<'bar'> = {
    ...baseOptions(theme, reducedMotion),
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

export function CategoryBarChart({
  items,
  label,
}: {
  items: readonly NamedCount[];
  label: string;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();

  const options: ChartOptions<'bar'> = {
    ...baseOptions(theme, reducedMotion),
    scales: axisScales(theme, false),
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
            maxBarThickness: 42,
          },
        ],
      }}
    />
  );
}

export function ShareDoughnutChart({ items }: { items: readonly NamedCount[] }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const total = items.reduce((sum, item) => sum + item.value, 0);

  const options: ChartOptions<'doughnut'> = {
    ...baseOptions(theme, reducedMotion),
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
