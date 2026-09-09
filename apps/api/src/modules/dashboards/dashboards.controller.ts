import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { OkDto } from '../../common/dto/ok.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { DashboardsService } from './dashboards.service.js';
import {
  DASHBOARD_ECRANS,
  DispositionResponseDto,
  UpdateDispositionDto,
  type DashboardEcran,
} from './dto.js';

/** Qui ouvre l'écran sur les montants : la supervision pilote des appels, pas la recette. */
const VOIT_LES_MONTANTS = new Set<Role>([Role.ADMIN, Role.DIRECTION]);

/** Les valeurs admises pour `:ecran`, sous la forme attendue par `ParseEnumPipe`. */
const ECRANS = Object.fromEntries(DASHBOARD_ECRANS.map((ecran) => [ecran, ecran])) as Record<
  DashboardEcran,
  DashboardEcran
>;

/**
 * La composition des écrans de chiffres. Elle ne porte AUCUNE donnée métier :
 * un compte n'y range que son propre écran, et ce qu'il y range ne lui ouvre
 * aucun chiffre qu'il ne lise déjà ailleurs.
 */
@ApiTags('tableaux-de-bord')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.DIRECTION, Role.SUPERVISEUR, Role.ACCUEIL)
@ApiErrors({ 400: true, 401: true, 403: true })
@ApiParam({ name: 'ecran', enum: DASHBOARD_ECRANS, enumName: 'DashboardEcran' })
@Controller({ path: 'tableaux-de-bord/:ecran/disposition', version: '1' })
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get()
  @ApiOperation({
    operationId: 'getDashboardLayout',
    summary: 'La disposition d’un écran : la sienne, sinon celle par défaut, sinon celle d’usine.',
  })
  @ApiResponse({ status: 200, type: DispositionResponseDto })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ecran', new ParseEnumPipe(ECRANS)) ecran: DashboardEcran,
  ): Promise<DispositionResponseDto> {
    return this.dashboards.get(user.id, ecran, VOIT_LES_MONTANTS.has(user.role));
  }

  @Put()
  @ApiOperation({
    operationId: 'putDashboardLayout',
    summary: 'Enregistre sa propre disposition pour cet écran.',
    description:
      'La version de la disposition est fixée par le serveur ; la transmettre est refusé.',
  })
  @ApiResponse({ status: 200, type: DispositionResponseDto })
  put(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ecran', new ParseEnumPipe(ECRANS)) ecran: DashboardEcran,
    @Body() body: UpdateDispositionDto,
  ): Promise<DispositionResponseDto> {
    return this.dashboards.put(user.id, ecran, body);
  }

  @Delete()
  @ApiOperation({
    operationId: 'deleteDashboardLayout',
    summary: 'Efface sa propre disposition ; retombe sur celle par défaut, puis celle d’usine.',
  })
  @ApiResponse({ status: 200, type: OkDto })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ecran', new ParseEnumPipe(ECRANS)) ecran: DashboardEcran,
  ): Promise<OkDto> {
    await this.dashboards.remove(user.id, ecran);
    return { ok: true };
  }

  @Roles(Role.ADMIN)
  @Put('par-defaut')
  @ApiOperation({
    operationId: 'putDashboardDefaultLayout',
    summary: 'Fixe la disposition proposée par défaut à tous les comptes de cet écran.',
    description:
      'La version de la disposition est fixée par le serveur ; la transmettre est refusé.',
  })
  @ApiResponse({ status: 200, type: DispositionResponseDto })
  putDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ecran', new ParseEnumPipe(ECRANS)) ecran: DashboardEcran,
    @Body() body: UpdateDispositionDto,
  ): Promise<DispositionResponseDto> {
    return this.dashboards.putDefault(user.id, ecran, body);
  }
}
