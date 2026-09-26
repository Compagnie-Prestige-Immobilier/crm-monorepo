'use client';

import { ChevronDownIcon, LayoutGridIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import {
  aPlusieursEspaces,
  COQUES,
  coqueHomePath,
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

function useMoreOpen(repliActif: boolean): [boolean, (open: boolean) => void] {
  const [moreOpen, setMoreOpen] = useState(() => repliActif || readMoreOpen());
  const [repliVu, setRepliVu] = useState(repliActif);
  if (repliVu !== repliActif) {
    setRepliVu(repliActif);
    setMoreOpen(repliActif || readMoreOpen());
  }
  return [moreOpen, setMoreOpen];
}

/** Un seul « Plus » par espace ; un intitulé de groupe ne sert que s'il y a au moins deux groupes. */
function barre(visiteur: Visiteur, pathname: string) {
  const coque = coqueOf(pathname) ?? fallbackCoque(visiteur);
  const sections = coque === null ? [] : navSections(visiteur, coque);
  const plusieursEspaces = aPlusieursEspaces(visiteur);
  const groupes = sections
    .map((section) => ({
      title: section.title,
      items: section.items.filter((item) => item.secondary !== true),
    }))
    .filter((groupe) => groupe.items.length > 0);
  const titres = groupes.length > 1;
  return {
    coqueLabel: COQUES.find((entry) => entry.id === coque)?.label ?? 'CPI GO',
    plusieursEspaces,
    hubHref: plusieursEspaces
      ? `${HUB_PATH}?retour=${encodeURIComponent(pathname)}`
      : coqueHomePath(visiteur, coque ?? 'accueil'),
    groupes: groupes.map((groupe) => ({ ...groupe, title: titres ? groupe.title : null })),
    replies: sections.flatMap((section) => section.items.filter((item) => item.secondary === true)),
  };
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
  const { coqueLabel, plusieursEspaces, hubHref, groupes, replies } = barre(visiteur, pathname);

  // Un écran replié ne peut pas être l'écran courant SANS que son repli
  // s'ouvre : la surbrillance serait invisible.
  const repliActif = replies.some((item) => isNavItemActive(visiteur, pathname, item));

  const [moreOpen, setMoreOpen] = useMoreOpen(repliActif);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Marque
        href={hubHref}
        label={plusieursEspaces ? 'CPI GO, tous les espaces' : 'CPI GO, accueil'}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />

      <nav
        id={navId}
        aria-label="Navigation principale"
        className={cn('flex-1 overflow-y-auto scrollbar-thin', collapsed ? 'p-2' : 'p-3')}
      >
        {groupes.map((groupe, index) => (
          <Groupe
            key={groupe.title ?? `principal-${String(index)}`}
            index={index}
            titre={groupe.title}
            items={groupe.items}
            visiteur={visiteur}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}

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
      </nav>

      {/* Le retour au hub est un LIEN VISIBLE, pas seulement le logo : personne
          ne devine qu'un logo change de projet. */}
      {plusieursEspaces ? (
        <SidebarFooterLink
          collapsed={collapsed}
          hubHref={hubHref}
          onNavigate={onNavigate}
          coqueLabel={coqueLabel}
        />
      ) : null}
    </div>
  );
}

function Marque({
  href,
  label,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <div
      className={cn(
        'flex h-16 shrink-0 items-center border-b border-sidebar-border',
        collapsed ? 'justify-center px-2' : 'px-5',
      )}
    >
      <Link
        href={href}
        onClick={onNavigate}
        aria-label={label}
        className="flex h-full items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring"
      >
        {/* Réduite, la barre passe au logo CARRÉ : le bandeau à moins de 40 px
            de large rendrait « Compagnie Prestige Immobilier » illisible. */}
        <Image
          src={collapsed ? '/brand/icon-512.webp' : '/brand/cpi-header.webp'}
          alt="CPI"
          width={collapsed ? 72 : 312}
          height={collapsed ? 72 : 128}
          priority
          className={cn('w-auto', collapsed ? 'size-9 rounded-sm' : 'h-8')}
        />
        {collapsed ? null : (
          <span className="cpi-go-mark ml-3" aria-label="GO">
            GO
          </span>
        )}
      </Link>
    </div>
  );
}

function Groupe({
  index,
  titre,
  items,
  visiteur,
  pathname,
  collapsed,
  onNavigate,
}: {
  index: number;
  titre: string | null;
  items: readonly NavItem[];
  visiteur: Visiteur;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const titreId = `nav-section-${String(index)}`;
  return (
    <div className={cn(index > 0 && 'mt-5')}>
      {titre === null ? null : (
        <>
          <h2
            id={titreId}
            className={cn(
              collapsed ? 'sr-only' : 'eyebrow px-3 pb-1.5 text-sidebar-muted-foreground',
            )}
          >
            {titre}
          </h2>
          {collapsed ? (
            <div aria-hidden="true" className="mx-2 mb-2 h-px bg-sidebar-border" />
          ) : null}
        </>
      )}
      <ul
        className="flex flex-col gap-1"
        {...(titre === null ? {} : { 'aria-labelledby': titreId })}
      >
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
