import type { ChartTheme } from '@/components/tableau-de-bord/theme';
import { formatNumber } from '@/lib/format';

export interface OptionsAxes {
  /** Axe horizontal : l'axe des valeurs est `x`, celui des catégories `y`. */
  horizontal?: boolean;
  /**
   * L'axe compte des entités, jamais des fractions. Sans `precision`, une série
   * entièrement nulle fait choisir l'intervalle 0→1 et écrire « 0,2 » sur un axe
   * qui compte des visites.
   */
  entier?: boolean;
  empile?: boolean;
}

export function optionsBase(
  theme: ChartTheme,
  mouvementReduit: boolean,
  onSelect?: (index: number) => void,
) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: mouvementReduit ? (false as const) : { duration: 220 },
    ...(onSelect === undefined
      ? {}
      : {
          onClick: (_evenement: unknown, elements: readonly { index: number }[]): void => {
            const premier = elements[0];
            if (premier !== undefined) onSelect(premier.index);
          },
          onHover: (evenement: { native?: Event | null }, elements: readonly unknown[]): void => {
            const cible = evenement.native?.target;
            if (cible instanceof HTMLElement) {
              cible.style.cursor = elements.length > 0 ? 'pointer' : 'default';
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

export function echellesAxes(theme: ChartTheme, options: OptionsAxes = {}) {
  const { horizontal = false, entier = true, empile = false } = options;
  const valeur = {
    beginAtZero: true,
    stacked: empile,
    grid: { color: theme.grid, drawTicks: false },
    border: { display: false },
    ticks: {
      color: theme.tick,
      font: { size: 11 },
      padding: 6,
      ...(entier ? { precision: 0 } : {}),
      callback: (graduation: string | number): string => formatNumber(Number(graduation)),
    },
  };
  const categorie = {
    stacked: empile,
    grid: { display: false },
    border: { color: theme.border },
    ticks: { color: theme.tick, font: { size: 11 }, autoSkipPadding: 12 },
  };
  return horizontal ? { x: valeur, y: categorie } : { x: categorie, y: valeur };
}

/** L'axe d'un radar ou d'une rosace : un seul axe, et une grille en cercles. */
export function echelleRadiale(theme: ChartTheme, entier = true) {
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

export function legende(theme: ChartTheme, affichee: boolean, position: 'top' | 'right' = 'top') {
  return {
    display: affichee,
    position,
    labels: {
      color: theme.tick,
      boxWidth: 10,
      boxHeight: 10,
      usePointStyle: true,
      font: { size: 11 },
    },
  } as const;
}
