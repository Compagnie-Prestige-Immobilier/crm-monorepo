import type { ChartOptions } from 'chart.js';
import { Doughnut, PolarArea, Radar } from 'react-chartjs-2';

import '@/components/tableau-de-bord/chart-setup';

import { echelleRadiale, legende, optionsBase } from '@/components/tableau-de-bord/chart-options';
import { bordure, remplissage } from '@/components/tableau-de-bord/palette';
import type { Presentation, Valeur } from '@/components/tableau-de-bord/sources';
import {
  couleurSerie,
  useChartTheme,
  useMouvementReduit,
  type ChartTheme,
} from '@/components/tableau-de-bord/theme';
import { formatNumber } from '@/lib/format';

interface ProprietesParts {
  items: readonly Valeur[];
  presentation?: Presentation | undefined;
  onSelect?: ((index: number) => void) | undefined;
}

function optionsPart(
  theme: ChartTheme,
  reduit: boolean,
  affichee: boolean,
  onSelect?: (index: number) => void,
): ChartOptions<'doughnut'> {
  const base = optionsBase(theme, reduit, onSelect);
  return {
    ...base,
    plugins: {
      ...base.plugins,
      legend: legende(theme, affichee, 'right'),
      tooltip: {
        ...base.plugins.tooltip,
        callbacks: {
          label: (contexte) => {
            const valeurs = contexte.chart.data.datasets[0]?.data as number[] | undefined;
            const somme = (valeurs ?? []).reduce((cumul, valeur) => cumul + valeur, 0);
            const part = somme === 0 ? 0 : Math.round((contexte.parsed / somme) * 100);
            return ` ${contexte.label}: ${formatNumber(contexte.parsed)} (${String(part)} %)`;
          },
        },
      },
    },
  };
}

function donneesPart(theme: ChartTheme, items: readonly Valeur[], presentation?: Presentation) {
  return {
    labels: items.map((item) => item.label),
    datasets: [
      {
        data: items.map((item) => item.value),
        backgroundColor: items.map((_, index) => remplissage(theme, presentation?.palette, index)),
        borderColor: items.map((_, index) =>
          bordure(theme, presentation?.palette, index, theme.tooltipBackground),
        ),
        borderWidth: 2,
      },
    ],
  };
}

export function Anneau({ items, presentation, onSelect }: ProprietesParts) {
  const theme = useChartTheme();
  const reduit = useMouvementReduit();
  return (
    <Doughnut
      options={{
        ...optionsPart(theme, reduit, presentation?.legende ?? true, onSelect),
        cutout: '62%',
      }}
      data={donneesPart(theme, items, presentation)}
    />
  );
}

export function Camembert({ items, presentation, onSelect }: ProprietesParts) {
  const theme = useChartTheme();
  const reduit = useMouvementReduit();
  return (
    <Doughnut
      options={{
        ...optionsPart(theme, reduit, presentation?.legende ?? true, onSelect),
        cutout: '0%',
      }}
      data={donneesPart(theme, items, presentation)}
    />
  );
}

export function Rosace({ items, presentation }: ProprietesParts) {
  const theme = useChartTheme();
  const reduit = useMouvementReduit();
  const base = optionsBase(theme, reduit);
  const options: ChartOptions<'polarArea'> = {
    ...base,
    scales: echelleRadiale(theme),
    plugins: { ...base.plugins, legend: legende(theme, presentation?.legende ?? false) },
  };
  const palette = presentation?.palette;
  return (
    <PolarArea
      options={options}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            data: items.map((item) => item.value),
            backgroundColor: items.map((_, index) =>
              palette === undefined || palette === 'serie'
                ? `color-mix(in srgb, ${couleurSerie(theme, index)} 55%, transparent)`
                : remplissage(theme, palette, index),
            ),
            borderColor: items.map((_, index) =>
              bordure(theme, palette, index, couleurSerie(theme, index)),
            ),
            borderWidth: 1,
          },
        ],
      }}
    />
  );
}

export function Toile({ items, presentation }: ProprietesParts) {
  const theme = useChartTheme();
  const reduit = useMouvementReduit();
  const accent = remplissage(theme, presentation?.palette, 0);
  const base = optionsBase(theme, reduit);
  const options: ChartOptions<'radar'> = {
    ...base,
    scales: echelleRadiale(theme),
    plugins: { ...base.plugins, legend: { display: false } },
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
