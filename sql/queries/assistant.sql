-- La période est bornée à 366 jours et chaque liste porte sa limite : un
-- tableau rendu au modèle puis à l'écran ne peut pas grandir sans borne.

-- name: AssistantQuestions :many
SELECT q."id", q."libelle", q."question", q."partagee", q."createdAt",
       q."userId" = @user_id::text AS "miennes", u."fullName" AS "auteur"
FROM "assistant_questions" q
JOIN "users" u ON u."id" = q."userId"
WHERE q."userId" = @user_id::text OR q."partagee"
ORDER BY q."createdAt" DESC
LIMIT 100;

-- name: InsertAssistantQuestion :exec
INSERT INTO "assistant_questions" ("id", "userId", "libelle", "question", "partagee")
VALUES (@id, @user_id, @libelle, @question, @partagee);

-- name: DeleteAssistantQuestion :execrows
DELETE FROM "assistant_questions" WHERE "id" = @id AND "userId" = @user_id;

-- name: AssistantAppels :many
-- Un téléconseiller ne compte que ses appels : `teleconseiller` NULL les compte tous.
SELECT
  to_char(ca."clientCreatedAt", 'YYYY-MM-DD') AS jour,
  COUNT(*)::int AS appels,
  COUNT(*) FILTER (WHERE r."countsAsReached")::int AS joints,
  COUNT(DISTINCT ca."prospectId")::int AS fiches
FROM "call_attempts" ca
JOIN "call_outcome_reasons" r ON r."id" = ca."reasonId"
JOIN "prospects" p ON p."id" = ca."prospectId" AND p."deletedAt" IS NULL
WHERE ca."clientCreatedAt" >= @du::timestamp AND ca."clientCreatedAt" < @au::timestamp
  AND (sqlc.narg('teleconseiller')::text IS NULL OR ca."performedById" = sqlc.narg('teleconseiller'))
  AND (sqlc.narg('projet')::text IS NULL OR p."projet"::text = sqlc.narg('projet'))
GROUP BY jour
ORDER BY jour
LIMIT 400;

-- name: AssistantConversionsParCanal :many
SELECT
  COALESCE(c."label", 'Non renseignée') AS canal,
  COUNT(*)::int AS prospects,
  COUNT(*) FILTER (WHERE lr."countsAsReached")::int AS joints,
  COUNT(*) FILTER (WHERE p."statut" IN ('CONVERTI', 'VENDU'))::int AS convertis,
  COUNT(*) FILTER (WHERE p."statut" = 'PERDU')::int AS perdus
FROM "prospects" p
LEFT JOIN "canaux_provenance" c ON c."id" = p."canalProvenanceId"
LEFT JOIN "call_outcome_reasons" lr ON lr."id" = p."lastReasonId"
WHERE p."deletedAt" IS NULL
  AND p."createdAt" >= @du::timestamp AND p."createdAt" < @au::timestamp
  AND (sqlc.narg('teleconseiller')::text IS NULL OR p."createdById" = sqlc.narg('teleconseiller'))
  AND (sqlc.narg('projet')::text IS NULL OR p."projet"::text = sqlc.narg('projet'))
GROUP BY canal
ORDER BY prospects DESC
LIMIT 50;

-- name: AssistantPrevision :many
-- Par canal et projet : les fiches tranchées depuis `depuis` donnent le taux,
-- les fiches encore ouvertes reçoivent ce taux.
SELECT
  COALESCE(c."label", 'Non renseignée') AS canal,
  p."projet"::text AS projet,
  COUNT(*) FILTER (WHERE p."statut" IN ('CONVERTI', 'VENDU') AND p."createdAt" >= @depuis::timestamp)::int AS convertis,
  COUNT(*) FILTER (WHERE p."statut" = 'PERDU' AND p."createdAt" >= @depuis::timestamp)::int AS perdus,
  COUNT(*) FILTER (WHERE p."statut" IN ('NOUVEAU', 'CONTACTE'))::int AS ouverts
FROM "prospects" p
LEFT JOIN "canaux_provenance" c ON c."id" = p."canalProvenanceId"
WHERE p."deletedAt" IS NULL
  AND (sqlc.narg('teleconseiller')::text IS NULL OR p."createdById" = sqlc.narg('teleconseiller'))
  AND (sqlc.narg('projet')::text IS NULL OR p."projet"::text = sqlc.narg('projet'))
GROUP BY canal, p."projet"
ORDER BY ouverts DESC
LIMIT 50;
