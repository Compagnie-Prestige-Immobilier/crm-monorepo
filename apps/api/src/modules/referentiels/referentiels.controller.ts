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

import { ANY_AUTHENTICATED, Roles } from '../../common/decorators/roles.decorator.js';
import { Cached } from '../../redis/cache.interceptor.js';
import { ReferentielsService } from './referentiels.service.js';
import {
  BanqueDto,
  CanalProvenanceDto,
  CreateBanqueDto,
  CreateCanalProvenanceDto,
  CreateDepartementDto,
  CreateEmployeurDto,
  CreateIncomeBandDto,
  CreateOfferDto,
  CreateProfessionDto,
  CreateSyndicatDto,
  DepartementDto,
  EmployeurDto,
  IefDto,
  IncomeBandDto,
  OfferDto,
  PaysDto,
  ProfessionDto,
  ReferentielQueryDto,
  ReferentielsBundleDto,
  RegionDto,
  RegionWithDepartementsDto,
  SyndicatDto,
  UpdateBanqueDto,
  UpdateCanalProvenanceDto,
  UpdateDepartementDto,
  UpdateEmployeurDto,
  UpdateIncomeBandDto,
  UpdateOfferDto,
  UpdateProfessionDto,
  UpdateSyndicatDto,
} from './dto.js';

@ApiTags('referentiels')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Cached(60, 'referentiels')
@Controller({ path: 'referentiels', version: '1' })
export class ReferentielsController {
  constructor(private readonly referentiels: ReferentielsService) {}

  @Get()
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({
    operationId: 'getReferentiels',
    summary: 'Tous les référentiels en un appel (amorçage du mobile).',
  })
  @ApiResponse({ status: 200, type: ReferentielsBundleDto })
  bundle(@Query() query: ReferentielQueryDto): Promise<ReferentielsBundleDto> {
    return this.referentiels.bundle(query);
  }

  @Get('banques')
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({ operationId: 'listBanques', summary: 'Liste des banques.' })
  @ApiResponse({ status: 200, type: [BanqueDto] })
  listBanques(@Query() query: ReferentielQueryDto): Promise<BanqueDto[]> {
    return this.referentiels.listBanques(query);
  }

  @Get('syndicats')
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({ operationId: 'listSyndicats', summary: 'Liste des syndicats.' })
  @ApiResponse({ status: 200, type: [SyndicatDto] })
  listSyndicats(@Query() query: ReferentielQueryDto): Promise<SyndicatDto[]> {
    return this.referentiels.listSyndicats(query);
  }

  @Get('canaux-provenance')
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({
    operationId: 'listCanauxProvenance',
    summary: 'Canaux de provenance du Grand Public.',
  })
  @ApiResponse({ status: 200, type: [CanalProvenanceDto] })
  listCanauxProvenance(@Query() query: ReferentielQueryDto): Promise<CanalProvenanceDto[]> {
    return this.referentiels.listCanauxProvenance(query);
  }

  @Get('professions')
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({ operationId: 'listProfessions', summary: 'Liste fermée des professions.' })
  @ApiResponse({ status: 200, type: [ProfessionDto] })
  listProfessions(@Query() query: ReferentielQueryDto): Promise<ProfessionDto[]> {
    return this.referentiels.listProfessions(query);
  }

