-- name: UserForLogin :one
SELECT u."id", u."email", u."username", u."fullName", u."role", u."phoneE164", u."isActive", u."passwordHash",
       u."roleId", r."libelle" AS role_libelle
FROM "users" u
JOIN "roles" r ON r."id" = u."roleId"
WHERE u."deletedAt" IS NULL
  AND (lower(u."email") = lower(@identifier) OR lower(u."username") = lower(@identifier))
ORDER BY u."createdAt", u."id"
LIMIT 1;

-- name: TouchLastLogin :exec
UPDATE "users" SET "lastLoginAt" = now(), "updatedAt" = now() WHERE "id" = $1;

-- name: InsertSession :exec
INSERT INTO "refresh_tokens" ("id", "userId", "tokenHash", "familyId", "expiresAt", "userAgent")
VALUES ($1, $2, $3, $1, $4, $5);

-- name: UserBySession :one
SELECT u."id", u."email", u."username", u."fullName", u."role", u."phoneE164", u."roleId", r."libelle" AS role_libelle
FROM "refresh_tokens" rt
JOIN "users" u ON u."id" = rt."userId"
JOIN "roles" r ON r."id" = u."roleId"
WHERE rt."tokenHash" = $1
  AND rt."revokedAt" IS NULL
  AND rt."expiresAt" > now()
  AND u."deletedAt" IS NULL
  AND u."isActive";

-- name: UserActifParId :one
SELECT u."id", u."email", u."username", u."fullName", u."role", u."phoneE164", u."roleId", r."libelle" AS role_libelle
FROM "users" u
JOIN "roles" r ON r."id" = u."roleId"
WHERE u."id" = $1 AND u."deletedAt" IS NULL AND u."isActive";

-- name: RevokeSession :exec
UPDATE "refresh_tokens" SET "revokedAt" = now() WHERE "tokenHash" = $1 AND "revokedAt" IS NULL;

-- name: RevokeOtherSessions :exec
UPDATE "refresh_tokens" SET "revokedAt" = now()
WHERE "userId" = $1 AND "tokenHash" <> $2 AND "revokedAt" IS NULL;

-- name: UpdatePassword :exec
UPDATE "users" SET "passwordHash" = $2, "updatedAt" = now() WHERE "id" = $1;

-- name: PurgeExpiredSessions :exec
DELETE FROM "refresh_tokens" WHERE "expiresAt" < now() - interval '7 days';
