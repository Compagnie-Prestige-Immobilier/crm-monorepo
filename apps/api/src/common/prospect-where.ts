import { segmentWhere } from '@crm/database';
import type { Prisma } from '@crm/database';

import type { AuthenticatedUser } from './decorators/current-user.decorator.js';
import { isAdmin, readScope, readsEveryone } from './scope.js';
import { tryNormalizePhone } from './phone.js';
import type { ProspectFilterDto } from './dto/prospect-filter.dto.js';
import { inclusiveDateFrom, inclusiveDateTo } from './date-bounds.js';

export function buildProspectWhere(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  filter: ProspectFilterDto,
): Prisma.ProspectWhereInput {
  const where: Prisma.ProspectWhereInput = {
    ...readScope(user),
  };

  if (filter.commercialId) {
    where.createdById = readsEveryone(user)
      ? filter.commercialId
      : filter.commercialId === user.id
        ? user.id
        : '__aucun__';
  }

  if (!(filter.includeDeleted && isAdmin(user))) {
    where.deletedAt = null;
  }

  if (filter.type) where.type = filter.type;
  if (filter.canalProvenanceId) where.canalProvenanceId = filter.canalProvenanceId;
  if (filter.representantId) where.representantId = filter.representantId;
  if (filter.banqueId) where.banqueId = filter.banqueId;
  if (filter.syndicatId) where.syndicatId = filter.syndicatId;
  if (!filter.projet && filter.statut) where.statut = filter.statut;
  if (filter.origin) where.origin = filter.origin;
  if (filter.phase2Status) where.phase2Status = filter.phase2Status;
  if (filter.enrollmentMethod) where.enrollmentMethod = filter.enrollmentMethod;
  if (filter.enrollmentCapturedById) {
    where.enrollmentCapturedById = filter.enrollmentCapturedById;
  }
  if (filter.departementId) {
    where.representant = { departementId: filter.departementId };
  }

  const and: Prisma.ProspectWhereInput[] = [];

  if (filter.projet) {
    and.push({
      journeys: {
        some: {
          projet: filter.projet,
          ...(filter.statut ? { statut: filter.statut } : {}),
        },
      },
    });
  }

  if (filter.segment) and.push(segmentWhere(filter.segment));

  if (filter.campaignId ?? filter.assignedToId) {
    and.push({
      callTasks: {
        some: {
          ...(filter.campaignId ? { campaignId: filter.campaignId } : {}),
          ...(filter.assignedToId ? { assignedToId: filter.assignedToId } : {}),
        },
      },
    });
  }

  if (and.length) where.AND = and;

  if (filter.dateFrom ?? filter.dateTo) {
    where.clientCreatedAt = {
      ...(filter.dateFrom ? { gte: inclusiveDateFrom(filter.dateFrom) } : {}),
      ...(filter.dateTo ? { lte: inclusiveDateTo(filter.dateTo) } : {}),
    };
  }

  const search = filter.search?.trim();
  if (search) {
    const asPhone = tryNormalizePhone(search);
    const digits = search.replace(/[^\d+]/g, '');

    where.OR = [
      { nom: { contains: search, mode: 'insensitive' } },
      { prenom: { contains: search, mode: 'insensitive' } },
      ...(digits.replace(/\D/g, '').length >= 3
        ? [{ phoneE164: { contains: asPhone ?? digits } }]
        : []),
    ];
  }

  return where;
}
