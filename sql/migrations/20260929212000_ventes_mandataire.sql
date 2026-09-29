-- +goose Up
ALTER TABLE public."ventes"
    ADD COLUMN "mandataireNom" text NOT NULL DEFAULT '',
    ADD COLUMN "mandatairePrenom" text NOT NULL DEFAULT '',
    ADD COLUMN "mandataireTelephone" text NOT NULL DEFAULT '',
    ADD COLUMN "mandataireCni" text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE public."ventes"
    DROP COLUMN "mandataireCni",
    DROP COLUMN "mandataireTelephone",
    DROP COLUMN "mandatairePrenom",
    DROP COLUMN "mandataireNom";
