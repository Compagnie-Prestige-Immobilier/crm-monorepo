-- name: SupprimerClasseursVentes :exec
DELETE FROM "ventes_classeurs";

-- name: SupprimerVersementsVentesImportees :many
DELETE FROM "ventes_versements" vv USING "ventes" v
WHERE vv."venteId" = v."id" AND v."origine" = 'IMPORT'
RETURNING vv."venteId", vv."rang", vv."date", vv."montant";

-- name: SupprimerVentesImportees :many
DELETE FROM "ventes" WHERE "origine" = 'IMPORT' RETURNING *;

-- Rien ne marque un versement saisi au panneau : seule sa trace au journal désigne la vente qui en a reçu.
-- name: VentesAuxVersementsAbsentsDuClasseur :many
SELECT DISTINCT v."numero" FROM "ventes" v
INNER JOIN "ventes_versements" vv ON vv."venteId" = v."id"
WHERE v."origine" = 'IMPORT'
    AND EXISTS (SELECT 1 FROM "audit_logs" a
        WHERE a."entity" = 'vente' AND a."entityId" = v."id"::text AND a."action" = 'vente.versement_ajouter')
    AND NOT EXISTS (SELECT 1 FROM generate_subscripts(@numeros::int[], 1) AS i
        WHERE (@numeros::int[])[i] = v."numero" AND (@dates::date[])[i] = vv."date" AND (@montants::bigint[])[i] = vv."montant")
ORDER BY v."numero"
LIMIT 20;

-- name: InsererClasseurVentes :exec
INSERT INTO "ventes_classeurs" ("id", "nomFichier", "contenu", "depuis", "importeParId")
VALUES ($1, $2, $3, $4, $5);

-- name: InsererVente :one
INSERT INTO "ventes" ("classeurId", "origine", "numero", "canal", "dateSouscription", "client", "telephone",
    "site", "nombreLots", "numerosLots", "superficie", "prixUnitaire", "prixTotal", "acompte",
    "reliquat", "partProprietaire", "partApporteur", "partCpi")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
RETURNING "id";

-- Deux saisies simultanées liraient sinon le même MAX("numero").
-- name: VerrouNumerotationVentes :exec
SELECT pg_advisory_xact_lock(hashtext('ventes.numero'));

-- name: ProchainNumeroVente :one
SELECT COALESCE(MAX("numero"), 0)::integer + 1 AS "numero" FROM "ventes";

-- name: InsererVenteSaisie :one
INSERT INTO "ventes" ("origine", "numero", "canal", "dateSouscription", "client", "telephone",
    "site", "nombreLots", "numerosLots", "superficie", "prixUnitaire", "prixTotal", "acompte",
    "reliquat", "partProprietaire", "partApporteur", "partCpi", "modePaiement", "nombreEcheances", "periodiciteMois", "jourVersement",
    "premierVersement", "soldeeManuellement",
    "email", "numeroCni", "dateDelivranceCni", "autrePiece", "demeurantA", "profession",
    "adresseProfessionnelle", "representant", "nomTeleconseiller", "responsableClosing")
