import type { components } from '@crm/api-client';

import type { Role } from '@/lib/types';

type Schemas = components['schemas'];

export type { Role };
export type NotificationRow = Schemas['Notification'];
export type NotificationCategory = NotificationRow['category'];
export type NotificationAudience = NotificationRow['audience'];
export type NotificationStatus = NotificationRow['status'];
export type NotificationDeliveryStatus = Schemas['NotificationDestinataire']['status'];

export type NotificationList = Schemas['ListerNotificationsOutputBody'];
export type NotificationDetail = Schemas['DetailNotificationOutputBody'];
export type AudiencePreview = Schemas['NotificationApercuOutputBody'];

export type CreateNotificationInput = Schemas['CreationNotification'];

/**
 * `CAMPAGNE` n'est plus proposé nulle part : plus rien n'en produit depuis le
 * retrait des campagnes. L'entrée reste parce que l'enum du contrat la garde et
 * que des envois archivés la portent encore.
 */
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
  SUPERVISEUR: 'Supervision',
  DIRECTION: 'Direction',
  ACCUEIL: 'Accueil',
  CHARGE_CLIENTELE: 'Chargé de clientèle',
};
