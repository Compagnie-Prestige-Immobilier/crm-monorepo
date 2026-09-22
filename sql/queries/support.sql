-- name: InsertSupportSignalement :one
INSERT INTO "support_signalements" (
  "id", "auteurId", "cle", "empreinte", "description", "contexte", "urgence", "categorie",
  "auteurLogin", "auteurNom", "auteurEmail", "auteurRoleLibelle", "auteurPilotage", "auteurGroupe"
) VALUES (
  @id, @auteur_id, @cle, @empreinte, @description, @contexte, @urgence, @categorie,
  @auteur_login, @auteur_nom, @auteur_email, @auteur_role_libelle, @auteur_pilotage, @auteur_groupe
)
RETURNING *;

-- name: InsertSupportImage :exec
INSERT INTO "support_signalement_images" (
  "id", "signalementId", "position", "nom", "typeMime", "octets", "empreinte", "contenu"
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: SupportSignalementParCle :one
SELECT * FROM "support_signalements" WHERE "auteurId" = $1 AND "cle" = $2;

-- name: SupportSignalement :one
SELECT s.*, u."fullName" AS "auteurCompte",
       (SELECT count(*) FROM "support_signalement_images" i WHERE i."signalementId" = s."id")::int AS "images",
       (SELECT count(*) FROM "support_signalement_images" i WHERE i."signalementId" = s."id" AND i."transmiseAt" IS NOT NULL)::int AS "imagesTransmises"
FROM "support_signalements" s JOIN "users" u ON u."id" = s."auteurId"
WHERE s."id" = $1;

-- name: SupportSignalements :many
SELECT s.*, u."fullName" AS "auteurCompte",
       (SELECT count(*) FROM "support_signalement_images" i WHERE i."signalementId" = s."id")::int AS "images",
       (SELECT count(*) FROM "support_signalement_images" i WHERE i."signalementId" = s."id" AND i."transmiseAt" IS NOT NULL)::int AS "imagesTransmises"
FROM "support_signalements" s JOIN "users" u ON u."id" = s."auteurId"
WHERE @tous::boolean OR s."auteurId" = @auteur_id::text
ORDER BY s."createdAt" DESC
LIMIT @prendre::bigint;

-- name: SupportSignalementsDus :many
SELECT "id" FROM "support_signalements"
WHERE "prochaineTentative" <= @now::timestamp
  AND ("etat" IN ('en_attente', 'reessai_planifie')
    OR ("etat" = 'en_cours' AND "prisAt" < @bail_expire::timestamp))
ORDER BY "prochaineTentative"
LIMIT @prendre::bigint;

-- name: ClaimSupportSignalement :one
UPDATE "support_signalements"
SET "etat" = 'en_cours', "jeton" = @jeton::text, "prisAt" = @now::timestamp,
    "tentatives" = "tentatives" + 1, "updatedAt" = now()
WHERE "id" = @id
  AND ("etat" IN ('en_attente', 'reessai_planifie')
    OR ("etat" = 'en_cours' AND "prisAt" < @bail_expire::timestamp))
RETURNING *;

-- name: SupportTexteTransmisFixe :execrows
UPDATE "support_signalements"
SET "descriptionTransmise" = @description::text, "contexteTransmis" = @contexte::text,
    "reformulePar" = sqlc.narg(reformule_par)::text, "updatedAt" = now()
WHERE "id" = @id AND "jeton" = @jeton::text AND "descriptionTransmise" IS NULL;

-- name: SupportReformulationsParModele :many
SELECT coalesce("reformulePar", '')::text AS modele, count(*)::int AS nombre
FROM "support_signalements"
WHERE "descriptionTransmise" IS NOT NULL AND "createdAt" >= now() - interval '30 days'
GROUP BY 1
ORDER BY 2 DESC;

-- name: SupportDernieresReformulations :many
SELECT "id", "createdAt", "reformulePar", "description", "contexte", "descriptionTransmise"::text AS description_transmise
FROM "support_signalements"
WHERE "descriptionTransmise" IS NOT NULL
ORDER BY "createdAt" DESC
LIMIT 10;

-- name: SupportCreationEngagee :execrows
UPDATE "support_signalements"
SET "creationEngagee" = true, "updatedAt" = now()
WHERE "id" = @id AND "jeton" = @jeton::text;

-- name: SupportNumeroEnregistre :execrows
UPDATE "support_signalements"
SET "numeroGlpi" = @numero::int, "numeroAt" = @now::timestamp, "updatedAt" = now()
WHERE "id" = @id AND "jeton" = @jeton::text;

-- name: SupportImagesAEnvoyer :many
SELECT "id", "nom", "typeMime", "contenu" FROM "support_signalement_images"
WHERE "signalementId" = $1 AND "transmiseAt" IS NULL
ORDER BY "position";

-- name: SupportImageTransmise :execrows
UPDATE "support_signalement_images"
SET "transmiseAt" = @now::timestamp, "documentGlpi" = sqlc.narg('document')::int
FROM "support_signalements" s
WHERE "support_signalement_images"."id" = @id
  AND s."id" = "support_signalement_images"."signalementId"
  AND s."id" = @signalement_id AND s."jeton" = @jeton::text;

-- name: SupportTermine :execrows
UPDATE "support_signalements"
SET "etat" = 'termine', "finAt" = @now::timestamp, "codeErreur" = NULL, "diagnostic" = NULL, "updatedAt" = now()
WHERE "id" = @id AND "jeton" = @jeton::text AND "numeroGlpi" IS NOT NULL;

-- name: SupportInterrompu :execrows
UPDATE "support_signalements"
SET "etat" = @etat::text, "prochaineTentative" = @prochaine::timestamp,
    "codeErreur" = @code::text, "diagnostic" = @diagnostic::text,
    "finAt" = CASE WHEN @etat::text IN ('echec', 'a_verifier') THEN @now::timestamp ELSE NULL END,
    "updatedAt" = now()
WHERE "id" = @id AND "jeton" = @jeton::text;

-- name: SupportRepris :execrows
UPDATE "support_signalements"
SET "etat" = 'en_attente', "prochaineTentative" = @now::timestamp, "tentatives" = 0,
    "codeErreur" = NULL, "diagnostic" = NULL, "finAt" = NULL, "jeton" = NULL, "updatedAt" = now()
WHERE "id" = @id AND "etat" IN ('echec', 'a_verifier');

-- name: SupportNumeroRattache :execrows
UPDATE "support_signalements"
SET "numeroGlpi" = @numero::int, "numeroAt" = coalesce("numeroAt", @now::timestamp),
    "creationEngagee" = true, "etat" = 'en_attente', "prochaineTentative" = @now::timestamp,
    "tentatives" = 0, "codeErreur" = NULL, "diagnostic" = NULL, "finAt" = NULL, "jeton" = NULL,
    "updatedAt" = now()
WHERE "id" = @id AND "etat" IN ('echec', 'a_verifier');

-- name: SupportCreationAbsenteConfirmee :execrows
UPDATE "support_signalements"
SET "creationEngagee" = false, "etat" = 'en_attente', "prochaineTentative" = @now::timestamp,
    "tentatives" = 0, "codeErreur" = NULL, "diagnostic" = NULL, "finAt" = NULL, "jeton" = NULL,
    "updatedAt" = now()
WHERE "id" = @id AND "etat" = 'a_verifier' AND "numeroGlpi" IS NULL;

-- name: SupportEtatExploitation :one
WITH reperes AS (
  SELECT count(*) FILTER (WHERE "etat" IN ('en_attente', 'en_cours', 'reessai_planifie'))::int AS "en_attente",
         count(*) FILTER (WHERE "etat" = 'echec')::int AS "echecs",
         count(*) FILTER (WHERE "etat" = 'a_verifier')::int AS "a_verifier",
         min("createdAt") FILTER (WHERE "etat" IN ('en_attente', 'en_cours', 'reessai_planifie'))::timestamp AS "plus_ancienne",
         max("numeroAt")::timestamp AS "dernier_ticket",
         (SELECT s."diagnostic" FROM "support_signalements" s
          WHERE s."codeErreur" IS NOT NULL ORDER BY s."updatedAt" DESC LIMIT 1) AS "derniere_erreur",
         (SELECT s."updatedAt"::timestamp FROM "support_signalements" s
          WHERE s."codeErreur" IS NOT NULL ORDER BY s."updatedAt" DESC LIMIT 1) AS "derniere_erreur_le"
  FROM "support_signalements"
)
SELECT coalesce(r."en_attente", 0)::int AS "enAttente", coalesce(r."echecs", 0)::int AS "echecs",
       coalesce(r."a_verifier", 0)::int AS "aVerifier", r."plus_ancienne", r."dernier_ticket",
       r."derniere_erreur", r."derniere_erreur_le"
FROM (SELECT 1) ancre LEFT JOIN reperes r ON true;

-- name: PurgeSupportSignalements :exec
DELETE FROM "support_signalements"
WHERE "etat" = 'termine' AND "finAt" < now() - interval '90 days';

-- name: SupportCategories :many
SELECT "id", "nom", "releveAt" FROM "support_categories" ORDER BY "nom";

-- name: SupportCategoriesVidees :exec
DELETE FROM "support_categories";

-- name: SupportCategorieEnregistree :exec
INSERT INTO "support_categories" ("id", "nom") VALUES ($1, $2)
ON CONFLICT ("id") DO UPDATE SET "nom" = EXCLUDED."nom", "releveAt" = CURRENT_TIMESTAMP;
