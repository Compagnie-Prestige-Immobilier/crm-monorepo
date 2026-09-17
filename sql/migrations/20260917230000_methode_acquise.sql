-- +goose Up

-- L'enrôlement est un fait acquis (arbitrage du propriétaire, 17 septembre 2026) :
-- la fiche prend le statut de son dernier appel, et la méthode obtenue reste,
-- affichée à côté. La contrainte liait les deux ; elle exige désormais une
-- méthode pour l'état « méthode obtenue », sans l'interdire ailleurs.
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_enrollment_method_matches_status;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_enrollment_method_matches_status
  CHECK ("phase2Status" <> 'METHOD_OBTAINED'::public."Phase2Status" OR "enrollmentMethod" IS NOT NULL);

-- +goose Down
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_enrollment_method_matches_status;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_enrollment_method_matches_status
  CHECK ((("phase2Status" = 'METHOD_OBTAINED'::public."Phase2Status" AND "enrollmentMethod" IS NOT NULL)
       OR ("phase2Status" <> 'METHOD_OBTAINED'::public."Phase2Status" AND "enrollmentMethod" IS NULL)));
