import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CallOutcomeReason } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { NEW_REASON_PAYLOAD_VERSION, outcomeEffectRule } from './call-outcome-rules.js';
import type {
  CallOutcomeReasonDto,
  CallOutcomeReasonListDto,
  CreateCallOutcomeReasonDto,
  SetCallOutcomeReasonActiveDto,
  UpdateCallOutcomeReasonDto,
} from './dto.js';

const CallOutcomeReasonError = {
  NOT_FOUND: 'OUTCOME_REASON_NOT_FOUND',
  CODE_CONFLICT: 'OUTCOME_REASON_CODE_CONFLICT',
  LABEL_CONFLICT: 'OUTCOME_REASON_LABEL_CONFLICT',
  SYSTEM_IMMUTABLE: 'OUTCOME_REASON_SYSTEM_IMMUTABLE',
  CALLBACK_NOT_ALLOWED: 'OUTCOME_REASON_CALLBACK_NOT_ALLOWED',
} as const;

const toDto = (row: CallOutcomeReason): CallOutcomeReasonDto => ({
  id: row.id,
  code: row.code,
  label: row.label,
  effect: row.effect,
  requiresComment: row.requiresComment,
  requiresCallback: row.requiresCallback,
  countsAsReached: row.countsAsReached,
  isActive: row.isActive,
  isSystem: row.isSystem,
  sortOrder: row.sortOrder,
  color: row.color,
  minPayloadVersion: row.minPayloadVersion,
  updatedAt: row.updatedAt.toISOString(),
});

const ORDER = [{ sortOrder: 'asc' as const }, { label: 'asc' as const }];

@Injectable()
export class CallOutcomeReasonsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vocabulaire d'un client TERRAIN. Le filtre de version est la seule barrière
   * qui empêche un téléphone de proposer un code qu'il ne sait pas émettre : sa
   * remontée finirait en `PAYLOAD_SCHEMA_MISMATCH`, un état d'outbox terminal.
   */
  async listForField(payloadVersion: number): Promise<CallOutcomeReasonListDto> {
    const rows = await this.prisma.callOutcomeReason.findMany({
      where: { isActive: true, minPayloadVersion: { lte: payloadVersion } },
      orderBy: ORDER,
    });
    return { items: rows.map(toDto) };
  }

  async listAll(): Promise<CallOutcomeReasonListDto> {
    const rows = await this.prisma.callOutcomeReason.findMany({ orderBy: ORDER });
    return { items: rows.map(toDto) };
  }

  async create(input: CreateCallOutcomeReasonDto): Promise<CallOutcomeReasonDto> {
    const code = input.code.trim().toUpperCase();
    const label = input.label.trim();

    const clash = await this.prisma.callOutcomeReason.findUnique({ where: { code } });
    if (clash) {
      throw new ConflictException({
        code: CallOutcomeReasonError.CODE_CONFLICT,
        message: `Le code « ${code} » est déjà utilisé par le motif « ${clash.label} ».`,
        existingId: clash.id,
      });
    }

    const sameLabel = await this.prisma.callOutcomeReason.findUnique({ where: { label } });
    if (sameLabel) {
      throw new ConflictException({
        code: CallOutcomeReasonError.LABEL_CONFLICT,
        message: `Le libellé « ${label} » est déjà porté par le motif « ${sameLabel.code} ».`,
        existingId: sameLabel.id,
      });
    }

    const requiresCallback = input.requiresCallback ?? false;
    this.assertCallbackAllowed(input.effect, requiresCallback);

    const created = await this.prisma.callOutcomeReason.create({
      data: {
        code,
        label,
        effect: input.effect,
        requiresComment: input.requiresComment ?? false,
        requiresCallback,
        countsAsReached: input.countsAsReached ?? true,
        color: input.color?.trim() ?? null,
        sortOrder: input.sortOrder ?? 100,
        isActive: true,
        isSystem: false,
        minPayloadVersion: NEW_REASON_PAYLOAD_VERSION,
      },
    });
    return toDto(created);
  }

  async update(id: string, input: UpdateCallOutcomeReasonDto): Promise<CallOutcomeReasonDto> {
    const existing = await this.reason(id);

    const rules = {
      requiresComment: input.requiresComment,
      requiresCallback: input.requiresCallback,
      countsAsReached: input.countsAsReached,
    };
    const touchesRules = Object.values(rules).some((value) => value !== undefined);

    if (existing.isSystem && touchesRules) {
      throw new ConflictException({
        code: CallOutcomeReasonError.SYSTEM_IMMUTABLE,
        message: `« ${existing.label} » est un motif système : sa règle est compilée dans l’application de terrain et ne se reconfigure pas ici.`,
        reasonId: existing.id,
      });
    }

    if (input.requiresCallback !== undefined) {
      this.assertCallbackAllowed(existing.effect, input.requiresCallback);
    }

    if (input.label !== undefined) {
      const label = input.label.trim();
      const sameLabel = await this.prisma.callOutcomeReason.findUnique({ where: { label } });
      if (sameLabel && sameLabel.id !== id) {
        throw new ConflictException({
          code: CallOutcomeReasonError.LABEL_CONFLICT,
          message: `Le libellé « ${label} » est déjà porté par le motif « ${sameLabel.code} ».`,
          existingId: sameLabel.id,
        });
      }
    }

    const updated = await this.prisma.callOutcomeReason.update({
      where: { id },
      data: {
        ...(input.label === undefined ? {} : { label: input.label.trim() }),
        ...(input.color === undefined ? {} : { color: input.color.trim() }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(rules.requiresComment === undefined ? {} : { requiresComment: rules.requiresComment }),
        ...(rules.requiresCallback === undefined
          ? {}
          : { requiresCallback: rules.requiresCallback }),
        ...(rules.countsAsReached === undefined ? {} : { countsAsReached: rules.countsAsReached }),
      },
    });
    return toDto(updated);
  }

  async setActive(id: string, input: SetCallOutcomeReasonActiveDto): Promise<CallOutcomeReasonDto> {
    const existing = await this.reason(id);

    if (existing.isSystem) {
      throw new ConflictException({
        code: CallOutcomeReasonError.SYSTEM_IMMUTABLE,
        message: `« ${existing.label} » est un motif système : les téléphones en place le proposent encore, et le retirer mettrait leur saisie en échec.`,
        reasonId: existing.id,
      });
    }

    const updated = await this.prisma.callOutcomeReason.update({
      where: { id },
      data: { isActive: input.isActive },
    });
    return toDto(updated);
  }

  private async reason(id: string): Promise<CallOutcomeReason> {
    const found = await this.prisma.callOutcomeReason.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundException({
        code: CallOutcomeReasonError.NOT_FOUND,
        message: 'Motif d’issue introuvable.',
      });
    }
    return found;
  }

  private assertCallbackAllowed(effect: string, requiresCallback: boolean): void {
    if (!requiresCallback || outcomeEffectRule(effect).acceptsCallbackAt) return;
    throw new ConflictException({
      code: CallOutcomeReasonError.CALLBACK_NOT_ALLOWED,
      message: `Seul l’effet SCHEDULE_CALLBACK planifie un rappel : « ${effect} » ne peut pas en exiger la date.`,
      effect,
    });
  }
}
