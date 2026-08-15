import { Injectable, Logger } from '@nestjs/common';
import {
  ClientRequestStatus,
  NotificationAudience,
  NotificationCategory,
  Phase2Status,
  Prisma,
  Role,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizePhone } from '../../common/phone.js';
import { isPrismaKnownError } from '../../common/filters/prisma-exception.filter.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import {
  banqueNotFound,
  clientRequestAlreadyPending,
  clientRequestAlreadyReviewed,
  clientRequestNotFound,
  clientRequestProspectExists,
  representantNotFound,
  syndicatNotFound,
} from './errors.js';
import type {
  ApproveClientRequestDto,
  ClientRequestDto,
  ClientRequestListDto,
  ClientRequestQueryDto,
  CreateClientRequestDto,
  RejectClientRequestDto,
} from './dto.js';

/**
 * Demande de création de client, de la banque vers l'administrateur.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un agent Banque & Finance qui saisit un dossier pour un client absent de la
 * base était dans une impasse totale : « Aucun client ne correspond », et rien
 * ne remontait à personne. Le dossier ne se faisait pas, ou se faisait sur une
 * autre fiche, au hasard.
 *
 * La solution évidente (ouvrir la création de prospect au rôle
 * BANQUE_FINANCE) a été écartée. Un agent bancaire ne voit ni le
 * représentant, ni le syndicat, ni le commercial propriétaire : les fiches
 * qu'il créerait seraient sans paternité et sans département, et toutes les
 * statistiques par apporteur se mettraient à mentir sans que personne ne sache
 * pourquoi. L'arbitrage explicite coûte une journée d'attente ; l'alternative
 * coûte la confiance dans la base.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * L'APPROBATION EST UNE SEULE TRANSACTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Créer le prospect puis marquer la demande approuvée en deux temps laisserait,
 * au premier redémarrage mal placé, un prospect orphelin que personne ne
 * rattacherait jamais à sa demande, et une demande éternellement en attente sur
 * un numéro désormais pris. Les deux écritures partagent donc la même
 * transaction, et la contrainte CHECK
 * `client_creation_requests_approved_has_prospect` interdit en base l'état
 * intermédiaire.
 */

/** Route applicative de l'écran d'arbitrage, ouverte au tap de la notification. */
const REVIEW_ROUTE = '/demandes-clients';

/** Route du tableau de bord bancaire, où le demandeur retrouve son dossier. */
const BANK_ROUTE = '/dossiers';

const INCLUDE = {
  banque: { select: { name: true } },
  requestedBy: { select: { fullName: true } },
  reviewedBy: { select: { fullName: true } },
} satisfies Prisma.ClientCreationRequestInclude;

type RequestRow = Prisma.ClientCreationRequestGetPayload<{ include: typeof INCLUDE }>;

