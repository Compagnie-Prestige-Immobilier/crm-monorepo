'use client';

import { CheckIcon, ChevronsUpDownIcon, PlusIcon, XIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { matchesSearch } from '@/lib/search';
import type { FilterOption } from '@/lib/types';
import { cn } from '@/lib/utils';

function labelSelectionne(selected: FilterOption | undefined, placeholder: string): string {
  return selected?.label ?? placeholder;
}

export function FilterCombobox({
  label,
  placeholder,
  options,
  value,
  onChange,
  className,
  required = false,
  onSearchChange,
  onCreate,
  filterOptions = true,
  onBlur,
}: {
  label: string;
  placeholder: string;
  options: readonly FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string | undefined;
  required?: boolean;
  onSearchChange?: ((search: string) => void) | undefined;
  onCreate?: ((search: string) => void) | undefined;
  filterOptions?: boolean | undefined;
  onBlur?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerId = useId();
  const labelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const ouvrir = (next: boolean): void => {
    setOpen(next);
    if (!next) return;
    setSearch('');
    onSearchChange?.('');
  };

  const selected = options.find((option) => option.value === value);
  const hasValue = value !== null;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label ? (
        <Label id={labelId} htmlFor={triggerId}>
          {label}
          {required ? (
            <span className="text-[0.8125rem] font-[500] text-destructive">Obligatoire</span>
          ) : null}
        </Label>
      ) : null}

      <div className="relative">
        <Popover open={open} onOpenChange={ouvrir}>
          <PopoverTrigger
            render={
              <Button
                id={triggerId}
                ref={triggerRef}
                variant="outline"
                // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- aria posé par Base UI
                role="combobox"
                onBlur={onBlur}
                aria-labelledby={`${labelId} ${triggerId}`}
                aria-haspopup="listbox"
                aria-required={required || undefined}
                className={cn('h-11 w-full justify-between gap-2 font-[400]', hasValue && 'pr-24')}
              />
            }
          >
            <span className={cn('truncate', selected === undefined && 'text-muted-foreground')}>
              {labelSelectionne(selected, placeholder)}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
          </PopoverTrigger>

          {/*
            La largeur par défaut du popover (`w-72`) s'écrasait sur celle du
            bouton déclencheur : un champ étroit ouvrait un menu tout aussi
            étroit, tronquant les libellés longs du référentiel.
          */}
          {/*
            `overflow-hidden` reprend la main sur le popover : c'est la LISTE
            qui défile, pas la boîte, sinon le champ de recherche s'en irait
            vers le haut au premier coup de molette.
          */}
          <PopoverContent className="w-max min-w-(--anchor-width) max-w-[min(28rem,90vw)] overflow-hidden p-0">
            {/*
              `shouldFilter={false}` : cmdk filtre par défaut avec son propre
              score, qui ignore les accents autant qu'il ignore le français.
              On filtre nous-mêmes, sur le texte replié, et la liste reste
              intégralement présente tant que rien n'est tapé.
            */}
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Chercher…"
                value={search}
                onValueChange={(next) => {
                  setSearch(next);
                  onSearchChange?.(next);
                }}
              />
              <ComboboxList
                options={options}
                value={value}
                search={search}
                placeholder={placeholder}
                filterOptions={filterOptions}
                onChangeValue={onChange}
                onClose={() => {
                  setOpen(false);
                }}
                onCreate={onCreate}
              />
            </Command>
          </PopoverContent>
        </Popover>

        {/*
          Hors du déclencheur : un `<button>` imbriqué dans un `<button>` est
          invalide, et le navigateur le sort du bouton parent en cassant la mise
          en page. Il est donc posé au-dessus, en position absolue.
        */}
        {hasValue ? (
          <button
            type="button"
            aria-label={`Effacer le filtre ${label}`}
            onClick={() => {
              onChange(null);
              triggerRef.current?.focus();
            }}
            className="absolute top-1/2 right-8 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--dur-1) ease-(--ease-out-cpi) hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ComboboxList({
  options,
  value,
  search,
  placeholder,
  filterOptions,
  onChangeValue,
  onClose,
  onCreate,
}: {
  options: readonly FilterOption[];
  value: string | null;
  search: string;
  placeholder: string;
  filterOptions: boolean;
  onChangeValue: (value: string | null) => void;
  onClose: () => void;
  onCreate?: ((search: string) => void) | undefined;
}) {
  return (
    <CommandList>
      <CommandEmpty>Aucun résultat.</CommandEmpty>
      <CommandGroup>
        <CommandItem
          value="__tous__"
          onSelect={() => {
            onChangeValue(null);
            onClose();
          }}
        >
          <CheckIcon
            className={cn('size-4', value === null ? 'opacity-100' : 'opacity-0')}
            aria-hidden="true"
          />
          <span className="text-muted-foreground">{placeholder}</span>
        </CommandItem>

        {options
          .filter((option) =>
            filterOptions ? matchesSearch(`${option.label} ${option.hint ?? ''}`, search) : true,
          )
          .map((option) => (
            <CommandItem
              key={option.value}
              value={`${option.label} ${option.hint ?? ''}`}
              onSelect={() => {
                onChangeValue(option.value === value ? null : option.value);
                onClose();
              }}
            >
              <CheckIcon
                className={cn(
                  'size-4 shrink-0',
                  value === option.value ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.hint !== undefined && option.hint !== '' ? (
                <span className="shrink-0 text-[0.75rem] text-muted-foreground">{option.hint}</span>
              ) : null}
            </CommandItem>
          ))}

        {onCreate !== undefined && search.trim() !== '' ? (
          <CommandItem
            value={`__creer__ ${search}`}
            onSelect={() => {
              onCreate(search.trim());
              onClose();
            }}
          >
            <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
            Créer « {search.trim()} »
          </CommandItem>
        ) : null}
      </CommandGroup>
    </CommandList>
  );
}
