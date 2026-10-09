-- +goose Up
-- Une fiche complétée dans le classeur après le lancement de la campagne de son
-- onglet y entre au relevé suivant : la date la distingue du tirage d'origine.
ALTER TABLE public.lot_export_items ADD COLUMN "remonteeLe" timestamp(3) without time zone;

-- +goose Down
ALTER TABLE public.lot_export_items DROP COLUMN "remonteeLe";
