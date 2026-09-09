import type { ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';

import '@/components/tableau-de-bord/chart-setup';

import { echellesAxes, legende, optionsBase } from '@/components/tableau-de-bord/chart-options';
import {
  greffonsValeurs,
  jeuDeValeurs,
  jeuxDeComposition,
} from '@/components/tableau-de-bord/palette';
import type { LigneComposition, Presentation, Valeur } from '@/components/tableau-de-bord/sources';
import { useChartTheme, useMouvementReduit } from '@/components/tableau-de-bord/theme';

export interface ProprietesItems {
  items: readonly Valeur[];
  label?: string;
  presentation?: Presentation | undefined;
  /** Le clic sur une barre ouvre la liste filtrée sur elle. */
  onSelect?: ((index: number) => void) | undefined;
}

export interface ProprietesComposition {
  lignes: readonly LigneComposition[];
  presentation?: Presentation | undefined;
}

export function BarresVerticales({
  items,
  label = 'Visites',
  presentation,
  onSelect,
}: ProprietesItems) {
  const theme = useChartTheme();
  const reduit = useMouvementReduit();
  const options: ChartOptions<'bar'> = {
    ...optionsBase(theme, reduit, onSelect),
    scales: echellesAxes(theme),
  };
  return (
    <Bar
      options={options}
      plugins={greffonsValeurs(theme, presentation?.valeurs)}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          { label, ...jeuDeValeurs(theme, items, presentation?.palette), maxBarThickness: 42 },
        ],
      }}
    />
  );
}

export function BarresHorizontales({
  items,
  label = 'Visites',
  presentation,
  onSelect,
}: ProprietesItems) {
  const theme = useChartTheme();
  const reduit = useMouvementReduit();
  const options: ChartOptions<'bar'> = {
    ...optionsBase(theme, reduit, onSelect),
    indexAxis: 'y',
    scales: echellesAxes(theme, { horizontal: true }),
  };
  return (
    <Bar
      options={options}
      plugins={greffonsValeurs(theme, presentation?.valeurs)}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          { label, ...jeuDeValeurs(theme, items, presentation?.palette), barThickness: 18 },
        ],
      }}
    />
  );
}

export function BarresEmpilees({ lignes, presentation }: ProprietesComposition) {
  const theme = useChartTheme();
  const reduit = useMouvementReduit();
  const base = optionsBase(theme, reduit);
  const options: ChartOptions<'bar'> = {
    ...base,
    indexAxis: 'y',
    scales: echellesAxes(theme, { horizontal: true, empile: true }),
    plugins: { ...base.plugins, legend: legende(theme, presentation?.legende ?? true) },
  };
  return (
    <Bar
      options={options}
      plugins={greffonsValeurs(theme, presentation?.valeurs)}
      data={{
        labels: lignes.map((ligne) => ligne.ligne),
        datasets: jeuxDeComposition(theme, lignes, presentation?.palette),
      }}
    />
  );
}

export function BarresCentPourCent({ lignes, presentation }: ProprietesComposition) {
  const theme = useChartTheme();
  const reduit = useMouvementReduit();
  const base = optionsBase(theme, reduit);
  const totaux = lignes.map((ligne) =>
    ligne.segments.reduce((somme, segment) => somme + segment.value, 0),
  );
  const jeux = jeuxDeComposition(theme, lignes, presentation?.palette).map((jeu) => ({
    ...jeu,
    data: jeu.data.map((valeur, index) => {
      const total = totaux[index] ?? 0;
      return total === 0 ? 0 : Math.round((valeur / total) * 100);
    }),
  }));
  const options: ChartOptions<'bar'> = {
    ...base,
    indexAxis: 'y',
    scales: echellesAxes(theme, { horizontal: true, empile: true, entier: false }),
    plugins: {
      ...base.plugins,
      legend: legende(theme, presentation?.legende ?? true),
      tooltip: {
        ...base.plugins.tooltip,
        callbacks: {
          label: (contexte) => ` ${contexte.dataset.label ?? ''} : ${String(contexte.parsed.x)} %`,
        },
      },
    },
  };
  return (
    <Bar
      options={options}
      plugins={greffonsValeurs(theme, presentation?.valeurs)}
      data={{ labels: lignes.map((ligne) => ligne.ligne), datasets: jeux }}
    />
  );
}
