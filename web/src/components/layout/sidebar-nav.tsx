'use client';

import { ChevronDownIcon, LayoutGridIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  COQUES,
  coqueOf,
  fallbackCoque,
  HUB_PATH,
  isNavItemActive,
  navSections,
  type NavItem,
  type Visiteur,
} from '@/components/layout/nav-items';
import { SIDEBAR_COOKIE_MAX_AGE, SIDEBAR_MORE_COOKIE } from '@/components/layout/sidebar-cookie';
import { cn } from '@/lib/utils';

function readMoreOpen(): boolean {
  try {
    return document.cookie.split('; ').includes(`${SIDEBAR_MORE_COOKIE}=1`);
  } catch {
    return false;
  }
}

function persistMoreOpen(open: boolean): void {
  try {
    document.cookie = `${SIDEBAR_MORE_COOKIE}=${open ? '1' : '0'};path=/;max-age=${String(SIDEBAR_COOKIE_MAX_AGE)};samesite=lax`;
  } catch {}
}

export function SidebarNav({
  visiteur,
  onNavigate = () => undefined,
  collapsed = false,
  navId,
}: {
  visiteur: Visiteur;
  onNavigate?: (() => void) | undefined;
  collapsed?: boolean | undefined;
  navId?: string | undefined;
}) {
  const pathname = usePathname();
  const coque = coqueOf(pathname) ?? fallbackCoque(visiteur);
  const sections = coque === null ? [] : navSections(visiteur, coque);
  const coqueLabel = COQUES.find((entry) => entry.id === coque)?.label ?? 'CPI GO';
  const hubHref = `${HUB_PATH}?retour=${encodeURIComponent(pathname)}`;

  // Un écran replié ne peut pas être l'écran courant SANS que son repli
  // s'ouvre : la surbrillance serait invisible.
  const repliActif = sections.some((section) =>
    section.items.some(
      (item) => item.secondary === true && isNavItemActive(visiteur, pathname, item),
    ),
  );

  // Fermé au premier rendu, serveur comme client : la préférence est relue
  // ensuite, comme le repli des filtres avancés.
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- préférence relue après hydratation
    setMoreOpen(repliActif || readMoreOpen());
  }, [repliActif]);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'px-5',
        )}
      >
        <Link
          href={hubHref}
          onClick={onNavigate}
          aria-label="Tous les espaces"
          className="flex h-full items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring"
        >
          {(() => {
            /*
              Réduite, la barre passe au logo CARRÉ. Le logo en bandeau mesuré
              pour 17 rem se retrouverait à moins de 40 px de large : le texte
              « Compagnie Prestige Immobilier » y devient une bavure grise, et une
              marque illisible vaut moins qu'une marque absente. Côté CHUES, la
              marque dessinée remplace le logo pour la même raison.
            */
            return (
              <Image
                src={collapsed ? '/brand/icon-512.webp' : '/brand/cpi-header.webp'}
                alt="CPI GO"
                width={collapsed ? 72 : 312}
                height={collapsed ? 72 : 128}
                priority
                className={cn('w-auto', collapsed ? 'size-9 rounded-sm' : 'h-8')}
              />
            );
          })()}
        </Link>
      </div>

      <nav
        id={navId}
        aria-label="Navigation principale"
        className={cn('flex-1 overflow-y-auto scrollbar-thin', collapsed ? 'p-2' : 'p-3')}
      >
        {sections.map((section, index) => {
          const primaires = section.items.filter((item) => item.secondary !== true);
          const replies = section.items.filter((item) => item.secondary === true);

          return (
            <div
              key={section.title ?? `principal-${String(index)}`}
              className={cn(index > 0 && 'mt-5')}
            >
              {section.title !== null ? (
                <h2
                  id={`nav-section-${String(index)}`}
                  className={cn(
                    collapsed ? 'sr-only' : 'eyebrow px-3 pb-1.5 text-sidebar-muted-foreground',
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
                {primaires.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    visiteur={visiteur}
                    pathname={pathname}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>

              <Replis
                items={replies}
                visiteur={visiteur}
                pathname={pathname}
                collapsed={collapsed}
                open={moreOpen}
                onOpenChange={(next) => {
                  setMoreOpen(next);
                  persistMoreOpen(next);
                }}
                onNavigate={onNavigate}
              />
            </div>
          );
        })}
      </nav>

      {/* Le retour au hub est un LIEN VISIBLE, pas seulement le logo : personne
          ne devine qu'un logo change de projet. */}
      <SidebarFooterLink
        collapsed={collapsed}
        hubHref={hubHref}
        onNavigate={onNavigate}
        coqueLabel={coqueLabel}
      />
    </div>
  );
}

function SidebarFooterLink({
  collapsed,
  hubHref,
  onNavigate,
  coqueLabel,
}: {
  collapsed: boolean;
  hubHref: string;
  onNavigate: () => void;
  coqueLabel: string;
}) {
  return (
    <div className={cn('border-t border-sidebar-border', collapsed ? 'p-2' : 'px-3 py-3')}>
      <Link
        href={hubHref}
        onClick={onNavigate}
        title={collapsed ? 'Tous les espaces' : undefined}
        className={cn(
          'flex min-h-11 items-center rounded-md text-[0.875rem] font-[600] text-sidebar-foreground',
          collapsed ? 'justify-center px-2' : 'gap-3 px-3',
          'transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring',
        )}
      >
        <LayoutGridIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className={cn(collapsed ? 'sr-only' : 'truncate')}>Tous les espaces</span>
      </Link>
      {collapsed ? null : (
        <p className="eyebrow px-3 pt-2 text-sidebar-muted-foreground">{coqueLabel}</p>
      )}
    </div>
  );
}

/** Le bloc « Plus » : ce qui sert quelques fois par semaine, sous un seul clic. */
function Replis({
  items,
  visiteur,
  pathname,
  collapsed,
  open,
  onOpenChange,
  onNavigate,
}: {
  items: readonly NavItem[];
  visiteur: Visiteur;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;

  const liste = (
    <ul className={cn('flex flex-col gap-1', !collapsed && 'mt-1')}>
      {items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          visiteur={visiteur}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );

  // Réduite, la barre n'a pas de place pour un intitulé de repli : un simple
  // filet sépare le quotidien de l'occasionnel.
  if (collapsed) {
    return (
      <>
        <div aria-hidden="true" className="mx-2 my-2 h-px bg-sidebar-border" />
        {liste}
      </>
    );
  }

  return (
    <details
      className="mt-1"
      open={open}
      onToggle={(event) => {
        onOpenChange(event.currentTarget.open);
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md px-3 text-[0.875rem] font-[600] text-sidebar-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring">
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 transition-transform duration-150',
            open ? 'rotate-0' : '-rotate-90',
          )}
        />
        Plus
      </summary>
      {liste}
    </details>
  );
}

function NavLink({
  item,
  visiteur,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  visiteur: Visiteur;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const isActive = isNavItemActive(visiteur, pathname, item);
  const Icon = item.icon;

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          'relative flex min-h-11 items-center rounded-md py-2.5 text-[0.875rem] font-[600]',
          collapsed ? 'justify-center px-2' : 'gap-3 px-3',
          'transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring',
          isActive
            ? [
                'bg-sidebar-accent text-sidebar-accent-foreground',
                'before:absolute before:inset-y-1.5 before:left-0 before:w-[3px]',
                // `accent-on-dark` et non `accent` : sur le noir de la coque
                // CHUES, le bleu d'action tombe à 1,6:1 et le repère disparaît.
                'before:rounded-full before:bg-accent-on-dark before:content-[""]',
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
}
