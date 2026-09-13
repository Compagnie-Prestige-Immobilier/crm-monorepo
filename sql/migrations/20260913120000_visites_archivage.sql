-- +goose Up
-- Le registre n'avait ni archivage ni suppression : une visite saisie par
-- erreur y restait pour toujours. L'archivage est immédiat ; la destruction
-- définitive est réservée à la direction, et seulement une fois l'archive
-- vieille de trente jours, pour qu'un geste d'humeur ne soit pas irréversible.
ALTER TABLE public.visites ADD COLUMN "deletedAt" timestamp(3) without time zone;
ALTER TABLE public.visites ADD COLUMN "deletedById" text REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX visites_deleted_idx ON public.visites ("deletedAt") WHERE "deletedAt" IS NOT NULL;

-- +goose Down
DROP INDEX public.visites_deleted_idx;
ALTER TABLE public.visites DROP COLUMN "deletedById";
ALTER TABLE public.visites DROP COLUMN "deletedAt";
