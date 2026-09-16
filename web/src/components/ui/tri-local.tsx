import { SearchIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/lib/format';

type Valeur = string | number | boolean | Date | null | undefined;

const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function estVide(valeur: Valeur): boolean {
  return valeur === null || valeur === undefined || valeur === '';
}

function comparer(a: Valeur, b: Valeur): number {
  if (a === b) return 0;
  if (estVide(a)) return 1;
  if (estVide(b)) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return collator.compare(String(a), String(b));
}

export function useTriLocal<T, F extends string>(
  lignes: readonly T[],
  colonnes: Record<F, (ligne: T) => Valeur>,
) {
  const [sortBy, setSortBy] = useState<F | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [recherche, setRecherche] = useState('');

  const visibles = useMemo(() => {
    const cles = Object.keys(colonnes) as F[];
    const terme = normaliser(recherche.trim());
    const filtrees =
      terme === ''
        ? [...lignes]
        : lignes.filter((ligne) =>
            cles.some((cle) => {
              const valeur = colonnes[cle](ligne);
              if (valeur === null || valeur === undefined) return false;
              const texte = valeur instanceof Date ? valeur.toLocaleDateString('fr') : String(valeur);
              return normaliser(texte).includes(terme);
            }),
          );
    if (sortBy === null) return filtrees;
    const lire = colonnes[sortBy];
    const sens = sortDir === 'asc' ? 1 : -1;
    return filtrees.sort((a, b) => sens * comparer(lire(a), lire(b)));
  }, [lignes, colonnes, recherche, sortBy, sortDir]);

  function toggle(id: string) {
    const colonne = id as F;
    if (sortBy !== colonne) {
      setSortBy(colonne);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    setSortBy(null);
  }

  return { lignes: visibles, total: lignes.length, sortBy, sortDir, toggle, recherche, setRecherche };
}

export function RechercheTableau({
  recherche,
  setRecherche,
  total,
  affichees,
  label = 'Rechercher dans le tableau',
}: {
  recherche: string;
  setRecherche: (valeur: string) => void;
  total: number;
  affichees: number;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:max-w-xs">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={recherche}
          onChange={(event) => {
            setRecherche(event.target.value);
          }}
          placeholder="Rechercher"
          aria-label={label}
          className="pl-9"
        />
      </div>
      {recherche === '' ? null : (
        <>
          <span className="text-[0.875rem] text-muted-foreground tabular-nums" aria-live="polite">
            {formatNumber(affichees)} sur {formatNumber(total)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRecherche('');
            }}
          >
            <XIcon aria-hidden="true" />
            Effacer
          </Button>
        </>
      )}
    </div>
  );
}
