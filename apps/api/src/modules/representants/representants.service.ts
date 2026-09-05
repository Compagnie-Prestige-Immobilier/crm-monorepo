import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChangeSource,
  Prisma,
  RepCallOutcome,
  RepresentantRelation,
  WhatsappStatus,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizePhone } from '../../common/phone.js';
import { assertOwnership, attributionScope, isAdmin } from '../../common/scope.js';
import { listerDetections, type DeviceCallDetectionListDto } from '../../common/device-call.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { OkDto } from '../../common/dto/ok.dto.js';
import { RepresentantSortField, RepresentantSuivi } from './dto.js';
import type {
  CreateRepresentantCommentDto,
  CreateRepresentantDto,
  DeleteQueryDto,
  RepresentantCommentDto,
  RepresentantCommentListDto,
  RepresentantCommentQueryDto,
  RepresentantDto,
  RepresentantExportQueryDto,
  RepresentantListDto,
  RepresentantLookupDto,
  RepresentantQueryDto,
  UpdateRepresentantDto,
  RepresentantCallAttemptListDto,
  RepresentantRelationChangeListDto,
} from './dto.js';
import { applyRelationChange, toRelationChangeDto } from './relation-change.js';
import { hasReachableWhatsapp, resolveWhatsappPatch, whatsappNumberOf } from './whatsapp.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';

export const REPRESENTANT_INCLUDE = {
  departement: { select: { name: true } },
  ief: { select: { name: true } },
  createdBy: { select: { id: true, fullName: true } },
  lastCallBy: { select: { fullName: true } },
  statutQualification: { select: { label: true, effect: true } },
  _count: { select: { prospects: { where: { deletedAt: null } }, repCallAttempts: true } },
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

  switch (query.sortBy ?? (query.suivi && TRI_DU_SUIVI[query.suivi])) {
    case RepresentantSortField.FULL_NAME:
      return [{ fullName: direction }, { id: 'desc' }];
    case RepresentantSortField.CREATED_AT:
      return [{ createdAt: direction }, { id: 'desc' }];
    case RepresentantSortField.PROSPECTS:
      return [{ prospects: { _count: direction } }, { id: 'desc' }];
    case RepresentantSortField.LAST_CALL_AT:
      return [{ lastCallAt: direction }, { id: 'desc' }];
    case RepresentantSortField.NEXT_CALLBACK_AT:
      // Le rappel le plus proche d'abord, sauf tri explicite.
      return [{ nextCallbackAt: query.sortOrder ?? 'asc' }, { id: 'desc' }];
    case RepresentantSortField.PRIORITE:
      // `asc` suit l'ordre de declaration de l'enumeration, HAUTE d'abord, et
      // PostgreSQL classe les NULL en dernier dans ce sens : une fiche jamais
      // qualifiee ne double pas celles qu'on a jointes.
      return [{ statutQualification: { priorite: query.sortOrder ?? 'asc' } }, { id: 'desc' }];
    case RepresentantSortField.CLIENT_CREATED_AT:
    default:
      return [{ clientCreatedAt: direction }, { id: 'desc' }];
  }
}

const TRI_DU_SUIVI: Record<RepresentantSuivi, RepresentantSortField> = {
  [RepresentantSuivi.A_RAPPELER]: RepresentantSortField.NEXT_CALLBACK_AT,
  [RepresentantSuivi.INJOIGNABLE]: RepresentantSortField.LAST_CALL_AT,
};

export function suiviWhere(
  query: Pick<RepresentantExportQueryDto, 'lastCallById' | 'suivi' | 'statutQualificationId'>,
): Prisma.RepresentantWhereInput {
  return {
    ...(query.lastCallById ? { lastCallById: query.lastCallById } : {}),
    ...(query.suivi === RepresentantSuivi.A_RAPPELER ? { nextCallbackAt: { not: null } } : {}),
    ...(query.suivi === RepresentantSuivi.INJOIGNABLE
      ? { lastCallOutcome: RepCallOutcome.UNREACHABLE }
      : {}),
    ...(query.statutQualificationId ? { statutQualificationId: query.statutQualificationId } : {}),
  };
}

