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

const REVIEW_ROUTE = '/demandes-clients';

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

  async create(user: AuthenticatedUser, body: CreateClientRequestDto): Promise<ClientRequestDto> {
    const phoneE164 = normalizePhone(body.phone);
    // `enabledForWrite` et non `enabled` : cette valeur est écrite dans `isDemo`, et un repli
    // `false` sur panne de lecture ferait d'une demande d'exercice une vraie demande.
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
          isDemo: demoEnabled,
        },
        include: INCLUDE,
      })
      .catch(async (error: unknown) => {
        // Le pré-contrôle ci-dessus lit puis écrit : c'est l'index partiel
        // `client_creation_requests_pending_phone_key` qui tranche deux dépôts simultanés.
        if (!isUniqueViolation(error)) throw error;
        // LECTURE GLOBALE : on relit la demande que cet index partiel global vient de faire
        // gagner ; filtrée, la relecture ne trouverait rien et le message perdrait son identifiant.
        const rival = await this.prisma.clientCreationRequest.findFirst({
          where: { phoneE164, status: ClientRequestStatus.PENDING },
          select: { id: true },
        });
        throw clientRequestAlreadyPending(rival?.id ?? '');
      });

    await this.notifyAdmins(user, created);
    return toClientRequestDto(created);
  }

  async list(user: AuthenticatedUser, query: ClientRequestQueryDto): Promise<ClientRequestListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const demoEnabled = await this.demo.enabled();

    // Un agent bancaire ne voit que ses propres demandes : les autres révéleraient à une banque
    // les clients qu'une concurrente cherche à faire créer.
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

  /**
   * Le prospect naît en `METHOD_OBTAINED` : c'est la condition exacte du filtre de recherche de
   * la banque (`bank-cases.service.ts`, `prospectSearch`), sans quoi il lui resterait invisible.
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
          isDemo: request.isDemo,
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

    // LECTURE GLOBALE : l'unicité du téléphone d'un prospect est portée par un index partiel
    // global ; filtré, ce contrôle laisserait l'approbation créer un prospect que la base refuse.
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
          // Le libellé recopie le nom de la banque plutôt que sa clé, pour survivre à un
          // renommage du référentiel.
          origin: 'BANQUE',
          originLabel: request.banque.name,
          phase2Status: Phase2Status.METHOD_OBTAINED,
          enrollmentMethod: body.enrollmentMethod,
          enrollmentCapturedAt: now,
          enrollmentCapturedById: user.id,
          clientCreatedAt: body.clientCreatedAt
            ? new Date(body.clientCreatedAt)
            : request.createdAt,
          isDemo: request.isDemo,
        },
      });

      // L'arbitrage se gagne par cette écriture CONDITIONNELLE, pas par le `loadPending` hors
      // transaction : sur `status: PENDING` dans le `where`, le second arbitre ne met rien à jour.
      // Elle vient après la création du prospect car la clé étrangère `createdProspectId` est
      // vérifiée immédiatement ; le perdant fait avorter la transaction, qui défait le prospect.
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

    // Même écriture conditionnelle qu'à l'approbation : sans `status: PENDING`, un refus arrivé
    // après une approbation laisserait une demande REJECTED portant un `createdProspectId`.
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
      where: { id },
      include: INCLUDE,
    });
    if (!row) throw clientRequestNotFound();
    return row;
  }

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

  // L'échec d'une notification n'annule pas la demande, déjà écrite : la perdre sur une panne du
  // canal d'alerte remettrait l'agent bancaire dans l'impasse que ce module lève.
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

const isUniqueViolation = (error: unknown): boolean =>
  isPrismaKnownError(error) && error.code === 'P2002';
