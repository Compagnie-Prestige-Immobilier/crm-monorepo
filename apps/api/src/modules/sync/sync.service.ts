import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OperationResult, Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { readEnv } from '../../env.js';
import { normalizePhone } from '../../common/phone.js';
import { isAdmin, ownerScope } from '../../common/scope.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PROSPECT_INCLUDE, toProspectDto } from '../prospects/prospects.service.js';
import { REPRESENTANT_INCLUDE, toRepresentantDto } from '../representants/representants.service.js';
import { CallAttemptApplyStatus } from '../phase2/dto.js';
import { Phase2SyncService } from '../phase2/phase2-sync.service.js';
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
} from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';

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

/**
 * Les exceptions Nest portent leur corps typé dans `getResponse()`. On y lit le
 * code métier plutôt que de se fier au message, qui est destiné à l'humain et
 * peut être reformulé sans préavis.
 */
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

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly batches: SyncBatchStore,
    private readonly phase2Sync: Phase2SyncService,
    private readonly demo: DemoVisibilityService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // PUSH
  // ───────────────────────────────────────────────────────────────────────────

  async push(user: AuthenticatedUser, body: SyncPushDto): Promise<SyncPushOutcome> {
    const env = readEnv();
    const hash = requestHash(body);

    // NIVEAU 1 — le lot. Marqueur posé hors de la transaction de travail.
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
   * Le groupe — un représentant et ses prospects — est la plus petite unité
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

    const results: SyncOperationResultDto[] = [];
    for (const operations of ordered) {
      try {
        results.push(...(await this.runGroup(user, body.clientBatchId, operations)));
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

  private async runGroup(
    user: AuthenticatedUser,
    batchKey: string,
    operations: SyncOperationDto[],
  ): Promise<SyncOperationResultDto[]> {
    return this.prisma.$transaction(
      async (tx) => {
        const results: SyncOperationResultDto[] = [];
        // Vrai dès que le représentant du groupe est indisponible : ses
        // prospects ne peuvent alors plus être rattachés à quoi que ce soit.
        let parentUnavailable = false;

        for (const operation of operations) {
          // NIVEAU 2 — l'opération. Première instruction, systématiquement.
          // Indispensable : le niveau 1 ne couvre pas le cas où 3 opérations
          // sur 5 passent et où le client reconstitue un lot DIFFÉRENT sous un
          // NOUVEAU batchId — la clé de lot ne reconnaît alors plus rien.
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
      if (operation.entity === SyncEntity.CALL_ATTEMPT) {
        return await this.applyCallAttempt(tx, user, operation);
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

  // ─── Représentant ─────────────────────────────────────────────────────────

  private async applyRepresentant(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    operation: SyncOperationDto,
  ): Promise<OperationOutcome> {
    const existing = await tx.representant.findUnique({ where: { id: operation.entityId } });

    // GARDE ANTI-SQUAT D'IDENTIFIANT. Le client choisit l'UUID : sans ce
    // contrôle, poster l'identifiant d'un collègue écraserait sa fiche.
    if (existing && !isAdmin(user) && existing.createdById !== user.id) {
      throw new OperationError(
        SyncOpStatus.CONFLICT,
        'ENTITY_ID_OWNED_BY_ANOTHER_USER',
        'Cet identifiant appartient à un autre commercial.',
      );
    }

    if (operation.op === SyncOp.DELETE) {
      if (!existing || existing.deletedAt) {
        // Supprimer ce qui n'existe plus est le résultat voulu.
        return applied(operation.entityId, existing?.rev ?? null, existing?.updatedAt ?? null);
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

    const data = operation.data ?? {};
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
          ...(data.notes ? { notes: data.notes } : {}),
          departementId: data.departementId,
          ...(data.iefId ? { iefId: data.iefId } : {}),
          createdById: user.id,
          clientCreatedAt: clientDate(data.clientCreatedAt, operation.clientUpdatedAt),
        },
        update: {
          fullName: data.fullName.trim(),
          phoneE164,
          notes: data.notes ?? null,
          departementId: data.departementId,
          ...(data.iefId ? { iefId: data.iefId } : {}),
          deletedAt: null,
          rev: { increment: 1 },
        },
      });
      return applied(row.id, row.rev, row.updatedAt);
    }

    assertRev(operation, existing.rev);
    if (phoneE164 !== existing.phoneE164) {
      await assertRepresentantPhoneFree(tx, phoneE164, operation.entityId);
    }

    const row = await tx.representant.update({
      where: { id: existing.id },
      data: {
        ...(data.fullName ? { fullName: data.fullName.trim() } : {}),
        phoneE164,
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.departementId ? { departementId: data.departementId } : {}),
        // `undefined` et non `null` : une application ancienne n'envoie pas le
        // champ, et son silence ne doit pas effacer une IEF deja renseignee.
        ...(data.iefId === undefined ? {} : { iefId: data.iefId }),
        rev: { increment: 1 },
      },
    });
    return applied(row.id, row.rev, row.updatedAt);
  }

  // ─── Tentative d'appel (phase 2) ──────────────────────────────────────────

  /**
   * Adaptateur vers `Phase2SyncService`, seule autorité sur les règles de
   * phase 2. Ce service ne fait que traduire : il valide la forme de
   * l'opération, délègue, puis convertit le résultat ou l'exception en
   * `OperationOutcome`.
   *
   * `tx` est transmis tel quel — la transaction ouverte par le lot est ce qui
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

    try {
      const result = await this.phase2Sync.applyCallAttempt(tx, user.id, {
        id: operation.entityId,
        prospectId: data.prospectId,
        outcome: data.outcome,
        ...(data.method === undefined ? {} : { method: data.method }),
        ...(data.comment === undefined ? {} : { comment: data.comment }),
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

    if (existing && !isAdmin(user) && existing.createdById !== user.id) {
      throw new OperationError(
        SyncOpStatus.CONFLICT,
        'ENTITY_ID_OWNED_BY_ANOTHER_USER',
        'Cet identifiant appartient à un autre commercial.',
      );
    }

    if (operation.op === SyncOp.DELETE) {
      if (!existing || existing.deletedAt) {
        return applied(operation.entityId, existing?.rev ?? null, existing?.updatedAt ?? null);
      }
      assertRev(operation, existing.rev);
      const row = await tx.prospect.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), rev: { increment: 1 } },
      });
      return applied(row.id, row.rev, row.updatedAt);
    }

    const data = operation.data ?? {};
    const phoneE164 = requirePhone(data);

    if (!existing || existing.deletedAt) {
      requireText(data.nom, 'nom');
      requireText(data.prenom, 'prenom');
      requireUuid(data.banqueId, 'banqueId');
      requireUuid(data.syndicatId, 'syndicatId');
      requireUuid(data.representantId, 'representantId');
      await assertRepresentantUsable(tx, user, data.representantId);
      await assertProspectPhoneFree(tx, phoneE164, operation.entityId);

      const row = await tx.prospect.upsert({
        where: { id: operation.entityId },
        create: {
          id: operation.entityId,
          nom: data.nom.trim(),
          prenom: data.prenom.trim(),
          phoneE164,
          banqueId: data.banqueId,
          syndicatId: data.syndicatId,
          representantId: data.representantId,
          createdById: user.id,
          ...(data.statut ? { statut: data.statut } : {}),
          clientCreatedAt: clientDate(data.clientCreatedAt, operation.clientUpdatedAt),
        },
        update: {
          nom: data.nom.trim(),
          prenom: data.prenom.trim(),
          phoneE164,
          banqueId: data.banqueId,
          syndicatId: data.syndicatId,
          representantId: data.representantId,
          ...(data.statut ? { statut: data.statut } : {}),
          deletedAt: null,
          rev: { increment: 1 },
        },
      });
      return applied(row.id, row.rev, row.updatedAt);
    }

    assertRev(operation, existing.rev);
    if (phoneE164 !== existing.phoneE164) {
      await assertProspectPhoneFree(tx, phoneE164, operation.entityId);
    }
    if (data.representantId && data.representantId !== existing.representantId) {
      await assertRepresentantUsable(tx, user, data.representantId);
    }

    const row = await tx.prospect.update({
      where: { id: existing.id },
      data: {
        ...(data.nom ? { nom: data.nom.trim() } : {}),
        ...(data.prenom ? { prenom: data.prenom.trim() } : {}),
        phoneE164,
        ...(data.banqueId ? { banqueId: data.banqueId } : {}),
        ...(data.syndicatId ? { syndicatId: data.syndicatId } : {}),
        ...(data.representantId ? { representantId: data.representantId } : {}),
        ...(data.statut ? { statut: data.statut } : {}),
        rev: { increment: 1 },
      },
    });
    return applied(row.id, row.rev, row.updatedAt);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PULL
  // ───────────────────────────────────────────────────────────────────────────

  async pull(user: AuthenticatedUser, query: SyncPullQueryDto): Promise<SyncPullResponseDto> {
    const limit = query.limit ?? 200;
    const incoming = decodeCursor(query.since);
    const serverTime = new Date();
    const safeNow = new Date(serverTime.getTime() - PULL_SAFETY_LAG_MS);

    let cursor: SyncCursor = incoming;
    let hasMore = false;

    // ─ Référentiels : mêmes règles de pagination, position indépendante ─
    const departements = await this.prisma.departement.findMany({
      where: keyset(cursor.streams.departements, safeNow),
      include: { region: { select: { name: true } } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'departements', lastPosition(departements));
    hasMore ||= departements.length === limit;

    // Les IEF voyagent avec les autres référentiels : le sélecteur de saisie
    // doit fonctionner hors ligne, sinon la fiche s'arrête à la première coupure.
    const iefs = await this.prisma.ief.findMany({
      where: keyset(cursor.streams.iefs, safeNow),
      include: { departement: { select: { name: true, region: { select: { name: true } } } } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'iefs', lastPosition(iefs));
    hasMore ||= iefs.length === limit;

    const banques = await this.prisma.banque.findMany({
      where: keyset(cursor.streams.banques, safeNow),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'banques', lastPosition(banques));
    hasMore ||= banques.length === limit;

    const syndicats = await this.prisma.syndicat.findMany({
      where: keyset(cursor.streams.syndicats, safeNow),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'syndicats', lastPosition(syndicats));
    hasMore ||= syndicats.length === limit;

    // ─ Métier : cloisonné par commercial ─
    //
    // Le cloisonnement suffirait presque : les fiches de démonstration
    // appartiennent à des comptes de démonstration, et un vrai commercial ne
    // tire que les siennes. On pose quand même le filtre, pour la seule
    // situation où l'un ne couvre pas l'autre — le compte de démonstration
    // lui-même, qui ne doit plus rien recevoir une fois le mode éteint.
    const scope = { ...ownerScope(user), ...demoScope(await this.demo.enabled()) };

    const representants = await this.prisma.representant.findMany({
      where: { ...keyset(cursor.streams.representants, safeNow), ...scope },
      include: REPRESENTANT_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'representants', lastPosition(representants));
    hasMore ||= representants.length === limit;

    const prospects = await this.prisma.prospect.findMany({
      where: { ...keyset(cursor.streams.prospects, safeNow), ...scope },
      include: PROSPECT_INCLUDE,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    cursor = advance(cursor, 'prospects', lastPosition(prospects));
    hasMore ||= prospects.length === limit;

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
      },
      deletions,
      nextCursor: encodeCursor(cursor),
      hasMore,
      serverTime: serverTime.toISOString(),
    };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

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
 * ou le résultat mémorisé si elle avait déjà été appliquée — auquel cas on
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
  return {
    opId: operation.opId,
    status: SyncOpStatus.DUPLICATE,
    entityId: memorised?.entityId ?? stored?.entityId ?? operation.entityId,
    rev: memorised?.rev ?? null,
    serverUpdatedAt: memorised?.serverUpdatedAt ?? null,
    errorCode: memorised?.errorCode ?? null,
    error: memorised?.error ?? null,
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

async function assertRepresentantPhoneFree(
  tx: Prisma.TransactionClient,
  phoneE164: string,
  exceptId: string,
): Promise<void> {
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
