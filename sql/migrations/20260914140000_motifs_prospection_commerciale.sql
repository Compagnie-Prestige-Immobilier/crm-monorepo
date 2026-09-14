-- +goose Up
-- Statuts de qualification commerciale pour la prospection Grand Public & CHUES
INSERT INTO public.call_outcome_reasons
  ("id", "code", "label", "effect", "requiresComment", "requiresCallback", "countsAsReached",
   "color", "sortOrder", "isSystem", "minPayloadVersion", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'DEMANDE_INFORMATIONS', 'Demande d''informations', 'KEEP_OPEN', false, false, true, 'info', 16, true, 8, now()),
  (gen_random_uuid()::text, 'DEMANDE_DEVIS', 'Demande de devis / proposition', 'KEEP_OPEN', false, false, true, 'info', 17, true, 8, now()),
  (gen_random_uuid()::text, 'EN_REFLEXION', 'En réflexion', 'KEEP_OPEN', false, false, true, 'info', 18, true, 8, now())
ON CONFLICT ("code") DO UPDATE SET "label" = EXCLUDED."label", "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();

-- +goose Down
DELETE FROM public.call_outcome_reasons r
WHERE r."code" IN ('DEMANDE_INFORMATIONS', 'DEMANDE_DEVIS', 'EN_REFLEXION')
  AND NOT EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."reasonId" = r."id");
