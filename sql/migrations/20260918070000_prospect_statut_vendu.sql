-- +goose NO TRANSACTION
-- +goose Up

-- Le classeur des ventes ferme le parcours au delà de la conversion : la
-- fiche vendue le reste, elle ne redevient jamais convertie.
ALTER TYPE public."ProspectStatut" ADD VALUE IF NOT EXISTS 'VENDU';

-- +goose Down

-- Une valeur d'enum ne se retire pas.
