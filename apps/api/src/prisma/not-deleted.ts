/**
 * Suppression logique — assistant partagé.
 *
 * Chaque entité métier porte un `deletedAt`. Une lecture qui l'oublie ressort
 * des fiches supprimées : au mieux un doublon apparent dans le panel admin, au
 * pire une fiche « supprimée » réapparue sur le mobile après une synchro.
 *
 * Plutôt qu'une extension Prisma (qui masque la règle dans une couche que le
 * lecteur du service ne voit pas, et que `$queryRaw` contourne de toute façon),
 * la règle est un helper explicite composé dans chaque `where`. Le test de
 * balayage `soft-delete.test.ts` garantit qu'aucun service ne l'oublie.
 */

/** Le fragment `where` qui exclut les lignes supprimées logiquement. */
export const notDeleted = { deletedAt: null } as const;

/** Compose `notDeleted` avec le reste d'un filtre. */
export const withNotDeleted = <T extends object>(where?: T): T & { deletedAt: null } => ({
  ...(where ?? ({} as T)),
  ...notDeleted,
});

/**
 * Fragment SQL équivalent, pour les agrégats écrits en SQL brut.
 * Les colonnes sont en camelCase entre guillemets : seules les TABLES portent
 * un `@@map` en snake_case dans le schéma, pas les champs.
 */
export const NOT_DELETED_SQL = '"deletedAt" IS NULL';
