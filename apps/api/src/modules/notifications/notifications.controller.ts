import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Role } from '@crm/database';

import { ANY_AUTHENTICATED, Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { OkDto } from '../../common/dto/ok.dto.js';
import { NotificationsService } from './notifications.service.js';
import { parseUserIdList } from './audience.js';
import {
  AudiencePreviewDto,
  AudiencePreviewQueryDto,
  CreateNotificationDto,
  InboxDto,
  InboxQueryDto,
  NotificationDetailDto,
  NotificationDto,
  NotificationListDto,
  NotificationQueryDto,
} from './dto.js';

@ApiTags('notifications')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @ApiOperation({
    operationId: 'createNotification',
    summary: 'Compose et envoie, ou programme, une notification.',
    description:
      'Le public est résolu et les lignes de livraison écrites AVANT toute remise. Sans clé Brevo, la notification est stockée et reste visible dans la boîte de réception : `transportStatus` vaut alors NOT_CONFIGURED, aucun e-mail n’est parti, et l’interface doit le dire.',
  })
  @ApiResponse({ status: 201, type: NotificationDto })
  @ApiResponse({
    status: 422,
    type: ApiErrorDto,
    description:
      'NOTIFICATION_AUDIENCE_EMPTY, NOTIFICATION_AUDIENCE_ROLE_REQUIRED, NOTIFICATION_AUDIENCE_DEPARTEMENT_REQUIRED, NOTIFICATION_AUDIENCE_USERS_REQUIRED, NOTIFICATION_SCHEDULE_IN_PAST, NOTIFICATION_ROUTE_INVALID.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateNotificationDto,
  ): Promise<NotificationDto> {
    return this.notifications.create(user, body);
  }

  @Get()
  @ApiOperation({
    operationId: 'listNotifications',
    summary: 'Historique des envois, avec les compteurs de livraison.',
  })
  @ApiResponse({ status: 200, type: NotificationListDto })
  list(@Query() query: NotificationQueryDto): Promise<NotificationListDto> {
    return this.notifications.list(query);
  }

  @Roles(...ANY_AUTHENTICATED)
  @Get('mine')
  @ApiOperation({
    operationId: 'listMyNotifications',
    summary: 'Boîte de réception de l’utilisateur courant.',
    description:
      'C’est le canal qui fait foi : une notification y figure dès sa composition, indépendamment de toute remise sortante. Le mobile s’en sert désormais comme unique source.',
  })
  @ApiResponse({ status: 200, type: InboxDto })
  mine(@CurrentUser() user: AuthenticatedUser, @Query() query: InboxQueryDto): Promise<InboxDto> {
    return this.notifications.inbox(user, query);
  }

  @Get('audience-preview')
  @ApiOperation({
    operationId: 'previewNotificationAudience',
    summary: 'Nombre de destinataires, AVANT confirmation.',
    description:
      'Utilise exactement le filtre de l’envoi : le nombre annoncé est celui qui sera servi. Envoyer à 400 personnes ne s’annule pas.',
  })
  @ApiResponse({ status: 200, type: AudiencePreviewDto })
  preview(@Query() query: AudiencePreviewQueryDto): Promise<AudiencePreviewDto> {
    return this.notifications.previewAudience({
      audience: query.audience,
      audienceRole: query.audienceRole ?? null,
      audienceDepartementId: query.audienceDepartementId ?? null,
      audienceUserIds: parseUserIdList(query.audienceUserIds),
    });
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getNotification',
    summary: 'Détail d’un envoi, destinataire par destinataire.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: NotificationDetailDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'NOTIFICATION_NOT_FOUND.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<NotificationDetailDto> {
    return this.notifications.get(id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    operationId: 'cancelNotification',
    summary: 'Annule une notification encore programmée.',
    description:
      'Refusé sur un envoi déjà parti : un téléphone qui a sonné ne se rappelle pas, et marquer « annulée » une chose déjà lue serait un mensonge dans l’historique.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: NotificationDto })
  @ApiResponse({ status: 409, type: ApiErrorDto, description: 'NOTIFICATION_NOT_SCHEDULED.' })
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<NotificationDto> {
    return this.notifications.cancel(id);
  }

  @Roles(...ANY_AUTHENTICATED)
  @Post(':id/read')
  @ApiOperation({
    operationId: 'markNotificationRead',
    summary: 'Marque lue la notification de l’utilisateur courant.',
    description:
      'Idempotent : un second appel ne réécrit pas la première lecture, qui est la seule intéressante.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: OkDto })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OkDto> {
    return this.notifications.markRead(user, id);
  }
}
