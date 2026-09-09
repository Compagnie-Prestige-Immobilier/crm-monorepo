import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
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
import { SyncService } from './sync.service.js';
import { SyncPullQueryDto, SyncPullResponseDto, SyncPushDto, SyncPushResponseDto } from './dto.js';
import { Roles, SYNC_ROLES } from '../../common/decorators/roles.decorator.js';
import { HeartbeatService } from '../heartbeat/heartbeat.service.js';

/** Palier où les liens banque, syndicat et représentant d’un prospect sont devenus nuls. */
const MIN_PULL_PAYLOAD_VERSION = 5;

const UPGRADE_REQUIRED = 426;

@ApiTags('sync')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'sync', version: '1' })
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly heartbeat: HeartbeatService,
  ) {}

  @Post('push')
  @Roles(...SYNC_ROLES)
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
    if (!idempotencyKey) {
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'En-tête Idempotency-Key obligatoire.',
      });
    }
    if (idempotencyKey !== body.clientBatchId) {
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_MISMATCH',
        message: 'L’en-tête Idempotency-Key doit être égal à clientBatchId.',
      });
    }

    try {
      const outcome = await this.sync.push(user, body);
      await this.heartbeat.record(user.id, 'push', body);
      if (outcome.replayed) reply.header('Idempotency-Replayed', 'true');
      return outcome.body;
    } catch (error) {
      if (isInProgress(error)) reply.header('Retry-After', '2');
      throw error;
    }
  }

  @Get('pull')
  @Roles(...SYNC_ROLES)
  @ApiHeader({
    name: 'X-CPI-Payload-Version',
    required: true,
    description:
      'Format de données que le client sait lire. En dessous de ' +
      String(MIN_PULL_PAYLOAD_VERSION) +
      ', le tirage est refusé au lieu d’être servi : les liens banque, syndicat et ' +
      'représentant d’un prospect peuvent être nuls, et un client plus ancien ' +
      'échoue à les décoder.',
    schema: { type: 'integer', minimum: MIN_PULL_PAYLOAD_VERSION },
  })
  @ApiOperation({
    operationId: 'pullSyncChanges',
    summary: 'Récupère les changements depuis un curseur opaque.',
    description:
      'Pagination keyset sur (updatedAt, id) et retard de sécurité de 2 secondes. Un COMMERCIAL ne reçoit que ses propres prospects ; l’annuaire des représentants et les référentiels sont communs.',
  })
  @ApiResponse({ status: 200, type: SyncPullResponseDto })
  @ApiResponse({
    status: UPGRADE_REQUIRED,
    type: ApiErrorDto,
    description:
      'APP_UPDATE_REQUIRED. Le client n’annonce pas de format, ou en annonce un que ' +
      'cette réponse dépasse. La remontée par `pushSyncBatch` reste ouverte : rien ' +
      'de ce qui est saisi hors ligne n’est perdu pendant que l’appareil se met à jour.',
  })
  async pull(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SyncPullQueryDto,
    @Headers('x-cpi-payload-version') payloadVersion: string | undefined,
  ): Promise<SyncPullResponseDto> {
    // Un APK d’avant ce palier n’envoie rien : l’absence vaut format trop ancien.
    const declared = Number(payloadVersion);
    if (!Number.isInteger(declared) || declared < MIN_PULL_PAYLOAD_VERSION) {
      throw new HttpException(
        {
          code: 'APP_UPDATE_REQUIRED',
          message:
            'Cette version de CPI GO ne sait plus lire les données du serveur. ' +
            'Vos saisies continuent de partir. Installez la mise à jour pour ' +
            'recevoir de nouveau les fiches.',
        },
        UPGRADE_REQUIRED,
      );
    }

    const changes = await this.sync.pull(user, query);
    await this.heartbeat.record(user.id, 'pull', query);
    return changes;
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
