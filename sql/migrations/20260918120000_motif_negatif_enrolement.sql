-- +goose Up
ALTER TABLE public.inscriptions_plateforme ADD COLUMN "motifNegatif" text;

-- +goose Down
ALTER TABLE public.inscriptions_plateforme DROP COLUMN "motifNegatif";
