-- +goose NO TRANSACTION
-- +goose Up

-- « À supprimer » clôt la fiche au statut PERDU : un effet à part, hors transaction
-- comme toute valeur d'enum.
ALTER TYPE public."CallOutcomeEffect" ADD VALUE IF NOT EXISTS 'CLOSE_LOST';

-- +goose Down

-- Une valeur d'enum ne se retire pas.
