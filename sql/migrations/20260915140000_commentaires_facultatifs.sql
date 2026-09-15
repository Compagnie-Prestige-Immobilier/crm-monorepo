-- +goose Up
UPDATE public.call_outcome_reasons
SET "requiresComment" = false, "updatedAt" = now()
WHERE "requiresComment";

UPDATE public.statuts_qualification
SET "requiresComment" = false, "updatedAt" = now()
WHERE "requiresComment";

-- +goose Down
UPDATE public.call_outcome_reasons
SET "requiresComment" = true, "updatedAt" = now()
WHERE "code" IN ('DEMANDE_INFORMATION', 'RDV_TELEPHONIQUE', 'CONSTRUCTION', 'PARTENARIAT',
                 'HORS_CIBLE', 'AUTRES', 'AUTRE_NON_JOINT');

UPDATE public.statuts_qualification
SET "requiresComment" = true, "updatedAt" = now()
WHERE "code" IN ('AUTRE_JOINT', 'AUTRE_NON_JOINT');
