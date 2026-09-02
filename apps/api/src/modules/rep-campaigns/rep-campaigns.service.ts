import { Injectable } from '@nestjs/common';
import { ChangeSource, RepCallOutcome } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { normalizePhone } from '../../common/phone.js';
import { attributionScope } from '../../common/scope.js';
import { COMMENT_MAX_LENGTH } from '../phase2/attempt-rules.js';
import { applyRelationChange } from '../representants/relation-change.js';
import { resolveWhatsappPatch, type WhatsappPatch } from '../representants/whatsapp.js';
import { RepresentantsService } from '../representants/representants.service.js';
import type { RepresentantLookupDto } from '../representants/dto.js';
import {
  RepCallAttemptApplyStatus,
  type CreateRepCallAttemptDto,
  type RepCallAttemptResultDto,
} from './dto.js';
import {
  callbackAtRequired,
  commentRequired,
  phoneConflict,
  promisedNotAllowed,
  representantNotAssigned,
  representantNotFound,
} from './errors.js';

@Injectable()
export class RepCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly representants: RepresentantsService,
  ) {}

  async recordAttempt(
    user: AuthenticatedUser,
    body: CreateRepCallAttemptDto,
  ): Promise<RepCallAttemptResultDto> {
    const comment = validatedComment(body);
    const suggested = await this.resolveSuggested(body.suggestedPhone);
    const existing = await this.prisma.repCallAttempt.findUnique({
      where: { id: body.id },
      select: { id: true },
    });
    if (existing) return attemptResult(RepCallAttemptApplyStatus.DUPLICATE, existing.id, suggested);

    const representant = await this.prisma.representant.findFirst({
      where: { id: body.representantId, deletedAt: null, ...attributionScope(user) },
      select: {
        id: true,
        relationStatus: true,
        whatsappStatus: true,
        whatsappE164: true,
        phoneE164: true,
        lastCallAt: true,
      },
    });
    if (!representant) throw await this.absent(body.representantId);
    const whatsapp = resolveWhatsappPatch(body, representant);
    // Normalisé hors transaction (opération pure) ; un numéro illisible refuse
    // la tentative entière, comme `suggestedPhone`.
    const newPhone =
      body.numeroConfirme === false && body.phone ? normalizePhone(body.phone) : undefined;

    const applied = await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.repCallAttempt.createMany({
        data: [attemptRow(body, user.id, comment)],
        skipDuplicates: true,
      });
      if (inserted.count === 0) return false;

      if (suggested) {
        await tx.representantSuggestion.create({
          data: {
            sourceRepresentantId: body.representantId,
            suggestedName: body.suggestedName?.trim() || null,
            suggestedPhoneE164: suggested.lookup.phoneE164,
            note: body.suggestedNote?.trim() || null,
            suggestedById: user.id,
            resolvedRepresentantId: suggested.resolvedRepresentantId,
            sourceAttemptId: body.id,
            clientCreatedAt: new Date(body.clientCreatedAt),
          },
        });
      }

      const changesPhone = newPhone !== undefined && newPhone !== representant.phoneE164;
      if (changesPhone) {
        // MÊME garde d'unicité que le module representants : lecture globale sur
        // l'index partiel, jamais une contrainte SQL brute laissée lever.
        const clash = await tx.representant.findFirst({
          where: { phoneE164: newPhone, deletedAt: null, id: { not: body.representantId } },
          select: { createdBy: { select: { fullName: true } } },
        });
        if (clash) throw phoneConflict(clash.createdBy.fullName);
      }

      const state = {
        ...representantPatch(body, whatsapp, changesPhone ? newPhone : undefined),
        ...dernierAppel(body, user.id, representant.lastCallAt),
      };
      if (Object.keys(state).length > 0) {
        await tx.representant.update({
          where: { id: body.representantId },
          data: { ...state, rev: { increment: 1 } },
        });
      }
      if (body.relationStatus !== undefined) {
        await applyRelationChange(tx, {
          representantId: body.representantId,
          fromStatus: representant.relationStatus,
          toStatus: body.relationStatus,
          changedById: user.id,
          source: ChangeSource.MOBILE,
        });
      }
      return true;
    });

    return attemptResult(
      applied ? RepCallAttemptApplyStatus.APPLIED : RepCallAttemptApplyStatus.DUPLICATE,
      body.id,
      suggested,
    );
  }

  /** Seconde lecture, hors périmètre : « pas à vous » ne se confond pas avec « n'existe pas ». */
  private async absent(representantId: string): Promise<Error> {
    const ailleurs = await this.prisma.representant.findFirst({
      where: { id: representantId, deletedAt: null },
      select: { id: true },
    });
    return ailleurs ? representantNotAssigned() : representantNotFound();
  }

  private async resolveSuggested(
    phone: string | undefined,
  ): Promise<{ lookup: RepresentantLookupDto; resolvedRepresentantId: string | null } | null> {
    if (phone === undefined) return null;
    const lookup = await this.representants.lookup(phone);
    const known = await this.prisma.representant.findFirst({
      where: { phoneE164: lookup.phoneE164, deletedAt: null },
      select: { id: true },
    });
    return { lookup, resolvedRepresentantId: known?.id ?? null };
  }
}

