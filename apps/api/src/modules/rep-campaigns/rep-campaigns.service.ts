import { Injectable } from '@nestjs/common';
import { ChangeSource, RappelOrigine, RepCallOutcome, RepresentantRelation } from '@crm/database';
import type { StatutQualification } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { outcomeOf } from '../referentiels/statuts-qualification.service.js';
import { type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { normalizePhone } from '../../common/phone.js';
import { attributionScope } from '../../common/scope.js';
import { rattacherDetections } from '../../common/device-call.js';
import { REPRESENTANT_RELATION_TRANSITIONS, isLegalTransition } from '../../common/transitions.js';
import { COMMENT_MAX_LENGTH } from '../phase2/attempt-rules.js';
import { fermerOuverture } from '../ouvertures/ouvertures.service.js';
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
  issueContreditStatut,
  statutInactif,
  statutInconnu,
  commentRequired,
  motifRequis,
  phoneConflict,
  relationContreditStatut,
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

    // Le statut commande l'issue. Résolu AVANT la transaction : c'est une
    // lecture, et la faire dedans allongerait le verrou pour rien.
    const statut = await this.statutCoherent(body, comment);
    const relation = relationAPoser(body, statut, representant.relationStatus);

    const applied = await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.repCallAttempt.createMany({
        data: [attemptRow(body, user.id, comment)],
        skipDuplicates: true,
      });
      if (inserted.count === 0) return false;

      await rattacherDetections(tx, {
        performedById: user.id,
        representantId: body.representantId,
        attemptId: body.id,
        clientCreatedAt: new Date(body.clientCreatedAt),
        deviceCallAt: body.deviceCallAt ? new Date(body.deviceCallAt) : null,
      });

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
        ...dernierAppel(body, user.id, representant.lastCallAt, statut),
      };
      if (Object.keys(state).length > 0) {
        await tx.representant.update({
          where: { id: body.representantId },
          data: { ...state, rev: { increment: 1 } },
        });
      }
      if (body.ouvertureId) {
        await fermerOuverture(tx, {
          ouvertureId: body.ouvertureId,
          openedById: user.id,
          attemptId: body.id,
          at: new Date(body.clientCreatedAt),
        });
      }
      if (relation !== null) {
        await applyRelationChange(tx, {
          representantId: body.representantId,
          fromStatus: representant.relationStatus,
          toStatus: relation,
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

  /**
   * Quand un statut est envoyé, il fait foi : l'issue en découle, et une issue
   * qui la contredit est refusée plutôt qu'enregistrée. Sans statut, l'issue
   * envoyée fait foi, comme le font les versions déjà installées.
   */
  private async statutCoherent(
    body: CreateRepCallAttemptDto,
    comment: string | null,
  ): Promise<StatutQualification | null> {
    if (body.statutQualificationId === undefined) return null;

    const statut = await this.prisma.statutQualification.findUnique({
      where: { id: body.statutQualificationId },
    });
    if (!statut) throw statutInconnu();
    if (!statut.isActive) throw statutInactif(statut.label);

    const attendue = outcomeOf(statut.effect);
    if (body.outcome !== attendue) throw issueContreditStatut(attendue, body.outcome);

    if (contreditLeRattachement(body.relationStatus, statut.relationStatus)) {
      throw relationContreditStatut(statut.label);
    }

    // `validatedComment` n'exige un commentaire que sur l'issue OTHER, qu'aucun
    // effet ne dérive : la garde du motif est donc atteignable, contrairement à
    // celle de `requiresCallback`, que l'issue CALLBACK couvre déjà.
    if (statut.requiresComment && comment === null) throw motifRequis(statut.label);

    return statut;
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

/**
 * Le client garde le dernier mot quand il répond à la question ; le statut
 * comble son silence.
 *
 * Une relation venue du STATUT que la transition refuse est laissée de côté au
 * lieu de lever : la tentative vient du terrain, souvent hors ligne, et un refus
 * la perdrait définitivement. Celle que le client affirme garde la garde
 * stricte de `applyRelationChange` : c'est une contradiction, pas un silence.
 */
/**
 * « Souhaite-t-il être représentant CHUES ? » n'a que deux réponses, et le
 * statut dit la même : oui vaut Accepté, non vaut Refusé. Les autres états de
 * relation ne répondent pas à cette question et gardent la garde de transition
 * d'`applyRelationChange`.
 */
const REPONSES_AU_RATTACHEMENT: readonly RepresentantRelation[] = [
  RepresentantRelation.AMBASSADEUR,
  RepresentantRelation.REFUS,
];

function contreditLeRattachement(
  repondue: RepresentantRelation | undefined,
  posee: RepresentantRelation | null,
): boolean {
  if (repondue === undefined || posee === null) return false;
  if (!REPONSES_AU_RATTACHEMENT.includes(repondue)) return false;
  if (!REPONSES_AU_RATTACHEMENT.includes(posee)) return false;
  return repondue !== posee;
}

function relationAPoser(
  body: CreateRepCallAttemptDto,
  statut: StatutQualification | null,
  courante: RepresentantRelation,
): RepresentantRelation | null {
  if (body.relationStatus !== undefined) return body.relationStatus;
  const posee = statut?.relationStatus ?? null;
  if (posee === null) return null;
  return isLegalTransition(REPRESENTANT_RELATION_TRANSITIONS, courante, posee) ? posee : null;
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
    statutQualificationId: body.statutQualificationId ?? null,
    deviceCallType: body.deviceCallType ?? null,
    deviceCallDurationSeconds: body.deviceCallDurationSeconds ?? null,
    deviceCallAt: body.deviceCallAt ? new Date(body.deviceCallAt) : null,
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
    ...(body.statutQualificationId !== undefined
      ? { statutQualificationId: body.statutQualificationId }
      : {}),
    ...(body.etablissementConfirme === false && body.etablissement !== undefined
      ? { etablissement: body.etablissement.trim() || null }
      : {}),
    ...(newPhone !== undefined ? { phoneE164: newPhone } : {}),
  };
}

// Une tentative arrivée hors ligne peut être plus ancienne que le dernier appel
// connu : elle ne réécrit pas la fiche.
function dernierAppel(
  body: CreateRepCallAttemptDto,
  userId: string,
  lastCallAt: Date | null,
  statut: StatutQualification | null,
) {
  const at = new Date(body.clientCreatedAt);
  if (lastCallAt !== null && at < lastCallAt) return {};
  return {
    lastCallOutcome: body.outcome,
    lastCallAt: at,
    lastCallById: userId,
    ...prochainRappel(body, at, statut),
  };
}

/**
 * L'échéance et son origine s'écrivent ENSEMBLE : une contrainte CHECK refuse
 * l'une sans l'autre.
 *
 * Le délai vient de `retryAfterMinutes`, réglable par l'administrateur, et un
 * délai nul dit « ne revient jamais » : c'est ce qui distingue « Injoignable
 * définitif » sans que son code soit écrit ici. Les statuts joints le portent
 * nul, ils ne repassent donc pas, sauf « À rappeler » qui vient avec sa date.
 *
 * Compté depuis l'horloge du TERRAIN : une qualification faite hors ligne lundi
 * et remontée jeudi est déjà en retard, ce qui est la vérité.
 */
function prochainRappel(
  body: CreateRepCallAttemptDto,
  at: Date,
  statut: StatutQualification | null,
) {
  if (body.callbackAt) {
    return {
      nextCallbackAt: new Date(body.callbackAt),
      nextCallbackOrigine: RappelOrigine.PROMIS,
    };
  }
  const delai = statut?.retryAfterMinutes ?? null;
  if (delai === null) return { nextCallbackAt: null, nextCallbackOrigine: null };
  return {
    nextCallbackAt: new Date(at.getTime() + delai * 60_000),
    nextCallbackOrigine: RappelOrigine.AUTOMATIQUE,
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
