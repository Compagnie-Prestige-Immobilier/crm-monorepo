-- +goose Up

-- Grand Public : « Injoignable » propose les statuts non aboutis de CHUES, et
-- « Joignable » gagne « Hors cible ». Sans ces lignes, le serveur refuse l'appel
-- sur un motif inconnu. Système : l'écran les fige, l'ADMIN ne doit pas pouvoir
-- les retirer. Version 8 : les téléphones déjà déployés ne savent pas les émettre.
INSERT INTO public.call_outcome_reasons
  ("id", "code", "label", "effect", "requiresComment", "requiresCallback", "countsAsReached",
   "color", "sortOrder", "isSystem", "minPayloadVersion", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'PAS_DE_REPONSE', 'Pas de réponse', 'KEEP_OPEN', false, false, false, 'warning', 31, true, 8, now()),
  (gen_random_uuid()::text, 'NUMERO_OCCUPE', 'Occupé', 'KEEP_OPEN', false, false, false, 'warning', 32, true, 8, now()),
  (gen_random_uuid()::text, 'MESSAGERIE', 'Messagerie', 'KEEP_OPEN', false, false, false, 'warning', 33, true, 8, now()),
  (gen_random_uuid()::text, 'TELEPHONE_INDISPONIBLE', 'Téléphone indisponible', 'KEEP_OPEN', false, false, false, 'warning', 34, true, 8, now()),
  (gen_random_uuid()::text, 'INJOIGNABLE_DEFINITIF', 'Injoignable définitif', 'KEEP_OPEN', false, false, false, 'warning', 35, true, 8, now()),
  (gen_random_uuid()::text, 'AUTRE_NON_JOINT', 'Autre non joint', 'KEEP_OPEN', true, false, false, 'neutral', 36, true, 8, now()),
  (gen_random_uuid()::text, 'HORS_CIBLE', 'Hors cible', 'CLOSE_REFUSED', false, false, true, 'danger', 45, true, 8, now())
ON CONFLICT DO NOTHING;

-- +goose Down

-- Un motif déjà porté par un appel reste : la clé étrangère le retient, et
-- l'historique le nomme.
DELETE FROM public.call_outcome_reasons r
WHERE r."code" IN ('PAS_DE_REPONSE', 'NUMERO_OCCUPE', 'MESSAGERIE', 'TELEPHONE_INDISPONIBLE',
                   'INJOIGNABLE_DEFINITIF', 'AUTRE_NON_JOINT', 'HORS_CIBLE')
  AND NOT EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."reasonId" = r."id");
