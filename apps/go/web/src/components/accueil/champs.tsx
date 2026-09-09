import { CheckIcon, ChevronsUpDownIcon, SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface Choix {
  value: string;
  label: string;
}

/**
 * Une liste de référence peut compter des centaines d'entrées : le champ se
 * cherche au clavier plutôt que de se dérouler.
 */
export function ChampListe({
  label,
  placeholder,
  options,
  value,
  required = false,
  error,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: readonly Choix[];
  value: string | null;
  required?: boolean;
  error?: string | undefined;
  onChange: (value: string | null) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const choisi = options.find((option) => option.value === value);

  return (
    <Field label={label} required={required} error={error}>
      {(props) => (
        <Popover open={ouvert} onOpenChange={setOuvert}>
          <PopoverTrigger
            render={
              <Button
                {...props}
                type="button"
                variant="outline"
                className="w-full justify-between font-[400]"
              />
            }
          >
            <span
              className={cn('min-w-0 truncate', choisi === undefined && 'text-muted-foreground')}
            >
              {choisi?.label ?? placeholder}
            </span>
            <ChevronsUpDownIcon className="size-4 opacity-60" aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent className="w-(--anchor-width) min-w-64 p-0">
            <Command>
              <CommandInput placeholder={`Chercher : ${label.toLowerCase()}`} />
              <CommandList>
                <CommandEmpty>Aucune entrée ne correspond.</CommandEmpty>
                {value === null ? null : (
                  <CommandItem
                    value="__vider__"
                    onSelect={() => {
                      onChange(null);
                      setOuvert(false);
                    }}
                  >
                    <XIcon aria-hidden="true" />
                    Effacer le choix
                  </CommandItem>
                )}
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      onChange(option.value);
                      setOuvert(false);
                    }}
                  >
                    <CheckIcon
                      aria-hidden="true"
                      className={cn(
                        'text-primary',
                        option.value === value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0 flex-1">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </Field>
  );
}

export function ChampDate({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string | null;
  min?: string | null;
  max?: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <Field label={label}>
      {(props) => (
        <Input
          {...props}
          type="date"
          className="w-44"
          value={value ?? ''}
          {...(min === null || min === undefined ? {} : { min })}
          {...(max === null || max === undefined ? {} : { max })}
          onChange={(event) => {
            onChange(event.target.value === '' ? null : event.target.value);
          }}
        />
      )}
    </Field>
  );
}

const DELAI_FRAPPE_MS = 300;

/** La frappe reste immédiate ; l'URL et la requête ne suivent qu'une fois la main levée. */
export function ChampRecherche({
  label = 'Rechercher',
  valeur,
  placeholder,
  onChange,
}: {
  label?: string;
  valeur: string;
  placeholder: string;
  onChange: (valeur: string) => void;
}) {
  const id = useId();
  const [brouillon, setBrouillon] = useState(valeur);
  const [dernierExterne, setDernierExterne] = useState(valeur);

  // Ajustement pendant le rendu : quand l'URL change ailleurs (retour arrière,
  // filtres effacés), le champ suit sans passer par un effet.
  if (valeur !== dernierExterne) {
    setDernierExterne(valeur);
    setBrouillon(valeur);
  }

  useEffect(() => {
    if (brouillon === valeur) return;
    const timer = setTimeout(() => {
      onChange(brouillon);
    }, DELAI_FRAPPE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [brouillon, valeur, onChange]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          type="search"
          className="pl-9"
          placeholder={placeholder}
          value={brouillon}
          onChange={(event) => {
            setBrouillon(event.target.value);
          }}
        />
      </div>
    </div>
  );
}