/** Un seul état reste une égalité : l'index s'en sert, et la clause se lit. */
function relationWhere(relations: RepresentantRelation[] = []): Prisma.RepresentantWhereInput {
  const [relation, ...autres] = relations;
  if (relation === undefined) return {};
  if (autres.length === 0) return { relationStatus: relation };
  return { relationStatus: { in: [relation, ...autres] } };
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
    statutQualificationId: row.statutQualificationId,
    statutQualificationLabel: row.statutQualification?.label ?? null,
    statutQualificationEffect: row.statutQualification?.effect ?? null,
    whatsappStatus: row.whatsappStatus,
    whatsappE164: row.whatsappE164,
    whatsappNumber: whatsappNumberOf(row),
    profession: row.profession,
    prenom: row.prenom,
    etablissement: row.etablissement,
    syndicat: row.syndicat,
    connaitUES: row.connaitUES,
    contacte: row.contacte,
    lastCallOutcome: row.lastCallOutcome,
    lastCallAt: row.lastCallAt?.toISOString() ?? null,
    callAttemptCount: row._count.repCallAttempts,
    lastCallById: row.lastCallById,
    lastCallByName: row.lastCallBy?.fullName ?? null,
    nextCallbackAt: row.nextCallbackAt?.toISOString() ?? null,
    nextCallbackOrigine: row.nextCallbackOrigine,
  };
}

/**
 * Les deux filtres WhatsApp se composent par INTERSECTION, jamais par écrasement :
 * envoyer les deux et n'en voir appliquer qu'un rendrait une liste dont personne
 * ne peut dire ce qu'elle montre.
 */
function allowedWhatsappStatuses(query: RepresentantQueryDto): WhatsappStatus[] {
  let allowed = Object.values(WhatsappStatus);
  if (query.hasWhatsapp === true) allowed = allowed.filter(hasReachableWhatsapp);
  if (query.hasWhatsapp === false) allowed = allowed.filter((s) => !hasReachableWhatsapp(s));
  if (query.whatsappStatus) allowed = allowed.filter((s) => s === query.whatsappStatus);
  return allowed;
}

function rechercheLibre(raw: string | undefined): Prisma.RepresentantWhereInput[] | null {
  const search = raw?.trim();
  if (!search) return null;
  const digits = search.replace(/[^\d+]/g, '');
  return [
    { fullName: { contains: search, mode: 'insensitive' } },
    // Sans chiffres, `contains: ''` rendrait tout l'annuaire.
    ...(digits.replace(/\D/g, '').length >= 3 ? [{ phoneE164: { contains: digits } }] : []),
  ];
}

interface CommentRow {
  id: string;
  representantId: string;
  authorId: string;
  author: { fullName: string };
  body: string;
  clientCreatedAt: Date;
  createdAt: Date;
}

