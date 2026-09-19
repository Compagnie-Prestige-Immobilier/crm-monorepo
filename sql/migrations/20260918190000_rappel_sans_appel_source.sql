-- +goose Up
-- Une requalification par l'encadrement pose un rappel sans appel.
ALTER TABLE public.scheduled_callbacks ALTER COLUMN "sourceAttemptId" DROP NOT NULL;

-- +goose Down
DELETE FROM public.scheduled_callbacks WHERE "sourceAttemptId" IS NULL;
ALTER TABLE public.scheduled_callbacks ALTER COLUMN "sourceAttemptId" SET NOT NULL;
