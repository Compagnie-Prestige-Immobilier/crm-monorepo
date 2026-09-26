-- name: ProspectIdParTelephoneExact :one
SELECT "id" FROM "prospects"
WHERE "phoneE164" = $1 AND "deletedAt" IS NULL LIMIT 1;

-- name: InsererSuggestionProspect :exec
INSERT INTO "prospect_suggestions" (
  "id", "sourceProspectId", "suggestedName", "suggestedPhoneE164", "note",
  "suggestedById", "resolvedProspectId", "sourceAttemptId", "clientCreatedAt")
VALUES (@id, @source_prospect_id, @suggested_name, @suggested_phone_e164, @note,
        @suggested_by_id, @resolved_prospect_id, @source_attempt_id, @client_created_at);

-- name: TirerSuggestionsProspect :many
SELECT d."id", d."suggestedName", d."suggestedPhoneE164"
FROM (
  SELECT DISTINCT ON (s."suggestedPhoneE164") s."id", s."suggestedName", s."suggestedPhoneE164", s."createdAt"
  FROM "prospect_suggestions" s
  INNER JOIN "prospects" src ON src."id" = s."sourceProspectId"
  WHERE s."deletedAt" IS NULL AND s."status" = 'A_APPELER' AND s."resolvedProspectId" IS NULL
    AND src."deletedAt" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "prospects" p WHERE p."phoneE164" = s."suggestedPhoneE164" AND p."deletedAt" IS NULL)
  ORDER BY s."suggestedPhoneE164", s."createdAt", s."id"
) d
ORDER BY d."createdAt", d."id"
LIMIT sqlc.arg('places');

-- name: CompterSuggestionsProspect :one
SELECT COUNT(DISTINCT s."suggestedPhoneE164")::int
FROM "prospect_suggestions" s
INNER JOIN "prospects" src ON src."id" = s."sourceProspectId"
WHERE s."deletedAt" IS NULL AND s."status" = 'A_APPELER' AND s."resolvedProspectId" IS NULL
  AND src."deletedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "prospects" p WHERE p."phoneE164" = s."suggestedPhoneE164" AND p."deletedAt" IS NULL);

-- name: TelephonesProspectsConnus :many
SELECT "phoneE164" FROM "prospects"
WHERE "phoneE164" = ANY($1::text[]) AND "deletedAt" IS NULL;

-- name: ResoudreSuggestionProspect :exec
UPDATE "prospect_suggestions" SET "resolvedProspectId" = $2 WHERE "id" = $1;

-- name: ParrainDuProspect :one
SELECT src."id", src."nom", src."prenom"
FROM "prospect_suggestions" s
JOIN "prospects" src ON src."id" = s."sourceProspectId"
WHERE s."resolvedProspectId" = $1 AND s."sourceProspectId" <> $1
  AND s."deletedAt" IS NULL AND src."deletedAt" IS NULL
ORDER BY s."createdAt" ASC, s."id" ASC
LIMIT 1;

-- name: ProspectsRecommandesPar :many
SELECT filleul."id", filleul."nom", filleul."prenom", filleul."statut"
FROM "prospect_suggestions" s
JOIN "prospects" filleul ON filleul."id" = s."resolvedProspectId"
WHERE s."sourceProspectId" = $1 AND s."deletedAt" IS NULL AND filleul."deletedAt" IS NULL
ORDER BY s."createdAt" DESC
LIMIT 20;

-- Un filleul vendu compte aussi converti : l'entonnoir ne remonte jamais.
-- name: SuiviParrainage :one
SELECT count(DISTINCT s."suggestedPhoneE164")::int AS "recommandes",
       count(DISTINCT f."id")::int AS "fiches",
       count(DISTINCT f."id") FILTER (WHERE f."statut" IN ('CONVERTI', 'VENDU')
           OR f."phoneE164" = ANY(@telephones_vendus::text[]))::int AS "convertis",
       count(DISTINCT f."id") FILTER (WHERE f."statut" = 'VENDU'
           OR f."phoneE164" = ANY(@telephones_vendus::text[]))::int AS "vendus"
FROM "prospect_suggestions" s
LEFT JOIN "prospects" f ON f."id" = s."resolvedProspectId" AND f."deletedAt" IS NULL
WHERE s."sourceProspectId" = @parrain AND s."deletedAt" IS NULL;

-- name: ClassementParrains :many
SELECT p."id", p."nom", p."prenom",
       count(DISTINCT s."suggestedPhoneE164")::int AS "recommandes",
       count(DISTINCT f."id")::int AS "fiches",
       count(DISTINCT f."id") FILTER (WHERE f."statut" IN ('CONVERTI', 'VENDU')
           OR f."phoneE164" = ANY(@telephones_vendus::text[]))::int AS "convertis",
       count(DISTINCT f."id") FILTER (WHERE f."statut" = 'VENDU'
           OR f."phoneE164" = ANY(@telephones_vendus::text[]))::int AS "vendus"
FROM "prospect_suggestions" s
JOIN "prospects" p ON p."id" = s."sourceProspectId" AND p."deletedAt" IS NULL
LEFT JOIN "prospects" f ON f."id" = s."resolvedProspectId" AND f."deletedAt" IS NULL
WHERE s."deletedAt" IS NULL
  AND (sqlc.narg('du')::timestamp IS NULL OR s."createdAt" >= sqlc.narg('du')::timestamp)
  AND (sqlc.narg('au')::timestamp IS NULL OR s."createdAt" < sqlc.narg('au')::timestamp)
GROUP BY p."id", p."nom", p."prenom"
ORDER BY "vendus" DESC, "convertis" DESC, "fiches" DESC, "recommandes" DESC, p."id"
LIMIT 20;
