import { segmentWhere } from '@crm/database';
import type { Prisma } from '@crm/database';

import type { AuthenticatedUser } from './decorators/current-user.decorator.js';
import { prospectReadScope } from './scope.js';
import { tryNormalizePhone } from './phone.js';
import type { ProspectFilterDto } from './dto/prospect-filter.dto.js';
import { inclusiveDateFrom, inclusiveDateTo } from './date-bounds.js';

export function buildProspectWhere(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  filter: ProspectFilterDto,
): Prisma.ProspectWhereInput {
  const where: Prisma.ProspectWhereInput = {};
  applyDirectFilters(where, user, filter);

  // Le cloisonnement voyage dans `AND`, jamais à la racine : `where.OR` sert
  // déjà à la recherche libre, et l'y poser le ferait écraser en silence.
  const and = relationFilters(filter);
  const portee = prospectReadScope(user);
  if (portee.OR) and.unshift(portee);
  if (and.length) where.AND = and;

  const clientCreatedAt = dateFilter(filter);
  if (clientCreatedAt) where.clientCreatedAt = clientCreatedAt;

  const search = searchFilters(filter.search);
  if (search) where.OR = search;

  return where;
}

function applyDirectFilters(
  where: Prisma.ProspectWhereInput,
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  filter: ProspectFilterDto,
): void {
  // Filtrer sur un collègue ne change pas la portée de l'appelant.
  if (filter.commercialId) where.createdById = filter.commercialId;
  where.deletedAt = null;
  Object.assign(
    where,
    Object.fromEntries(
      Object.entries({
        type: filter.type,
        canalProvenanceId: filter.canalProvenanceId,
        representantId: filter.representantId,
        banqueId: filter.banqueId,
        syndicatId: filter.syndicatId,
        origin: filter.origin,
        phase2Status: filter.phase2Status,
        enrollmentMethod: filter.enrollmentMethod,
        enrollmentCapturedById: filter.enrollmentCapturedById,
        lastCallById: filter.lastCallById,
      }).filter(([, value]) => value !== undefined),
    ),
  );

  if (!filter.projet && filter.statut) where.statut = filter.statut;
  if (filter.departementId) {
    where.representant = { departementId: filter.departementId };
  }
}

function relationFilters(filter: ProspectFilterDto): Prisma.ProspectWhereInput[] {
  const and: Prisma.ProspectWhereInput[] = [];
  if (filter.projet) {
    const journey: Prisma.ProspectJourneyWhereInput = { projet: filter.projet };
    if (filter.statut) journey.statut = filter.statut;
    and.push({
      journeys: {
        some: journey,
      },
    });
  }
  if (filter.segment) and.push(segmentWhere(filter.segment));
  if (filter.appelePar) {
    and.push({
      callAttempts: {
        some: { performedById: filter.appelePar },
      },
    });
  }
  return and;
}

function dateFilter(filter: ProspectFilterDto): Prisma.DateTimeFilter | undefined {
  if (!(filter.dateFrom ?? filter.dateTo)) return undefined;
  const clientCreatedAt: Prisma.DateTimeFilter = {};
  if (filter.dateFrom) clientCreatedAt.gte = inclusiveDateFrom(filter.dateFrom);
  if (filter.dateTo) clientCreatedAt.lte = inclusiveDateTo(filter.dateTo);
  return clientCreatedAt;
}

function searchFilters(rawSearch: string | undefined): Prisma.ProspectWhereInput[] | undefined {
  const search = rawSearch?.trim();
  if (!search) return undefined;
  const asPhone = tryNormalizePhone(search);
  const digits = search.replace(/[^\d+]/g, '');
  const clauses: Prisma.ProspectWhereInput[] = [
    { nom: { contains: search, mode: 'insensitive' } },
    { prenom: { contains: search, mode: 'insensitive' } },
  ];
  if (digits.replace(/\D/g, '').length >= 3) {
    clauses.push({ phoneE164: { contains: asPhone ?? digits } });
  }
  return clauses;
}
