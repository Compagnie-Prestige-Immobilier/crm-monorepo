import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { DemoBanner } from '@/components/layout/demo-banner';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Topbar } from '@/components/layout/topbar';
import { QueryErrorState } from '@/components/query-error-state';
import { getServerApiClient } from '@/lib/api/server';
import { fetchDemoStatus, seededAtOrNull } from '@/lib/data/demo';
import { readSession } from '@/lib/session';
import type { Role } from '@/lib/types';

/**
 * Coquille du panel et unique porte d'entrée authentifiée.
 *
 * Le contrôle est fait ICI, dans un composant serveur, et non dans un
 * middleware : la session est lue à la source (le cookie httpOnly) au moment du
 * rendu, donc aucune page enfant ne peut être rendue sans utilisateur valide.
 * Une garde côté client se contenterait de masquer une page déjà envoyée.
 */

/**
 * État du mode démonstration, pour le bandeau global.
 *
 * `GET /admin/demo` est réservé à l'ADMIN côté API : un agent BANQUE_FINANCE
 * recevrait un 403. On ne l'interroge donc que pour un ADMIN, et tout échec est
 * avalé — un bandeau est une information, jamais une raison de faire tomber
 * l'écran entier. LIMITE CONNUE, à porter côté API : tant que l'endpoint reste
 * fermé aux autres rôles, un agent Banque & Finance ne verra pas ce bandeau.
 */
async function demoSeededAt(role: Role): Promise<string | null> {
  if (role !== 'ADMIN') return null;
  try {
    const status = await fetchDemoStatus(getServerApiClient());
    return status.enabled ? (seededAtOrNull(status) ?? '') : null;
  } catch {
    return null;
  }
}

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await readSession();

  // Seul un REFUS de l'API déconnecte. Une indisponibilité (429 du limiteur de
  // débit, 5xx, backend redémarré) laissait auparavant croire à une session
  // absente et renvoyait vers /connexion malgré deux cookies valides — puis la
  // reconnexion consommait le quota de connexion et le cycle recommençait.
  if (session.status === 'anonymous') redirect('/connexion');

  if (session.status === 'unavailable') {
    return (
      <main id="contenu-principal" className="grid min-h-dvh place-items-center p-6">
        <QueryErrorState
          error={session.error}
          fallback="Le panel n’a pas pu vérifier votre session. Votre connexion est toujours valide : réessayez dans un instant."
        />
      </main>
    );
  }

  const user = session.user;
  const seededAt = await demoSeededAt(user.role);

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar fixe à partir de 768 px ; en dessous elle devient un Sheet
          déclenché depuis la Topbar. */}
      <aside className="hidden w-[17rem] shrink-0 md:block">
        <div className="fixed inset-y-0 left-0 w-[17rem]">
          <SidebarNav role={user.role} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {seededAt !== null ? (
          <DemoBanner seededAt={seededAt === '' ? null : seededAt} role={user.role} />
        ) : null}
        <Topbar user={user} />
        <main id="contenu-principal" className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
