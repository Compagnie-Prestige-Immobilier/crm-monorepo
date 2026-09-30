-- +goose NO TRANSACTION
-- +goose Up

-- `ALTER TYPE ... ADD VALUE` ne s'exécute pas dans une transaction : le rôle a son fichier.
ALTER TYPE public."Role" ADD VALUE IF NOT EXISTS 'OBSERVATEUR';

-- +goose Down

-- Une valeur d'enum ne se retire pas.
