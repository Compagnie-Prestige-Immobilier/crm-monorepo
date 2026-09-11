-- +goose Up

-- Grand Public : « Joignable » gagne « Intéressé ». La personne a répondu sans
-- encore choisir comment adhérer : la fiche reste ouverte et l'appel compte comme
-- abouti. Il part en issue OTHER, que `call_attempts_other_requires_comment`
-- n'admet qu'avec un commentaire : ce que la personne veut savoir.
INSERT INTO public.call_outcome_reasons
  ("id", "code", "label", "effect", "requiresComment", "requiresCallback", "countsAsReached",
   "color", "sortOrder", "isSystem", "minPayloadVersion", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'INTERESSE', 'Intéressé', 'KEEP_OPEN', true, false, true, 'success', 15, true, 8, now())
ON CONFLICT DO NOTHING;

-- +goose Down

DELETE FROM public.call_outcome_reasons r
WHERE r."code" = 'INTERESSE'
  AND NOT EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."reasonId" = r."id");
