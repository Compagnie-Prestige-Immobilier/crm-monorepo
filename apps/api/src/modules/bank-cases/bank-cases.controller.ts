import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Role } from '@crm/database';

import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { BankCasesService } from './bank-cases.service.js';
import { BankCaseAnalyticsService } from './bank-cases-analytics.service.js';
import { BankAnalyticsQueryDto, BankCaseAnalyticsDto } from './analytics.dto.js';
import {
  BankCaseDetailDto,
  BankCaseDetailQueryDto,
  BankCaseDto,
  BankCaseListDto,
  BankCaseQueryDto,
  BankRejectionReasonListDto,
  CreateBankCaseCorrectionDto,
  CreateBankCaseDto,
  CreateBankCaseTransitionDto,
  IncludeInactiveQueryDto,
  ProspectSearchListDto,
  ProspectSearchQueryDto,
  UpdateBankCaseDto,
} from './dto.js';

@ApiTags('bank-cases')
@ApiBearerAuth()
@Roles(Role.BANQUE_FINANCE, Role.ADMIN)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'bank-cases', version: '1' })
export class BankCasesController {
  constructor(
    private readonly cases: BankCasesService,
    private readonly analytics: BankCaseAnalyticsService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listBankCases',
    summary: 'Liste filtrée, triée et paginée des dossiers bancaires.',
    description:
      'La recherche libre porte sur la référence, le nom du client et son téléphone. Le filtre est exactement celui des agrégats et de l’export.',
  })
  @ApiResponse({ status: 200, type: BankCaseListDto })
  list(@Query() query: BankCaseQueryDto): Promise<BankCaseListDto> {
    return this.cases.list(query);
  }

  @Post()
  @ApiOperation({
    operationId: 'createBankCase',
    summary: 'Ouvre un dossier sur un prospect enrôlé.',
    description:
      'Le prospect doit être en phase 2 METHOD_OBTAINED. L’identité du client est COPIÉE sur le dossier et n’est plus jamais réécrite : corriger le prospect ensuite ne change pas ce qui a été transmis à la banque.',
  })
  @ApiResponse({ status: 201, type: BankCaseDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'BANK_CASE_REFERENCE_CONFLICT, la référence normalisée est déjà prise.',
  })
  @ApiResponse({
    status: 422,
    type: ApiErrorDto,
    description: 'BANK_CASE_PROSPECT_NOT_ENROLLED, le prospect n’est pas en METHOD_OBTAINED.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateBankCaseDto,
  ): Promise<BankCaseDto> {
    return this.cases.create(user, body);
  }

  @Get('analytics')
  @ApiOperation({
    operationId: 'getBankCaseAnalytics',
    summary: 'Tableau de bord Banque & Finance, avec le filtre de la liste.',
    description:
      'Tout est agrégé en SQL. Les compteurs sont, par construction, ceux de la liste filtrée à l’identique.',
  })
  @ApiResponse({ status: 200, type: BankCaseAnalyticsDto })
  overview(@Query() query: BankAnalyticsQueryDto): Promise<BankCaseAnalyticsDto> {
    return this.analytics.overview(query);
  }

  @Get('prospect-search')
  @ApiOperation({
    operationId: 'searchBankCaseProspects',
    summary: 'Autocomplétion des prospects enrôlés, pour ouvrir un dossier.',
    description:
      'Projection VOLONTAIREMENT étroite : identité, téléphone et banque courante, rien d’autre. Un agent Banque & Finance n’a pas à voir le commercial propriétaire, le syndicat ni le statut de prospection.',
  })
  @ApiResponse({ status: 200, type: ProspectSearchListDto })
  prospectSearch(@Query() query: ProspectSearchQueryDto): Promise<ProspectSearchListDto> {
    return this.cases.prospectSearch(query);
  }

  @Get('rejection-reasons')
  @ApiOperation({
    operationId: 'listBankRejectionReasons',
    summary: 'Référentiel des motifs de rejet.',
  })
  @ApiResponse({ status: 200, type: BankRejectionReasonListDto })
  rejectionReasons(@Query() query: IncludeInactiveQueryDto): Promise<BankRejectionReasonListDto> {
    return this.cases.listRejectionReasons(query.includeInactive ?? false);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getBankCase',
    summary: 'Dossier, étape courante et historique complet.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: BankCaseDetailDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorDto,
    description: 'BANK_CASE_NOT_FOUND, y compris pour un dossier hors du `projet` demandé.',
  })
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: BankCaseDetailQueryDto,
  ): Promise<BankCaseDetailDto> {
    return this.cases.get(id, query.projet);
  }

  @Patch(':id')
  @ApiOperation({
    operationId: 'updateBankCase',
    summary: 'Corrige la référence ou la banque de traitement d’un dossier ouvert.',
    description:
      'Ni l’étape, ni le montant, ni le motif : ceux-là ne changent que par une transition, qui laisse une trace. Refusé sur un dossier terminal.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: BankCaseDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description:
      'BANK_CASE_REV_CONFLICT (le corps porte l’état courant), BANK_CASE_TERMINAL ou BANK_CASE_REFERENCE_CONFLICT.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBankCaseDto,
  ): Promise<BankCaseDto> {
    return this.cases.update(user, id, body);
  }

  @Post(':id/transitions')
  @ApiOperation({
    operationId: 'createBankCaseTransition',
    summary: 'Fait avancer le dossier vers l’étape suivante atteignable.',
    description:
      'L’encaissement exige un montant strictement positif et ne se déclare qu’à la dernière étape ouverte. Le rejet exige un motif ; son montant est forcé à zéro par le serveur. Le motif « AUTRE » exige en plus une précision.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: BankCaseDetailDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'BANK_CASE_REV_CONFLICT, BANK_CASE_TERMINAL ou BANK_STAGE_INACTIVE.',
  })
  @ApiResponse({
    status: 422,
    type: ApiErrorDto,
    description:
      'BANK_STAGE_NOT_NEXT, BANK_STAGE_CASHED_NOT_LAST, BANK_CASE_AMOUNT_REQUIRED, BANK_CASE_REJECTION_REASON_REQUIRED, BANK_CASE_REJECTION_DETAIL_REQUIRED.',
  })
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateBankCaseTransitionDto,
  ): Promise<BankCaseDetailDto> {
    return this.cases.transition(user, id, body);
  }

  @Roles(Role.ADMIN)
  @Post(':id/corrections')
  @ApiOperation({
    operationId: 'createBankCaseCorrection',
    summary: 'Correction administrateur d’un dossier, y compris terminal.',
    description:
      'Contourne l’atteignabilité et le verrou terminal, RIEN d’autre : les règles financières de l’étape visée s’appliquent à l’identique et la justification est obligatoire. La correction s’inscrit dans le même historique append-only, marquée par `correctionReason`.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: BankCaseDetailDto })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: 'Réservé à l’ADMIN.' })
  correct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateBankCaseCorrectionDto,
  ): Promise<BankCaseDetailDto> {
    return this.cases.correct(user, id, body);
  }
}
