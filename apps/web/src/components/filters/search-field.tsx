'use client';

import { SearchIcon, XIcon } from 'lucide-react';
import { useId, useRef } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Le champ de recherche des barres de filtre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Deux gestes, répétés vingt fois par jour, supprimés.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. **Le contenu est SÉLECTIONNÉ à la prise de focus quand le champ porte
 *    déjà quelque chose.** Sans cela, le curseur se pose là où le clic est
 *    tombé : au milieu du mot : et remplacer une recherche demande de vider le
 *    champ caractère par caractère, ou de viser précisément sa fin. Avec, une
 *    frappe remplace, `Supprimer` vide. C'est le comportement de la barre
 *    d'adresse d'un navigateur, et personne n'a besoin qu'on le lui explique.
 *
 * 2. **Une croix vide le champ.** `type="search"` en propose une dans certains
 *    navigateurs seulement, jamais dans Firefox, et jamais avec un contraste
 *    mesuré. On la dessine, avec les tokens du panel.
 *
 * `Échap` vide aussi : la main est déjà au clavier, elle n'a pas à repartir
 * vers la souris.
 *
 * La valeur est pilotée par l'appelant, qui la reporte à l'URL après une pause
 * de frappe. Le champ lui-même ne déclenche aucune requête : écrire dans l'URL
 * à chaque caractère relancerait une requête par lettre, et le tableau
 * clignoterait pendant toute la saisie.
 */
export function SearchField({
  label = 'Recherche',
  placeholder,
  value,
  onChange,
  className,
}: {
  label?: string | undefined;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string | undefined;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn('flex min-w-[15rem] flex-1 flex-col gap-1.5', className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          ref={inputRef}
          /*
            `type="text"` et non `"search"` : la croix native de WebKit se
            superpose à la nôtre, ne respecte aucun token de couleur et
            n'existe pas dans Firefox. Une seule croix, dessinée ici, se
            comporte pareil partout.
          */
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onFocus={(event) => {
            // Uniquement si le champ porte quelque chose : tout sélectionner
            // dans un champ vide n'a aucun effet, mais l'appel déplacerait
            // inutilement le curseur sur mobile.
            if (event.target.value !== '') event.target.select();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && value !== '') {
              // `stopPropagation` : sans lui, `Échap` refermerait aussi le
              // panneau ou la boîte de dialogue qui contient le champ, et
              // l'utilisateur perdrait le contexte en voulant vider un mot.
              event.stopPropagation();
              onChange('');
            }
          }}
          placeholder={placeholder}
          className={cn('pl-9', value !== '' && 'pr-10')}
        />
        {value !== '' ? (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => {
              onChange('');
              // Le focus reste dans le champ : on efface pour retaper, pas
              // pour partir ailleurs.
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--dur-1) ease-(--ease-out-cpi) hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
