-- name: ListStatutsQualification :many
SELECT * FROM "statuts_qualification"
WHERE (NOT @actifs_seulement::bool OR "isActive")
ORDER BY "sortOrder", "label";

-- name: StatutQualificationParID :one
SELECT * FROM "statuts_qualification" WHERE "id" = $1;

-- name: StatutQualificationParCode :one
SELECT "id", "code", "label" FROM "statuts_qualification" WHERE "code" = $1;

-- name: StatutQualificationParLabel :one
SELECT "id", "code", "label" FROM "statuts_qualification" WHERE "label" = $1;

-- name: RangSuivantStatutQualification :one
SELECT (coalesce(max("sortOrder"), 0) + 10)::int AS rang
FROM "statuts_qualification"
WHERE "effect"::text = ANY(@branche::text[]);

-- name: CompterStatutsQualificationActifs :one
SELECT count(*)::int AS restants
FROM "statuts_qualification"
WHERE "isActive"
  AND "parentId" IS NULL
  AND "id" <> sqlc.arg('id')
  AND "effect"::text = ANY(@branche::text[]);

-- name: InsertStatutQualification :one
INSERT INTO "statuts_qualification" (
  "id", "code", "label", "effect", "requiresCallback", "requiresComment",
  "retryAfterMinutes", "priorite", "relationStatus", "sortOrder",
  "isActive", "isSystem", "minPayloadVersion", "parentId"
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, false, $11, $12)
RETURNING *;

-- name: UpdateStatutQualification :one
UPDATE "statuts_qualification" SET
  "label" = coalesce(sqlc.narg('label')::text, "label"),
  "requiresCallback" = coalesce(sqlc.narg('requires_callback')::bool, "requiresCallback"),
  "requiresComment" = coalesce(sqlc.narg('requires_comment')::bool, "requiresComment"),
  "priorite" = coalesce(sqlc.narg('priorite')::"PrioriteTraitement", "priorite"),
  "retryAfterMinutes" = sqlc.narg('retry_after_minutes')::int,
  "relationStatus" = sqlc.narg('relation_status')::"RepresentantRelation"
WHERE "id" = sqlc.arg('id')
RETURNING *;

-- name: SetStatutQualificationActive :one
UPDATE "statuts_qualification" SET "isActive" = $2 WHERE "id" = $1 RETURNING *;

-- name: ListCallOutcomeReasons :many
SELECT * FROM "call_outcome_reasons"
WHERE (NOT @actifs_seulement::bool OR "isActive")
ORDER BY "sortOrder", "label";

-- name: CallOutcomeReasonParID :one
SELECT * FROM "call_outcome_reasons" WHERE "id" = $1;

-- name: CallOutcomeReasonParCode :one
SELECT "id", "code", "label" FROM "call_outcome_reasons" WHERE "code" = $1;

-- name: CallOutcomeReasonParLabel :one
SELECT "id", "code", "label" FROM "call_outcome_reasons" WHERE "label" = $1;

-- name: InsertCallOutcomeReason :one
INSERT INTO "call_outcome_reasons" (
  "id", "code", "label", "effect", "requiresComment", "requiresCallback",
  "countsAsReached", "color", "sortOrder", "isActive", "isSystem", "minPayloadVersion", "parentId"
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, false, $10, $11)
RETURNING *;

-- name: UpdateCallOutcomeReason :one
UPDATE "call_outcome_reasons" SET
  "label" = coalesce(sqlc.narg('label')::text, "label"),
  "color" = coalesce(sqlc.narg('color')::text, "color"),
  "sortOrder" = coalesce(sqlc.narg('sort_order')::int, "sortOrder"),
  "requiresComment" = coalesce(sqlc.narg('requires_comment')::bool, "requiresComment"),
  "requiresCallback" = coalesce(sqlc.narg('requires_callback')::bool, "requiresCallback"),
  "countsAsReached" = coalesce(sqlc.narg('counts_as_reached')::bool, "countsAsReached")
WHERE "id" = sqlc.arg('id')
RETURNING *;

-- name: SetCallOutcomeReasonActive :one
UPDATE "call_outcome_reasons" SET "isActive" = $2 WHERE "id" = $1 RETURNING *;

-- name: OffreParID :one
SELECT "label" FROM "offers" WHERE "id" = $1;
