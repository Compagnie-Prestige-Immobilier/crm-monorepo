import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { ANY_AUTHENTICATED, Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { VISITE_REGISTRE_ROLES, VisitesService } from './visites.service.js';
import { VisitesStatsService } from './visites-stats.service.js';
import {
  VisiteReferentielsService,
  VisiteReferentielUsageDto,
} from './visite-referentiels.service.js';
import {
  CreateVisiteDto,
  CreateVisiteReferentielDto,
  ReorderVisiteReferentielDto,
  SetVisiteReferentielActiveDto,
  UpdateVisiteDto,
  UpdateVisiteReferentielDto,
  VISITE_REFERENTIEL_KINDS,
  VisiteDto,
  VisiteListDto,
  VisiteQueryDto,
  VisiteReferentielDto,
  VisiteReferentielKindEnum,
  VisiteReferentielListDto,
  VisiteReferentielQueryDto,
  VisiteReferentielsBundleDto,
  VisiteStatsDto,
  VisiteStatsQueryDto,
  type VisiteReferentielKind,
} from './dto.js';

/** Les quatre listes du registre appartiennent au metier, pas a la technique. */
const LISTES_ROLES = [Role.ADMIN, Role.DIRECTION] as const;

@ApiTags('visites')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'visites', version: '1' })
export class VisitesController {
  constructor(
    private readonly visites: VisitesService,
    private readonly stats: VisitesStatsService,
    private readonly referentiels: VisiteReferentielsService,
  ) {}

  @Roles(...ANY_AUTHENTICATED)
  @Get('referentiels')
  @ApiOperation({
    operationId: 'listVisiteReferentiels',
    summary: 'Les quatre listes de l’accueil, en un appel.',
  })
  @ApiResponse({ status: 200, type: VisiteReferentielsBundleDto })
  bundle(@Query() query: VisiteReferentielQueryDto): Promise<VisiteReferentielsBundleDto> {
    return this.referentiels.bundle(query.activeOnly ?? true);
  }

  @Roles(...LISTES_ROLES)
  @Get('referentiels/usage')
  @ApiOperation({
    operationId: 'getVisiteReferentielUsage',
    summary: 'Combien de visites désignent chaque entrée des quatre listes.',
    description: 'Total toutes dates confondues, à distinguer du décompte borné de /statistiques.',
  })
  @ApiResponse({ status: 200, type: VisiteReferentielUsageDto })
  usage(): Promise<VisiteReferentielUsageDto> {
    return this.referentiels.usage();
  }

  @Roles(...LISTES_ROLES)
  @Get('referentiels/:kind')
  @ApiOperation({
    operationId: 'listVisiteReferentiel',
    summary: 'Une liste, entrées retirées comprises.',
  })
  @ApiParam({ name: 'kind', enum: VISITE_REFERENTIEL_KINDS, enumName: 'VisiteReferentielKind' })
  @ApiResponse({ status: 200, type: VisiteReferentielListDto })
  listReferentiel(
    @Param('kind', new ParseEnumPipe(VisiteReferentielKindEnum)) kind: VisiteReferentielKind,
    @Query() query: VisiteReferentielQueryDto,
  ): Promise<VisiteReferentielListDto> {
    return this.referentiels.list(kind, query.activeOnly ?? false);
  }

  @Roles(...LISTES_ROLES)
  @Post('referentiels/:kind')
  @ApiOperation({
    operationId: 'createVisiteReferentiel',
    summary: 'Ajoute une entrée à une liste.',
    description: 'Le code est immuable : les visites déjà enregistrées le désignent.',
  })
  @ApiParam({ name: 'kind', enum: VISITE_REFERENTIEL_KINDS, enumName: 'VisiteReferentielKind' })
  @ApiResponse({ status: 201, type: VisiteReferentielDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'VISITE_REFERENTIEL_CODE_CONFLICT ou VISITE_REFERENTIEL_LABEL_CONFLICT.',
  })
  createReferentiel(
    @Param('kind', new ParseEnumPipe(VisiteReferentielKindEnum)) kind: VisiteReferentielKind,
    @Body() body: CreateVisiteReferentielDto,
  ): Promise<VisiteReferentielDto> {
    return this.referentiels.create(kind, body);
  }

  @Roles(...LISTES_ROLES)
  @Patch('referentiels/:kind/:id')
  @ApiOperation({
    operationId: 'updateVisiteReferentiel',
    summary: 'Renomme ou déplace une entrée.',
  })
  @ApiParam({ name: 'kind', enum: VISITE_REFERENTIEL_KINDS, enumName: 'VisiteReferentielKind' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: VisiteReferentielDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'VISITE_REFERENTIEL_NOT_FOUND.' })
  updateReferentiel(
    @Param('kind', new ParseEnumPipe(VisiteReferentielKindEnum)) kind: VisiteReferentielKind,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateVisiteReferentielDto,
  ): Promise<VisiteReferentielDto> {
    return this.referentiels.update(kind, id, body);
  }

