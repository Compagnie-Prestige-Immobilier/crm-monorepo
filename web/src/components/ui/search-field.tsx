import { SearchIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const REPORT_MS = 350;

/**
 * Seule une FRAPPE programme une publication. Une valeur qui change de
 * l'extérieur — « Tout effacer », un retour arrière — annule le report en
 * cours, sinon celui-ci republiait l'ancienne recherche par-dessus.
 */
export function useRechercheDifferee(
  valeur: string,
  publier: (suivante: string) => void,
): { brouillon: string; frapper: (suivante: string) => void } {
  const [brouillon, setBrouillon] = useState(valeur);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publierRef = useRef(publier);

  useEffect(() => {
    publierRef.current = publier;
  }, [publier]);

  const annuler = useCallback(() => {
    if (minuteur.current === null) return;
    clearTimeout(minuteur.current);
    minuteur.current = null;
  }, []);

  useEffect(() => {
    annuler();
    // oxlint-disable-next-line react/set-state-in-effect -- brouillon recalé sur la valeur amont
    setBrouillon(valeur);
  }, [annuler, valeur]);

  useEffect(() => annuler, [annuler]);

  const frapper = useCallback(
    (suivante: string) => {
      setBrouillon(suivante);
      annuler();
      minuteur.current = setTimeout(() => {
        minuteur.current = null;
        publierRef.current(suivante);
      }, REPORT_MS);
    },
    [annuler],
  );

  return { brouillon, frapper };
}

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
          type="text"
          value={value}
          placeholder={placeholder}
          className={cn('pl-9', value !== '' && 'pr-10')}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onFocus={(event) => {
            if (event.target.value !== '') event.target.select();
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || value === '') return;
            event.stopPropagation();
            onChange('');
          }}
        />
        {value === '' ? null : (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
