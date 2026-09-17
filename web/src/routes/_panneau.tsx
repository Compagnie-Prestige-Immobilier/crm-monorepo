import { createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';

import { meQueryOptions } from '@/api/auth';
import { EcranErreurPleinePage } from '@/components/etats-router';
import { CoqueShell } from '@/components/layout/coque-shell';
import { DemoBanner } from '@/components/layout/demo-banner';
import { navTitle } from '@/components/layout/nav-items';
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie';
import { SidebarShell } from '@/components/layout/sidebar-shell';
import { Topbar } from '@/components/layout/topbar';
import { LiveStream } from '@/components/live/live-stream';
import { RappelPopUpIntrusif } from '@/components/rappels/rappel-pop-up-intrusif';

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
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = `${navTitle(user, pathname)} · CPI GO`;
  }, [user, pathname]);

  return (
    <CoqueShell>
      <LiveStream />
      <RappelPopUpIntrusif userId={user.id} />
      <SidebarShell visiteur={user} defaultCollapsed={sidebarRepliee()} />

      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner user={user} />
        <Topbar user={user} demoEnabled={false} />
        <main id="contenu-principal" className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </CoqueShell>
  );
}
