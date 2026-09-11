-- name: BankStages :many
SELECT * FROM "bank_case_stages"
WHERE (@includeInactive::boolean OR "isActive")
ORDER BY "position" ASC, "code" ASC;

-- name: BankStageByID :one
SELECT * FROM "bank_case_stages" WHERE "id" = $1;

-- name: BankStageByCode :one
SELECT "id", "label" FROM "bank_case_stages" WHERE "code" = $1;

-- name: BankStageInitial :one
SELECT "id" FROM "bank_case_stages"
WHERE "isInitial" AND "isActive"
ORDER BY "position" ASC, "id" ASC
LIMIT 1;

-- name: BankStagesOpen :many
SELECT "id", "position", "isInitial", "label"
FROM "bank_case_stages"
WHERE "type" = 'OPEN'
ORDER BY "position" ASC, "id" ASC;

-- name: BankStageShift :exec
UPDATE "bank_case_stages" SET "position" = LEAST("position" + 1, 99) WHERE "id" = $1;

-- name: BankStageSetPosition :exec
UPDATE "bank_case_stages" SET "position" = $2 WHERE "id" = $1;

-- name: BankStageInsert :one
INSERT INTO "bank_case_stages"
  ("id", "code", "label", "color", "position", "type", "isActive", "isInitial", "isSystem", "updatedAt")
VALUES ($1, $2, $3, $4, $5, 'OPEN', true, false, false, now())
RETURNING *;

-- name: BankStageRename :one
UPDATE "bank_case_stages"
SET "label" = COALESCE(sqlc.narg('label'), "label"),
    "color" = COALESCE(sqlc.narg('color'), "color")
WHERE "id" = @id
RETURNING *;

-- name: BankStageSetActive :one
UPDATE "bank_case_stages" SET "isActive" = $2 WHERE "id" = $1 RETURNING *;

-- name: BankStageCaseCount :one
SELECT COUNT(*)::int FROM "bank_cases" WHERE "currentStageId" = $1 AND "deletedAt" IS NULL;

-- name: BankRejectionReasons :many
SELECT * FROM "bank_rejection_reasons"
WHERE (@includeInactive::boolean OR "isActive")
ORDER BY "sortOrder" ASC, "label" ASC;

-- name: BankCaseProspect :one
SELECT "id", "nom", "prenom", "phoneE164", "banqueId", "phase2Status",
       COALESCE("lastCallById", "createdById") AS "suiviParId"
FROM "prospects" WHERE "id" = $1 AND "deletedAt" IS NULL;

-- name: BankBanqueExists :one
SELECT "name" FROM "banques" WHERE "id" = $1;

-- name: BankCaseByReference :one
SELECT "id", "reference", "referenceKey", "customerName", "createdAt"
FROM "bank_cases" WHERE "referenceKey" = $1 AND "deletedAt" IS NULL LIMIT 1;

-- name: BankCaseInsert :exec
INSERT INTO "bank_cases"
  ("id", "reference", "referenceKey", "prospectId", "customerName", "customerPhoneE164",
   "processingBankId", "currentStageId", "createdById", "inscriptionId", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now());

-- name: BankCaseEdit :execrows
UPDATE "bank_cases"
SET "reference" = COALESCE(sqlc.narg('reference'), "reference"),
    "referenceKey" = COALESCE(sqlc.narg('referenceKey'), "referenceKey"),
    "processingBankId" = COALESCE(sqlc.narg('processingBankId'), "processingBankId"),
    "updatedById" = @updatedById,
    "rev" = "rev" + 1
WHERE "id" = @id AND "rev" = @expectedRev AND "deletedAt" IS NULL;

-- name: BankCaseAdvance :execrows
UPDATE "bank_cases"
SET "currentStageId" = $3,
    "amountXof" = $4,
    "rejectionReasonId" = $5,
    "rejectionDetail" = $6,
    "updatedById" = $7,
    "rev" = "rev" + 1
WHERE "id" = $1 AND "rev" = $2 AND "deletedAt" IS NULL;

