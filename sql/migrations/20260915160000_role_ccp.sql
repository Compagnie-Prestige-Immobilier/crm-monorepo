-- +goose NO TRANSACTION
-- +goose Up

-- `ALTER TYPE ... ADD VALUE` ne s'exécute pas dans une transaction, et la
-- valeur ne s'utilise pas dans celle qui la crée : le rôle a son fichier.
ALTER TYPE public."Role" ADD VALUE IF NOT EXISTS 'CCP';

-- +goose Down

-- Une valeur d'enum ne se retire pas.
