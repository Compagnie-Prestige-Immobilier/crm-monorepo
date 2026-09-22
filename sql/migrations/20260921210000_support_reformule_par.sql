-- +goose Up
-- "fournisseur/modèle" retenu ; NULL avec un texte transmis = texte d'origine envoyé.
ALTER TABLE public."support_signalements" ADD COLUMN "reformulePar" text;

-- +goose Down
ALTER TABLE public."support_signalements" DROP COLUMN "reformulePar";
