'use client';

import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

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

export function FilterCombobox({
  label,
  placeholder,
  options,
  value,
  onChange,
  className,
  required = false,
}: {
  label: string;
  placeholder: string;
  options: readonly FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string | undefined;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerId = useId();
  const labelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const selected = options.find((option) => option.value === value);
  const hasValue = value !== null;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label id={labelId} htmlFor={triggerId}>
        {label}
        {required ? (
          <span className="text-destructive" aria-label="obligatoire">
            *
          </span>
        ) : null}
      </Label>

      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                id={triggerId}
                ref={triggerRef}
                variant="outline"
                role="combobox"
                aria-labelledby={`${labelId} ${triggerId}`}
                aria-haspopup="listbox"
                aria-required={required || undefined}
                className={cn('h-11 w-full justify-between gap-2 font-[400]', hasValue && 'pr-16')}
              />
            }
          >
            <span className={cn('truncate', selected === undefined && 'text-muted-foreground')}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
          </PopoverTrigger>

          <PopoverContent className="w-(--anchor-width) p-0">
            {/*
              `shouldFilter={false}` : cmdk filtre par défaut avec son propre
              score, qui ignore les accents autant qu'il ignore le français.
              On filtre nous-mêmes, sur le texte replié, et la liste reste
              intégralement présente tant que rien n'est tapé.
            */}
            <Command shouldFilter={false}>
              <CommandInput placeholder="Chercher…" value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>Aucun résultat.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__tous__"
                    onSelect={() => {
                      onChange(null);
                      setOpen(false);
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
                      matchesSearch(`${option.label} ${option.hint ?? ''}`, search),
                    )
                    .map((option) => (
                      <CommandItem
                        key={option.value}
                        value={`${option.label} ${option.hint ?? ''}`}
                        onSelect={() => {
                          onChange(option.value === value ? null : option.value);
                          setOpen(false);
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
                          <span className="shrink-0 text-[0.75rem] text-muted-foreground">
                            {option.hint}
                          </span>
                        ) : null}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
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
            className="absolute top-1/2 right-8 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--dur-1) ease-(--ease-out-cpi) hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
