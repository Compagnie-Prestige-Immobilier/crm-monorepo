// Le paquet 0.99.0 déclare `dist/types/index.d.ts` mais ne l'embarque pas.
declare module '@nivo/parallel-coordinates' {
  import type { Box } from '@nivo/core';
  import type { LegendProps } from '@nivo/legends';
  import type { PartialTheme } from '@nivo/theming';
  import type { JSX } from 'react';

  export interface VariableSpec<Datum> {
    id: string;
    label?: string;
    value: keyof Datum & string;
    min?: number | 'auto';
    max?: number | 'auto';
    ticksPosition?: 'before' | 'after';
    tickValues?: number | number[];
    tickSize?: number;
    tickPadding?: number;
    tickRotation?: number;
    tickFormat?: (value: number) => string;
    legendPosition?: 'start' | 'middle' | 'end';
    legendOffset?: number;
  }

  export interface ParallelCoordinatesProps<Datum extends Record<string, string | number>> {
    data: readonly Datum[];
    variables: readonly VariableSpec<Datum>[];
    groupBy?: keyof Datum & string;
    groups?: readonly { id: string; label?: string }[];
    layout?: 'horizontal' | 'vertical';
    curve?: 'linear' | 'monotoneX' | 'monotoneY' | 'natural' | 'step';
    margin?: Partial<Box>;
    colors?: readonly string[] | { scheme: string } | ((datum: Datum) => string);
    lineWidth?: number;
    lineOpacity?: number;
    axesTicksPosition?: 'before' | 'after';
    legends?: readonly LegendProps[];
    theme?: PartialTheme;
    isInteractive?: boolean;
    animate?: boolean;
    motionConfig?: string;
    role?: string;
    ariaLabel?: string;
  }

  export function ResponsiveParallelCoordinates<Datum extends Record<string, string | number>>(
    props: ParallelCoordinatesProps<Datum>,
  ): JSX.Element;
}
