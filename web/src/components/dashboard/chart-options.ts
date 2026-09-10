import type { ChartTheme } from '@/lib/chart-theme';
import { formatNumber } from '@/lib/format';

export interface AxisOptions {
  /** Axe horizontal : l'axe des valeurs est `x`, celui des catégories `y`. */
  horizontal?: boolean;
  /**
   * L'axe compte des entités, jamais des fractions.
   *
   * Sans `precision`, une série entièrement nulle fait choisir à Chart.js
   * l'intervalle 0→1 et écrire « 0,2 / 0,4 » sur un axe qui compte des visites.
   */
  entier?: boolean;
  /** Empile les deux axes : composition, part de 100 %. */
  empile?: boolean;
}

export function baseOptions(
  theme: ChartTheme,
  reducedMotion: boolean,
  onSelect?: (index: number) => void,
) {
  return {
    responsive: true,
    maintainAspectRatio: false,
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

export function axisScales(theme: ChartTheme, options: AxisOptions = {}) {
  const { horizontal = false, entier = true, empile = false } = options;
  const value = {
    beginAtZero: true,
    stacked: empile,
    grid: { color: theme.grid, drawTicks: false },
    border: { display: false },
    ticks: {
      color: theme.tick,
      font: { size: 11 },
      padding: 6,
      ...(entier ? { precision: 0 } : {}),
      callback: (tick: string | number): string => formatNumber(Number(tick)),
    },
  };
  const category = {
    stacked: empile,
    grid: { display: false },
    border: { color: theme.border },
    ticks: { color: theme.tick, font: { size: 11 }, autoSkipPadding: 12 },
  };
  return horizontal ? { x: value, y: category } : { x: category, y: value };
}

/**
 * L'axe radial d'un radar ou d'une aire polaire : un seul axe, ni catégorie ni
 * valeur, et sa grille est un réseau de cercles et non de lignes.
 */
export function radialScale(theme: ChartTheme, entier = true) {
  return {
    r: {
      beginAtZero: true,
      grid: { color: theme.grid },
      angleLines: { color: theme.grid },
      pointLabels: { color: theme.tick, font: { size: 11 } },
      ticks: {
        color: theme.tick,
        font: { size: 10 },
        backdropColor: 'transparent',
        ...(entier ? { precision: 0 } : {}),
      },
    },
  };
}
