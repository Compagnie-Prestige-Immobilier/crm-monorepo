import type { ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';

import '@/components/tableau-de-bord/chart-setup';

import { echellesAxes, optionsBase } from '@/components/tableau-de-bord/chart-options';
import type { ProprietesItems } from '@/components/tableau-de-bord/graphiques-barres';
import { greffonsValeurs, remplissage } from '@/components/tableau-de-bord/palette';
import {
  useChartTheme,
  useMouvementReduit,
  type ChartTheme,
} from '@/components/tableau-de-bord/theme';

function optionsSerie(
  theme: ChartTheme,
  reduit: boolean,
  paliers: boolean,
  remplie: boolean,
): ChartOptions<'line'> {
  return {
    ...optionsBase(theme, reduit),
    scales: echellesAxes(theme),
    interaction: { mode: 'index', intersect: false },
    elements: {
      point: { radius: 0, hitRadius: 12, hoverRadius: 4 },
      line: { stepped: paliers, fill: remplie },
    },
  };
}

export function Courbe({ items, label = 'Visites', presentation }: ProprietesItems) {
  const theme = useChartTheme();
  const reduit = useMouvementReduit();
  const accent = remplissage(theme, presentation?.palette, 0);
  return (
    <Line
      options={optionsSerie(theme, reduit, false, false)}
      plugins={greffonsValeurs(theme, presentation?.valeurs)}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            label,
            data: items.map((item) => item.value),
            borderColor: accent,
            borderWidth: 2,
            tension: 0.3,
          },
        ],
      }}
    />
  );
}

export function Aire({ items, label = 'Visites', presentation }: ProprietesItems) {
  const theme = useChartTheme();
  const reduit = useMouvementReduit();
  const accent = remplissage(theme, presentation?.palette, 0);
  return (
    <Line
      options={optionsSerie(theme, reduit, false, true)}
      plugins={greffonsValeurs(theme, presentation?.valeurs)}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            label,
            data: items.map((item) => item.value),
            borderColor: accent,
            backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`,
            borderWidth: 2,
            tension: 0.3,
          },
        ],
      }}
    />
  );
}

export function Escalier({ items, label = 'Visites', presentation }: ProprietesItems) {
  const theme = useChartTheme();
  const reduit = useMouvementReduit();
  const accent = remplissage(theme, presentation?.palette, 0);
  return (
    <Line
      options={optionsSerie(theme, reduit, true, false)}
      plugins={greffonsValeurs(theme, presentation?.valeurs)}
      data={{
        labels: items.map((item) => item.label),
        datasets: [
          {
            label,
            data: items.map((item) => item.value),
            borderColor: accent,
            borderWidth: 2,
          },
        ],
      }}
    />
  );
}
