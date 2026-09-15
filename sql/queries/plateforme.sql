-- name: MarquerProspectPlateforme :execrows
UPDATE "prospects" SET "plateformeDepuis" = @depuis::timestamp, "updatedAt" = now()
WHERE "id" = @id AND "deletedAt" IS NULL AND "plateformeDepuis" IS NULL;

-- name: LotsAttribuesDuProspect :many
SELECT "lotId", "position", "assigneeId"
FROM "lot_export_items"
WHERE "prospectId" = @prospect_id AND "assigneeId" IS NOT NULL;

-- name: RetirerProspectDesCampagnes :exec
UPDATE "lot_export_items" SET "assigneeId" = NULL
WHERE "prospectId" = @prospect_id AND "assigneeId" IS NOT NULL;

-- name: CreerProspectPlateforme :one
INSERT INTO "prospects" (
  "id", "nom", "prenom", "phoneE164", "email", "createdById", "clientCreatedAt", "updatedAt",
  "projet", "origin", "originLabel", "plateformeDepuis"
) VALUES (
  @id, @nom, @prenom, @phone_e164, sqlc.narg('email'), @created_by_id, @depuis::timestamp, now(),
  @projet::"Projet", 'PLATEFORME', @origin_label, @depuis::timestamp
)
ON CONFLICT ("phoneE164") WHERE "deletedAt" IS NULL DO NOTHING
RETURNING "id";

-- name: FichesPlateformeDuJour :many
SELECT p."projet",
       COUNT(*) FILTER (WHERE p."plateformeDepuis" >= @depuis::timestamp)::int AS nouvelles,
       COUNT(*) FILTER (WHERE p."lastCallAt" IS NULL OR p."lastCallAt" < p."plateformeDepuis")::int AS a_appeler
FROM "prospects" p
WHERE p."deletedAt" IS NULL AND p."plateformeDepuis" IS NOT NULL
GROUP BY p."projet";
