-- +goose Up

-- La condensation des motifs a tout désactivé puis réactivé les douze motifs
-- joignables, laissant les six motifs « Injoignable » et UNREACHABLE inactifs :
-- l'écran d'appel ne propose plus rien sous « Injoignable » et le serveur
-- refuse la tentative sur un motif retiré, si bien que la fiche reste Nouveau.
UPDATE public.call_outcome_reasons
SET "isActive" = true, "updatedAt" = now()
WHERE "code" IN ('PAS_DE_REPONSE', 'NUMERO_OCCUPE', 'MESSAGERIE',
                 'TELEPHONE_INDISPONIBLE', 'INJOIGNABLE_DEFINITIF',
                 'AUTRE_NON_JOINT', 'UNREACHABLE');

-- +goose Down

UPDATE public.call_outcome_reasons
SET "isActive" = false, "updatedAt" = now()
WHERE "code" IN ('PAS_DE_REPONSE', 'NUMERO_OCCUPE', 'MESSAGERIE',
                 'TELEPHONE_INDISPONIBLE', 'INJOIGNABLE_DEFINITIF',
                 'AUTRE_NON_JOINT', 'UNREACHABLE');
