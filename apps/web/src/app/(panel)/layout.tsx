import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import type { ReactNode } from 'react';

import { DemoBanner } from '@/components/layout/demo-banner';
import { SIDEBAR_COOKIE } from '@/components/layout/sidebar-cookie';
import { SidebarShell } from '@/components/layout/sidebar-shell';
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
 * JAMAIS de prérendu, JAMAIS de cache partagé — pour tout le panel.
 *
 * Défaut observé en production, et le plus grave rencontré sur ce projet :
 * `next build` prérendait ces pages, et Next les servait ensuite depuis le
 * cache pleine-route avec `s-maxage=31536000`, la même réponse pour tout le
 * monde, cookie ou pas.
 *
 * Deux conséquences, de gravité croissante :
 *
 *  1. Au build, l'API n'existe pas. `readSession()` échouait, la branche
 *     « Serveur injoignable » était rendue — et FIGÉE pour un an. L'écran
 *     n'était donc pas une panne passagère : c'était du HTML mort en cache.
 *  2. Si le build AVAIT joint l'API, la page prérendue aurait contenu les
 *     données d'une session, et cette page-là aurait été servie à un visiteur
 *     anonyme. Une coquille authentifiée n'est pas un contenu statique.
 *
 * `force-dynamic` répond aux deux : chaque requête est rendue avec ses propres
 * cookies, et rien n'est mis en cache. Le coût est nul ici — aucune page du
 * panel n'a de sens sans session.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  } catch (error) {
    // `unstable_rethrow` D'ABORD : Next signale la redirection, le `notFound()`
    // et la bascule en rendu dynamique en LEVANT une erreur de contrôle. Un
    // `catch` nu les avale et transforme un signal du framework en « pas de
    // bandeau » — ou, comme ici en production, en page prérendue à tort.
    unstable_rethrow(error);
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
          fallback="Session non vérifiée. Réessayez dans un instant."
        />
      </main>
    );
  }

  const user = session.user;
  const seededAt = await demoSeededAt(user.role);
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === '1';

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar fixe à partir de 768 px ; en dessous elle devient un Sheet
          déclenché depuis la Topbar. Son état de repli est lu ICI, côté
          serveur : le premier octet de HTML porte déjà la bonne largeur, et la
          barre ne saute pas d'une largeur à l'autre à l'hydratation. */}
      <SidebarShell role={user.role} defaultCollapsed={sidebarCollapsed} />

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
