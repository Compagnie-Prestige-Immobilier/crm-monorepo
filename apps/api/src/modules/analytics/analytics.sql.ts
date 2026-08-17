import { ALL_SEGMENTS, CBAO_SHORT_NAME, CHUES_SIGLE, Prisma, segmentAxes } from '@crm/database';
import type { BddSegment } from '@crm/database';

import { isAdmin } from '../../common/scope.js';
import { tryNormalizePhone } from '../../common/phone.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { TASK, demoScopeOn } from './pilotage.sql.js';

export function prospectConditions(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  filter: ProspectFilterDto,
  demoEnabled: boolean,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (!isAdmin(user)) {
    conditions.push(Prisma.sql`p."createdById" = ${user.id}`);
  }

  if (!demoEnabled) {
    conditions.push(Prisma.sql`p."isDemo" = FALSE`);
  }

  if (filter.commercialId) {
    const target = isAdmin(user)
      ? filter.commercialId
      : filter.commercialId === user.id
        ? user.id
        : '__aucun__';
    conditions.push(Prisma.sql`p."createdById" = ${target}`);
  }

  if (!(filter.includeDeleted && isAdmin(user))) {
    conditions.push(Prisma.sql`p."deletedAt" IS NULL`);
  }
  // Sans ce filtre, un total « par département » dépasse le total global.
  conditions.push(Prisma.sql`r."deletedAt" IS NULL`);

  if (filter.representantId)
    conditions.push(Prisma.sql`p."representantId" = ${filter.representantId}`);
  if (filter.banqueId) conditions.push(Prisma.sql`p."banqueId" = ${filter.banqueId}`);
  if (filter.syndicatId) conditions.push(Prisma.sql`p."syndicatId" = ${filter.syndicatId}`);
  if (filter.statut) {
    conditions.push(Prisma.sql`p."statut" = ${filter.statut}::"ProspectStatut"`);
  }
  if (filter.origin) conditions.push(Prisma.sql`p."origin" = ${filter.origin}`);
  if (filter.departementId) {
    conditions.push(Prisma.sql`r."departementId" = ${filter.departementId}`);
  }
  if (filter.phase2Status) {
    conditions.push(Prisma.sql`p."phase2Status" = ${filter.phase2Status}::"Phase2Status"`);
  }
  if (filter.enrollmentMethod) {
    conditions.push(
      Prisma.sql`p."enrollmentMethod" = ${filter.enrollmentMethod}::"EnrollmentMethod"`,
    );
  }
  if (filter.enrollmentCapturedById) {
    conditions.push(Prisma.sql`p."enrollmentCapturedById" = ${filter.enrollmentCapturedById}`);
  }
  if (filter.segment) conditions.push(segmentCondition(filter.segment));
  if (filter.campaignId) {
    // `call_tasks` porte son propre `isDemo` : le `p."isDemo"` posé plus haut ne le couvre pas.
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "call_tasks" ct
        WHERE ct."prospectId" = p."id"
          AND ct."campaignId" = ${filter.campaignId}
          AND ${demoScopeOn(TASK, demoEnabled)}
      )`,
    );
  }
  if (filter.dateFrom) {
    conditions.push(Prisma.sql`p."clientCreatedAt" >= ${inclusiveDateFrom(filter.dateFrom)}`);
  }
  if (filter.dateTo) {
    conditions.push(Prisma.sql`p."clientCreatedAt" <= ${inclusiveDateTo(filter.dateTo)}`);
  }

  const search = filter.search?.trim();
  if (search) {
    const like = `%${search}%`;
    const phone = `%${tryNormalizePhone(search) ?? search.replace(/[^\d+]/g, '')}%`;
    conditions.push(
      Prisma.sql`(p."nom" ILIKE ${like} OR p."prenom" ILIKE ${like} OR p."phoneE164" LIKE ${phone})`,
    );
  }

  if (!conditions.length) return Prisma.sql`TRUE`;
  return Prisma.join(conditions, ' AND ');
}

/** `representants` porte le département, `syndicats`/`banques` le segment ; les trois FK sont obligatoires, la jointure est sans perte. */
export const PROSPECT_FROM = Prisma.sql`
  FROM "prospects" p
  INNER JOIN "representants" r ON r."id" = p."representantId"
  INNER JOIN "syndicats" sy ON sy."id" = p."syndicatId"
  INNER JOIN "banques" bq ON bq."id" = p."banqueId"
`;

export function segmentCondition(segment: BddSegment): Prisma.Sql {
  const { isChues, isCbao } = segmentAxes(segment);
  const syndicat = isChues
    ? Prisma.sql`sy."sigle" = ${CHUES_SIGLE}`
    : Prisma.sql`sy."sigle" <> ${CHUES_SIGLE}`;
  const banque = isCbao
    ? Prisma.sql`bq."shortName" = ${CBAO_SHORT_NAME}`
    : Prisma.sql`bq."shortName" <> ${CBAO_SHORT_NAME}`;
  return Prisma.sql`(${syndicat} AND ${banque})`;
}

/** Pas de branche `ELSE` : un segment ajouté sans reconstruire l'expression rend NULL au lieu de se ranger en silence. */
export const SEGMENT_EXPR: Prisma.Sql = Prisma.sql`CASE ${Prisma.join(
  ALL_SEGMENTS.map(
    (segment) => Prisma.sql`WHEN ${segmentCondition(segment)} THEN ${segment}::text`,
  ),
  ' ',
)} END`;
