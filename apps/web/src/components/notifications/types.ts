import type { components } from '@crm/api-client';

/**
 * Types du contrat de notification, LUS DANS LE CLIENT ENGENDRÉ.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Ils étaient écrits à la main. Ce n'était plus une exception, c'était un écart.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'exception avait une justification datée : « le module API vient d'être écrit,
 * la régénération appartient à une autre étape ». Les neuf routes figurent
 * désormais dans `packages/api-client/src/generated`. Une transcription à la
 * main d'un contrat déjà typé ne vaut alors plus rien : elle ne fait pas casser
 * le `typecheck` quand l'API change, elle le fait PASSER, ce qui est exactement
 * l'inverse de l'effet recherché.
 *
 * Le cas s'est produit pendant cette même réécriture : `AudiencePreview`
 * déclarait `reachableCount`, `transportConfigured` et `transportReason`, que
 * l'API ne rend plus. Le composeur affichait donc un avertissement « transport
 * non configuré » calculé sur trois `undefined`.
 *
 * Seuls les LIBELLÉS restent ici : ils sont du français d'interface, pas du
 * contrat, et l'API n'a pas à les décider.
 */
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
