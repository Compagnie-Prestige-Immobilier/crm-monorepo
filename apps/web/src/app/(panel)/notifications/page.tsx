import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { NotificationsView } from '@/components/notifications/notifications-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Notifications' };

/**
 * Composition et historique des notifications push.
 *
 * Le garde est posé ICI et pas seulement dans la navigation : `nav-items.ts`
 * décide de ce qui est PROPOSÉ, la page décide de ce qui est SERVI. Une entrée
 * de menu masquée n'empêche personne de taper l'URL.
 *
 * Pas de préchargement `prefetchQuery` comme sur les autres écrans : les routes
 * de notification ne figurent pas encore dans le client généré, donc la vue les
 * charge côté navigateur à travers le relais. À rétablir en même temps que le
 * client typé.
 */
export default async function NotificationsPage() {
  /**
   * Ouvert à TOUS les rôles authentifiés, et c'est la correction.
   *
   * L'écran était réservé à l'ADMIN parce qu'il ne servait qu'à COMPOSER. Il
   * porte désormais aussi la BOÎTE DE RÉCEPTION, c'est-à-dire l'écran complet
   * vers lequel la cloche de la barre supérieure prétendait renvoyer : sans
   * lui, la vingt-et-unième notification reçue était hors de portée, pour tous
   * les rôles.
   *
   * La composition, l'historique d'envoi et les gabarits restent à l'ADMIN :
   * `NotificationsView` ne les monte pas pour les autres, et l'API leur
   * répondrait 403 de toute façon.
   */
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE', 'COMMERCIAL']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les notifications" />;
  }

  return <NotificationsView isAdmin={guard.user.role === 'ADMIN'} />;
}
