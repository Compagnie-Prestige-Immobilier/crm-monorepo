import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, type Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { dakarWallClock, inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { SortOrder } from '../../common/dto/prospect-filter.dto.js';
import { tryNormalizePhone } from '../../common/phone.js';
import { formatVisiteReference, nextVisiteSequence, visiteReferencePrefix } from './reference.js';
import { VisiteSortField } from './dto.js';
import type {
  CreateVisiteDto,
  UpdateVisiteDto,
  VisiteDto,
  VisiteFilterDto,
  VisiteListDto,
  VisiteQueryDto,
} from './dto.js';

const VisiteError = {
  NOT_FOUND: 'VISITE_NOT_FOUND',
  REFERENTIEL_UNAVAILABLE: 'VISITE_REFERENTIEL_UNAVAILABLE',
  REFERENCE_EXHAUSTED: 'VISITE_REFERENCE_EXHAUSTED',
} as const;

/** Qui tient le registre, à l'écran comme dans la file de synchronisation. */
export const VISITE_REGISTRE_ROLES = [Role.ADMIN, Role.DIRECTION, Role.ACCUEIL] as const;

const REFERENTIEL_SELECT = { select: { id: true, code: true, label: true } } as const;

/** Surface commune à `PrismaService` et à une transaction : les deux servent les mêmes lectures. */
type VisiteDb = Pick<
  Prisma.TransactionClient,
  'visite' | 'visiteEntreprise' | 'visiteObjet' | 'visiteDirection' | 'visiteDestinataire'
>;

const VISITE_INCLUDE = {
  entreprise: REFERENTIEL_SELECT,
  objet: REFERENTIEL_SELECT,
  direction: REFERENTIEL_SELECT,
  destinataire: REFERENTIEL_SELECT,
} as const;

type VisiteRow = Prisma.VisiteGetPayload<{ include: typeof VISITE_INCLUDE }>;

/** La référence départage : deux visites de la même minute gardent un ordre stable. */
function visiteOrderBy(
  sortBy: VisiteSortField,
  sortOrder: SortOrder,
): Prisma.VisiteOrderByWithRelationInput[] {
  switch (sortBy) {
    case VisiteSortField.VISITED_AT:
      return [{ visitedAt: sortOrder }, { reference: 'desc' }];
    case VisiteSortField.VISITOR_NAME:
      return [{ visitorName: sortOrder }, { reference: 'desc' }];
    case VisiteSortField.ENTREPRISE:
      return [{ entreprise: { label: sortOrder } }, { reference: 'desc' }];
    case VisiteSortField.DIRECTION:
      return [{ direction: { label: sortOrder } }, { reference: 'desc' }];
    case VisiteSortField.DESTINATAIRE:
      return [{ destinataire: { label: sortOrder } }, { reference: 'desc' }];
    case VisiteSortField.OBJET:
      return [{ objet: { label: sortOrder } }, { reference: 'desc' }];
  }
}

/** Une collision de référence n'arrive qu'entre deux saisies simultanées, rare à un guichet. */
const REFERENCE_ATTEMPTS = 5;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Africa/Dakar ne change pas d'heure : l'offset tient sur toute la journée. */
export function visiteInstant(date: string, time: string | undefined): Date {
  const midnight = inclusiveDateFrom(date);
  if (time === undefined) return midnight;

  const [hour, minute] = time.split(':').map(Number) as [number, number];
  return new Date(midnight.getTime() + hour * 3_600_000 + minute * 60_000);
}

export const dakarDate = (instant: Date): string => {
  const { year, month, day } = dakarWallClock(instant);
  return `${String(year)}-${pad2(month)}-${pad2(day)}`;
};

function visiteCreateData(
  input: CreateVisiteDto,
  entityId: string | undefined,
  createdById: string,
  visitedAt: Date,
) {
  return {
    ...(entityId === undefined ? {} : { id: entityId }),
    visitedAt,
    timeKnown: input.time !== undefined,
    visitorName: input.visitorName.trim(),
    phone: input.phone?.trim() ?? null,
    phoneE164: tryNormalizePhone(input.phone) ?? null,
    entrepriseId: input.entrepriseId,
    objetId: input.objetId,
    directionId: input.directionId ?? null,
    destinataireId: input.destinataireId ?? null,
    comment: input.comment?.trim() ?? null,
    createdById,
  };
}

function toDto(row: VisiteRow): VisiteDto {
  const { hour, minute } = dakarWallClock(row.visitedAt);
  return {
    id: row.id,
    reference: row.reference,
    date: dakarDate(row.visitedAt),
    time: row.timeKnown ? `${pad2(hour)}:${pad2(minute)}` : null,
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
  };
}

@Injectable()
export class VisitesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: VisiteQueryDto): Promise<VisiteListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = this.buildWhere(query);
    const sortBy = query.sortBy ?? VisiteSortField.VISITED_AT;
    const sortOrder = query.sortOrder ?? SortOrder.DESC;

    const [total, rows] = await Promise.all([
      this.prisma.visite.count({ where }),
      this.prisma.visite.findMany({
        where,
        include: VISITE_INCLUDE,
        orderBy: visiteOrderBy(sortBy, sortOrder),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toDto),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async get(id: string): Promise<VisiteDto> {
    return toDto(await this.visite(id));
  }

  async create(input: CreateVisiteDto, createdById: string): Promise<VisiteDto> {
    return this.createRow(this.prisma, undefined, input, createdById);
  }

  /**
   * Même écriture, appelée DANS la transaction d'un lot de synchronisation :
   * `tx` porte l'isolation qui rend la numérotation de référence sûre, et
   * `entityId` est celui choisi par le téléphone hors ligne, seule façon de
   * rejouer une remontée sans dupliquer la ligne.
   */
  async createForSync(
    tx: Prisma.TransactionClient,
    entityId: string,
    input: CreateVisiteDto,
    createdById: string,
  ): Promise<VisiteDto> {
    return this.createRow(tx, entityId, input, createdById);
  }

  private async createRow(
    db: VisiteDb,
    entityId: string | undefined,
    input: CreateVisiteDto,
    createdById: string,
  ): Promise<VisiteDto> {
    const visitedAt = this.instantOf(input.date, input.time);
    await this.assertReferentielsUsable(input, db);

    const data = visiteCreateData(input, entityId, createdById, visitedAt);
    const year = dakarWallClock(visitedAt).year;

    // Une seule tentative DANS la transaction d'un lot : PostgreSQL abandonne
    // la transaction à la première erreur, la 2e tentative lèverait 25P02 et
    // non P2002. La collision de référence remonte alors telle quelle, le
    // téléphone renvoie, et la séquence est relue à neuf.
    const attempts = entityId === undefined ? REFERENCE_ATTEMPTS : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const created = await this.tryCreate(db, data, year);
      if (created) return toDto(created);
    }

    throw new BadRequestException({
      code: VisiteError.REFERENCE_EXHAUSTED,
      message: 'La référence de visite n’a pas pu être attribuée. Réessayez.',
    });
  }

  private async tryCreate(
    db: VisiteDb,
    data: ReturnType<typeof visiteCreateData>,
    year: number,
  ): Promise<VisiteRow | null> {
    const reference = formatVisiteReference(year, await this.nextSequence(year, db));
    try {
      return await db.visite.create({ data: { ...data, reference }, include: VISITE_INCLUDE });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return null;
    }
  }

  async update(id: string, input: UpdateVisiteDto): Promise<VisiteDto> {
    const existing = await this.visite(id);
    await this.assertReferentielsUsable(input);

    // ABSENT laisse en place, NUL efface. Sans cette distinction, une heure
    // relevee par erreur ou un destinataire faux ne se corrigent jamais: le
    // registre garderait une valeur que personne ne peut retirer.
    const jour = dakarDate(existing.visitedAt);
    const data: Prisma.VisiteUncheckedUpdateInput = {};
    applyTimeUpdate(data, input, jour);
    applyPhoneUpdate(data, input);
    if (input.visitorName !== undefined) data.visitorName = input.visitorName.trim();
    if (input.entrepriseId !== undefined) data.entrepriseId = input.entrepriseId;
    if (input.objetId !== undefined) data.objetId = input.objetId;
    if (input.directionId !== undefined) data.directionId = input.directionId;
    if (input.destinataireId !== undefined) data.destinataireId = input.destinataireId;
    applyCommentUpdate(data, input);

    const updated = await this.prisma.visite.update({
      where: { id },
      data,
      include: VISITE_INCLUDE,
    });
    return toDto(updated);
  }

  buildWhere(query: VisiteFilterDto): Prisma.VisiteWhereInput {
    const search = query.search?.trim();
    return {
      ...visitedAtRange(query),
      ...(query.entrepriseId === undefined ? {} : { entrepriseId: query.entrepriseId }),
      ...(query.directionId === undefined ? {} : { directionId: query.directionId }),
      ...(query.destinataireId === undefined ? {} : { destinataireId: query.destinataireId }),
      ...(query.objetId === undefined ? {} : { objetId: query.objetId }),
      ...visitorSearchFilter(search),
    };
  }

  /**
   * L'accueil ne doit pas pouvoir ranger une visite sous une entrée retirée des
   * listes : le référentiel se désactive précisément pour cesser d'être proposé.
   */
  private async assertReferentielsUsable(
    input: CreateVisiteDto | UpdateVisiteDto,
    db: VisiteDb = this.prisma,
  ): Promise<void> {
    const [entreprise, objet, direction, destinataire] = await Promise.all([
      input.entrepriseId === undefined
        ? null
        : db.visiteEntreprise.findUnique({ where: { id: input.entrepriseId } }),
      input.objetId === undefined
        ? null
        : db.visiteObjet.findUnique({ where: { id: input.objetId } }),
      input.directionId == null
        ? null
        : db.visiteDirection.findUnique({ where: { id: input.directionId } }),
      input.destinataireId == null
        ? null
        : db.visiteDestinataire.findUnique({ where: { id: input.destinataireId } }),
    ]);

    const refused = [
      ['entreprise', input.entrepriseId, entreprise],
      ['objet de visite', input.objetId, objet],
      ['direction', input.directionId, direction],
      ['destinataire', input.destinataireId, destinataire],
    ] as const;

    for (const [label, wanted, row] of refused) {
      if (wanted == null) continue;
      if (row && row.isActive) continue;
      throw new BadRequestException({
        code: VisiteError.REFERENTIEL_UNAVAILABLE,
        message: `L’entrée choisie pour « ${label} » n’est plus proposée à l’accueil.`,
        field: label,
      });
    }
  }

  // `db` en parametre : l'inscription venue de la synchronisation s'execute dans
  // la transaction de son groupe, et lire hors d'elle rendrait un rang deja pris
  // par une visite du meme lot.
  private async nextSequence(year: number, db: VisiteDb = this.prisma): Promise<number> {
    const last = await db.visite.findFirst({
      where: { reference: { startsWith: visiteReferencePrefix(year) } },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    });
    return nextVisiteSequence(last?.reference, year);
  }

  private instantOf(date: string, time: string | undefined): Date {
    return visiteInstant(date, time);
  }

  private async visite(id: string): Promise<VisiteRow> {
    const found = await this.prisma.visite.findFirst({
      where: { id },
      include: VISITE_INCLUDE,
    });
    if (!found) {
      throw new NotFoundException({
        code: VisiteError.NOT_FOUND,
        message: 'Visite introuvable.',
      });
    }
    return found;
  }
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

function applyTimeUpdate(
  data: Prisma.VisiteUncheckedUpdateInput,
  input: UpdateVisiteDto,
  jour: string,
): void {
  if (input.time === null) {
    data.visitedAt = visiteInstant(jour, '00:00');
    data.timeKnown = false;
    return;
  }
  if (input.time !== undefined) {
    data.visitedAt = visiteInstant(jour, input.time);
    data.timeKnown = true;
  }
}

function applyPhoneUpdate(data: Prisma.VisiteUncheckedUpdateInput, input: UpdateVisiteDto): void {
  const trimmed = input.phone?.trim();
  if (input.phone === null || trimmed === '') {
    data.phone = null;
    data.phoneE164 = null;
    return;
  }
  if (input.phone !== undefined) {
    data.phone = input.phone.trim();
    data.phoneE164 = tryNormalizePhone(input.phone) ?? null;
  }
}

function applyCommentUpdate(
  data: Prisma.VisiteUncheckedUpdateInput,
  input: UpdateVisiteDto,
): void {
  const trimmed = input.comment?.trim();
  if (input.comment === null || trimmed === '') {
    data.comment = null;
    return;
  }
  if (input.comment !== undefined) data.comment = input.comment.trim();
}

function visitedAtRange(query: VisiteFilterDto): Prisma.VisiteWhereInput {
  if (query.from === undefined && query.to === undefined) return {};
  return {
    visitedAt: {
      ...(query.from === undefined ? {} : { gte: inclusiveDateFrom(query.from) }),
      ...(query.to === undefined ? {} : { lte: inclusiveDateTo(query.to) }),
    },
  };
}

function visitorSearchFilter(search: string | undefined): Prisma.VisiteWhereInput {
  if (search === undefined || search === '') return {};
  return {
    OR: [
      { visitorName: { contains: search, mode: 'insensitive' as const } },
      { reference: { contains: search.toUpperCase() } },
    ],
  };
}
