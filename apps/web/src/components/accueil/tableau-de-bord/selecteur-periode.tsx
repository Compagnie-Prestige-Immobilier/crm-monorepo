'use client';

import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarRangeIcon } from 'lucide-react';

import {
  PILLS,
  joursDansPlage,
  libellePreset,
  plageDuPreset,
  plageTropLarge,
  type Comparaison,
  type PeriodePreset,
  type Plage,
} from '@/components/accueil/tableau-de-bord/periode';
import { DatePicker } from '@/components/filters/date-picker';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UrlFilterAdapter } from '@/components/filters/use-url-filters';

export interface DashboardFilters {
  preset: PeriodePreset | 'libre';
  du: string;
  au: string;
  comparaison: Comparaison;
}

function defaultRange(): Plage {
  return plageDuPreset('ce-mois', new Date());
}

export function dashboardFiltersFromParams(params: URLSearchParams): DashboardFilters {
  const preset = params.get('periode');
  const comparaisonBrut = params.get('comparaison');
  const comparaison: Comparaison =
    comparaisonBrut === 'precedente' || comparaisonBrut === 'annee-precedente'
      ? comparaisonBrut
      : 'aucune';

  if (preset === 'libre') {
    const du = params.get('du');
    const au = params.get('au');
    if (du !== null && au !== null) return { preset: 'libre', du, au, comparaison };
  }

  const validPreset = PILLS.some((pill) => pill.preset === preset)
    ? (preset as PeriodePreset)
    : 'ce-mois';
  const plage = plageDuPreset(validPreset, new Date());
  return { preset: validPreset, du: plage.du, au: plage.au, comparaison };
}

export const dashboardFiltersAdapter: UrlFilterAdapter<DashboardFilters> = {
  parse: dashboardFiltersFromParams,
  serialize: (filters) => {
    const params = new URLSearchParams();
    params.set('periode', filters.preset);
    if (filters.preset === 'libre') {
      params.set('du', filters.du);
      params.set('au', filters.au);
    }
    if (filters.comparaison !== 'aucune') params.set('comparaison', filters.comparaison);
    return params;
  },
  cleared: () => {
    const plage = defaultRange();
    return { preset: 'ce-mois', du: plage.du, au: plage.au, comparaison: 'aucune' };
  },
};

export function plageDeFiltres(filters: DashboardFilters): Plage {
  if (filters.preset === 'libre') return { du: filters.du, au: filters.au };
  return plageDuPreset(filters.preset, new Date());
}

function formatJour(iso: string): string {
  return format(parseISO(iso), 'dd MMM yyyy', { locale: fr });
}

export function periodeAffichee(filters: DashboardFilters): string {
  if (filters.preset !== 'libre') return libellePreset(filters.preset);
  return `${formatJour(filters.du)} – ${formatJour(filters.au)}`;
}

export function SelecteurPeriode({
  filters,
  onChange,
}: {
  filters: DashboardFilters;
  onChange: (patch: Partial<DashboardFilters>) => void;
}) {
  const plage = plageDeFiltres(filters);
  const tropLarge = plageTropLarge(plage);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Période affichée">
        {PILLS.map((pill) => (
          <Button
            key={pill.preset}
            type="button"
            variant={filters.preset === pill.preset ? 'default' : 'outline'}
            size="sm"
            aria-pressed={filters.preset === pill.preset}
            onClick={() => {
              const range = plageDuPreset(pill.preset, new Date());
              onChange({ preset: pill.preset, du: range.du, au: range.au });
            }}
          >
            {pill.label}
          </Button>
        ))}

        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant={filters.preset === 'libre' ? 'default' : 'outline'}
                size="sm"
                aria-pressed={filters.preset === 'libre'}
              />
            }
          >
            <CalendarRangeIcon aria-hidden="true" />
            Plage libre
          </PopoverTrigger>
          <PopoverContent className="flex flex-col gap-3 p-4" align="start">
            <div className="flex flex-wrap gap-3">
              <DatePicker
                id="periode-libre-du"
                label="Du"
                value={filters.du}
                max={filters.au}
                onChange={(value) => {
                  if (value !== null) onChange({ preset: 'libre', du: value });
                }}
              />
              <DatePicker
                id="periode-libre-au"
                label="Au"
                value={filters.au}
                min={filters.du}
                onChange={(value) => {
                  if (value !== null) onChange({ preset: 'libre', au: value });
                }}
              />
            </div>
          </PopoverContent>
        </Popover>

        <Select
          value={filters.comparaison}
          onValueChange={(value) => {
            if (value !== null) onChange({ comparaison: value });
          }}
        >
          <SelectTrigger aria-label="Comparer à" size="sm" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aucune">Comparer à : rien</SelectItem>
            <SelectItem value="precedente">Comparer à : période précédente</SelectItem>
            <SelectItem value="annee-precedente">Comparer à : même période l’an dernier</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tropLarge ? (
        <p className="text-[0.8125rem] text-destructive" role="alert">
          Cette plage dépasse {String(400)} jours ({String(joursDansPlage(plage))} jours) : revenez
          à une période plus courte.
        </p>
      ) : null}
    </div>
  );
}
