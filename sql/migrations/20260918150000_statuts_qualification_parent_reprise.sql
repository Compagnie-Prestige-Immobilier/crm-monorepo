-- +goose Up
-- En prod le numéro 20260915120000 avait déjà été consommé par un autre fichier :
-- goose a sauté la colonne. Reprise idempotente.
ALTER TABLE public.statuts_qualification
  ADD COLUMN IF NOT EXISTS "parentId" text REFERENCES public.statuts_qualification("id");

-- +goose Down
SELECT 1;
