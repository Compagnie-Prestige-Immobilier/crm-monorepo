import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { DemoWritable } from '../../common/decorators/demo-writable.decorator.js';
import { SyncService } from './sync.service.js';
import { SyncPullQueryDto, SyncPullResponseDto, SyncPushDto, SyncPushResponseDto } from './dto.js';

@ApiTags('sync')
@ApiBearerAuth()
// Toute route de ce contrôleur peut refuser pour ces trois raisons :
// jeton absent ou expiré, rôle insuffisant, et entrée refusée par la
// validation globale (`forbidNonWhitelisted` transforme un paramètre mal
// orthographié en 400). Les déclarer ici évite de les oublier route par
// route, ce qui était le cas sur 116 opérations sur 119.
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'sync', version: '1' })
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /**
   * Répond 200 pour TOUT lot bien formé.
   *
   * Le sort de chaque opération vit dans le corps, jamais dans le code HTTP :
   * un 207 ou un 400 forcerait le client à deviner lesquelles des 200
   * opérations ont abouti, alors qu'il a besoin du verdict de chacune pour
   * savoir quoi purger de sa file locale et quoi représenter.
   *
   * Les seuls codes non-200 concernent le LOT lui-même : clé d'idempotence
   * rejouée avec un autre contenu (422) ou traitement déjà en cours (409).
   */
  // L'EXEMPTION ABSOLUE. La file hors ligne d'un commercial contient des
  // saisies faites des heures plus tôt, dans un village sans réseau. La
  // refuser parce qu'un administrateur a basculé un interrupteur au bureau
  // ferait compter huit tentatives à des opérations parfaitement valides, qui
  // remonteraient ensuite dans « À corriger » : le commercial verrait sa
  // journée marquée en échec pour une démonstration à laquelle il n'a pas
  // assisté.
  //
  // Conséquence assumée et voulue : tout ce qui arrive par ici est du travail
  // RÉEL, y compris pendant une démonstration. Les lignes créées sont donc
  // écrites `isDemo: false`, ce que fait `SyncService` en ne posant pas la
  // colonne (défaut `false` au schéma), sans jamais consulter l'interrupteur.
  //
  // Le PULL n'a pas besoin de dispense : c'est un GET, la garde ne le regarde
  // pas. Idem pour l'annuaire de phase 2 et la recherche de représentant. La
  // tentative d'appel de phase 2 n'a PAS de route propre, elle n'arrive que
  // par ce lot : la dispenser ici la couvre entièrement.
  @DemoWritable('la remontée hors ligne ne doit JAMAIS être refusée')
  @Post('push')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Doit valoir exactement clientBatchId.',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOperation({
    operationId: 'pushSyncBatch',
    summary: 'Envoie un lot d’opérations hors ligne.',
  })
  @ApiResponse({
    status: 200,
    type: SyncPushResponseDto,
    headers: {
      // Posé par la route mais absent du contrat jusqu'ici : le client ne
      // pouvait donc pas distinguer un lot RÉELLEMENT traité d'un rejeu servi
      // depuis le cache d'idempotence, alors que c'est exactement ce qui lui
      // dit s'il doit recompter ses statistiques locales.
      'Idempotency-Replayed': {
        description:
          'Vaut `true` quand la réponse vient du cache d’idempotence et qu’aucune ' +
          'écriture n’a été refaite. Absent sinon.',
        schema: { type: 'string', enum: ['true'] },
      },
    },
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'IDEMPOTENCY_IN_PROGRESS, un appel concurrent traite déjà cette clé.',
    headers: {
      'Retry-After': {
        description:
          'Délai en secondes avant de rejouer le lot. Posé pour que le client ' +
          'attende au lieu de marteler la route.',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 422,
    type: ApiErrorDto,
    description:
      'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD · IDEMPOTENCY_KEY_REQUIRED · ' +
      'IDEMPOTENCY_KEY_MISMATCH. Le lot est bien formé, c’est sa clé d’idempotence ' +
      'qui est inutilisable.',
  })
  async push(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SyncPushDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SyncPushResponseDto> {
    // 422 et non 400, pour DEUX raisons.
    //
    // La première est sémantique : le lot est syntaxiquement irréprochable,
    // c'est la relation entre un en-tête et un champ du corps qui ne tient
    // pas. La route refusait déjà en 422 la troisième faute de la même
    // famille (`IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`), si bien que
    // deux fautes voisines sortaient sous deux statuts.
    //
    // La seconde est qu'aucun de ces deux 400 n'était déclaré dans le contrat,
    // alors que le client mobile documente 422 à deux endroits. Le serveur
    // rejoint donc ce que le client attendait déjà.
    if (!idempotencyKey) {
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'En-tête Idempotency-Key obligatoire.',
      });
    }
    if (idempotencyKey !== body.clientBatchId) {
      // Les laisser diverger ouvrirait deux clés d'idempotence pour un même
      // lot : le rejeu ne retrouverait pas la réponse mémorisée.
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_MISMATCH',
        message: 'L’en-tête Idempotency-Key doit être égal à clientBatchId.',
      });
    }

    try {
      const outcome = await this.sync.push(user, body);
      if (outcome.replayed) reply.header('Idempotency-Replayed', 'true');
      return outcome.body;
    } catch (error) {
      // Un traitement concurrent : on indique au client quand revenir plutôt
      // que de le laisser marteler l'endpoint.
      if (isInProgress(error)) reply.header('Retry-After', '2');
      throw error;
    }
  }

  @Get('pull')
  @ApiOperation({
    operationId: 'pullSyncChanges',
    summary: 'Récupère les changements depuis un curseur opaque.',
    description:
      'Pagination keyset sur (updatedAt, id) et retard de sécurité de 2 secondes. Un COMMERCIAL ne reçoit que ses propres lignes ; les référentiels sont communs.',
  })
  @ApiResponse({ status: 200, type: SyncPullResponseDto })
  pull(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SyncPullQueryDto,
  ): Promise<SyncPullResponseDto> {
    return this.sync.pull(user, query);
  }
}

function isInProgress(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('getResponse' in error)) return false;
  const response = (error as { getResponse: () => unknown }).getResponse();
  return (
    typeof response === 'object' &&
    response !== null &&
    (response as { code?: unknown }).code === 'IDEMPOTENCY_IN_PROGRESS'
  );
}
