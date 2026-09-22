-- +goose Up

ALTER TABLE public."ventes" RENAME COLUMN "nombreMois" TO "nombreEcheances";
ALTER TABLE public."ventes"
    ADD COLUMN "periodiciteMois" integer NOT NULL DEFAULT 1
        CHECK ("periodiciteMois" IN (1, 2, 3)),
    ADD COLUMN "jourVersement" integer
        CHECK ("jourVersement" IS NULL OR "jourVersement" IN (5, 10, 15)),
    ADD COLUMN "premierVersement" date;

ALTER TABLE public.ventes_sites
    ADD COLUMN "superficies" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.ventes SET "site" = 'LELOLENE' WHERE "site" = 'LELO SERERE';
UPDATE public.ventes_sites SET "nom" = 'LELOLENE' WHERE "nom" = 'LELO SERERE';

UPDATE public.ventes_sites AS s
SET "prixUnitaireDefaut" = p.prix, "modifieLe" = CURRENT_TIMESTAMP
FROM (VALUES
    ('THIEO', 4000000),
    ('LELOLENE', 5000000),
    ('NDAYANNE', 8500000),
    ('SEBIKHOTANE', 9000000),
    ('SANGALKAM', 15000000),
    ('BAMBILOR EXTENSION', 9000000),
    ('KOUNOUNE', 15000000),
    ('TASSETTE', 6500000),
    ('YENNE', 7500000)
) AS p (nom, prix)
WHERE s."nom" = p.nom;

UPDATE public.ventes_sites
SET "superficieDefaut" = '200 m²',
    "superficies" = '[{"superficie": "200 m²", "prix": 8500000}, {"superficie": "300 m²", "prix": 9500000}]'::jsonb
WHERE "nom" = 'NDAYANNE';

INSERT INTO public.ventes_sites ("nom", "ordre", "prixUnitaireDefaut")
VALUES ('NGOLFANIKE', 13, 6500000)
ON CONFLICT ("nom") DO NOTHING;

UPDATE public.ventes_sites SET "actif" = false, "modifieLe" = CURRENT_TIMESTAMP
WHERE "nom" IN ('BAMBILOR', 'TIVAOUANE PEULH', 'NOFLAYE');

UPDATE public.ventes_canaux SET "actif" = false, "modifieLe" = CURRENT_TIMESTAMP
WHERE "libelle" = 'DMN';

-- +goose Down

UPDATE public.ventes_canaux SET "actif" = true WHERE "libelle" = 'DMN';
UPDATE public.ventes_sites SET "actif" = true WHERE "nom" IN ('BAMBILOR', 'TIVAOUANE PEULH', 'NOFLAYE');
UPDATE public.ventes_sites SET "nom" = 'LELO SERERE' WHERE "nom" = 'LELOLENE';
UPDATE public.ventes SET "site" = 'LELO SERERE' WHERE "site" = 'LELOLENE';
ALTER TABLE public.ventes_sites DROP COLUMN "superficies";
ALTER TABLE public."ventes"
    DROP COLUMN "premierVersement",
    DROP COLUMN "jourVersement",
    DROP COLUMN "periodiciteMois";
ALTER TABLE public."ventes" RENAME COLUMN "nombreEcheances" TO "nombreMois";
