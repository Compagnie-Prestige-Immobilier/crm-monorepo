import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CallbacksService } from './callbacks.service.js';
import { CallbackDto, CallbackListDto, CallbackQueryDto } from './dto.js';

@ApiTags('phase2')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'phase2/callbacks', version: '1' })
export class CallbacksController {
  constructor(private readonly callbacks: CallbacksService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COMMERCIAL, Role.CHARGE_CLIENTELE, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'listScheduledCallbacks',
    summary: 'Rappels promis encore dus.',
    description:
      'Un téléconseiller ne voit que les rappels qu’il a promis. Les rappels en retard remontent ' +
      'dans la journée courante : le retard se déduit de la date, il n’est jamais écrit.',
  })
  @ApiResponse({ status: 200, type: CallbackListDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CallbackQueryDto,
  ): Promise<CallbackListDto> {
    return this.callbacks.list(user, query);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.COMMERCIAL, Role.CHARGE_CLIENTELE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'cancelScheduledCallback',
    summary: 'Annule un rappel qui n’a plus lieu d’être.',
    description: 'Idempotent : un rappel déjà clos ou annulé est rendu tel quel.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CallbackDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'CALLBACK_NOT_FOUND.' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CallbackDto> {
    return this.callbacks.cancel(user, id);
  }
}
