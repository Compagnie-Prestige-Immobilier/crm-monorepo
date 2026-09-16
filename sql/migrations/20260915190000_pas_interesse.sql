-- +goose Up

-- Statut joignable ajouté à la codification des leads le 15 septembre 2026 :
-- la personne a répondu et ne veut pas, la fiche se ferme en refus.
INSERT INTO public.call_outcome_reasons
  ("id", "code", "label", "effect", "requiresComment", "requiresCallback", "countsAsReached",
   "color", "sortOrder", "isActive", "isSystem", "minPayloadVersion", "parentId", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'PAS_INTERESSE', 'Pas intéressé', 'CLOSE_REFUSED', false, false, true, 'danger', 25, true, true, 9, NULL, now())
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label", "effect" = EXCLUDED."effect",
  "requiresComment" = EXCLUDED."requiresComment", "requiresCallback" = EXCLUDED."requiresCallback",
  "countsAsReached" = EXCLUDED."countsAsReached", "color" = EXCLUDED."color", "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true, "isSystem" = true, "minPayloadVersion" = EXCLUDED."minPayloadVersion",
  "parentId" = NULL, "updatedAt" = now();

-- +goose Down
UPDATE public.call_outcome_reasons SET "isActive" = false, "updatedAt" = now() WHERE "code" = 'PAS_INTERESSE';
