-- name: ListerReferentielsVisite :many
SELECT * FROM (
  SELECT 'entreprises'::text AS kind, "id", "code", "label", "isActive", "isSystem", "sortOrder", "updatedAt" FROM "visite_entreprises"
  UNION ALL
  SELECT 'directions'::text, "id", "code", "label", "isActive", "isSystem", "sortOrder", "updatedAt" FROM "visite_directions"
  UNION ALL
  SELECT 'destinataires'::text, "id", "code", "label", "isActive", "isSystem", "sortOrder", "updatedAt" FROM "visite_destinataires"
  UNION ALL
  SELECT 'objets'::text, "id", "code", "label", "isActive", "isSystem", "sortOrder", "updatedAt" FROM "visite_objets"
) r
WHERE NOT @active_only::boolean OR r."isActive"
ORDER BY r."sortOrder", r."label";

-- name: UsageReferentielsVisite :many
SELECT 'entreprises'::text AS kind, "entrepriseId" AS "id", count(*)::int AS "total"
FROM "visites" GROUP BY "entrepriseId"
UNION ALL
SELECT 'objets'::text, "objetId", count(*)::int FROM "visites" GROUP BY "objetId"
UNION ALL
SELECT 'directions'::text, "directionId", count(*)::int
FROM "visites" WHERE "directionId" IS NOT NULL GROUP BY "directionId"
UNION ALL
SELECT 'destinataires'::text, "destinataireId", count(*)::int
FROM "visites" WHERE "destinataireId" IS NOT NULL GROUP BY "destinataireId";

-- name: ReferentielsVisiteChoisis :many
SELECT 'entreprise'::text AS kind, "id", "isActive" FROM "visite_entreprises" WHERE "id" = sqlc.narg(entreprise_id)::text
UNION ALL
SELECT 'objet'::text, "id", "isActive" FROM "visite_objets" WHERE "id" = sqlc.narg(objet_id)::text
UNION ALL
SELECT 'direction'::text, "id", "isActive" FROM "visite_directions" WHERE "id" = sqlc.narg(direction_id)::text
UNION ALL
SELECT 'destinataire'::text, "id", "isActive" FROM "visite_destinataires" WHERE "id" = sqlc.narg(destinataire_id)::text;

-- name: VisiteParId :one
SELECT v."id", v."reference", v."visitedAt", v."timeKnown", v."visitorName", v."phone", v."phoneE164",
       v."comment", v."createdById", v."createdAt",
       e."id" AS "entrepriseId", e."code" AS "entrepriseCode", e."label" AS "entrepriseLabel",
       o."id" AS "objetId", o."code" AS "objetCode", o."label" AS "objetLabel",
       d."id" AS "directionId", d."code" AS "directionCode", d."label" AS "directionLabel",
       s."id" AS "destinataireId", s."code" AS "destinataireCode", s."label" AS "destinataireLabel"
FROM "visites" v
JOIN "visite_entreprises" e ON e."id" = v."entrepriseId"
JOIN "visite_objets" o ON o."id" = v."objetId"
LEFT JOIN "visite_directions" d ON d."id" = v."directionId"
LEFT JOIN "visite_destinataires" s ON s."id" = v."destinataireId"
WHERE v."id" = $1;

-- Le rang du registre court par ANNÉE et le tri lexicographique le suit tant
-- qu'il tient sur six chiffres.
-- name: DerniereReferenceVisite :one
SELECT "reference" FROM "visites"
WHERE "reference" LIKE @prefixe::text || '%'
ORDER BY "reference" DESC
LIMIT 1;

-- name: InsererVisite :exec
INSERT INTO "visites" ("id", "reference", "visitedAt", "timeKnown", "visitorName", "phone", "phoneE164",
                       "entrepriseId", "objetId", "directionId", "destinataireId", "comment", "createdById", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now());

-- name: MettreAJourVisite :exec
UPDATE "visites"
SET "visitedAt" = $2, "timeKnown" = $3, "visitorName" = $4, "phone" = $5, "phoneE164" = $6,
    "entrepriseId" = $7, "objetId" = $8, "directionId" = $9, "destinataireId" = $10, "comment" = $11
WHERE "id" = $1;

-- name: VisitesPourStatistiques :many
SELECT "visitedAt", "entrepriseId", "objetId", "directionId", "destinataireId",
       "timeKnown", "createdAt", "createdById", "visitorName", "phoneE164"
