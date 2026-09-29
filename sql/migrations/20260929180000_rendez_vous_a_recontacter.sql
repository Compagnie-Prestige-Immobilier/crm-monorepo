-- +goose Up
-- La veille, la personne ne s'engage ni sur la venue ni sur une date : le
-- rendez-vous quitte l'agenda et attend, avec ce qu'elle a dit.
ALTER TABLE public.prospects
    DROP CONSTRAINT "prospects_rendezVousConfirmation_check",
    ADD CONSTRAINT "prospects_rendezVousConfirmation_check"
        CHECK ("rendezVousConfirmation" IN ('CONFIRME', 'ANNULE', 'A_RECONTACTER')),
    ADD COLUMN "rendezVousRecontacterNote" text CHECK (length("rendezVousRecontacterNote") <= 1000),
    ADD COLUMN "rendezVousRecontacterLe" date,
    ADD COLUMN "rendezVousRecontacterAt" timestamp(3),
    ADD COLUMN "rendezVousRecontacterPar" text REFERENCES public.users ("id"),
    ADD CONSTRAINT prospects_rendez_vous_a_recontacter CHECK (
        ("rendezVousConfirmation" IS NOT DISTINCT FROM 'A_RECONTACTER')
            = ("rendezVousRecontacterNote" IS NOT NULL AND "rendezVousRecontacterAt" IS NOT NULL)
        AND ("rendezVousRecontacterLe" IS NULL OR "rendezVousConfirmation" = 'A_RECONTACTER'));

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.rendez_vous_etape(quand timestamp, confirmation text, issue text, clos boolean, debut_jour timestamp)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN confirmation = 'ANNULE' OR issue = 'NON_HONORE' OR (issue = 'HONORE' AND clos) THEN 'HISTORIQUE'
    WHEN issue = 'HONORE' THEN 'A_CLOSER'
    WHEN confirmation = 'A_RECONTACTER' THEN 'A_RECONTACTER'
    WHEN quand < debut_jour THEN 'EN_RETARD'
    WHEN confirmation = 'CONFIRME' THEN 'CONFIRMES'
    ELSE 'A_CONFIRMER'
  END
$$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.rendez_vous_etape(quand timestamp, confirmation text, issue text, clos boolean, debut_jour timestamp)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN confirmation = 'ANNULE' OR issue = 'NON_HONORE' OR (issue = 'HONORE' AND clos) THEN 'HISTORIQUE'
    WHEN issue = 'HONORE' THEN 'A_CLOSER'
    WHEN quand < debut_jour THEN 'EN_RETARD'
    WHEN confirmation = 'CONFIRME' THEN 'CONFIRMES'
    ELSE 'A_CONFIRMER'
  END
$$;
-- +goose StatementEnd
UPDATE public.prospects SET "rendezVousConfirmation" = NULL WHERE "rendezVousConfirmation" = 'A_RECONTACTER';
ALTER TABLE public.prospects
    DROP CONSTRAINT prospects_rendez_vous_a_recontacter,
    DROP COLUMN "rendezVousRecontacterPar",
    DROP COLUMN "rendezVousRecontacterAt",
    DROP COLUMN "rendezVousRecontacterLe",
    DROP COLUMN "rendezVousRecontacterNote",
    DROP CONSTRAINT "prospects_rendezVousConfirmation_check",
    ADD CONSTRAINT "prospects_rendezVousConfirmation_check"
        CHECK ("rendezVousConfirmation" IN ('CONFIRME', 'ANNULE'));
