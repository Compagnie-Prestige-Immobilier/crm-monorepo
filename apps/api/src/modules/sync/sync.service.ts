import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ChangeSource,
  GrandPublicConsent,
  OperationResult,
  Prisma,
  Projet,
  type ProspectStatut,
  type Role,
  WhatsappStatus,
} from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { readEnv } from '../../env.js';
import { normalizePhone } from '../../common/phone.js';
import { isAdmin, ownerScope } from '../../common/scope.js';
import { dakarWallClock } from '../../common/date-bounds.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PROSPECT_INCLUDE, toProspectDto } from '../prospects/prospects.service.js';
import { REPRESENTANT_INCLUDE, toRepresentantDto } from '../representants/representants.service.js';
import { resolveWhatsappPatch } from '../representants/whatsapp.js';
import { applyRelationChange } from '../representants/relation-change.js';
import { CallAttemptApplyStatus } from '../phase2/dto.js';
import { Phase2SyncService } from '../phase2/phase2-sync.service.js';
import { VISITE_REGISTRE_ROLES, VisitesService, dakarDate } from '../visites/visites.service.js';
import type { VisiteReferentielKind } from '../visites/dto.js';
import { SyncBatchStore } from './batch-store.js';
import { requestHash } from './request-hash.js';
import {
  advance,
  decodeCursor,
  encodeCursor,
  fromMicros,
  positionOf,
  type StreamPosition,
  type SyncCursor,
} from './cursor.js';
import {
  SyncEntity,
  SyncOp,
  SyncOpStatus,
  dependencyKeyOf,
  type SyncDeletionDto,
  type SyncEntityDataDto,
  type SyncOperationDto,
  type SyncOperationResultDto,
  type SyncPullQueryDto,
  type SyncPullResponseDto,
  type SyncPushDto,
  type SyncPushResponseDto,
  type SyncVisiteDto,
  type SyncVisiteReferentielDto,
} from './dto.js';

/**
 * Retard de sécurité du pull.
 *
 * Une ligne devient visible pour les autres sessions au COMMIT, mais son
 * `updatedAt` a été fixé au début de l'écriture. Une transaction longue peut
 * donc valider une ligne dont l'horodatage est déjà derrière le curseur du
 * client : celui-ci ne la demandera plus jamais. En ne servant que les lignes
 * plus vieilles que deux secondes, on laisse toute écriture en vol le temps de
 * se valider avant d'entrer dans la fenêtre de pagination.
 */
export const PULL_SAFETY_LAG_MS = 2_000;

/** Une transaction de groupe ne doit jamais immobiliser une connexion au-delà. */
const GROUP_TRANSACTION_TIMEOUT_MS = 15_000;

export interface SyncPushOutcome {
  body: SyncPushResponseDto;
  /** Vrai quand la réponse sort du cache d'idempotence, pour l'en-tête dédié. */
  replayed: boolean;
}

interface OperationOutcome {
  status: SyncOpStatus;
  entityId: string | null;
  rev: number | null;
  serverUpdatedAt: string | null;
  errorCode: string | null;
  error: string | null;
}

/** Erreur métier d'une opération : elle ne doit PAS faire échouer sa transaction. */
class OperationError extends Error {
  constructor(
    readonly status: SyncOpStatus,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OperationError';
  }
}

const TO_DB_RESULT: Record<SyncOpStatus, OperationResult> = {
  [SyncOpStatus.APPLIED]: OperationResult.APPLIED,
  [SyncOpStatus.DUPLICATE]: OperationResult.DUPLICATE,
  [SyncOpStatus.CONFLICT]: OperationResult.CONFLICT,
  [SyncOpStatus.INVALID]: OperationResult.INVALID,
  [SyncOpStatus.SKIPPED_DEPENDENCY_FAILED]: OperationResult.SKIPPED_DEPENDENCY_FAILED,
};

/** Convertit le verdict stocké dans le statut rendu lors d'un rejeu. */
const FROM_DB_RESULT: Record<OperationResult, SyncOpStatus> = {
  [OperationResult.APPLIED]: SyncOpStatus.DUPLICATE,
  [OperationResult.DUPLICATE]: SyncOpStatus.DUPLICATE,
  [OperationResult.CONFLICT]: SyncOpStatus.CONFLICT,
  [OperationResult.INVALID]: SyncOpStatus.INVALID,
  [OperationResult.SKIPPED_DEPENDENCY_FAILED]: SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
};

// Voir `defined` dans prospects.service.ts : `Partial<T>` seul ne retire pas
// `undefined` du type de la valeur, ce qu'exige `exactOptionalPropertyTypes`.
function definedValues<T extends Record<string, unknown>>(
  values: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

function clearableValue(
  key: string,
  value: unknown,
  cleared: ReadonlySet<string>,
  empty: unknown,
): Record<string, unknown> {
  if (cleared.has(key)) return { [key]: empty };
  if (value === undefined) return {};
  return { [key]: value };
}

const valueOrNull = <T>(value: T | undefined): T | null => value ?? null;
const textOrEmpty = (value: string | undefined): string => value?.trim() ?? '';

function existingOutcome(
  entityId: string,
  existing: { rev: number; updatedAt: Date } | null,
): OperationOutcome {
  if (existing === null) return applied(entityId, null, null);
  return applied(entityId, existing.rev, existing.updatedAt);
}

/**
 * Lit les anciennes valeurs de base avec prudence : un verdict inconnu ne doit
 * jamais ressembler à un rejeu réussi.
 */
function storedStatusOf(result: string): SyncOpStatus | undefined {
  return (FROM_DB_RESULT as Partial<Record<string, SyncOpStatus>>)[result];
}

function errorCodeOf(error: { getResponse: () => unknown }): string | null {
  const body = error.getResponse();
  if (typeof body === 'object' && body !== null && 'code' in body) {
    const code = body.code;
    if (typeof code === 'string') return code;
  }
  return null;
}

function errorMessageOf(error: { getResponse: () => unknown; message: string }): string {
  const body = error.getResponse();
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = body.message;
    if (typeof message === 'string') return message;
  }
  return error.message;
}

/**
 * Ce qu'un téléphone tire, et ce sur quoi il a le droit d'écrire.
 *
 * `createdById` seul ne suffit pas : les fiches importées par un administrateur
 * lui appartiennent, et une campagne qui les confie à un téléconseiller ne les
 * faisait pas descendre sur son appareil. Le terrain voyait sa propre saisie et
 * jamais la file qu'on lui avait attribuée.
 *
 * `isActive` et non `status` : une tâche retirée de la file ne doit plus rien
 * tirer, mais une tâche déjà traitée reste visible, sinon la fiche disparaît de
 * l'appareil au moment même où le téléconseiller vient de la qualifier.
 */
const assignedTo = (userId: string): Prisma.CallTaskListRelationFilter => ({
  some: { assignedToId: userId, isActive: true },
});

const mineOrAssignedProspect = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): Prisma.ProspectWhereInput =>
  isAdmin(user) ? {} : { OR: [{ createdById: user.id }, { callTasks: assignedTo(user.id) }] };

