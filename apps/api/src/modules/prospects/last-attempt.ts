import { Prisma } from '@crm/database';
import type { CallOutcome } from '@crm/database';

/**
 * Dernière tentative d'appel de chaque prospect, en UNE requête.
 *
 * L'écriture naïve — une lecture `call_attempts` par ligne affichée — coûte 25
 * allers-retours pour une page de 25 et 500 000 pour un export complet ; le
 * temps de réponse devient linéaire en nombre de lignes et la base passe son
 * temps en planification. Le `JOIN LATERAL` demande au contraire à PostgreSQL
 * un seul parcours : pour chaque prospect de la liste, il descend l'index
 * `(prospectId, createdAt)` et s'arrête à la première ligne.
 *
 * `createdAt` sert de critère de récence, avec l'identifiant en départage :
 * deux tentatives peuvent partager l'horodatage à la milliseconde près quand un
 * mobile pousse un lot hors ligne, et sans second critère la « dernière »
 * changerait d'une requête à l'autre.
 */

export interface LastAttempt {
  outcome: CallOutcome;
  comment: string | null;
  at: Date;
}

interface LastAttemptRow {
  prospectId: string;
  outcome: CallOutcome;
  comment: string | null;
  at: Date;
}

/** Le strict nécessaire de `PrismaService`, pour que les tests n'aient rien d'autre à fournir. */
export interface RawQueryRunner {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

export async function lastAttemptsByProspect(
  prisma: RawQueryRunner,
  prospectIds: readonly string[],
): Promise<Map<string, LastAttempt>> {
  // `Prisma.join` lève sur un tableau vide, et une page vide est un cas normal
  // (dernière page, filtre sans résultat) : on court-circuite avant la requête.
  if (!prospectIds.length) return new Map();

  const rows = await prisma.$queryRaw<LastAttemptRow[]>`
    SELECT
      p."id"        AS "prospectId",
      a."outcome"   AS "outcome",
      a."comment"   AS "comment",
      a."createdAt" AS "at"
    FROM "prospects" p
    JOIN LATERAL (
      SELECT ca."outcome", ca."comment", ca."createdAt"
      FROM "call_attempts" ca
      WHERE ca."prospectId" = p."id"
      ORDER BY ca."createdAt" DESC, ca."id" DESC
      LIMIT 1
    ) a ON TRUE
    WHERE p."id" IN (${Prisma.join([...prospectIds])})
  `;

  return new Map(
    rows.map((row) => [row.prospectId, { outcome: row.outcome, comment: row.comment, at: row.at }]),
  );
}
