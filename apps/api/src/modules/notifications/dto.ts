import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  DevicePlatform,
  NotificationAudience,
  NotificationCategory,
  NotificationDeliveryStatus,
  NotificationStatus,
  Role,
} from '@crm/database';

import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';

/**
 * Un lien profond est une ROUTE INTERNE. `^/` et pas d'URL absolue.
 *
 * Le mobile passe cette chaîne telle quelle à `go_router`. Autoriser
 * `https://…` transformerait chaque notification en vecteur d'hameçonnage
 * portant le logo de l'application — et l'utilisateur n'a aucun moyen de
 * vérifier la destination avant d'appuyer.
 */
export const ROUTE_PATTERN = /^\/[A-Za-z0-9\-._~/%?&=+:@!$'(),;[\]*]*$/;

export class NotificationDeliveryCountsDto {
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number, description: 'En file : aucun push tenté (ou aucun appareil).' })
  pending!: number;
  @ApiProperty({ type: Number, description: 'Accepté par FCM. N’implique pas « affiché ».' })
  sent!: number;
  @ApiProperty({ type: Number }) delivered!: number;
  @ApiProperty({ type: Number }) failed!: number;
  @ApiProperty({ type: Number }) read!: number;
}

export class NotificationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  category!: NotificationCategory;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Route interne ouverte au tap, ex. `/phase2`. Jamais une URL absolue.',
  })
  route!: string | null;

  @ApiProperty({ enum: NotificationAudience, enumName: 'NotificationAudience' })
  audience!: NotificationAudience;
  @ApiProperty({ enum: Role, enumName: 'Role', nullable: true })
  audienceRole!: Role | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  audienceDepartementId!: string | null;
  @ApiProperty({ type: [String] }) audienceUserIds!: string[];

  @ApiProperty({ enum: NotificationStatus, enumName: 'NotificationStatus' })
  status!: NotificationStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  scheduledFor!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) sentAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) cancelledAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'NOT_CONFIGURED quand aucun compte de service FCM n’est fourni : les lignes de livraison existent, la remise n’a pas eu lieu. TRANSPORT_ERROR quand Google a refusé l’authentification.',
  })
  transportStatus!: string | null;

  @ApiProperty({ type: String, nullable: true }) createdByName!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: () => NotificationDeliveryCountsDto })
  counts!: NotificationDeliveryCountsDto;
}

export class NotificationListDto {
  @ApiProperty({ type: () => [NotificationDto] }) items!: NotificationDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class NotificationRecipientDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: Role, enumName: 'Role' }) role!: Role;
  @ApiProperty({ enum: NotificationDeliveryStatus, enumName: 'NotificationDeliveryStatus' })
  status!: NotificationDeliveryStatus;
  @ApiProperty({ type: String, nullable: true }) error!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) sentAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) readAt!: string | null;
}

