-- +goose Up

-- Une campagne « Tous les prospects » tire CHUES et Grand Public ensemble :
-- elle ne porte aucun projet, la console lit celui de chaque fiche.
ALTER TABLE public.lots_export ALTER COLUMN "projet" DROP NOT NULL;

-- +goose Down
UPDATE public.lots_export SET "projet" = 'CHUES' WHERE "projet" IS NULL;
ALTER TABLE public.lots_export ALTER COLUMN "projet" SET NOT NULL;
