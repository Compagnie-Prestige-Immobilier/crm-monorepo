-- name: CourrielInsert :exec
INSERT INTO "courriels"
  ("id", "type", "sujet", "destinataires", "copies", "objetType", "objetId", "html", "texte",
   "nomPieceJointe", "pieceJointe", "statut", "messageId", "erreur", "envoyeLe")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);

-- name: CourrielByID :one
SELECT * FROM "courriels" WHERE "id" = $1;

-- name: CourrielsParObjet :many
SELECT "id", "type", "sujet", "destinataires", "copies", "objetType", "objetId", "nomPieceJointe",
       "statut", "erreur", "envoyeLe", "remisLe", "ouvertLe", "createdAt"
FROM "courriels" WHERE "objetType" = $1 AND "objetId" = $2
ORDER BY "createdAt" DESC;

-- name: CourrielsJournal :many
SELECT "id", "type", "sujet", "destinataires", "copies", "objetType", "objetId", "nomPieceJointe",
       "statut", "erreur", "envoyeLe", "remisLe", "ouvertLe", "createdAt"
FROM "courriels"
WHERE (sqlc.narg('type')::text IS NULL OR "type" = sqlc.narg('type')::text)
  AND (sqlc.narg('statut')::text IS NULL OR "statut" = sqlc.narg('statut')::text)
ORDER BY "createdAt" DESC
LIMIT sqlc.arg('page_size')::bigint OFFSET sqlc.arg('page_offset')::bigint;

-- name: CourrielsJournalCount :one
SELECT COUNT(*)::int FROM "courriels"
WHERE (sqlc.narg('type')::text IS NULL OR "type" = sqlc.narg('type')::text)
  AND (sqlc.narg('statut')::text IS NULL OR "statut" = sqlc.narg('statut')::text);

-- name: CourrielRenvoye :exec
UPDATE "courriels" SET "statut" = $2, "messageId" = $3, "erreur" = $4, "envoyeLe" = $5,
  "remisLe" = NULL, "ouvertLe" = NULL
WHERE "id" = $1;

-- name: CourrielEvenementBrevo :execrows
UPDATE "courriels" SET
  "statut" = CASE WHEN "statut" = 'OUVERT' AND @statut::text = 'REMIS' THEN "statut" ELSE @statut::text END,
  "remisLe" = COALESCE("remisLe", CASE WHEN @statut::text IN ('REMIS', 'OUVERT') THEN @quand::timestamp END),
  "ouvertLe" = COALESCE("ouvertLe", CASE WHEN @statut::text = 'OUVERT' THEN @quand::timestamp END),
  "erreur" = CASE WHEN @statut::text = 'ECHEC' THEN @erreur::text ELSE "erreur" END
WHERE "messageId" = @message_id::text;

-- name: CourrielsStatutsParObjets :many
SELECT "objetId", "statut", COUNT(*)::int AS "n"
FROM "courriels" WHERE "objetType" = $1 AND "objetId" = ANY($2::text[])
GROUP BY "objetId", "statut";