  @Roles(...LISTES_ROLES)
  @Post('referentiels/:kind/:id/active')
  @ApiOperation({
    operationId: 'setVisiteReferentielActive',
    summary: 'Retire une entrée des listes, ou l’y remet.',
    description:
      'Jamais de suppression : le registre des années passées continue de désigner l’entrée.',
  })
  @ApiParam({ name: 'kind', enum: VISITE_REFERENTIEL_KINDS, enumName: 'VisiteReferentielKind' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: VisiteReferentielDto })
  setReferentielActive(
    @Param('kind', new ParseEnumPipe(VisiteReferentielKindEnum)) kind: VisiteReferentielKind,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetVisiteReferentielActiveDto,
  ): Promise<VisiteReferentielDto> {
    return this.referentiels.setActive(kind, id, body);
  }

  @Roles(...LISTES_ROLES)
  @Post('referentiels/:kind/reorder')
  @ApiOperation({
    operationId: 'reorderVisiteReferentiel',
    summary: 'Fixe l’ordre d’affichage d’une liste.',
  })
  @ApiParam({ name: 'kind', enum: VISITE_REFERENTIEL_KINDS, enumName: 'VisiteReferentielKind' })
  @ApiResponse({ status: 201, type: VisiteReferentielListDto })
  reorderReferentiel(
    @Param('kind', new ParseEnumPipe(VisiteReferentielKindEnum)) kind: VisiteReferentielKind,
    @Body() body: ReorderVisiteReferentielDto,
  ): Promise<VisiteReferentielListDto> {
    return this.referentiels.reorder(kind, body);
  }

  @Roles(...VISITE_REGISTRE_ROLES)
  @Get('statistiques')
  @ApiOperation({
    operationId: 'getVisiteStats',
    summary: 'Le registre compté sur une période.',
    description:
      'Total, répartitions par entreprise, direction, destinataire et objet, puis la marche du mois et du jour. Une répartition liste TOUTES les entrées de sa liste, y compris à zéro ; sa somme peut être inférieure au total, l’écart étant rendu par sansDirection et sansDestinataire.',
  })
  @ApiResponse({ status: 200, type: VisiteStatsDto })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: 'VISITE_STATS_RANGE_INVALID ou VISITE_STATS_RANGE_TOO_WIDE.',
  })
  statistiques(@Query() query: VisiteStatsQueryDto): Promise<VisiteStatsDto> {
    return this.stats.compute(query);
  }

  @Roles(...VISITE_REGISTRE_ROLES)
  @Get()
  @ApiOperation({
    operationId: 'listVisites',
    summary: 'Le registre, du plus récent au plus ancien.',
  })
  @ApiResponse({ status: 200, type: VisiteListDto })
  list(@Query() query: VisiteQueryDto): Promise<VisiteListDto> {
    return this.visites.list(query);
  }

  @Roles(...VISITE_REGISTRE_ROLES)
  @Get(':id')
  @ApiOperation({ operationId: 'getVisite', summary: 'Une ligne du registre.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: VisiteDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'VISITE_NOT_FOUND.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<VisiteDto> {
    return this.visites.get(id);
  }

  @Roles(...VISITE_REGISTRE_ROLES)
  @Post()
  @ApiOperation({
    operationId: 'createVisite',
    summary: 'Inscrit un visiteur au registre.',
    description:
      'La référence est engendrée par le serveur. Le téléphone est facultatif et accepté sous n’importe quelle forme : un numéro que la normalisation ne reconnaît pas est conservé tel quel, avec phoneE164 nul.',
  })
  @ApiResponse({ status: 201, type: VisiteDto })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: 'VISITE_REFERENTIEL_UNAVAILABLE ou VISITE_REFERENCE_EXHAUSTED.',
  })
  create(
    @Body() body: CreateVisiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VisiteDto> {
    return this.visites.create(body, user.id);
  }

  @Roles(...VISITE_REGISTRE_ROLES)
  @Patch(':id')
  @ApiOperation({
    operationId: 'updateVisite',
    summary: 'Corrige une ligne du registre.',
    description: 'Ni la date ni la référence : elles fixent la ligne dans le registre.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: VisiteDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'VISITE_NOT_FOUND.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateVisiteDto,
  ): Promise<VisiteDto> {
    return this.visites.update(id, body);
  }
}
