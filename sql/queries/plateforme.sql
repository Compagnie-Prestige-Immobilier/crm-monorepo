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

-- Le CCP qui porte le moins de rappels en attente, puis le plus ancien : deux
-- transferts le même jour se répartissent.
-- name: CCPLeMoinsCharge :one
SELECT u."id" FROM "users" u
WHERE u."role" = 'CCP' AND u."isActive"
ORDER BY (SELECT count(*) FROM "scheduled_callbacks" c
          WHERE c."assignedToId" = u."id" AND c."status" = 'PENDING') ASC, u."createdAt" ASC, u."id" ASC
LIMIT 1;

-- name: RappelsPendantsDuProspect :many
SELECT "id", "assignedToId" FROM "scheduled_callbacks"
WHERE "prospectId" = @prospect_id AND "status" = 'PENDING';

-- name: ReattribuerRappel :exec
UPDATE "scheduled_callbacks" SET "assignedToId" = @vers, "updatedAt" = now() WHERE "id" = @id;

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
       COUNT(*) FILTER (WHERE p."plateformeDepuis" >= @depuis::timestamp
         AND EXISTS (SELECT 1 FROM "inscriptions_plateforme" ip
                     WHERE ip."prospectId" = p."id" AND ip."disparueLe" IS NULL))::int AS nouvelles_inscrites,
       COUNT(*) FILTER (WHERE p."lastCallAt" IS NULL OR p."lastCallAt" < p."plateformeDepuis")::int AS a_appeler
FROM "prospects" p
WHERE p."deletedAt" IS NULL AND p."plateformeDepuis" IS NOT NULL
GROUP BY p."projet";