FROM "visites"
WHERE "visitedAt" >= $1 AND "visitedAt" <= $2;

-- name: NomsAgentsDuRegistre :many
SELECT "id", "fullName" FROM "users" WHERE "id" = ANY(@ids::text[]);

-- name: InsererImportRegistre :exec
INSERT INTO "import_jobs" ("id", "kind", "status", "mode", "requestedById", "fileName", "fileBytes",
                           "storagePath", "expiresAt", "updatedAt")
VALUES ($1, 'VISITES_REGISTRE', 'queued', 'DRY_RUN', $2, $3, $4, $5, $6, now());

-- 404 et jamais 403 : un import d'une autre nature ne doit pas se laisser deviner.
-- name: ImportRegistre :one
SELECT * FROM "import_jobs" WHERE "id" = $1 AND "kind" = 'VISITES_REGISTRE';

-- name: DemarrerImportRegistre :exec
UPDATE "import_jobs" SET "status" = 'running', "startedAt" = now() WHERE "id" = $1;

-- name: TerminerImportRegistre :exec
UPDATE "import_jobs"
SET "status" = 'succeeded', "finishedAt" = now(), "totalRows" = $2, "processedRows" = $3,
    "createdRows" = $4, "updatedRows" = $5, "skippedRows" = $6, "errorRows" = $7, "report" = $8
WHERE "id" = $1;

-- name: EchouerImportRegistre :exec
UPDATE "import_jobs"
SET "status" = 'failed', "finishedAt" = now(), "failureCode" = $2, "failureMsg" = $3
WHERE "id" = $1;

-- Transition CONDITIONNELLE : deux clics simultanés sur « Appliquer » ne
-- produisent qu'une application, c'est PostgreSQL qui arbitre.
-- name: BasculerImportRegistreEnApplication :execrows
UPDATE "import_jobs"
SET "mode" = 'APPLY', "status" = 'running', "startedAt" = now(), "finishedAt" = NULL,
    "processedRows" = 0, "createdRows" = 0, "updatedRows" = 0, "skippedRows" = 0, "errorRows" = 0,
    "report" = NULL, "failureCode" = NULL, "failureMsg" = NULL
WHERE "id" = $1 AND "kind" = 'VISITES_REGISTRE' AND "status" = 'succeeded'
  AND "mode" = 'DRY_RUN' AND "expiresAt" > now();

-- name: UpsertVisiteImportChange :exec
INSERT INTO "visite_import_changes" ("id", "importJobId", "sheet", "rowNumber", "kind", "reference",
                                     "visiteId", "label", "fields", "rowHash", "selected")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
ON CONFLICT ("importJobId", "sheet", "rowNumber") DO UPDATE
SET "kind" = EXCLUDED."kind", "reference" = EXCLUDED."reference", "visiteId" = EXCLUDED."visiteId",
    "label" = EXCLUDED."label", "fields" = EXCLUDED."fields", "rowHash" = EXCLUDED."rowHash";

-- name: CompterVisiteImportChanges :one
SELECT count(*)::int FROM "visite_import_changes" WHERE "importJobId" = $1;

-- name: ListerVisiteImportChanges :many
SELECT * FROM "visite_import_changes"
WHERE "importJobId" = $1
ORDER BY "sheet", "rowNumber"
LIMIT $2 OFFSET $3;

-- name: VisiteImportChangesDuJob :many
SELECT * FROM "visite_import_changes" WHERE "importJobId" = $1;

-- name: SelectionnerVisiteImportChanges :exec
UPDATE "visite_import_changes" SET "selected" = @selected::boolean
WHERE "importJobId" = $1 AND "id" = ANY(@ids::text[]);

-- name: VisitesParReferences :many
SELECT v."id", v."reference", v."visitedAt", v."timeKnown", v."visitorName", v."phone",
       e."label" AS "entrepriseLabel", o."label" AS "objetLabel",
       d."label" AS "directionLabel", s."label" AS "destinataireLabel", v."comment"
FROM "visites" v
JOIN "visite_entreprises" e ON e."id" = v."entrepriseId"
JOIN "visite_objets" o ON o."id" = v."objetId"
LEFT JOIN "visite_directions" d ON d."id" = v."directionId"
LEFT JOIN "visite_destinataires" s ON s."id" = v."destinataireId"
WHERE v."reference" = ANY(@refs::text[]);