export function toClientRequestDto(row: RequestRow): ClientRequestDto {
  return {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    phoneE164: row.phoneE164,
    note: row.note,
    banqueId: row.banqueId,
    banqueName: row.banque.name,
    requestedById: row.requestedById,
    requestedByName: row.requestedBy.fullName,
    status: row.status,
    reviewedById: row.reviewedById,
    reviewedByName: row.reviewedBy?.fullName ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    rejectionNote: row.rejectionNote,
    createdProspectId: row.createdProspectId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class ClientRequestsService {
  private readonly logger = new Logger(ClientRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly demo: DemoVisibilityService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Dépôt
  // ───────────────────────────────────────────────────────────────────────────

  async create(user: AuthenticatedUser, body: CreateClientRequestDto): Promise<ClientRequestDto> {
    // Normalisé avec la MÊME fonction que partout ailleurs : c'est la seule
    // façon de reconnaître qu'un client « absent » est en réalité déjà en base
    // sous une autre présentation du même numéro.
    const phoneE164 = normalizePhone(body.phone);
    // `enabledForWrite` : cette valeur est ÉCRITE dans `isDemo`, et l'approbation
    // la recopie sur le prospect. Un repli `false` sur panne de lecture ferait
    // d'une demande d'exercice une VRAIE demande, arbitrée pour de bon.
    const demoEnabled = await this.demo.enabledForWrite();

    const banque = await this.prisma.banque.findUnique({
      where: { id: body.banqueId },
      select: { id: true },
    });
    if (!banque) throw banqueNotFound();

    const existingProspect = await this.prisma.prospect.findFirst({
      where: { phoneE164, deletedAt: null, ...demoScope(demoEnabled) },
      select: { id: true },
    });
    if (existingProspect) throw clientRequestProspectExists(phoneE164);

    const pending = await this.prisma.clientCreationRequest.findFirst({
      where: { phoneE164, status: ClientRequestStatus.PENDING, ...demoScope(demoEnabled) },
      select: { id: true },
    });
    if (pending) throw clientRequestAlreadyPending(pending.id);

    const created = await this.prisma.clientCreationRequest
      .create({
        data: {
          nom: body.nom.trim(),
          prenom: body.prenom.trim(),
          phoneE164,
          note: body.note?.trim() || null,
          banqueId: body.banqueId,
          requestedById: user.id,
          // Une demande déposée en mode démonstration produit, à l'approbation,
          // un prospect de démonstration (`approve` recopie ce drapeau). Sans
          // cette propagation, l'agent qui s'exerce fabrique une VRAIE demande,
          // qu'un administrateur arbitre pour de bon et qui devient une fiche
          // réelle qu'éteindre le mode ne fera pas disparaître.
          isDemo: demoEnabled,
        },
        include: INCLUDE,
      })
      .catch(async (error: unknown) => {
        // Le pré-contrôle ci-dessus lit puis écrit : deux agents qui déposent
        // le même numéro à la même seconde le franchissent tous les deux.
        // L'index partiel `client_creation_requests_pending_phone_key` tranche
        // en base ; on retraduit son refus dans le MÊME message métier, faute
        // de quoi le perdant reçoit un 409 « cette valeur existe déjà » qui ne
        // désigne ni le numéro ni la demande à consulter.
        if (!isUniqueViolation(error)) throw error;
        // LECTURE GLOBALE délibérée : on relit la demande que l'index partiel
        // GLOBAL vient de faire gagner. Filtrée, la relecture ne trouverait
        // rien et le message perdrait l'identifiant qu'il doit désigner.
        const rival = await this.prisma.clientCreationRequest.findFirst({
          where: { phoneE164, status: ClientRequestStatus.PENDING },
          select: { id: true },
        });
        throw clientRequestAlreadyPending(rival?.id ?? '');
      });

    await this.notifyAdmins(user, created);
    return toClientRequestDto(created);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lecture
  // ───────────────────────────────────────────────────────────────────────────

  async list(user: AuthenticatedUser, query: ClientRequestQueryDto): Promise<ClientRequestListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const demoEnabled = await this.demo.enabled();

    // Un agent bancaire ne voit QUE ses propres demandes. Rien ne justifie de
    // lui montrer l'identité des clients qu'une autre banque cherche à faire
    // créer : ce serait une fuite entre concurrents, pas une commodité.
    const scope: Prisma.ClientCreationRequestWhereInput =
      user.role === Role.ADMIN ? {} : { requestedById: user.id };

    const search = query.search?.trim();
    const where: Prisma.ClientCreationRequestWhereInput = {
      ...scope,
      ...demoScope(demoEnabled),
      ...(query.status ? { status: query.status } : {}),
      ...(query.banqueId ? { banqueId: query.banqueId } : {}),
      ...(search
        ? {
            OR: [
              { nom: { contains: search, mode: 'insensitive' } },
              { prenom: { contains: search, mode: 'insensitive' } },
              { phoneE164: { contains: search.replace(/[^\d+]/g, '') } },
            ],
          }
        : {}),
    };

    const [total, rows, pendingCount] = await Promise.all([
      this.prisma.clientCreationRequest.count({ where }),
      this.prisma.clientCreationRequest.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.clientCreationRequest.count({
        where: { ...scope, ...demoScope(demoEnabled), status: ClientRequestStatus.PENDING },
      }),
    ]);

    return {
      items: rows.map(toClientRequestDto),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
      pendingCount,
    };
  }

  async get(user: AuthenticatedUser, id: string): Promise<ClientRequestDto> {
    const row = await this.prisma.clientCreationRequest.findFirst({
      where: {
        id,
        ...demoScope(await this.demo.enabled()),
        ...(user.role === Role.ADMIN ? {} : { requestedById: user.id }),
      },
      include: INCLUDE,
    });
    if (!row) throw clientRequestNotFound();
    return toClientRequestDto(row);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Arbitrage
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Approuve la demande et crée le prospect, dans une seule transaction.
   *
   * Le prospect naît en `METHOD_OBTAINED` : c'est la condition EXACTE du filtre
   * de recherche de la banque (`bank-cases.service.ts`, `prospectSearch`).
   * Le créer en `PENDING` produirait une fiche invisible à celui-là même qui
   * l'a demandée, et la demande paraîtrait approuvée sans rien débloquer.
   */
  async approve(
    user: AuthenticatedUser,
    id: string,
    body: ApproveClientRequestDto,
  ): Promise<ClientRequestDto> {
    const request = await this.loadPending(id);

    const [representant, syndicat] = await Promise.all([
      this.prisma.representant.findFirst({
        where: {
          id: body.representantId,
          deletedAt: null,
          ...demoScope(await this.demo.enabled()),
        },
        select: { id: true },
      }),
      this.prisma.syndicat.findUnique({ where: { id: body.syndicatId }, select: { id: true } }),
    ]);
    if (!representant) throw representantNotFound();
    if (!syndicat) throw syndicatNotFound();

    const banqueId = body.banqueId ?? request.banqueId;
    if (body.banqueId) {
      const banque = await this.prisma.banque.findUnique({
        where: { id: body.banqueId },
        select: { id: true },
      });
      if (!banque) throw banqueNotFound();
    }

    // Relu juste avant d'écrire : entre le dépôt de la demande et son
    // arbitrage, un commercial a très bien pu saisir la fiche sur le terrain.
    //
    // LECTURE GLOBALE délibérée : l'unicité du téléphone d'un prospect est
    // portée par un index partiel GLOBAL. Filtré, ce contrôle laisserait
    // l'approbation créer un prospect que la base refuse, et la transaction
    // échouerait sur un message que l'administrateur ne peut pas relier à la
    // demande qu'il vient d'approuver.
    const clash = await this.prisma.prospect.findFirst({
      where: { phoneE164: request.phoneE164, deletedAt: null },
      select: { id: true },
    });
    if (clash) throw clientRequestProspectExists(request.phoneE164);

    const prospectId = uuidv7();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.prospect.create({
        data: {
          id: prospectId,
          nom: request.nom,
          prenom: request.prenom,
          phoneE164: request.phoneE164,
          banqueId,
          syndicatId: body.syndicatId,
          representantId: body.representantId,
          createdById: user.id,
          // Provenance tracée : c'est ce qui permet de mesurer ce qui entre
          // hors base au lieu de le deviner. Le libellé recopie le nom de la
          // banque plutôt que sa clé, pour survivre à un renommage du
          // référentiel, exactement comme l'identité figée d'un dossier.
          origin: 'BANQUE',
          originLabel: request.banque.name,
          phase2Status: Phase2Status.METHOD_OBTAINED,
          enrollmentMethod: body.enrollmentMethod,
          enrollmentCapturedAt: now,
          enrollmentCapturedById: user.id,
          clientCreatedAt: body.clientCreatedAt
            ? new Date(body.clientCreatedAt)
            : request.createdAt,
          // La demande de démonstration produit un prospect de démonstration :
          // sans cette propagation, éteindre le mode laisserait une fiche
          // fictive visible dans un export réel.
          isDemo: request.isDemo,
        },
      });

      // L'ARBITRAGE SE GAGNE ICI, pas dans la lecture faite plus haut.
      //
      // `loadPending` lit HORS transaction : deux administrateurs qui ouvrent
      // le même écran la franchissent tous les deux. Écrire ensuite sans
      // condition laissait le second écraser le premier, d'où une demande
      // REJECTED portant un `createdProspectId`, un prospect réellement créé
      // que plus rien ne désigne, et deux notifications contradictoires
      // envoyées à la banque. L'écriture CONDITIONNELLE fait gagner le premier :
      // sous READ COMMITTED, la seconde transaction se bloque sur le verrou de
      // ligne, réévalue son `where` après le commit et ne met rien à jour.
      //
      // Elle vient APRÈS la création du prospect, et non avant : la clé
      // étrangère `createdProspectId` est vérifiée immédiatement, désigner une
      // ligne pas encore écrite échouerait. Le perdant fait avorter la
      // transaction, ce qui défait le prospect avec elle.
      const claimed = await tx.clientCreationRequest.updateMany({
        where: { id, status: ClientRequestStatus.PENDING },
        data: {
          status: ClientRequestStatus.APPROVED,
          reviewedById: user.id,
          reviewedAt: now,
          createdProspectId: prospectId,
        },
      });
      if (claimed.count === 0) throw clientRequestAlreadyReviewed(ClientRequestStatus.APPROVED);
    });

    this.logger.log(`Demande ${id} approuvée : prospect ${prospectId} créé (provenance BANQUE).`);

    const updated = await this.reload(id);
    await this.notifyRequester(user, updated, true);
    return toClientRequestDto(updated);
  }

  async reject(
    user: AuthenticatedUser,
    id: string,
    body: RejectClientRequestDto,
  ): Promise<ClientRequestDto> {
    await this.loadPending(id);

    // Même garde que l'approbation, et pour la même raison : la lecture
    // ci-dessus ne verrouille rien. Sans le `status: PENDING` dans le `where`,
    // un refus arrivé une seconde après une approbation repasserait la demande
    // en REJECTED tout en lui laissant son `createdProspectId` et son prospect
    // bien réel, état que la contrainte CHECK n'interdit pas et que l'écran
    // d'arbitrage affiche comme un refus ayant créé un client.
    const claimed = await this.prisma.clientCreationRequest.updateMany({
      where: { id, status: ClientRequestStatus.PENDING },
      data: {
        status: ClientRequestStatus.REJECTED,
        reviewedById: user.id,
        reviewedAt: new Date(),
        rejectionNote: body.reason.trim(),
      },
    });
    if (claimed.count === 0) throw clientRequestAlreadyReviewed(ClientRequestStatus.REJECTED);

    const updated = await this.reload(id);
    await this.notifyRequester(user, updated, false);
    return toClientRequestDto(updated);
  }

  // ───────────────────────────────────────────────────────────────────────────

  private async loadPending(id: string): Promise<RequestRow> {
    const row = await this.prisma.clientCreationRequest.findFirst({
      where: { id, ...demoScope(await this.demo.enabled()) },
      include: INCLUDE,
    });
    if (!row) throw clientRequestNotFound();
    if (row.status !== ClientRequestStatus.PENDING) {
      throw clientRequestAlreadyReviewed(row.status);
    }
    return row;
  }

  private async reload(id: string): Promise<RequestRow> {
    const row = await this.prisma.clientCreationRequest.findFirst({
      where: { id, ...demoScope(await this.demo.enabled()) },
      include: INCLUDE,
    });
    if (!row) throw clientRequestNotFound();
    return row;
  }

  /**
   * Prévient les administrateurs qu'une demande attend.
   *
   * L'échec de la notification n'annule PAS la demande : elle est déjà écrite,
   * et la perdre parce que le canal d'alerte est indisponible remettrait
   * l'agent bancaire dans l'impasse que ce module lève. L'écran d'arbitrage
   * reste consultable sans notification.
   */
  private async notifyAdmins(user: AuthenticatedUser, request: RequestRow): Promise<void> {
    await this.safely('dépôt', () =>
      this.notifications.create(user, {
        title: 'Demande de création de client',
        body: `${request.banque.name} demande la création de ${request.prenom} ${request.nom} (${request.phoneE164}).`,
        category: NotificationCategory.SYSTEME,
        route: REVIEW_ROUTE,
        audience: NotificationAudience.ROLE,
        audienceRole: Role.ADMIN,
      }),
    );
  }

  private async notifyRequester(
    user: AuthenticatedUser,
    request: RequestRow,
    approved: boolean,
  ): Promise<void> {
    await this.safely('arbitrage', () =>
      this.notifications.create(user, {
        title: approved ? 'Client créé' : 'Demande de création refusée',
        body: approved
          ? `${request.prenom} ${request.nom} est désormais en base : le dossier peut lui être rattaché.`
          : `${request.prenom} ${request.nom} : ${request.rejectionNote ?? 'sans motif'}.`,
        category: NotificationCategory.SYSTEME,
        route: approved ? BANK_ROUTE : REVIEW_ROUTE,
        audience: NotificationAudience.USERS,
        audienceUserIds: [request.requestedById],
      }),
    );
  }

  private async safely(step: string, run: () => Promise<unknown>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.warn(
        `Notification de ${step} non émise : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** Violation d'unicité PostgreSQL, telle que Prisma la remonte. */
const isUniqueViolation = (error: unknown): boolean =>
  isPrismaKnownError(error) && error.code === 'P2002';
