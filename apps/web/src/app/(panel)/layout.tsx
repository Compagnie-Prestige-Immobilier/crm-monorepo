import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import type { ReactNode } from 'react';

import { DemoBannerLive } from '@/components/layout/demo-banner-live';
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie';
import { SidebarShell } from '@/components/layout/sidebar-shell';
import { Topbar } from '@/components/layout/topbar';
import { QueryErrorState } from '@/components/query-error-state';
import { getServerApiClient } from '@/lib/api/server';
import {
  demoBannerState,
  fetchDemoStatus,
  NO_DEMO_BANNER,
  type DemoBannerState,
} from '@/lib/data/demo';
import { readSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function demoBanner(): Promise<DemoBannerState> {
  try {
    return demoBannerState(await fetchDemoStatus(getServerApiClient()));
  } catch (error) {
    unstable_rethrow(error);
    return NO_DEMO_BANNER;
  }
}

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
  const demo = await demoBanner();
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === '1';

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar fixe à partir de 768 px ; en dessous elle devient un Sheet
          déclenché depuis la Topbar. Son état de repli est lu ICI, côté
          serveur : le premier octet de HTML porte déjà la bonne largeur, et la
          barre ne saute pas d'une largeur à l'autre à l'hydratation. */}
      <SidebarShell role={user.role} defaultCollapsed={sidebarCollapsed} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* L'état lu ci-dessus est le PREMIER rendu, jamais le dernier mot : le
            composant le resonde lentement pour que la bascule d'un
            administrateur atteigne les écrans déjà ouverts, dans les deux sens.
            Il est monté même quand le mode est éteint, sans quoi il n'y aurait
            personne pour voir l'allumage. Voir `demo-banner-live.tsx`. */}
        <DemoBannerLive initial={demo} role={user.role} />
        <Topbar user={user} />
        <main id="contenu-principal" className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
