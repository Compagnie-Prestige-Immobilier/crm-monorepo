'use client';

import { SearchIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import type { Role } from '@/lib/types';

/** Ceux qui ouvrent la liste des prospects, le seul écran où le champ mène. */
const CHERCHEURS: readonly Role[] = ['ADMIN', 'SUPERVISEUR', 'DIRECTION'];

/**
 * Chercher une fiche depuis n'importe quel écran. Le champ ne fabrique pas un
 * moteur transverse : il emmène à la liste des prospects, déjà filtrable par
 * nom, téléphone et référence, avec le terme posé dans l'URL.
 *
 * Il n'apparaît qu'au-delà de 1 536 px : la barre partage sa largeur avec le
 * titre de l'écran, qui se tronquait jusqu'à disparaître.
 */
export function RechercheGlobale({ role }: { role: Role }) {
  const router = useRouter();
  const [terme, setTerme] = useState('');

  if (!CHERCHEURS.includes(role)) return null;

  return (
    <form
      role="search"
      className="relative hidden w-56 shrink-0 2xl:block"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        const cherche = terme.trim();
        if (cherche === '') return;
        router.push(`/teleconseil/prospects?search=${encodeURIComponent(cherche)}`);
      }}
    >
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={terme}
        aria-label="Chercher un prospect"
        placeholder="Chercher un prospect…"
        className="pl-9"
        onChange={(evenement) => {
          setTerme(evenement.target.value);
        }}
      />
    </form>
  );
}
