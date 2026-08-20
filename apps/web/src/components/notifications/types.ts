import type { components } from '@crm/api-client';

type Schemas = components['schemas'];

export type Role = Schemas['Role'];
export type NotificationCategory = Schemas['NotificationCategory'];
export type NotificationAudience = Schemas['NotificationAudience'];
export type NotificationStatus = Schemas['NotificationStatus'];
export type NotificationDeliveryStatus = Schemas['NotificationDeliveryStatus'];

export type NotificationCounts = Schemas['NotificationDeliveryCountsDto'];
export type NotificationRow = Schemas['NotificationDto'];
export type PageMeta = Schemas['PageMetaDto'];
export type NotificationList = Schemas['NotificationListDto'];
export type NotificationRecipient = Schemas['NotificationRecipientDto'];
export type NotificationDetail = Schemas['NotificationDetailDto'];
export type AudiencePreview = Schemas['AudiencePreviewDto'];
export type NotificationTemplate = Schemas['NotificationTemplateDto'];

export type CreateNotificationInput = Schemas['CreateNotificationDto'];
export type CreateTemplateInput = Schemas['CreateNotificationTemplateDto'];
export type UpdateTemplateInput = Schemas['UpdateNotificationTemplateDto'];

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
};