export function toRepresentantCommentDto(row: CommentRow): RepresentantCommentDto {
  return {
    id: row.id,
    representantId: row.representantId,
    authorId: row.authorId,
    authorName: row.author.fullName,
    body: row.body,
    clientCreatedAt: row.clientCreatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class RepresentantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: RepresentantQueryDto): Promise<RepresentantListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    // Un téléconseiller ne lit que ses campagnes ; l'encadrement lit tout. Le
    // cloisonnement voyage dans `AND` : `where.OR` porte déjà la recherche libre.
    const where: Prisma.RepresentantWhereInput = {
      deletedAt: null,
      ...suiviWhere(query),
      ...relationWhere(query.relationStatus),
    };
    const portee = attributionScope(user, { malgreLeRole: query.mesFiches === true });
    if (portee.OR) where.AND = [portee];
    if (query.commercialId) {
      where.createdById = query.commercialId;
    }
    if (query.departementId) where.departementId = query.departementId;
    if (query.iefId) where.iefId = query.iefId;
    if (query.whatsappStatus || query.hasWhatsapp !== undefined) {
      where.whatsappStatus = { in: allowedWhatsappStatuses(query) };
    }

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

    const search = rechercheLibre(query.search);
    if (search) where.OR = search;

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

  /** Hors périmètre, la fiche est introuvable : le 404 ne dit pas qu'elle existe. */
  async get(user: AuthenticatedUser, id: string): Promise<RepresentantDto> {
    const row = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null, ...attributionScope(user) },
      include: INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }
    return toRepresentantDto(row);
  }

  /**
   * Recherche par téléphone, avant saisie.
   *
   * Rend la fiche entière quel qu'en soit le créateur : l'annuaire est commun,
   * il descend déjà sur tous les téléphones, et c'est ainsi qu'on qualifie un
   * représentant trouvé au numéro sans le ressaisir en double. Le propriétaire
   * reste nommé, pour savoir vers qui se tourner.
   */
  async lookup(phone: string): Promise<RepresentantLookupDto> {
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
    await this.assertPhoneFree(user, phoneE164);

    const created = await this.prisma.representant.create({
      data: {
        id,
        fullName: input.fullName.trim(),
        phoneE164,
        ...(input.notes ? { notes: input.notes } : {}),
        ...(input.prenom ? { prenom: input.prenom.trim() } : {}),
        ...(input.etablissement ? { etablissement: input.etablissement.trim() } : {}),
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
    const existing = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null },
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

    const whatsapp = resolveWhatsappPatch(input, existing);

    const updated = await this.prisma.$transaction(async (tx) => {
      // La bascule de relation part AVANT la mise à jour ordinaire : elle porte
      // sa propre garde sur le statut de départ, et la relecture qui suit doit
      // rendre la fiche telle que les deux écritures l'ont laissée.
      if (input.relationStatus !== undefined) {
        await applyRelationChange(tx, {
          representantId: id,
          fromStatus: existing.relationStatus,
          toStatus: input.relationStatus,
          reason: input.relationReason?.trim() || null,
          changedById: user.id,
          source: ChangeSource.WEB,
        });
      }

      return tx.representant.update({
        where: { id },
        data: {
          ...(input.fullName ? { fullName: input.fullName.trim() } : {}),
          ...(phoneE164 ? { phoneE164 } : {}),
          ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
          ...(input.prenom !== undefined ? { prenom: input.prenom.trim() || null } : {}),
          ...(input.etablissement !== undefined
            ? { etablissement: input.etablissement.trim() || null }
            : {}),
          ...(input.syndicat !== undefined ? { syndicat: input.syndicat.trim() || null } : {}),
          ...(input.connaitUES !== undefined ? { connaitUES: input.connaitUES } : {}),
          ...(input.contacte !== undefined ? { contacte: input.contacte } : {}),
          ...(input.departementId ? { departementId: input.departementId } : {}),
          ...(input.iefId === undefined ? {} : { iefId: input.iefId }),
          ...(input.clientCreatedAt ? { clientCreatedAt: new Date(input.clientCreatedAt) } : {}),
          ...whatsapp,
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
  async relationHistory(id: string): Promise<RepresentantRelationChangeListDto> {
    const representant = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!representant) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }

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

  /** Les appels que le journal du téléphone a relevés sur cette fiche. */
  async deviceCalls(id: string): Promise<DeviceCallDetectionListDto> {
    const representant = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!representant) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }
    return listerDetections(this.prisma, { representantId: id });
  }

  /** Même lecture globale que `relationHistory` : un appel suit sa fiche. */
  async callHistory(id: string): Promise<RepresentantCallAttemptListDto> {
    const representant = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!representant) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }

    const rows = await this.prisma.repCallAttempt.findMany({
      where: { representantId: id },
      include: {
        performedBy: { select: { fullName: true } },
        statutQualification: { select: { label: true, requiresComment: true } },
        suggestion: { select: { suggestedName: true, suggestedPhoneE164: true, note: true } },
      },
      orderBy: [{ clientCreatedAt: 'desc' }, { id: 'desc' }],
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        outcome: row.outcome,
        statutQualificationId: row.statutQualificationId,
        statutQualificationLabel: row.statutQualification?.label ?? null,
        statutQualificationRequiresComment: row.statutQualification?.requiresComment ?? false,
        comment: row.comment,
        callbackAt: row.callbackAt?.toISOString() ?? null,
        promisedProspects: row.promisedProspects,
        etablissementConfirme: row.etablissementConfirme,
        numeroConfirme: row.numeroConfirme,
        contacte: row.contacte,
        connaitUES: row.connaitUES,
        syndicat: row.syndicat,
        suggestedName: row.suggestion?.suggestedName ?? null,
        suggestedPhoneE164: row.suggestion?.suggestedPhoneE164 ?? null,
        suggestedNote: row.suggestion?.note ?? null,
        deviceCallType: row.deviceCallType,
        deviceCallDurationSeconds: row.deviceCallDurationSeconds,
        deviceCallAt: row.deviceCallAt?.toISOString() ?? null,
        performedById: row.performedById,
        performedByName: row.performedBy.fullName,
        clientCreatedAt: row.clientCreatedAt.toISOString(),
      })),
    };
  }

  async listComments(
    id: string,
    query: RepresentantCommentQueryDto,
  ): Promise<RepresentantCommentListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const representant = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!representant) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }

    const where: Prisma.RepresentantCommentWhereInput = {
      representantId: id,
      deletedAt: null,
    };

    // `id` en second critère : l'UUID v7 est lexicographiquement ordonné, il
    // départage deux commentaires hors ligne sans horloge partagée.
    const [total, rows] = await Promise.all([
      this.prisma.representantComment.count({ where }),
      this.prisma.representantComment.findMany({
        where,
        include: { author: { select: { fullName: true } } },
        orderBy: [{ clientCreatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toRepresentantCommentDto),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  /**
   * Ajoute un commentaire. Le fil est en AJOUT SEUL : aucune concurrence à
   * arbitrer, deux téléconseillers hors ligne produisent deux lignes.
   *
   * L'auteur vient de la session, jamais du corps de requête, et aucune route
   * ne réécrit une ligne posée.
   *
   * Le fil suit l'ANNUAIRE : commenter n'importe quelle fiche vivante est permis,
   * modifier la fiche elle-même ne l'est pas.
   */
  async addComment(
    user: AuthenticatedUser,
    id: string,
    input: CreateRepresentantCommentDto,
  ): Promise<RepresentantCommentDto> {
    const representant = await this.prisma.representant.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!representant) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }

    // `skipDuplicates` plutôt qu'une lecture préalable : le rejeu et la course
    // se traitent du même geste, c'est PostgreSQL qui arbitre la clé primaire.
    await this.prisma.representantComment.createMany({
      data: [
        {
          id: input.id,
          representantId: id,
          authorId: user.id,
          body: input.body.trim(),
          clientCreatedAt: input.clientCreatedAt ? new Date(input.clientCreatedAt) : new Date(),
        },
      ],
      skipDuplicates: true,
    });

    const posted = await this.prisma.representantComment.findUniqueOrThrow({
      where: { id: input.id },
      include: { author: { select: { fullName: true } } },
    });

    // Un identifiant déjà pris par le commentaire d'un autre : le rejeu rendrait
    // sinon une ligne que l'appelant n'a pas écrite, et qu'il croirait sienne.
    if (posted.representantId !== id || posted.authorId !== user.id) {
      throw new ForbiddenException({
        code: 'ENTITY_ID_OWNED_BY_ANOTHER_USER',
        message: 'Cet identifiant appartient à un autre commentaire.',
      });
    }

    return toRepresentantCommentDto(posted);
  }

  /** Suppression douce, réservée à l'ADMIN : l'auteur ne se dédit pas. */
  async removeComment(id: string, commentId: string): Promise<OkDto> {
    const removed = await this.prisma.representantComment.updateMany({
      where: { id: commentId, representantId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (removed.count !== 1) {
      throw new NotFoundException({
        code: 'REPRESENTANT_COMMENT_NOT_FOUND',
        message: 'Commentaire introuvable.',
      });
    }
    return { ok: true };
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
