-- +goose Up

-- Une fiche appartient au projet qu'elle porte aujourd'hui. Les leads
-- reclassés CHUES par la codification du 15 septembre gardaient un parcours
-- Grand Public de la veille, ce qui les laissait dans les campagnes Grand
-- Public et les y faisait retirer à nouveau. Ils en sortent ; le journal des
-- actions et l'historique des appels ne bougent pas.
DELETE FROM public.lot_export_items i
USING public.prospects p, public.lots_export l
WHERE p."id" = i."prospectId" AND l."id" = i."lotId"
  AND l."projet" IS NOT NULL AND p."projet" <> l."projet";

-- +goose Down
-- Pas de revert : les lignes retirées ne se recréent pas.
