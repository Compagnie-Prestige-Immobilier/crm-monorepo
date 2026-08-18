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

/** Convertit le verdict stocké dans le statut rendu lors d'un rejeu. */
const FROM_DB_RESULT: Record<OperationResult, SyncOpStatus> = {
  [OperationResult.APPLIED]: SyncOpStatus.DUPLICATE,
  [OperationResult.DUPLICATE]: SyncOpStatus.DUPLICATE,
  [OperationResult.CONFLICT]: SyncOpStatus.CONFLICT,
  [OperationResult.INVALID]: SyncOpStatus.INVALID,
  [OperationResult.SKIPPED_DEPENDENCY_FAILED]: SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
};

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

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly batches: SyncBatchStore,
    private readonly phase2Sync: Phase2SyncService,
    private readonly demo: DemoVisibilityService,
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

    // L'AUTORITÉ DU LOT EST LUE UNE FOIS, ET ELLE VAUT POUR TOUT LE LOT
    //
    // ═══ CE QUI N'ALLAIT PAS : UN LOT À DEUX AUTORITÉS ═══
    //
    // Un lot traverse ses groupes sur une fenêtre longue, deux cents opérations
    // et autant de transactions. Deux faits sur l'auteur y étaient traités
    // différemment, et rien ne le justifiait :
    //
    //   · `isDemo` était relu à CHAQUE groupe, dans la transaction du groupe ;
    //   · le RÔLE et l'état du compte venaient de `request.user`, figés par
    //     `FreshSessionGuard` à l'entrée de la requête, et jamais revus.
    //
    // Un lot pouvait donc écrire ses cent premières lignes en réel et les cent
    // suivantes en fictif (l'interrupteur ayant basculé), tout en appliquant du
    // début à la fin le rôle d'avant une rétrogradation. Le lot n'était
    // cohérent avec personne : ni avec l'autorité d'entrée, ni avec celle de
    // sortie.
    //
    // ═══ POURQUOI FIGER PLUTÔT QUE RAFRAÎCHIR ═══
    //
    // Rafraîchir par groupe aurait rendu le lot cohérent avec la fin, au prix
    // d'un lot PARTIELLEMENT APPLIQUÉ : les groupes déjà écrits restent écrits,
    // les suivants repartent en échec. Or ce module a déjà tranché cette
    // question exacte, et dans l'autre sens : la synchronisation est DISPENSÉE
    // de `DemoReadOnlyGuard` (voir `BatchAuthority.isDemo`) parce que refuser la file
    // d'un commercial revenu d'un village sans réseau, à cause d'un
    // interrupteur basculé au bureau pendant sa remontée, ferait basculer des
    // saisies valides dans « À corriger ». Une rétrogradation en cours de lot
    // produirait le même écran, pour la même raison.
    //
    // Le lot est donc UNE unité d'autorité, celle que `FreshSessionGuard` a
    // validée à la porte, et la fenêtre est bornée par le lot lui-même :
    // `SYNC_MAX_BATCH_SIZE` opérations dans une requête HTTP. La remontée
    // SUIVANTE, elle, est refusée en entier par la garde, quelques secondes
    // plus tard.
    //
    // Effet de bord agréable : une lecture par lot au lieu d'une par groupe.
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

  /**
   * Lit l'autorité du lot, UNE FOIS, avant le premier groupe.
   *
   * ═══ LE RÔLE VIENT DE LA BASE, PAS DU JETON ═══
   *
   * `request.user.role` est celui que `FreshSessionGuard` a posé à l'entrée de
   * la requête, et c'est déjà la bonne valeur. On la relit tout de même ici,
   * dans la MÊME lecture que `isDemo`, pour que les deux faits que le lot
   * consulte proviennent d'un seul instant : deux lectures à deux moments
   * finissent par décrire deux personnes.
   *
   * ═══ POURQUOI UN AUTEUR INTROUVABLE NE FAIT PAS ÉCHOUER LE LOT ═══
   *
   * Le repli n'est pas une négligence, c'est la règle que ce fichier appliquait
   * déjà : le jeton vient d'être validé sur une ligne existante, et la garde
   * refuse la requête AVANT d'arriver ici si le compte a disparu. Une ligne
   * absente à cet instant décrit une base qui répond de travers, pas un compte
   * supprimé ; refuser le lot ferait alors basculer dans « À corriger » des
   * saisies valides qu'aucune reprise ne repêcherait. On garde donc l'identité
   * validée à la porte, et `isDemo: false`, qui est ce que la version
   * précédente écrivait déjà dans ce cas.
   */
  private async readAuthority(user: AuthenticatedUser): Promise<BatchAuthority> {
    const author = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, isDemo: true },
    });
    return {
      user: author?.role ? { ...user, role: author.role } : user,
      isDemo: author?.isDemo ?? false,
    };
  }

  private async runGroup(
    author: BatchAuthority,
    batchKey: string,
    operations: SyncOperationDto[],
  ): Promise<SyncOperationResultDto[]> {
    const { user, isDemo: authorIsDemo } = author;
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
            outcome = await this.applyOperation(tx, user, operation, authorIsDemo);
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
    authorIsDemo: boolean,
  ): Promise<OperationOutcome> {
    try {
      if (operation.entity === SyncEntity.REPRESENTANT) {
        return await this.applyRepresentant(tx, user, operation, authorIsDemo);
      }
      if (operation.entity === SyncEntity.CALL_ATTEMPT) {
        // La tentative hérite de SON PROSPECT, que `phase2-sync` lit déjà :
        // rien à transmettre ici.
        return await this.applyCallAttempt(tx, user, operation);
      }
      return await this.applyProspect(tx, user, operation, authorIsDemo);
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
    authorIsDemo: boolean,
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
          // LA FICHE SUIT SON AUTEUR. Voir `BatchAuthority.isDemo` : la remontée hors
          // ligne est dispensée de la garde, et l'animateur d'une démonstration
          // saisit sur le téléphone avec un compte de démonstration. Sans cette
          // valeur, la colonne prenait son défaut `false` et la fiche fictive
          // entrait dans l'annuaire RÉEL.
          isDemo: authorIsDemo,
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
      // Inscrite au registre pour que la purge sache la reprendre : sans cela
      // elle retiendrait le compte semé qui l'a créée. Voir `recordDemoEntity`.
      if (authorIsDemo) await recordDemoEntity(tx, 'representant', row.id);
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
        ...(data.fullName ? { fullName: data.fullName.trim() } : {}),
        phoneE164,
        ...(cleared.has('notes')
          ? { notes: null }
          : data.notes !== undefined
            ? { notes: data.notes || null }
            : {}),
        ...(data.departementId ? { departementId: data.departementId } : {}),
        ...(cleared.has('iefId')
          ? { iefId: null }
          : data.iefId === undefined
            ? {}
            : { iefId: data.iefId }),
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

    try {
      const result = await this.phase2Sync.applyCallAttempt(tx, user.id, {
        id: operation.entityId,
        prospectId: data.prospectId,
        outcome: data.outcome,
        ...(data.method === undefined ? {} : { method: data.method }),
        ...(data.comment === undefined ? {} : { comment: data.comment }),
        ...(data.callbackAt === undefined ? {} : { callbackAt: data.callbackAt }),
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
    authorIsDemo: boolean,
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
      const parent = await assertRepresentantUsable(tx, user, data.representantId);
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
          // DEUX SOURCES, EXACTEMENT COMME `prospects.service.ts`. La route
          // HTTP composait déjà `interrupteur || representant.isDemo` ; ce
          // chemin-ci ne posait rien du tout et la colonne prenait son défaut
          // `false`. Une fiche fictive naissait donc RÉELLE sous un
          // représentant fictif : elle entrait dans les listes, les exports et
          // les tirages de campagne (un faux numéro sur une vraie feuille
          // d'appel), et comme `representantId` et `createdById` sont en
          // `onDelete: Restrict`, la purge de démonstration s'arrêtait dessus,
          // rendant le jeu de démonstration indéboulonnable.
          //
          // L'auteur ET le parent, parce qu'aucun des deux ne suffit :
          // l'annuaire de phase 2 n'est pas cloisonné par commercial, un
          // commercial réel peut donc rattacher au représentant d'un autre.
          isDemo: authorIsDemo || parent.isDemo,
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
      if (authorIsDemo || parent.isDemo) await recordDemoEntity(tx, 'prospect', row.id);
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

  // PULL

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
    // situation où l'un ne couvre pas l'autre, le compte de démonstration
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
  /**
   * Nature de l'AUTEUR d'une remontée hors ligne.
   *
   * ═══ POURQUOI CE CHEMIN A BESOIN DE LE SAVOIR ═══
   *
   * `DemoReadOnlyGuard` suspend les écritures pendant une démonstration, mais
   * la synchronisation en est DISPENSÉE, sans condition : refuser la file d'un
   * commercial revenu d'un village sans réseau parce qu'un administrateur a
   * basculé un interrupteur au bureau ferait remonter des saisies valides dans
   * « À corriger ». Cette dispense est une exigence dure.
   *
   * L'en-tête de la garde en tirait la conclusion que « tout ce qui arrive
   * encore par un chemin dispensé est du travail RÉEL, ces chemins écrivent
   * donc isDemo: false ». Cette conclusion était FAUSSE, et elle l'était déjà :
   * l'animateur d'une démonstration se connecte sur le téléphone avec un compte
   * de démonstration, précisément pour montrer la saisie terrain. Ce qu'il
   * pousse n'est pas du travail réel.
   *
   * On lit donc la nature de l'auteur plutôt que de la supposer.
   */
  readonly isDemo: boolean;
}

/**
 * Inscrit au registre de purge une ligne fictive née HORS ensemenceur.
 *
 * ═══ POURQUOI L'HÉRITAGE D'`isDemo` NE SUFFIT PAS ═══
 *
 * `DemoService.purge()` ne supprime QUE les identifiants inscrits dans
 * `demo_entities`, et c'est une propriété qu'il ne faut surtout pas
 * assouplir : purger « tout ce qui porte isDemo » effacerait le jour où un
 * vrai prospect s'y retrouverait par erreur.
 *
 * Mais une ligne fictive absente du registre n'est pas seulement non
 * supprimée : elle BLOQUE la purge entière. `Prospect.representantId`,
 * `Prospect.createdById` et `Representant.createdById` sont tous en
 * `onDelete: Restrict`, si bien qu'un prospect poussé par l'animateur retient
 * le représentant semé, qui retient le compte semé. La purge échoue, et le jeu
 * de démonstration devient indéboulonnable.
 *
 * L'inscription se fait DANS la transaction du groupe : une remontée annulée
 * ne laisse ni la ligne ni son entrée de registre, jamais l'une sans l'autre.
 *
 * `upsert` et non `create` : une fiche supprimée puis ressaisie repasse par la
 * branche de création, et `(entityType, entityId)` est unique.
 *
 * ═══ POURQUOI `update: {}`, C'EST-À-DIRE AUCUNE RE-NUMÉROTATION ═══
 *
 * Une ligne déjà inscrite garde son rang, même si elle vient d'être rattachée
 * à un parent inscrit APRÈS elle. Ce n'est pas un oubli, et le réparer ici
 * serait une faute : hisser la ligne au sommet la ferait passer avant ses
 * propres enfants (tâches d'appel, dossiers bancaires semés sur un prospect),
 * et la purge casserait dans l'autre sens. Aucun rang chronologique ne peut
 * satisfaire les deux contraintes à la fois.
 *
 * C'est donc `DemoService.purge` qui ne s'appuie plus sur la séquence pour
 * l'ordre de suppression, mais sur l'ordre des TYPES, structurellement juste.
 * La séquence ne sert plus qu'à départager deux lignes d'un même type.
 */
async function recordDemoEntity(
  tx: Prisma.TransactionClient,
  entityType: 'representant' | 'prospect',
  entityId: string,
): Promise<void> {
  // Rang le plus élevé, pour que l'inscription reste lisible dans l'ordre où
  // elle a eu lieu. L'ordre de suppression, lui, vient des types.
  const highest = await tx.demoEntity.aggregate({ _max: { sequence: true } });

  await tx.demoEntity.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { entityType, entityId, sequence: (highest._max.sequence ?? -1) + 1 },
    update: {},
  });
}

async function assertRepresentantUsable(
  tx: Prisma.TransactionClient,
  user: AuthenticatedUser,
  representantId: string,
): Promise<{ isDemo: boolean }> {
  const representant = await tx.representant.findFirst({
    where: { id: representantId, deletedAt: null },
    // `isDemo` est LU ici, et c'est le seul endroit où le chemin de
    // synchronisation peut apprendre la nature du parent : le prospect créé en
    // hérite, comme sur la route HTTP.
    select: { id: true, createdById: true, isDemo: true },
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
  return { isDemo: representant.isDemo };
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
  // LECTURE GLOBALE : contrôle d'unicité adossé à l'index global sur le
  // téléphone. Une fiche de démonstration occupe la ligne aussi sûrement
  // qu'une vraie ; la masquer ferait annoncer « numéro libre » puis échouer
  // l'insertion sur une violation d'index, à l'intérieur du lot, sans message
  // exploitable pour l'appareil qui a poussé l'opération.
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
