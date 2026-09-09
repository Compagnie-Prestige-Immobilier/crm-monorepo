import { createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';

import { meQueryOptions } from '@/api/auth';
import { Flux } from '@/components/coque/flux';
import { SidebarShell } from '@/components/coque/sidebar-shell';
import { Topbar } from '@/components/coque/topbar';
import { EcranErreurPleinePage } from '@/components/etats-router';
import { coqueOf, navTitle } from '@/lib/nav';

export const Route = createFileRoute('/_panneau')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (user === null) throw redirect({ to: '/connexion', search: { next: location.href } });
    return { user };
  },
  component: Panneau,
  errorComponent: EcranErreurPleinePage,
});

function Panneau() {
  const { user } = Route.useRouteContext();
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = `${navTitle(user.role, pathname)} · CPI GO`;
  }, [user.role, pathname]);

  return (
    // `globals.css` accroche la palette du projet à cet attribut : sortir de
    // `/chues/*` le démonte avec la route, sans remise à zéro.
    <div data-coque={coqueOf(pathname) ?? undefined} className="flex min-h-dvh">
      <Flux />
      <SidebarShell role={user.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main id="contenu-principal" className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