  @Post('professions')
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'createProfession', summary: 'Ajoute une profession.' })
  @ApiResponse({ status: 201, type: ProfessionDto })
  createProfession(@Body() body: CreateProfessionDto): Promise<ProfessionDto> {
    return this.referentiels.createProfession(body);
  }

  @Patch('professions/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'updateProfession', summary: 'Modifie une profession.' })
  @ApiResponse({ status: 200, type: ProfessionDto })
  updateProfession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProfessionDto,
  ): Promise<ProfessionDto> {
    return this.referentiels.updateProfession(id, body);
  }

  @Get('tranches-revenu')
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({ operationId: 'listIncomeBands', summary: 'Tranches de revenu mensuel.' })
  @ApiResponse({ status: 200, type: [IncomeBandDto] })
  listIncomeBands(@Query() query: ReferentielQueryDto): Promise<IncomeBandDto[]> {
    return this.referentiels.listIncomeBands(query);
  }

  @Post('tranches-revenu')
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'createIncomeBand', summary: 'Ajoute une tranche de revenu.' })
  @ApiResponse({ status: 201, type: IncomeBandDto })
  createIncomeBand(@Body() body: CreateIncomeBandDto): Promise<IncomeBandDto> {
    return this.referentiels.createIncomeBand(body);
  }

  @Patch('tranches-revenu/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'updateIncomeBand', summary: 'Modifie une tranche de revenu.' })
  @ApiResponse({ status: 200, type: IncomeBandDto })
  updateIncomeBand(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateIncomeBandDto,
  ): Promise<IncomeBandDto> {
    return this.referentiels.updateIncomeBand(id, body);
  }

  @Get('employeurs')
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({
    operationId: 'listEmployeurs',
    summary: 'Employeurs : ministères et grandes entreprises.',
  })
  @ApiResponse({ status: 200, type: [EmployeurDto] })
  listEmployeurs(@Query() query: ReferentielQueryDto): Promise<EmployeurDto[]> {
    return this.referentiels.listEmployeurs(query);
  }

  @Post('employeurs')
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'createEmployeur', summary: 'Ajoute un employeur.' })
  @ApiResponse({ status: 201, type: EmployeurDto })
  createEmployeur(@Body() body: CreateEmployeurDto): Promise<EmployeurDto> {
    return this.referentiels.createEmployeur(body);
  }

  @Patch('employeurs/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'updateEmployeur', summary: 'Modifie un employeur.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: EmployeurDto })
  updateEmployeur(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEmployeurDto,
  ): Promise<EmployeurDto> {
    return this.referentiels.updateEmployeur(id, body);
  }

  @Get('pays')
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({ operationId: 'listPays', summary: 'Pays de résidence, avec leur indicatif.' })
  @ApiResponse({ status: 200, type: [PaysDto] })
  listPays(@Query() query: ReferentielQueryDto): Promise<PaysDto[]> {
    return this.referentiels.listPays(query);
  }

  @Get('offres')
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({ operationId: 'listOffers', summary: 'Offres proposées au Grand Public.' })
  @ApiResponse({ status: 200, type: [OfferDto] })
  listOffers(@Query() query: ReferentielQueryDto): Promise<OfferDto[]> {
    return this.referentiels.listOffers(query);
  }

  @Post('offres')
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'createOffer', summary: 'Ajoute une offre.' })
  @ApiResponse({ status: 201, type: OfferDto })
  createOffer(@Body() body: CreateOfferDto): Promise<OfferDto> {
    return this.referentiels.createOffer(body);
  }

  @Patch('offres/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ operationId: 'updateOffer', summary: 'Modifie une offre.' })
  @ApiResponse({ status: 200, type: OfferDto })
  updateOffer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOfferDto,
  ): Promise<OfferDto> {
    return this.referentiels.updateOffer(id, body);
  }

  @Roles(Role.ADMIN)
  @Post('canaux-provenance')
  @ApiOperation({
    operationId: 'createCanalProvenance',
    summary: 'Ajoute un canal. Le code est immuable : les fiches le désignent.',
  })
  @ApiResponse({ status: 201, type: CanalProvenanceDto })
  createCanalProvenance(@Body() body: CreateCanalProvenanceDto): Promise<CanalProvenanceDto> {
    return this.referentiels.createCanalProvenance(body);
  }

  @Roles(Role.ADMIN)
  @Patch('canaux-provenance/:id')
  @ApiOperation({
    operationId: 'updateCanalProvenance',
    summary: 'Renomme un canal, ou le retire des listes via isActive.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CanalProvenanceDto })
  updateCanalProvenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCanalProvenanceDto,
  ): Promise<CanalProvenanceDto> {
    return this.referentiels.updateCanalProvenance(id, body);
  }

  @Get('departements')
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({ operationId: 'listDepartements', summary: 'Liste des départements.' })
  @ApiResponse({ status: 200, type: [DepartementDto] })
  listDepartements(@Query() query: ReferentielQueryDto): Promise<DepartementDto[]> {
    return this.referentiels.listDepartements(query);
  }

  @Get('iefs')
  @Roles(...ANY_AUTHENTICATED)
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
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({ operationId: 'listRegions', summary: 'Liste des régions.' })
  @ApiResponse({ status: 200, type: [RegionDto] })
  listRegions(): Promise<RegionDto[]> {
    return this.referentiels.listRegions();
  }

  @Get('regions/departements')
  @Roles(...ANY_AUTHENTICATED)
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
