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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { OkDto } from '../../common/dto/ok.dto.js';
import { ProspectQueryDto } from '../../common/dto/prospect-filter.dto.js';
import { ProspectsService } from './prospects.service.js';
import {
  CreateProspectDto,
  MergeProspectsDto,
  ProspectConflictDto,
  ProspectDto,
  ProspectListDto,
  ReassignProspectsDto,
  ReassignResultDto,
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
@Controller({ path: 'prospects', version: '1' })
export class ProspectsController {
  constructor(private readonly prospects: ProspectsService) {}

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
