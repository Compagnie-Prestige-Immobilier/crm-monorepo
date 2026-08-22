import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@crm/database';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { OkDto } from '../../common/dto/ok.dto.js';
import { ProspectQueryDto } from '../../common/dto/prospect-filter.dto.js';
import { ProspectsService } from './prospects.service.js';
import { SegmentChangeService } from './segment-change.service.js';
import {
  ChangeProspectSegmentDto,
  ConfirmGrandPublicConversionDto,
  CreateProspectDto,
  MergeProspectsDto,
  ProspectConflictDto,
  ProspectDto,
  ProspectListDto,
  ReassignProspectsDto,
  ReassignResultDto,
  SegmentChangeListDto,
  UpdateProspectDto,
  UpdateGrandPublicConsentDto,
} from './dto.js';

@ApiTags('prospects')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Roles(Role.COMMERCIAL, Role.ADMIN)
@Controller({ path: 'prospects', version: '1' })
export class ProspectsController {
  constructor(
    private readonly prospects: ProspectsService,
    private readonly segments: SegmentChangeService,
  ) {}

  @Get()
  @Roles(Role.COMMERCIAL, Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'listProspects',
    summary: 'Liste filtrée, triée et paginée côté serveur.',
    description: 'Un COMMERCIAL ne voit que ses propres prospects, quels que soient les filtres.',
  })
  @ApiResponse({ status: 200, type: ProspectListDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProspectQueryDto,
  ): Promise<ProspectListDto> {
    return this.prospects.list(user, query);
  }

  @Get(':id')
  @Roles(Role.COMMERCIAL, Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({ operationId: 'getProspect', summary: 'Détail d’un prospect.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProspectDto })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProspectDto> {
    return this.prospects.get(user, id);
  }

  @Post()
  @ApiOperation({ operationId: 'createProspect', summary: 'Enregistre un prospect.' })
  @ApiResponse({ status: 201, type: ProspectDto })
  @ApiResponse({
    status: 409,
    type: ProspectConflictDto,
    description:
      'Le numéro est déjà enregistré. Le corps nomme la fiche existante et son commercial.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateProspectDto,
  ): Promise<ProspectDto> {
    return this.prospects.create(user, body);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateProspect', summary: 'Modifie un prospect.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProspectDto })
  @ApiResponse({ status: 409, type: ProspectConflictDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProspectDto,
  ): Promise<ProspectDto> {
    return this.prospects.update(user, id, body);
  }

  @Patch(':id/parcours/grand-public/consentement')
  @ApiOperation({
    operationId: 'updateGrandPublicConsent',
    summary: 'Trace l’accord ou le refus de poursuivre en Grand Public.',
  })
  @ApiResponse({ status: 200, type: ProspectDto })
  updateGrandPublicConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateGrandPublicConsentDto,
  ): Promise<ProspectDto> {
    return this.prospects.setGrandPublicConsent(user, id, body.consent);
  }

  @Post(':id/parcours/grand-public/conversion')
  @ApiOperation({
    operationId: 'confirmGrandPublicConversion',
    summary: 'Confirme une vente ou adhésion Grand Public.',
  })
  @ApiResponse({ status: 200, type: ProspectDto })
  confirmGrandPublicConversion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfirmGrandPublicConversionDto,
  ): Promise<ProspectDto> {
    return this.prospects.confirmGrandPublicConversion(user, id, body);
  }

  @Delete(':id')
  @ApiOperation({
    operationId: 'deleteProspect',
    summary: 'Supprime logiquement un prospect ; le numéro redevient ressaisissable.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: OkDto })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OkDto> {
    return this.prospects.remove(user, id);
  }

  @Post('merge')
  @ApiOperation({
    operationId: 'mergeProspects',
    summary: 'Fusionne deux fiches désignant la même personne.',
  })
  @ApiResponse({ status: 200, type: ProspectDto })
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MergeProspectsDto,
  ): Promise<ProspectDto> {
    return this.prospects.merge(user, body);
  }

  @Patch(':id/segment')
  @Roles(Role.COMMERCIAL, Role.ADMIN)
  @ApiOperation({
    operationId: 'changeProspectSegment',
    summary: 'Fait basculer un prospect de segment, avec motif et trace.',
    description:
      'Écrit la banque, le syndicat ET la ligne de `SegmentChange` dans la MÊME ' +
      'transaction. Le segment n’étant pas stocké, c’est le seul chemin qui laisse ' +
      'une trace de la conversion : la modification ordinaire écrirait les deux clés ' +
      'sans que rien ne distingue ensuite une fiche convertie d’une fiche née là.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProspectDto })
  @ApiErrors({
    404: 'PROSPECT_NOT_FOUND · fiche absente ou supprimée.',
    409: 'PROSPECT_REV_CONFLICT · la fiche a bougé depuis son affichage ; le corps porte `currentRev`.',
    422:
      'PROSPECT_SEGMENT_UNCHANGED · ni la banque ni le syndicat ne changent. ' +
      'PROSPECT_BANQUE_NOT_FOUND, PROSPECT_SYNDICAT_NOT_FOUND · destination inconnue.',
  })
  changeSegment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeProspectSegmentDto,
  ): Promise<ProspectDto> {
    return this.segments.migrate(user, id, body);
  }

  @Get(':id/segment-history')
  @Roles(Role.COMMERCIAL, Role.ADMIN)
  @ApiOperation({
    operationId: 'listProspectSegmentChanges',
    summary:
      'Bascules de segment déjà subies par une fiche, de la plus récente à la plus ancienne.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: SegmentChangeListDto })
  @ApiErrors({ 404: 'PROSPECT_NOT_FOUND · fiche absente ou supprimée.' })
  segmentHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SegmentChangeListDto> {
    return this.segments.history(user, id);
  }

  @Post('reassign')
  @ApiOperation({
    operationId: 'reassignProspects',
    summary: 'Rattache des prospects à un autre représentant, ou à un autre commercial (ADMIN).',
  })
  @ApiResponse({ status: 200, type: ReassignResultDto })
  reassign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReassignProspectsDto,
  ): Promise<ReassignResultDto> {
    return this.prospects.reassign(user, body);
  }
}
