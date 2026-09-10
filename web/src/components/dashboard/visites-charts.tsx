import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveLine } from '@nivo/line';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveRadar } from '@nivo/radar';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';

import type {
  CompositionLigne,
  DispositionPresentation,
  EquipeDatum,
  MatriceDatum,
  ScalaireDatum,
} from '@/components/accueil/tableau-de-bord/sources';
import { EmptyChart } from '@/components/dashboard/empty-chart';
import { AnimatedNumber } from '@/components/live/animated-number';
import { seriesColor, useChartTheme } from '@/lib/chart-theme';
import { formatNumber } from '@/lib/format';
import type { NamedCount } from '@/lib/types';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

export interface ItemsChartProps {
  items: readonly NamedCount[];
  label?: string;
  presentation?: DispositionPresentation | undefined;
}
type NivoDatum = Record<string, string | number>;

export function paletteFill(
  theme: ReturnType<typeof useChartTheme>,
  palette: DispositionPresentation['palette'] | undefined,
  index: number,
): string {
  if (palette === 'neutre')
    return `color-mix(in srgb, ${theme.series[0] ?? '#0f766e'} ${String(Math.max(28, 82 - (index % 6) * 10))}%, white)`;
  if (palette === 'categorielle')
    return `color-mix(in srgb, ${theme.accentBorder} ${String(Math.max(38, 100 - (index % 5) * 14))}%, transparent)`;
  return seriesColor(theme, index);
}
function nivoTheme(theme: ReturnType<typeof useChartTheme>) {
  return {
    text: { fill: theme.tick, fontSize: 11, fontFamily: 'Plus Jakarta Sans, sans-serif' },
    axis: {
      domain: { line: { stroke: 'transparent' } },
      ticks: { line: { stroke: 'transparent' }, text: { fill: theme.tick } },
    },
    grid: { line: { stroke: theme.grid, strokeDasharray: '3 5' } },
    legends: { text: { fill: theme.tick } },
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
function Frame({ children }: { children: React.ReactNode }) {
  return <div className="h-full min-h-40 w-full">{children}</div>;
}
function itemData(items: readonly NamedCount[]) {
  return items.map((item) => ({ id: item.id, label: item.label, value: item.value }));
}
function clickIndex(items: readonly NamedCount[], value: unknown) {
  return items.findIndex((item) => item.id === String(value) || item.label === String(value));
}

function Bars({
  items,
  horizontal,
  presentation,
  onSelect,
}: ItemsChartProps & { horizontal?: boolean; onSelect?: ((index: number) => void) | undefined }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const clickProps =
    onSelect === undefined
      ? {}
      : {
          onClick: (datum: { indexValue: string | number }) =>
            onSelect(clickIndex(items, datum.indexValue)),
        };
  return (
    <Frame>
      <ResponsiveBar
        data={itemData(items)}
        keys={['value']}
        indexBy="label"
        layout={horizontal ? 'horizontal' : 'vertical'}
        margin={{ top: 12, right: 12, bottom: 38, left: horizontal ? 116 : 42 }}
        padding={0.28}
        borderRadius={6}
        colors={(datum) =>
          paletteFill(
            theme,
            presentation?.palette,
            Math.max(0, clickIndex(items, datum.indexValue)),
          )
        }
        borderColor={{ from: 'color', modifiers: [['darker', 0.25]] }}
        enableLabel={presentation?.valeurs === true}
        labelTextColor="#fff"
        enableGridX={horizontal === true}
        enableGridY={horizontal !== true}
        axisBottom={horizontal ? null : { tickSize: 0, tickPadding: 10 }}
        axisLeft={horizontal ? { tickSize: 0, tickPadding: 8 } : { tickSize: 0, tickPadding: 8 }}
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
        {...clickProps}
        tooltip={({ indexValue, value }) => (
          <span>
            {String(indexValue)}: {formatNumber(Number(value))}
          </span>
        )}
      />
    </Frame>
  );
}
export function BarresVerticalesChart({ items, presentation }: ItemsChartProps) {
  return <Bars items={items} presentation={presentation} />;
}
export function BarresHorizontalesChart({ items, presentation }: ItemsChartProps) {
  return <Bars items={items} presentation={presentation} horizontal />;
}

export function BarresGroupeesChart({
  items,
  comparaison,
  presentation,
}: {
  items: readonly NamedCount[];
  comparaison?: readonly NamedCount[];
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const compare = new Map((comparaison ?? []).map((item) => [item.id, item.value]));
  const data = items.map((item) => ({
    label: item.label,
    affichée: item.value,
    comparaison: compare.get(item.id) ?? 0,
  }));
  return (
    <Frame>
      <ResponsiveBar
        data={data}
        keys={comparaison === undefined ? ['affichée'] : ['affichée', 'comparaison']}
        indexBy="label"
        margin={{ top: 32, right: 12, bottom: 38, left: 42 }}
        padding={0.28}
        groupMode="grouped"
        borderRadius={6}
        colors={[
          paletteFill(theme, presentation?.palette, 0),
          paletteFill(theme, presentation?.palette, 1),
        ]}
        enableLabel={presentation?.valeurs === true}
        labelTextColor="#fff"
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
        legends={
          presentation?.legende === false
            ? []
            : [
                {
                  anchor: 'top-right',
                  direction: 'row',
                  translateY: -24,
                  itemWidth: 90,
                  itemHeight: 16,
                  symbolSize: 9,
                  dataFrom: 'keys',
                },
              ]
        }
        axisBottom={{ tickSize: 0, tickPadding: 10 }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
      />
    </Frame>
  );
}
function compositionData(lignes: readonly CompositionLigne[], percent: boolean) {
  const ids = [...new Set(lignes.flatMap((ligne) => ligne.segments.map((segment) => segment.id)))];
  return {
    data: lignes.map((ligne) => {
      const total = ligne.segments.reduce((sum, segment) => sum + segment.value, 0);
      return ids.reduce<NivoDatum>(
        (row, id) => {
          const value = ligne.segments.find((segment) => segment.id === id)?.value ?? 0;
          row[id] = percent && total > 0 ? Math.round((value / total) * 100) : value;
          return row;
        },
        { ligne: ligne.ligne },
      );
    }),
    keys: ids,
  };
}
function Composition({
  lignes,
  presentation,
  percent,
}: {
  lignes: readonly CompositionLigne[];
  presentation?: DispositionPresentation | undefined;
  percent?: boolean;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const built = compositionData(lignes, percent === true);
  return (
    <Frame>
      <ResponsiveBar
        data={built.data}
        keys={built.keys}
        indexBy="ligne"
        layout="horizontal"
        groupMode="stacked"
        margin={{ top: 36, right: 12, bottom: 28, left: 104 }}
        padding={0.28}
        borderRadius={4}
        colors={(datum) =>
          paletteFill(
            theme,
            presentation?.palette,
            Math.max(0, built.keys.indexOf(String(datum.id))),
          )
        }
        enableLabel={false}
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
        legends={
          presentation?.legende === false
            ? []
            : [
                {
                  anchor: 'top-left',
                  direction: 'row',
                  translateY: -28,
                  itemWidth: 90,
                  itemHeight: 16,
                  symbolSize: 9,
                  dataFrom: 'keys',
                },
              ]
        }
        axisBottom={{ tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
      />
    </Frame>
  );
}
export function BarresEmpileesChart({
  lignes,
  presentation,
}: {
  lignes: readonly CompositionLigne[];
  presentation?: DispositionPresentation | undefined;
}) {
  return <Composition lignes={lignes} presentation={presentation} />;
}
export function Barres100Chart({
  lignes,
  presentation,
}: {
  lignes: readonly CompositionLigne[];
  presentation?: DispositionPresentation | undefined;
}) {
  return <Composition lignes={lignes} presentation={presentation} percent />;
}

function LineSeries({
  items,
  label,
  presentation,
  stepped,
  area,
}: ItemsChartProps & { stepped?: boolean; area?: boolean }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  return (
    <Frame>
      <ResponsiveLine
        data={[
          { id: label ?? 'Visites', data: items.map((item) => ({ x: item.label, y: item.value })) },
        ]}
        colors={[paletteFill(theme, presentation?.palette, 0)]}
        curve={stepped ? 'step' : 'monotoneX'}
        enableArea={area === true}
        areaOpacity={0.14}
        lineWidth={2.5}
        pointSize={presentation?.valeurs === true ? 7 : 0}
        enableGridX={false}
        margin={{ top: 14, right: 12, bottom: 34, left: 42 }}
        axisBottom={{ tickSize: 0, tickPadding: 10 }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
        useMesh={true}
      />
    </Frame>
  );
}
export function CourbeChart(props: ItemsChartProps) {
  return <LineSeries {...props} />;
}
export function AireChart(props: ItemsChartProps) {
  return <LineSeries {...props} area />;
}
export function EscalierChart(props: ItemsChartProps) {
  return <LineSeries {...props} stepped />;
}

function Share({
  items,
  presentation,
  onSelect,
  donut,
}: {
  items: readonly NamedCount[];
  presentation?: DispositionPresentation | undefined;
  onSelect?: ((index: number) => void) | undefined;
  donut: boolean;
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const clickProps =
    onSelect === undefined
      ? {}
      : { onClick: (datum: { id: string | number }) => onSelect(clickIndex(items, datum.id)) };
  if (items.length < 2) {
    const item = items[0];
    return (
      <Frame>
        <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
          <strong className="font-display text-3xl font-[700] text-foreground">
            {formatNumber(item?.value ?? 0)}
          </strong>
          <span className="text-xs text-muted-foreground">{item?.label ?? 'Aucune donnée'}</span>
        </div>
      </Frame>
    );
  }
  return (
    <Frame>
      <ResponsivePie
        data={itemData(items)}
        value="value"
        id="label"
        innerRadius={donut ? 0.62 : 0}
        padAngle={1.5}
        cornerRadius={5}
        colors={(datum) =>
          paletteFill(theme, presentation?.palette, Math.max(0, clickIndex(items, datum.id)))
        }
        enableArcLinkLabels={false}
        enableArcLabels={false}
        margin={{
          top: 10,
          right: presentation?.legende === false ? 10 : 116,
          bottom: 10,
          left: 10,
        }}
        legends={
          presentation?.legende === false
            ? []
            : [
                {
                  anchor: 'right',
                  direction: 'column',
                  translateX: 108,
                  itemWidth: 100,
                  itemHeight: 20,
                  itemsSpacing: 4,
                  symbolSize: 9,
                },
              ]
        }
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
        {...clickProps}
        tooltip={({ datum }) => (
          <span>
            {datum.label}: {formatNumber(Number(datum.value))}
          </span>
        )}
      />
    </Frame>
  );
}
export function AnneauChart({
  items,
  presentation,
  onSelect,
}: {
  items: readonly NamedCount[];
  presentation?: DispositionPresentation | undefined;
  onSelect?: ((index: number) => void) | undefined;
}) {
  return <Share items={items} presentation={presentation} onSelect={onSelect} donut />;
}
export function CamembertChart({
  items,
  presentation,
  onSelect,
}: {
  items: readonly NamedCount[];
  presentation?: DispositionPresentation | undefined;
  onSelect?: ((index: number) => void) | undefined;
}) {
  return <Share items={items} presentation={presentation} onSelect={onSelect} donut={false} />;
}
export function AirePolaireChart({ items, presentation }: ItemsChartProps) {
  return <Share items={items} presentation={presentation} donut={false} />;
}

export function RadarChart({ items, presentation }: ItemsChartProps) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const data = items.map((item) => ({ axe: item.label, valeur: item.value }));
  return (
    <Frame>
      <ResponsiveRadar
        data={data}
        keys={['valeur']}
        indexBy="axe"
        margin={{ top: 30, right: 40, bottom: 30, left: 40 }}
        borderWidth={2}
        borderColor={paletteFill(theme, presentation?.palette, 0)}
        dotSize={7}
        dotColor={paletteFill(theme, presentation?.palette, 0)}
        colors={[paletteFill(theme, presentation?.palette, 0)]}
        fillOpacity={0.18}
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
      />
    </Frame>
  );
}
function matrixPoints(matrice: MatriceDatum) {
  return matrice.cellules
    .filter((cellule) => cellule.value > 0)
    .map((cellule) => ({
      x: matrice.colonnes.indexOf(cellule.colonne),
      y: matrice.lignes.indexOf(cellule.ligne),
      value: cellule.value,
    }));
}
export function NuageChart({
  matrice,
  presentation,
}: {
  matrice: MatriceDatum;
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  return (
    <Frame>
      <ResponsiveScatterPlot
        data={[{ id: 'Visites', data: matrixPoints(matrice) }]}
        colors={[paletteFill(theme, presentation?.palette, 0)]}
        nodeSize={9}
        margin={{ top: 12, right: 18, bottom: 34, left: 48 }}
        axisBottom={{ tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        theme={nivoTheme(theme)}
      />
    </Frame>
  );
}
export function BullesChart({
  matrice,
  presentation,
}: {
  matrice: MatriceDatum;
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const max = Math.max(1, ...matrixPoints(matrice).map((point) => point.value));
  return (
    <Frame>
      <ResponsiveScatterPlot
        data={[
          {
            id: 'Visites',
            data: matrixPoints(matrice).map((point) => ({
              ...point,
              size: 8 + (point.value / max) * 20,
            })),
          },
        ]}
        colors={[paletteFill(theme, presentation?.palette, 0)]}
        nodeSize={(node) => node.data.size as number}
        margin={{ top: 12, right: 18, bottom: 34, left: 48 }}
        theme={nivoTheme(theme)}
      />
    </Frame>
  );
}
export function MixteChart({ items, label = 'Visites', presentation }: ItemsChartProps) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const cumul = items.reduce<{ x: string; y: number }[]>(
    (all, item) => [...all, { x: item.label, y: (all.at(-1)?.y ?? 0) + item.value }],
    [],
  );
  return (
    <Frame>
      <div className="grid h-full grid-rows-2 gap-2">
        <ResponsiveBar
          data={items.map((item) => ({ label: item.label, value: item.value }))}
          keys={['value']}
          indexBy="label"
          margin={{ top: 10, right: 12, bottom: 26, left: 42 }}
          padding={0.3}
          borderRadius={6}
          colors={[paletteFill(theme, presentation?.palette, 0)]}
          enableLabel={presentation?.valeurs === true}
          theme={nivoTheme(theme)}
          animate={!reducedMotion}
        />
        <ResponsiveLine
          data={[{ id: 'Cumul', data: cumul }]}
          colors={[paletteFill(theme, presentation?.palette, 1)]}
          pointSize={0}
          enableGridX={false}
          margin={{ top: 8, right: 12, bottom: 26, left: 42 }}
          theme={nivoTheme(theme)}
        />
      </div>
    </Frame>
  );
}
export function JaugeChart({
  valeur,
  max,
  libelle,
  presentation,
}: {
  valeur: number;
  max: number;
  libelle: string;
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  const percent = Math.min(1, Math.max(0, valeur / Math.max(max, valeur, 1)));
  return (
    <div className="relative flex h-full items-center justify-center">
      <div className="h-32 w-64 overflow-hidden">
        <div
          className="h-64 w-64 rounded-full border-[22px] border-muted"
          style={{
            borderTopColor: paletteFill(theme, presentation?.palette, 0),
            borderRightColor: paletteFill(theme, presentation?.palette, 0),
            transform: `rotate(${45 + percent * 90}deg)`,
          }}
        />
      </div>
      <p className="absolute bottom-2 font-display text-[1.5rem] font-[800] tabular-nums">
        {formatNumber(valeur)}
      </p>
      <span className="sr-only">{libelle}</span>
    </div>
  );
}
export function CarteDeChaleurTable({
  matrice,
  caption,
}: {
  matrice: MatriceDatum;
  caption: string;
}) {
  const max = Math.max(1, ...matrice.cellules.map((cellule) => cellule.value));
  const valueAt = (ligne: string, colonne: string) =>
    matrice.cellules.find((cellule) => cellule.ligne === ligne && cellule.colonne === colonne)
      ?.value ?? 0;
  return (
    <div className="h-full overflow-auto" tabIndex={0}>
      <table className="w-full border-collapse text-[0.75rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th />
            {matrice.colonnes.map((colonne) => (
              <th key={colonne} className="px-1.5 py-1 text-center font-[600]">
                {colonne}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrice.lignes.map((ligne) => (
            <tr key={ligne}>
              <th className="px-1.5 py-1 text-left font-[600]">{ligne}</th>
              {matrice.colonnes.map((colonne) => {
                const value = valueAt(ligne, colonne);
                return (
                  <td
                    key={colonne}
                    className="px-1.5 py-1 text-center tabular-nums"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--chart-1) ${String(value === 0 ? 0 : 15 + (value / max) * 75)}%, transparent)`,
                    }}
                  >
                    {value === 0 ? '' : value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function TableauWidget({
  items,
  entete,
  caption,
}: {
  items: readonly NamedCount[];
  entete: string;
  caption: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="h-full overflow-auto" tabIndex={0}>
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left">{entete}</th>
            <th className="px-2 py-1.5 text-right">Visites</th>
            <th className="px-2 py-1.5 text-right">Part</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <th className="px-2 py-1.5 text-left font-[400]">{item.label}</th>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(item.value)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {total === 0 ? '0 %' : `${String(Math.round((item.value / total) * 100))} %`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function TableauEquipe({ donnee, caption }: { donnee: EquipeDatum; caption: string }) {
  if (donnee.lignes.length === 0)
    return <EmptyChart message="Personne n’a travaillé sur la période." />;
  return (
    <div className="h-full overflow-auto" tabIndex={0}>
      <table className="min-w-[42rem] w-full text-[0.875rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th className="px-3 py-2 text-left">Téléconseiller</th>
            {donnee.colonnes.map((colonne) => (
              <th key={colonne} className="px-3 py-2 text-right">
                {colonne}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {donnee.lignes.map((ligne) => (
            <tr key={ligne.id}>
              <th className="px-3 py-2 text-left font-[400]">{ligne.nom}</th>
              {ligne.cellules.map((cellule) => (
                <td key={cellule.cle} className="px-3 py-2 text-right tabular-nums">
                  {cellule.texte}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function TuileWidget({
  valeur,
  affichage,
  libelle,
  detail,
}: {
  valeur: number;
  affichage?: ScalaireDatum['affichage'];
  libelle: string;
  detail?: string | undefined;
}) {
  const grand = affichage ?? { valeur, format: formatNumber };
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="font-display text-[2.25rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
        {typeof grand === 'string' ? (
          grand
        ) : (
          <AnimatedNumber value={grand.valeur} format={grand.format} />
        )}
      </p>
      {detail === undefined ? null : (
        <p className="mt-2 text-[0.8125rem] text-muted-foreground">{detail}</p>
      )}
      <span className="sr-only">{libelle}</span>
    </div>
  );
}
export function TuileCourbeWidget({
  valeur,
  libelle,
  serie,
  presentation,
}: {
  valeur: number;
  libelle: string;
  serie: readonly NamedCount[];
  presentation?: DispositionPresentation | undefined;
}) {
  const theme = useChartTheme();
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <p className="font-display text-[2.25rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
        <AnimatedNumber value={valeur} />
      </p>
      <div className="h-16">
        <ResponsiveLine
          data={[{ id: libelle, data: serie.map((point) => ({ x: point.label, y: point.value })) }]}
          colors={[paletteFill(theme, presentation?.palette, 0)]}
          enablePoints={false}
          enableGridX={false}
          enableGridY={false}
          axisBottom={null}
          axisLeft={null}
          margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
        />
      </div>
      <span className="sr-only">{libelle}</span>
    </div>
  );
}
