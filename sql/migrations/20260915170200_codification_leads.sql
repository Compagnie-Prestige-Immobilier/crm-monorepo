-- +goose Up

-- La codification des leads du 15 septembre 2026 : un seul vocabulaire pour
-- CHUES et Grand Public (docs/decisions/codification-leads.md). Les anciens
-- motifs s'éteignent et gardent leur libellé pour l'historique.
UPDATE public.call_outcome_reasons SET "isActive" = false, "updatedAt" = now() WHERE "isActive";

INSERT INTO public.call_outcome_reasons
  ("id", "code", "label", "effect", "requiresComment", "requiresCallback", "countsAsReached",
   "color", "sortOrder", "isActive", "isSystem", "minPayloadVersion", "parentId", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'MESSAGERIE', 'Boîte vocale', 'KEEP_OPEN', false, false, false, 'warning', 10, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'PAS_DE_REPONSE', 'NRP', 'KEEP_OPEN', false, false, false, 'warning', 11, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'WRONG_NUMBER', 'Faux numéro', 'CLOSE_WRONG_NUMBER', false, false, false, 'danger', 12, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'AUTRE_NON_JOINT', 'Autre injoignable', 'KEEP_OPEN', false, false, false, 'neutral', 13, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'INTERESSE', 'Intéressé', 'KEEP_OPEN', false, false, true, 'success', 20, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'TERRAIN', 'Terrain', 'KEEP_OPEN', false, false, true, 'success', 21, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'VILLA', 'Villa', 'KEEP_OPEN', false, false, true, 'success', 22, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'CONSTRUCTION', 'Construction', 'KEEP_OPEN', false, false, true, 'success', 23, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'FORMALITES_DOMANIALES', 'Formalités domaniales', 'KEEP_OPEN', false, false, true, 'success', 24, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'HESITANT', 'Hésitant', 'KEEP_OPEN', false, false, true, 'info', 30, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'CALLBACK', 'À rappeler', 'SCHEDULE_CALLBACK', false, true, true, 'info', 31, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'DEMANDE_INFORMATION', 'Demande d’information', 'KEEP_OPEN', false, false, true, 'info', 32, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'PARTENARIAT', 'Demande de partenariat', 'KEEP_OPEN', false, false, true, 'info', 33, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'A_SUPPRIMER', 'À supprimer', 'CLOSE_LOST', false, false, true, 'danger', 34, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'RENDEZ_VOUS', 'Rendez-vous', 'SCHEDULE_CALLBACK', false, true, true, 'success', 40, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'RV_CPI', 'RV CPI', 'SCHEDULE_CALLBACK', false, true, true, 'success', 41, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'RV_SITE', 'RV site', 'SCHEDULE_CALLBACK', false, true, true, 'success', 42, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'RV_EXTERNE', 'RV externe', 'SCHEDULE_CALLBACK', false, true, true, 'success', 43, true, true, 9, NULL, now()),
  (gen_random_uuid()::text, 'RDV_TELEPHONIQUE', 'RV téléphonique', 'SCHEDULE_CALLBACK', false, true, true, 'success', 44, true, true, 9, NULL, now())
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label", "effect" = EXCLUDED."effect",
  "requiresComment" = EXCLUDED."requiresComment", "requiresCallback" = EXCLUDED."requiresCallback",
  "countsAsReached" = EXCLUDED."countsAsReached", "color" = EXCLUDED."color", "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true, "isSystem" = true, "minPayloadVersion" = EXCLUDED."minPayloadVersion",
  "parentId" = NULL, "updatedAt" = now();

UPDATE public.call_outcome_reasons
SET "parentId" = (SELECT "id" FROM public.call_outcome_reasons WHERE "code" = 'INTERESSE')
WHERE "code" IN ('TERRAIN', 'VILLA', 'CONSTRUCTION', 'FORMALITES_DOMANIALES');

UPDATE public.call_outcome_reasons
SET "parentId" = (SELECT "id" FROM public.call_outcome_reasons WHERE "code" = 'RENDEZ_VOUS')
WHERE "code" IN ('RV_CPI', 'RV_SITE', 'RV_EXTERNE', 'RDV_TELEPHONIQUE');

-- +goose Down

-- Les motifs d'avant restent en base, éteints : les rallumer se fait depuis
-- l'écran Référentiels, pas par une descente.
UPDATE public.call_outcome_reasons SET "parentId" = NULL
WHERE "code" IN ('TERRAIN', 'VILLA', 'CONSTRUCTION', 'FORMALITES_DOMANIALES',
                 'RV_CPI', 'RV_SITE', 'RV_EXTERNE', 'RDV_TELEPHONIQUE');
