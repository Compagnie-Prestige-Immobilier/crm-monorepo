'use client';

import { MegaphoneIcon, UsersRoundIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Les deux déclinaisons de la campagne d'appels.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * « Prospects » et « Représentants » ne nommaient pas ce qu'on regardait.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les onglets portaient les seuls mots « Prospects » et « Représentants », qui
 * sont AUSSI les intitulés de deux écrans de liste sans aucun rapport, dans la
 * même barre latérale. Sur `/campagnes`, un onglet « Prospects » se lit comme un
 * lien vers la liste des prospects. La famille est « campagne d'appels », et
 * chaque onglet en nomme la déclinaison.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Des LIENS, pas un composant d'onglets.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Chaque onglet est une route à part entière (`/campagnes` et
 * `/campagnes/representants`), pour trois raisons qui tiennent toutes à l'URL :
 *
 *  - les deux listes sont filtrables, et `useUrlFilters` réécrit la chaîne de
 *    requête entière : partager une URL ferait qu'un « Tout effacer » d'un côté
 *    emporte les critères de l'autre ;
 *  - un lien collé dans un message rouvre la bonne liste, filtres compris ;
 *  - le rendu serveur peut précharger la seule liste demandée, au lieu de tirer
 *    les deux et d'en jeter une.
 *
 * `aria-current="page"` et non `role="tab"` : ce sont des liens de navigation,
 * et les annoncer comme des onglets promettrait un contenu déjà chargé.
 */

const TABS: readonly { href: string; label: string; icon: typeof MegaphoneIcon }[] = [
  { href: '/campagnes', label: 'Appels prospects', icon: MegaphoneIcon },
  { href: '/campagnes/representants', label: 'Appels représentants', icon: UsersRoundIcon },
];

export function CampaignsTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Type de campagne">
      <ul className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
        {TABS.map((tab) => {
          // Correspondance par préfixe : le détail d'une campagne
          // représentants doit garder son onglet surligné.
          const active =
            tab.href === '/campagnes'
              ? pathname === '/campagnes' || /^\/campagnes\/(?!representants)/u.test(pathname)
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-[0.875rem] font-[600]',
                  'transition-colors duration-(--dur-1) ease-(--ease-out-cpi)',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active
                    ? 'bg-card text-foreground shadow-elev-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
