import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Phase2Status,
  Prisma,
  ScheduledCallbackStatus,
  WhatsappStatus,
  type EnrollmentMethod,
  type Projet,
} from '@crm/database';

import { attributionScope } from '../../common/scope.js';
import { rattacherDetections } from '../../common/device-call.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { normalizePhone } from '../../common/phone.js';
import { normaliserReponses } from '../champs-conversion/catalogue.js';
import { whatsappDuProspect } from '../prospects/whatsapp.js';
import {
  assertConversionChues,
  normalizeAttempt,
  systemReasonFor,
  type AttemptReason,
} from './attempt-rules.js';
import {
  CallAttemptApplyStatus,
  type CallAttemptOpDto,
  type CallAttemptResultDto,
  type ProspectPhase2StateDto,
} from './dto.js';

export type Phase2TransactionClient = Prisma.TransactionClient;

interface ProspectState {
  id: string;
  projet: Projet;
  rev: number;
  updatedAt: Date;
  lastCallAt: Date | null;
  incomeBandId: string | null;
  phoneE164: string;
  whatsappStatus: WhatsappStatus;
  whatsappE164: string | null;
  champsLibres: Prisma.JsonValue;
}

/** L'état de phase 2 vit sur le PARCOURS ; la fiche ne porte plus que sa révision. */
interface JourneyState {
  id: string;
  phase2Status: Phase2Status;
  enrollmentMethod: EnrollmentMethod | null;
  enrollmentCapturedById: string | null;
  enrollmentCapturedAt: Date | null;
}

const PROSPECT_STATE_SELECT = {
  id: true,
  projet: true,
  rev: true,
  updatedAt: true,
  lastCallAt: true,
  incomeBandId: true,
  phoneE164: true,
  whatsappStatus: true,
  whatsappE164: true,
  champsLibres: true,
} satisfies Prisma.ProspectSelect;

const JOURNEY_STATE_SELECT = {
  id: true,
  phase2Status: true,
  enrollmentMethod: true,
  enrollmentCapturedById: true,
  enrollmentCapturedAt: true,
} satisfies Prisma.ProspectJourneySelect;

const toState = (row: ProspectState, journey: JourneyState): ProspectPhase2StateDto => ({
  prospectId: row.id,
  phase2Status: journey.phase2Status,
  enrollmentMethod: journey.enrollmentMethod,
  rev: row.rev,
  updatedAt: row.updatedAt.toISOString(),
  capturedById: journey.enrollmentCapturedById,
  capturedAt: journey.enrollmentCapturedAt?.toISOString() ?? null,
});

const REASON_SELECT = {
  id: true,
  code: true,
  label: true,
  effect: true,
  requiresComment: true,
  requiresCallback: true,
  isActive: true,
} satisfies Prisma.CallOutcomeReasonSelect;

const PHASE2_REASON_UNKNOWN = 'PHASE2_REASON_UNKNOWN';
const PHASE2_REASON_INACTIVE = 'PHASE2_REASON_INACTIVE';
const PHASE2_REASON_OUTCOME_MISMATCH = 'PHASE2_REASON_OUTCOME_MISMATCH';

const notAssigned = (): ForbiddenException =>
  new ForbiddenException({
    code: 'PHASE2_NOT_ASSIGNED',
    message: 'Ce prospect n’est pas dans vos campagnes.',
  });

const alreadyCompleted = (state: ProspectPhase2StateDto): ConflictException =>
  new ConflictException({
    code: 'PHASE2_ALREADY_COMPLETED',
    message:
      'Ce prospect a déjà été traité par un autre appel. Votre saisie est conservée localement comme conflit ; seul un administrateur peut corriger le dossier.',
    state,
  });

// Une tentative arrivée hors ligne peut être plus ancienne que le dernier appel
// connu : elle ne réécrit pas la fiche.
function dernierAppel(op: CallAttemptOpDto, userId: string, lastCallAt: Date | null) {
  const at = new Date(op.clientCreatedAt);
  if (lastCallAt !== null && at < lastCallAt) return {};
  return { lastCallOutcome: op.outcome, lastCallAt: at, lastCallById: userId };
}

