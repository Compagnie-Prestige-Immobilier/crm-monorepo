import { useLocation } from '@tanstack/react-router';
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react';
import { useState } from 'react';

import { SidebarNav } from '@/components/coque/sidebar-nav';
import { coqueOf } from '@/lib/nav';
import { barreRepliee, setBarreRepliee } from '@/lib/sidebar';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

export function SidebarShell({ role }: { role: Role }) {
  const { pathname } = useLocation();
  // Lu avant le premier rendu : la barre ne saute pas d'une largeur à l'autre.
  const [collapsed, setCollapsed] = useState(() => barreRepliee());

  if (coqueOf(pathname) === 'accueil') return null;

  const width = collapsed ? 'w-[4.5rem]' : 'w-[17rem]';

  return (
    <aside className={cn('hidden shrink-0 transition-[width] duration-200 md:block', width)}>
      <div className={cn('fixed inset-y-0 left-0 transition-[width] duration-200', width)}>
        <SidebarNav role={role} collapsed={collapsed} navId="navigation-laterale" />

        {/* Posé à cheval sur le bord droit : c'est là qu'on va le chercher, et il
            ne prend aucune place dans la colonne réduite. */}
        <button
          type="button"
          onClick={() => {
            setCollapsed((courant) => {
              setBarreRepliee(!courant);
              return !courant;
            });
          }}
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
