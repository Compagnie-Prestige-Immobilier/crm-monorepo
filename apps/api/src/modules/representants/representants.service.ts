import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChangeSource, Prisma } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizePhone } from '../../common/phone.js';
import {
  assertOwnership,
  assertReadable,
  isAdmin,
  readScope,
  readsEveryone,
} from '../../common/scope.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { OkDto } from '../../common/dto/ok.dto.js';
import { RepresentantSortField } from './dto.js';
import type {
  CreateRepresentantDto,
  DeleteQueryDto,
  RepresentantDto,
  RepresentantListDto,
  RepresentantLookupDto,
  RepresentantQueryDto,
  UpdateRepresentantDto,
  RepresentantRelationChangeListDto,
} from './dto.js';
import { applyRelationChange, toRelationChangeDto } from './relation-change.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';

export const REPRESENTANT_INCLUDE = {
  departement: { select: { name: true } },
  ief: { select: { name: true } },
  createdBy: { select: { id: true, fullName: true } },
  _count: { select: { prospects: { where: { deletedAt: null } } } },
} satisfies Prisma.RepresentantInclude;

const INCLUDE = REPRESENTANT_INCLUDE;

/**
 * Tri de la liste, toujours DÉPARTAGÉ par l'identifiant.
 *
 * Sans ce second critère, deux représentants saisis dans la même seconde
 * peuvent changer de place d'une page à l'autre : la ligne 25 réapparaît en
 * tête de la page 2 et une autre disparaît, ce qui se lit comme une perte de
 * données. `id` est un UUID v7, donc lexicographiquement ordonné dans le temps :
 * il départage sans jamais introduire d'ordre arbitraire.
 *
 * `PROSPECTS` trie sur le COMPTE de la relation, ce que Prisma sait faire par
 * `_count`. Le calculer côté Node imposerait de charger toute la population
 * avant de pouvoir paginer.
 */
