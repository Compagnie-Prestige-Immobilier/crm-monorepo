import { Prisma } from '@crm/database';

/**
 * Fragments SQL partagés par les agrégats ajoutés au tableau de bord.
 *
 * `analytics.sql.ts` traduit le filtre des PROSPECTS. Il ne suffit plus ici :
 * ces agrégats comptent aussi des tâches, des tentatives d'appel, des dossiers
 * bancaires et leurs transitions. Chacune de ces tables porte sa propre colonne
 * `isDemo`, et la visibilité de démonstration doit donc être posée sur chaque
 * jointure, pas seulement sur le prospect : un dossier fictif accroché à un
 * prospect réel ressortirait sinon dans un chiffre transmis au siège.
 *
 * Le fragment est écrit une fois ici plutôt que recopié dans chaque service :
 * un oubli se corrige à un seul endroit, et le balayage de
 * `demo-visibility.sweep.test.ts` a une cible unique à surveiller.
 */

/**
 * Visibilité de démonstration portée par un ALIAS donné.
 *
 * `demoScopeSql` rend une chaîne sans alias, utilisable seulement quand la
 * requête ne joint qu'une table. Ici plusieurs tables porteuses d'`isDemo`
 * cohabitent dans la même requête : la colonne devient ambiguë, et il faut
 * donc la qualifier. Le sens de la condition reste identique : on filtre
 * quand le mode est ÉTEINT, l'état par défaut d'une plateforme en service.
 */
export const demoScopeOn = (alias: Prisma.Sql, demoEnabled: boolean): Prisma.Sql =>
  demoEnabled ? Prisma.sql`TRUE` : Prisma.sql`${alias}."isDemo" = FALSE`;

/** Alias des tables jointes, écrits une fois pour éviter les fautes de frappe. */
export const TASK = Prisma.sql`ct`;
export const ATTEMPT = Prisma.sql`ca`;
export const CAMPAIGN = Prisma.sql`cc`;
export const BANK_CASE = Prisma.sql`bc`;
export const TRANSITION = Prisma.sql`tr`;

/**
 * Issues d'appel qui signalent un numéro inexploitable.
 *
 * Deux issues, pas une : « injoignable » peut n'être qu'une absence répétée,
 * « faux numéro » est une erreur de saisie avérée. Les compter séparément
 * permet de distinguer un représentant difficile à joindre d'un représentant
 * qui remonte de mauvais numéros, et les additionner donne la part de base
 * inexploitable. Les deux clés viennent de `CallOutcome`.
 */
export const UNUSABLE_OUTCOMES = Prisma.sql`('UNREACHABLE', 'WRONG_NUMBER')`;

/**
 * Colonnes d'aboutissement d'un prospect, calculées ligne à ligne.
 *
 * Ces quatre colonnes se calculent en sous-requêtes plutôt qu'en jointures :
 * un prospect peut porter plusieurs dossiers bancaires, et une jointure
 * multiplierait sa ligne, donc son poids dans tout comptage de cohorte. La
 * sous-requête garde un prospect égal à un prospect.
 *
 * L'encaissement se lit sur l'ÉTAPE COURANTE du dossier, comme dans
 * `funnel.service.ts` : un dossier revenu en arrière n'est plus encaissé, et
 * les deux écrans doivent dire la même chose.
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

/** Ligne rendue par `prospectOutcomeColumns`, agrégée par le service. */
export interface ProspectOutcomeRow {
  prospects: number;
  methodes: number;
  dossiers: number;
  encaisses: number;
  montant: string | null;
}

/** Agrégats communs aux cohortes et au rendement par département. */
export const PROSPECT_OUTCOME_AGGREGATES = Prisma.sql`
  COUNT(*)::int                                  AS prospects,
  COUNT(*) FILTER (WHERE methode)::int           AS methodes,
  COUNT(*) FILTER (WHERE dossier)::int           AS dossiers,
  COUNT(*) FILTER (WHERE encaisse)::int          AS encaisses,
  COALESCE(SUM(montant), 0)::text                AS montant
`;

/**
 * Part en pourcentage, arrondie au dixième.
 *
 * NULLE, et non zéro, quand le dénominateur est vide. Un taux calculé sur zéro
 * observation n'est pas « 0 % », il n'existe pas. Les publier tous les deux
 * comme `0` rend l'étape sans population INDISTINGUABLE d'une étape qui a
 * réellement tout perdu : le lecteur voit « 0 % de conversion » et croit à une
 * contre-performance là où il n'y a simplement rien eu à convertir.
 *
 * Même convention que `days()` juste en dessous, qui rend déjà `null` pour un
 * échantillon vide, et que l'écran affiche en tiret.
 */
export const rate = (value: number, total: number): number | null =>
  total === 0 ? null : Math.round((value / total) * 1000) / 10;

/** Durée en jours arrondie au dixième, nulle quand l'échantillon est vide. */
export const days = (value: number | null): number | null =>
  value == null ? null : Math.round(value * 10) / 10;
