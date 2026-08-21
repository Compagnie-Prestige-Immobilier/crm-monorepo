'use client';

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type DatePickerProps = {
  id: string;
  label: string;
  value: string | null;
  min?: string | null;
  max?: string | null;
  onChange: (value: string | null) => void;
};

const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index),
  label: format(new Date(2024, index, 1), 'LLLL', { locale: fr }),
}));

export function DatePicker({ id, label, value, min, max, onChange }: DatePickerProps) {
  const selected = value ? parseISO(value) : null;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(selected ?? new Date()));
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const weeks = Array.from({ length: days.length / 7 }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  );
  const minDate = min ? parseISO(min) : null;
  const maxDate = max ? parseISO(max) : null;
  const selectedYear = selected?.getFullYear() ?? new Date().getFullYear();
  const firstYear = Math.min(new Date().getFullYear() - 10, selectedYear - 2);
  const lastYear = Math.max(new Date().getFullYear() + 5, selectedYear + 2);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setMonth(startOfMonth(selected ?? new Date()));
        }}
      >
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              aria-label={label}
              aria-haspopup="dialog"
              className={cn(
                'h-11 min-w-40 justify-between gap-3 rounded-md px-3 font-normal',
                !selected && 'text-muted-foreground',
              )}
            />
          }
        >
          <span>{selected ? format(selected, 'dd MMM yyyy', { locale: fr }) : 'dd-mm-yyyy'}</span>
          <CalendarDaysIcon aria-hidden="true" className="size-4 shrink-0" />
        </PopoverTrigger>
        <PopoverContent className="w-[19rem] p-3" align="start">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <Select
                items={MONTHS}
                value={String(month.getMonth())}
                onValueChange={(value) => {
                  if (value === null) return;
                  setMonth((current) => new Date(current.getFullYear(), Number(value), 1));
                }}
              >
                <SelectTrigger
                  aria-label="Mois affiché"
                  size="sm"
                  className="w-[7.5rem] border-0 px-2 capitalize"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((item) => (
                    <SelectItem key={item.value} value={item.value} className="capitalize">
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(month.getFullYear())}
                onValueChange={(value) => {
                  if (value === null) return;
                  setMonth((current) => new Date(Number(value), current.getMonth(), 1));
                }}
              >
                <SelectTrigger
                  aria-label="Année affichée"
                  size="sm"
                  className="w-[5.5rem] border-0 px-2"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Mois précédent"
                onClick={() => {
                  setMonth((current) => subMonths(current, 1));
                }}
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Mois suivant"
                onClick={() => {
                  setMonth((current) => addMonths(current, 1));
                }}
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
          {/* La ligne d'en-têtes vit DANS la grille : posée à côté, son
              `role="row"` n'avait aucun `grid` propriétaire, et les sept
              `columnheader` ne se rattachaient à aucune colonne. */}
          <div className="mt-2 grid gap-1" role="grid" aria-label={label}>
            <div
              className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground"
              role="row"
            >
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} role="columnheader" aria-label={weekday} className="py-2">
                  {weekday.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week[0]?.toISOString()} className="grid grid-cols-7 gap-1" role="row">
                {week.map((day) => {
                  const disabled = (minDate && day < minDate) || (maxDate && day > maxDate);
                  const currentMonth = isSameMonth(day, month);
                  const rangeStart = minDate ?? selected;
                  const rangeEnd = maxDate ?? selected;
                  const inRange =
                    rangeStart !== null && rangeEnd !== null && day > rangeStart && day < rangeEnd;
                  const rangeBoundary =
                    (minDate !== null && isSameDay(day, minDate)) ||
                    (maxDate !== null && isSameDay(day, maxDate));
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      role="gridcell"
                      aria-label={format(day, 'dd MMMM yyyy', { locale: fr })}
                      aria-selected={selected ? isSameDay(day, selected) : false}
                      aria-current={isToday(day) ? 'date' : undefined}
                      data-in-range={inRange || undefined}
                      disabled={Boolean(disabled)}
                      onClick={() => {
                        onChange(format(day, 'yyyy-MM-dd'));
                        setOpen(false);
                      }}
                      className={cn(
                        'flex h-9 items-center justify-center rounded-md text-sm transition-colors',
                        'hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring',
                        !currentMonth && 'text-muted-foreground/50',
                        inRange && 'bg-primary/10 text-foreground',
                        rangeBoundary && 'ring-1 ring-primary/40',
                        isToday(day) && 'font-[700] underline decoration-2 underline-offset-4',
                        selected &&
                          isSameDay(day, selected) &&
                          'bg-primary text-primary-foreground hover:bg-primary/90',
                        disabled && 'pointer-events-none opacity-30',
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!value}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <XIcon aria-hidden="true" />
              Effacer
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const today = format(new Date(), 'yyyy-MM-dd');
                if ((!minDate || today >= (min ?? '')) && (!maxDate || today <= (max ?? ''))) {
                  onChange(today);
                }
                setOpen(false);
              }}
            >
              Aujourd’hui
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
