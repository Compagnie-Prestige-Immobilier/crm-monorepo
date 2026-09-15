-- +goose Up

-- 20260914150200 a éteint tout le référentiel puis n'a rallumé que les motifs
-- « joignable » : « Injoignable » ne proposait plus rien et le serveur refusait
-- ces codes comme retirés.
UPDATE public.call_outcome_reasons
SET "isActive" = true, "minPayloadVersion" = 9, "updatedAt" = now()
WHERE "code" IN ('PAS_DE_REPONSE', 'NUMERO_OCCUPE', 'MESSAGERIE', 'TELEPHONE_INDISPONIBLE',
                 'INJOIGNABLE_DEFINITIF', 'AUTRE_NON_JOINT');

-- +goose Down
UPDATE public.call_outcome_reasons
SET "isActive" = false, "updatedAt" = now()
WHERE "code" IN ('PAS_DE_REPONSE', 'NUMERO_OCCUPE', 'MESSAGERIE', 'TELEPHONE_INDISPONIBLE',
                 'INJOIGNABLE_DEFINITIF', 'AUTRE_NON_JOINT');
