import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Le retour à la liste, sur un écran de détail.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Il doit être rendu AVANT l'état de chargement, pas après.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les trois écrans de détail (campagne, campagne représentants, dossier
 * bancaire) sortaient en `return` dès la branche d'erreur, donc AVANT ce lien.
 * Un identifiant périmé : un signet, un lien collé dans un message, une
 * campagne clôturée puis purgée : produisait alors un écran sans aucune issue :
 * l'erreur est un 404, que `QueryErrorState` ne propose pas de rejouer (et il a
 * raison : recliquer ne fera pas réapparaître la ligne), et il n'y avait aucun
 * chemin vers la liste. Restait le bouton « Précédent » du navigateur, qui n'est
 * pas une réponse de conception.
 *
 * Extrait en composant partagé pour que le lien soit posé au même endroit sur
 * les trois écrans, et qu'il ne puisse pas retomber sous un `return`.
 */
export function DetailBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild variant="ghost" className="w-fit -ml-2">
      <Link href={href}>
        <ArrowLeftIcon aria-hidden="true" />
        {children}
      </Link>
    </Button>
  );
}
