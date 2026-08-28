import { segmentWhere } from '@crm/database';
import type { Prisma } from '@crm/database';

import type { AuthenticatedUser } from './decorators/current-user.decorator.js';
import { isAdmin, readableOwnerId, readScope } from './scope.js';
import { tryNormalizePhone } from './phone.js';
import type { ProspectFilterDto } from './dto/prospect-filter.dto.js';
import { inclusiveDateFrom, inclusiveDateTo } from './date-bounds.js';

export function buildProspectWhere(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  filter: ProspectFilterDto,
): Prisma.ProspectWhereInput {
  const where: Prisma.ProspectWhereInput = { ...readScope(user) };
  applyDirectFilters(where, user, filter);

  const and = relationFilters(filter);
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
  if (filter.commercialId) where.createdById = readableOwnerId(user, filter.commercialId);
  if (!(filter.includeDeleted && isAdmin(user))) where.deletedAt = null;
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
  if (filter.campaignId ?? filter.assignedToId) {
    const callTask: Prisma.CallTaskWhereInput = {};
    if (filter.campaignId) callTask.campaignId = filter.campaignId;
    if (filter.assignedToId) callTask.assignedToId = filter.assignedToId;
    and.push({
      callTasks: {
        some: callTask,
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
