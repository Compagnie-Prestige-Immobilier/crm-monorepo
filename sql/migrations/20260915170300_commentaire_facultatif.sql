-- +goose Up

-- La codification des leads rend le commentaire facultatif partout : un motif
-- nommé (« Intéressé », « Hésitant ») dit déjà ce que l'appel a donné.
ALTER TABLE public.call_attempts DROP CONSTRAINT IF EXISTS call_attempts_other_requires_comment;

-- +goose Down
ALTER TABLE public.call_attempts
  ADD CONSTRAINT call_attempts_other_requires_comment
  CHECK (outcome <> 'OTHER'::public."CallOutcome" OR (comment IS NOT NULL AND length(btrim(comment)) > 0))
  NOT VALID;
