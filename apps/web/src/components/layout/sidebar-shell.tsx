'use client';

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { SidebarNav } from '@/components/layout/sidebar-nav';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * La barre latérale fixe, et son repli.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * La préférence voyage en COOKIE, pas en `localStorage`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * C'est ce qui évite le défaut le plus visible de ce genre de repli : la barre
 * s'affiche déployée, puis saute à sa version réduite une fois le JavaScript
 * exécuté. À chaque chargement, sur chaque page. Un cookie, lui, est lu par le
 * layout SERVEUR : le premier octet de HTML porte déjà la bonne largeur, et
 * rien ne bouge.
 *
 * Ce n'est pas un secret, seulement une largeur : `httpOnly` serait absurde ici
 * puisque c'est le navigateur qui l'écrit, et `SameSite=Lax` suffit.
 *
 * La barre RÉDUITE garde ses onze cibles au-dessus de 44 px et ses libellés
 * dans l'arbre d'accessibilité (voir `SidebarNav`) : on gagne de la largeur,
 * on ne perd aucune fonction.
 */

export const SIDEBAR_COOKIE = 'cpi_sidebar';

/** Un an : c'est une préférence d'atelier, pas une session. */
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function persist(collapsed: boolean): void {
  try {
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? '1' : '0'};path=/;max-age=${String(COOKIE_MAX_AGE)};samesite=lax`;
  } catch {
    // Préférence perdue, écran intact : rien à signaler à l'utilisateur.
  }
}

export function SidebarShell({
  role,
  defaultCollapsed,
}: {
  role: Role;
  /** Lu dans le cookie par le layout serveur : aucun saut de mise en page. */
  defaultCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      persist(!current);
      return !current;
    });
  }, []);

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
          // Le libellé nomme l'ACTION à venir, pas l'état courant : « Réduire »
          // sur une barre déployée. Nommer l'état ferait cliquer à l'envers.
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
