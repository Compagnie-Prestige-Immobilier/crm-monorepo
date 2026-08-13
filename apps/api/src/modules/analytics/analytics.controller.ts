import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { AnalyticsService } from './analytics.service.js';
import { FunnelService } from './funnel.service.js';
import { AnalyticsFunnelDto } from './funnel.dto.js';
import {
  AnalyticsQueryDto,
  AnalyticsSeriesDto,
  AnalyticsTotalsDto,
  EnrollmentMethodListDto,
  NamedCountListDto,
  Phase2StatusListDto,
  SegmentListDto,
  TimeSeriesQueryDto,
  TopCommercialListDto,
  TopQueryDto,
  TopRepresentantListDto,
} from './dto.js';

/**
 * Tableau de bord. Tous les endpoints acceptent le filtre de la liste des
 * prospects, et le cloisonnement par commercial s'y applique à l'identique :
 * un COMMERCIAL voit ses propres chiffres, jamais ceux de ses collègues.
 */
@ApiTags('analytics')
@ApiBearerAuth()
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly funnelService: FunnelService,
  ) {}

  @Get('funnel')
  @ApiOperation({
    operationId: 'getAnalyticsFunnel',
    summary: 'Entonnoir complet et montants encaissés.',
    description:
      'Du prospect saisi au dossier encaissé, plus les montants. Le tableau de ' +
      'bord montrait l’effort — prospects, représentants, téléconseillers — mais ' +
      'jamais le résultat. Une direction qui ne voit que le haut de l’entonnoir ' +
      'peut féliciter une équipe qui saisit beaucoup et ne convertit rien.',
  })
  @ApiResponse({ status: 200, type: AnalyticsFunnelDto })
  funnel(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsFunnelDto> {
    return this.funnelService.funnel(user, query);
  }

  @Get('totals')
  @ApiOperation({ operationId: 'getAnalyticsTotals', summary: 'Compteurs de tête.' })
  @ApiResponse({ status: 200, type: AnalyticsTotalsDto })
  totals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsTotalsDto> {
    return this.analytics.totals(user, query);
  }

  @Get('prospects-over-time')
  @ApiOperation({
    operationId: 'getProspectsOverTime',
    summary: 'Série temporelle des saisies, par jour, semaine ou mois.',
  })
  @ApiResponse({ status: 200, type: AnalyticsSeriesDto })
  overTime(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TimeSeriesQueryDto,
  ): Promise<AnalyticsSeriesDto> {
    return this.analytics.overTime(user, query);
  }

  @Get('top-commercials')
  @ApiOperation({ operationId: 'getTopCommercials', summary: 'Classement des commerciaux.' })
  @ApiResponse({ status: 200, type: TopCommercialListDto })
  topCommercials(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TopQueryDto,
  ): Promise<TopCommercialListDto> {
    return this.analytics.topCommerciaux(user, query);
  }

  @Get('by-departement')
  @ApiOperation({
    operationId: 'getProspectsByDepartement',
    summary: 'Répartition par département.',
  })
  @ApiResponse({ status: 200, type: NamedCountListDto })
  byDepartement(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<NamedCountListDto> {
    return this.analytics.byDepartement(user, query);
  }

  @Get('by-banque')
  @ApiOperation({ operationId: 'getProspectsByBanque', summary: 'Répartition par banque.' })
  @ApiResponse({ status: 200, type: NamedCountListDto })
  byBanque(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<NamedCountListDto> {
    return this.analytics.byBanque(user, query);
  }

  @Get('by-syndicat')
  @ApiOperation({ operationId: 'getProspectsBySyndicat', summary: 'Répartition par syndicat.' })
  @ApiResponse({ status: 200, type: NamedCountListDto })
  bySyndicat(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<NamedCountListDto> {
    return this.analytics.bySyndicat(user, query);
  }

  @Get('by-phase2-status')
  @ApiOperation({
    operationId: 'getProspectsByPhase2Status',
    summary: 'Avancement de la phase 2, par statut.',
    description: 'Les quatre statuts sont toujours présents, à zéro s’il le faut.',
  })
  @ApiResponse({ status: 200, type: Phase2StatusListDto })
  byPhase2Status(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<Phase2StatusListDto> {
    return this.analytics.byPhase2Status(user, query);
  }

  @Get('by-enrollment-method')
  @ApiOperation({
    operationId: 'getProspectsByEnrollmentMethod',
    summary: 'Répartition des méthodes d’enrôlement obtenues.',
    description:
      'Ne compte que les prospects porteurs d’une méthode ; `total` est celui de cette sous-population.',
  })
  @ApiResponse({ status: 200, type: EnrollmentMethodListDto })
  byEnrollmentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<EnrollmentMethodListDto> {
    return this.analytics.byEnrollmentMethod(user, query);
  }

  @Get('by-segment')
  @ApiOperation({
    operationId: 'getProspectsBySegment',
    summary: 'Répartition BDD1–BDD4.',
    description:
      'Segment calculé par croisement syndicat × banque, via la définition partagée @crm/database.',
  })
  @ApiResponse({ status: 200, type: SegmentListDto })
  bySegment(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<SegmentListDto> {
    return this.analytics.bySegment(user, query);
  }

  @Get('top-representants')
  @ApiOperation({
    operationId: 'getTopRepresentants',
    summary: 'Représentants ayant apporté le plus de prospects.',
  })
  @ApiResponse({ status: 200, type: TopRepresentantListDto })
  topRepresentants(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TopQueryDto,
  ): Promise<TopRepresentantListDto> {
    return this.analytics.topRepresentants(user, query);
  }
}
