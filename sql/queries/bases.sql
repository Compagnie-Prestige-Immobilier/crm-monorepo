-- name: BasesDemonstration :many
SELECT b."nom", b."baseSql", b."createdAt", u."fullName" AS "createdByName"
FROM "bases_demonstration" b
LEFT JOIN "users" u ON u."id" = b."createdById"
ORDER BY b."nom";

-- name: BaseDemonstrationInserer :exec
INSERT INTO "bases_demonstration" ("nom", "baseSql", "createdById") VALUES ($1, $2, $3);

-- name: BaseDemonstrationSupprimer :execrows
DELETE FROM "bases_demonstration" WHERE "nom" = $1;

-- name: BasesDemonstrationCompte :one
SELECT COUNT(*)::int FROM "bases_demonstration";
