import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizePhone } from '../../common/phone.js';
import { assertOwnership, isAdmin, ownerScope } from '../../common/scope.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { OkDto } from '../../common/dto/ok.dto.js';
import type {
  CreateRepresentantDto,
  DeleteQueryDto,
  RepresentantDto,
  RepresentantListDto,
  RepresentantLookupDto,
  RepresentantQueryDto,
  UpdateRepresentantDto,
} from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';

export const REPRESENTANT_INCLUDE = {
  departement: { select: { name: true } },
  ief: { select: { name: true } },
  createdBy: { select: { id: true, fullName: true } },
  _count: { select: { prospects: { where: { deletedAt: null } } } },
} satisfies Prisma.RepresentantInclude;

const INCLUDE = REPRESENTANT_INCLUDE;

type RepresentantRow = Prisma.RepresentantGetPayload<{ include: typeof REPRESENTANT_INCLUDE }>;

export function toRepresentantDto(row: RepresentantRow): RepresentantDto {
  return {
    id: row.id,
    fullName: row.fullName,
    phoneE164: row.phoneE164,
    notes: row.notes,
    rev: row.rev,
    departementId: row.departementId,
    departementName: row.departement.name,
    iefId: row.iefId,
    iefName: row.ief?.name ?? null,
    createdById: row.createdById,
    createdByName: row.createdBy.fullName,
    clientCreatedAt: row.clientCreatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    prospectCount: row._count.prospects,
  };
}

