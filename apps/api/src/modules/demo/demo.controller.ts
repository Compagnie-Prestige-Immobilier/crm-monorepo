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

/**
 * Mode démonstration. Les BASCULES sont réservées à l'ADMIN, la LECTURE ne
 * l'est pas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI LA LECTURE EST OUVERTE À TOUS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le bandeau « Mode démonstration actif » existe pour empêcher qu'un classeur
 * mêlant des lignes fictives à des lignes réelles soit pris pour un chiffre de
 * production. Or le rôle le plus exposé à cette confusion n'est pas l'ADMIN :
 * c'est BANQUE_FINANCE, qui a l'export des dossiers dans son menu.
 *
 * Tant que cette route restait fermée à ce rôle, sa requête d'état échouait en
 * 403, le panneau retombait sur « pas de bandeau », et l'agent bancaire
 * exportait des chiffres fictifs sans le moindre avertissement à l'écran : très
 * exactement le scénario contre lequel le bandeau a été écrit.
 *
 * La réponse ne porte que des compteurs et un booléen de bascule, rien qu'un
 * utilisateur authentifié ne puisse déjà déduire de ses propres écrans. Les
 * trois routes qui ÉCRIVENT gardent chacune leur `@Roles(ADMIN)`.
 */
@ApiTags('demo')
@ApiBearerAuth()
// Toute route de ce contrôleur peut refuser pour ces trois raisons : jeton
// absent ou expiré, rôle insuffisant, et entrée refusée par la validation
// globale (`forbidNonWhitelisted` transforme un paramètre mal orthographié en
// 400). Les déclarer ici évite de les oublier route par route, ce qui était le
// cas sur 116 opérations sur 119.
@ApiErrors({ 400: true, 401: true, 403: true })
// LE PIÈGE, ET IL EST MORTEL : `DemoReadOnlyGuard` refuse toute requête mutante
// tant que le mode est allumé. Sans cette dispense, `POST /disable` serait
// refusé par le mode qu'il sert précisément à éteindre, et la plateforme
// resterait en lecture seule POUR TOUJOURS, sans autre issue qu'un UPDATE
// manuel sur `app_settings` en production.
//
// La dispense est posée sur la CLASSE et non sur `disable` seul : `purge` doit
// pouvoir reprendre les lignes fictives sans qu'on ait à éteindre d'abord, et
// `enable` doit rester idempotent, un second appel pendant que le mode est
// allumé étant le geste le plus banal de l'écran. Les trois restent réservées
// à l'ADMIN par `@Roles`, qui s'applique avant.
@DemoWritable('sans quoi le mode démonstration ne pourrait plus être éteint')
@Controller({ path: 'admin/demo', version: '1' })
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  // OUVERT AUX TROIS RÔLES, ET ÉCRIT COMME TEL : chaque client interroge cet
  // interrupteur pour afficher son bandeau « démonstration en cours ». Le
  // fermer ferait disparaître le bandeau chez les rôles qui ont justement
  // besoin de savoir que ce qu'ils voient est fictif. Les trois routes qui
  // BASCULENT l'interrupteur portent chacune `@Roles(ADMIN)`, et la décision
  // est là.
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
