'use client';

import { ResponsiveBar, type BarCustomLayerProps, type BarDatum } from '@nivo/bar';
import { ResponsivePie, type PieCustomLayerProps } from '@nivo/pie';
import type { LucideIcon } from 'lucide-react';

import { EmptyChart } from '@/components/dashboard/empty-chart';
import { useChartTheme, type ChartTheme } from '@/lib/chart-theme';
import { formatNumber } from '@/lib/format';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

export interface Part {
  label: string;
  value: number;
  couleur?: string | undefined;
  icone?: LucideIcon | undefined;
}

export interface LigneCroisee extends BarDatum {
  label: string;
  Joints: number;
  'Non joints': number;
  courbe: number;
}

export function nivoTheme(theme: ChartTheme) {
  return {
    text: { fill: theme.tick, fontSize: 11 },
    axis: {
      domain: { line: { stroke: 'transparent' } },
      ticks: { line: { stroke: 'transparent' }, text: { fill: theme.tick } },
    },
    grid: { line: { stroke: theme.grid, strokeDasharray: '3 5' } },
    tooltip: {
      container: {
        background: theme.tooltipBackground,
        color: theme.tooltipForeground,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
      },
    },
  };
}

/** L'icône vit dans la graduation : la coller à côté du graphique la détacherait de sa barre. */
function graduationAvecIcone(parts: Part[], couleur: string) {
  return function Graduation({ x, y, value }: { x: number; y: number; value: string | number }) {
    const Icone = parts.find((part) => part.label === String(value))?.icone;
    return (
      <g transform={`translate(${String(x)},${String(y)})`}>
        {Icone === undefined ? null : (
          <Icone x={-134} y={-8} width={15} height={15} color={couleur} aria-hidden="true" />
        )}
        <text x={-8} y={4} textAnchor="end" fill={couleur} fontSize={11}>
          {value}
        </text>
      </g>
    );
  };
}

export function BarresHorizontales({
  parts,
  gauche,
  suffixe,
  vide,
}: {
  parts: Part[];
  gauche: number;
  suffixe?: string;
  vide: string;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  if (parts.length === 0) return <EmptyChart message={vide} />;
  const avecIcone = parts.some((part) => part.icone !== undefined);
  return (
    <div className="h-full">
      <ResponsiveBar
        data={parts.map((part) => ({ label: part.label, value: part.value }))}
        keys={['value']}
        indexBy="label"
        layout="horizontal"
        margin={{ top: 8, right: 24, bottom: 28, left: gauche }}
        padding={0.32}
        borderRadius={6}
        colors={(datum) =>
          parts[datum.index]?.couleur ??
          theme.series[datum.index % theme.series.length] ??
          '#630210'
        }
        enableLabel={false}
        enableGridX={true}
        enableGridY={false}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          tickValues: 5,
          format: (valeur: number) => `${String(valeur)}${suffixe ?? ''}`,
        }}
        axisLeft={
          avecIcone
            ? { tickSize: 0, renderTick: graduationAvecIcone(parts, theme.tick) }
            : { tickSize: 0, tickPadding: 8 }
        }
        valueFormat={(value) => `${formatNumber(value)}${suffixe ?? ''}`}
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
      />
    </div>
  );
}

/**
 * La courbe se lit sur sa propre échelle : un département de quinze fiches
 * peut apporter deux cents prospects, et une échelle partagée écraserait les
 * barres jusqu'à les rendre illisibles.
 */