VALUES ('SAISIE', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
    $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
RETURNING "id";

-- name: ModifierVente :exec
UPDATE "ventes"
SET "canal" = $2, "dateSouscription" = $3, "client" = $4, "telephone" = $5, "site" = $6,
    "nombreLots" = $7, "numerosLots" = $8, "superficie" = $9, "prixUnitaire" = $10,
    "prixTotal" = $11, "acompte" = $12, "reliquat" = $13, "partProprietaire" = $14,
    "partApporteur" = $15, "partCpi" = $16, "modePaiement" = $17, "nombreEcheances" = $18,
    "soldeeManuellement" = $19, "email" = $20, "numeroCni" = $21, "dateDelivranceCni" = $22,
    "autrePiece" = $23, "demeurantA" = $24, "profession" = $25, "adresseProfessionnelle" = $26,
    "representant" = $27, "nomTeleconseiller" = $28, "responsableClosing" = $29,
    "periodiciteMois" = $30, "jourVersement" = $31, "premierVersement" = $32
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

-- name: ProchainRangVersement :one
SELECT COALESCE(MAX("rang"), 0)::integer + 1 AS "rang"
FROM "ventes_versements" WHERE "venteId" = $1;

-- name: TotalVersementsVente :one
SELECT COALESCE(SUM("montant"), 0)::bigint AS "total"
FROM "ventes_versements" WHERE "venteId" = $1;

-- name: VenteVerrouillee :one
SELECT * FROM "ventes" WHERE "id" = $1 FOR UPDATE;

-- name: RecalculerReliquatVente :one
UPDATE "ventes" v
SET "reliquat" = v."prixTotal" - v."acompte"
    - (SELECT COALESCE(SUM(vv."montant"), 0) FROM "ventes_versements" vv WHERE vv."venteId" = v."id")
WHERE v."id" = $1 AND v."archiveeLe" IS NULL
RETURNING v."reliquat";

-- name: ClasseurVentes :one
SELECT c."id", c."nomFichier", c."depuis", c."importeLe", u."fullName" AS "importePar"
FROM "ventes_classeurs" c
INNER JOIN "users" u ON u."id" = c."importeParId";

-- name: FichierClasseurVentes :one
SELECT "nomFichier", "contenu" FROM "ventes_classeurs";

-- name: ListerVentes :many
SELECT * FROM "ventes" WHERE "archiveeLe" IS NULL
ORDER BY "dateSouscription" DESC NULLS LAST, "numero" DESC, "id" DESC
LIMIT @limite;

-- name: VenteParID :one
SELECT * FROM "ventes" WHERE "id" = $1 AND "archiveeLe" IS NULL;

-- name: ListerVersementsVentes :many
SELECT * FROM "ventes_versements" WHERE "venteId" = ANY(@ventes::bigint[]) ORDER BY "venteId", "rang";

-- name: ListerSitesVentes :many
SELECT * FROM "ventes_sites" ORDER BY "ordre", "nom";

-- name: SiteVenteParNom :one
SELECT * FROM "ventes_sites" WHERE "nom" = $1;

-- name: SiteVenteParID :one
SELECT * FROM "ventes_sites" WHERE "id" = $1;

-- name: InsererSiteVente :one
INSERT INTO "ventes_sites" ("nom", "ordre", "totalLots", "superficieDefaut", "prixUnitaireDefaut",
    "partProprietaireParLot", "partApporteurMode", "partApporteurValeur", "superficies")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ModifierSiteVente :one
UPDATE "ventes_sites"
SET "nom" = $2, "ordre" = $3, "totalLots" = $4, "superficieDefaut" = $5,
    "prixUnitaireDefaut" = $6, "partProprietaireParLot" = $7,
    "partApporteurMode" = $8, "partApporteurValeur" = $9, "superficies" = $10,
    "modifieLe" = CURRENT_TIMESTAMP
WHERE "id" = $1
RETURNING *;

-- name: RenommerSiteDesVentes :exec
UPDATE "ventes" SET "site" = @nouveau::text WHERE "site" = @ancien::text;

-- name: ActiverSiteVente :one
UPDATE "ventes_sites" SET "actif" = $2, "modifieLe" = CURRENT_TIMESTAMP
WHERE "id" = $1
RETURNING *;

-- name: ListerCanauxVentes :many
SELECT * FROM "ventes_canaux" ORDER BY "ordre", "libelle";

-- name: CanalVenteParID :one
SELECT * FROM "ventes_canaux" WHERE "id" = $1;

-- name: InsererCanalVente :one
INSERT INTO "ventes_canaux" ("libelle", "ordre") VALUES ($1, $2) RETURNING *;

-- name: ModifierCanalVente :one
UPDATE "ventes_canaux" SET "libelle" = $2, "ordre" = $3, "modifieLe" = CURRENT_TIMESTAMP
WHERE "id" = $1 RETURNING *;

-- name: RenommerCanalDesVentes :exec
UPDATE "ventes" SET "canal" = @nouveau::text WHERE "canal" = @ancien::text;

-- name: ActiverCanalVente :one
UPDATE "ventes_canaux" SET "actif" = $2, "modifieLe" = CURRENT_TIMESTAMP
WHERE "id" = $1 RETURNING *;

-- name: EcheancesVentesACredit :many
SELECT "client", "telephone", "nombreEcheances", "periodiciteMois", "jourVersement", "premierVersement"
FROM "ventes"
WHERE "modePaiement" = 'CREDIT' AND "archiveeLe" IS NULL AND NOT "soldeeManuellement"
    AND "reliquat" > 0 AND "jourVersement" IS NOT NULL AND "premierVersement" IS NOT NULL
ORDER BY "client"
LIMIT 5000;
