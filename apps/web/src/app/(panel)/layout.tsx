import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { CoqueShell } from '@/components/layout/coque-shell';
import { DemoBanner } from '@/components/layout/demo-banner';
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie';
import { SidebarShell } from '@/components/layout/sidebar-shell';
import { Topbar } from '@/components/layout/topbar';
import { LiveStream } from '@/components/live/live-stream';
import { QueryErrorState } from '@/components/query-error-state';
import { demoWorkspaceEnabled } from '@/lib/demo-workspace';
import { readSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await readSession();

  if (session.status === 'anonymous') redirect('/connexion');

  if (session.status === 'unavailable') {
    return (
      <main id="contenu-principal" className="grid min-h-dvh place-items-center p-6">
        <QueryErrorState
          error={session.error}
          fallback="Session non vérifiée. Réessayez dans un instant."
        />
      </main>
    );
  }

  const user = session.user;
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === '1';

  return (
    <CoqueShell>
      <LiveStream />
      {/* Sidebar fixe à partir de 768 px ; en dessous elle devient un Sheet
          déclenché depuis la Topbar. Son état de repli est lu ICI, côté
          serveur : le premier octet de HTML porte déjà la bonne largeur, et la
          barre ne saute pas d'une largeur à l'autre à l'hydratation. */}
      <SidebarShell role={user.role} defaultCollapsed={sidebarCollapsed} />

      <div className="flex min-w-0 flex-1 flex-col">
        {user.workspace === 'demo' ? <DemoBanner /> : null}
        <Topbar user={user} demoEnabled={demoWorkspaceEnabled()} />
        <main id="contenu-principal" className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </CoqueShell>
  );
}
