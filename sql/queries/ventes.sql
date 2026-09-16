-- name: SupprimerClasseursVentes :exec
DELETE FROM "ventes_classeurs";

-- name: InsererClasseurVentes :exec
INSERT INTO "ventes_classeurs" ("id", "nomFichier", "contenu", "depuis", "importeParId")
VALUES ($1, $2, $3, $4, $5);

-- name: InsererVente :one
INSERT INTO "ventes" ("classeurId", "numero", "canal", "dateSouscription", "client", "telephone",
    "site", "nombreLots", "numerosLots", "superficie", "prixUnitaire", "prixTotal", "acompte",
    "reliquat", "partProprietaire", "partApporteur", "partCpi")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
RETURNING "id";

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
SELECT * FROM "ventes" ORDER BY "dateSouscription", "numero";

-- name: ListerVersementsVentes :many
SELECT * FROM "ventes_versements" ORDER BY "venteId", "rang";
