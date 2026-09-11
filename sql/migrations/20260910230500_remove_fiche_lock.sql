-- +goose Up
DROP INDEX IF EXISTS public.ouvertures_fiche_verrou_unique;

-- +goose Down
CREATE UNIQUE INDEX IF NOT EXISTS ouvertures_fiche_verrou_unique
ON public.ouvertures_fiche ("openedById")
WHERE "closedAt" IS NULL;
