import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, classifySegment } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service.js';
import { lastAttemptsByProspect, type LastAttempt } from './last-attempt.js';
import { normalizePhone } from '../../common/phone.js';
import { assertOwnership, isAdmin, ownerScope } from '../../common/scope.js';
import { buildProspectWhere } from '../../common/prospect-where.js';
import { ProspectSortField, SortOrder } from '../../common/dto/prospect-filter.dto.js';
import type { ProspectQueryDto } from '../../common/dto/prospect-filter.dto.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { OkDto } from '../../common/dto/ok.dto.js';
import type {
  CreateProspectDto,
  MergeProspectsDto,
  ProspectDto,
  ProspectListDto,
  ReassignProspectsDto,
  ReassignResultDto,
  UpdateProspectDto,
} from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';

export const PROSPECT_INCLUDE = {
  // `shortName` en plus de `name` : c'est lui, et non le nom complet, qui porte
  // l'axe CBAO de la segmentation.
  banque: { select: { name: true, shortName: true } },
  syndicat: { select: { sigle: true } },
  createdBy: { select: { id: true, fullName: true } },
  enrollmentCapturedBy: { select: { id: true, fullName: true } },
  representant: {
    select: {
      fullName: true,
      phoneE164: true,
      departementId: true,
      departement: { select: { name: true } },
    },
  },
} satisfies Prisma.ProspectInclude;

type ProspectRow = Prisma.ProspectGetPayload<{ include: typeof PROSPECT_INCLUDE }>;