const mineOrAssignedRepresentant = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): Prisma.RepresentantWhereInput =>
  isAdmin(user)
    ? {}
    : {
        OR: [
          { createdById: user.id },
          { prospects: { some: { callTasks: assignedTo(user.id) } } },
          { repCallTasks: { some: { assignedToId: user.id } } },
        ],
      };

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly batches: SyncBatchStore,
    private readonly phase2Sync: Phase2SyncService,
    private readonly visites: VisitesService,
  ) {}

  // PUSH

  async push(user: AuthenticatedUser, body: SyncPushDto): Promise<SyncPushOutcome> {
    const env = readEnv();
    // L'empreinte ne couvre QUE ce que le lot écrit. Y mêler `pendingOps` ou
    // `appVersion` ferait passer un rejeu légitime, dont la file d'attente a
    // bougé entre-temps, pour un autre contenu : 422 définitif sur cette clé.
    const hash = requestHash({
      clientBatchId: body.clientBatchId,
      payloadVersion: body.payloadVersion,
      operations: body.operations,
    });

    // NIVEAU 1, le lot. Marqueur posé hors de la transaction de travail.
    const claim = await this.batches.claim(
      user.id,
      body.clientBatchId,
      hash,
      env.IDEMPOTENCY_TTL_DAYS,
    );

    if (claim.outcome === 'replay') {
      return { body: claim.response as SyncPushResponseDto, replayed: true };
    }
    if (claim.outcome === 'payload_mismatch') {
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
        message:
          'Cette clé d’idempotence a déjà servi pour un autre contenu. Générez un nouveau clientBatchId.',
      });
    }
    if (claim.outcome === 'in_progress') {
      throw new ConflictException({
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'Ce lot est en cours de traitement. Réessayez dans quelques secondes.',
      });
    }

    let results: SyncOperationResultDto[];
    try {
      results = await this.applyBatch(user, body);
    } catch (error) {
      // Le traitement s'est effondré hors du périmètre d'un groupe : on libère
      // le marqueur pour que le rejeu du client ne se heurte pas 60 secondes à
      // un 409 sur une tentative qui n'a rien écrit.
      await this.batches.release(user.id, body.clientBatchId);
      throw error;
    }

    const response: SyncPushResponseDto = {
      batchId: body.clientBatchId,
      serverTime: new Date().toISOString(),
      results,
      // Volontairement null : voir la description du champ dans le DTO.
      nextCursor: null,
    };

    await this.batches.complete(user.id, body.clientBatchId, 200, response);
    return { body: response, replayed: false };
  }

  /**
   * UNE TRANSACTION PAR GROUPE DE DÉPENDANCE, jamais une par lot ni une par
   * opération.
   *
   * Une transaction par lot : un seul conflit de téléphone à l'opération 3
   * annule les 197 écritures valides, et l'appareil se bloque indéfiniment sur
   * un mauvais numéro. Une transaction par opération : un prospect peut être
   * enregistré alors que la création de son représentant a échoué, et il
   * pointe vers une ligne qui n'existe pas.
   *
   * Le groupe, un représentant et ses prospects, est la plus petite unité
   * qui préserve cette dépendance.
   */
  private async applyBatch(
    user: AuthenticatedUser,
    body: SyncPushDto,
  ): Promise<SyncOperationResultDto[]> {
    const groups = new Map<string, SyncOperationDto[]>();
    for (const operation of body.operations) {
      const key = dependencyKeyOf(operation);
      const bucket = groups.get(key);
      if (bucket) bucket.push(operation);
      else groups.set(key, [operation]);
    }

    const ordered = [...groups.values()]
      .map((operations) => [...operations].sort((left, right) => left.seq - right.seq))
      .sort((left, right) => (left[0]?.seq ?? 0) - (right[0]?.seq ?? 0));

    // Le rôle est figé une fois pour éviter deux autorités dans un même lot.
    const author = await this.readAuthority(user);

    const results: SyncOperationResultDto[] = [];
    for (const operations of ordered) {
      try {
        results.push(...(await this.runGroup(author, body.clientBatchId, operations)));
      } catch (error) {
        // La transaction du groupe a été annulée : AUCUNE de ses opérations
        // n'a été écrite. On le dit franchement et on passe au groupe suivant,
        // qui est indépendant.
        this.logger.error(
          `Groupe de synchronisation annulé (${String(operations.length)} opérations) : ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        for (const operation of operations) {
          results.push(
            toResultDto(operation, {
              status: SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
              entityId: operation.entityId,
              rev: null,
              serverUpdatedAt: null,
              errorCode: 'GROUP_TRANSACTION_FAILED',
              error: 'La transaction du groupe a échoué ; aucune de ses écritures n’a été retenue.',
            }),
          );
        }
      }
    }

    // L'ordre de la réponse suit celui de la requête : le client apparie ses
    // opérations par opId, mais un ordre stable rend les journaux lisibles.
    const bySeq = new Map(results.map((result) => [result.opId, result]));
    return body.operations.map(
      (operation) => bySeq.get(operation.opId) ?? missingResult(operation),
    );
  }

  private async readAuthority(user: AuthenticatedUser): Promise<BatchAuthority> {
    const author = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    return {
      user: author?.role ? { ...user, role: author.role } : user,
    };
  }

  private async runGroup(
    author: BatchAuthority,
    batchKey: string,
    operations: SyncOperationDto[],
  ): Promise<SyncOperationResultDto[]> {
    const { user } = author;
    return this.prisma.$transaction(
      async (tx) => {
        const results: SyncOperationResultDto[] = [];
        // Vrai dès que le représentant du groupe est indisponible : ses
        // prospects ne peuvent alors plus être rattachés à quoi que ce soit.
        let parentUnavailable = false;

        for (const operation of operations) {
          // NIVEAU 2, l'opération. Première instruction, systématiquement.
          // Indispensable : le niveau 1 ne couvre pas le cas où 3 opérations
          // sur 5 passent et où le client reconstitue un lot DIFFÉRENT sous un
          // NOUVEAU batchId, la clé de lot ne reconnaît alors plus rien.
          const stored = await claimOperation(tx, user.id, batchKey, operation);
          if (stored) {
            results.push(stored);
            continue;
          }

          let outcome: OperationOutcome;
          if (parentUnavailable && operation.entity === SyncEntity.PROSPECT) {
            outcome = {
              status: SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
              entityId: operation.entityId,
              rev: null,
              serverUpdatedAt: null,
              errorCode: 'PARENT_REPRESENTANT_FAILED',
              error: 'Le représentant de rattachement n’a pas pu être enregistré.',
            };
          } else {
            outcome = await this.applyOperation(tx, user, operation);
            if (
              operation.entity === SyncEntity.REPRESENTANT &&
              outcome.status !== SyncOpStatus.APPLIED
            ) {
              // Un « déjà présent et à moi » n'est pas une indisponibilité :
              // seule l'absence effective de la ligne condamne ses prospects.
              const exists = await tx.representant.findFirst({
                where: { id: operation.entityId, deletedAt: null, ...ownerScope(user) },
                select: { id: true },
              });
              parentUnavailable = !exists;
            }
          }

          await finalizeOperation(tx, operation.opId, outcome);
          results.push(toResultDto(operation, outcome));
        }

        return results;
      },
      { timeout: GROUP_TRANSACTION_TIMEOUT_MS, isolationLevel: 'ReadCommitted' },
    );
  }

  private async applyOperation(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    operation: SyncOperationDto,
  ): Promise<OperationOutcome> {
    try {
      if (operation.entity === SyncEntity.REPRESENTANT) {
        return await this.applyRepresentant(tx, user, operation);
      }
      if (operation.entity === SyncEntity.REPRESENTANT_COMMENT) {
        return await this.applyRepresentantComment(tx, user, operation);
      }
      if (operation.entity === SyncEntity.CALL_ATTEMPT) {
        // La tentative hérite de SON PROSPECT, que `phase2-sync` lit déjà :
        // rien à transmettre ici.
        return await this.applyCallAttempt(tx, user, operation);
      }
      if (operation.entity === SyncEntity.VISITE) {
        return await this.applyVisite(tx, user, operation);
      }
      return await this.applyProspect(tx, user, operation);
    } catch (error) {
      if (error instanceof OperationError) {
        return {
          status: error.status,
          entityId: operation.entityId,
          rev: null,
          serverUpdatedAt: null,
          errorCode: error.code,
          error: error.message,
        };
      }
      // Tout le reste (panne, interblocage, contrainte inattendue) empoisonne
      // la transaction PostgreSQL : on la laisse remonter pour que le groupe
      // entier soit annulé proprement.
      throw error;
    }
  }

  private async applyRepresentantComment(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    operation: SyncOperationDto,
  ): Promise<OperationOutcome> {
    if (operation.op !== SyncOp.CREATE) {
      throw new OperationError(
        SyncOpStatus.INVALID,
        'OP_NOT_SUPPORTED',
        'Un commentaire ne peut être ni modifié ni supprimé hors ligne.',
      );
    }

    const data = operation.data ?? {};
    requireUuid(data.representantId, 'representantId');
    requireText(data.body, 'body');

    const existing = await tx.representantComment.findUnique({
      where: { id: operation.entityId },
    });
    if (existing) {
      if (existing.representantId !== data.representantId || existing.authorId !== user.id) {
        throw new OperationError(
          SyncOpStatus.CONFLICT,
          'ENTITY_ID_OWNED_BY_ANOTHER_USER',
          'Cet identifiant appartient à un autre commentaire.',
        );
      }
      return applied(existing.id, null, existing.createdAt);
    }

    const representant = await tx.representant.findFirst({
      where: { id: data.representantId, deletedAt: null, ...ownerScope(user) },
    });
    if (!representant) {
      throw new OperationError(
        SyncOpStatus.INVALID,
        'REPRESENTANT_NOT_FOUND',
        'Représentant introuvable.',
      );
    }

    const createdAt = new Date();
    await tx.representantComment.createMany({
      data: [
        {
          id: operation.entityId,
          representantId: data.representantId,
          authorId: user.id,
          body: data.body.trim(),
          clientCreatedAt: clientDate(data.clientCreatedAt, operation.clientUpdatedAt),
          createdAt,
        },
      ],
      skipDuplicates: true,
    });
    return applied(operation.entityId, null, createdAt);
  }

  // ─── Visite ───────────────────────────────────────────────────────────────

  /**
   * Une visite ne se modifie ni ne se supprime hors ligne : l'accueil inscrit,
   * le web corrige. L'idempotence se réduit donc à « déjà là → renvoyer ce qui
   * existe », sans arbitrage de révision.
   */
  private async applyVisite(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    operation: SyncOperationDto,
  ): Promise<OperationOutcome> {
    if (operation.op !== SyncOp.CREATE) {
      throw new OperationError(
        SyncOpStatus.INVALID,
        'OP_NOT_SUPPORTED',
        'Une visite ne peut être ni modifiée ni supprimée hors ligne.',
      );
    }
    if (!(VISITE_REGISTRE_ROLES as readonly Role[]).includes(user.role)) {
      throw new OperationError(
        SyncOpStatus.INVALID,
        'VISITE_ROLE_NOT_ALLOWED',
        'Ce compte ne tient pas le registre des visites.',
      );
    }

    const existing = await tx.visite.findUnique({ where: { id: operation.entityId } });
    if (existing) {
      if (existing.createdById !== user.id) {
        throw new OperationError(
          SyncOpStatus.CONFLICT,
          'ENTITY_ID_OWNED_BY_ANOTHER_USER',
          'Cet identifiant appartient à une autre visite.',
        );
      }
      return applied(existing.id, null, existing.createdAt);
    }

    const data = operation.data ?? {};
    requireText(data.visitorName, 'visitorName');
    requireUuid(data.entrepriseId, 'entrepriseId');
    requireUuid(data.objetId, 'objetId');
    requireText(data.visitDate, 'visitDate');

    try {
      const created = await this.visites.createForSync(
        tx,
        operation.entityId,
        {
          date: data.visitDate,
          visitorName: data.visitorName,
          entrepriseId: data.entrepriseId,
          objetId: data.objetId,
          ...(data.visitTime === undefined ? {} : { time: data.visitTime }),
          ...(data.phone === undefined ? {} : { phone: data.phone }),
          ...(data.directionId === undefined ? {} : { directionId: data.directionId }),
          ...(data.destinataireId === undefined ? {} : { destinataireId: data.destinataireId }),
          ...(data.comment === undefined ? {} : { comment: data.comment }),
        },
        user.id,
      );
      return applied(created.id, null, new Date(created.createdAt));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new OperationError(
          SyncOpStatus.INVALID,
          errorCodeOf(error) ?? 'VISITE_INVALID',
          errorMessageOf(error),
        );
      }
      throw error;
    }
  }

  // ─── Représentant ─────────────────────────────────────────────────────────

  private async applyRepresentant(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    operation: SyncOperationDto,
  ): Promise<OperationOutcome> {
    const existing = await tx.representant.findUnique({ where: { id: operation.entityId } });

    // GARDE ANTI-SQUAT D'IDENTIFIANT. Le client choisit l'UUID : sans ce
    // contrôle, poster l'identifiant d'un collègue écraserait sa fiche.
    await this.assertRepresentantWritable(tx, user, existing);

    if (operation.op === SyncOp.DELETE) {
      if (!existing || existing.deletedAt) {
        // Supprimer ce qui n'existe plus est le résultat voulu.
        return existingOutcome(operation.entityId, existing);
      }
      assertRev(operation, existing.rev);
      const now = new Date();
      await tx.prospect.updateMany({
        where: { representantId: existing.id, deletedAt: null },
        data: { deletedAt: now, rev: { increment: 1 } },
      });
      const row = await tx.representant.update({
        where: { id: existing.id },
        data: { deletedAt: now, rev: { increment: 1 } },
      });
      return applied(row.id, row.rev, row.updatedAt);
    }

    const data = operation.data || {};
    const phoneE164 = requirePhone(data);

    if (!existing || existing.deletedAt) {
      requireText(data.fullName, 'fullName');
      requireUuid(data.departementId, 'departementId');
      await assertRepresentantPhoneFree(tx, phoneE164, operation.entityId);

      // `upsert` et non `create` : la ligne peut exister en supprimé logique
      // (le commercial a effacé la fiche puis la ressaisit). Un `create` se
      // heurterait à la clé primaire.
      const row = await tx.representant.upsert({
        where: { id: operation.entityId },
        create: {
          id: operation.entityId,
          fullName: data.fullName.trim(),
          phoneE164,
          ...definedValues({ notes: data.notes || undefined }),
          // Une fiche neuve part de `NON_DEMANDE`: le resolveur applique la
          // meme regle que le panneau, donc le CHECK ne peut pas etre viole
          // par le chemin hors ligne.
          ...resolveWhatsappPatch(data, {
            whatsappStatus: WhatsappStatus.NON_DEMANDE,
            whatsappE164: null,
          }),
          departementId: data.departementId,
          ...definedValues({ iefId: data.iefId || undefined }),
          createdById: user.id,
          clientCreatedAt: clientDate(data.clientCreatedAt, operation.clientUpdatedAt),
        },
        update: {
          fullName: data.fullName.trim(),
          phoneE164,
          notes: valueOrNull(data.notes),
          departementId: data.departementId,
          ...definedValues({ iefId: data.iefId || undefined }),
          deletedAt: null,
          rev: { increment: 1 },
        },
      });
      // Inscrite au registre pour que la purge sache la reprendre : sans cela
      return applied(row.id, row.rev, row.updatedAt);
    }

    assertRev(operation, existing.rev);
    if (phoneE164 !== existing.phoneE164) {
      await assertRepresentantPhoneFree(tx, phoneE164, operation.entityId);
    }

    // ═══ « ABSENT » VEUT DIRE INCHANGÉ, ET SEULE UNE DEMANDE EXPLICITE VIDE ═══
    //
    // Voir `SyncOperationDto.clearedFields`. Le silence d'une application
    // ancienne, qui ne connaît pas le champ, ne doit pas effacer une IEF
    // renseignée ; mais un utilisateur qui vide le champ doit pouvoir le dire,
    // ce que le client engendré ne savait pas exprimer (`includeIfNull: false`
    // supprimait le `null` avant l'envoi, et le vidage arrivait identique à
    // l'absence).
    const cleared = new Set(operation.clearedFields ?? []);

    const row = await tx.representant.update({
      where: { id: existing.id },
      data: {
        ...definedValues({ fullName: data.fullName?.trim() }),
        phoneE164,
        ...clearableValue('notes', data.notes === '' ? null : data.notes, cleared, null),
        ...resolveWhatsappPatch(this.whatsappInputFor(data, cleared), existing),
        ...definedValues({ departementId: data.departementId || undefined }),
        ...clearableValue('iefId', data.iefId, cleared, null),
        rev: { increment: 1 },
      },
    });
    // Après la mise à jour : la bascule pose sa propre garde sur le statut de
    // départ et incrémente `rev` elle-même. Un statut identique n'écrit rien,
    // sinon une relation stable ressortirait agitée dans sa chronologie.
    if (data.relationStatus) {
      await applyRelationChange(tx, {
        representantId: row.id,
        fromStatus: existing.relationStatus,
        toStatus: data.relationStatus,
        reason: data.relationReason ?? null,
        changedById: user.id,
        source: ChangeSource.MOBILE,
      });
    }
    return applied(row.id, row.rev, row.updatedAt);
  }

  private async assertRepresentantWritable(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    existing: { id: string; createdById: string } | null,
  ): Promise<void> {
    if (existing === null || isAdmin(user) || existing.createdById === user.id) return;
    const assigned = await tx.callTask.findFirst({
      where: {
        assignedToId: user.id,
        isActive: true,
        prospect: { representantId: existing.id },
      },
      select: { id: true },
    });
    if (assigned !== null) return;
    throw new OperationError(
      SyncOpStatus.CONFLICT,
      'ENTITY_ID_OWNED_BY_ANOTHER_USER',
      'Cet identifiant appartient à un autre commercial.',
    );
  }

  /**
   * Un champ VIDE se declare par `clearedFields`, pas par une cle absente: le
   * transport JSON supprime les `null`, donc l'absence et le vidage arrivent
   * identiques. Voir `CLEARABLE_FIELDS`.
   */
  private whatsappInputFor(
    data: SyncEntityDataDto,
    cleared: ReadonlySet<string>,
  ): {
    whatsappStatus?: WhatsappStatus;
    whatsappE164?: string;
    profession?: string;
    prenom?: string;
    etablissement?: string;
  } {
    return {
      ...definedValues({ whatsappStatus: data.whatsappStatus }),
      ...definedValues({
        whatsappE164: cleared.has('whatsappE164') ? undefined : data.whatsappE164,
      }),
      ...clearableValue('profession', data.profession, cleared, ''),
      // `prenom` sert au prospect ailleurs : c'est l'entite de l'operation qui
      // leve l'ambiguite, pas une seconde cle qu'un ancien telephone n'enverrait
      // jamais.
      ...clearableValue('prenom', data.prenom, cleared, ''),
      ...clearableValue('etablissement', data.etablissement, cleared, ''),
    };
  }

  // ─── Tentative d'appel (phase 2) ──────────────────────────────────────────

  /**
   * Adaptateur vers `Phase2SyncService`, seule autorité sur les règles de
   * phase 2. Ce service ne fait que traduire : il valide la forme de
   * l'opération, délègue, puis convertit le résultat ou l'exception en
   * `OperationOutcome`.
   *
   * `tx` est transmis tel quel, la transaction ouverte par le lot est ce qui
   * donne au verrou de ligne PostgreSQL sa portée, et donc ce qui fait tenir la
   * règle « la première transition terminale validée gagne ».
   */
  private async applyCallAttempt(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    operation: SyncOperationDto,
  ): Promise<OperationOutcome> {
    const data = operation.data;
    if (!data?.prospectId || !data.outcome || !data.clientCreatedAt) {
      throw new OperationError(
        SyncOpStatus.INVALID,
        'CALL_ATTEMPT_INCOMPLETE',
        'Une tentative d’appel exige prospectId, outcome et clientCreatedAt.',
      );
    }

    // La tentative n'hérite d'aucune garde : `phase2-sync` LIT le prospect, il
    // ne l'autorise pas. Sans ce contrôle, poster le `prospectId` d'un collègue
    // suffisait à s'attribuer son adhésion et à éteindre sa file.
    //
    // La tâche est cherchée sans `isActive` : une tentative saisie hors ligne
    // arrive souvent après que la file a été soldée, et elle reste légitime.
    if (!isAdmin(user)) {
      const permis = await tx.prospect.findFirst({
        where: {
          id: data.prospectId,
          OR: [{ createdById: user.id }, { callTasks: { some: { assignedToId: user.id } } }],
        },
        select: { id: true },
      });
      if (!permis) {
        throw new OperationError(
          SyncOpStatus.CONFLICT,
          'ENTITY_ID_OWNED_BY_ANOTHER_USER',
          'Cette fiche appartient à un autre téléconseiller.',
        );
      }
    }

    try {
      const result = await this.phase2Sync.applyCallAttempt(tx, user.id, {
        id: operation.entityId,
        prospectId: data.prospectId,
        outcome: data.outcome,
        ...(data.reasonCode === undefined ? {} : { reasonCode: data.reasonCode }),
        ...(data.method === undefined ? {} : { method: data.method }),
        ...(data.comment === undefined ? {} : { comment: data.comment }),
        ...(data.callbackAt === undefined ? {} : { callbackAt: data.callbackAt }),
        // Renseignements de conversion (phase 3). Les cinq premiers vont sur la
        // tentative, les cinq suivants sur le prospect : voir `CallAttemptOpDto`.
        ...definedValues({
          email: data.email,
          fonctionnaire: data.fonctionnaire,
          engagementEnCours: data.engagementEnCours,
          dureeEtablissementMois: data.dureeEtablissementMois,
          rendezVousAt: data.rendezVousAt,
          nom: data.nom,
          prenom: data.prenom,
          profession: data.profession,
          banqueId: data.banqueId,
          syndicatId: data.syndicatId,
        }),
        clientCreatedAt: data.clientCreatedAt,
      });

      return {
        // Un rejeu n'est pas un échec : la tentative était déjà enregistrée,
        // rien n'a été réécrit, et le client peut retirer l'opération de sa
        // file en toute sécurité.
        status:
          result.status === CallAttemptApplyStatus.DUPLICATE
            ? SyncOpStatus.DUPLICATE
            : SyncOpStatus.APPLIED,
        entityId: operation.entityId,
        rev: result.state.rev,
        serverUpdatedAt: result.state.updatedAt,
        errorCode: null,
        error: null,
      };
    } catch (error) {
      // Le service de phase 2 lève des exceptions HTTP ; le push ne renvoie
      // jamais d'erreur HTTP pour une opération isolée, sous peine de
      // condamner les 199 autres du lot. On les rabat donc dans le corps.
      if (error instanceof ConflictException) {
        throw new OperationError(
          SyncOpStatus.CONFLICT,
          errorCodeOf(error) ?? 'PHASE2_ALREADY_COMPLETED',
          errorMessageOf(error),
        );
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw new OperationError(
          SyncOpStatus.INVALID,
          errorCodeOf(error) ?? 'CALL_ATTEMPT_INVALID',
          errorMessageOf(error),
        );
      }
      throw error;
    }
  }

  // ─── Prospect ─────────────────────────────────────────────────────────────

  private async applyProspect(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    operation: SyncOperationDto,
  ): Promise<OperationOutcome> {
    const existing = await tx.prospect.findUnique({ where: { id: operation.entityId } });

    await this.assertProspectWritable(tx, user, existing);

    if (operation.op === SyncOp.DELETE) {
      if (!existing || existing.deletedAt) {
        return existingOutcome(operation.entityId, existing);
      }
      assertRev(operation, existing.rev);
      const row = await tx.prospect.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), rev: { increment: 1 } },
      });
      return applied(row.id, row.rev, row.updatedAt);
    }

    const data = operation.data || {};
    const phoneE164 = requirePhone(data);

    if (!existing || existing.deletedAt) {
      requireText(data.nom, 'nom');
      // Le prenom est facultatif, comme tout le reste sauf le nom et le
      // telephone : une chaine vide s'enregistre, un refus ferait abandonner
      // la fiche entiere.
      // Banque, syndicat et representant sont FACULTATIFS. Un teleconseiller au
      // telephone ne les obtient pas toujours, et une fiche Grand Public n'en a
      // aucun : les exiger faisait abandonner la saisie entiere.
      if (data.representantId) {
        await assertRepresentantUsable(tx, user, data.representantId);
      }
      await assertProspectPhoneFree(tx, phoneE164, operation.entityId);

      const row = await tx.prospect.upsert({
        where: { id: operation.entityId },
        create: {
          id: operation.entityId,
          nom: data.nom.trim(),
          prenom: textOrEmpty(data.prenom),
          phoneE164,
          banqueId: valueOrNull(data.banqueId),
          syndicatId: valueOrNull(data.syndicatId),
          representantId: valueOrNull(data.representantId),
          createdById: user.id,
          ...definedValues({
            projet: data.projet,
            type: data.type,
            profession: data.profession,
            dureeSystemeMois: data.dureeSystemeMois,
            canalProvenanceId: data.canalProvenanceId,
            statut: data.statut,
          }),
          clientCreatedAt: clientDate(data.clientCreatedAt, operation.clientUpdatedAt),
        },
        update: {
          nom: data.nom.trim(),
          prenom: textOrEmpty(data.prenom),
          phoneE164,
          banqueId: valueOrNull(data.banqueId),
          syndicatId: valueOrNull(data.syndicatId),
          representantId: valueOrNull(data.representantId),
          ...definedValues({
            projet: data.projet,
            type: data.type,
            profession: data.profession,
            dureeSystemeMois: data.dureeSystemeMois,
            canalProvenanceId: data.canalProvenanceId,
            statut: data.statut,
          }),
          deletedAt: null,
          rev: { increment: 1 },
        },
      });
      await openJourney(tx, row.id, data.projet ?? Projet.CHUES, data.statut);
      return applied(row.id, row.rev, row.updatedAt);
    }

    assertRev(operation, existing.rev);
    if (phoneE164 !== existing.phoneE164) {
      await assertProspectPhoneFree(tx, phoneE164, operation.entityId);
    }
    if (data.representantId && data.representantId !== existing.representantId) {
      await assertRepresentantUsable(tx, user, data.representantId);
    }

    // Un lien VIDÉ se déclare, il ne se devine pas : `includeIfNull: false`
    // supprime le `null` avant l'envoi, donc un effacement arrivait ici
    // identique au silence d'une application ancienne.
    const videe = new Set(operation.clearedFields ?? []);
    const lien = (champ: 'banqueId' | 'syndicatId' | 'representantId'): object =>
      clearableValue(champ, data[champ], videe, null);

    const row = await tx.prospect.update({
      where: { id: existing.id },
      data: {
        ...definedValues({ nom: data.nom?.trim(), prenom: data.prenom?.trim() }),
        phoneE164,
        ...lien('banqueId'),
        ...lien('syndicatId'),
        ...lien('representantId'),
        // `projet` ABSENT volontairement : sur une fiche qui existe déjà, il dit
        // par où elle est ENTRÉE, et ça ne se réécrit pas. Rejoindre un second
        // projet lui ouvre un parcours, plus bas. Le réécrire ici la retirait du
        // projet d'origine, avec son historique et ses appels.
        ...definedValues({
          type: data.type,
          profession: data.profession,
          dureeSystemeMois: data.dureeSystemeMois,
          canalProvenanceId: data.canalProvenanceId,
          statut: data.statut,
        }),
        rev: { increment: 1 },
      },
    });
    if (data.projet) await openJourney(tx, row.id, data.projet, data.statut);
    return applied(row.id, row.rev, row.updatedAt);
  }

  private async assertProspectWritable(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    existing: { id: string; createdById: string } | null,
  ): Promise<void> {
    if (existing === null || isAdmin(user) || existing.createdById === user.id) return;
    const assigned = await tx.callTask.findFirst({
      where: { prospectId: existing.id, assignedToId: user.id, isActive: true },
      select: { id: true },
    });
    if (assigned !== null) return;
    throw new OperationError(
      SyncOpStatus.CONFLICT,
      'ENTITY_ID_OWNED_BY_ANOTHER_USER',
      'Cet identifiant appartient à un autre commercial.',
    );
  }

  // PULL

  async pull(user: AuthenticatedUser, query: SyncPullQueryDto): Promise<SyncPullResponseDto> {
    const limit = query.limit ?? 200;
    const incoming = decodeCursor(query.since);
    const serverTime = new Date();
    const safeNow = new Date(serverTime.getTime() - PULL_SAFETY_LAG_MS);

    let cursor: SyncCursor = incoming;
    const pageLengths: number[] = [];

    // ─ Référentiels : mêmes règles de pagination, position indépendante ─
    const departements = await this.prisma.departement.findMany({
      where: keyset(cursor.streams.departements, safeNow),
      include: { region: { select: { name: true } } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'departements', lastPosition(departements));
    pageLengths.push(departements.length);

    // Les IEF voyagent avec les autres référentiels : le sélecteur de saisie
    // doit fonctionner hors ligne, sinon la fiche s'arrête à la première coupure.
    const iefs = await this.prisma.ief.findMany({
      where: keyset(cursor.streams.iefs, safeNow),
      include: { departement: { select: { name: true, region: { select: { name: true } } } } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'iefs', lastPosition(iefs));
    pageLengths.push(iefs.length);

    const banques = await this.prisma.banque.findMany({
      where: keyset(cursor.streams.banques, safeNow),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'banques', lastPosition(banques));
    pageLengths.push(banques.length);

    // Le canal de provenance descend comme les autres référentiels : sans lui
    // en local, une fiche Grand Public saisie hors réseau n'a rien à choisir.
    const canauxProvenance = await this.prisma.canalProvenance.findMany({
      where: keyset(cursor.streams.canauxProvenance, safeNow),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'canauxProvenance', lastPosition(canauxProvenance));
    pageLengths.push(canauxProvenance.length);

    // Les quatre listes du registre. Sans elles en local, l'accueil ne pouvait
    // pas inscrire un visiteur hors réseau : la lecture du registre tenait, sa
    // saisie non.
    const entreprises = await this.prisma.visiteEntreprise.findMany({
      where: keyset(cursor.streams.visiteEntreprises, safeNow),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    const objets = await this.prisma.visiteObjet.findMany({
      where: keyset(cursor.streams.visiteObjets, safeNow),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    const directions = await this.prisma.visiteDirection.findMany({
      where: keyset(cursor.streams.visiteDirections, safeNow),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    const destinataires = await this.prisma.visiteDestinataire.findMany({
      where: keyset(cursor.streams.visiteDestinataires, safeNow),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'visiteEntreprises', lastPosition(entreprises));
    cursor = advance(cursor, 'visiteObjets', lastPosition(objets));
    cursor = advance(cursor, 'visiteDirections', lastPosition(directions));
    cursor = advance(cursor, 'visiteDestinataires', lastPosition(destinataires));
    pageLengths.push(entreprises.length, objets.length, directions.length, destinataires.length);
    const listesDuRegistre: SyncVisiteReferentielDto[] = [
      ...entreprises.map(toRegistreDto('entreprises')),
      ...objets.map(toRegistreDto('objets')),
      ...directions.map(toRegistreDto('directions')),
      ...destinataires.map(toRegistreDto('destinataires')),
    ];

    const syndicats = await this.prisma.syndicat.findMany({
      where: keyset(cursor.streams.syndicats, safeNow),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'syndicats', lastPosition(syndicats));
    pageLengths.push(syndicats.length);

    // ─ Métier : ce que le compte a saisi, ET ce qu'une campagne lui a confié ─
    const representants = await this.prisma.representant.findMany({
      where: {
        ...keyset(cursor.streams.representants, safeNow),
        ...mineOrAssignedRepresentant(user),
      },
      include: REPRESENTANT_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'representants', lastPosition(representants));
    pageLengths.push(representants.length);

    const prospects = await this.prisma.prospect.findMany({
      where: { ...keyset(cursor.streams.prospects, safeNow), ...mineOrAssignedProspect(user) },
      include: PROSPECT_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'prospects', lastPosition(prospects));
    pageLengths.push(prospects.length);

    // Les campagnes AVANT les files : une file qui arrive sans sa campagne
    // n'aurait pas de nom à afficher, et le terrain verrait une liste anonyme.
    const callCampaigns = await this.prisma.callCampaign.findMany({
      where: {
        ...keyset(cursor.streams.callCampaigns, safeNow),
        ...(isAdmin(user) ? {} : { tasks: { some: { assignedToId: user.id, isActive: true } } }),
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'callCampaigns', lastPosition(callCampaigns));
    pageLengths.push(callCampaigns.length);

    // `isActive` n'est PAS filtré ici : une file retirée au commercial doit
    // descendre une dernière fois, sinon le téléphone la garde pour toujours et
    // continue de proposer des fiches qui ne lui sont plus confiées. C'est le
    // client qui l'efface, sur la foi du drapeau.
    const callTasks = await this.prisma.callTask.findMany({
      where: {
        ...keyset(cursor.streams.callTasks, safeNow),
        ...(isAdmin(user) ? {} : { assignedToId: user.id }),
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'callTasks', lastPosition(callTasks));
    pageLengths.push(callTasks.length);

    const repCallCampaigns = await this.prisma.repCallCampaign.findMany({
      where: {
        ...keyset(cursor.streams.repCallCampaigns, safeNow),
        ...(isAdmin(user) ? {} : { commerciaux: { some: { userId: user.id } } }),
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'repCallCampaigns', lastPosition(repCallCampaigns));
    pageLengths.push(repCallCampaigns.length);

    const repCallTasks = await this.prisma.repCallTask.findMany({
      where: {
        ...keyset(cursor.streams.repCallTasks, safeNow),
        ...(isAdmin(user) ? {} : { assignedToId: user.id }),
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'repCallTasks', lastPosition(repCallTasks));
    pageLengths.push(repCallTasks.length);

    // Le registre n'est pas un référentiel : il porte des noms et des numéros de
    // visiteurs, hors du périmètre des rôles qui ne le tiennent pas. Un compte
    // sans accès reçoit un flux vide plutôt qu'une erreur, comme les autres
    // flux quand ils ne concernent pas le compte.
    const visites = (VISITE_REGISTRE_ROLES as readonly Role[]).includes(user.role)
      ? await this.prisma.visite.findMany({
          where: keyset(cursor.streams.visites, safeNow),
          include: {
            entreprise: { select: { id: true, code: true, label: true } },
            objet: { select: { id: true, code: true, label: true } },
            direction: { select: { id: true, code: true, label: true } },
            destinataire: { select: { id: true, code: true, label: true } },
          },
          orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
          take: limit,
        })
      : [];
    cursor = advance(cursor, 'visites', lastPosition(visites));
    pageLengths.push(visites.length);

    // Une ligne supprimée logiquement voyage dans le MÊME flux que les autres
    // (son `updatedAt` a bougé) : elle est simplement aiguillée vers
    // `deletions`. La sortir dans une requête séparée lui ferait rater la
    // pagination et le client garderait la fiche pour toujours.
    const deletions: SyncDeletionDto[] = [
      ...representants.flatMap((row) =>
        row.deletedAt
          ? [
              {
                entity: SyncEntity.REPRESENTANT,
                id: row.id,
                deletedAt: row.deletedAt.toISOString(),
              },
            ]
          : [],
      ),
      ...prospects.flatMap((row) =>
        row.deletedAt
          ? [{ entity: SyncEntity.PROSPECT, id: row.id, deletedAt: row.deletedAt.toISOString() }]
          : [],
      ),
    ];

    return {
      changes: {
        departements: departements.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          regionId: row.regionId,
          regionName: row.region.name,
          isActive: row.isActive,
          updatedAt: row.updatedAt.toISOString(),
        })),
        iefs: iefs.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          departementId: row.departementId,
          departementName: row.departement.name,
          regionName: row.departement.region.name,
          isActive: row.isActive,
          updatedAt: row.updatedAt.toISOString(),
        })),
        banques: banques.map((row) => ({
          id: row.id,
          name: row.name,
          shortName: row.shortName,
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          updatedAt: row.updatedAt.toISOString(),
        })),
        visiteReferentiels: listesDuRegistre,
        canauxProvenance: canauxProvenance.map((row) => ({
          id: row.id,
          code: row.code,
          label: row.label,
          position: row.position,
          isActive: row.isActive,
          updatedAt: row.updatedAt.toISOString(),
        })),
        syndicats: syndicats.map((row) => ({
          id: row.id,
          name: row.name,
          sigle: row.sigle,
          secteur: row.secteur,
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          updatedAt: row.updatedAt.toISOString(),
        })),
        representants: representants
          .filter((row) => !row.deletedAt)
          .map((row) => toRepresentantDto(row)),
        prospects: prospects.filter((row) => !row.deletedAt).map((row) => toProspectDto(row)),
        callCampaigns: callCampaigns.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          spreadDays: row.spreadDays,
          updatedAt: row.updatedAt.toISOString(),
          closedAt: row.closedAt?.toISOString() ?? null,
        })),
        callTasks: callTasks.map((row) => ({
          id: row.id,
          campaignId: row.campaignId,
          prospectId: row.prospectId,
          position: row.position,
          dayIndex: row.dayIndex,
          status: row.status,
          isActive: row.isActive,
          updatedAt: row.updatedAt.toISOString(),
        })),
        repCallCampaigns: repCallCampaigns.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          spreadDays: row.spreadDays,
          updatedAt: row.updatedAt.toISOString(),
          closedAt: row.closedAt?.toISOString() ?? null,
        })),
        repCallTasks: repCallTasks.map((row) => ({
          id: row.id,
          campaignId: row.campaignId,
          representantId: row.representantId,
          position: row.position,
          dayIndex: row.dayIndex,
          status: row.status,
          isActive: row.isActive,
          updatedAt: row.updatedAt.toISOString(),
        })),
        visites: visites.map((row): SyncVisiteDto => ({
          id: row.id,
          reference: row.reference,
          date: dakarDate(row.visitedAt),
          time: row.timeKnown ? hourMinuteDakar(row.visitedAt) : null,
          visitorName: row.visitorName,
          phone: row.phone,
          phoneE164: row.phoneE164,
          entreprise: row.entreprise,
          objet: row.objet,
          direction: row.direction,
          destinataire: row.destinataire,
          comment: row.comment,
          createdById: row.createdById,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
      },
      deletions,
      nextCursor: encodeCursor(cursor),
      hasMore: pageLengths.includes(limit),
      serverTime: serverTime.toISOString(),
    };
  }
}

// Helpers

/**
 * Pagination keyset sur `(updatedAt, id)` + retard de sécurité.
 *
 * `updatedAt > t` seul perdrait toute ligne partageant la milliseconde de la
 * dernière servie ; `>= t` la rejouerait indéfiniment. Le couple avec `id`
 * tranche sans perte ni boucle.
 */
interface KeysetClause {
  updatedAt?: Date | { lt: Date } | { gt: Date };
  id?: { gt: string };
  OR?: KeysetClause[];
  AND?: KeysetClause[];
}

function keyset(position: StreamPosition | undefined, safeNow: Date): { AND: KeysetClause[] } {
  const clauses: KeysetClause[] = [{ updatedAt: { lt: safeNow } }];
  if (position) {
    const at = fromMicros(position.t);
    clauses.push({
      OR: [{ updatedAt: { gt: at } }, { AND: [{ updatedAt: at }, { id: { gt: position.id } }] }],
    });
  }
  return { AND: clauses };
}

const hourMinuteDakar = (at: Date): string => {
  const { hour, minute } = dakarWallClock(at);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const lastPosition = (rows: { updatedAt: Date; id: string }[]): StreamPosition | undefined => {
  const last = rows.at(-1);
  return last ? positionOf(last) : undefined;
};

const applied = (
  entityId: string,
  rev: number | null,
  updatedAt: Date | null,
): OperationOutcome => ({
  status: SyncOpStatus.APPLIED,
  entityId,
  rev,
  serverUpdatedAt: updatedAt?.toISOString() ?? null,
  errorCode: null,
  error: null,
});

const toResultDto = (
  operation: SyncOperationDto,
  outcome: OperationOutcome,
): SyncOperationResultDto => ({ opId: operation.opId, ...outcome });

const missingResult = (operation: SyncOperationDto): SyncOperationResultDto => ({
  opId: operation.opId,
  status: SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
  entityId: operation.entityId,
  rev: null,
  serverUpdatedAt: null,
  errorCode: 'NO_RESULT',
  error: 'Aucun résultat produit pour cette opération.',
});

/**
 * NIVEAU 2 de l'idempotence.
 *
 * Renvoie `undefined` si l'opération est neuve (la ligne vient d'être posée),
 * ou le résultat mémorisé si elle avait déjà été appliquée, auquel cas on
 * réémet ce résultat sans refaire l'écriture.
 */
async function claimOperation(
  tx: Prisma.TransactionClient,
  userId: string,
  batchKey: string,
  operation: SyncOperationDto,
): Promise<SyncOperationResultDto | undefined> {
  const inserted = await tx.$executeRaw`
    INSERT INTO "sync_operations" ("opId", "userId", "batchKey", "entityType", "entityId", "result", "appliedAt")
    VALUES (${operation.opId}, ${userId}, ${batchKey}, ${operation.entity}, ${operation.entityId},
            'APPLIED'::"OperationResult", now())
    ON CONFLICT ("opId") DO NOTHING
  `;
  if (inserted === 1) return undefined;

  const stored = await tx.syncOperation.findUnique({ where: { opId: operation.opId } });
  const memorised = stored?.resultJson as SyncOperationResultDto | null | undefined;

  // Le statut réémis vient du verdict MÉMORISÉ, jamais d'une constante. La
  // ligne `sync_operations` est écrite `APPLIED` à la réservation puis corrigée
  // par `finalizeOperation` : c'est `result` qui porte la vérité. Réémettre un
  // `DUPLICATE` fixe ferait passer un refus pour une réussite, et le téléphone
  // effacerait la saisie en la croyant partie.
  //
  // Le repli n'est PAS `DUPLICATE`. Une base migrée avant que l'API ne soit
  // reconstruite peut porter une valeur que cette version ne connaît pas, et la
  // table rendrait alors `undefined`. Dans le doute on refuse : `INVALID` fait
  // remonter la ligne dans « À corriger », là où un humain la voit. Un statut
  // inconnu ne doit jamais pouvoir se lire comme une réussite.
  const memorisedStatus = stored ? storedStatusOf(stored.result) : SyncOpStatus.DUPLICATE;
  const unknownResult = memorisedStatus === undefined;
  const status = memorisedStatus ?? SyncOpStatus.INVALID;

  return {
    opId: operation.opId,
    status,
    entityId: memorised?.entityId ?? stored?.entityId ?? operation.entityId,
    rev: memorised?.rev ?? null,
    serverUpdatedAt: memorised?.serverUpdatedAt ?? null,
    errorCode: unknownResult ? 'UNKNOWN_STORED_RESULT' : (memorised?.errorCode ?? null),
    error: unknownResult
      ? 'Verdict enregistré inconnu de cette version du serveur. Opération à revoir manuellement.'
      : (memorised?.error ?? null),
  };
}

async function finalizeOperation(
  tx: Prisma.TransactionClient,
  opId: string,
  outcome: OperationOutcome,
): Promise<void> {
  await tx.syncOperation.update({
    where: { opId },
    data: {
      result: TO_DB_RESULT[outcome.status],
      resultJson: outcome as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Écriture conditionnelle sur la révision serveur.
 *
 * Sans `baseRev`, deux appareils qui modifient la même fiche hors ligne se
 * recouvrent en silence : le dernier arrivé gagne et la modification de
 * l'autre disparaît sans trace. Avec, le perdant reçoit `conflict` et peut
 * proposer une résolution à son utilisateur.
 */
function assertRev(operation: SyncOperationDto, serverRev: number): void {
  if (operation.baseRev === undefined) return;
  if (operation.baseRev === serverRev) return;
  throw new OperationError(
    SyncOpStatus.CONFLICT,
    'REV_CONFLICT',
    `La fiche a été modifiée entre-temps (révision serveur ${String(serverRev)}, base client ${String(operation.baseRev)}).`,
  );
}

function requirePhone(data: SyncEntityDataDto): string {
  if (!data.phone) {
    throw new OperationError(SyncOpStatus.INVALID, 'FIELD_REQUIRED', 'Champ requis : phone.');
  }
  try {
    return normalizePhone(data.phone);
  } catch {
    throw new OperationError(
      SyncOpStatus.INVALID,
      'PHONE_INVALID',
      `Numéro de téléphone invalide : ${data.phone}`,
    );
  }
}

function requireText(value: string | undefined, field: string): asserts value is string {
  if (!value?.trim()) {
    throw new OperationError(SyncOpStatus.INVALID, 'FIELD_REQUIRED', `Champ requis : ${field}.`);
  }
}

function requireUuid(value: string | undefined, field: string): asserts value is string {
  if (!value) {
    throw new OperationError(SyncOpStatus.INVALID, 'FIELD_REQUIRED', `Champ requis : ${field}.`);
  }
}

/** La date terrain prime ; à défaut, l'horodatage de l'opération. */
const clientDate = (clientCreatedAt: string | undefined, fallback: string): Date =>
  new Date(clientCreatedAt ?? fallback);

/**
 * L'auteur d'un lot, tel qu'il vaut du PREMIER au DERNIER groupe.
 *
 * Un seul objet pour les deux faits que le lot consulte, et c'est le point :
 * ils viennent de la MÊME lecture, au MÊME instant. Séparés, ils dérivaient,
 * l'un relu par groupe et l'autre figé à l'entrée de la requête.
 */
interface BatchAuthority {
  readonly user: AuthenticatedUser;
}

async function assertRepresentantUsable(
  tx: Prisma.TransactionClient,
  user: AuthenticatedUser,
  representantId: string,
): Promise<void> {
  const representant = await tx.representant.findFirst({
    where: { id: representantId, deletedAt: null },
    select: { id: true, createdById: true },
  });
  if (!representant) {
    throw new OperationError(
      SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
      'REPRESENTANT_NOT_FOUND',
      'Représentant de rattachement introuvable.',
    );
  }
  if (!isAdmin(user) && representant.createdById !== user.id) {
    throw new OperationError(
      SyncOpStatus.CONFLICT,
      'REPRESENTANT_OWNED_BY_ANOTHER_USER',
      'Ce représentant appartient à un autre commercial.',
    );
  }
}

/**
 * Le doublon est détecté par une LECTURE, jamais en laissant l'index unique
 * lever.
 *
 * Une violation de contrainte avorte la transaction PostgreSQL : le conflit
 * d'un seul prospect emporterait alors tout son groupe. Le SELECT préalable
 * transforme le doublon en résultat métier ordinaire, et le reste du groupe
 * continue de s'écrire. L'index reste en dernier recours contre une écriture
 * concurrente.
 */
async function assertProspectPhoneFree(
  tx: Prisma.TransactionClient,
  phoneE164: string,
  exceptId: string,
): Promise<void> {
  const clash = await tx.prospect.findFirst({
    where: { phoneE164, deletedAt: null, id: { not: exceptId } },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      representant: { select: { id: true, fullName: true } },
    },
  });
  if (!clash) return;
  throw new OperationError(
    SyncOpStatus.CONFLICT,
    'PROSPECT_PHONE_CONFLICT',
    `Ce numéro a déjà été enregistré par ${clash.createdBy.fullName}.`,
  );
}

interface RegistreRow {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: Date;
}

const toRegistreDto =
  (kind: VisiteReferentielKind) =>
  (row: RegistreRow): SyncVisiteReferentielDto => ({
    id: row.id,
    kind,
    code: row.code,
    label: row.label,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  });

/**
 * Ouvre le parcours du projet, ou le laisse tel quel s'il existe déjà.
 *
 * C'est `prospect_journeys` que filtrent les listes par projet, les statistiques
 * et les rappels, JAMAIS la colonne `projet`. Sans cette ligne, une fiche saisie
 * sur le terrain n'apparaissait dans aucun des deux projets côté web : elle
 * existait, elle était introuvable.
 *
 * Le même numéro rejoint donc un second projet en s'ajoutant un parcours, il ne
 * quitte pas le premier.
 */
async function openJourney(
  tx: Prisma.TransactionClient,
  prospectId: string,
  projet: Projet,
  statut: ProspectStatut | undefined,
): Promise<void> {
  const grandPublic = projet === Projet.GRAND_PUBLIC;
  await tx.prospectJourney.upsert({
    where: { prospectId_projet: { prospectId, projet } },
    create: {
      prospectId,
      projet,
      ...(statut ? { statut } : {}),
      consent: grandPublic ? GrandPublicConsent.INTERESSE : GrandPublicConsent.NON_DEMANDE,
      consentAt: grandPublic ? new Date() : null,
    },
    update: statut === undefined ? {} : { statut },
  });
}

async function assertRepresentantPhoneFree(
  tx: Prisma.TransactionClient,
  phoneE164: string,
  exceptId: string,
): Promise<void> {
  // LECTURE GLOBALE : même contrôle d'unicité, même index global, même raison.
  const clash = await tx.representant.findFirst({
    where: { phoneE164, deletedAt: null, id: { not: exceptId } },
    select: { id: true, createdBy: { select: { fullName: true } } },
  });
  if (!clash) return;
  throw new OperationError(
    SyncOpStatus.CONFLICT,
    'REPRESENTANT_PHONE_CONFLICT',
    `Ce numéro est déjà celui d’un représentant enregistré par ${clash.createdBy.fullName}.`,
  );
}
