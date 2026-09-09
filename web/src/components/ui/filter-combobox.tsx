import { CheckIcon, ChevronsUpDownIcon, PlusIcon, XIcon } from 'lucide-react';
import { useId, useRef, useState, type RefObject } from 'react';

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
import { cn } from '@/lib/utils';

export interface OptionFiltre {
  value: string;
  label: string;
  hint?: string | undefined;
}

/** Recherche insensible aux accents : « Kedougou » doit trouver « Kédougou ». */
function replier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function correspond(texte: string, recherche: string): boolean {
  const terme = replier(recherche.trim());
  return terme === '' || replier(texte).includes(terme);
}

function Liste({
  options,
  value,
  recherche,
  placeholder,
  filtrer,
  onChoisir,
  onCreer,
}: {
  options: readonly OptionFiltre[];
  value: string | null;
  recherche: string;
  placeholder: string;
  filtrer: boolean;
  onChoisir: (value: string | null) => void;
  onCreer: ((recherche: string) => void) | undefined;
}) {
  const visibles = options.filter(
    (option) => !filtrer || correspond(`${option.label} ${option.hint ?? ''}`, recherche),
  );

  return (
    <CommandList>
      <CommandEmpty>Aucun résultat.</CommandEmpty>
      <CommandGroup>
        <CommandItem
          value="__tous__"
          onSelect={() => {
            onChoisir(null);
          }}
        >
          <CheckIcon
            className={cn('size-4', value === null ? 'opacity-100' : 'opacity-0')}
            aria-hidden="true"
          />
          <span className="text-muted-foreground">{placeholder}</span>
        </CommandItem>

        {visibles.map((option) => (
          <CommandItem
            key={option.value}
            value={`${option.label} ${option.hint ?? ''}`}
            onSelect={() => {
              onChoisir(option.value === value ? null : option.value);
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
            {option.hint === undefined || option.hint === '' ? null : (
              <span className="shrink-0 text-[0.75rem] text-muted-foreground">{option.hint}</span>
            )}
          </CommandItem>
        ))}

        {onCreer === undefined || recherche.trim() === '' ? null : (
          <CommandItem
            value={`__creer__ ${recherche}`}
            onSelect={() => {
              onCreer(recherche.trim());
            }}
          >
            <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
            Créer « {recherche.trim()} »
          </CommandItem>
        )}
      </CommandGroup>
    </CommandList>
  );
}

/** Hors du déclencheur : un `<button>` dans un `<button>` est invalide. */
function BoutonEffacer({ label, onEffacer }: { label: string; onEffacer: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Effacer le filtre ${label}`}
      onClick={onEffacer}
      className="absolute top-1/2 right-8 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <XIcon className="size-4" aria-hidden="true" />
    </button>
  );
}

function Declencheur({
  triggerId,
  labelId,
  triggerRef,
  choisi,
  placeholder,
  required,
  aUneValeur,
}: {
  triggerId: string;
  labelId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  choisi: OptionFiltre | undefined;
  placeholder: string;
  required: boolean;
  aUneValeur: boolean;
}) {
  return (
    <PopoverTrigger
      render={
        <Button
          id={triggerId}
          ref={triggerRef}
          variant="outline"
          aria-labelledby={`${labelId} ${triggerId}`}
          aria-required={required || undefined}
          className={cn('h-11 w-full justify-between gap-2 font-[400]', aUneValeur && 'pr-24')}
        />
      }
    >
      <span className={cn('truncate', choisi === undefined && 'text-muted-foreground')}>
        {choisi?.label ?? placeholder}
      </span>
      <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
    </PopoverTrigger>
  );
}

export function FilterCombobox({
  label,
  placeholder,
  options,
  value,
  onChange,
  className,
  required = false,
  filtrer = true,
  onSearchChange,
  onCreer,
}: {
  label: string;
  placeholder: string;
  options: readonly OptionFiltre[];
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string | undefined;
  required?: boolean | undefined;
  /** `false` quand la recherche est faite par le serveur. */
  filtrer?: boolean | undefined;
  onSearchChange?: ((recherche: string) => void) | undefined;
  onCreer?: ((recherche: string) => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [recherche, setRecherche] = useState('');
  const triggerId = useId();
  const labelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const choisi = options.find((option) => option.value === value);

  const ouvrir = (suivant: boolean): void => {
    setOpen(suivant);
    if (!suivant) return;
    setRecherche('');
    onSearchChange?.('');
  };

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label id={labelId} htmlFor={triggerId}>
        {label}
        {required ? (
          <span className="text-[0.8125rem] font-[500] text-destructive">Obligatoire</span>
        ) : null}
      </Label>

      <div className="relative">
        <Popover open={open} onOpenChange={ouvrir}>
          <Declencheur
            triggerId={triggerId}
            labelId={labelId}
            triggerRef={triggerRef}
            choisi={choisi}
            placeholder={placeholder}
            required={required}
            aUneValeur={value !== null}
          />

          <PopoverContent className="w-max min-w-(--anchor-width) max-w-[min(28rem,90vw)] overflow-hidden p-0">
            {/* cmdk filtre par son propre score, qui ignore le français : on filtre nous-mêmes. */}
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Chercher…"
                value={recherche}
                onValueChange={(suivant) => {
                  setRecherche(suivant);
                  onSearchChange?.(suivant);
                }}
              />
              <Liste
                options={options}
                value={value}
                recherche={recherche}
                placeholder={placeholder}
                filtrer={filtrer}
                onChoisir={(suivant) => {
                  onChange(suivant);
                  setOpen(false);
                }}
                onCreer={
                  onCreer === undefined
                    ? undefined
                    : (terme) => {
                        onCreer(terme);
                        setOpen(false);
                      }
                }
              />
            </Command>
          </PopoverContent>
        </Popover>

        {value === null ? null : (
          <BoutonEffacer
            label={label}
            onEffacer={() => {
              onChange(null);
              triggerRef.current?.focus();
            }}
          />
        )}
      </div>
    </div>
  );
}
