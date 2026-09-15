-- +goose Up
-- « Construction » propose une date de rendez-vous sans l'exiger.
UPDATE public.call_outcome_reasons
SET "requiresCallback" = false, "updatedAt" = now()
WHERE "code" = 'CONSTRUCTION';

-- +goose Down
UPDATE public.call_outcome_reasons
SET "requiresCallback" = true, "updatedAt" = now()
WHERE "code" = 'CONSTRUCTION';
