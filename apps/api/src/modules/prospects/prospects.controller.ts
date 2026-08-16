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
  CreateProspectDto,
  MergeProspectsDto,
  ProspectConflictDto,
  ProspectDto,
  ProspectListDto,
  ReassignProspectsDto,
  ReassignResultDto,
  SegmentChangeListDto,
  UpdateProspectDto,
} from './dto.js';

@ApiTags('prospects')
@ApiBearerAuth()
// Toute route de ce contrôleur peut refuser pour ces trois raisons :
// jeton absent ou expiré, rôle insuffisant, et entrée refusée par la
// validation globale (`forbidNonWhitelisted` transforme un paramètre mal
// orthographié en 400). Les déclarer ici évite de les oublier route par
// route, ce qui était le cas sur 116 opérations sur 119.
@ApiErrors({ 400: true, 401: true, 403: true })
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * QUI PEUT ATTEINDRE CES SEPT ROUTES, ÉCRIT PLUTÔT QUE SUPPOSÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Elles ne portaient AUCUN `@Roles`, et `RolesGuard` laisse passer toute
 * identité authentifiée en l'absence de décorateur : un agent du pôle banque et
 * financement pouvait donc lister, lire, créer, modifier, supprimer, fusionner
 * et réaffecter des prospects. Rien ne l'en empêchait côté API.
 *
 * Ce n'était pas l'intention, et ce n'est pas une déduction : le panneau web
 * refuse déjà l'écran des prospects à ce rôle, en toutes lettres, au motif que
 * « son métier tient dans les dossiers bancaires ». La règle existait donc,
 * écrite d'un seul côté du fil, sur le côté que l'utilisateur peut contourner
 * en appelant l'API directement.
 *
 * ═══ POURQUOI COMMERCIAL RESTE, ET POURQUOI LE CLOISONNEMENT NE SUFFIT PAS ═══
 *
 * `ProspectsService` cloisonne par auteur (`ownerScope`) : un COMMERCIAL ne
 * voit que ses fiches, un ADMIN les voit toutes. C'est le comportement que les
 * descriptions de ces routes annoncent, et il est conservé tel quel.
 *
 * Ce cloisonnement est une propriété de CHAQUE requête du service, pas une
 * règle du contrôleur : il protège les LIGNES, jamais l'ACCÈS. La première
 * lecture écrite sans lui, ou le premier agrégat qui n'a pas d'auteur à
 * filtrer, ouvre les sept routes d'un coup. Le décorateur dit la règle une
 * fois, à l'entrée, et c'est ce que ce contrôleur n'avait pas.
 *
 * ═══ CE QUI RESTE AU SERVICE, ET C'EST VOULU ═══
 *
 * `reassign` accepte un `commercialId`, et changer de PROPRIÉTAIRE est réservé
 * à l'ADMIN. Cette règle-là dépend d'un ARGUMENT et non de la route : elle
 * reste dans le service, qui lève déjà `NOT_OWNER`. Un `@Roles(ADMIN)` sur la
 * route retirerait au commercial la réaffectation vers un autre REPRÉSENTANT,
 * qui est son travail ordinaire.
 */
@Roles(Role.COMMERCIAL, Role.ADMIN)
@Controller({ path: 'prospects', version: '1' })
export class ProspectsController {
  constructor(
    private readonly prospects: ProspectsService,
    private readonly segments: SegmentChangeService,
  ) {}

  @Get()
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

  /**
   * MÊMES rôles que le reste du contrôleur, écrits une seconde fois.
   *
   * Redondant avec le `@Roles` de classe, et volontairement : c'est la seule
   * route du module qui écrit une pièce d'HISTOIRE, et la question « qui peut
   * convertir une fiche » doit se lire à l'endroit où on la pose, sans avoir à
   * remonter cent lignes. Le cloisonnement par auteur s'applique en plus, dans
   * le service : un COMMERCIAL ne convertit que ses propres fiches.
   */
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
