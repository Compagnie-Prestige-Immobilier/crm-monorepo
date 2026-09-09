import { Link, useLocation } from '@tanstack/react-router';
import { ChevronDownIcon, LayoutGridIcon } from 'lucide-react';
import { useState } from 'react';

import { UesMark } from '@/components/coque/ues-mark';
import {
  COQUES,
  coqueOf,
  fallbackCoque,
  HUB_PATH,
  isNavItemActive,
  lien,
  navItems,
  type NavItem,
} from '@/lib/nav';
import { replisOuverts, setReplisOuverts } from '@/lib/sidebar';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

export function SidebarNav({
  role,
  onNavigate = () => undefined,
  collapsed = false,
  navId,
}: {
  role: Role;
  onNavigate?: (() => void) | undefined;
  collapsed?: boolean | undefined;
  navId?: string | undefined;
}) {
  const { pathname } = useLocation();
  const coque = coqueOf(pathname) ?? fallbackCoque(role);
  const items = coque === null ? [] : navItems(role, coque);
  const coqueLabel = COQUES.find((entry) => entry.id === coque)?.label ?? 'CPI GO';
  const hubHref = `${HUB_PATH}?retour=${encodeURIComponent(pathname)}`;

  // Un écran replié ne peut pas être l'écran courant sans que son repli s'ouvre :
  // la surbrillance serait invisible.
  const repliActif = items.some(
    (item) => item.secondary === true && isNavItemActive(role, pathname, item),
  );
  const [ouvert, setOuvert] = useState(() => replisOuverts());

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'px-5',
        )}
      >
        <Link
          {...lien(hubHref)}
          onClick={onNavigate}
          aria-label="Tous les espaces"
          className="flex h-full items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring"
        >
          <Marque coque={coque} collapsed={collapsed} />
        </Link>
      </div>

      <nav
        id={navId}
        aria-label="Navigation principale"
        className={cn('flex-1 overflow-y-auto scrollbar-thin', collapsed ? 'p-2' : 'p-3')}
      >
        <ul className="flex flex-col gap-1">
          {items
            .filter((item) => item.secondary !== true)
            .map((item) => (
              <NavLink
                key={item.href}
                item={item}
                role={role}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
        </ul>

        <Replis
          items={items.filter((item) => item.secondary === true)}
          role={role}
          pathname={pathname}
          collapsed={collapsed}
          open={ouvert || repliActif}
          onOpenChange={(next) => {
            setOuvert(next);
            setReplisOuverts(next);
          }}
          onNavigate={onNavigate}
        />
      </nav>

      <PiedDeBarre
        collapsed={collapsed}
        hubHref={hubHref}
        onNavigate={onNavigate}
        coqueLabel={coqueLabel}
      />
    </div>
  );
}

/** Le retour au hub est un lien visible : personne ne devine qu'un logo change de projet. */
function PiedDeBarre({
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
        {...lien(hubHref)}
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

/**
 * Réduite, la barre passe au logo carré : le bandeau mesuré pour 17 rem devient
 * une bavure grise sous 40 px. Le logo CHUES est encré sur blanc.
 */
function Marque({ coque, collapsed }: { coque: string | null; collapsed: boolean }) {
  if (coque === 'chues') {
    if (collapsed) return <UesMark compact />;
    return (
      <span className="flex items-center rounded-md bg-white px-3 py-1.5">
        <img src="/brand/chues-logo.png" alt="Projet CHUES" className="h-7 w-auto" />
      </span>
    );
  }
  return (
    <img
      src={collapsed ? '/brand/icon-512.png' : '/brand/cpi-header.png'}
      alt="CPI GO"
      className={cn('w-auto', collapsed ? 'size-9 rounded-sm' : 'h-8')}
    />
  );
}

/** Le bloc « Plus » : ce qui sert quelques fois par semaine, sous un seul clic. */
function Replis({
  items,
  role,
  pathname,
  collapsed,
  open,
  onOpenChange,
  onNavigate,
}: {
  items: readonly NavItem[];
  role: Role;
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
          role={role}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );

  // Réduite, la barre n'a pas de place pour un intitulé de repli.
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
  role,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  role: Role;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const isActive = isNavItemActive(role, pathname, item);
  const Icon = item.icon;

  return (
    <li>
      <Link
        {...lien(item.href)}
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
                // Sur le noir de la coque CHUES, le bleu d'action tombe à 1,6:1.
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
