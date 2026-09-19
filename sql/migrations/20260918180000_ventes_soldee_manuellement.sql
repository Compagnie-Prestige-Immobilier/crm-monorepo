-- +goose Up
ALTER TABLE public."ventes"
    ADD COLUMN "soldeeManuellement" boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE public."ventes"
    DROP COLUMN "soldeeManuellement";
