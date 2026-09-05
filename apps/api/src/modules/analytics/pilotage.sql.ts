import { Prisma } from '@crm/database';

export const ALL_ROWS = Prisma.sql`TRUE`;

export const TASK = Prisma.sql`ct`;
export const ATTEMPT = Prisma.sql`ca`;
export const CAMPAIGN = Prisma.sql`cc`;
export const BANK_CASE = Prisma.sql`bc`;
export const TRANSITION = Prisma.sql`tr`;
export const RELATION_CHANGE = Prisma.sql`rc`;

/**
 * Clés de `CallOutcome` qui ne comptent PAS comme un contact. Un faux numéro
 * n'en est plus : la fiche est traitée, elle sort du numérateur des
 * injoignables. Miroir de `countsAsReached`, tenu par
 * `referentiels/call-outcome-rules.test.ts`.
 */
export const NOT_REACHED_OUTCOMES = Prisma.sql`('UNREACHABLE')`;

/**
 * Les seules issues de `RepCallOutcome` que le terrain sait encore saisir.
 * `PROSPECTS_PROMISED` et `OTHER` sont de l'héritage : ni
 * numérateur ni dénominateur, sinon les taux dépendraient de l'âge des données.
 */
export const REP_LIVE_OUTCOMES = Prisma.sql`('REACHED', 'REFUSED', 'CALLBACK', 'UNREACHABLE', 'WRONG_NUMBER')`;

/**
 * La famille jointe côté représentant, telle que `brancheDe` la dérive de
 * l'effet du statut. Un faux numéro y entre : quelqu'un a décroché.
 */
export const REP_JOINT_OUTCOMES = Prisma.sql`('REACHED', 'REFUSED', 'CALLBACK', 'WRONG_NUMBER')`;

/** À placer après `FROM "rep_call_attempts" rca` pour lire `REP_ARBITRAGE`. */
export const REP_STATUT_JOIN = Prisma.sql`LEFT JOIN "statuts_qualification" sq ON sq."id" = rca."statutQualificationId"`;

/**
 * Ce que la tentative tranche de l'adhésion, ou NULL quand elle ne tranche
 * rien. La relation posée par le statut fait foi : seul « Accepté » pose
 * AMBASSADEUR, seul « Refusé » pose REFUS. « Décédé », « Hors cible » ou
 * « Autre joint » sont joints et fermés sans être un arbitrage : hors
 * numérateur ET hors dénominateur, comme l'héritage ci-dessus. Une tentative
 * d'avant le référentiel ne porte aucun statut : son issue reste le seul
 * signal, sinon le taux d'acceptation changerait avec l'âge des données.
 */
export const REP_ARBITRAGE = Prisma.sql`CASE
    WHEN sq."relationStatus" IN ('AMBASSADEUR', 'REFUS') THEN sq."relationStatus"::text
    WHEN rca."statutQualificationId" IS NOT NULL THEN NULL
    WHEN rca."outcome" = 'REACHED' THEN 'AMBASSADEUR'
    WHEN rca."outcome" = 'REFUSED' THEN 'REFUS'
  END`;

/**
 * Sous-requêtes et non jointures : un prospect porte plusieurs dossiers, une
 * jointure multiplierait sa ligne. Encaissé se lit sur l'ÉTAPE COURANTE.
 */
export function prospectOutcomeColumns(): Prisma.Sql {
  return Prisma.sql`
    (p."phase2Status" = 'METHOD_OBTAINED')                                AS methode,
    EXISTS (
      SELECT 1 FROM "bank_cases" bc
      WHERE bc."prospectId" = p."id" AND bc."deletedAt" IS NULL
    )                                                                     AS dossier,
    EXISTS (
      SELECT 1 FROM "bank_cases" bc
      INNER JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
      WHERE bc."prospectId" = p."id" AND bc."deletedAt" IS NULL
        AND st."type" = 'CASHED'
    )                                                                     AS encaisse,
    COALESCE((
      SELECT SUM(bc."amountXof") FROM "bank_cases" bc
      INNER JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
      WHERE bc."prospectId" = p."id" AND bc."deletedAt" IS NULL
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
