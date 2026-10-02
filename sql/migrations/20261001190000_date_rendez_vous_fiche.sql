-- +goose Up
-- La date du rendez-vous d'une fiche, lue comme l'écran : report, rappel promis, date posée en conversion.
-- +goose StatementBegin
CREATE FUNCTION public.prospect_date_rendez_vous(prospect_id text, phase2 text, reporte_at timestamp)
RETURNS timestamp LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    CASE WHEN phase2 = 'APPOINTMENT' THEN reporte_at END,
    CASE WHEN phase2 = 'APPOINTMENT' THEN (
      SELECT s."scheduledAt" FROM public.scheduled_callbacks s
      WHERE s."prospectId" = prospect_id AND s."status" <> 'SUPERSEDED'
      ORDER BY (s."status" = 'PENDING') DESC, s."createdAt" DESC LIMIT 1) END,
    (SELECT a."rendezVousAt" FROM public.call_attempts a
     WHERE a."prospectId" = prospect_id AND a."rendezVousAt" IS NOT NULL
     ORDER BY a."clientCreatedAt" DESC, a."id" DESC LIMIT 1))
$$;
-- +goose StatementEnd

-- +goose Down
DROP FUNCTION public.prospect_date_rendez_vous(text, text, timestamp);
