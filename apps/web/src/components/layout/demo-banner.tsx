import Link from 'next/link';
import { FlaskConicalIcon } from 'lucide-react';

import { formatDate } from '@/lib/format';
import type { Role } from '@/lib/types';

/**
 * Bandeau global du mode démonstration.
 *
 * C'est le garde-fou le plus important de cette fonctionnalité, et il ne coûte
 * qu'une ligne à l'écran. Le mode démonstration remplit la base de prospects,
 * de dossiers et de campagnes parfaitement crédibles. Sans marque permanente,
 * quelqu'un exporte un classeur, l'envoie à la direction, et personne ne
 * s'aperçoit avant la réunion que les chiffres sont inventés. Le bandeau est
 * donc rendu sur TOUS les écrans du panel, pas seulement sur la page qui
 * commande la bascule.
 *
 * Il est posé par le layout SERVEUR, à partir de l'état lu au rendu : un
 * bandeau chargé côté client apparaîtrait après coup, c'est-à-dire après que
 * l'utilisateur a commencé à lire les chiffres.
 *
 * Couleurs : surface or `accent-surface` avec du texte `warning` (#856011,
 * 5,71:1). Jamais l'or décoratif #C8921A en texte — design.md §2.3.
 */
export function DemoBanner({ seededAt, role }: { seededAt: string | null; role: Role }) {
  return (
    <div
      // `role="status"` et non `alert` : l'information est permanente et
      // contextuelle. Un `alert` interromprait la lecture à chaque navigation.
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-accent-border/40 bg-accent-surface px-4 py-2 text-center text-[0.8125rem] text-warning"
    >
      <FlaskConicalIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="font-[600]">Mode démonstration actif.</span>
      <span>
        Les données affichées sont fictives
        {seededAt !== null ? ` — jeu créé le ${formatDate(seededAt)}` : ''}. Ne les exportez pas
        comme des chiffres réels.
      </span>
      {role === 'ADMIN' ? (
        <Link
          href="/parametres"
          className="rounded-sm font-[600] underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Gérer
        </Link>
      ) : null}
    </div>
  );
}
