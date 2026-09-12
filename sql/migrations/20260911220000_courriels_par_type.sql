-- +goose Up
-- Le courriel « dossier complet » n'existe plus : la plateforme l'envoie. Les
-- réglages passent par courriel (enrôlement, encaissement, refus), chacun avec
-- ses destinataires, ses copies et son texte d'introduction.
UPDATE "app_settings" SET "value" = jsonb_build_object(
  'enrolement', jsonb_build_object(
    'destinataires', COALESCE(v -> 'enrolement', '[]'::jsonb),
    'copies', COALESCE(v -> 'enrolementCopies', '[]'::jsonb), 'intro', ''),
  'encaissement', jsonb_build_object(
    'destinataires', COALESCE(v -> 'banqueCopies', '[]'::jsonb), 'copies', '[]'::jsonb, 'intro', ''),
  'refus', jsonb_build_object(
    'destinataires', COALESCE(v -> 'banqueCopies', '[]'::jsonb), 'copies', '[]'::jsonb, 'intro', ''))::text
FROM (SELECT "value"::jsonb AS v FROM "app_settings" WHERE "key" = 'courriels.destinataires') ancien
WHERE "key" = 'courriels.destinataires' AND ancien.v ? 'banque';

-- +goose Down
SELECT 1;