export function toProspectDto(row: ProspectRow, lastAttempt?: LastAttempt): ProspectDto {
  return {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    phoneE164: row.phoneE164,
    rev: row.rev,
    statut: row.statut,
    banqueId: row.banqueId,
    banqueName: row.banque.name,
    syndicatId: row.syndicatId,
    syndicatSigle: row.syndicat.sigle,
    representantId: row.representantId,
    representantName: row.representant.fullName,
    representantPhoneE164: row.representant.phoneE164,
    departementId: row.representant.departementId,
    departementName: row.representant.departement.name,
    ownedByCommercialId: row.createdBy.id,
    ownedByCommercialName: row.createdBy.fullName,
    // Définition UNIQUE du croisement : le même helper sert au filtrage, aux
    // statistiques et aux onglets du classeur.
    segment: classifySegment({
      syndicatSigle: row.syndicat.sigle,
      banqueShortName: row.banque.shortName,
    }),
    phase2Status: row.phase2Status,
    enrollmentMethod: row.enrollmentMethod,
    enrollmentCapturedById: row.enrollmentCapturedById,
    enrollmentCapturedByName: row.enrollmentCapturedBy?.fullName ?? null,
    enrollmentCapturedAt: row.enrollmentCapturedAt?.toISOString() ?? null,
    lastOutcome: lastAttempt?.outcome ?? null,
    lastComment: lastAttempt?.comment ?? null,
    lastAttemptAt: lastAttempt?.at.toISOString() ?? null,
    clientCreatedAt: row.clientCreatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class ProspectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async list(user: AuthenticatedUser, query: ProspectQueryDto): Promise<ProspectListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    // Cloisonnement inclus dans buildProspectWhere : la liste, les agrégats et
    // l'export partagent la même clause, donc la même portée.
    const where = buildProspectWhere(user, query, await this.demo.enabled());

    const sortBy = query.sortBy ?? ProspectSortField.CLIENT_CREATED_AT;
    const sortOrder = query.sortOrder ?? SortOrder.DESC;

    const [total, rows] = await Promise.all([
      this.prisma.prospect.count({ where }),
      this.prisma.prospect.findMany({
        where,
        include: PROSPECT_INCLUDE,
        // `id` en second critère : sans lui, deux lignes de même date peuvent
        // s'échanger entre deux pages et l'une disparaît de la pagination.
        orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // UNE seule requête supplémentaire pour toute la page, quel que soit son
    // nombre de lignes. La variante évidente — lire les tentatives dans le
    // `include` ou par ligne — produirait un aller-retour par prospect affiché.
    const attempts = await lastAttemptsByProspect(
      this.prisma,
      rows.map((row) => row.id),
    );

    return {
      items: rows.map((row) => toProspectDto(row, attempts.get(row.id))),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async get(user: AuthenticatedUser, id: string): Promise<ProspectDto> {
    const row = await this.prisma.prospect.findFirst({
      where: { id, deletedAt: null },
      include: PROSPECT_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'Prospect introuvable.' });
    }
    assertOwnership(user, row);
    const attempts = await lastAttemptsByProspect(this.prisma, [row.id]);
    return toProspectDto(row, attempts.get(row.id));
  }

  async create(user: AuthenticatedUser, input: CreateProspectDto): Promise<ProspectDto> {
    const phoneE164 = normalizePhone(input.phone);
    const id = input.id ?? uuidv7();

    await this.assertIdAvailable(user, id);
    await this.assertRepresentantUsable(user, input.representantId);
    await this.assertPhoneFree(phoneE164);

    const created = await this.prisma.prospect.create({
      data: {
        id,
        nom: input.nom.trim(),
        prenom: input.prenom.trim(),
        phoneE164,
        banqueId: input.banqueId,
        syndicatId: input.syndicatId,
        representantId: input.representantId,
        createdById: user.id,
        ...(input.statut ? { statut: input.statut } : {}),
        clientCreatedAt: input.clientCreatedAt ? new Date(input.clientCreatedAt) : new Date(),
      },
      include: PROSPECT_INCLUDE,
    });
    return toProspectDto(created);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    input: UpdateProspectDto,
  ): Promise<ProspectDto> {
    const existing = await this.prisma.prospect.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'Prospect introuvable.' });
    }
    assertOwnership(user, existing);

    const phoneE164 = input.phone ? normalizePhone(input.phone) : undefined;
    if (phoneE164 && phoneE164 !== existing.phoneE164) await this.assertPhoneFree(phoneE164, id);
    if (input.representantId && input.representantId !== existing.representantId) {
      await this.assertRepresentantUsable(user, input.representantId);
    }

    const updated = await this.prisma.prospect.update({
      where: { id },
      data: {
        ...(input.nom ? { nom: input.nom.trim() } : {}),
        ...(input.prenom ? { prenom: input.prenom.trim() } : {}),
        ...(phoneE164 ? { phoneE164 } : {}),
        ...(input.banqueId ? { banqueId: input.banqueId } : {}),
        ...(input.syndicatId ? { syndicatId: input.syndicatId } : {}),
        ...(input.representantId ? { representantId: input.representantId } : {}),
        ...(input.statut ? { statut: input.statut } : {}),
        ...(input.clientCreatedAt ? { clientCreatedAt: new Date(input.clientCreatedAt) } : {}),
        rev: { increment: 1 },
      },
      include: PROSPECT_INCLUDE,
    });
    // La fiche peut déjà porter des tentatives d'appel : les omettre ici
    // renverrait au client une réponse qui contredit la liste dont il vient.
    const attempts = await lastAttemptsByProspect(this.prisma, [updated.id]);
    return toProspectDto(updated, attempts.get(updated.id));
  }

  async remove(user: AuthenticatedUser, id: string): Promise<OkDto> {
    const existing = await this.prisma.prospect.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'Prospect introuvable.' });
    }
    assertOwnership(user, existing);

    // Suppression logique : l'index unique sur le téléphone étant PARTIEL
    // (`WHERE deletedAt IS NULL`), le numéro redevient immédiatement
    // ressaisissable. C'est la raison d'être de cet index partiel.
    await this.prisma.prospect.update({
      where: { id },
      data: { deletedAt: new Date(), rev: { increment: 1 } },
    });
    return { ok: true };
  }

  /**
   * Fusionne deux fiches désignant la même personne.
   *
   * La source est supprimée logiquement dans la MÊME transaction que la mise à
   * jour de la cible : entre les deux, les deux fiches partageraient le même
   * numéro vivant et l'index unique partiel refuserait l'écriture.
   */
  async merge(user: AuthenticatedUser, input: MergeProspectsDto): Promise<ProspectDto> {
    if (input.sourceId === input.targetId) {
      throw new BadRequestException({
        code: 'MERGE_SAME_PROSPECT',
        message: 'Impossible de fusionner une fiche avec elle-même.',
      });
    }

    const [target, source] = await Promise.all([
      this.prisma.prospect.findFirst({ where: { id: input.targetId, deletedAt: null } }),
      this.prisma.prospect.findFirst({ where: { id: input.sourceId, deletedAt: null } }),
    ]);
    if (!target || !source) {
      throw new NotFoundException({
        code: 'PROSPECT_NOT_FOUND',
        message: 'L’une des deux fiches est introuvable.',
      });
    }
    assertOwnership(user, target);
    assertOwnership(user, source);

    const merged = await this.prisma.$transaction(async (tx) => {
      await tx.prospect.update({
        where: { id: source.id },
        data: { deletedAt: new Date(), rev: { increment: 1 } },
      });
      return tx.prospect.update({
        where: { id: target.id },
        data: {
          ...(input.preferSource
            ? {
                nom: source.nom,
                prenom: source.prenom,
                phoneE164: source.phoneE164,
                banqueId: source.banqueId,
                syndicatId: source.syndicatId,
                statut: source.statut,
              }
            : {}),
          // La date de saisie retenue est la PLUS ANCIENNE des deux : c'est
          // celle du premier contact réel, et les statistiques d'activité
          // s'appuient dessus.
          clientCreatedAt:
            source.clientCreatedAt < target.clientCreatedAt
              ? source.clientCreatedAt
              : target.clientCreatedAt,
          rev: { increment: 1 },
        },
        include: PROSPECT_INCLUDE,
      });
    });

    const attempts = await lastAttemptsByProspect(this.prisma, [merged.id]);
    return toProspectDto(merged, attempts.get(merged.id));
  }

  /** Réaffecte des prospects à un autre représentant, et pour l'ADMIN à un autre commercial. */
  async reassign(user: AuthenticatedUser, input: ReassignProspectsDto): Promise<ReassignResultDto> {
    if (!input.prospectIds.length) return { updated: 0, prospectIds: [] };
    if (!input.representantId && !input.commercialId) {
      throw new BadRequestException({
        code: 'REASSIGN_NO_TARGET',
        message: 'Indiquez au moins un représentant ou un commercial de destination.',
      });
    }
    if (input.commercialId && !isAdmin(user)) {
      throw new ForbiddenException({
        code: 'REASSIGN_OWNER_FORBIDDEN',
        message: 'Seul un administrateur peut changer le commercial propriétaire.',
      });
    }

    // Le `where` porte le cloisonnement : un COMMERCIAL ne peut désigner que
    // ses propres lignes, et les identifiants qui ne lui appartiennent pas
    // sortent simplement de l'ensemble au lieu de lever.
    const rows = await this.prisma.prospect.findMany({
      where: { id: { in: input.prospectIds }, deletedAt: null, ...ownerScope(user) },
      select: { id: true },
    });
    if (!rows.length) return { updated: 0, prospectIds: [] };

    if (input.representantId) await this.assertRepresentantUsable(user, input.representantId);
    if (input.commercialId) {
      const owner = await this.prisma.user.findFirst({
        where: { id: input.commercialId, deletedAt: null },
        select: { id: true },
      });
      if (!owner) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: 'Commercial de destination introuvable.',
        });
      }
    }

    const ids = rows.map((row) => row.id);
    const result = await this.prisma.prospect.updateMany({
      where: { id: { in: ids } },
      data: {
        ...(input.representantId ? { representantId: input.representantId } : {}),
        ...(input.commercialId ? { createdById: input.commercialId } : {}),
        rev: { increment: 1 },
      },
    });
    return { updated: result.count, prospectIds: ids };
  }

  /**
   * Le représentant de rattachement doit exister et être visible par
   * l'appelant. Sans ce contrôle, un COMMERCIAL pourrait accrocher ses
   * prospects sous le représentant d'un collègue et les faire apparaître dans
   * la synchro de ce dernier.
   */
  private async assertRepresentantUsable(
    user: AuthenticatedUser,
    representantId: string,
  ): Promise<void> {
    const representant = await this.prisma.representant.findFirst({
      where: { id: representantId, deletedAt: null },
      select: { id: true, createdById: true },
    });
    if (!representant) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }
    assertOwnership(user, representant, 'Ce représentant appartient à un autre commercial.');
  }

  private async assertIdAvailable(user: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.prisma.prospect.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });
    if (!existing) return;
    if (!isAdmin(user) && existing.createdById !== user.id) {
      throw new ForbiddenException({
        code: 'ENTITY_ID_OWNED_BY_ANOTHER_USER',
        message: 'Cet identifiant appartient à un autre commercial.',
      });
    }
    throw new ConflictException({
      code: 'PROSPECT_ALREADY_EXISTS',
      message: 'Un prospect porte déjà cet identifiant.',
      existingId: id,
    });
  }

  /**
   * 409 nommant la fiche existante ET son commercial.
   *
   * C'est le contrat que l'app mobile exploite pour afficher « Déjà enregistré
   * par Fatou Ndiaye » : sans le nom, l'utilisateur ne peut rien faire de
   * l'erreur, et la même saisie sera retentée indéfiniment.
   */
  private async assertPhoneFree(phoneE164: string, exceptId?: string): Promise<void> {
    const clash = await this.prisma.prospect.findFirst({
      where: {
        phoneE164,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        representant: { select: { id: true, fullName: true } },
      },
    });
    if (!clash) return;

    throw new ConflictException({
      code: 'PROSPECT_PHONE_CONFLICT',
      message: `Ce numéro a déjà été enregistré par ${clash.createdBy.fullName}.`,
      existing: {
        id: clash.id,
        nom: clash.nom,
        prenom: clash.prenom,
        representantId: clash.representant.id,
        representantName: clash.representant.fullName,
        ownedByCommercialId: clash.createdBy.id,
        ownedByCommercialName: clash.createdBy.fullName,
        createdAt: clash.createdAt.toISOString(),
      },
    });
  }
}
