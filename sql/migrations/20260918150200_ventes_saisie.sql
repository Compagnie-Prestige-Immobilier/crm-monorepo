-- +goose Up

ALTER TABLE public."ventes"
    ALTER COLUMN "classeurId" DROP NOT NULL;

ALTER TABLE public."ventes"
    ADD COLUMN "origine" text NOT NULL DEFAULT 'IMPORT'
        CHECK ("origine" IN ('IMPORT', 'SAISIE')),
    ADD COLUMN "archiveeLe" timestamp(3),
    ADD COLUMN "archiveeParId" text REFERENCES public.users ("id");

CREATE TABLE public.ventes_sites (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "nom" text NOT NULL UNIQUE,
    "actif" boolean NOT NULL DEFAULT true,
    "ordre" integer NOT NULL DEFAULT 0,
    "totalLots" integer,
    "superficieDefaut" text NOT NULL DEFAULT '',
    "prixUnitaireDefaut" bigint NOT NULL DEFAULT 0,
    "partProprietaireParLot" bigint NOT NULL DEFAULT 0,
    "partApporteurMode" text NOT NULL DEFAULT 'AUCUNE'
        CHECK ("partApporteurMode" IN ('AUCUNE', 'POURCENTAGE_PROPRIETAIRE', 'MONTANT_PAR_LOT', 'MONTANT_TOTAL')),
    "partApporteurValeur" bigint NOT NULL DEFAULT 0,
    "creeLe" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.ventes_canaux (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "libelle" text NOT NULL UNIQUE,
    "actif" boolean NOT NULL DEFAULT true,
    "ordre" integer NOT NULL DEFAULT 0,
    "creeLe" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.ventes_sites
    ("nom", "ordre", "totalLots", "prixUnitaireDefaut", "partProprietaireParLot", "partApporteurMode", "partApporteurValeur")
VALUES
    ('THIEO', 1, 100, 3000000, 1500000, 'AUCUNE', 0),
    ('NDAYANNE', 2, 94, 6000000, 4000000, 'POURCENTAGE_PROPRIETAIRE', 10),
    ('SEBIKHOTANE', 3, 50, 6500000, 3500000, 'POURCENTAGE_PROPRIETAIRE', 10),
    ('LELO SERERE', 4, NULL, 4750000, 2500000, 'POURCENTAGE_PROPRIETAIRE', 10),
    ('TIVAOUANE PEULH', 5, 3, 12000000, 0, 'AUCUNE', 0),
    ('SANGALKAM', 6, 308, 0, 7500000, 'POURCENTAGE_PROPRIETAIRE', 5),
    ('KOUNOUNE', 7, 100, 0, 12500000, 'MONTANT_TOTAL', 500000),
    ('BAMBILOR', 8, 120, 0, 0, 'AUCUNE', 0),
    ('BAMBILOR EXTENSION', 9, 20, 0, 4000000, 'AUCUNE', 0),
    ('NOFLAYE', 10, 25, 0, 8500000, 'AUCUNE', 0),
    ('TASSETTE', 11, 1608, 0, 1500000, 'AUCUNE', 0),
    ('YENNE', 12, 202, 0, 5000000, 'AUCUNE', 0)
ON CONFLICT ("nom") DO NOTHING;

INSERT INTO public.ventes_canaux ("libelle", "ordre")
VALUES ('CPI', 1), ('BDD PERSO.', 2), ('BDD CPI', 3), ('DMN', 4)
ON CONFLICT ("libelle") DO NOTHING;

-- +goose Down

DROP TABLE public.ventes_canaux;
DROP TABLE public.ventes_sites;
ALTER TABLE public."ventes"
    DROP COLUMN "archiveeParId",
    DROP COLUMN "archiveeLe",
    DROP COLUMN "origine";
ALTER TABLE public."ventes"
    ALTER COLUMN "classeurId" SET NOT NULL;
