-- +goose Up
-- Fixé à la première transmission : une reprise renvoie le même texte à GLPI.
ALTER TABLE public."support_signalements"
    ADD COLUMN "descriptionTransmise" text,
    ADD COLUMN "contexteTransmis" text;

-- +goose Down
ALTER TABLE public."support_signalements"
    DROP COLUMN "contexteTransmis",
    DROP COLUMN "descriptionTransmise";
