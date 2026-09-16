-- +goose Up

-- La colonne « Réponse du prospect » du classeur des leads : une note du
-- marketing, relue à chaque relevé, jamais saisie dans CPI GO.
ALTER TABLE public.prospects ADD COLUMN "remarqueImport" text;

-- +goose Down
ALTER TABLE public.prospects DROP COLUMN "remarqueImport";
