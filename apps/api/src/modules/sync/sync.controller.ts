import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { SyncService } from './sync.service.js';
import { SyncPullQueryDto, SyncPullResponseDto, SyncPushDto, SyncPushResponseDto } from './dto.js';

@ApiTags('sync')
@ApiBearerAuth()
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
  @ApiResponse({ status: 200, type: SyncPushResponseDto })
  @ApiResponse({
    status: 409,
    description: 'IDEMPOTENCY_IN_PROGRESS — un appel concurrent traite déjà cette clé.',
  })
  @ApiResponse({
    status: 422,
    description: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD.',
  })
  async push(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SyncPushDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SyncPushResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'En-tête Idempotency-Key obligatoire.',
      });
    }
    if (idempotencyKey !== body.clientBatchId) {
      // Les laisser diverger ouvrirait deux clés d'idempotence pour un même
      // lot : le rejeu ne retrouverait pas la réponse mémorisée.
      throw new BadRequestException({
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
