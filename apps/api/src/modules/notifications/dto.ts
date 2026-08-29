import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
  ValidateIf,
  Min,
  MinLength,
} from 'class-validator';
import {
  NotificationAudience,
  NotificationCategory,
  NotificationDeliveryStatus,
  NotificationStatus,
  Role,
} from '@crm/database';

import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';
import { queryBoolean } from '../../common/dto/query-boolean.js';

export const ROUTE_PATTERN = /^\/[A-Za-z0-9\-._~/%?&=+:@!$'(),;[\]*]*$/;

export class NotificationDeliveryCountsDto {
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({
    type: Number,
    description:
      'En file. Soit le destinataire n’est pas servi par e-mail et lira dans l’application, soit l’envoi a échoué de façon passagère et sera réessayé. Ce n’est pas un échec.',
  })
  pending!: number;
  @ApiProperty({
    type: Number,
    description: 'E-mail accepté par Brevo. N’implique pas « lu », ni même « remis ».',
  })
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
      'Issue de la branche E-MAIL, seul canal sortant. NOT_CONFIGURED quand aucune clé Brevo n’est fournie : les lignes de livraison existent et la boîte de réception les montre, aucun e-mail n’est parti. TRANSPORT_ERROR quand Brevo a tout refusé ; les livraisons restent en file et seront réessayées.',
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
    description: 'Une ligne par destinataire, c’est ce qui rend « qui a reçu ? » répondable.',
  })
  recipients!: NotificationRecipientDto[];
}

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

  @ApiProperty({ enum: NotificationAudience, enumName: 'NotificationAudience' })
  @IsEnum(NotificationAudience)
  audience!: NotificationAudience;

  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  audienceRole?: Role;

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
  @Transform(queryBoolean)
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

export class AudiencePreviewQueryDto {
  @ApiProperty({ enum: NotificationAudience, enumName: 'NotificationAudience' })
  @IsEnum(NotificationAudience)
  audience!: NotificationAudience;

  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  audienceRole?: Role;

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
  @ApiProperty({
    type: Number,
    description:
      'Comptes actifs visés. Tous liront la notification dans l’application : il n’y a plus de « joignable » distinct de « visé ».',
  })
  recipientCount!: number;
}

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

  /** La chaîne VIDE retire le lien ; sur un PATCH, l'omission ne change rien. */
  @ApiPropertyOptional({ maxLength: 300, description: 'Chaîne vide pour retirer le lien.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @ValidateIf((_object: object, value: unknown) => value !== '')
  @Matches(ROUTE_PATTERN, { message: 'route doit être une route interne commençant par /' })
  route?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RenderTemplateDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Couples `{ variable: valeur }`.',
  })
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

export class ReminderRunDto {
  @ApiProperty({ type: Number }) created!: number;
  @ApiProperty({ type: Number }) skipped!: number;
}

export class IncludeInactiveQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(queryBoolean)
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
