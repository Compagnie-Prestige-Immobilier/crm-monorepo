/**
 * Fragment explicite et non extension Prisma : une extension masque la règle et
 * `$queryRaw` la contourne. Le balayage `soft-delete.test.ts` vérifie qu'aucune
 * lecture ne l'oublie — une fiche supprimée réapparaîtrait sur le mobile.
 */
export const notDeleted = { deletedAt: null } as const;

export const withNotDeleted = <T extends object>(where?: T): T & { deletedAt: null } => ({
  ...(where ?? ({} as T)),
  ...notDeleted,
});

/** Colonne en camelCase entre guillemets : seules les TABLES portent un `@@map`. */
export const NOT_DELETED_SQL = '"deletedAt" IS NULL';