function callAttemptRow(
  op: CallAttemptOpDto,
  performedById: string,
  attempt: ReturnType<typeof normalizeAttempt>,
  deviceCallAt: Date | null,
) {
  return {
    id: op.id,
    prospectId: op.prospectId,
    performedById,
    outcome: attempt.outcome,
    reasonId: attempt.reasonId,
    method: attempt.method,
    comment: attempt.comment,
    email: attempt.email,
    fonctionnaire: attempt.fonctionnaire,
    engagementEnCours: attempt.engagementEnCours,
    dureeEtablissementMois: attempt.dureeEtablissementMois,
    rendezVousAt: attempt.rendezVousAt,
    deviceCallType: op.deviceCallType ?? null,
    deviceCallDurationSeconds: op.deviceCallDurationSeconds ?? null,
    deviceCallAt,
    clientCreatedAt: new Date(op.clientCreatedAt),
  };
}

// `Partial<T>` seul ne suffit pas : sous `exactOptionalPropertyTypes`, une
// clé `profession?: string | undefined` reste distincte de `profession?:
// string`, alors que les deux décrivent la même absence pour Prisma. Le
// mapped type retire `undefined` du type de chaque valeur en plus de rendre
// la clé optionnelle. Voir `defined` dans prospects.service.ts.
function defined<T extends Record<string, unknown>>(
  values: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

const trimOrUndefined = (value: string | undefined): string | undefined => value?.trim();

/** Un nom vidé n'est pas une correction : la colonne est obligatoire. */
const nomCorrige = (value: string | undefined): string | undefined => {
  const trimmed = trimOrUndefined(value);
  return trimmed ? trimmed : undefined;
};

const normalizePhoneOrUndefined = (value: string | undefined): string | undefined =>
  value === undefined ? undefined : normalizePhone(value);

@Injectable()
export class Phase2SyncService {
  async applyCallAttempt(
    tx: Phase2TransactionClient,
    user: Pick<AuthenticatedUser, 'id' | 'role'>,
    op: CallAttemptOpDto,
    payloadVersion: number,
  ): Promise<CallAttemptResultDto> {
    const attempt = normalizeAttempt(op, await this.resolveReason(tx, op));

    const known = await tx.callAttempt.findUnique({
      where: { id: op.id },
      select: { id: true },
    });

    // Le rejeu n'est PAS revérifié : une réattribution ne doit pas condamner la
    // file d'un téléphone qui redemande le verdict d'une tentative déjà admise.
    if (known) {
      return this.duplicateResult(tx, op, known.id);
    }

    const prospect = await this.loadProspect(tx, op.prospectId);
    await this.assertAssigned(tx, user, op.prospectId);
    const projet = op.projet ?? prospect.projet;
    const journey = await this.loadJourney(tx, op.prospectId, projet);
    if (journey.phase2Status !== Phase2Status.PENDING) {
      throw alreadyCompleted(toState(prospect, journey));
    }

    assertConversionChues({
      payloadVersion,
      projet,
      method: attempt.method,
      incomeBandId: op.incomeBandId ?? prospect.incomeBandId ?? null,
      dureeEtablissementMois: attempt.dureeEtablissementMois,
    });

    const deviceCallAt = op.deviceCallAt ? new Date(op.deviceCallAt) : null;
    const inserted = await tx.callAttempt.createMany({
      data: [callAttemptRow(op, user.id, attempt, deviceCallAt)],
      skipDuplicates: true,
    });

    if (inserted.count === 0) {
      return this.duplicateResult(tx, op, op.id, projet);
    }

    await rattacherDetections(tx, {
      performedById: user.id,
      prospectId: op.prospectId,
      attemptId: op.id,
      clientCreatedAt: new Date(op.clientCreatedAt),
      deviceCallAt,
    });

    const corrige = await this.correctProspect(tx, user.id, op, prospect);
    await this.scheduleCallback(tx, user.id, op, attempt);

    if (!attempt.terminal || attempt.phase2Status === null) {
      return {
        status: CallAttemptApplyStatus.APPLIED,
        attemptId: op.id,
        state: toState(corrige, journey),
      };
    }

    return this.completeAttempt(tx, user.id, op, attempt, corrige, journey, projet);
  }

  private async duplicateResult(
    tx: Phase2TransactionClient,
    op: CallAttemptOpDto,
    attemptId: string,
    projet?: Projet,
  ): Promise<CallAttemptResultDto> {
    const current = await this.loadProspect(tx, op.prospectId);
    const journey = await this.loadJourney(tx, op.prospectId, projet ?? current.projet);
    return {
      status: CallAttemptApplyStatus.DUPLICATE,
      attemptId,
      state: toState(current, journey),
    };
  }

  /**
   * Le formulaire de conversion rouvre l'identité du prospect. Ces champs-là
   * n'ont PAS de copie sur la tentative : la fiche en reste la seule vérité, et
   * c'est elle qu'on réécrit.
   *
   * Un champ absent laisse la valeur en place. Aucun effacement : le mobile omet
   * ce qu'il n'a pas, et interpréter ce silence comme un vidage effacerait des
   * banques et des syndicats déjà obtenus.
   */
  private async correctProspect(
    tx: Phase2TransactionClient,
    userId: string,
    op: CallAttemptOpDto,
    current: ProspectState,
  ): Promise<ProspectState> {
    const data = {
      ...defined({
        nom: nomCorrige(op.nom),
        prenom: trimOrUndefined(op.prenom),
        profession: trimOrUndefined(op.profession),
        etablissement: trimOrUndefined(op.etablissement),
        banqueId: op.banqueId,
        syndicatId: op.syndicatId,
        type: op.type,
        incomeBandId: op.incomeBandId,
        paymentMode: op.paymentMode,
        dureeSystemeMois: op.dureeSystemeMois,
      }),
      ...whatsappDuProspect(
        defined({ statut: op.whatsappStatus, numero: normalizePhoneOrUndefined(op.whatsappE164) }),
        current,
      ),
      ...champsLibresPatch(op.champsLibres, current.champsLibres),
    };
    const dernier = dernierAppel(op, userId, current.lastCallAt);
    if (Object.keys(data).length === 0 && Object.keys(dernier).length === 0) return current;

    // Le report du dernier appel ne fait PAS avancer `rev` : c'est la révision
    // que le mobile compare avant d'écrire, et la bousculer à chaque tentative
    // ferait rejeter en conflit la mise à jour suivante de la même fiche.
    const row = await tx.prospect.update({
      where: { id: current.id },
      data: {
        ...data,
        ...dernier,
        ...(Object.keys(data).length === 0 ? {} : { rev: { increment: 1 } }),
      },
      select: PROSPECT_STATE_SELECT,
    });
    return row;
  }

  /**
   * Un téléconseiller n'appelle que ses campagnes. L'encadrement n'est pas borné :
   * `attributionScope` rend alors une clause vide et la lecture est évitée.
   */
  private async assertAssigned(
    tx: Phase2TransactionClient,
    user: Pick<AuthenticatedUser, 'id' | 'role'>,
    prospectId: string,
  ): Promise<void> {
    const portee = attributionScope(user);
    if (!portee.OR) return;
    const mien = await tx.prospect.findFirst({
      where: { id: prospectId, ...portee },
      select: { id: true },
    });
    if (!mien) throw notAssigned();
  }

  private async scheduleCallback(
    tx: Phase2TransactionClient,
    userId: string,
    op: CallAttemptOpDto,
    attempt: ReturnType<typeof normalizeAttempt>,
  ): Promise<void> {
    if (attempt.callbackAt === null) return;
    await tx.scheduledCallback.updateMany({
      where: { prospectId: op.prospectId, status: ScheduledCallbackStatus.PENDING },
      data: { status: ScheduledCallbackStatus.SUPERSEDED },
    });
    await tx.scheduledCallback.createMany({
      data: [
        {
          prospectId: op.prospectId,
          assignedToId: userId,
          scheduledAt: attempt.callbackAt,
          comment: attempt.comment,
          sourceAttemptId: op.id,
        },
      ],
      skipDuplicates: true,
    });
  }

  private async completeAttempt(
    tx: Phase2TransactionClient,
    userId: string,
    op: CallAttemptOpDto,
    attempt: ReturnType<typeof normalizeAttempt>,
    prospect: ProspectState,
    journey: JourneyState,
    projet: Projet,
  ): Promise<CallAttemptResultDto> {
    const completedAt = new Date();
    const nextStatus = attempt.phase2Status as Phase2Status;
    const applied = await tx.prospectJourney.updateMany({
      where: { id: journey.id, phase2Status: Phase2Status.PENDING },
      data: {
        phase2Status: nextStatus,
        enrollmentMethod: attempt.method,
        enrollmentCapturedAt: completedAt,
        enrollmentCapturedById: userId,
      },
    });
    if (applied.count === 0) {
      const current = await this.loadProspect(tx, op.prospectId);
      throw alreadyCompleted(toState(current, await this.loadJourney(tx, op.prospectId, projet)));
    }
    if (projet === prospect.projet) {
      await tx.prospect.updateMany({
        where: { id: op.prospectId },
        data: {
          phase2Status: nextStatus,
          enrollmentMethod: attempt.method,
          enrollmentCapturedAt: completedAt,
          enrollmentCapturedById: userId,
          rev: { increment: 1 },
        },
      });
    }
    await tx.scheduledCallback.updateMany({
      where: { prospectId: op.prospectId, status: ScheduledCallbackStatus.PENDING },
      data: { status: ScheduledCallbackStatus.DONE, closedAttemptId: op.id },
    });
    return {
      status: CallAttemptApplyStatus.APPLIED,
      attemptId: op.id,
      state: toState(
        await this.loadProspect(tx, op.prospectId),
        await this.loadJourney(tx, op.prospectId, projet),
      ),
    };
  }

  /**
   * Un motif système absent de la table ne fait PAS échouer la remontée : la
   * règle compilée reste la référence et la tentative part sans `reasonId`.
   * Refuser ici condamnerait la file d'un téléphone hors ligne, définitivement.
   */
  private async resolveReason(
    tx: Phase2TransactionClient,
    op: CallAttemptOpDto,
  ): Promise<AttemptReason> {
    const claimed = op.reasonCode?.trim().toUpperCase() ?? '';
    const code = claimed === '' ? op.outcome : claimed;

    const row = await tx.callOutcomeReason.findUnique({ where: { code }, select: REASON_SELECT });

    if (row === null) {
      if (claimed === '') return systemReasonFor(op.outcome);
      throw new BadRequestException({
        code: PHASE2_REASON_UNKNOWN,
        message: `Motif d’issue inconnu : ${code}.`,
      });
    }

    if (claimed !== '') {
      if (!row.isActive) {
        throw new BadRequestException({
          code: PHASE2_REASON_INACTIVE,
          message: `Le motif « ${row.label} » a été retiré du référentiel.`,
        });
      }
      if (row.effect !== systemReasonFor(op.outcome).effect) {
        throw new BadRequestException({
          code: PHASE2_REASON_OUTCOME_MISMATCH,
          message: `Le motif « ${row.label} » ne produit pas l’issue ${op.outcome}.`,
        });
      }
    }

    return {
      id: row.id,
      code: row.code,
      label: row.label,
      effect: row.effect,
      requiresComment: row.requiresComment,
      requiresCallback: row.requiresCallback,
    };
  }

  private async loadProspect(
    tx: Phase2TransactionClient,
    prospectId: string,
  ): Promise<ProspectState> {
    const row = await tx.prospect.findFirst({
      where: { id: prospectId, deletedAt: null },
      select: PROSPECT_STATE_SELECT,
    });

    if (!row) {
      throw new NotFoundException({
        code: 'PHASE2_PROSPECT_NOT_FOUND',
        message: 'Prospect introuvable ou supprimé.',
      });
    }
    return row;
  }

  /**
   * Le parcours est ouvert à la volée s'il n'existe pas : une fiche importée
   * sans parcours doit rester appelable, et refuser ici transformerait une
   * lacune de données en échec définitif sur le téléphone.
   */
  private async loadJourney(
    tx: Phase2TransactionClient,
    prospectId: string,
    projet: Projet,
  ): Promise<JourneyState> {
    return tx.prospectJourney.upsert({
      where: { prospectId_projet: { prospectId, projet } },
      create: { prospectId, projet },
      update: {},
      select: JOURNEY_STATE_SELECT,
    });
  }
}

/**
 * Les réponses aux champs ajoutés par l'administrateur, fusionnées : le
 * formulaire d'un projet ne connaît pas les champs de l'autre, et remplacer
 * l'objet entier effacerait les réponses du parcours voisin.
 */
function champsLibresPatch(
  envoyees: Record<string, string> | undefined,
  courantes: Prisma.JsonValue,
): { champsLibres?: Prisma.InputJsonValue } {
  if (envoyees === undefined) return {};
  const reponses = normaliserReponses(envoyees);
  if (reponses === null || Object.keys(reponses).length === 0) return {};
  const deja = normaliserReponses(courantes) ?? {};
  return { champsLibres: { ...deja, ...reponses } };
}
