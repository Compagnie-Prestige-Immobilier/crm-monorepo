-- +goose Up
INSERT INTO public.call_outcome_reasons
  ("id", "code", "label", "effect", "requiresComment", "requiresCallback", "countsAsReached",
   "color", "sortOrder", "isSystem", "minPayloadVersion", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'RDV_AGENCE', 'Rendez-vous agence (Souhaite venir se renseigner)', 'SCHEDULE_CALLBACK', false, true, true, 'info', 16, true, 8, now())
ON CONFLICT ("code") DO UPDATE SET "label" = EXCLUDED."label", "effect" = EXCLUDED."effect",
  "requiresCallback" = EXCLUDED."requiresCallback", "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();

DELETE FROM public.call_outcome_reasons r
WHERE r."code" IN ('DEMANDE_INFORMATIONS', 'DEMANDE_DEVIS', 'EN_REFLEXION')
  AND NOT EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."reasonId" = r."id");

UPDATE public.call_outcome_reasons SET "requiresComment" = false, "updatedAt" = now()
WHERE "code" = 'INTERESSE';

-- +goose Down
UPDATE public.call_outcome_reasons SET "requiresComment" = true, "updatedAt" = now()
WHERE "code" = 'INTERESSE';

INSERT INTO public.call_outcome_reasons
  ("id", "code", "label", "effect", "requiresComment", "requiresCallback", "countsAsReached",
   "color", "sortOrder", "isSystem", "minPayloadVersion", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'DEMANDE_INFORMATIONS', 'Demande d''informations', 'KEEP_OPEN', false, false, true, 'info', 16, true, 8, now()),
  (gen_random_uuid()::text, 'DEMANDE_DEVIS', 'Demande de devis / proposition', 'KEEP_OPEN', false, false, true, 'info', 17, true, 8, now()),
  (gen_random_uuid()::text, 'EN_REFLEXION', 'En réflexion', 'KEEP_OPEN', false, false, true, 'info', 18, true, 8, now())
ON CONFLICT ("code") DO NOTHING;

DELETE FROM public.call_outcome_reasons r
WHERE r."code" = 'RDV_AGENCE'
  AND NOT EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."reasonId" = r."id");
