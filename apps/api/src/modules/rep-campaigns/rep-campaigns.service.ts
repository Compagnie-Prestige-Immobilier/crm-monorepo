import { Injectable } from '@nestjs/common';
import { ChangeSource, RappelOrigine, RepCallOutcome, RepresentantRelation } from '@crm/database';
import type { Prisma, StatutQualification } from '@crm/database';

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
import {
  FICHE_SELECT,
  ficheSnapshot,
  recordFicheChange,
  type FicheSnapshot,
} from '../representants/fiche-change.js';
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
      select: { ...FICHE_SELECT, id: true, relationStatus: true, lastCallAt: true },
    });
    if (!representant) throw await this.absent(body.representantId);
    const whatsapp = resolveWhatsappPatch(body, representant);
    // Normalisé hors transaction (opération pure) ; un numéro illisible refuse
    // la tentative entière, comme `suggestedPhone`.
    const newPhone = newPhoneFrom(body);
    const changesPhone = newPhone !== undefined && newPhone !== representant.phoneE164;

    // Le statut commande l'issue. Résolu AVANT la transaction : c'est une
    // lecture, et la faire dedans allongerait le verrou pour rien.
    const statut = await this.statutCoherent(body, comment);
    const relation = relationAPoser(body, statut, representant.relationStatus);

    const applied = await this.prisma.$transaction((tx) =>
      this.applyAttempt(tx, {
        user,
        body,
        comment,
        suggested,
        representant,
        whatsapp,
        newPhone: changesPhone ? newPhone : undefined,
        statut,
        relation,
      }),
    );

    return attemptResult(
      applied ? RepCallAttemptApplyStatus.APPLIED : RepCallAttemptApplyStatus.DUPLICATE,
      body.id,
      suggested,
    );
  }

  private async applyAttempt(
    tx: Prisma.TransactionClient,
    ctx: {
      user: AuthenticatedUser;
      body: CreateRepCallAttemptDto;
      comment: string | null;
      suggested: { lookup: RepresentantLookupDto; resolvedRepresentantId: string | null } | null;
      representant: FicheSnapshot & {
        relationStatus: RepresentantRelation;
        lastCallAt: Date | null;
      };
      whatsapp: WhatsappPatch;
      newPhone: string | undefined;
      statut: StatutQualification | null;
      relation: RepresentantRelation | null;
    },
  ): Promise<boolean> {
    const { user, body, comment, suggested, representant, whatsapp, newPhone, statut, relation } =
      ctx;
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

    await this.recordSuggestion(tx, body, user.id, suggested);
    await this.assertPhoneAvailable(tx, body.representantId, newPhone);
    await this.updateRepresentant(tx, body, whatsapp, newPhone, user.id, representant, statut);
    await this.closeOuvertureIfRequested(tx, body, user.id);
    await this.applyRelationIfRequested(tx, body, representant.relationStatus, relation, user.id);
    return true;
  }

  private async recordSuggestion(
    tx: Prisma.TransactionClient,
    body: CreateRepCallAttemptDto,
    performedById: string,
    suggested: { lookup: RepresentantLookupDto; resolvedRepresentantId: string | null } | null,
  ): Promise<void> {
    if (!suggested) return;
    await tx.representantSuggestion.create({
      data: {
        sourceRepresentantId: body.representantId,
        suggestedName: body.suggestedName?.trim() || null,
        suggestedPhoneE164: suggested.lookup.phoneE164,
        note: body.suggestedNote?.trim() || null,
        suggestedById: performedById,
        resolvedRepresentantId: suggested.resolvedRepresentantId,
        sourceAttemptId: body.id,
        clientCreatedAt: new Date(body.clientCreatedAt),
      },
    });
  }

  /** MÊME garde d'unicité que le module representants : lecture globale sur
   * l'index partiel, jamais une contrainte SQL brute laissée lever. */
  private async assertPhoneAvailable(
    tx: Prisma.TransactionClient,
    representantId: string,
    newPhone: string | undefined,
  ): Promise<void> {
    if (newPhone === undefined) return;
    const clash = await tx.representant.findFirst({
      where: { phoneE164: newPhone, deletedAt: null, id: { not: representantId } },
      select: { createdBy: { select: { fullName: true } } },
    });
    if (clash) throw phoneConflict(clash.createdBy.fullName);
  }

  private async updateRepresentant(
    tx: Prisma.TransactionClient,
    body: CreateRepCallAttemptDto,
    whatsapp: WhatsappPatch,
    newPhone: string | undefined,
    performedById: string,
    representant: FicheSnapshot & { lastCallAt: Date | null },
    statut: StatutQualification | null,
  ): Promise<void> {
    const state = {
      ...representantPatch(body, whatsapp, newPhone),
      ...dernierAppel(body, performedById, representant.lastCallAt, statut),
    };
    if (Object.keys(state).length === 0) return;
    const row = await tx.representant.update({
      where: { id: body.representantId },
      data: { ...state, rev: { increment: 1 } },
    });
    await recordFicheChange(tx, {
      representantId: body.representantId,
      userId: performedById,
      source: 'APPEL',
      before: ficheSnapshot(representant),
      after: ficheSnapshot(row),
    });
  }

  private async closeOuvertureIfRequested(
    tx: Prisma.TransactionClient,
    body: CreateRepCallAttemptDto,
    openedById: string,
  ): Promise<void> {
    if (!body.ouvertureId) return;
    await fermerOuverture(tx, {
      ouvertureId: body.ouvertureId,
      openedById,
      attemptId: body.id,
      at: new Date(body.clientCreatedAt),
    });
  }

  private async applyRelationIfRequested(
    tx: Prisma.TransactionClient,
    body: CreateRepCallAttemptDto,
    fromStatus: RepresentantRelation,
    relation: RepresentantRelation | null,
    changedById: string,
  ): Promise<void> {
    if (relation === null) return;
    await applyRelationChange(tx, {
      representantId: body.representantId,
      fromStatus,
      toStatus: relation,
      changedById,
      source: ChangeSource.MOBILE,
    });
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

    assertStatutMatchesAttempt(statut, body, comment);
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

/** Résolu hors transaction (opération pure) ; un numéro illisible refuse la tentative entière. */
function newPhoneFrom(body: CreateRepCallAttemptDto): string | undefined {
  if (body.numeroConfirme !== false || !body.phone) return undefined;
  return normalizePhone(body.phone);
}

function orNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function dateOrNull(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

function trimmedOrNull(value: string | undefined): string | null {
  return value?.trim() || null;
}

function assertStatutMatchesAttempt(
  statut: StatutQualification,
  body: CreateRepCallAttemptDto,
  comment: string | null,
): void {
  const attendue = outcomeOf(statut.effect);
  if (body.outcome !== attendue) throw issueContreditStatut(attendue, body.outcome);

  if (contreditLeRattachement(body.relationStatus, statut.relationStatus)) {
    throw relationContreditStatut(statut.label);
  }

  // `validatedComment` n'exige un commentaire que sur l'issue OTHER, qu'aucun
  // effet ne dérive : la garde du motif est donc atteignable, contrairement à
  // celle de `requiresCallback`, que l'issue CALLBACK couvre déjà.
  if (statut.requiresComment && comment === null) throw motifRequis(statut.label);
}

function relationAPoser(
  body: CreateRepCallAttemptDto,
  statut: StatutQualification | null,
  courante: RepresentantRelation,
): RepresentantRelation | null {
  if (body.relationStatus !== undefined) return body.relationStatus;
  if (statut === null || statut.relationStatus === null) return null;
  const posee = statut.relationStatus;
  return isLegalTransition(REPRESENTANT_RELATION_TRANSITIONS, courante, posee) ? posee : null;
}

function attemptRow(body: CreateRepCallAttemptDto, performedById: string, comment: string | null) {
  return {
    id: body.id,
    representantId: body.representantId,
    performedById,
    outcome: body.outcome,
    promisedProspects: orNull(body.promisedProspects),
    comment,
    callbackAt: dateOrNull(body.callbackAt),
    etablissementConfirme: orNull(body.etablissementConfirme),
    numeroConfirme: orNull(body.numeroConfirme),
    contacte: orNull(body.contacte),
    connaitUES: orNull(body.connaitUES),
    syndicat: trimmedOrNull(body.syndicat),
    statutQualificationId: orNull(body.statutQualificationId),
    deviceCallType: orNull(body.deviceCallType),
    deviceCallDurationSeconds: orNull(body.deviceCallDurationSeconds),
    deviceCallAt: dateOrNull(body.deviceCallAt),
    clientCreatedAt: new Date(body.clientCreatedAt),
  };
}

function syndicatPatch(body: CreateRepCallAttemptDto): Partial<{ syndicat: string | null }> {
  if (body.syndicat === undefined) return {};
  return { syndicat: trimmedOrNull(body.syndicat) };
}

function etablissementPatch(
  body: CreateRepCallAttemptDto,
): Partial<{ etablissement: string | null }> {
  if (body.etablissementConfirme !== false || body.etablissement === undefined) return {};
  return { etablissement: trimmedOrNull(body.etablissement) };
}

function representantPatch(
  body: CreateRepCallAttemptDto,
  whatsapp: WhatsappPatch,
  newPhone: string | undefined,
) {
  return {
    ...whatsapp,
    ...syndicatPatch(body),
    ...(body.connaitUES !== undefined ? { connaitUES: body.connaitUES } : {}),
    ...(body.contacte !== undefined ? { contacte: body.contacte } : {}),
    ...(body.statutQualificationId !== undefined
      ? { statutQualificationId: body.statutQualificationId }
      : {}),
    ...etablissementPatch(body),
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

function assertCommentRules(body: CreateRepCallAttemptDto, comment: string | null): void {
  if (body.outcome === RepCallOutcome.OTHER && comment === null) throw commentRequired();
  if (comment !== null && comment.length > COMMENT_MAX_LENGTH) throw commentRequired();
}

function assertOutcomeRules(body: CreateRepCallAttemptDto): void {
  if (body.promisedProspects !== undefined && body.outcome !== RepCallOutcome.PROSPECTS_PROMISED)
    throw promisedNotAllowed();
  if (body.outcome === RepCallOutcome.CALLBACK && body.callbackAt === undefined)
    throw callbackAtRequired();
}

function validatedComment(body: CreateRepCallAttemptDto): string | null {
  const comment = trimmedOrNull(body.comment);
  assertCommentRules(body, comment);
  assertOutcomeRules(body);
  return comment;
}

function attemptResult(
  status: RepCallAttemptApplyStatus,
  attemptId: string,
  suggested: { lookup: RepresentantLookupDto } | null,
): RepCallAttemptResultDto {
  return { status, attemptId, suggestion: suggested?.lookup ?? null };
}
