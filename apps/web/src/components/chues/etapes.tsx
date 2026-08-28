'use client';

import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Les trois étapes du projet CHUES, dans leur ordre réel, sous les mots du
 * métier. La constante sert le sélecteur, la page « Mon travail » et la barre
 * latérale : un intitulé qui change ici change partout.
 */
export const ETAPES = [
  { n: 1, titre: 'Qualifier un représentant', href: '/chues/appels-representants' },
  { n: 2, titre: 'Ajouter un prospect', href: '/chues/prospects/nouveau' },
  { n: 3, titre: 'Convertir un prospect', href: '/chues/console' },
] as const;

export type EtapeNumero = (typeof ETAPES)[number]['n'];

/** L'étape que ces segments désignent, `null` pour tout autre écran de CHUES. */
export function etapeDeSegments(segments: readonly string[]): EtapeNumero | null {
  if (segments[0] === 'appels-representants') return 1;
  if (segments[0] === 'prospects' && segments[1] === 'nouveau') return 2;
  if (segments[0] === 'console') return 3;
  return null;
}

/**
 * L'attente d'une étape, au gabarit des trois écrans. Elle laisse le sélecteur
 * visible et cliquable pendant que le contenu arrive : sans elle, la
 * navigation gardait l'écran précédent jusqu'à la réponse du serveur.
 */
export function EtapeSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * Le sélecteur, monté par la coque de CHUES et non par chaque écran : il reste
 * en place d'une étape à l'autre, l'étape cliquée s'allume à l'instant du clic,
 * et seul le contenu dessous est remplacé.
 */
export function EtapesNavAuto() {
  const courante = etapeDeSegments(useSelectedLayoutSegments());
  if (courante === null) return null;
  return <EtapesNav courante={courante} />;
}

/**
 * Les trois étapes MONTRÉES, pas racontées : chacune est un bouton, celle de
 * l'écran porte la marque, les deux autres s'ouvrent d'un clic. On saute donc
 * de la première à la troisième sans repasser par « Mon travail ».
 */
export function EtapesNav({ courante }: { courante: EtapeNumero }) {
  return (
    <nav aria-label="Les trois étapes">
      <ol className="grid gap-1 rounded-lg border border-border bg-card p-1 sm:grid-cols-3">
        {ETAPES.map((etape) => {
          const active = etape.n === courante;
          return (
            <li key={etape.n}>
              <Link
                href={etape.href}
                // Les trois écrans sont dynamiques : sans `prefetch`, seule la
                // frontière de chargement serait préchargée, et le clic
                // attendrait la réponse du serveur.
                prefetch
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-[0.875rem] font-[600]',
                  'transition-colors duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active
                    ? 'bg-accent-surface text-accent-text'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <span className="min-w-0 truncate">{etape.titre}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
