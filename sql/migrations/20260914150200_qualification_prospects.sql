-- +goose Up
UPDATE public.call_outcome_reasons
SET "isActive" = false, "updatedAt" = now()
WHERE "isActive" = true;

INSERT INTO public.call_outcome_reasons
  ("id", "code", "label", "effect", "requiresComment", "requiresCallback", "countsAsReached",
   "color", "sortOrder", "isSystem", "minPayloadVersion", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'REFUS_DEJA_ENGAGE', 'Déjà engagé', 'CLOSE_REFUSED', false, false, true, 'danger', 10, true, 9, now()),
  (gen_random_uuid()::text, 'REFUS_PAS_CONFIANCE', 'Pas confiance', 'CLOSE_REFUSED', false, false, true, 'danger', 11, true, 9, now()),
  (gen_random_uuid()::text, 'REFUS_MEFIANT', 'Méfiant', 'CLOSE_REFUSED', false, false, true, 'danger', 12, true, 9, now()),
  (gen_random_uuid()::text, 'REFUS_NE_VEUT_PAS', 'Ne veut pas', 'CLOSE_REFUSED', false, false, true, 'danger', 13, true, 9, now()),
  (gen_random_uuid()::text, 'REFUS_PAS_POUR_LE_MOMENT', 'Pas pour le moment', 'CLOSE_REFUSED', false, false, true, 'danger', 14, true, 9, now()),
  (gen_random_uuid()::text, 'DEMANDE_INFORMATION', 'Demande d’information', 'SCHEDULE_CALLBACK', true, true, true, 'info', 20, true, 9, now()),
  (gen_random_uuid()::text, 'RDV_TELEPHONIQUE', 'RDV téléphonique', 'SCHEDULE_CALLBACK', true, true, true, 'info', 21, true, 9, now()),
  (gen_random_uuid()::text, 'TRANSFERT_ENROLEMENT', 'Transfert enrôlement', 'CLOSE_METHOD', false, false, true, 'success', 22, true, 9, now()),
  (gen_random_uuid()::text, 'CONSTRUCTION', 'Construction', 'SCHEDULE_CALLBACK', true, true, true, 'info', 23, true, 9, now()),
  (gen_random_uuid()::text, 'PARTENARIAT', 'Partenariat', 'KEEP_OPEN', true, false, true, 'info', 24, true, 9, now()),
  (gen_random_uuid()::text, 'HORS_CIBLE', 'Hors cible', 'CLOSE_REFUSED', true, false, true, 'danger', 25, true, 9, now()),
  (gen_random_uuid()::text, 'AUTRES', 'Autres', 'KEEP_OPEN', true, false, true, 'neutral', 26, true, 9, now())
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "effect" = EXCLUDED."effect",
  "requiresComment" = EXCLUDED."requiresComment",
  "requiresCallback" = EXCLUDED."requiresCallback",
  "countsAsReached" = EXCLUDED."countsAsReached",
  "color" = EXCLUDED."color",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true,
  "isSystem" = true,
  "minPayloadVersion" = EXCLUDED."minPayloadVersion",
  "updatedAt" = now();

UPDATE public.call_attempts a
SET "reasonId" = nouveau."id"
FROM public.call_outcome_reasons ancien
JOIN public.call_outcome_reasons nouveau ON nouveau."code" = CASE ancien."code"
  WHEN 'METHOD_OBTAINED' THEN 'TRANSFERT_ENROLEMENT'
  WHEN 'REFUSED' THEN 'REFUS_PAS_POUR_LE_MOMENT'
  WHEN 'CALLBACK' THEN 'RDV_TELEPHONIQUE'
  WHEN 'RDV_AGENCE' THEN 'RDV_TELEPHONIQUE'
  WHEN 'INTERESSE' THEN 'DEMANDE_INFORMATION'
  WHEN 'OTHER' THEN 'AUTRES'
  ELSE ancien."code"
END
WHERE a."reasonId" = ancien."id"
  AND ancien."code" IN ('METHOD_OBTAINED', 'REFUSED', 'CALLBACK', 'RDV_AGENCE', 'INTERESSE', 'OTHER');

-- +goose Down
DELETE FROM public.call_outcome_reasons
WHERE "code" IN (
  'REFUS_DEJA_ENGAGE', 'REFUS_PAS_CONFIANCE', 'REFUS_MEFIANT',
  'REFUS_NE_VEUT_PAS', 'REFUS_PAS_POUR_LE_MOMENT', 'DEMANDE_INFORMATION',
  'RDV_TELEPHONIQUE', 'TRANSFERT_ENROLEMENT', 'CONSTRUCTION', 'PARTENARIAT',
  'HORS_CIBLE', 'AUTRES'
)
AND NOT EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."reasonId" = call_outcome_reasons."id");
