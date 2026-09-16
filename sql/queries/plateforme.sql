-- name: MarquerProspectPlateforme :execrows
UPDATE "prospects" SET "plateformeDepuis" = @depuis::timestamp, "updatedAt" = now()
WHERE "id" = @id AND "deletedAt" IS NULL AND "plateformeDepuis" IS NULL;

-- `toutes` : une fiche plateforme quitte toutes ses campagnes ; une fiche qui
-- change de projet ne quitte que celles d'un autre projet, la campagne « Tous
-- les prospects » la garde.
-- name: LotsDuProspect :many
SELECT i."lotId", i."position", i."assigneeId"
FROM "lot_export_items" i
JOIN "lots_export" l ON l."id" = i."lotId"
JOIN "prospects" p ON p."id" = i."prospectId"
WHERE i."prospectId" = @prospect_id
  AND (@toutes::boolean OR (l."projet" IS NOT NULL AND l."projet" <> p."projet"));

-- name: RetirerProspectDesCampagnes :exec
DELETE FROM "lot_export_items" i
USING "lots_export" l, "prospects" p
WHERE i."prospectId" = @prospect_id AND l."id" = i."lotId" AND p."id" = i."prospectId"
  AND (@toutes::boolean OR (l."projet" IS NOT NULL AND l."projet" <> p."projet"));

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

-- Les fiches plateforme dont un rappel promis est encore chez un autre rôle
-- qu'un CCP : rien tant qu'aucun CCP actif n'existe pour les reprendre.
-- name: ProspectsPlateformeAuxRappelsHorsCCP :many
SELECT DISTINCT c."prospectId"
FROM "scheduled_callbacks" c
JOIN "prospects" p ON p."id" = c."prospectId"
JOIN "users" a ON a."id" = c."assignedToId"
WHERE c."status" = 'PENDING' AND p."plateformeDepuis" IS NOT NULL AND a."role" <> 'CCP'
  AND EXISTS (SELECT 1 FROM "users" u WHERE u."role" = 'CCP' AND u."isActive" AND u."deletedAt" IS NULL);

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

-- Ce que chaque CCP a fait aujourd'hui et depuis le début de la semaine :
-- l'encadrement le lit, le CCP s'y compare.
-- name: EquipeCCP :many
SELECT u."id", u."fullName",
       (SELECT count(*) FROM "call_attempts" a
        WHERE a."performedById" = u."id" AND a."clientCreatedAt" >= @debut_jour::timestamp)::int AS appels_jour,
       (SELECT count(DISTINCT a."prospectId") FROM "call_attempts" a
        WHERE a."performedById" = u."id" AND a."clientCreatedAt" >= @debut_jour::timestamp
          AND a."outcome" <> 'UNREACHABLE')::int AS joints_jour,
       (SELECT count(*) FROM "call_attempts" a
        WHERE a."performedById" = u."id" AND a."clientCreatedAt" >= @debut_semaine::timestamp)::int AS appels_semaine,
       (SELECT count(*) FROM "scheduled_callbacks" c
        WHERE c."assignedToId" = u."id" AND c."status" = 'PENDING')::int AS rappels_en_attente,
       COALESCE((SELECT max(a."clientCreatedAt") FROM "call_attempts" a WHERE a."performedById" = u."id"),
                '1970-01-01'::timestamp)::timestamp AS dernier_appel
FROM "users" u
WHERE u."role" = 'CCP' AND u."isActive" AND u."deletedAt" IS NULL
ORDER BY u."fullName", u."id";
