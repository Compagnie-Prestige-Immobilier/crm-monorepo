import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ENCADREMENT, PARCOURS_ROLES, Roles } from '../../common/decorators/roles.decorator.js';
import {
  JournalParametresDto,
  JournalParametresQueryDto,
  ParametresChuesDto,
  UpdateParametresChuesDto,
} from './dto.js';
import { ParametresChuesService } from './parametres-chues.service.js';

@ApiTags('parametres-chues')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'parametres-chues', version: '1' })
export class ParametresChuesController {
  constructor(private readonly parametres: ParametresChuesService) {}

  // Lisible par tout le parcours : le formulaire de conversion affiche le lien
  // de la plateforme et l'adresse CHUES, et le telephone les emporte hors ligne.
  @Get()
  @Roles(...PARCOURS_ROLES)
  @ApiOperation({
    operationId: 'getParametresChues',
    summary: 'Les réglages CHUES, valeurs d’usine comprises.',
  })
  @ApiResponse({ status: 200, type: ParametresChuesDto })
  lire(): Promise<ParametresChuesDto> {
    return this.parametres.lire();
  }

  @Patch()
  @Roles(...ENCADREMENT)
  @ApiOperation({
    operationId: 'updateParametresChues',
    summary: 'Règle les paramètres CHUES.',
    description:
      'La supervision et la direction ne changent que les textes du message WhatsApp et de ' +
      'l’accusé de réception. Tout le reste est réservé à l’administrateur.',
  })
  @ApiResponse({ status: 200, type: ParametresChuesDto })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: 'PARAMETRE_RESERVE_ADMIN.' })
  ecrire(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateParametresChuesDto,
  ): Promise<ParametresChuesDto> {
    return this.parametres.ecrire(user, body);
  }

  @Get('journal')
  @Roles(...ENCADREMENT)
  @ApiOperation({
    operationId: 'getJournalParametresChues',
    summary: 'Qui a changé quoi, et ce que la valeur disait avant.',
  })
  @ApiResponse({ status: 200, type: JournalParametresDto })
  journal(@Query() query: JournalParametresQueryDto): Promise<JournalParametresDto> {
    return this.parametres.journal(query.limite ?? 50);
  }
}
