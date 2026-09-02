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

export function bankCaseConditions(filter: BankCaseFilterDto): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`c."deletedAt" IS NULL`];

  if (filter.stageId) conditions.push(Prisma.sql`c."currentStageId" = ${filter.stageId}`);
  if (filter.stageType) {
    conditions.push(Prisma.sql`s."type" = ${filter.stageType}::"BankStageType"`);
  }
  if (filter.banqueId) conditions.push(Prisma.sql`c."processingBankId" = ${filter.banqueId}`);
  // Le PARCOURS, pas le projet d'entrée : un même numéro suit CHUES et Grand
  // Public à la fois, et `prospects."projet"` ne dit que par où il est arrivé.
  // Sous-requête plutôt qu'une jointure : `BANK_CASE_FROM` sert aussi aux
  // agrégats, et y ajouter une table changerait leurs comptages.
  if (filter.projet) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "prospect_journeys" pj
        WHERE pj."prospectId" = c."prospectId" AND pj."projet" = ${filter.projet}::"Projet"
      )`,
    );
  }
  if (filter.rejectionReasonId) {
    conditions.push(Prisma.sql`c."rejectionReasonId" = ${filter.rejectionReasonId}`);
  }
  if (filter.agentId) {
    // Créateur OU dernier intervenant : reprendre le dossier d'un collègue compte.
    conditions.push(
      Prisma.sql`(c."createdById" = ${filter.agentId} OR c."updatedById" = ${filter.agentId})`,
    );
  }
  if (filter.dateFrom)
    conditions.push(Prisma.sql`c."createdAt" >= ${inclusiveDateFrom(filter.dateFrom)}`);
  if (filter.dateTo)
    conditions.push(Prisma.sql`c."createdAt" <= ${inclusiveDateTo(filter.dateTo)}`);

  // Un filtre de montant ne retient jamais un dossier ouvert : son montant est
  // NULL, et NULL n'est ni supérieur ni inférieur à une borne.
  if (filter.amountMin !== undefined) {
    conditions.push(Prisma.sql`c."amountXof" >= ${filter.amountMin}::numeric`);
  }
  if (filter.amountMax !== undefined) {
    conditions.push(Prisma.sql`c."amountXof" <= ${filter.amountMax}::numeric`);
  }

  const search = filter.search?.trim();
  if (search) {
    const like = `%${search}%`;
    const referenceLike = `%${normalizeReferenceKey(search)}%`;
    // QUATRE CHIFFRES AU MOINS : « DOS-3 » ne laisse que « 3 », et un seuil plus
    // bas ferait joindre tous les téléphones contenant ce chiffre.
    const digits = search.replace(/\D/gu, '');
    const normalized = tryNormalizePhone(search);
    const phoneLike = `%${normalized ?? digits}%`;
    const phoneCondition =
      normalized !== undefined || digits.length >= 4
        ? Prisma.sql`OR c."customerPhoneE164" LIKE ${phoneLike}`
        : Prisma.sql``;

    conditions.push(Prisma.sql`(
      c."referenceKey" LIKE ${referenceLike}
      OR unaccent(lower(c."customerName")) LIKE unaccent(lower(${like}))
      ${phoneCondition}
    )`);
  }

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
