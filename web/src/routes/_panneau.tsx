import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useRouterState,
} from '@tanstack/react-router';
import { useEffect } from 'react';

import { meQueryOptions } from '@/api/auth';
import { EcranErreurPleinePage } from '@/components/etats-router';
import { CoqueShell } from '@/components/layout/coque-shell';
import { DemoBanner } from '@/components/layout/demo-banner';
import { COQUES, coqueOf, navTitle, retenirEcran } from '@/components/layout/nav-items';
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie';
import { SidebarShell } from '@/components/layout/sidebar-shell';
import { Topbar } from '@/components/layout/topbar';
import { LiveStream } from '@/components/live/live-stream';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_panneau')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (user === null) throw redirect({ to: '/connexion', search: { suite: location.href } });
    return { user };
  },
  component: Panneau,
  errorComponent: EcranErreurPleinePage,
});

function sidebarRepliee(): boolean {
  try {
    return document.cookie.split('; ').includes(`${SIDEBAR_COOKIE}=1`);
  } catch {
    return false;
  }
}

/** Le layout `(panel)` de la v1 : coque, barre latérale, barre supérieure, contenu. */
function Panneau() {
  const { user } = Route.useRouteContext();
  const { pathname, searchStr } = useLocation();
  const enChargement = useRouterState({ select: (state) => state.status === 'pending' });

  useEffect(() => {
    const titre = navTitle(user.role, pathname);
    const coque = COQUES.find((entry) => entry.id === coqueOf(pathname));
    document.title = [titre === 'CPI GO' ? null : titre, coque?.label ?? null, 'CPI GO']
      .filter((partie) => partie !== null)
      .join(' · ');
  }, [user.role, pathname]);

  useEffect(() => {
    retenirEcran(user.id, pathname, searchStr);
  }, [user.id, pathname, searchStr]);

  return (
    <CoqueShell>
      <a
        href="#contenu-principal"
        // Sans cela l'ancre change l'URL, et le routeur la traite comme une navigation.
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('contenu-principal')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2.5 focus:text-[0.875rem] focus:font-[600] focus:shadow-elev-sm focus:outline-2 focus:outline-ring"
      >
        Aller au contenu
      </a>
      {/* Le délai évite un éclair quand la route sort du cache. */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-primary opacity-0 transition-opacity',
          enChargement && 'opacity-100 delay-150 motion-safe:animate-pulse',
        )}
      />
      <LiveStream />
      <SidebarShell role={user.role} defaultCollapsed={sidebarRepliee()} />

      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner user={user} />
        <Topbar user={user} demoEnabled={false} />
        <main id="contenu-principal" tabIndex={-1} className="flex-1 p-4 outline-none md:p-6">
          <Outlet />
        </main>
      </div>
    </CoqueShell>
  );
}
