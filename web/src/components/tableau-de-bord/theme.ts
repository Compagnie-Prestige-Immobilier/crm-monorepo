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

const CLAIR: ChartTheme = {
  series: ['#630210', '#C8921A', '#1A6B44', '#B05070', '#8B5CF6'],
  grid: 'rgba(99,2,16,0.10)',
  tick: '#6B4A52',
  tooltipBackground: '#FFFFFF',
  tooltipForeground: '#1C0810',
  border: 'rgba(99,2,16,0.12)',
  accentBorder: '#A87A15',
};

function lire(styles: CSSStyleDeclaration, nom: string, repli: string): string {
  const valeur = styles.getPropertyValue(nom).trim();
  return valeur === '' ? repli : valeur;
}

function lireTheme(): ChartTheme {
  const styles = getComputedStyle(document.documentElement);
  return {
    series: CLAIR.series.map((repli, index) => lire(styles, `--chart-${String(index + 1)}`, repli)),
    grid: lire(styles, '--chart-grid', CLAIR.grid),
    tick: lire(styles, '--chart-tick', CLAIR.tick),
    tooltipBackground: lire(styles, '--popover', CLAIR.tooltipBackground),
    tooltipForeground: lire(styles, '--popover-foreground', CLAIR.tooltipForeground),
    border: lire(styles, '--border', CLAIR.border),
    accentBorder: lire(styles, '--accent-border', CLAIR.accentBorder),
  };
}

function memeTheme(a: ChartTheme, b: ChartTheme): boolean {
  return (
    a.grid === b.grid &&
    a.tick === b.tick &&
    a.tooltipBackground === b.tooltipBackground &&
    a.tooltipForeground === b.tooltipForeground &&
    a.border === b.border &&
    a.accentBorder === b.accentBorder &&
    a.series.every((couleur, index) => couleur === b.series[index])
  );
}

/** La palette vit dans les variables CSS : le thème sombre la change sans remonter. */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() => lireTheme());

  useEffect(() => {
    const suivre = (): void => {
      setTheme((courant) => {
        const suivant = lireTheme();
        return memeTheme(courant, suivant) ? courant : suivant;
      });
    };

    suivre();
    const observateur = new MutationObserver(suivre);
    observateur.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });
    return () => {
      observateur.disconnect();
    };
  }, []);

  return theme;
}

export function couleurSerie(theme: ChartTheme, index: number): string {
  return theme.series[index % theme.series.length] ?? CLAIR.series[0] ?? '#630210';
}

const INDEX_OR = 1;

export function bordureSerie(theme: ChartTheme, index: number, repli: string): string {
  return index % theme.series.length === INDEX_OR ? theme.accentBorder : repli;
}

export function useMouvementReduit(): boolean {
  const [reduit, setReduit] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const requete = window.matchMedia('(prefers-reduced-motion: reduce)');
    const surChangement = (evenement: MediaQueryListEvent): void => {
      setReduit(evenement.matches);
    };
    requete.addEventListener('change', surChangement);
    return () => {
      requete.removeEventListener('change', surChangement);
    };
  }, []);

  return reduit;
}