function orderByFor(query: RepresentantQueryDto): Prisma.RepresentantOrderByWithRelationInput[] {
  const direction = query.sortOrder ?? 'desc';

  switch (query.sortBy) {
    case RepresentantSortField.FULL_NAME:
      return [{ fullName: direction }, { id: 'desc' }];
    case RepresentantSortField.CREATED_AT:
      return [{ createdAt: direction }, { id: 'desc' }];
    case RepresentantSortField.PROSPECTS:
      return [{ prospects: { _count: direction } }, { id: 'desc' }];
    case RepresentantSortField.CLIENT_CREATED_AT:
    default:
      return [{ clientCreatedAt: direction }, { id: 'desc' }];
  }
}

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
    relationStatus: row.relationStatus,
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
      ...readScope(user),
      ...demoScope(await this.demo.enabled()),
    };
    if (query.commercialId) {
      where.createdById = readsEveryone(user)
        ? query.commercialId
        : query.commercialId === user.id
          ? user.id
          : '__aucun__';
    }
    if (query.departementId) where.departementId = query.departementId;
    if (query.iefId) where.iefId = query.iefId;
    if (query.relationStatus) where.relationStatus = query.relationStatus;

    if (query.dateFrom || query.dateTo) {
      where.clientCreatedAt = {
        ...(query.dateFrom ? { gte: inclusiveDateFrom(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: inclusiveDateTo(query.dateTo) } : {}),
      };
    }

    // `deletedAt: null` dans les deux branches : un représentant dont toutes
    // les fiches ont été effacées est REDEVENU dormant, et le compter comme
    // actif ferait manquer exactement les cas qu'une relance doit rattraper.
    if (query.hasProspects === true) where.prospects = { some: { deletedAt: null } };
    if (query.hasProspects === false) where.prospects = { none: { deletedAt: null } };

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
        orderBy: orderByFor(query),
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
      where: { id, deletedAt: null, ...demoScope(await this.demo.enabled()) },
      include: INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }
    assertReadable(user, row);
    return toRepresentantDto(row);
  }

  /**
   * Recherche par téléphone, avant saisie.
   *
   * Répond même quand la fiche appartient à un AUTRE commercial : c'est tout
   * l'objet de l'endpoint. Le commercial doit apprendre que ce représentant est
   * déjà connu et par qui, sinon il ressaisit une fiche que la contrainte
   * d'unicité rejettera sans lui dire pourquoi.
   *
   * MAIS SEUL LE NOM DU PROPRIÉTAIRE EST DIVULGUÉ, et c'est ce que la réponse
   * doit refléter. La version précédente rendait le DTO COMPLET de la fiche
   * d'autrui : nom du représentant, téléphone E.164, notes de terrain,
   * département, nombre de prospects portés, identifiant du propriétaire. Un
   * annuaire nominatif entier, énumérable numéro par numéro par n'importe quel
   * compte. Ici, une fiche qui n'appartient pas à l'appelant ne rend que « ce
   * numéro est pris, par untel » : exactement ce qui évite la double saisie,
   * rien de plus.
   *
   * L'ADMIN garde la vue complète : c'est lui qui arbitre les doublons, et lui
   * masquer la fiche rendrait l'arbitrage impossible.
   */
  async lookup(user: AuthenticatedUser, phone: string): Promise<RepresentantLookupDto> {
    const phoneE164 = normalizePhone(phone);
    const row = await this.prisma.representant.findFirst({
      where: { phoneE164, deletedAt: null, ...demoScope(await this.demo.enabled()) },
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

    if (!isAdmin(user) && row.createdById !== user.id) {
      return {
        found: true,
        phoneE164,
        representant: null,
        // L'identifiant du propriétaire est tu lui aussi : il ne sert qu'à
        // reconnaître SA PROPRE fiche, ce que l'appelant sait déjà quand elle
        // lui appartient. Le nom suffit à savoir vers qui se tourner.
        ownedByCommercialId: null,
        ownedByCommercialName: row.createdBy.fullName,
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
    await this.assertPhoneFree(user, phoneE164);

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
        // Aucune ligne source dont hériter : un représentant est une racine,
        // l'interrupteur décide donc seul.
        //
        // Sans cette valeur, la fiche saisie pendant une démonstration est
        // une VRAIE fiche de l'annuaire : encore listée après l'extinction,
        // comptée dans la productivité, et que rien ne désigne comme fictive,
        // ni le filtre d'affichage ni un nettoyage ultérieur par `isDemo`.
        isDemo: await this.demo.enabledForWrite(),
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
    const existing = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null, ...demoScope(await this.demo.enabled()) },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }
    assertOwnership(user, existing);

    const phoneE164 = input.phone ? normalizePhone(input.phone) : undefined;
    if (phoneE164 && phoneE164 !== existing.phoneE164) await this.assertPhoneFree(user, phoneE164);

    const updated = await this.prisma.$transaction(async (tx) => {
      // La bascule de relation part AVANT la mise à jour ordinaire : elle porte
      // sa propre garde sur le statut de départ, et la relecture qui suit doit
      // rendre la fiche telle que les deux écritures l'ont laissée.
      if (input.relationStatus !== undefined) {
        await applyRelationChange(tx, {
          representantId: id,
          fromStatus: existing.relationStatus,
          toStatus: input.relationStatus,
          changedById: user.id,
          source: ChangeSource.WEB,
          isDemo: existing.isDemo,
        });
      }

      return tx.representant.update({
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
    });
    return toRepresentantDto(updated);
  }

  /**
   * L'historique d'UNE fiche, du plus récent au plus ancien.
   *
   * Sert l'index `(representantId, changedAt)`. Le cloisonnement s'est joué sur
   * la fiche, résolue par sa clé primaire juste au-dessus.
   */
  async relationHistory(
    user: AuthenticatedUser,
    id: string,
  ): Promise<RepresentantRelationChangeListDto> {
    const representant = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null, ...demoScope(await this.demo.enabled()) },
      select: { id: true, createdById: true },
    });
    if (!representant) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }
    assertReadable(user, representant);

    // LECTURE GLOBALE délibérée : une trace suit toujours la nature de son
    // représentant, déjà résolu ci-dessus. Rejouer le filtre ici rendrait soit
    // le même ensemble, soit une fiche privée de son histoire, ce qui se lit à
    // l'écran comme une relation jamais entamée.
    const rows = await this.prisma.representantRelationChange.findMany({
      where: { representantId: id },
      include: { changedBy: { select: { fullName: true } } },
      // `id` en second critère : deux bascules de la même milliseconde
      // s'échangeraient sinon leur place d'un affichage à l'autre.
      orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
    });

    return { items: rows.map(toRelationChangeDto) };
  }

  async remove(user: AuthenticatedUser, id: string, query: DeleteQueryDto): Promise<OkDto> {
    const existing = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null, ...demoScope(await this.demo.enabled()) },
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
    // LECTURE GLOBALE délibérée, sans `demoScope` : c'est la clé PRIMAIRE qui
    // est testée, et elle est unique quel que soit le mode. Filtrer ici ferait
    // répondre « identifiant libre » sur une ligne existante, et l'écriture
    // suivante avorterait sur une violation de clé primaire illisible.
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

  /**
   * Refuse un numéro déjà pris, sans révéler la fiche qui le porte.
   *
   * LECTURE GLOBALE délibérée, sans `demoScope` : l'index unique partiel
   * `representants_phone_e164_active_key` est global, il ne connaît pas le mode
   * démonstration. Filtrer ici ferait répondre « numéro libre » sur un numéro
   * que la base refusera ensuite, et le commercial recevrait un 409
   * UNIQUE_CONSTRAINT_VIOLATION générique au lieu de ce message-ci. Même
   * raisonnement que `existingPhones` dans l'import de masse.
   *
   * Le corps de l'erreur suit la même règle que `lookup` : quand la fiche
   * appartient à quelqu'un d'autre, seul le nom du propriétaire sort. Renvoyer
   * son identifiant, son nom complet et sa date de saisie donnait à n'importe
   * quel compte un moyen d'énumérer l'annuaire numéro par numéro, à raison
   * d'une tentative de création par ligne.
   */
  private async assertPhoneFree(user: AuthenticatedUser, phoneE164: string): Promise<void> {
    const clash = await this.prisma.representant.findFirst({
      where: { phoneE164, deletedAt: null },
      include: { createdBy: { select: { id: true, fullName: true } } },
    });
    if (!clash) return;

    const visible = isAdmin(user) || clash.createdById === user.id;
    throw new ConflictException({
      code: 'REPRESENTANT_PHONE_CONFLICT',
      message: 'Ce numéro est déjà enregistré pour un représentant.',
      existing: visible
        ? {
            id: clash.id,
            fullName: clash.fullName,
            phoneE164: clash.phoneE164,
            ownedByCommercialId: clash.createdBy.id,
            ownedByCommercialName: clash.createdBy.fullName,
            createdAt: clash.createdAt.toISOString(),
          }
        : {
            phoneE164: clash.phoneE164,
            ownedByCommercialName: clash.createdBy.fullName,
          },
    });
  }
}
