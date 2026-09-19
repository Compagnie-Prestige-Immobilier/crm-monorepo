-- +goose Up

ALTER TABLE public."ventes"
    ADD COLUMN "modePaiement" text NOT NULL DEFAULT 'COMPTANT'
        CHECK ("modePaiement" IN ('COMPTANT', 'CREDIT')),
    ADD COLUMN "nombreMois" integer
        CHECK ("nombreMois" IS NULL OR "nombreMois" > 0);

-- +goose Down

ALTER TABLE public."ventes"
    DROP COLUMN "nombreMois",
    DROP COLUMN "modePaiement";
