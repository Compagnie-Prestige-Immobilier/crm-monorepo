-- +goose Up

UPDATE public.call_outcome_reasons
SET "effect" = 'KEEP_OPEN',
    "requiresCallback" = false,
    "updatedAt" = now()
WHERE "code" = 'DEMANDE_INFORMATION';

-- +goose Down

UPDATE public.call_outcome_reasons
SET "effect" = 'SCHEDULE_CALLBACK',
    "requiresCallback" = true,
    "updatedAt" = now()
WHERE "code" = 'DEMANDE_INFORMATION';
