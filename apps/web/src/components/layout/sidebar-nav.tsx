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
  /**
   * Barre RÉDUITE : icônes seules.
   *
   * Le libellé quitte l'écran mais PAS l'arbre d'accessibilité — il passe en
   * `sr-only` et sert d'`aria-label`. Une navigation réduite à onze icônes
   * muettes serait inutilisable au lecteur d'écran, et c'est le genre de
   * régression qu'un repli purement visuel introduit sans qu'on la voie.
   */
  collapsed = false,
  /**
   * Cible d'`aria-controls` du bouton de repli. Sans identifiant réel dans le
   * document, l'attribut pointe vers rien : le lecteur d'écran annonce un
   * bouton qui « contrôle » un élément introuvable, ce qui vaut moins que pas
   * d'attribut du tout.
   */
  navId,
}: {
  role: Role;
  onNavigate?: (() => void) | undefined;
  collapsed?: boolean | undefined;
  navId?: string | undefined;
}) {
  const pathname = usePathname();
  const sections = navSections(role);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'px-5',
        )}
      >
        <Link
          href={homePathForRole(role)}
          onClick={onNavigate}
          className="flex items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring"
        >
          {/*
            Réduite, la barre passe au logo CARRÉ. Le logo en bandeau mesuré
            pour 17 rem se retrouverait à moins de 40 px de large : le texte
            « Compagnie Prestige Immobilier » y devient une bavure grise, et une
            marque illisible vaut moins qu'une marque absente.
          */}
          <Image
            src={collapsed ? '/brand/icon-512.png' : '/brand/cpi-header.png'}
            alt="CPI GO, retour à l’accueil"
            width={collapsed ? 512 : 489}
            height={collapsed ? 512 : 200}
            priority
            className={cn('w-auto', collapsed ? 'size-9 rounded-sm' : 'h-8')}
          />
        </Link>
      </div>

      <nav
        id={navId}
        aria-label="Navigation principale"
        className={cn('flex-1 overflow-y-auto scrollbar-thin', collapsed ? 'p-2' : 'p-3')}
      >
        {sections.map((section, index) => (
          <div key={section.title ?? 'principal'} className={cn(index > 0 && 'mt-5')}>
            {section.title !== null ? (
              /* Intitulé de groupe RÉEL et non un simple séparateur visuel :
                 `aria-labelledby` le rattache à la liste, si bien qu'un lecteur
                 d'écran annonce « Banque & Finance, liste, 4 éléments » au lieu
                 de dérouler onze liens sans structure.

                 Réduite, la barre le garde en `sr-only` et pose un filet à sa
                 place : la structure sonore reste entière, seul l'espace
                 disparaît. */
              <h2
                id={`nav-section-${String(index)}`}
                className={cn(
                  collapsed
                    ? 'sr-only'
                    : 'eyebrow px-3 pb-1.5 text-sidebar-muted-foreground',
                )}
              >
                {section.title}
              </h2>
            ) : null}
            {collapsed && section.title !== null ? (
              <div aria-hidden="true" className="mx-2 mb-2 h-px bg-sidebar-border" />
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
                      // Info-bulle native : réduite, l'icône seule ne dit pas
                      // où elle mène, et deviner coûte un clic à chaque essai.
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        // `relative` : porte le filet or de l'élément actif.
                        'relative flex min-h-11 items-center rounded-md py-2.5 text-[0.875rem] font-[600]',
                        collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                        'transition-colors duration-150',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring',
                        isActive
                          ? [
                              'bg-sidebar-accent text-sidebar-accent-foreground',
                              // Le marqueur or : un filet de 3 px à gauche, le
                              // même geste que `.rail` sur les titres d'écran.
                              // L'aplat seul se lisait mal, les deux teintes de
                              // sidebar étant proches ; le filet, lui, se voit.
                              'before:absolute before:inset-y-1.5 before:left-0 before:w-[3px]',
                              'before:rounded-full before:bg-accent before:content-[""]',
                            ]
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <Icon
                        className={cn('size-4 shrink-0', isActive && 'text-accent-on-dark')}
                        aria-hidden="true"
                      />
                      <span className={cn(collapsed ? 'sr-only' : 'truncate')}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {collapsed ? null : (
        <div className="border-t border-sidebar-border px-5 py-4">
          <p className="eyebrow text-sidebar-muted-foreground">CPI GO</p>
          {/* Token explicite, plus d'`opacity`. Une opacité posée sur une couleur
              déjà atténuée ne se mesure dans aucun tableau de tokens : c'est
              précisément le défaut qui a délavé le panel. 7,07:1 en clair. */}
          <p className="text-caption text-sidebar-muted-foreground">
            {role === 'BANQUE_FINANCE' ? 'Espace Banque & Finance' : 'Panneau d’administration'}
          </p>
        </div>
      )}
    </div>
  );
}
