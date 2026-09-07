import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { ANY_AUTHENTICATED, ENCADREMENT, Roles } from '../../common/decorators/roles.decorator.js';
import { Cached } from '../../redis/cache.interceptor.js';
import { StatutsQualificationService } from './statuts-qualification.service.js';
import {
  CreateStatutQualificationDto,
  SetStatutQualificationActiveDto,
  StatutQualificationDto,
  StatutQualificationFieldQueryDto,
  StatutQualificationListDto,
  UpdateStatutQualificationDto,
} from './dto.js';

@ApiTags('statuts-qualification')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Cached(60, 'referentiels')
@Controller({ path: 'statuts-qualification', version: '1' })
export class StatutsQualificationController {
  constructor(private readonly statuts: StatutsQualificationService) {}

  @Roles(...ANY_AUTHENTICATED)
  @Get()
  @ApiOperation({
    operationId: 'listStatutsQualification',
    summary: 'Statuts qu’un client de saisie sait émettre.',
    description:
      'Restreint aux statuts actifs dont `minPayloadVersion` ne dépasse pas la version déclarée. Un statut que l’appelant ne saurait pas renvoyer ne lui est jamais proposé : sa remontée finirait en échec définitif, hors ligne, sans possibilité de correction.',
  })
  @ApiResponse({ status: 200, type: StatutQualificationListDto })
  list(@Query() query: StatutQualificationFieldQueryDto): Promise<StatutQualificationListDto> {
    return this.statuts.listForField(query.payloadVersion);
  }

  @Roles(...ENCADREMENT)
  @Get('administration')
  @ApiOperation({
    operationId: 'listAllStatutsQualification',
    summary: 'Tous les statuts, actifs ou non, toutes versions de charge utile.',
  })
  @ApiResponse({ status: 200, type: StatutQualificationListDto })
  listAll(): Promise<StatutQualificationListDto> {
    return this.statuts.listAll();
  }

  @Roles(...ENCADREMENT)
  @Post()
  @ApiOperation({
    operationId: 'createStatutQualification',
    summary: 'Ajouter un statut de qualification.',
    description:
      'Le code est déduit du libellé, puis figé : l’historique le référence. Deux libellés qui ne se distinguent que par les accents ou la casse donnent le même code et le second est refusé.',
  })
  @ApiResponse({ status: 201, type: StatutQualificationDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'STATUT_QUALIFICATION_LABEL_CONFLICT, _CODE_CONFLICT, _CALLBACK_NOT_ALLOWED.',
  })
  create(@Body() body: CreateStatutQualificationDto): Promise<StatutQualificationDto> {
    return this.statuts.create(body);
  }

  @Roles(...ENCADREMENT)
  @Patch(':id')
  @ApiOperation({
    operationId: 'updateStatutQualification',
    summary: 'Renommer un statut, changer son rang, ou sa règle si elle n’est pas système.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: StatutQualificationDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorDto,
    description: 'STATUT_QUALIFICATION_NOT_FOUND.',
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'STATUT_QUALIFICATION_SYSTEM_IMMUTABLE, _LABEL_CONFLICT, _CALLBACK_NOT_ALLOWED.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStatutQualificationDto,
  ): Promise<StatutQualificationDto> {
    return this.statuts.update(id, body);
  }

  @Roles(...ENCADREMENT)
  @Post(':id/active')
  @ApiOperation({
    operationId: 'setStatutQualificationActive',
    summary: 'Activer ou désactiver un statut.',
    description:
      'Un statut désactivé disparaît de la saisie et reste lisible sur les fiches qui le désignent. Vider une branche du script de son dernier statut actif est refusé.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: StatutQualificationDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'STATUT_QUALIFICATION_LAST_OF_BRANCH.',
  })
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetStatutQualificationActiveDto,
  ): Promise<StatutQualificationDto> {
    return this.statuts.setActive(id, body);
  }
}
