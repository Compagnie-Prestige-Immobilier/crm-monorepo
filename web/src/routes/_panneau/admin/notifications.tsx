import { createFileRoute, redirect } from '@tanstack/react-router';

import { NotificationsAdminView } from '@/components/notifications/notifications-admin-view';
import { guardRoles } from '@/lib/guard';
import {
  ONGLETS_NOTIFICATIONS,
  type NotificationCategory,
  type NotificationStatus,
  type OngletNotifications,
} from '@/lib/data/notifications';
import { ADMIN_SEUL, INBOX_ROLES } from '@/lib/roles';

export interface RechercheNotifications {
  onglet?: OngletNotifications;
  statut?: NotificationStatus;
  categorie?: NotificationCategory;
  page?: number;
}

const STATUTS = new Set(['SCHEDULED', 'SENDING', 'SENT', 'CANCELLED']);
const CATEGORIES = new Set(['ANNONCE', 'RAPPEL', 'CAMPAGNE', 'DOSSIER', 'SYSTEME']);

function estOnglet(valeur: unknown): valeur is OngletNotifications {
  return (
    typeof valeur === 'string' && (ONGLETS_NOTIFICATIONS as readonly string[]).includes(valeur)
  );
}

const gardeAdmin = guardRoles(ADMIN_SEUL);

export const Route = createFileRoute('/_panneau/admin/notifications')({
  validateSearch: (search: Record<string, unknown>): RechercheNotifications => {
    const page = Number(search.page);
    return {
      ...(estOnglet(search.onglet) ? { onglet: search.onglet } : {}),
      ...(typeof search.statut === 'string' && STATUTS.has(search.statut)
        ? { statut: search.statut as NotificationStatus }
        : {}),
      ...(typeof search.categorie === 'string' && CATEGORIES.has(search.categorie)
        ? { categorie: search.categorie as NotificationCategory }
        : {}),
      ...(Number.isInteger(page) && page > 1 ? { page } : {}),
    };
  },
  // Des notifications déjà envoyées pointent ici : un rôle à boîte retrouve la sienne.
  beforeLoad: (options) => {
    const { role } = options.context.user;
    if (role !== 'ADMIN' && INBOX_ROLES.includes(role)) throw redirect({ to: '/notifications' });
    return gardeAdmin(options);
  },
  component: NotificationsAdminPage,
});

function NotificationsAdminPage() {
  const recherche = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <NotificationsAdminView
      recherche={recherche}
      onRecherche={(suivante) => {
        void navigate({ search: suivante, replace: true });
      }}
    />
  );
}
