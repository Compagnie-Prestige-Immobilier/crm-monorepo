import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';

/**
 * Les trois gestes du projet CHUES, dans leur ordre réel. La constante sert le
 * bandeau de chaque écran ET la page « Projet CHUES » : un numéro qui change
 * ici change partout.
 */
export const ETAPES = [
  { n: 1, titre: 'Appeler les représentants', href: '/chues/appels-representants' },
  { n: 2, titre: 'Noter les prospects', href: '/chues/prospects/nouveau' },
  { n: 3, titre: 'Appeler les prospects', href: '/chues/console' },
] as const;

export type EtapeNumero = (typeof ETAPES)[number]['n'];

/**
 * « Où suis-je, et qu'est-ce qui vient après ? » en une ligne, au-dessus de
 * l'écran. Sans elle, trois écrans d'appel se ressemblent assez pour qu'on ne
 * sache plus lequel est ouvert.
 */
export function EtapeBanner({ n }: { n: EtapeNumero }) {
  const etape = ETAPES.find((item) => item.n === n);
  if (etape === undefined) return null;
  const suivante = ETAPES.find((item) => item.n === n + 1);

  return (
    <nav
      aria-label="Étapes du projet CHUES"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-4 py-2.5 text-[0.875rem]"
    >
      <Link
        href="/chues"
        className="inline-flex items-center gap-1.5 rounded-sm font-[600] text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeftIcon className="size-4 shrink-0" aria-hidden="true" />
        Projet CHUES
      </Link>

      <span aria-hidden="true" className="text-muted-foreground">
        |
      </span>

      <span className="font-[600]">
        Étape {etape.n} sur {ETAPES.length} · {etape.titre}
      </span>

      <span aria-hidden="true" className="text-muted-foreground">
        |
      </span>

      {suivante === undefined ? (
        // Après le troisième appel, la suite n'est plus un écran : le dossier
        // change de mains.
        <span className="text-muted-foreground">Ensuite : le dossier passe à la banque</span>
      ) : (
        <Link
          href={suivante.href}
          className="inline-flex items-center gap-1.5 rounded-sm text-muted-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Ensuite : {suivante.titre}
          <ArrowRightIcon className="size-4 shrink-0" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
