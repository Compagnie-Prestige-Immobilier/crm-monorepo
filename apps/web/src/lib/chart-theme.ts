'use client';

import { useEffect, useState } from 'react';

/**
 * Thème des graphiques.
 *
 * Chart.js peint dans un `<canvas>` : les classes Tailwind et les variables CSS
 * ne l'atteignent pas. Les couleurs doivent lui être passées en valeurs
 * littérales. On les LIT donc sur `document.documentElement` au lieu de les
 * recopier en dur, pour que la source reste `globals.css` — et pour que la
 * bascule clair/sombre reteinte réellement les graphes plutôt que de laisser un
 * bordeaux #630210 illisible sur fond #140206.
 *
 * QUAND relire, et pourquoi `resolvedTheme` ne suffit pas.
 *
 * `next-themes` pose la classe `.dark` sur `<html>` depuis SON PROPRE effet,
 * dans le `ThemeProvider`. React vide les effets passifs des ENFANTS D'ABORD.
 * Un effet dépendant de `resolvedTheme`, monté dans un graphique — donc sous le
 * provider —, s'exécutait donc AVANT que la classe ne change :
 *
 *   1. `setTheme('dark')` : le contexte change, les graphiques re-rendent ;
 *   2. l'effet du graphique lit `getComputedStyle(document.documentElement)`
 *      — mais `<html>` porte encore la classe CLAIRE ;
 *   3. la palette claire est rangée dans l'état, étiquetée « sombre » ;
 *   4. l'effet du provider ajoute enfin `.dark` — plus rien ne relit.
 *
 * Résultat observé : les graphiques restaient en permanence UNE bascule en
 * retard — bordeaux #630210 sur fond #140206 en sombre, soit exactement ce que
 * ce module existe pour empêcher. Un `useLayoutEffect` n'y changerait rien : les
 * effets de disposition sont eux aussi vidés enfant d'abord.
 *
 * On observe donc l'attribut `class` de `<html>` directement. Le
 * `MutationObserver` se déclenche APRÈS la mutation, quel que soit l'ordre des
 * effets, et couvre aussi une bascule venue d'un autre onglet.
 */

export interface ChartTheme {
  /** chart-1..5 dans l'ordre. Au-delà, on regroupe en « Autres » (design.md §2.6). */
  series: readonly string[];
  grid: string;
  tick: string;
  tooltipBackground: string;
  tooltipForeground: string;
  border: string;
  /** `--accent-border` (#A87A15). Contour obligatoire de la série or, §2.6. */
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

/** Lit la palette courante sur `<html>`. À n'appeler que côté navigateur. */
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
  /**
   * Initialiseur PARESSEUX plutôt que `LIGHT_FALLBACK` sec.
   *
   * Au premier rendu client, `next-themes` a déjà posé la classe via son script
   * bloquant injecté dans le `<head>` : la lecture est donc juste, et le
   * premier tracé en mode sombre ne passe plus par un éclair de palette claire.
   * Le rendu serveur, lui, n'a pas de `document` et garde le repli.
   */
  const [theme, setTheme] = useState<ChartTheme>(() =>
    typeof document === 'undefined' ? LIGHT_FALLBACK : readChartTheme(),
  );

  useEffect(() => {
    const sync = () => {
      // Comparaison avant écriture : la classe de `<html>` change aussi pour
      // des raisons étrangères au thème, et re-rendre six graphiques à chaque
      // mutation coûterait cher pour rien.
      setTheme((current) => {
        const next = readChartTheme();
        return sameTheme(current, next) ? current : next;
      });
    };

    // Rattrape l'écart entre le rendu serveur et la classe réellement posée.
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

/** Couleur de la n-ième série, en bouclant si jamais on dépassait 5. */
export function seriesColor(theme: ChartTheme, index: number): string {
  return theme.series[index % theme.series.length] ?? LIGHT_FALLBACK.series[0] ?? '#630210';
}

/** Rang de la série or dans `chart-1..5`. */
const GOLD_SERIES_INDEX = 1;

/**
 * Contour d'une surface de graphique.
 *
 * `chart-2` est l'or `#C8921A`, à 2,77:1 sur blanc. Son emploi comme SURFACE
 * est une exception explicitement encadrée par design.md §2.6, et la première
 * des trois conditions qui la rendent acceptable est un contour
 * `accent-border` `#A87A15` (3,85:1) : c'est ce trait, et non le remplissage,
 * qui délimite la forme. Sans lui, l'or redevient interdit.
 *
 * Les autres séries reprennent le repli fourni par l'appelant — la couleur de
 * la carte pour un anneau, la couleur de la série pour une barre.
 */
export function seriesBorderColor(theme: ChartTheme, index: number, fallback: string): string {
  return index % theme.series.length === GOLD_SERIES_INDEX ? theme.accentBorder : fallback;
}
