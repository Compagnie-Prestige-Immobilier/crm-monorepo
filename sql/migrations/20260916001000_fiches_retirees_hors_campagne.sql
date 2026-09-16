-- +goose Up

-- Une fiche passée plateforme, ou dont le classeur a changé le projet, n'a plus
-- rien à faire dans la campagne : la ligne « Retirée » qui restait faussait
-- les comptes et passait pour une erreur. Elle sort ; le journal des actions
-- garde le retrait, l'historique des appels reste sur la fiche.
DELETE FROM public.lot_export_items i
USING public.prospects p, public.lots_export l
WHERE p."id" = i."prospectId" AND l."id" = i."lotId"
  AND (p."plateformeDepuis" IS NOT NULL
       OR (p."projet" <> l."projet"
           AND NOT EXISTS (SELECT 1 FROM public.prospect_journeys j
                           WHERE j."prospectId" = p."id" AND j."projet" = l."projet")));

-- +goose Down
-- Pas de revert : les lignes retirées ne se recréent pas.
