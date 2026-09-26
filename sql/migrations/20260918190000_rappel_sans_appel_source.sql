-- +goose Up
-- Une requalification par l'encadrement pose un rappel sans appel.
ALTER TABLE public.scheduled_callbacks ALTER COLUMN "sourceAttemptId" DROP NOT NULL;

-- +goose Down
-- Destructif : supprime les rappels posés sans appel. Revenir en arrière passe par la sauvegarde.
DELETE FROM public.scheduled_callbacks WHERE "sourceAttemptId" IS NULL;
ALTER TABLE public.scheduled_callbacks ALTER COLUMN "sourceAttemptId" SET NOT NULL;