function CourbeSurSonEchelle(props: BarCustomLayerProps<LigneCroisee>, trait: string) {
  const { bars, innerHeight } = props;
  const colonnes = new Map<string, { x: number; valeur: number }>();
  for (const bar of bars) {
    const cle = String(bar.data.indexValue);
    const centre = colonnes.get(cle);
    if (centre === undefined) {
      colonnes.set(cle, { x: bar.x + bar.width / 2, valeur: Number(bar.data.data.courbe ?? 0) });
    } else {
      centre.x = Math.min(centre.x, bar.x + bar.width / 2) + bar.width / 2;
    }
  }
  const points = [...colonnes.values()];
  const haut = Math.max(1, ...points.map((point) => point.valeur));
  const y = (valeur: number) => innerHeight - (valeur / haut) * innerHeight * 0.92;
  if (points.length === 0) return null;
  return (
    <g>
      <polyline
        fill="none"
        stroke={trait}
        strokeWidth={2}
        strokeLinejoin="round"
        points={points.map((point) => `${String(point.x)},${String(y(point.valeur))}`).join(' ')}
      />
      {points.map((point) => (
        <circle
          key={point.x}
          cx={point.x}
          cy={y(point.valeur)}
          r={4}
          fill={trait}
          stroke="#fff"
          strokeWidth={1.5}
        />
      ))}
    </g>
  );
}

export function BarresEtCourbe({ lignes, vide }: { lignes: LigneCroisee[]; vide: string }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  if (lignes.length === 0) return <EmptyChart message={vide} />;
  const trait = theme.series[1] ?? '#C8921A';
  return (
    <div className="h-full">
      <ResponsiveBar
        data={lignes}
        keys={['Joints', 'Non joints']}
        indexBy="label"
        groupMode="grouped"
        margin={{ top: 12, right: 16, bottom: 84, left: 44 }}
        padding={0.28}
        innerPadding={2}
        borderRadius={4}
        colors={[theme.series[2] ?? '#1A6B44', theme.series[3] ?? '#B05070']}
        enableLabel={false}
        enableGridX={false}
        axisBottom={{ tickRotation: -30, tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        layers={['grid', 'axes', 'bars', (props) => CourbeSurSonEchelle(props, trait), 'legends']}
        legends={[
          {
            dataFrom: 'keys',
            anchor: 'bottom',
            direction: 'row',
            translateY: 76,
            itemWidth: 96,
            itemHeight: 16,
            symbolSize: 9,
          },
        ]}
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
      />
    </div>
  );
}

/** Le total au centre : l'anneau dit des parts, le chiffre dit de quoi. */
function TotalAuCentre(props: PieCustomLayerProps<{ id: string; value: number }>, couleur: string) {
  const { centerX, centerY, dataWithArc } = props;
  const total = dataWithArc.reduce((somme, part) => somme + part.value, 0);
  return (
    <text
      x={centerX}
      y={centerY}
      textAnchor="middle"
      dominantBaseline="central"
      fill={couleur}
      style={{ fontSize: 26, fontWeight: 700 }}
    >
      {formatNumber(total)}
    </text>
  );
}

/**
 * La lecture d'ensemble : trois parts au plus, chacune nommée. Un anneau à
 * douze parts ne se lit pas, c'est le rôle des barres qui suivent.
 */
export function AnneauDesFamilles({ parts, vide }: { parts: Part[]; vide: string }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const visibles = parts.filter((part) => part.value > 0);
  if (visibles.length === 0) return <EmptyChart message={vide} />;
  return (
    <div className="h-full">
      <ResponsivePie
        data={visibles.map((part) => ({ id: part.label, label: part.label, value: part.value }))}
        value="value"
        id="id"
        innerRadius={0.64}
        padAngle={1.5}
        cornerRadius={5}
        colors={(datum) => {
          const index = visibles.findIndex((part) => part.label === String(datum.id));
          return visibles[index]?.couleur ?? theme.series[index % theme.series.length] ?? '#630210';
        }}
        enableArcLinkLabels={false}
        enableArcLabels={false}
        layers={['arcs', 'legends', (props) => TotalAuCentre(props, theme.tooltipForeground)]}
        margin={{ top: 12, right: 160, bottom: 12, left: 12 }}
        legends={[
          {
            anchor: 'right',
            direction: 'column',
            translateX: 150,
            itemWidth: 140,
            itemHeight: 22,
            itemsSpacing: 4,
            symbolSize: 10,
          },
        ]}
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
      />
    </div>
  );
}
