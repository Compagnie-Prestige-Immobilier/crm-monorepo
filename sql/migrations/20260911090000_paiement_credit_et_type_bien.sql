-- +goose NO TRANSACTION
-- +goose Up

-- `ALTER TYPE ... ADD VALUE` ne s'exécute pas dans une transaction : le fichier
-- entier s'en passe. Chaque instruction se rejoue donc sans échouer, sans quoi
-- une reprise après incident resterait bloquée.
ALTER TYPE public."PaymentMode" ADD VALUE IF NOT EXISTS 'CREDIT_IMMOBILIER';

-- +goose StatementBegin
DO $$
BEGIN
  CREATE TYPE public."TypeBien" AS ENUM ('TERRAIN', 'VILLA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
-- +goose StatementEnd

ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS "typeBien" public."TypeBien";
