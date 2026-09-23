'use client';

import { FunnelIcon, ListFilterIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ComboboxList } from '@/components/filters/filter-combobox';
import { Command, CommandInput } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ariaSortDe, BoutonTri, type TriColonne } from '@/components/ui/sortable-table-head';
import { TableHead } from '@/components/ui/table';
import type { FilterOption } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface FiltreColonne {
  /** Nommé dans le bouton et dans la liste : « Filtrer par banque ». */
  label: string;
  placeholder: string;
  options: readonly FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}

export function FilterableTableHead<F extends string>({
  label,
  filtre,
  tri,
  className,
}: {
  label: ReactNode;
  filtre: FiltreColonne;
  tri?: TriColonne<F> | undefined;
  className?: string | undefined;
}) {
  return (
    <TableHead className={className} aria-sort={tri === undefined ? undefined : ariaSortDe(tri)}>
      <span className="inline-flex items-center gap-0.5">
        {tri === undefined ? label : <BoutonTri {...tri} />}
        <BoutonFiltre filtre={filtre} />
      </span>
    </TableHead>
  );
}

function BoutonFiltre({ filtre }: { filtre: FiltreColonne }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = filtre.options.find((option) => option.value === filtre.value);
  const actif = filtre.value !== null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSearch('');
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            // Le nom porte la valeur : sans lui, dix boutons « Filtrer » se
            // suivent dans la liste des contrôles d'un lecteur d'écran.
            aria-label={
              actif
                ? `${filtre.label}, filtré sur ${selected?.label ?? 'une valeur'}`
                : `Filtrer par ${filtre.label.toLowerCase()}`
            }
            className={cn(
              'tap-target inline-flex shrink-0 items-center justify-center rounded-sm transition-colors duration-(--dur-1) ease-(--ease-out-cpi) print:hidden',
              'hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              actif ? 'text-primary' : 'text-muted-foreground/70',
            )}
          />
        }
      >
        {/* Deux glyphes distincts, et pas seulement deux couleurs : l'entonnoir
            plein se voit en contraste élevé comme en niveaux de gris. */}
        {actif ? (
          <FunnelIcon className="size-3.5 fill-current" aria-hidden="true" />
        ) : (
          <ListFilterIcon className="size-3.5" aria-hidden="true" />
        )}
      </PopoverTrigger>

      <PopoverContent className="max-w-[90vw] overflow-hidden p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Chercher…" value={search} onValueChange={setSearch} />
          <ComboboxList
            options={filtre.options}
            value={filtre.value}
            search={search}
            placeholder={filtre.placeholder}
            filterOptions
            onChangeValue={filtre.onChange}
            onClose={() => {
              setOpen(false);
            }}
          />
        </Command>
      </PopoverContent>
    </Popover>
  );
}
