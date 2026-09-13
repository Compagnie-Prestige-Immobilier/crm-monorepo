-- +goose Up
-- Un classeur de leads porte un onglet par jour, et son nom de fichier reste
-- celui du premier jour. L'onglet est la seule date fiable de la fiche.
ALTER TABLE public.prospects ADD COLUMN "importFeuille" text;

CREATE INDEX prospects_import_feuille_idx
  ON public.prospects ("importJobId", "importFeuille")
  WHERE "importJobId" IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS prospects_import_feuille_idx;
ALTER TABLE public.prospects DROP COLUMN IF EXISTS "importFeuille";
