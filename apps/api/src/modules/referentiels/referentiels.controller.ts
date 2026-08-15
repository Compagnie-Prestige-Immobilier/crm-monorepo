import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Role } from '@crm/database';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { ReferentielsService } from './referentiels.service.js';
import {
  BanqueDto,
  CreateBanqueDto,
  CreateDepartementDto,
  CreateSyndicatDto,
  DepartementDto,
  IefDto,
  ReferentielQueryDto,
  ReferentielsBundleDto,
  RegionDto,
  RegionWithDepartementsDto,
  SyndicatDto,
  UpdateBanqueDto,
  UpdateDepartementDto,
  UpdateSyndicatDto,
} from './dto.js';

@ApiTags('referentiels')
@ApiBearerAuth()
// Toute route de ce contrôleur peut refuser pour ces trois raisons :
// jeton absent ou expiré, rôle insuffisant, et entrée refusée par la
// validation globale (`forbidNonWhitelisted` transforme un paramètre mal
// orthographié en 400). Les déclarer ici évite de les oublier route par
// route, ce qui était le cas sur 116 opérations sur 119.
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'referentiels', version: '1' })
export class ReferentielsController {
  constructor(private readonly referentiels: ReferentielsService) {}

  @Get()
  @ApiOperation({
    operationId: 'getReferentiels',
    summary: 'Tous les référentiels en un appel (amorçage du mobile).',
  })
  @ApiResponse({ status: 200, type: ReferentielsBundleDto })
  bundle(@Query() query: ReferentielQueryDto): Promise<ReferentielsBundleDto> {
    return this.referentiels.bundle(query);
  }

  @Get('banques')
  @ApiOperation({ operationId: 'listBanques', summary: 'Liste des banques.' })
  @ApiResponse({ status: 200, type: [BanqueDto] })
  listBanques(@Query() query: ReferentielQueryDto): Promise<BanqueDto[]> {
    return this.referentiels.listBanques(query);
  }

  @Get('syndicats')
  @ApiOperation({ operationId: 'listSyndicats', summary: 'Liste des syndicats.' })
  @ApiResponse({ status: 200, type: [SyndicatDto] })
  listSyndicats(@Query() query: ReferentielQueryDto): Promise<SyndicatDto[]> {
    return this.referentiels.listSyndicats(query);
  }

  @Get('departements')
  @ApiOperation({ operationId: 'listDepartements', summary: 'Liste des départements.' })
  @ApiResponse({ status: 200, type: [DepartementDto] })
  listDepartements(@Query() query: ReferentielQueryDto): Promise<DepartementDto[]> {
    return this.referentiels.listDepartements(query);
  }

  @Get('iefs')
  @ApiOperation({
    operationId: 'listIefs',
    summary: 'Liste des IEF, éventuellement restreinte à un département.',
    description:
      'L’IEF est le découpage SCOLAIRE, distinct du découpage administratif : ' +
      '59 IEF pour 46 départements. Les feuilles de route sont bâties dessus, ' +
      'et quatre IEF partagent le seul département de Dakar.',
  })
  @ApiQuery({ name: 'departementId', required: false, format: 'uuid' })
  @ApiResponse({ status: 200, type: [IefDto] })
  listIefs(
    @Query() query: ReferentielQueryDto,
    @Query('departementId') departementId?: string,
  ): Promise<IefDto[]> {
    return this.referentiels.listIefs(query, departementId);
  }

  @Get('regions')
  @ApiOperation({ operationId: 'listRegions', summary: 'Liste des régions.' })
  @ApiResponse({ status: 200, type: [RegionDto] })
  listRegions(): Promise<RegionDto[]> {
    return this.referentiels.listRegions();
  }

  @Get('regions/departements')
  @ApiOperation({
    operationId: 'listRegionsWithDepartements',
    summary: 'Régions et leurs départements, pour les sélecteurs en cascade.',
  })
  @ApiResponse({ status: 200, type: [RegionWithDepartementsDto] })
  listRegionsWithDepartements(
    @Query() query: ReferentielQueryDto,
  ): Promise<RegionWithDepartementsDto[]> {
    return this.referentiels.listRegionsWithDepartements(query);
  }

  // ─── Écriture, ADMIN uniquement ───────────────────────────────────────────

  @Roles(Role.ADMIN)
  @Post('banques')
  @ApiOperation({ operationId: 'createBanque', summary: 'Ajoute une banque.' })
  @ApiResponse({ status: 201, type: BanqueDto })
  createBanque(@Body() body: CreateBanqueDto): Promise<BanqueDto> {
    return this.referentiels.createBanque(body);
  }

  @Roles(Role.ADMIN)
  @Patch('banques/:id')
  @ApiOperation({
    operationId: 'updateBanque',
    summary: 'Modifie une banque. La retirer des listes se fait via isActive.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: BanqueDto })
  updateBanque(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBanqueDto,
  ): Promise<BanqueDto> {
    return this.referentiels.updateBanque(id, body);
  }

  @Roles(Role.ADMIN)
  @Post('syndicats')
  @ApiOperation({ operationId: 'createSyndicat', summary: 'Ajoute un syndicat.' })
  @ApiResponse({ status: 201, type: SyndicatDto })
  createSyndicat(@Body() body: CreateSyndicatDto): Promise<SyndicatDto> {
    return this.referentiels.createSyndicat(body);
  }

  @Roles(Role.ADMIN)
  @Patch('syndicats/:id')
  @ApiOperation({ operationId: 'updateSyndicat', summary: 'Modifie un syndicat.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: SyndicatDto })
  updateSyndicat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSyndicatDto,
  ): Promise<SyndicatDto> {
    return this.referentiels.updateSyndicat(id, body);
  }

  @Roles(Role.ADMIN)
  @Post('departements')
  @ApiOperation({ operationId: 'createDepartement', summary: 'Ajoute un département.' })
  @ApiResponse({ status: 201, type: DepartementDto })
  createDepartement(@Body() body: CreateDepartementDto): Promise<DepartementDto> {
    return this.referentiels.createDepartement(body);
  }

  @Roles(Role.ADMIN)
  @Patch('departements/:id')
  @ApiOperation({ operationId: 'updateDepartement', summary: 'Modifie un département.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: DepartementDto })
  updateDepartement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDepartementDto,
  ): Promise<DepartementDto> {
    return this.referentiels.updateDepartement(id, body);
  }
}
