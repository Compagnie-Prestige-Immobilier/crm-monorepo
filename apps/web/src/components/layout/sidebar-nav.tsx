'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { homePathForRole, isNavItemActive, navSections } from '@/components/layout/nav-items';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Contenu de la barre latérale bordeaux (#3A010A, design.md §2.5).
 *
 * Le logo utilisé est `cpi-header.png`, la version INVERSÉE : le logo sur fond
 * clair posé sur du bordeaux profond donne un bloc sombre illisible.
 *
 * Le texte or de l'élément actif est `accent-on-dark` (#FFC65A, 11,3:1 sur la
 * sidebar) et non l'or décoratif — voir design.md §2.3.
 *
 * Le contenu dépend du RÔLE : un agent Banque & Finance n'y voit que ses quatre
 * écrans. Le rôle vient du layout serveur, qui l'a lu sur la session — pas d'un
 * appel client, qui afficherait un menu vide le temps d'un aller-retour.
 */
export function SidebarNav({
  role,
  // Fourni uniquement par le tiroir mobile, qui doit se refermer après un clic.
  // En version fixe il n'y a rien à fermer, d'où le repli sans effet.
  onNavigate = () => undefined,
}: {
  role: Role;
  onNavigate?: (() => void) | undefined;
}) {
  const pathname = usePathname();
  const sections = navSections(role);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
        <Link
          href={homePathForRole(role)}
          onClick={onNavigate}
          className="flex items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring"
        >
          <Image
            src="/brand/cpi-header.png"
            alt="CPI GO — retour à l’accueil"
            width={489}
            height={200}
            priority
            className="h-8 w-auto"
          />
        </Link>
      </div>

      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {sections.map((section, index) => (
          <div key={section.title ?? 'principal'} className={cn(index > 0 && 'mt-5')}>
            {section.title !== null ? (
              /* Intitulé de groupe RÉEL et non un simple séparateur visuel :
                 `aria-labelledby` le rattache à la liste, si bien qu'un lecteur
                 d'écran annonce « Banque & Finance, liste, 4 éléments » au lieu
                 de dérouler onze liens sans structure. */
              <h2
                id={`nav-section-${String(index)}`}
                className="px-3 pb-1.5 text-[0.6875rem] font-[600] uppercase tracking-wide opacity-70"
              >
                {section.title}
              </h2>
            ) : null}
            <ul
              className="flex flex-col gap-1"
              {...(section.title !== null
                ? { 'aria-labelledby': `nav-section-${String(index)}` }
                : {})}
            >
              {section.items.map((item) => {
                const isActive = isNavItemActive(role, pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-[0.875rem] font-[600]',
                        'transition-colors duration-150',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <Icon
                        className={cn('size-4 shrink-0', isActive && 'text-accent-on-dark')}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-[0.6875rem] uppercase tracking-wide opacity-70">CPI GO</p>
        {/* `opacity-60` donnait 4,39:1 en clair, sous les 4,5:1 d'un texte de
            12 px. `opacity-70` (5,60:1) garde la hiérarchie sans échouer. */}
        <p className="text-[0.75rem] opacity-70">
          {role === 'BANQUE_FINANCE' ? 'Espace Banque & Finance' : 'Panneau d’administration'}
        </p>
      </div>
    </div>
  );
}
