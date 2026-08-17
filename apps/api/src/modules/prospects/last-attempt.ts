import { Prisma } from '@crm/database';
import type { CallOutcome } from '@crm/database';

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

export interface RawQueryRunner {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

export async function lastAttemptsByProspect(
  prisma: RawQueryRunner,
  prospectIds: readonly string[],
): Promise<Map<string, LastAttempt>> {
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
