import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ParametresService } from './parametres.service.js';
import { ParametresChuesDto, ParametresPublicsDto, UpdateParametresChuesDto } from './dto.js';

@ApiTags('parametres')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'parametres', version: '1' })
export class ParametresController {
  constructor(private readonly parametres: ParametresService) {}

  /**
   * Ouverte a tout compte connecte, et a lui seul : le teleconseiller doit lire
   * l'adresse et le numero au prospect pendant l'appel. Rien de secret n'y
   * passe, les jetons du connecteur restent sur la route d'administration.
   */
  @Get('enrolement')
  @ApiOperation({
    operationId: 'getParametresEnrolement',
    summary: 'Ce que le téléconseiller dicte au prospect selon la méthode retenue.',
  })
  @ApiResponse({ status: 200, type: ParametresPublicsDto })
  publics(): Promise<ParametresPublicsDto> {
    return this.parametres.publics();
  }

  @Get('chues')
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'getParametresChues', summary: 'Paramètres CHUES.' })
  @ApiResponse({ status: 200, type: ParametresChuesDto })
  chues(): Promise<ParametresChuesDto> {
    return this.parametres.chues();
  }

  @Put('chues')
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'putParametresChues', summary: 'Modifie les paramètres CHUES.' })
  @ApiResponse({ status: 200, type: ParametresChuesDto })
  maj(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateParametresChuesDto,
  ): Promise<ParametresChuesDto> {
    return this.parametres.maj(user.id, body);
  }
}
