-- +goose Up
-- Le formulaire BANT de CPI demande aussi les titulaires et la vigilance
-- « personne politiquement exposée » dans « Acquéreur & conformité ».
ALTER TABLE public.rendez_vous_closings
    ADD COLUMN "titulaires" text NOT NULL DEFAULT '' CHECK (length("titulaires") <= 200),
    ADD COLUMN "personnePolitiquementExposee" text NOT NULL DEFAULT '' CHECK (length("personnePolitiquementExposee") <= 120);

-- +goose Down
ALTER TABLE public.rendez_vous_closings
    DROP COLUMN "titulaires",
    DROP COLUMN "personnePolitiquementExposee";
