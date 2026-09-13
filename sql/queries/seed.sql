-- name: SeedUpsertRegion :one
INSERT INTO "regions" ("id", "code", "name", "updatedAt")
VALUES ($1, $2, $3, now())
ON CONFLICT ("code") DO UPDATE SET "name" = $3, "updatedAt" = now()
RETURNING "id";

-- name: SeedCountDepartements :one
SELECT count(*) FROM "departements";

-- name: SeedUpsertDepartement :one
INSERT INTO "departements" ("id", "code", "name", "regionId", "updatedAt")
VALUES ($1, $2, $3, $4, now())
ON CONFLICT ("code") DO UPDATE SET "name" = $3, "regionId" = $4, "updatedAt" = now()
RETURNING "id";

-- name: SeedCountIefs :one
SELECT count(*) FROM "iefs";

-- name: SeedUpsertIef :exec
INSERT INTO "iefs" ("id", "code", "name", "departementId", "updatedAt")
VALUES ($1, $2, $3, $4, now())
ON CONFLICT ("code") DO UPDATE SET "name" = $3, "departementId" = $4, "updatedAt" = now();

-- name: SeedUpsertBanque :exec
INSERT INTO "banques" ("id", "name", "shortName", "sortOrder", "updatedAt")
VALUES ($1, $2, $3, $4, now())
ON CONFLICT ("name") DO UPDATE SET "shortName" = $3, "sortOrder" = $4, "updatedAt" = now();

-- name: SeedUpsertSyndicat :exec
INSERT INTO "syndicats" ("id", "name", "sigle", "secteur", "sortOrder", "updatedAt")
VALUES ($1, $2, $3, $4, $5, now())
ON CONFLICT ("sigle") DO UPDATE SET "name" = $2, "secteur" = $4, "sortOrder" = $5, "updatedAt" = now();

-- name: SeedUpsertCanalProvenance :exec
INSERT INTO "canaux_provenance" ("id", "code", "label", "position", "updatedAt")
VALUES ($1, $2, $3, $4, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "position" = $4, "updatedAt" = now();

-- name: SeedUpsertProfession :exec
INSERT INTO "professions" ("id", "code", "label", "isTeaching", "position", "updatedAt")
VALUES ($1, $2, $3, $4, $5, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "isTeaching" = $4, "position" = $5, "updatedAt" = now();

-- name: SeedUpsertIncomeBand :exec
INSERT INTO "income_bands" ("id", "code", "label", "minXof", "maxXof", "position", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "minXof" = $4, "maxXof" = $5, "position" = $6, "updatedAt" = now();

-- name: SeedUpsertOffer :exec
INSERT INTO "offers" ("id", "code", "label", "description", "position", "updatedAt")
VALUES ($1, $2, $3, $4, $5, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "description" = $4, "position" = $5, "updatedAt" = now();

-- name: SeedUpsertEmployeur :exec
INSERT INTO "employeurs" ("id", "code", "label", "type", "position", "updatedAt")
VALUES ($1, $2, $3, $4, $5, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "type" = $4, "position" = $5, "updatedAt" = now();

-- name: SeedUpsertPays :exec
INSERT INTO "pays" ("id", "code", "label", "indicatif", "position", "updatedAt")
VALUES ($1, $2, $3, $4, $5, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "indicatif" = $4, "position" = $5, "updatedAt" = now();

-- name: SeedUpsertBankCaseStage :exec
INSERT INTO "bank_case_stages" ("id", "code", "label", "position", "color", "type", "isInitial", "isSystem", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "position" = $4, "color" = $5, "type" = $6, "isInitial" = $7, "isSystem" = $8, "updatedAt" = now();

-- name: SeedUpsertBankRejectionReason :exec
INSERT INTO "bank_rejection_reasons" ("id", "code", "label", "sortOrder", "updatedAt")
VALUES ($1, $2, $3, $4, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "sortOrder" = $4, "updatedAt" = now();

-- name: SeedUpsertCallOutcomeReason :exec
INSERT INTO "call_outcome_reasons" ("id", "code", "label", "effect", "requiresComment", "requiresCallback", "countsAsReached", "color", "sortOrder", "isSystem", "minPayloadVersion", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "effect" = $4, "requiresComment" = $5, "requiresCallback" = $6, "countsAsReached" = $7, "color" = $8, "sortOrder" = $9, "isSystem" = $10, "minPayloadVersion" = $11, "updatedAt" = now();

-- name: SeedUpsertStatutQualification :exec
INSERT INTO "statuts_qualification" ("id", "code", "label", "effect", "requiresCallback", "requiresComment", "retryAfterMinutes", "priorite", "relationStatus", "sortOrder", "isSystem", "minPayloadVersion", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "effect" = $4, "requiresCallback" = $5, "requiresComment" = $6, "retryAfterMinutes" = $7, "priorite" = $8, "relationStatus" = $9, "sortOrder" = $10, "isSystem" = $11, "minPayloadVersion" = $12, "updatedAt" = now();

-- name: SeedUpsertVisiteEntreprise :exec
INSERT INTO "visite_entreprises" ("id", "code", "label", "sortOrder", "isSystem", "updatedAt")
VALUES ($1, $2, $3, $4, true, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "sortOrder" = $4, "isSystem" = true, "updatedAt" = now();

-- name: SeedUpsertVisiteDirection :exec
INSERT INTO "visite_directions" ("id", "code", "label", "sortOrder", "isSystem", "updatedAt")
VALUES ($1, $2, $3, $4, true, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "sortOrder" = $4, "isSystem" = true, "updatedAt" = now();

-- name: SeedUpsertVisiteDestinataire :exec
INSERT INTO "visite_destinataires" ("id", "code", "label", "sortOrder", "isSystem", "updatedAt")
VALUES ($1, $2, $3, $4, true, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "sortOrder" = $4, "isSystem" = true, "updatedAt" = now();

-- name: SeedUpsertVisiteObjet :exec
INSERT INTO "visite_objets" ("id", "code", "label", "sortOrder", "isSystem", "updatedAt")
VALUES ($1, $2, $3, $4, true, now())
ON CONFLICT ("code") DO UPDATE SET "label" = $3, "sortOrder" = $4, "isSystem" = true, "updatedAt" = now();

-- name: SeedInsertAdmin :execrows
INSERT INTO "users" ("id", "email", "username", "fullName", "passwordHash", "role", "isActive", "updatedAt")
VALUES ($1, $2, $3, $4, $5, 'ADMIN', true, now())
ON CONFLICT ("email") DO NOTHING;

-- name: SeedInsertFixtureUser :execrows
INSERT INTO "users" ("id", "email", "username", "fullName", "passwordHash", "role", "isActive", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, true, now())
ON CONFLICT ("email") DO NOTHING;

-- name: SeedDisableFixtureUsers :execrows
UPDATE "users" SET "isActive" = false, "updatedAt" = now()
WHERE "email" = ANY($1::text[]) AND "isActive";

-- Une base qui a le droit de porter des comptes de démonstration doit les avoir
-- utilisables : le semis ne les crée que s'ils sont absents, donc un compte
-- fermé une fois le restait pour toujours.
-- name: SeedEnableFixtureUsers :execrows
UPDATE "users" SET "isActive" = true, "updatedAt" = now()
WHERE "email" = ANY($1::text[]) AND NOT "isActive" AND "deletedAt" IS NULL;
