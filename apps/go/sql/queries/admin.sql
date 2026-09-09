-- name: CountUsers :one
SELECT COUNT(*)::int FROM "users"
WHERE "deletedAt" IS NULL
  AND (sqlc.narg('role')::"Role" IS NULL OR "role" = sqlc.narg('role')::"Role")
  AND (sqlc.narg('is_active')::boolean IS NULL OR "isActive" = sqlc.narg('is_active')::boolean)
  AND (sqlc.narg('search')::text IS NULL
       OR "fullName" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR "email" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR "username" ILIKE '%' || sqlc.narg('search')::text || '%');

-- name: ListUsers :many
SELECT u."id", u."email", u."username", u."fullName", u."role", u."isActive",
       u."phoneE164", u."lastLoginAt", u."createdAt",
       (SELECT COUNT(*) FROM "prospects" p WHERE p."createdById" = u."id")::int AS prospect_count
FROM "users" u
WHERE u."deletedAt" IS NULL
  AND (sqlc.narg('role')::"Role" IS NULL OR u."role" = sqlc.narg('role')::"Role")
  AND (sqlc.narg('is_active')::boolean IS NULL OR u."isActive" = sqlc.narg('is_active')::boolean)
  AND (sqlc.narg('search')::text IS NULL
       OR u."fullName" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR u."email" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR u."username" ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY u."isActive" DESC, u."fullName" ASC
LIMIT sqlc.arg('page_size')::int OFFSET sqlc.arg('page_offset')::int;

-- name: UserDetail :one
SELECT u."id", u."email", u."username", u."fullName", u."role", u."isActive",
       u."phoneE164", u."lastLoginAt", u."createdAt",
       (SELECT COUNT(*) FROM "prospects" p WHERE p."createdById" = u."id")::int AS prospect_count
FROM "users" u
WHERE u."id" = $1 AND u."deletedAt" IS NULL;

-- name: UserRoleForUpdate :one
SELECT "id", "role", "isActive", "email", "username" FROM "users"
WHERE "id" = $1 AND "deletedAt" IS NULL;

-- name: UserIdentifierTaken :one
SELECT "email", "username" FROM "users"
WHERE (sqlc.narg('email')::text IS NOT NULL AND "email" = sqlc.narg('email')::text)
   OR (sqlc.narg('username')::text IS NOT NULL AND "username" = sqlc.narg('username')::text)
LIMIT 1;

-- Verrou du dernier ADMIN : toutes les lignes ADMIN actives sont verrouillées,
-- pas seulement les autres, sinon deux rétrogradations croisées passent.
-- name: LockActiveAdmins :many
SELECT "id" FROM "users"
WHERE "role" = 'ADMIN' AND "isActive" AND "deletedAt" IS NULL
ORDER BY "id"
FOR UPDATE;

-- name: InsertUser :exec
INSERT INTO "users" ("id", "email", "username", "fullName", "passwordHash", "role", "phoneE164", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, now());

-- name: UpdateUser :exec
UPDATE "users" SET
  "email" = COALESCE(sqlc.narg('email')::text, "email"),
  "username" = COALESCE(sqlc.narg('username')::text, "username"),
  "fullName" = COALESCE(sqlc.narg('full_name')::text, "fullName"),
  "role" = COALESCE(sqlc.narg('role')::"Role", "role"),
  "isActive" = COALESCE(sqlc.narg('is_active')::boolean, "isActive"),
  "phoneE164" = CASE WHEN sqlc.arg('phone_touched')::boolean THEN sqlc.narg('phone')::text ELSE "phoneE164" END,
  "updatedAt" = now()
WHERE "id" = sqlc.arg('id') AND "deletedAt" IS NULL;

-- name: SoftDeleteUser :exec
UPDATE "users" SET "isActive" = false, "deletedAt" = now(), "updatedAt" = now()
WHERE "id" = $1 AND "deletedAt" IS NULL;

-- name: RevokeUserSessions :exec
UPDATE "refresh_tokens" SET "revokedAt" = now()
WHERE "userId" = $1 AND "revokedAt" IS NULL;

-- name: CountPortfolio :one
SELECT (SELECT COUNT(*) FROM "prospects" p WHERE p."createdById" = $1 AND p."deletedAt" IS NULL)::int AS prospects,
       (SELECT COUNT(*) FROM "representants" r WHERE r."createdById" = $1 AND r."deletedAt" IS NULL)::int AS representants;

-- name: HandoverTarget :one
SELECT "id", "role", "fullName" FROM "users"
WHERE "id" = $1 AND "isActive" AND "deletedAt" IS NULL;

-- name: HandoverProspects :execrows
UPDATE "prospects" SET "createdById" = sqlc.arg('repreneur'), "updatedAt" = now()
WHERE "createdById" = sqlc.arg('sortant') AND "deletedAt" IS NULL;

-- name: HandoverRepresentants :execrows
UPDATE "representants" SET "createdById" = sqlc.arg('repreneur'), "updatedAt" = now()
WHERE "createdById" = sqlc.arg('sortant') AND "deletedAt" IS NULL;

-- name: FirstAdmin :one
SELECT "id", "email", "username" FROM "users"
WHERE "role" = 'ADMIN' AND "isActive" AND "deletedAt" IS NULL
ORDER BY "createdAt" ASC, "id" ASC
LIMIT 1;

-- name: TranchesDActivite :many
SELECT "userId", "slot", "firstSeenAt", "lastSeenAt", "activeSeconds"
FROM "agent_activity_slots"
WHERE "slot" >= sqlc.arg('debut')::timestamp AND "slot" < sqlc.arg('fin')::timestamp;

-- name: GetSetting :one
SELECT "value", "updatedAt" FROM "app_settings" WHERE "key" = $1;

-- name: UpsertSetting :one
INSERT INTO "app_settings" ("key", "value", "updatedById", "updatedAt")
VALUES ($1, $2, $3, now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedById" = EXCLUDED."updatedById"
RETURNING "updatedAt";

-- name: GetDashboardLayout :one
SELECT "layout", "updatedAt" FROM "dashboard_layouts" WHERE "userId" = $1 AND "ecran" = $2;

-- name: UpsertDashboardLayout :one
INSERT INTO "dashboard_layouts" ("userId", "ecran", "layout", "updatedAt")
VALUES ($1, $2, $3, now())
ON CONFLICT ("userId", "ecran") DO UPDATE SET "layout" = EXCLUDED."layout"
RETURNING "updatedAt";

-- name: DeleteDashboardLayout :exec
DELETE FROM "dashboard_layouts" WHERE "userId" = $1 AND "ecran" = $2;

-- name: CountInscriptions :one
SELECT COUNT(*)::int FROM "inscriptions_plateforme" i
WHERE i."projet" = sqlc.arg('projet')::"Projet"
  AND (sqlc.arg('inclure_disparues')::boolean OR i."disparueLe" IS NULL)
  AND (sqlc.narg('statut')::text IS NULL OR i."statutDistant" = sqlc.narg('statut')::text)
  AND (sqlc.narg('rapproche')::boolean IS NULL
       OR (sqlc.narg('rapproche')::boolean AND i."prospectId" IS NOT NULL)
       OR (NOT sqlc.narg('rapproche')::boolean AND i."prospectId" IS NULL))
  AND (sqlc.narg('date_from')::timestamp IS NULL OR i."inscriteLe" >= sqlc.narg('date_from')::timestamp)
  AND (sqlc.narg('date_to')::timestamp IS NULL OR i."inscriteLe" <= sqlc.narg('date_to')::timestamp)
  AND (sqlc.narg('search')::text IS NULL
       OR i."nom" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR i."prenom" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR i."email" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR i."phoneE164" LIKE '%' || sqlc.narg('search')::text || '%');

-- name: ListInscriptions :many
SELECT i."id", i."projet", i."identifiantDistant", i."nom", i."prenom", i."phoneE164",
       i."email", i."statutDistant", i."etapeDistante", i."inscriteLe", i."soumiseLe",
       i."decideeLe", i."disparueLe", i."prospectId", i."dernierTirageAt"
FROM "inscriptions_plateforme" i
WHERE i."projet" = sqlc.arg('projet')::"Projet"
  AND (sqlc.arg('inclure_disparues')::boolean OR i."disparueLe" IS NULL)
  AND (sqlc.narg('statut')::text IS NULL OR i."statutDistant" = sqlc.narg('statut')::text)
  AND (sqlc.narg('rapproche')::boolean IS NULL
       OR (sqlc.narg('rapproche')::boolean AND i."prospectId" IS NOT NULL)
       OR (NOT sqlc.narg('rapproche')::boolean AND i."prospectId" IS NULL))
  AND (sqlc.narg('date_from')::timestamp IS NULL OR i."inscriteLe" >= sqlc.narg('date_from')::timestamp)
  AND (sqlc.narg('date_to')::timestamp IS NULL OR i."inscriteLe" <= sqlc.narg('date_to')::timestamp)
  AND (sqlc.narg('search')::text IS NULL
       OR i."nom" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR i."prenom" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR i."email" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR i."phoneE164" LIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY i."inscriteLe" DESC, i."id" DESC
LIMIT sqlc.arg('page_size')::int OFFSET sqlc.arg('page_offset')::int;

-- name: GetInscription :one
SELECT i."id", i."projet", i."identifiantDistant", i."nom", i."prenom", i."phoneE164",
       i."email", i."statutDistant", i."etapeDistante", i."inscriteLe", i."soumiseLe",
       i."decideeLe", i."disparueLe", i."prospectId", i."dernierTirageAt", i."chargeUtile"
FROM "inscriptions_plateforme" i
WHERE i."id" = $1 AND i."projet" = $2;

-- name: UpsertInscription :exec
INSERT INTO "inscriptions_plateforme" (
  "id", "projet", "identifiantDistant", "nom", "prenom", "phoneE164", "email",
  "statutDistant", "etapeDistante", "inscriteLe", "soumiseLe", "decideeLe",
  "disparueLe", "prospectId", "chargeUtile", "dernierTirageAt", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL, $13, $14, $15, now())
ON CONFLICT ("projet", "identifiantDistant") DO UPDATE SET
  "nom" = EXCLUDED."nom", "prenom" = EXCLUDED."prenom", "phoneE164" = EXCLUDED."phoneE164",
  "email" = EXCLUDED."email", "statutDistant" = EXCLUDED."statutDistant",
  "etapeDistante" = EXCLUDED."etapeDistante", "inscriteLe" = EXCLUDED."inscriteLe",
  "soumiseLe" = EXCLUDED."soumiseLe", "decideeLe" = EXCLUDED."decideeLe",
  "disparueLe" = NULL, "prospectId" = EXCLUDED."prospectId",
  "chargeUtile" = EXCLUDED."chargeUtile", "dernierTirageAt" = EXCLUDED."dernierTirageAt";

-- name: IdentifiantsConnus :many
SELECT "identifiantDistant" FROM "inscriptions_plateforme" WHERE "projet" = $1;

-- name: MarquerDisparues :execrows
UPDATE "inscriptions_plateforme" SET "disparueLe" = sqlc.arg('quand')::timestamp, "updatedAt" = now()
WHERE "projet" = sqlc.arg('projet')::"Projet" AND "disparueLe" IS NULL
  AND NOT ("identifiantDistant" = ANY(sqlc.arg('vus')::text[]));

-- name: PurgerInscriptions :execrows
DELETE FROM "inscriptions_plateforme" WHERE "projet" = $1;

-- name: SupprimerInscription :execrows
DELETE FROM "inscriptions_plateforme" WHERE "id" = $1 AND "projet" = $2;

-- name: CandidatsParTelephone :many
SELECT p."id", p."projet", p."phoneE164", p."whatsappE164", p."clientCreatedAt"
FROM "prospects" p
WHERE p."projet" = $1 AND p."deletedAt" IS NULL
  AND (p."phoneE164" = ANY(sqlc.arg('telephones')::text[])
       OR p."whatsappE164" = ANY(sqlc.arg('telephones')::text[]));

-- name: CandidatsParEmail :many
SELECT DISTINCT p."id", p."projet", p."phoneE164", p."whatsappE164", p."clientCreatedAt",
       LOWER(ca."email") AS email
FROM "call_attempts" ca
INNER JOIN "prospects" p ON p."id" = ca."prospectId"
WHERE p."projet" = $1 AND p."deletedAt" IS NULL
  AND ca."email" IS NOT NULL AND LOWER(ca."email") = ANY(sqlc.arg('emails')::text[]);
