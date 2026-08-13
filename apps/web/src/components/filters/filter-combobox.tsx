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

/**
 * Combobox de filtre : bouton + liste cherchable.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Le libellé est rattaché au déclencheur par `aria-labelledby`, PAS par le
 * seul `<label for>`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La nuance est décisive et l'erreur était bien réelle : le nom accessible d'un
 * `<button>` se calcule par `aria-labelledby`, puis `aria-label`, puis son
 * propre contenu — un `<label for>` n'entre nulle part dans cette chaîne
 * (contrairement à `input`, `select` ou `textarea`). Le `<label>` rendait donc
 * le clic pratique, et rien de plus : un lecteur d'écran annonçait « Tous les
 * commerciaux, bouton » sans jamais prononcer « Commercial ». Avec
 * `aria-labelledby`, il annonce « Commercial, Tous les commerciaux ».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Trois gestes économisés, pour quelqu'un qui filtre vingt fois par jour.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. **Effacer se fait sur place.** Une croix apparaît dès qu'un critère porte
 *    une valeur. Sans elle, retirer un filtre demandait d'ouvrir la liste, de
 *    remonter jusqu'à « Tous les… », puis de cliquer : trois gestes pour
 *    défaire ce qu'un seul avait fait.
 * 2. **La recherche repart de zéro à chaque ouverture.** Le texte tapé la fois
 *    précédente filtrerait la liste avant même qu'on l'ait vue : on ouvrirait
 *    sur « Aucun résultat » alors qu'une valeur est sélectionnée. La liste
 *    ouverte montre TOUJOURS la valeur courante et ses voisines, et elle défile.
 * 3. **Les accents ne bloquent plus.** « thies » trouve « Thiès » (voir
 *    `lib/search.ts`). Le rapprochement littéral ne ratait pas une frappe : il
 *    ratait une donnée qui existe, et l'utilisateur en concluait que le
 *    département manquait au référentiel.
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
  const [search, setSearch] = useState('');
  const triggerId = useId();
  const labelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  /**
   * La recherche est vidée à CHAQUE ouverture.
   *
   * `PopoverContent` démonte son contenu à la fermeture, mais l'état vit ici et
   * survivrait donc au cycle. Rouvrir sur un texte oublié afficherait une liste
   * déjà filtrée, parfois vide, sans que rien à l'écran n'explique pourquoi.
   */
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const selected = options.find((option) => option.value === value);
  const hasValue = value !== null;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label id={labelId} htmlFor={triggerId}>
        {label}
      </Label>

      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={triggerId}
              ref={triggerRef}
              variant="outline"
              /*
                `aria-labelledby` liste le libellé PUIS le déclencheur : le nom
                devient « Commercial Tous les commerciaux ». Sans le second id,
                le nom se réduirait au libellé et la valeur choisie ne serait
                plus annoncée.
              */
              role="combobox"
              aria-labelledby={`${labelId} ${triggerId}`}
              aria-haspopup="listbox"
              aria-expanded={open}
              className={cn(
                'h-11 w-full justify-between gap-2 font-[400]',
                // Place réservée à la croix : sans elle, le libellé passerait
                // dessous et se ferait couper à un caractère près.
                hasValue && 'pr-16',
              )}
            >
              <span className={cn('truncate', selected === undefined && 'text-muted-foreground')}>
                {selected?.label ?? placeholder}
              </span>
              <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
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
                        // Le libellé et non l'UUID : cmdk s'en sert pour la
                        // navigation clavier, et un identifiant y serait
                        // illisible autant qu'inutile.
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
              // Le focus revient au déclencheur : sans cela, il retomberait sur
              // le `<body>` et le `Tab` suivant repartirait du haut de la page.
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
