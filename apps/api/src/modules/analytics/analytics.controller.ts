import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Cached } from '../../redis/cache.interceptor.js';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { AnalyticsService } from './analytics.service.js';
import { FunnelService } from './funnel.service.js';
import { PilotageService } from './pilotage.service.js';
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
import { PortfolioService } from './portfolio.service.js';
import { QualityService } from './quality.service.js';
import { AnalyticsDelaysDto } from './pilotage.dto.js';
import { BankAgingDto, DepartementYieldListDto, WeeklyCohortListDto } from './portfolio.dto.js';
import {
  AmbassadorConversionDto,
  DataQualityDto,
  OriginBreakdownDto,
  RepresentantProductivityListDto,
  RepresentantProductivityQueryDto,
} from './quality.dto.js';
import { SegmentConversionsService } from './segment-conversions.service.js';
import { SegmentConversionListDto, SegmentConversionsQueryDto } from './segment-conversions.dto.js';

@ApiTags('analytics')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COMMERCIAL, Role.CHARGE_CLIENTELE, Role.SUPERVISEUR, Role.DIRECTION)
@ApiErrors({ 400: true, 401: true, 403: true })
@Cached(60)
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly funnelService: FunnelService,
    private readonly pilotage: PilotageService,
    private readonly portfolio: PortfolioService,
    private readonly quality: QualityService,
    private readonly segments: SegmentConversionsService,
  ) {}

  @Get('funnel')
  @ApiOperation({
    operationId: 'getAnalyticsFunnel',
    summary: 'Entonnoir complet et montants encaissés.',
    description:
      'Du prospect saisi au dossier encaissé, plus les montants. Le tableau de ' +
      'bord montrait l’effort, prospects, représentants, téléconseillers, mais ' +
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

  @Get('delays')
  @ApiOperation({
    operationId: 'getAnalyticsDelays',
    summary: 'Durées médianes de la chaîne, du prospect à l’encaissement.',
    description:
      'Médiane et neuvième décile, en jours, sur les trois tronçons. Le produit ' +
      'horodate déjà tout : personne ne lisait ces dates, alors qu’elles ' +
      'désignent l’étape qui traîne.',
  })
  @ApiResponse({ status: 200, type: AnalyticsDelaysDto })
  delays(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsDelaysDto> {
    return this.pilotage.delays(user, query);
  }

  // Le domaine bancaire ne regarde pas la direction commerciale.
  @Roles(Role.ADMIN, Role.COMMERCIAL, Role.CHARGE_CLIENTELE, Role.SUPERVISEUR)
  @Get('bank-aging')
  @ApiOperation({
    operationId: 'getBankAging',
    summary: 'Vieillissement des dossiers bancaires, par tranche et par étape.',
    description:
      'Ne compte que les dossiers non supprimés stationnant à une étape NON ' +
      'TERMINALE : un dossier encaissé ou rejeté est sorti du portefeuille et ' +
      'son ancienneté ne se pilote plus.',
  })
  @ApiResponse({ status: 200, type: BankAgingDto })
  bankAging(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<BankAgingDto> {
    return this.portfolio.bankAging(user, query);
  }

  @Get('weekly-cohorts')
  @ApiOperation({
    operationId: 'getWeeklyCohorts',
    summary: 'Cohortes hebdomadaires d’entrée, suivies jusqu’à l’encaissement.',
    description:
      'La seule mesure qui distingue une amélioration réelle d’un effet de ' +
      'volume. La semaine est celle de la saisie terrain, pas de l’arrivée en base.',
  })
  @ApiResponse({ status: 200, type: WeeklyCohortListDto })
  weeklyCohorts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<WeeklyCohortListDto> {
    return this.portfolio.weeklyCohorts(user, query);
  }

  @Get('departement-yield')
  @ApiOperation({
    operationId: 'getDepartementYield',
    summary: 'Rendement par département : taux, et pas seulement volume.',
  })
  @ApiResponse({ status: 200, type: DepartementYieldListDto })
  departementYield(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<DepartementYieldListDto> {
    return this.portfolio.departementYield(user, query);
  }

  @Get('representant-productivity')
  @ApiOperation({
    operationId: 'getRepresentantProductivity',
    summary: 'Productivité des représentants, et repérage des dormants.',
    description:
      'Prospects apportés, taux de conversion, dernier apport. `dormantDays` ' +
      'fixe le silence à partir duquel un représentant est déclaré dormant ' +
      '(90 jours par défaut).',
  })
  @ApiResponse({ status: 200, type: RepresentantProductivityListDto })
  representantProductivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RepresentantProductivityQueryDto,
  ): Promise<RepresentantProductivityListDto> {
    return this.quality.representantProductivity(user, query);
  }

  @Get('ambassador-conversion')
  @ApiOperation({
    operationId: 'getAmbassadorConversion',
    summary: 'Part des représentants travaillés devenus ambassadeurs.',
    description:
      'La période borne la DATE DE LA BASCULE, pas l’arrivée en base : un statut ' +
      'poussé avec trois jours de retard reste compté le jour où il a été décidé. ' +
      'Le dénominateur ne retient que les représentants dont la relation a bougé ' +
      'dans la période ; `untracked` compte, hors période, ceux de l’annuaire sans ' +
      'aucune trace, qui ne sont donc mesurés ni au numérateur ni au dénominateur. ' +
      'Seuls `dateFrom`, `dateTo`, `commercialId`, `departementId` et ' +
      '`representantId` agissent : les autres filtres qualifient un prospect, pas ' +
      'un représentant.',
  })
  @ApiResponse({ status: 200, type: AmbassadorConversionDto })
  ambassadorConversion(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AmbassadorConversionDto> {
    return this.quality.ambassadorConversion(user, query);
  }

  @Get('data-quality')
  @ApiOperation({
    operationId: 'getDataQuality',
    summary: 'Part de numéros injoignables ou erronés, par représentant et par département.',
    description:
      'Se branche sur les issues d’appel UNREACHABLE et WRONG_NUMBER. Les deux ' +
      'listes comptent la même population de tentatives selon deux axes.',
  })
  @ApiResponse({ status: 200, type: DataQualityDto })
  dataQuality(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<DataQualityDto> {
    return this.quality.dataQuality(user, query);
  }

  @Get('segment-conversions')
  @Roles(Role.ADMIN, Role.COMMERCIAL, Role.CHARGE_CLIENTELE, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'getSegmentConversions',
    summary: 'Bascules de segment : sur la période, par segment d’origine, et par auteur.',
    description:
      'Le segment n’étant pas stocké sur le prospect, une conversion ne laisse aucune ' +
      'trace en dehors de `SegmentChange`. Cette opération est donc la seule à pouvoir ' +
      'répondre « combien de BDD3 avons-nous fait basculer ce mois, et par qui ». Les ' +
      'deux décomptes portent sur toute la période filtrée, pas sur la page affichée.',
  })
  @ApiResponse({ status: 200, type: SegmentConversionListDto })
  segmentConversions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SegmentConversionsQueryDto,
  ): Promise<SegmentConversionListDto> {
    return this.segments.conversions(user, query);
  }

  @Get('origin-breakdown')
  @ApiOperation({
    operationId: 'getOriginBreakdown',
    summary: 'Provenance des fiches, avec le détail lisible en second niveau.',
    description:
      'Une provenance absente n’est pas une provenance inconnue : c’est le ' +
      'chemin normal, la saisie terrain.',
  })
  @ApiResponse({ status: 200, type: OriginBreakdownDto })
  originBreakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<OriginBreakdownDto> {
    return this.quality.originBreakdown(user, query);
  }
}