function attemptRow(body: CreateRepCallAttemptDto, performedById: string, comment: string | null) {
  return {
    id: body.id,
    representantId: body.representantId,
    performedById,
    outcome: body.outcome,
    promisedProspects: body.promisedProspects ?? null,
    comment,
    callbackAt: body.callbackAt ? new Date(body.callbackAt) : null,
    etablissementConfirme: body.etablissementConfirme ?? null,
    numeroConfirme: body.numeroConfirme ?? null,
    contacte: body.contacte ?? null,
    connaitUES: body.connaitUES ?? null,
    syndicat: body.syndicat?.trim() || null,
    clientCreatedAt: new Date(body.clientCreatedAt),
  };
}

function representantPatch(
  body: CreateRepCallAttemptDto,
  whatsapp: WhatsappPatch,
  newPhone: string | undefined,
) {
  return {
    ...whatsapp,
    ...(body.syndicat !== undefined ? { syndicat: body.syndicat.trim() || null } : {}),
    ...(body.connaitUES !== undefined ? { connaitUES: body.connaitUES } : {}),
    ...(body.contacte !== undefined ? { contacte: body.contacte } : {}),
    ...(body.etablissementConfirme === false && body.etablissement !== undefined
      ? { etablissement: body.etablissement.trim() || null }
      : {}),
    ...(newPhone !== undefined ? { phoneE164: newPhone } : {}),
  };
}

// Une tentative arrivée hors ligne peut être plus ancienne que le dernier appel
// connu : elle ne réécrit pas la fiche.
function dernierAppel(body: CreateRepCallAttemptDto, userId: string, lastCallAt: Date | null) {
  const at = new Date(body.clientCreatedAt);
  if (lastCallAt !== null && at < lastCallAt) return {};
  return {
    lastCallOutcome: body.outcome,
    lastCallAt: at,
    lastCallById: userId,
    nextCallbackAt: body.callbackAt ? new Date(body.callbackAt) : null,
  };
}

function validatedComment(body: CreateRepCallAttemptDto): string | null {
  const comment = body.comment?.trim() || null;
  if (body.outcome === RepCallOutcome.OTHER && comment === null) throw commentRequired();
  if (body.promisedProspects !== undefined && body.outcome !== RepCallOutcome.PROSPECTS_PROMISED)
    throw promisedNotAllowed();
  if (comment !== null && comment.length > COMMENT_MAX_LENGTH) throw commentRequired();
  if (body.outcome === RepCallOutcome.CALLBACK && body.callbackAt === undefined)
    throw callbackAtRequired();
  return comment;
}

function attemptResult(
  status: RepCallAttemptApplyStatus,
  attemptId: string,
  suggested: { lookup: RepresentantLookupDto } | null,
): RepCallAttemptResultDto {
  return { status, attemptId, suggestion: suggested?.lookup ?? null };
}
