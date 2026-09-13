'use client';

import { CloudOffIcon } from 'lucide-react';

/**
 * Le brouillon part au fil de l'eau ; quand l'envoi échoue, il repart à la
 * frappe suivante. Sans cette ligne le téléconseiller croit sa saisie à l'abri
 * et fermerait l'onglet sans savoir qu'il l'emporte.
 */
export function BrouillonEnAttente({ enAttente }: { enAttente: boolean }) {
  if (!enAttente) return null;
  return (
    <p
      role="status"
      className="flex items-center gap-1.5 text-[0.8125rem] font-[500] text-amber-600 dark:text-amber-400"
    >
      <CloudOffIcon className="size-4 shrink-0" aria-hidden="true" />
      Saisie non enregistrée. Ne fermez pas cet onglet, elle repartira toute seule.
    </p>
  );
}
