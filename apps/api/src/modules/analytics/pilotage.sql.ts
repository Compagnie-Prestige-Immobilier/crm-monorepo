import { Prisma } from '@crm/database';

/**
 * Chaque table jointe porte son propre `isDemo` : la visibilité doit être posée
 * sur chaque alias, sinon un dossier fictif accroché à un prospect réel ressort.
 */
export const demoScopeOn = (alias: Prisma.Sql, demoEnabled: boolean): Prisma.Sql =>
  demoEnabled ? Prisma.sql`TRUE` : Prisma.sql`${alias}."isDemo" = FALSE`;

export const TASK = Prisma.sql`ct`;
export const ATTEMPT = Prisma.sql`ca`;
export const CAMPAIGN = Prisma.sql`cc`;
export const BANK_CASE = Prisma.sql`bc`;
export const TRANSITION = Prisma.sql`tr`;

/** Clés de `CallOutcome` comptant pour un numéro inexploitable. */
export const UNUSABLE_OUTCOMES = Prisma.sql`('UNREACHABLE', 'WRONG_NUMBER')`;

/**
 * Sous-requêtes et non jointures : un prospect porte plusieurs dossiers, une
 * jointure multiplierait sa ligne. Encaissé se lit sur l'ÉTAPE COURANTE.
 */
export function prospectOutcomeColumns(demoEnabled: boolean): Prisma.Sql {
  const scope = demoScopeOn(BANK_CASE, demoEnabled);
  return Prisma.sql`
    (p."phase2Status" = 'METHOD_OBTAINED')                                AS methode,
    EXISTS (
      SELECT 1 FROM "bank_cases" bc
      WHERE bc."prospectId" = p."id" AND bc."deletedAt" IS NULL AND ${scope}
    )                                                                     AS dossier,
    EXISTS (
      SELECT 1 FROM "bank_cases" bc
      INNER JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
      WHERE bc."prospectId" = p."id" AND bc."deletedAt" IS NULL AND ${scope}
        AND st."type" = 'CASHED'
    )                                                                     AS encaisse,
    COALESCE((
      SELECT SUM(bc."amountXof") FROM "bank_cases" bc
      INNER JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
      WHERE bc."prospectId" = p."id" AND bc."deletedAt" IS NULL AND ${scope}
        AND st."type" = 'CASHED'
    ), 0)                                                                 AS montant
  `;
}

export interface ProspectOutcomeRow {
  prospects: number;
  methodes: number;
  dossiers: number;
  encaisses: number;
  montant: string | null;
}

export const PROSPECT_OUTCOME_AGGREGATES = Prisma.sql`
  COUNT(*)::int                                  AS prospects,
  COUNT(*) FILTER (WHERE methode)::int           AS methodes,
  COUNT(*) FILTER (WHERE dossier)::int           AS dossiers,
  COUNT(*) FILTER (WHERE encaisse)::int          AS encaisses,
  COALESCE(SUM(montant), 0)::text                AS montant
`;

/** Null et non 0 sur dénominateur vide : « rien à convertir » n'est pas « tout perdu ». */
export const rate = (value: number, total: number): number | null =>
  total === 0 ? null : Math.round((value / total) * 1000) / 10;

export const days = (value: number | null): number | null =>
  value == null ? null : Math.round(value * 10) / 10;
