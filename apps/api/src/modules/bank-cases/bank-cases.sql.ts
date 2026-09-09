import { Prisma } from '@crm/database';

import { tryNormalizePhone } from '../../common/phone.js';
import { normalizeReferenceKey } from './reference-key.js';
import { BankCaseSortField } from './dto.js';
import type { BankCaseFilterDto } from './dto.js';
import { SortOrder } from '../../common/dto/prospect-filter.dto.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';

// SOURCE UNIQUE du filtrage : la liste, les agrégats et l'export passent tous
// par ces conditions, faute de quoi les compteurs et le tableau divergeraient.
export const BANK_CASE_FROM = Prisma.sql`
  FROM "bank_cases" c
  INNER JOIN "bank_case_stages" s ON s."id" = c."currentStageId"
`;

// Date d'ENTRÉE en étape terminale, lue dans l'historique : `updatedAt` bougerait
// à toute correction ultérieure. `MAX` car après réouverture la dernière issue fait foi.
export const closedAtLateral = (caseAlias: Prisma.Sql): Prisma.Sql => Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT MAX(bt."createdAt") AS "closedAt"
    FROM "bank_case_transitions" bt
    INNER JOIN "bank_case_stages" bs ON bs."id" = bt."toStageId"
    WHERE bt."caseId" = ${caseAlias}."id" AND bs."type" <> 'OPEN'
  ) cl ON TRUE
`;

// Le PARCOURS, pas le projet d'entrée : un même numéro suit CHUES et Grand
// Public à la fois, et `prospects."projet"` ne dit que par où il est arrivé.
// Sous-requête plutôt qu'une jointure : `BANK_CASE_FROM` sert aussi aux
// agrégats, et y ajouter une table changerait leurs comptages.
const projetCondition = (filter: BankCaseFilterDto): Prisma.Sql | undefined =>
  filter.projet
    ? Prisma.sql`EXISTS (
        SELECT 1 FROM "prospect_journeys" pj
        WHERE pj."prospectId" = c."prospectId" AND pj."projet" = ${filter.projet}::"Projet"
      )`
    : undefined;

// Créateur OU dernier intervenant : reprendre le dossier d'un collègue compte.
const agentCondition = (filter: BankCaseFilterDto): Prisma.Sql | undefined =>
  filter.agentId
    ? Prisma.sql`(c."createdById" = ${filter.agentId} OR c."updatedById" = ${filter.agentId})`
    : undefined;

// QUATRE CHIFFRES AU MOINS : « DOS-3 » ne laisse que « 3 », et un seuil plus
// bas ferait joindre tous les téléphones contenant ce chiffre.
function searchCondition(filter: BankCaseFilterDto): Prisma.Sql | undefined {
  const search = filter.search?.trim();
  if (!search) return undefined;

  const like = `%${search}%`;
  const referenceLike = `%${normalizeReferenceKey(search)}%`;
  const digits = search.replace(/\D/gu, '');
  const normalized = tryNormalizePhone(search);
  const phoneLike = `%${normalized ?? digits}%`;
  const phoneCondition =
    normalized !== undefined || digits.length >= 4
      ? Prisma.sql`OR c."customerPhoneE164" LIKE ${phoneLike}`
      : Prisma.sql``;

  return Prisma.sql`(
    c."referenceKey" LIKE ${referenceLike}
    OR unaccent(lower(c."customerName")) LIKE unaccent(lower(${like}))
    ${phoneCondition}
  )`;
}

function optionalConditions(filter: BankCaseFilterDto): (Prisma.Sql | undefined)[] {
  return [
    filter.stageId ? Prisma.sql`c."currentStageId" = ${filter.stageId}` : undefined,
    filter.stageType ? Prisma.sql`s."type" = ${filter.stageType}::"BankStageType"` : undefined,
    filter.banqueId ? Prisma.sql`c."processingBankId" = ${filter.banqueId}` : undefined,
    projetCondition(filter),
    filter.rejectionReasonId
      ? Prisma.sql`c."rejectionReasonId" = ${filter.rejectionReasonId}`
      : undefined,
    agentCondition(filter),
    filter.dateFrom
      ? Prisma.sql`c."createdAt" >= ${inclusiveDateFrom(filter.dateFrom)}`
      : undefined,
    filter.dateTo ? Prisma.sql`c."createdAt" <= ${inclusiveDateTo(filter.dateTo)}` : undefined,
    // Un filtre de montant ne retient jamais un dossier ouvert : son montant
    // est NULL, et NULL n'est ni supérieur ni inférieur à une borne.
    filter.amountMin !== undefined
      ? Prisma.sql`c."amountXof" >= ${filter.amountMin}::numeric`
      : undefined,
    filter.amountMax !== undefined
      ? Prisma.sql`c."amountXof" <= ${filter.amountMax}::numeric`
      : undefined,
    searchCondition(filter),
  ];
}

export function bankCaseConditions(filter: BankCaseFilterDto): Prisma.Sql {
  const conditions = [Prisma.sql`c."deletedAt" IS NULL`, ...optionalConditions(filter)].filter(
    (condition): condition is Prisma.Sql => Boolean(condition),
  );

  return Prisma.join(conditions, ' AND ');
}

export function bankCaseOrderBy(
  sortBy: BankCaseSortField | undefined,
  sortOrder: SortOrder | undefined,
): Prisma.Sql {
  let column = Prisma.sql`c."createdAt"`;
  switch (sortBy) {
    case BankCaseSortField.UPDATED_AT:
      column = Prisma.sql`c."updatedAt"`;
      break;
    case BankCaseSortField.REFERENCE:
      column = Prisma.sql`c."referenceKey"`;
      break;
    case BankCaseSortField.CUSTOMER_NAME:
      column = Prisma.sql`c."customerName"`;
      break;
    case BankCaseSortField.AMOUNT:
      column = Prisma.sql`c."amountXof"`;
      break;
  }

  const direction = sortOrder === SortOrder.ASC ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  // `c."id"` en second critère : sans lui, deux dossiers créés dans la même
  // milliseconde changent de page entre deux requêtes et l'un n'apparaît jamais.
  return Prisma.sql`ORDER BY ${column} ${direction} NULLS LAST, c."id" ${direction}`;
}
