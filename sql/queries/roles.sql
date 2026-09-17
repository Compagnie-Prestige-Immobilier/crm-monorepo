-- Un rôle sans permission sort aussi, avec une permission nulle.
-- name: ListRolePermissions :many
SELECT r."id" AS role_id, rp."permission"
FROM "roles" r
LEFT JOIN "role_permissions" rp ON rp."roleId" = r."id"
ORDER BY r."id", rp."permission";

-- name: ListRoles :many
SELECT r."id", r."libelle", r."roleDeBase", r."systeme",
       (SELECT COUNT(*) FROM "users" u WHERE u."roleId" = r."id")::int AS comptes,
       (SELECT COUNT(*) FROM "users" u WHERE u."roleId" = r."id" AND u."deletedAt" IS NULL AND u."isActive")::int AS comptes_actifs
FROM "roles" r
ORDER BY NOT r."systeme", lower(r."libelle");

-- name: RoleForUpdate :one
SELECT r."id", r."libelle", r."roleDeBase", r."systeme",
       (SELECT COUNT(*) FROM "users" u WHERE u."roleId" = r."id")::int AS comptes
FROM "roles" r WHERE r."id" = $1
FOR UPDATE OF r;

-- name: RoleParId :one
SELECT "id", "libelle", "roleDeBase", "systeme" FROM "roles" WHERE "id" = $1;

-- name: RoleLibellePris :one
SELECT EXISTS (
  SELECT 1 FROM "roles" WHERE lower("libelle") = lower(sqlc.arg('libelle')::text) AND "id" <> sqlc.arg('sauf')::text
);

-- name: InsertRole :exec
INSERT INTO "roles" ("id", "libelle", "roleDeBase") VALUES ($1, $2, $3);

-- name: UpdateRole :exec
UPDATE "roles" SET
  "libelle" = COALESCE(sqlc.narg('libelle')::text, "libelle"),
  "roleDeBase" = COALESCE(sqlc.narg('role_de_base')::"Role", "roleDeBase")
WHERE "id" = sqlc.arg('id') AND NOT "systeme";

-- name: DeleteRole :exec
DELETE FROM "roles" WHERE "id" = $1 AND NOT "systeme";

-- name: RolePermissions :many
SELECT "permission" FROM "role_permissions" WHERE "roleId" = $1 ORDER BY "permission";

-- name: DeleteRolePermissions :exec
DELETE FROM "role_permissions" WHERE "roleId" = $1;

-- name: InsertRolePermissions :exec
INSERT INTO "role_permissions" ("roleId", "permission")
SELECT sqlc.arg('role_id')::text, unnest(sqlc.arg('permissions')::text[]);

-- Toute écriture qui peut retirer l'administration des rôles se sérialise ici :
-- deux retraits croisés se liraient sinon l'un l'autre.
-- name: VerrouAdministrationDesRoles :exec
SELECT pg_advisory_xact_lock(hashtext('roles.administrer'));

-- name: CountAdministrateursDesRoles :one
SELECT COUNT(*)::int FROM "users" u
JOIN "role_permissions" rp ON rp."roleId" = u."roleId" AND rp."permission" = 'roles.administrer'
WHERE u."isActive" AND u."deletedAt" IS NULL;
