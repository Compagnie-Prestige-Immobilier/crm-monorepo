import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Role } from '@crm/database';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import {
  DEMO_EXEMPTIONS_SENTENCE,
  DemoWritable,
} from '../../common/decorators/demo-writable.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { ANY_AUTHENTICATED, Roles } from '../../common/decorators/roles.decorator.js';
import { DemoService } from './demo.service.js';
import { DemoStatusDto } from './dto.js';

@ApiTags('demo')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
// `DemoReadOnlyGuard` refuse toute requête mutante tant que le mode est allumé : sans cette
// dispense, `POST /disable` serait refusé par le mode qu'il sert à éteindre, et la plateforme
// resterait en lecture seule sans autre issue qu'un UPDATE manuel sur `app_settings`.
@DemoWritable('sans quoi le mode démonstration ne pourrait plus être éteint')
@Controller({ path: 'admin/demo', version: '1' })
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  // Lecture ouverte à tous les rôles : fermée, le bandeau « mode démonstration » ne s'affiche pas
  // chez BANQUE_FINANCE, qui exporte alors des chiffres fictifs sans avertissement. Seules les
  // trois routes qui écrivent restent en `@Roles(ADMIN)`.
  @Get()
  @Roles(...ANY_AUTHENTICATED)
  @ApiOperation({
    operationId: 'getDemoStatus',
    summary: 'État du mode démonstration, compteurs et autorisation de bascule.',
  })
  @ApiResponse({ status: 200, type: DemoStatusDto })
  status(): Promise<DemoStatusDto> {
    return this.demo.status();
  }

  @Roles(Role.ADMIN)
  @Post('enable')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'enableDemoMode',
    summary: 'Peuple la plateforme de données de démonstration.',
    description:
      'Idempotent : activer une seconde fois ne double pas le jeu. Refusé en ' +
      'production tant que DEMO_MODE_ALLOWED ne vaut pas true. ' +
      'CONSÉQUENCE À ANNONCER AVANT LA CONFIRMATION : tant que le mode est actif, ' +
      'la plateforme passe en LECTURE SEULE pour tout le monde. Les écritures ' +
      'interactives (POST, PATCH, PUT, DELETE) sont refusées en 409 ' +
      '`DEMO_MODE_READ_ONLY`. Restent ouvertes, et ce sont les seules : ' +
      `${DEMO_EXEMPTIONS_SENTENCE}.`,
  })
  @ApiResponse({ status: 200, type: DemoStatusDto })
  enable(@CurrentUser() user: AuthenticatedUser): Promise<DemoStatusDto> {
    return this.demo.enable(user.id);
  }

  @Roles(Role.ADMIN)
  @Post('purge')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'purgeDemoData',
    summary: 'Supprime définitivement le jeu de démonstration.',
    description:
      'IRRÉVERSIBLE, et distinct de la désactivation. Supprime exactement les ' +
      'lignes enregistrées à l’ensemencement, dans l’ordre inverse de création. ' +
      'Aucune donnée réelle n’est touchée, quelle que soit sa ressemblance avec ' +
      'une donnée de démonstration. L’interface doit faire confirmer.',
  })
  @ApiResponse({ status: 200, type: DemoStatusDto })
  purge(@CurrentUser() user: AuthenticatedUser): Promise<DemoStatusDto> {
    return this.demo.purge(user.id);
  }

  @Roles(Role.ADMIN)
  @Post('disable')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'disableDemoMode',
    summary: 'Masque les données de démonstration.',
    description:
      'NE SUPPRIME RIEN. Les lignes de démonstration restent en base, ' +
      'invisibles pour toute lecture, export Excel compris. Pour les effacer ' +
      'définitivement, utiliser /purge. ' +
      'REND AUSSI L’ÉCRITURE à toute la plateforme : c’est cette route qui lève la ' +
      'lecture seule posée par /enable.',
  })
  @ApiResponse({ status: 200, type: DemoStatusDto })
  disable(@CurrentUser() user: AuthenticatedUser): Promise<DemoStatusDto> {
    return this.demo.disable(user.id);
  }
}
