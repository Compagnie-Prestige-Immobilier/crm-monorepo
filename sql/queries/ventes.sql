-- name: SupprimerClasseursVentes :exec
DELETE FROM "ventes_classeurs";

-- name: SupprimerVentesImportees :exec
DELETE FROM "ventes" WHERE "origine" = 'IMPORT';

-- name: InsererClasseurVentes :exec
INSERT INTO "ventes_classeurs" ("id", "nomFichier", "contenu", "depuis", "importeParId")
VALUES ($1, $2, $3, $4, $5);

-- name: InsererVente :one
INSERT INTO "ventes" ("classeurId", "origine", "numero", "canal", "dateSouscription", "client", "telephone",
    "site", "nombreLots", "numerosLots", "superficie", "prixUnitaire", "prixTotal", "acompte",
    "reliquat", "partProprietaire", "partApporteur", "partCpi")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
RETURNING "id";

-- name: ProchainNumeroVente :one
SELECT COALESCE(MAX("numero"), 0)::integer + 1 AS "numero" FROM "ventes";

-- name: InsererVenteSaisie :one
INSERT INTO "ventes" ("origine", "numero", "canal", "dateSouscription", "client", "telephone",
    "site", "nombreLots", "numerosLots", "superficie", "prixUnitaire", "prixTotal", "acompte",
    "reliquat", "partProprietaire", "partApporteur", "partCpi")
VALUES ('SAISIE', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
RETURNING "id";

-- name: ModifierVente :exec
UPDATE "ventes"
SET "canal" = $2, "dateSouscription" = $3, "client" = $4, "telephone" = $5, "site" = $6,
    "nombreLots" = $7, "numerosLots" = $8, "superficie" = $9, "prixUnitaire" = $10,
    "prixTotal" = $11, "acompte" = $12, "reliquat" = $13, "partProprietaire" = $14,
    "partApporteur" = $15, "partCpi" = $16
WHERE "id" = $1 AND "archiveeLe" IS NULL;

-- name: ArchiverVente :exec
UPDATE "ventes" SET "archiveeLe" = CURRENT_TIMESTAMP, "archiveeParId" = $2
WHERE "id" = $1 AND "archiveeLe" IS NULL;

-- name: RestaurerVente :exec
UPDATE "ventes" SET "archiveeLe" = NULL, "archiveeParId" = NULL
WHERE "id" = $1;

-- name: SupprimerVersementsVente :exec
DELETE FROM "ventes_versements" WHERE "venteId" = $1;

-- name: InsererVersementVente :exec
INSERT INTO "ventes_versements" ("venteId", "rang", "date", "montant")
VALUES ($1, $2, $3, $4);

-- name: ClasseurVentes :one
SELECT c."id", c."nomFichier", c."depuis", c."importeLe", u."fullName" AS "importePar"
FROM "ventes_classeurs" c
INNER JOIN "users" u ON u."id" = c."importeParId";

-- name: FichierClasseurVentes :one
SELECT "nomFichier", "contenu" FROM "ventes_classeurs";

-- name: ListerVentes :many
SELECT * FROM "ventes" WHERE "archiveeLe" IS NULL ORDER BY "dateSouscription", "numero";

-- name: VenteParID :one
SELECT * FROM "ventes" WHERE "id" = $1 AND "archiveeLe" IS NULL;

-- name: ListerVersementsVentes :many
SELECT * FROM "ventes_versements" ORDER BY "venteId", "rang";

-- name: ListerSitesVentes :many
SELECT * FROM "ventes_sites" ORDER BY "ordre", "nom";

-- name: SiteVenteParNom :one
SELECT * FROM "ventes_sites" WHERE "nom" = $1;

-- name: InsererSiteVente :one
INSERT INTO "ventes_sites" ("nom", "ordre", "totalLots", "superficieDefaut", "prixUnitaireDefaut",
    "partProprietaireParLot", "partApporteurMode", "partApporteurValeur")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ModifierSiteVente :one
UPDATE "ventes_sites"
SET "nom" = $2, "ordre" = $3, "totalLots" = $4, "superficieDefaut" = $5,
    "prixUnitaireDefaut" = $6, "partProprietaireParLot" = $7,
    "partApporteurMode" = $8, "partApporteurValeur" = $9,
    "modifieLe" = CURRENT_TIMESTAMP
WHERE "id" = $1
RETURNING *;

-- name: ActiverSiteVente :one
UPDATE "ventes_sites" SET "actif" = $2, "modifieLe" = CURRENT_TIMESTAMP
WHERE "id" = $1
RETURNING *;

-- name: ListerCanauxVentes :many
SELECT * FROM "ventes_canaux" ORDER BY "ordre", "libelle";

-- name: InsererCanalVente :one
INSERT INTO "ventes_canaux" ("libelle", "ordre") VALUES ($1, $2) RETURNING *;

-- name: ModifierCanalVente :one
UPDATE "ventes_canaux" SET "libelle" = $2, "ordre" = $3, "modifieLe" = CURRENT_TIMESTAMP
WHERE "id" = $1 RETURNING *;

-- name: ActiverCanalVente :one
UPDATE "ventes_canaux" SET "actif" = $2, "modifieLe" = CURRENT_TIMESTAMP
WHERE "id" = $1 RETURNING *;
