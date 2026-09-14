-- +goose Up
-- Statuts de qualification commerciale condensés pour la prospection Grand Public & CHUES
INSERT INTO public.call_outcome_reasons
  ("id", "code", "label", "effect", "requiresComment", "requiresCallback", "countsAsReached",
   "color", "sortOrder", "isSystem", "minPayloadVersion", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'RDV_AGENCE', 'Rendez-vous agence (Souhaite venir se renseigner)', 'SCHEDULE_CALLBACK', false, true, true, 'info', 16, true, 8, now())
ON CONFLICT ("code") DO UPDATE SET "label" = EXCLUDED."label", "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();

-- Nettoyage des codes redondants inutiles
DELETE FROM public.call_outcome_reasons r
WHERE r."code" IN ('DEMANDE_INFORMATIONS', 'DEMANDE_DEVIS', 'EN_REFLEXION')
  AND NOT EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."reasonId" = r."id");

-- +goose Down
DELETE FROM public.call_outcome_reasons r WHERE r."code" = 'RDV_AGENCE';
