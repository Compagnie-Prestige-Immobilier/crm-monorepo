'use client';

import { useEffect, useState } from 'react';

export interface ChartTheme {
  series: readonly string[];
  grid: string;
  tick: string;
  tooltipBackground: string;
  tooltipForeground: string;
  border: string;
  accentBorder: string;
}

const LIGHT_FALLBACK: ChartTheme = {
  series: ['#630210', '#C8921A', '#1A6B44', '#B05070', '#8B5CF6'],
  grid: 'rgba(99,2,16,0.10)',
  tick: '#6B4A52',
  tooltipBackground: '#FFFFFF',
  tooltipForeground: '#1C0810',
  border: 'rgba(99,2,16,0.12)',
  accentBorder: '#A87A15',
};

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value === '' ? fallback : value;
}

function readChartTheme(): ChartTheme {
  const styles = getComputedStyle(document.documentElement);
  return {
    series: [
      readVar(styles, '--chart-1', LIGHT_FALLBACK.series[0] ?? '#630210'),
      readVar(styles, '--chart-2', LIGHT_FALLBACK.series[1] ?? '#C8921A'),
      readVar(styles, '--chart-3', LIGHT_FALLBACK.series[2] ?? '#1A6B44'),
      readVar(styles, '--chart-4', LIGHT_FALLBACK.series[3] ?? '#B05070'),
      readVar(styles, '--chart-5', LIGHT_FALLBACK.series[4] ?? '#8B5CF6'),
    ],
    grid: readVar(styles, '--chart-grid', LIGHT_FALLBACK.grid),
    tick: readVar(styles, '--chart-tick', LIGHT_FALLBACK.tick),
    tooltipBackground: readVar(styles, '--popover', LIGHT_FALLBACK.tooltipBackground),
    tooltipForeground: readVar(styles, '--popover-foreground', LIGHT_FALLBACK.tooltipForeground),
    border: readVar(styles, '--border', LIGHT_FALLBACK.border),
    accentBorder: readVar(styles, '--accent-border', LIGHT_FALLBACK.accentBorder),
  };
}

function sameTheme(a: ChartTheme, b: ChartTheme): boolean {
  return (
    a.grid === b.grid &&
    a.tick === b.tick &&
    a.tooltipBackground === b.tooltipBackground &&
    a.tooltipForeground === b.tooltipForeground &&
    a.border === b.border &&
    a.accentBorder === b.accentBorder &&
    a.series.length === b.series.length &&
    a.series.every((color, index) => color === b.series[index])
  );
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() =>
    typeof document === 'undefined' ? LIGHT_FALLBACK : readChartTheme(),
  );

  useEffect(() => {
    const sync = () => {
      setTheme((current) => {
        const next = readChartTheme();
        return sameTheme(current, next) ? current : next;
      });
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  return theme;
}

export function seriesColor(theme: ChartTheme, index: number): string {
  return theme.series[index % theme.series.length] ?? LIGHT_FALLBACK.series[0] ?? '#630210';
}

const GOLD_SERIES_INDEX = 1;

export function seriesBorderColor(theme: ChartTheme, index: number, fallback: string): string {
  return index % theme.series.length === GOLD_SERIES_INDEX ? theme.accentBorder : fallback;
}
