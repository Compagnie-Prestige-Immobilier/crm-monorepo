'use client';

import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { useId, useState } from 'react';

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
import type { FilterOption } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Combobox de filtre : bouton + liste cherchable.
 *
 * Le libellé est rattaché au déclencheur par `aria-labelledby`, PAS par le seul
 * `<label for>`.
 *
 * La nuance est décisive et l'erreur était bien réelle : le nom accessible d'un
 * `<button>` se calcule par `aria-labelledby`, puis `aria-label`, puis son
 * propre contenu — un `<label for>` n'entre nulle part dans cette chaîne
 * (contrairement à `input`, `select` ou `textarea`). Le `<label>` rendait donc
 * le clic pratique, et rien de plus : un lecteur d'écran annonçait « Tous les
 * commerciaux, bouton » sans jamais prononcer « Commercial ». Avec
 * `aria-labelledby`, il annonce « Commercial, Tous les commerciaux ».
 */
export function FilterCombobox({
  label,
  placeholder,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  placeholder: string;
  options: readonly FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const labelId = useId();

  const selected = options.find((option) => option.value === value);

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label id={labelId} htmlFor={triggerId}>
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={triggerId}
            variant="outline"
            /*
              `aria-labelledby` liste le libellé PUIS le déclencheur : le nom
              devient « Commercial Tous les commerciaux ». Sans le second id, le
              nom se réduirait au libellé et la valeur choisie ne serait plus
              annoncée.
            */
            role="combobox"
            aria-labelledby={`${labelId} ${triggerId}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="h-11 w-full justify-between gap-2 font-[400]"
          >
            <span className={cn('truncate', selected === undefined && 'text-muted-foreground')}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder={`Chercher…`} />
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
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    // `value` sert au filtrage clavier de cmdk : on y met le
                    // libellé, pas l'UUID, sinon la recherche ne trouve rien.
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
    </div>
  );
}
