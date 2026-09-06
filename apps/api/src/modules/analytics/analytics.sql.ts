import { ALL_SEGMENTS, CBAO_SHORT_NAME, CHUES_SIGLE, Prisma, segmentAxes } from '@crm/database';
import type { BddSegment } from '@crm/database';

import { isAdmin, readableOwnerId, readsEveryone } from '../../common/scope.js';
import { tryNormalizePhone } from '../../common/phone.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';

export function prospectConditions(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  filter: ProspectFilterDto,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (!readsEveryone(user)) {
    conditions.push(Prisma.sql`p."createdById" = ${user.id}`);
  }
  if (filter.commercialId) {
    conditions.push(Prisma.sql`p."createdById" = ${readableOwnerId(user, filter.commercialId)}`);
  }

  if (!(filter.includeDeleted && isAdmin(user))) {
    conditions.push(Prisma.sql`p."deletedAt" IS NULL`);
  }
  // Sans ce filtre, un total « par département » dépasse le total global.
  // `IS NULL` couvre les deux cas : le représentant supprimé est écarté, et la
  // fiche SANS représentant — tout le Grand Public — reste comptée.
  conditions.push(Prisma.sql`r."deletedAt" IS NULL`);
  conditions.push(...prospectFilterConditions(filter));

  if (!conditions.length) return Prisma.sql`TRUE`;
  return Prisma.join(conditions, ' AND ');
}

/** Les deux valeurs bornent aux demandes converties : rien d'autre ne se revoit. */
function revueConditions(revue: boolean): Prisma.Sql[] {
  return [
    Prisma.sql`p."statut" = 'CONVERTI'::"ProspectStatut"`,
    revue ? Prisma.sql`p."revueAt" IS NOT NULL` : Prisma.sql`p."revueAt" IS NULL`,
  ];
}

/**
 * Portée des prospects en SQL. Les agrégats sont écrits en SQL brut, une clause
 * Prisma ne s'y réemploie pas ; c'est la même règle, elle doit bouger en même temps.
 */
function prospectFilterConditions(filter: ProspectFilterDto): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  const directConditions: Array<[unknown, Prisma.Sql]> = [
    [filter.representantId, Prisma.sql`p."representantId" = ${filter.representantId}`],
    [filter.banqueId, Prisma.sql`p."banqueId" = ${filter.banqueId}`],
    [filter.syndicatId, Prisma.sql`p."syndicatId" = ${filter.syndicatId}`],
    [filter.type, Prisma.sql`p."type" = ${filter.type}::"ProspectType"`],
    [filter.canalProvenanceId, Prisma.sql`p."canalProvenanceId" = ${filter.canalProvenanceId}`],
    [filter.origin, Prisma.sql`p."origin" = ${filter.origin}`],
    [filter.departementId, Prisma.sql`r."departementId" = ${filter.departementId}`],
    [filter.phase2Status, Prisma.sql`p."phase2Status" = ${filter.phase2Status}::"Phase2Status"`],
    [
      filter.enrollmentMethod,
      Prisma.sql`p."enrollmentMethod" = ${filter.enrollmentMethod}::"EnrollmentMethod"`,
    ],
    [
      filter.enrollmentCapturedById,
      Prisma.sql`p."enrollmentCapturedById" = ${filter.enrollmentCapturedById}`,
    ],
  ];
  for (const [value, condition] of directConditions) {
    if (value) conditions.push(condition);
  }

  if (filter.projet) {
    let statut = Prisma.empty;
    if (filter.statut) {
      statut = Prisma.sql`AND pj."statut" = ${filter.statut}::"ProspectStatut"`;
    }
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "prospect_journeys" pj
        WHERE pj."prospectId" = p."id"
          AND pj."projet" = ${filter.projet}::"Projet"
          ${statut}
      )`,
    );
  }
  if (filter.statut && !filter.projet) {
    conditions.push(Prisma.sql`p."statut" = ${filter.statut}::"ProspectStatut"`);
  }
  if (filter.revue !== undefined) conditions.push(...revueConditions(filter.revue));
  if (filter.segment) conditions.push(segmentCondition(filter.segment));
  if (filter.appelePar) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "call_attempts" ca
      WHERE ca."prospectId" = p."id" AND ca."performedById" = ${filter.appelePar}
    )`);
  }
  if (filter.dateFrom) {
    conditions.push(Prisma.sql`p."clientCreatedAt" >= ${inclusiveDateFrom(filter.dateFrom)}`);
  }
  if (filter.dateTo) {
    conditions.push(Prisma.sql`p."clientCreatedAt" <= ${inclusiveDateTo(filter.dateTo)}`);
  }

  const search = searchCondition(filter.search);
  if (search) conditions.push(search);
  return conditions;
}

function searchCondition(rawSearch: string | undefined): Prisma.Sql | undefined {
  const search = rawSearch?.trim();
  if (!search) return undefined;
  const like = `%${search.toLowerCase()}%`;
  const compact = search.replace(/[^\d+]/gu, '');
  let phone = Prisma.empty;
  if (compact.replace(/\D/gu, '').length >= 3) {
    phone = Prisma.sql`OR p."phoneE164" LIKE ${`%${tryNormalizePhone(search) ?? compact}%`}`;
  }
  return Prisma.sql`((lower(p."nom") || ' ' || lower(p."prenom")) LIKE ${like} ${phone})`;
}

/**
 * Périmètre de l'annuaire, sur l'alias `r`.
 *
 * Sans bornes de date : un agrégat de représentants se date sur l'ACTE mesuré,
 * pas sur la fiche, et la colonne qui le porte change d'un agrégat à l'autre.
 */
export function representantConditions(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  filter: ProspectFilterDto,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`r."deletedAt" IS NULL`];

  if (!readsEveryone(user)) {
    conditions.push(Prisma.sql`r."createdById" = ${user.id}`);
  }
  if (filter.commercialId) {
    const target = readableOwnerId(user, filter.commercialId);
    conditions.push(Prisma.sql`r."createdById" = ${target}`);
  }

  if (filter.representantId) conditions.push(Prisma.sql`r."id" = ${filter.representantId}`);
  if (filter.departementId) {
    conditions.push(Prisma.sql`r."departementId" = ${filter.departementId}`);
  }

  return Prisma.join(conditions, ' AND ');
}

/**
 * `representants` porte le département, `syndicats`/`banques` le segment.
 *
 * LEFT et non INNER : les trois clés sont NULLABLES depuis le Grand Public, qui
 * ne passe par aucun représentant. En jointure interne, 100 % des fiches Grand
 * Public — et toute fiche CHUES sans banque — disparaissaient de TOUS les
 * agrégats. Sans erreur, sans zéro : un total simplement plus petit, à côté
 * d'une liste qui, elle, les comptait.
 */
export const PROSPECT_FROM = Prisma.sql`
  FROM "prospects" p
  LEFT JOIN "representants" r ON r."id" = p."representantId"
  LEFT JOIN "syndicats" sy ON sy."id" = p."syndicatId"
  LEFT JOIN "banques" bq ON bq."id" = p."banqueId"
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
