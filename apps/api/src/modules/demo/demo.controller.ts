import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { DemoService } from './demo.service.js';
import { DemoStatusDto } from './dto.js';

/**
 * Mode démonstration — réservé à l'ADMIN.
 *
 * Le rôle est posé au niveau de la classe : une route ajoutée sans décorateur
 * reste fermée plutôt que d'être ouverte par oubli.
 */
@ApiTags('demo')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller({ path: 'admin/demo', version: '1' })
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get()
  @ApiOperation({
    operationId: 'getDemoStatus',
    summary: 'État du mode démonstration, compteurs et autorisation de bascule.',
  })
  @ApiResponse({ status: 200, type: DemoStatusDto })
  status(): Promise<DemoStatusDto> {
    return this.demo.status();
  }

  @Post('enable')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'enableDemoMode',
    summary: 'Peuple la plateforme de données de démonstration.',
    description:
      'Idempotent : activer une seconde fois ne double pas le jeu. Refusé en ' +
      'production tant que DEMO_MODE_ALLOWED ne vaut pas true.',
  })
  @ApiResponse({ status: 200, type: DemoStatusDto })
  enable(@CurrentUser() user: AuthenticatedUser): Promise<DemoStatusDto> {
    return this.demo.enable(user.id);
  }

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

  @Post('disable')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'disableDemoMode',
    summary: 'Masque les données de démonstration.',
    description:
      'NE SUPPRIME RIEN. Les lignes de démonstration restent en base, ' +
      'invisibles pour toute lecture, export Excel compris. Pour les effacer ' +
      'définitivement, utiliser /purge.',
  })
  @ApiResponse({ status: 200, type: DemoStatusDto })
  disable(@CurrentUser() user: AuthenticatedUser): Promise<DemoStatusDto> {
    return this.demo.disable(user.id);
  }
}
