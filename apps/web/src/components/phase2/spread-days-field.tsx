'use client';

import { CalendarRangeIcon } from 'lucide-react';
import { useId } from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MAX_SPREAD_DAYS, MIN_SPREAD_DAYS } from '@/lib/data/phase2';
import { formatNumber } from '@/lib/format';

const DAY_OPTIONS: readonly number[] = Array.from(
  { length: MAX_SPREAD_DAYS - MIN_SPREAD_DAYS + 1 },
  (_, index) => MIN_SPREAD_DAYS + index,
);

const DAY_ITEMS = DAY_OPTIONS.map((days) => ({
  value: String(days),
  label: days === 1 ? 'Une seule journée' : `${formatNumber(days)} journées`,
}));

export function SpreadDaysField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const fieldId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId} className="flex items-center gap-2">
        <CalendarRangeIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        Étaler sur
      </Label>
      <Select
        items={DAY_ITEMS}
        value={String(value)}
        onValueChange={(next) => {
          const parsed = Number.parseInt(next ?? '', 10);
          onChange(Number.isFinite(parsed) ? parsed : MIN_SPREAD_DAYS);
        }}
      >
        <SelectTrigger id={fieldId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {DAY_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[0.75rem] text-muted-foreground">
        {value === 1
          ? 'Un programme unique par téléconseiller.'
          : `Un programme par jour et par téléconseiller, soit ${formatNumber(value)} liasses chacun.`}
      </p>
    </div>
  );
}

export function SpreadPreview({
  spreadDays,
  perDay,
  unit = 'appels',
}: {
  spreadDays: number;
  perDay: readonly number[];
  unit?: string;
}) {
  if (spreadDays <= 1 || perDay.length === 0) return null;

  const heaviest = Math.max(...perDay);

  return (
    <div>
      <h3 className="flex items-center gap-2 pb-2 text-[0.8125rem] font-[600]">
        <CalendarRangeIcon className="size-4" aria-hidden="true" />
        Charge par journée, pour un téléconseiller
      </h3>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {perDay.map((count, index) => (
          <li
            key={index}
            className="flex items-center justify-between gap-3 rounded-sm bg-muted px-3 py-1.5 text-[0.8125rem]"
          >
            <span className="text-muted-foreground">Jour {index + 1}</span>
            <span className="font-[600] tabular-nums">
              {formatNumber(count)} {unit}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.75rem] text-muted-foreground">
        Journée la plus chargée : {formatNumber(heaviest)} {unit}.
      </p>
    </div>
  );
}
