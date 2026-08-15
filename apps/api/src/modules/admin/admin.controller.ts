import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Role } from '@crm/database';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PurgeCatalogDto, PurgeRequestDto, PurgeResultDto } from './dto.js';
import { PurgeService } from './purge.service.js';
import { SupervisionDto } from './supervision.dto.js';
import { SupervisionService } from './supervision.service.js';

/**
 * Administration de la plateforme : purge de la base et supervision des
 * comptes.
 *
 * `@Roles(ADMIN)` est posé sur la CLASSE : une route ajoutée sans décorateur
 * reste fermée plutôt que d'être ouverte par oubli. La purge ajoute un second
 * verrou, le premier administrateur, vérifié dans le service, et non ici :
 * un contrôle de garde se contourne en appelant le service d'ailleurs, un
 * contrôle dans le service ne se contourne pas.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
// Toute route de ce contrôleur peut refuser pour ces trois raisons : jeton
// absent ou expiré, rôle insuffisant, et entrée refusée par la validation
// globale (`forbidNonWhitelisted` transforme un paramètre mal orthographié en
// 400). Les déclarer ici évite de les oublier route par route, ce qui était le
// cas sur 116 opérations sur 119.
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly purgeService: PurgeService,
    private readonly supervision: SupervisionService,
  ) {}

  @Get('purge')
  @ApiOperation({
    operationId: 'getPurgeCatalog',
    summary: 'Domaines purgeables, leurs dépendances et le nombre de lignes concernées.',
    description:
      '`allowed` vaut false pour tout administrateur autre que le premier : ' +
      'l’écran masque alors la commande, et POST /admin/purge refuse de son côté.',
  })
  @ApiResponse({ status: 200, type: PurgeCatalogDto })
  catalog(@CurrentUser() user: AuthenticatedUser): Promise<PurgeCatalogDto> {
    return this.purgeService.catalog(user);
  }

  @Post('purge')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'purgeDatabase',
    summary: 'Supprime définitivement les domaines sélectionnés.',
    description:
      'Réservé au premier compte administrateur, qui ressaisit son identifiant ' +
      'de connexion. Transactionnel, enfants avant parents. Le compte appelant ' +
      'n’est jamais supprimé. Journalisé.',
  })
  @ApiResponse({ status: 200, type: PurgeResultDto })
  @ApiResponse({
    status: 401,
    type: ApiErrorDto,
    description: 'Identifiant de confirmation incorrect.',
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorDto,
    description: 'Compte administrateur autre que le premier.',
  })
  purge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PurgeRequestDto,
  ): Promise<PurgeResultDto> {
    return this.purgeService.purge(user, body);
  }

  @Get('supervision')
  @ApiOperation({
    operationId: 'getSupervision',
    summary: 'Téléconseillers et pôle Finances générales, avec présence et dernière activité.',
    description:
      'La présence est déduite des traces existantes : familles de jetons, ' +
      'lots de synchronisation, écritures métier. Aucune colonne dédiée.',
  })
  @ApiResponse({ status: 200, type: SupervisionDto })
  supervisionOverview(): Promise<SupervisionDto> {
    return this.supervision.overview();
  }
}