-- name: BankTransitionInsert :exec
INSERT INTO "bank_case_transitions"
  ("id", "caseId", "fromStageId", "toStageId", "performedById", "amountXof",
   "rejectionReasonId", "rejectionDetail", "comment", "correctionReason", "clientAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);

-- name: BankCaseHistory :many
SELECT t."id", t."caseId", t."fromStageId", t."toStageId", t."performedById",
       u."fullName" AS "performedByName", t."amountXof", t."rejectionReasonId",
       t."rejectionDetail", t."comment", t."correctionReason", t."createdAt"
FROM "bank_case_transitions" t
INNER JOIN "users" u ON u."id" = t."performedById"
WHERE t."caseId" = $1
ORDER BY t."createdAt" ASC, t."id" ASC;

-- name: BankProspectSearch :many
SELECT p."id", p."nom", p."prenom", p."phoneE164",
       b."id" AS "banqueId", b."name" AS "banqueName",
       COUNT(*) OVER ()::int AS "total"
FROM "prospects" p
INNER JOIN "banques" b ON b."id" = p."banqueId"
WHERE p."deletedAt" IS NULL
  AND p."phase2Status" = 'METHOD_OBTAINED'
  AND (sqlc.narg('projet')::"Projet" IS NULL OR EXISTS (
        SELECT 1 FROM "prospect_journeys" pj
        WHERE pj."prospectId" = p."id" AND pj."projet" = sqlc.narg('projet')::"Projet"))
  AND (
    immutable_unaccent(lower(p."nom") || ' ' || lower(p."prenom")) LIKE ANY (@formes::text[])
    OR (sqlc.narg('phone')::text IS NOT NULL AND p."phoneE164" = sqlc.narg('phone')::text)
    OR (sqlc.narg('phoneLike')::text IS NOT NULL AND p."phoneE164" LIKE sqlc.narg('phoneLike')::text)
  )
ORDER BY p."nom" ASC, p."prenom" ASC, p."id" ASC
LIMIT @lignes OFFSET @saut;

-- name: ClientRequestBanqueExists :one
SELECT "name" FROM "banques" WHERE "id" = $1;

-- name: ClientRequestRepresentantExists :one
SELECT "id" FROM "representants" WHERE "id" = $1 AND "deletedAt" IS NULL;

-- name: ClientRequestSyndicatExists :one
SELECT "id" FROM "syndicats" WHERE "id" = $1;

-- name: ClientRequestProspectByPhone :one
SELECT "id" FROM "prospects" WHERE "phoneE164" = $1 AND "deletedAt" IS NULL LIMIT 1;

-- name: ClientRequestPendingByPhone :one
SELECT "id" FROM "client_creation_requests"
WHERE "phoneE164" = $1 AND "status" = 'PENDING' LIMIT 1;

-- name: ClientRequestInsert :exec
INSERT INTO "client_creation_requests"
  ("id", "nom", "prenom", "phoneE164", "note", "banqueId", "requestedById", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, now());

-- name: ClientRequestList :many
SELECT r.*, b."name" AS "banqueName", ru."fullName" AS "requestedByName",
       vu."fullName" AS "reviewedByName", COUNT(*) OVER ()::int AS "total"
FROM "client_creation_requests" r
INNER JOIN "banques" b ON b."id" = r."banqueId"
INNER JOIN "users" ru ON ru."id" = r."requestedById"
LEFT JOIN "users" vu ON vu."id" = r."reviewedById"
WHERE (sqlc.narg('id')::text IS NULL OR r."id" = sqlc.narg('id')::text)
  AND (sqlc.narg('requestedById')::text IS NULL OR r."requestedById" = sqlc.narg('requestedById')::text)
  AND (sqlc.narg('status')::"ClientRequestStatus" IS NULL OR r."status" = sqlc.narg('status')::"ClientRequestStatus")
  AND (sqlc.narg('banqueId')::text IS NULL OR r."banqueId" = sqlc.narg('banqueId')::text)
  AND (sqlc.narg('search')::text IS NULL
       OR r."nom" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR r."prenom" ILIKE '%' || sqlc.narg('search')::text || '%'
       OR (sqlc.narg('digits')::text IS NOT NULL AND r."phoneE164" LIKE '%' || sqlc.narg('digits')::text || '%'))
ORDER BY r."createdAt" DESC, r."id" DESC
LIMIT @lignes OFFSET @saut;

-- name: ClientRequestPendingCount :one
SELECT COUNT(*)::int FROM "client_creation_requests"
WHERE "status" = 'PENDING'
  AND (sqlc.narg('requestedById')::text IS NULL OR "requestedById" = sqlc.narg('requestedById')::text);

-- name: ClientRequestProspectInsert :exec
INSERT INTO "prospects"
  ("id", "nom", "prenom", "phoneE164", "banqueId", "syndicatId", "representantId",
   "createdById", "origin", "originLabel", "clientCreatedAt", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'BANQUE', $9, $10, now());

-- name: ClientRequestApprove :execrows
UPDATE "client_creation_requests"
SET "status" = 'APPROVED', "reviewedById" = $2, "reviewedAt" = $3, "createdProspectId" = $4
WHERE "id" = $1 AND "status" = 'PENDING';

-- name: ClientRequestReject :execrows
UPDATE "client_creation_requests"
SET "status" = 'REJECTED', "reviewedById" = $2, "reviewedAt" = $3, "rejectionNote" = $4
WHERE "id" = $1 AND "status" = 'PENDING';

-- name: BankReferenceSuivante :one
INSERT INTO "references_bancaires" ("projet", "annee", "dernier") VALUES ($1, sqlc.arg('annee')::bigint, 1)
ON CONFLICT ("projet", "annee") DO UPDATE SET "dernier" = "references_bancaires"."dernier" + 1
RETURNING "dernier";

-- name: BankInscriptionPourDossier :one
SELECT i."id", i."projet", i."identifiantDistant", i."nom", i."prenom", i."phoneE164", i."email",
       i."statutDistant", i."decideeLe", i."prospectId"
FROM "inscriptions_plateforme" i
WHERE i."id" = $1;

-- name: BankCaseParInscription :one
SELECT "id" FROM "bank_cases" WHERE "inscriptionId" = $1 AND "deletedAt" IS NULL LIMIT 1;

-- name: BankInscriptionsCompletes :many
SELECT i."id", i."projet", i."identifiantDistant", i."nom", i."prenom", i."phoneE164", i."email",
       i."statutDistant", i."soumiseLe", i."decideeLe", i."prospectId", p."banqueId", b."name" AS "banqueName",
       su."fullName" AS "suiviParName", i."completeSignaleeLe"
FROM "inscriptions_plateforme" i
LEFT JOIN "prospects" p ON p."id" = i."prospectId" AND p."deletedAt" IS NULL
LEFT JOIN "banques" b ON b."id" = p."banqueId"
LEFT JOIN "users" su ON su."id" = COALESCE(p."lastCallById", p."createdById")
WHERE i."projet" = sqlc.arg('projet')::"Projet" AND i."disparueLe" IS NULL
  AND ((cardinality(sqlc.arg('statuts')::text[]) = 0 AND i."decideeLe" IS NOT NULL)
       OR i."statutDistant" = ANY(sqlc.arg('statuts')::text[]))
  AND (NOT sqlc.arg('a_signaler')::boolean OR i."completeSignaleeLe" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "bank_cases" c WHERE c."inscriptionId" = i."id" AND c."deletedAt" IS NULL)
ORDER BY i."decideeLe" DESC NULLS LAST, i."soumiseLe" DESC NULLS LAST, i."id" DESC;

-- name: BankInscriptionSignalee :exec
UPDATE "inscriptions_plateforme" SET "completeSignaleeLe" = $2 WHERE "id" = $1;

-- name: BankCaseSuivi :one
SELECT c."id", c."reference", c."customerName", c."customerPhoneE164", c."amountXof", c."rejectionDetail",
       b."name" AS "banqueName", s."label" AS "stageLabel", s."type" AS "stageType", c."createdAt",
       COALESCE(p."lastCallById", p."createdById") AS "suiviParId", su."fullName" AS "suiviParName",
       COALESCE((SELECT pj."projet"::text FROM "prospect_journeys" pj WHERE pj."prospectId" = c."prospectId" ORDER BY pj."createdAt" LIMIT 1), 'CHUES')::text AS "projet",
       r."label" AS "rejectionLabel"
FROM "bank_cases" c
INNER JOIN "banques" b ON b."id" = c."processingBankId"
INNER JOIN "bank_case_stages" s ON s."id" = c."currentStageId"
INNER JOIN "prospects" p ON p."id" = c."prospectId"
LEFT JOIN "users" su ON su."id" = COALESCE(p."lastCallById", p."createdById")
LEFT JOIN "bank_rejection_reasons" r ON r."id" = c."rejectionReasonId"
WHERE c."id" = $1;

-- name: BankInscriptionPourPieces :one
SELECT i."projet", i."identifiantDistant", i."chargeUtile"
FROM "inscriptions_plateforme" i
WHERE i."id" = $1;
