-- +goose Up
-- Un closing s'enregistre avec ce qu'on sait : rien n'y est obligatoire.
ALTER TABLE public.rendez_vous_closings
    DROP CONSTRAINT "rendez_vous_closings_prochaineAction_check",
    ADD CONSTRAINT rendez_vous_closings_prochaine_action_longueur CHECK (length("prochaineAction") <= 120),
    ALTER COLUMN "prochaineAction" SET DEFAULT '',
    ALTER COLUMN "dateRelance" DROP NOT NULL;

-- +goose Down
UPDATE public.rendez_vous_closings SET "prochaineAction" = 'Rappel' WHERE "prochaineAction" = '';
UPDATE public.rendez_vous_closings SET "dateRelance" = "createdAt"::date WHERE "dateRelance" IS NULL;
ALTER TABLE public.rendez_vous_closings
    DROP CONSTRAINT rendez_vous_closings_prochaine_action_longueur,
    ADD CONSTRAINT "rendez_vous_closings_prochaineAction_check" CHECK ("prochaineAction" <> '' AND length("prochaineAction") <= 120),
    ALTER COLUMN "prochaineAction" DROP DEFAULT,
    ALTER COLUMN "dateRelance" SET NOT NULL;