@Injectable()
export class RepresentantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async list(user: AuthenticatedUser, query: RepresentantQueryDto): Promise<RepresentantListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    // Le cloisonnement est composé ICI, dans le service : posé dans le
    // contrôleur, il dépendrait de la discipline de chaque route.
    const where: Prisma.RepresentantWhereInput = {
      deletedAt: null,
      ...ownerScope(user),
      ...demoScope(await this.demo.enabled()),
    };
    if (query.commercialId) {
      where.createdById = isAdmin(user)
        ? query.commercialId
        : query.commercialId === user.id
          ? user.id
          : '__aucun__';
    }
    if (query.departementId) where.departementId = query.departementId;
    if (query.iefId) where.iefId = query.iefId;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phoneE164: { contains: search.replace(/[^\d+]/g, '') } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.representant.count({ where }),
      this.prisma.representant.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ clientCreatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toRepresentantDto),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async get(user: AuthenticatedUser, id: string): Promise<RepresentantDto> {
    const row = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }
    assertOwnership(user, row);
    return toRepresentantDto(row);
  }

  /**
   * Recherche par téléphone, avant saisie.
   *
   * Répond même quand la fiche appartient à un AUTRE commercial : c'est tout
   * l'objet de l'endpoint. Le commercial doit apprendre que ce représentant est
   * déjà connu et par qui, sinon il ressaisit une fiche que la contrainte
   * d'unicité rejettera sans lui dire pourquoi. Seul le nom du propriétaire est
   * divulgué, pas ses prospects.
   */
  async lookup(user: AuthenticatedUser, phone: string): Promise<RepresentantLookupDto> {
    const phoneE164 = normalizePhone(phone);
    const row = await this.prisma.representant.findFirst({
      where: { phoneE164, deletedAt: null },
      include: INCLUDE,
    });

    if (!row) {
      return {
        found: false,
        phoneE164,
        representant: null,
        ownedByCommercialId: null,
        ownedByCommercialName: null,
      };
    }

    return {
      found: true,
      phoneE164,
      representant: toRepresentantDto(row),
      ownedByCommercialId: row.createdById,
      ownedByCommercialName: row.createdBy.fullName,
    };
  }

  async create(user: AuthenticatedUser, input: CreateRepresentantDto): Promise<RepresentantDto> {
    const phoneE164 = normalizePhone(input.phone);
    const id = input.id ?? uuidv7();

    // Garde anti-squat d'identifiant : le client choisit l'UUID, donc il peut
    // en poster un qui existe déjà. Écraser silencieusement la fiche d'un
    // collègue serait la pire issue possible.
    await this.assertIdAvailable(user, id);
    await this.assertPhoneFree(phoneE164);

    const created = await this.prisma.representant.create({
      data: {
        id,
        fullName: input.fullName.trim(),
        phoneE164,
        ...(input.notes ? { notes: input.notes } : {}),
        departementId: input.departementId,
        iefId: input.iefId ?? null,
        createdById: user.id,
        clientCreatedAt: input.clientCreatedAt ? new Date(input.clientCreatedAt) : new Date(),
      },
      include: INCLUDE,
    });
    return toRepresentantDto(created);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    input: UpdateRepresentantDto,
  ): Promise<RepresentantDto> {
    const existing = await this.prisma.representant.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }
    assertOwnership(user, existing);

    const phoneE164 = input.phone ? normalizePhone(input.phone) : undefined;
    if (phoneE164 && phoneE164 !== existing.phoneE164) await this.assertPhoneFree(phoneE164);

    const updated = await this.prisma.representant.update({
      where: { id },
      data: {
        ...(input.fullName ? { fullName: input.fullName.trim() } : {}),
        ...(phoneE164 ? { phoneE164 } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        ...(input.departementId ? { departementId: input.departementId } : {}),
        ...(input.iefId === undefined ? {} : { iefId: input.iefId }),
        ...(input.clientCreatedAt ? { clientCreatedAt: new Date(input.clientCreatedAt) } : {}),
        rev: { increment: 1 },
      },
      include: INCLUDE,
    });
    return toRepresentantDto(updated);
  }

  async remove(user: AuthenticatedUser, id: string, query: DeleteQueryDto): Promise<OkDto> {
    const existing = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { prospects: { where: { deletedAt: null } } } } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }
    assertOwnership(user, existing);

    if (existing._count.prospects > 0 && !query.cascade) {
      // Refus explicite plutôt que cascade implicite : supprimer un
      // représentant emporte tous ses prospects, ce qui doit être une décision
      // consciente et non l'effet de bord d'un clic.
      throw new ConflictException({
        code: 'REPRESENTANT_HAS_PROSPECTS',
        message: `Ce représentant porte ${String(existing._count.prospects)} prospect(s). Relancez avec cascade=true pour tout supprimer.`,
        prospectCount: existing._count.prospects,
      });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.prospect.updateMany({
        where: { representantId: id, deletedAt: null },
        data: { deletedAt: now, rev: { increment: 1 } },
      }),
      this.prisma.representant.update({
        where: { id },
        data: { deletedAt: now, rev: { increment: 1 } },
      }),
    ]);
    return { ok: true };
  }

  /**
   * Un identifiant déjà pris doit appartenir au même commercial, sinon 403.
   * Renvoyer 404 ou écraser reviendrait à laisser un client réécrire la fiche
   * d'un autre en devinant un UUID.
   */
  private async assertIdAvailable(user: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.prisma.representant.findUnique({
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
      code: 'REPRESENTANT_ALREADY_EXISTS',
      message: 'Un représentant porte déjà cet identifiant.',
      existingId: id,
    });
  }

  private async assertPhoneFree(phoneE164: string): Promise<void> {
    const clash = await this.prisma.representant.findFirst({
      where: { phoneE164, deletedAt: null },
      include: { createdBy: { select: { id: true, fullName: true } } },
    });
    if (!clash) return;
    throw new ConflictException({
      code: 'REPRESENTANT_PHONE_CONFLICT',
      message: 'Ce numéro est déjà enregistré pour un représentant.',
      existing: {
        id: clash.id,
        fullName: clash.fullName,
        phoneE164: clash.phoneE164,
        ownedByCommercialId: clash.createdBy.id,
        ownedByCommercialName: clash.createdBy.fullName,
        createdAt: clash.createdAt.toISOString(),
      },
    });
  }
}
