import { ALL_SEGMENTS, CBAO_SHORT_NAME, CHUES_SIGLE, Prisma, segmentAxes } from '@crm/database';
import type { BddSegment } from '@crm/database';

import { isAdmin } from '../../common/scope.js';
import { tryNormalizePhone } from '../../common/phone.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';

/**
 * Traduction du filtre commun en conditions SQL, pour les agrégats.
 *
 * Les endpoints analytiques ne renvoient JAMAIS de lignes brutes au navigateur :
 * un panel admin qui télécharge 50 000 prospects pour en compter les
 * départements côté client transporte des données personnelles inutiles, sature
 * la connexion et devient inutilisable. L'agrégation reste donc dans PostgreSQL.
 *
 * Chaque valeur passe par `Prisma.sql`, donc par une requête paramétrée : aucun
 * fragment n'est concaténé à la main.
 */
export function prospectConditions(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  filter: ProspectFilterDto,
  demoEnabled: boolean,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  // Cloisonnement d'abord, et non surchargeable par un paramètre de requête.
  if (!isAdmin(user)) {
    conditions.push(Prisma.sql`p."createdById" = ${user.id}`);
  }

  // Visibilité de démonstration. Elle porte sur le PROSPECT, comme du côté
  // Prisma : c'est lui que l'agrégat compte, et c'est donc lui qui décide si la
  // ligne entre ou non dans le total.
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
  // Une fiche rattachée à un représentant supprimé ne doit plus compter nulle
  // part : sinon un total « par département » dépasse le total global.
  conditions.push(Prisma.sql`r."deletedAt" IS NULL`);

  if (filter.representantId)
    conditions.push(Prisma.sql`p."representantId" = ${filter.representantId}`);
  if (filter.banqueId) conditions.push(Prisma.sql`p."banqueId" = ${filter.banqueId}`);
  if (filter.syndicatId) conditions.push(Prisma.sql`p."syndicatId" = ${filter.syndicatId}`);
  if (filter.statut) {
    conditions.push(Prisma.sql`p."statut" = ${filter.statut}::"ProspectStatut"`);
  }
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
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "call_tasks" ct
        WHERE ct."prospectId" = p."id" AND ct."campaignId" = ${filter.campaignId}
      )`,
    );
  }
  if (filter.dateFrom) {
    conditions.push(Prisma.sql`p."clientCreatedAt" >= ${new Date(filter.dateFrom)}`);
  }
  if (filter.dateTo) {
    conditions.push(Prisma.sql`p."clientCreatedAt" <= ${new Date(filter.dateTo)}`);
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

/**
 * Jointure commune à tous les agrégats.
 *
 * `representants` est jointe systématiquement, même quand aucun filtre ne la
 * mentionne : c'est elle qui porte le département, et c'est aussi elle qui
 * permet d'exclure les fiches rattachées à un représentant supprimé.
 *
 * `syndicats` et `banques` le sont pour la même raison, côté segment : ce sont
 * leurs clés naturelles (`sigle`, `shortName`) qui portent le sens métier, et
 * les deux jointures sont sans perte puisque les deux clés étrangères sont
 * obligatoires et en `Restrict`.
 */
export const PROSPECT_FROM = Prisma.sql`
  FROM "prospects" p
  INNER JOIN "representants" r ON r."id" = p."representantId"
  INNER JOIN "syndicats" sy ON sy."id" = p."syndicatId"
  INNER JOIN "banques" bq ON bq."id" = p."banqueId"
`;

/**
 * Traduction SQL d'un segment.
 *
 * Les axes ne sont PAS réécrits ici : ils sont lus dans `segmentAxes`, la même
 * source que `segmentWhere` utilisé par la liste et l'export. Ce fichier ne
 * fait que transposer un booléen déjà décidé ailleurs vers une comparaison
 * SQL ; la matrice BDD1–BDD4 reste définie en un seul endroit.
 */
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

/**
 * Expression qui rend le segment d'une ligne, construite branche par branche à
 * partir de `segmentCondition`. Les quatre segments étant exhaustifs et
 * disjoints, la clause `ELSE` serait morte : son absence est le signal qu'un
 * segment ajouté sans reconstruire cette expression rendrait NULL plutôt que
 * de se ranger silencieusement dans un fourre-tout.
 */
export const SEGMENT_EXPR: Prisma.Sql = Prisma.sql`CASE ${Prisma.join(
  ALL_SEGMENTS.map(
    (segment) => Prisma.sql`WHEN ${segmentCondition(segment)} THEN ${segment}::text`,
  ),
  ' ',
)} END`;
