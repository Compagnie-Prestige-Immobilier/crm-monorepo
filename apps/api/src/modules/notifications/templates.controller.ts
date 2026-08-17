import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Role } from '@crm/database';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { DemoWritable } from '../../common/decorators/demo-writable.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { NotificationTemplatesService } from './templates.service.js';
import {
  CreateNotificationTemplateDto,
  IncludeInactiveQueryDto,
  NotificationTemplateDto,
  NotificationTemplateListDto,
  RenderTemplateDto,
  RenderedTemplateDto,
  UpdateNotificationTemplateDto,
} from './dto.js';

@ApiTags('notification-templates')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'notification-templates', version: '1' })
export class NotificationTemplatesController {
  constructor(private readonly templates: NotificationTemplatesService) {}

  @Get()
  @ApiOperation({
    operationId: 'listNotificationTemplates',
    summary: 'Gabarits disponibles, avec leurs variables.',
  })
  @ApiResponse({ status: 200, type: NotificationTemplateListDto })
  list(@Query() query: IncludeInactiveQueryDto): Promise<NotificationTemplateListDto> {
    return this.templates.list(query.includeInactive ?? false);
  }

  @Post()
  @ApiOperation({
    operationId: 'createNotificationTemplate',
    summary: 'Crée un gabarit.',
    description:
      '`variables` n’est pas saisi : il est déduit du texte à chaque écriture. Une liste tenue à la main diverge du gabarit dès la première correction.',
  })
  @ApiResponse({ status: 201, type: NotificationTemplateDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'NOTIFICATION_TEMPLATE_NAME_CONFLICT.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateNotificationTemplateDto,
  ): Promise<NotificationTemplateDto> {
    return this.templates.create(user, body);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getNotificationTemplate', summary: 'Un gabarit.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: NotificationTemplateDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'NOTIFICATION_TEMPLATE_NOT_FOUND.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<NotificationTemplateDto> {
    return this.templates.get(id);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateNotificationTemplate', summary: 'Modifie un gabarit.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: NotificationTemplateDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateNotificationTemplateDto,
  ): Promise<NotificationTemplateDto> {
    return this.templates.update(id, body);
  }

  @DemoWritable('aperçu calculé, aucune écriture malgré la méthode POST')
  @Post(':id/render')
  @ApiOperation({
    operationId: 'renderNotificationTemplate',
    summary: 'Substitue les variables, pour l’aperçu du compositeur.',
    description:
      'Une variable manquante n’est PAS une erreur : le marqueur `{{nom}}` reste visible et son nom remonte dans `missing`, ce qui laisse l’interface avertir sans interrompre la frappe.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: RenderedTemplateDto })
  render(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenderTemplateDto,
  ): Promise<RenderedTemplateDto> {
    return this.templates.render(id, body.variables);
  }
}
