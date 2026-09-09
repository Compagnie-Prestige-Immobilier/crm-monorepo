import type { Plugin } from 'chart.js';

import type { LigneComposition, Presentation, Valeur } from '@/components/tableau-de-bord/sources';
import { bordureSerie, couleurSerie, type ChartTheme } from '@/components/tableau-de-bord/theme';
import { formatNumber } from '@/lib/format';

/**
 * `neutre` décline le bordeaux par luminosité, `categorielle` habille les
 * surfaces d'or par opacité — jamais le texte. `serie` retombe sur la palette
 * habituelle.
 */
export function remplissage(
  theme: ChartTheme,
  palette: Presentation['palette'],
  index: number,
): string {
  if (palette === 'neutre') {
    const base = theme.series[0] ?? '#630210';
    const niveau = Math.max(25, 85 - (index % 6) * 12);
    return `color-mix(in srgb, ${base} ${String(niveau)}%, white)`;
  }
  if (palette === 'categorielle') {
    const niveau = Math.max(35, 100 - (index % 5) * 15);
    return `color-mix(in srgb, ${theme.accentBorder} ${String(niveau)}%, transparent)`;
  }
  return couleurSerie(theme, index);
}

export function bordure(
  theme: ChartTheme,
  palette: Presentation['palette'],
  index: number,
  repli: string,
): string {
  if (palette === 'neutre') return theme.series[0] ?? repli;
  if (palette === 'categorielle') return theme.accentBorder;
  return bordureSerie(theme, index, repli);
}

/**
 * Chart.js n'a pas d'étiquettes de données enregistrées ici, et une dépendance
 * de plus pour ça n'en vaut pas la peine. Sous 20 px par élément l'étiquette
 * déborderait sur sa voisine : elle est sautée plutôt que dessinée illisible.
 */
function etiquettes(theme: ChartTheme): Plugin<'bar' | 'line'> {
  return {
    id: 'valeurs-affichees',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const horizontal = chart.options.indexAxis === 'y';
      ctx.save();
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = theme.tick;
      chart.data.datasets.forEach((dataset, rang) => {
        const meta = chart.getDatasetMeta(rang);
        if (meta.hidden === true || meta.data.length === 0) return;
        const place = (horizontal ? chartArea.height : chartArea.width) / meta.data.length;
        if (place < 20) return;
        meta.data.forEach((element, index) => {
          const valeur = dataset.data[index];
          if (typeof valeur !== 'number') return;
          const { x, y } = element.getProps(['x', 'y'], true) as { x: number; y: number };
          ctx.textAlign = horizontal ? 'left' : 'center';
          ctx.textBaseline = horizontal ? 'middle' : 'bottom';
          ctx.fillText(formatNumber(valeur), horizontal ? x + 6 : x, horizontal ? y : y - 6);
        });
      });
      ctx.restore();
    },
  };
}

export function greffonsValeurs(
  theme: ChartTheme,
  actif: boolean | undefined,
): Plugin<'bar' | 'line'>[] {
  return actif === true ? [etiquettes(theme)] : [];
}

export function jeuDeValeurs(
  theme: ChartTheme,
  items: readonly Valeur[],
  palette: Presentation['palette'],
) {
  return {
    data: items.map((item) => item.value),
    backgroundColor: items.map((_, index) => remplissage(theme, palette, index)),
    borderColor: items.map((_, index) =>
      bordure(theme, palette, index, couleurSerie(theme, index)),
    ),
    borderWidth: 1,
    borderRadius: 6,
    borderSkipped: false as const,
  };
}

export function jeuxDeComposition(
  theme: ChartTheme,
  lignes: readonly LigneComposition[],
  palette: Presentation['palette'],
) {
  const segments = [
    ...new Set(lignes.flatMap((ligne) => ligne.segments.map((segment) => segment.id))),
  ];
  return segments.map((segmentId, index) => ({
    label: lignes[0]?.segments.find((segment) => segment.id === segmentId)?.label ?? segmentId,
    data: lignes.map(
      (ligne) => ligne.segments.find((segment) => segment.id === segmentId)?.value ?? 0,
    ),
    backgroundColor: remplissage(theme, palette, index),
    borderRadius: 4,
  }));
}
