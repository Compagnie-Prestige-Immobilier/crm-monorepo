-- +goose Up
-- Un appel Grand Public se consigne sans commentaire ni date de rendez-vous : le serveur exige encore les deux sur CHUES.
ALTER TABLE public.call_attempts DROP CONSTRAINT call_attempts_other_requires_comment;
ALTER TABLE public.call_attempts DROP CONSTRAINT call_attempts_rendez_vous_matches_method;
ALTER TABLE public.call_attempts ADD CONSTRAINT call_attempts_rendez_vous_matches_method
  CHECK ((method)::text IN ('APPOINTMENT', 'RDV_CPI') OR "rendezVousAt" IS NULL);

-- +goose Down
-- Échoue si un appel Grand Public a été consigné depuis sans commentaire sur OTHER ou sans date sur APPOINTMENT.
ALTER TABLE public.call_attempts DROP CONSTRAINT call_attempts_rendez_vous_matches_method;
ALTER TABLE public.call_attempts ADD CONSTRAINT call_attempts_rendez_vous_matches_method
  CHECK (((method)::text = 'RDV_CPI') OR ((method = 'APPOINTMENT') AND ("rendezVousAt" IS NOT NULL))
    OR ((method IS DISTINCT FROM 'APPOINTMENT') AND ("rendezVousAt" IS NULL)));
ALTER TABLE public.call_attempts ADD CONSTRAINT call_attempts_other_requires_comment
  CHECK ((outcome <> 'OTHER') OR ((comment IS NOT NULL) AND (length(btrim(comment)) > 0)));
