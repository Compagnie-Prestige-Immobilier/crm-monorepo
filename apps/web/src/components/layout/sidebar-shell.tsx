'use client';

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';

import { coqueOf } from '@/components/layout/nav-items';
import { SIDEBAR_COOKIE, SIDEBAR_COOKIE_MAX_AGE } from '@/components/layout/sidebar-cookie';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

function persist(collapsed: boolean): void {
  try {
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? '1' : '0'};path=/;max-age=${String(SIDEBAR_COOKIE_MAX_AGE)};samesite=lax`;
  } catch {}
}

export function SidebarShell({
  role,
  defaultCollapsed,
}: {
  role: Role;
  defaultCollapsed: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      persist(!current);
      return !current;
    });
  }, []);

  if (coqueOf(pathname) === 'accueil') return null;

  const width = collapsed ? 'w-[4.5rem]' : 'w-[17rem]';

  return (
    <aside className={cn('hidden shrink-0 transition-[width] duration-200 md:block', width)}>
      <div className={cn('fixed inset-y-0 left-0 transition-[width] duration-200', width)}>
        <SidebarNav role={role} collapsed={collapsed} navId="navigation-laterale" />

        {/*
          Le bouton est posé SUR le bord droit de la barre, à cheval sur la
          limite : c'est là qu'on va le chercher, et il ne prend aucune place
          dans la colonne réduite. `-translate-y-1/2` le cale à mi-hauteur,
          hors de portée des liens de navigation comme du pied de barre.
        */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls="navigation-laterale"
          aria-label={collapsed ? 'Déployer la navigation' : 'Réduire la navigation'}
          title={collapsed ? 'Déployer la navigation' : 'Réduire la navigation'}
          className="absolute top-1/2 -right-3 z-40 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-elev-sm transition-colors duration-(--dur-1) ease-(--ease-out-cpi) hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-3.5" aria-hidden="true" />
          ) : (
            <PanelLeftCloseIcon className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </aside>
  );
}
