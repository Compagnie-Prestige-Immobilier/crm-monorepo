import { Body, Controller, Get, Param, ParseEnumPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Projet, Role } from '@crm/database';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ANY_AUTHENTICATED, Roles } from '../../common/decorators/roles.decorator.js';
import { ChampsConversionService } from './champs-conversion.service.js';
import { ReglagesConversionDto, UpdateReglagesConversionDto } from './dto.js';

@ApiTags('champs-conversion')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@ApiParam({ name: 'projet', enum: Projet, enumName: 'Projet' })
@Controller({ path: 'champs-conversion/:projet', version: '1' })
export class ChampsConversionController {
  constructor(private readonly champs: ChampsConversionService) {}

  @Get()
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({
    operationId: 'getChampsConversion',
    summary: 'Champs du formulaire de conversion, dans l’ordre d’affichage.',
    description:
      'Lu par le formulaire du téléconseiller comme par le formulaire public : ' +
      'un champ masqué n’est ni rendu ni exigé. Les champs imposés reviennent ' +
      'toujours visibles, quel que soit le réglage enregistré.',
  })
  @ApiResponse({ status: 200, type: ReglagesConversionDto })
  reglages(
    @Param('projet', new ParseEnumPipe(Projet)) projet: Projet,
  ): Promise<ReglagesConversionDto> {
    return this.champs.reglages(projet);
  }

  @Put()
  @Roles(Role.ADMIN)
  @ApiOperation({
    operationId: 'updateChampsConversion',
    summary: 'Enregistre visibilité, caractère obligatoire, ordre et champs ajoutés.',
    description: 'La liste entière est remplacée. Masquer un champ imposé est refusé en 400.',
  })
  @ApiResponse({ status: 200, type: ReglagesConversionDto })
  maj(
    @Param('projet', new ParseEnumPipe(Projet)) projet: Projet,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateReglagesConversionDto,
  ): Promise<ReglagesConversionDto> {
    return this.champs.majReglages(projet, user.id, body);
  }
}