export class NotificationDetailDto {
  @ApiProperty({ type: () => NotificationDto }) notification!: NotificationDto;
  @ApiProperty({
    type: () => [NotificationRecipientDto],
    description: 'Une ligne par destinataire — c’est ce qui rend « qui a reçu ? » répondable.',
  })
  recipients!: NotificationRecipientDto[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Boîte de réception
// ─────────────────────────────────────────────────────────────────────────────

export class InboxItemDto {
  @ApiProperty({ format: 'uuid', description: 'Identifiant de la LIVRAISON, pas de l’envoi.' })
  id!: string;
  @ApiProperty({ format: 'uuid' }) notificationId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  category!: NotificationCategory;
  @ApiProperty({ type: String, nullable: true }) route!: string | null;
  @ApiProperty({ type: Boolean }) isRead!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) readAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class InboxDto {
  @ApiProperty({ type: () => [InboxItemDto] }) items!: InboxItemDto[];
  @ApiProperty({ type: Number }) unreadCount!: number;
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

// ─────────────────────────────────────────────────────────────────────────────
// Écritures
// ─────────────────────────────────────────────────────────────────────────────

export class CreateNotificationDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 500,
    description:
      'Android tronque au-delà de quatre lignes environ ; 500 est un plafond de stockage, pas une cible de rédaction.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body!: string;

  @ApiPropertyOptional({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @ApiPropertyOptional({
    maxLength: 300,
    description: 'Route interne, ex. `/phase2`. Une URL absolue est refusée.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(ROUTE_PATTERN, { message: 'route doit être une route interne commençant par /' })
  route?: string;

  @ApiPropertyOptional({ type: Object, description: 'Données libres transmises au client.' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiProperty({ enum: NotificationAudience, enumName: 'NotificationAudience' })
  @IsEnum(NotificationAudience)
  audience!: NotificationAudience;

  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  audienceRole?: Role;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  audienceDepartementId?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 1000 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID(undefined, { each: true })
  audienceUserIds?: string[];

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Absent ou passé : envoi immédiat refusé si passé, envoi immédiat si absent.',
  })
  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Gabarit d’origine, pour la traçabilité.' })
  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class NotificationQueryDto {
  @ApiPropertyOptional({ enum: NotificationStatus, enumName: 'NotificationStatus' })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class InboxQueryDto {
  @ApiPropertyOptional({ description: 'Ne rendre que les non lues.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** Public à évaluer AVANT envoi. Mêmes champs que la composition, sans le texte. */
export class AudiencePreviewQueryDto {
  @ApiProperty({ enum: NotificationAudience, enumName: 'NotificationAudience' })
  @IsEnum(NotificationAudience)
  audience!: NotificationAudience;

  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  audienceRole?: Role;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  audienceDepartementId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Identifiants séparés par des virgules (contrainte de la chaîne de requête).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40_000)
  audienceUserIds?: string;
}

export class AudiencePreviewDto {
  @ApiProperty({ type: Number, description: 'Comptes actifs visés.' })
  recipientCount!: number;
  @ApiProperty({
    type: Number,
    description:
      'Destinataires possédant au moins un appareil enregistré. L’écart avec `recipientCount` est le nombre de personnes qui ne verront le message qu’en ouvrant l’application.',
  })
  reachableCount!: number;
  @ApiProperty({
    type: Boolean,
    description: 'Faux quand aucun compte de service FCM n’est configuré.',
  })
  transportConfigured!: boolean;
  @ApiProperty({ type: String, nullable: true }) transportReason!: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Appareils
// ─────────────────────────────────────────────────────────────────────────────

export class RegisterDeviceDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 4096,
    description: 'Jeton d’enregistrement FCM. Réattribué si un autre compte le détenait.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(4096)
  token!: string;

  @ApiPropertyOptional({ enum: DevicePlatform, enumName: 'DevicePlatform' })
  @IsOptional()
  @IsEnum(DevicePlatform)
  platform?: DevicePlatform;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      'Écritures encore dans la file locale. Alimente le rappel « saisies non synchronisées » ; le serveur ne peut pas le deviner.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  pendingOps?: number;
}

export class UnregisterDeviceDto {
  @ApiProperty({ minLength: 8, maxLength: 4096 })
  @IsString()
  @MinLength(8)
  @MaxLength(4096)
  token!: string;
}

export class DeviceTokenDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: DevicePlatform, enumName: 'DevicePlatform' }) platform!: DevicePlatform;
  @ApiProperty({ type: String, nullable: true }) appVersion!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) lastSeenAt!: string;
  @ApiProperty({
    type: Boolean,
    description:
      'Faux quand aucun transport n’est configuré : le jeton est stocké, rien n’est remis.',
  })
  pushEnabled!: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gabarits
// ─────────────────────────────────────────────────────────────────────────────

export class NotificationTemplateDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  category!: NotificationCategory;
  @ApiProperty() titleTemplate!: string;
  @ApiProperty() bodyTemplate!: string;
  @ApiProperty({ type: String, nullable: true }) route!: string | null;
  @ApiProperty({
    type: [String],
    description: 'Variables citées par le gabarit, recalculées à chaque écriture.',
  })
  variables!: string[];
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class NotificationTemplateListDto {
  @ApiProperty({ type: () => [NotificationTemplateDto] }) items!: NotificationTemplateDto[];
}

export class CreateNotificationTemplateDto {
  @ApiProperty({ minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @ApiProperty({ minLength: 1, maxLength: 120, description: 'Peut contenir des `{{variables}}`.' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  titleTemplate!: string;

  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  bodyTemplate!: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(ROUTE_PATTERN, { message: 'route doit être une route interne commençant par /' })
  route?: string;
}

export class UpdateNotificationTemplateDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  titleTemplate?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  bodyTemplate?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(ROUTE_PATTERN, { message: 'route doit être une route interne commençant par /' })
  route?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Rendu d'un gabarit avec un jeu de variables, pour l'aperçu du compositeur. */
export class RenderTemplateDto {
  @ApiProperty({ type: Object, description: 'Couples `{ variable: valeur }`.' })
  @IsObject()
  variables!: Record<string, string>;
}

export class RenderedTemplateDto {
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({
    type: [String],
    description:
      'Variables citées et non fournies. Le marqueur `{{nom}}` reste visible dans le texte rendu.',
  })
  missing!: string[];
}

/** Compteurs bruts servant à l'écran d'administration des rappels. */
export class ReminderRunDto {
  @ApiProperty({ type: Number }) created!: number;
  @ApiProperty({ type: Number }) skipped!: number;
}

/** Défini localement plutôt qu'emprunté au module bancaire : deux modules ne
 *  doivent pas se tenir par un DTO de commodité. */
export class IncludeInactiveQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeInactive?: boolean;
}

export class ArrayOfUuidDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 1000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
