-- +goose Up
ALTER TABLE public."ventes"
    ADD COLUMN "email" text NOT NULL DEFAULT '',
    ADD COLUMN "numeroCni" text NOT NULL DEFAULT '',
    ADD COLUMN "dateDelivranceCni" date,
    ADD COLUMN "autrePiece" text NOT NULL DEFAULT '',
    ADD COLUMN "demeurantA" text NOT NULL DEFAULT '',
    ADD COLUMN "profession" text NOT NULL DEFAULT '',
    ADD COLUMN "adresseProfessionnelle" text NOT NULL DEFAULT '',
    ADD COLUMN "representant" text NOT NULL DEFAULT '',
    ADD COLUMN "nomTeleconseiller" text NOT NULL DEFAULT '',
    ADD COLUMN "responsableClosing" text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE public."ventes"
    DROP COLUMN "responsableClosing",
    DROP COLUMN "nomTeleconseiller",
    DROP COLUMN "representant",
    DROP COLUMN "adresseProfessionnelle",
    DROP COLUMN "profession",
    DROP COLUMN "demeurantA",
    DROP COLUMN "autrePiece",
    DROP COLUMN "dateDelivranceCni",
    DROP COLUMN "numeroCni",
    DROP COLUMN "email";
