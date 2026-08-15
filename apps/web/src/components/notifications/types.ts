/**
 * Types du contrat de notification, ÉCRITS À LA MAIN : et c'est une exception
 * assumée à la règle du dépôt.
 *
 * Partout ailleurs, `apps/web` lit ses types dans
 * `packages/api-client/src/generated`, régénérés depuis `openapi.json`. C'est
 * ce qui fait casser le `typecheck` du panel à l'endroit exact où un écran ment
 * sur le contrat.
 *
 * Ici, le module API vient d'être écrit et la régénération du client appartient
 * à une autre étape. Ces types en sont la transcription fidèle ; ils vivent
 * volontairement DANS le dossier de la fonctionnalité, et non dans
 * `src/lib/types.ts`, pour qu'ils soient faciles à supprimer d'un bloc le jour
 * où `pnpm codegen` les rend inutiles.
 *
 * TODO(generated-client) : remplacer par `Schemas['NotificationDto']` etc. une
 * fois `packages/api-client` régénéré.
 */

export type Role = 'ADMIN' | 'COMMERCIAL' | 'BANQUE_FINANCE';

export type NotificationCategory = 'ANNONCE' | 'RAPPEL' | 'CAMPAGNE' | 'DOSSIER' | 'SYSTEME';

export type NotificationAudience = 'ALL' | 'ROLE' | 'DEPARTEMENT' | 'USERS';

export type NotificationStatus = 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED';

export type NotificationDeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';

export interface NotificationCounts {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  failed: number;
  read: number;
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  route: string | null;
  audience: NotificationAudience;
  audienceRole: Role | null;
  audienceDepartementId: string | null;
  audienceUserIds: string[];
  status: NotificationStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  cancelledAt: string | null;
  transportStatus: string | null;
  createdByName: string | null;
  createdAt: string;
  counts: NotificationCounts;
}

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface NotificationList {
  items: NotificationRow[];
  meta: PageMeta;
}

export interface NotificationRecipient {
  userId: string;
  fullName: string;
  role: Role;
  status: NotificationDeliveryStatus;
  error: string | null;
  sentAt: string | null;
  readAt: string | null;
}

export interface NotificationDetail {
  notification: NotificationRow;
  recipients: NotificationRecipient[];
}

export interface AudiencePreview {
  recipientCount: number;
  reachableCount: number;
  transportConfigured: boolean;
  transportReason: string | null;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  category: NotificationCategory;
  titleTemplate: string;
  bodyTemplate: string;
  route: string | null;
  variables: string[];
  isActive: boolean;
  updatedAt: string;
}

export interface CreateNotificationInput {
  title: string;
  body: string;
  category?: NotificationCategory;
  route?: string;
  audience: NotificationAudience;
  audienceRole?: Role;
  audienceDepartementId?: string;
  audienceUserIds?: string[];
  scheduledFor?: string;
  templateId?: string;
}

export interface CreateTemplateInput {
  name: string;
  category?: NotificationCategory;
  titleTemplate: string;
  bodyTemplate: string;
  route?: string;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput> & { isActive?: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// Libellés : français, une seule source
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  ANNONCE: 'Annonce',
  RAPPEL: 'Rappel',
  CAMPAGNE: 'Campagne',
  DOSSIER: 'Dossier',
  SYSTEME: 'Système',
};

export const AUDIENCE_LABELS: Record<NotificationAudience, string> = {
  ALL: 'Tout le monde',
  ROLE: 'Par rôle',
  DEPARTEMENT: 'Par département',
  USERS: 'Comptes choisis',
};

export const STATUS_LABELS: Record<NotificationStatus, string> = {
  SCHEDULED: 'Programmée',
  SENDING: 'En cours',
  SENT: 'Envoyée',
  CANCELLED: 'Annulée',
};

export const DELIVERY_LABELS: Record<NotificationDeliveryStatus, string> = {
  PENDING: 'En attente',
  SENT: 'Remise',
  DELIVERED: 'Reçue',
  FAILED: 'Échec',
  READ: 'Lue',
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  COMMERCIAL: 'Téléconseiller',
  BANQUE_FINANCE: 'Banque & Finance',
};
