import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveLine } from '@nivo/line';
import { ResponsivePie } from '@nivo/pie';
import { BasicTooltip } from '@nivo/tooltip';

import { useChartTheme } from '@/lib/chart-theme';
import { formatNumber, formatShortDate } from '@/lib/format';
import { formatXof, formatXofAxisTick, xofToChartNumber } from '@/lib/money';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

export interface ClickableSlice {
  label: string;
  value: number;
  onSelect?: (() => void) | undefined;
}
function colors(theme: ReturnType<typeof useChartTheme>) {
  return theme.series.length > 0 ? theme.series : ['#0f766e'];
}
function nivoTheme(theme: ReturnType<typeof useChartTheme>) {
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

export function BankRankChart({
  items,
  label: _label,
  valueFormat = 'count',
}: {
  items: readonly ClickableSlice[];
  label: string;
  valueFormat?: 'count' | 'fcfa';
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const formatValue = (value: number) =>
    valueFormat === 'fcfa'
      ? formatXof(String(Math.round(value)), '0 FCFA')
      : formatNumber(Math.round(value));
  return (
    <div className="h-full min-h-40">
      <ResponsiveBar
        data={items.map((item) => ({ label: item.label, value: item.value }))}
        keys={['value']}
        indexBy="label"
        layout="horizontal"
        margin={{ top: 10, right: 12, bottom: 24, left: 116 }}
        padding={0.3}
        borderRadius={6}
        colors={(datum) => colors(theme)[datum.index % colors(theme).length] ?? '#0f766e'}
        enableLabel={false}
        enableGridX={true}
        enableGridY={false}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          format: (value) =>
            valueFormat === 'fcfa' ? formatXofAxisTick(Number(value)) : formatNumber(Number(value)),
        }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
        tooltip={({ indexValue, value, color }) => (
          <BasicTooltip
            id={String(indexValue)}
            value={formatValue(Number(value))}
            color={color}
            enableChip
          />
        )}
        onClick={(datum) =>
          items.find((item) => item.label === String(datum.indexValue))?.onSelect?.()
        }
      />
    </div>
  );
}
export function BankShareChart({ items }: { items: readonly ClickableSlice[] }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  if (items.length < 2) {
    const item = items[0];
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 text-center">
        <strong className="font-display text-3xl font-[700] text-foreground">
          {formatNumber(item?.value ?? 0)}
        </strong>
        <span className="text-xs text-muted-foreground">{item?.label ?? 'Aucune donnée'}</span>
      </div>
    );
  }
  return (
    <div className="h-full min-h-40">
      <ResponsivePie
        data={items.map((item) => ({ id: item.label, label: item.label, value: item.value }))}
        value="value"
        id="id"
        innerRadius={0.62}
        padAngle={1.5}
        cornerRadius={5}
        colors={(datum) =>
          colors(theme)[
            Math.max(
              0,
              items.findIndex((item) => item.label === String(datum.id)),
            )
          ] ?? '#0f766e'
        }
        enableArcLinkLabels={false}
        enableArcLabels={false}
        margin={{ top: 10, right: 158, bottom: 10, left: 10 }}
        legends={[
          {
            anchor: 'right',
            direction: 'column',
            translateX: 146,
            itemWidth: 140,
            itemHeight: 20,
            itemsSpacing: 4,
            symbolSize: 9,
          },
        ]}
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
        tooltip={({ datum }) => (
          <BasicTooltip
            id={String(datum.id)}
            value={formatNumber(Number(datum.value))}
            color={datum.color}
            enableChip
          />
        )}
        onClick={(datum) => items.find((item) => item.label === String(datum.id))?.onSelect?.()}
      />
    </div>
  );
}
export function CashingsOverTimeChart({
  buckets,
}: {
  buckets: readonly { bucket: string; cases: number; amountXof: string }[];
}) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const data = buckets.map((point) => ({
    x: formatShortDate(point.bucket.slice(0, 10)),
    y: xofToChartNumber(point.amountXof),
    cases: point.cases,
    amount: formatXof(point.amountXof),
  }));
  return (
    <div className="h-full min-h-40">
      <ResponsiveLine
        data={[{ id: 'Montant', data }]}
        colors={[theme.series[1] ?? '#d97706']}
        lineWidth={2.5}
        pointSize={5}
        enableGridX={false}
        margin={{ top: 12, right: 12, bottom: 34, left: 48 }}
        axisBottom={{ tickSize: 0, tickPadding: 10 }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
        useMesh={true}
        tooltip={({ point }) => (
          <BasicTooltip
            id={String(point.data.xFormatted)}
            value={formatXof(String(point.data.y))}
            color={point.color}
            enableChip
          />
        )}
      />
    </div>
  );
}
export function MeanDelayChart({ items }: { items: readonly { label: string; hours: number }[] }) {
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="h-full min-h-40">
      <ResponsiveBar
        data={items.map((item) => ({ label: item.label, heures: item.hours }))}
        keys={['heures']}
        indexBy="label"
        layout="horizontal"
        margin={{ top: 10, right: 12, bottom: 24, left: 116 }}
        padding={0.3}
        borderRadius={6}
        colors={[theme.series[0] ?? '#0f766e']}
        enableLabel={false}
        axisBottom={{ tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        theme={nivoTheme(theme)}
        animate={!reducedMotion}
        tooltip={({ indexValue, value, color }) => (
          <BasicTooltip
            id={String(indexValue)}
            value={`${formatNumber(Math.round(Number(value)))} h`}
            color={color}
            enableChip
          />
        )}
      />
    </div>
  );
}
