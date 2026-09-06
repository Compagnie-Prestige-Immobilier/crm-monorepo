import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { PARCOURS_ROLES, Roles } from '../../common/decorators/roles.decorator.js';
import { OuverturesService } from './ouvertures.service.js';
import {
  ComptageOuverturesDto,
  ComptageOuverturesQueryDto,
  EnregistrerBrouillonDto,
  OuvertureFicheDto,
  OuvertureFicheListDto,
  OuvrirFicheDto,
} from './dto.js';

@ApiTags('ouvertures')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'ouvertures', version: '1' })
export class OuverturesController {
  constructor(private readonly ouvertures: OuverturesService) {}

  @Post()
  @Roles(...PARCOURS_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'ouvrirFiche',
    summary: 'Enregistre l’ouverture confirmée d’une fiche.',
    description:
      'Chaque ouverture confirmée compte, même répétée le même jour sur la même fiche. La consultation en lecture seule ne passe pas par ici. Un téléconseiller n’a qu’une fiche ouverte à la fois : la seconde sort en 409 OUVERTURE_FICHE_DEJA_OUVERTE.',
  })
  @ApiResponse({ status: 200, type: OuvertureFicheDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'OUVERTURE_FICHE_INTROUVABLE.' })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'OUVERTURE_FICHE_DEJA_OUVERTE, OUVERTURE_ID_PRIS.',
  })
  ouvrir(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: OuvrirFicheDto,
  ): Promise<OuvertureFicheDto> {
    return this.ouvertures.ouvrir(user, body);
  }

  @Get('courante')
  @Roles(...PARCOURS_ROLES)
  @ApiOperation({
    operationId: 'ouvertureCourante',
    summary: 'La fiche que l’appelant a en main, avec son brouillon.',
    description: 'Nulle quand aucune fiche n’est ouverte.',
  })
  @ApiResponse({ status: 200, type: OuvertureFicheDto })
  courante(@CurrentUser() user: AuthenticatedUser): Promise<OuvertureFicheDto | null> {
    return this.ouvertures.courante(user);
  }

  @Put(':id/brouillon')
  @Roles(...PARCOURS_ROLES)
  @ApiOperation({
    operationId: 'enregistrerBrouillonOuverture',
    summary: 'Remplace le brouillon d’une fiche ouverte.',
    description:
      'La première requête démarre le chronomètre : elle pose `firstInputAt`, une seule fois. Les suivantes ne le déplacent pas, même si elles le renvoient.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: OuvertureFicheDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'OUVERTURE_INTROUVABLE.' })
  @ApiResponse({ status: 409, type: ApiErrorDto, description: 'OUVERTURE_DEJA_FERMEE.' })
  enregistrerBrouillon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EnregistrerBrouillonDto,
  ): Promise<OuvertureFicheDto> {
    return this.ouvertures.enregistrerBrouillon(user, id, body);
  }

  @Get('ouvertes')
  @Roles(Role.ADMIN, Role.SUPERVISEUR)
  @ApiOperation({
    operationId: 'listOuverturesOuvertes',
    summary: 'Les fiches restées ouvertes, à libérer.',
  })
  @ApiResponse({ status: 200, type: OuvertureFicheListDto })
  ouvertes(): Promise<OuvertureFicheListDto> {
    return this.ouvertures.ouvertes();
  }

  @Post(':id/liberation')
  @Roles(Role.ADMIN, Role.SUPERVISEUR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'libererOuverture',
    summary: 'Libère une fiche restée ouverte.',
    description:
      'Réservé au superviseur et à l’administrateur, jamais automatique. La libération est tracée et la fiche repasse en file de rappel.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: OuvertureFicheDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'OUVERTURE_INTROUVABLE.' })
  @ApiResponse({ status: 409, type: ApiErrorDto, description: 'OUVERTURE_DEJA_FERMEE.' })
  liberer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OuvertureFicheDto> {
    return this.ouvertures.liberer(user, id);
  }

  @Get('comptage')
  @Roles(...PARCOURS_ROLES)
  @ApiOperation({
    operationId: 'compterOuvertures',
    summary: 'Fiches ouvertes par téléconseiller et par jour.',
    description:
      'Porte aussi la durée moyenne de traitement, lue entre la première saisie et la qualification. Une fiche ouverte sans rien saisir n’entre pas au dénominateur. Un téléconseiller ne lit que son propre compte.',
  })
  @ApiResponse({ status: 200, type: ComptageOuverturesDto })
  comptage(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ComptageOuverturesQueryDto,
  ): Promise<ComptageOuverturesDto> {
    return this.ouvertures.comptage(user, query);
  }
}
