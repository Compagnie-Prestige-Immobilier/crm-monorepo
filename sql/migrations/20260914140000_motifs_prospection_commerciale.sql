-- +goose Up
-- Statuts de qualification commerciale pour la prospection Grand Public & CHUES
INSERT INTO public.call_outcome_reasons
  ("id", "code", "label", "effect", "requiresComment", "requiresCallback", "countsAsReached",
   "color", "sortOrder", "isSystem", "minPayloadVersion", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'RDV_AGENCE', 'Prise de RDV d''information (Visite en agence)', 'SCHEDULE_CALLBACK', false, true, true, 'info', 16, true, 8, now())
ON CONFLICT ("code") DO UPDATE SET "label" = EXCLUDED."label", "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();

-- +goose Down
DELETE FROM public.call_outcome_reasons r
WHERE r."code" IN ('RDV_AGENCE')
  AND NOT EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."reasonId" = r."id");
