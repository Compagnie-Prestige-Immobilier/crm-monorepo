-- +goose NO TRANSACTION
-- +goose Up

-- Arbitrage du 17 septembre 2026 : tout statut posé ferme la fiche et elle
-- garde son statut (docs/decisions/plan-de-migration-et-de-reaffectation.md).
-- Hors transaction, comme toute valeur d'enum.
ALTER TYPE public."CallOutcomeEffect" ADD VALUE IF NOT EXISTS 'CLOSE_UNREACHABLE';
ALTER TYPE public."CallOutcomeEffect" ADD VALUE IF NOT EXISTS 'CLOSE_INTERESTED';
ALTER TYPE public."CallOutcomeEffect" ADD VALUE IF NOT EXISTS 'CLOSE_HESITANT';
ALTER TYPE public."CallOutcomeEffect" ADD VALUE IF NOT EXISTS 'CLOSE_APPOINTMENT';
ALTER TYPE public."CallOutcomeEffect" ADD VALUE IF NOT EXISTS 'CLOSE_REACHED';
ALTER TYPE public."Phase2Status" ADD VALUE IF NOT EXISTS 'UNREACHABLE';
ALTER TYPE public."Phase2Status" ADD VALUE IF NOT EXISTS 'INTERESTED';
ALTER TYPE public."Phase2Status" ADD VALUE IF NOT EXISTS 'HESITANT';
ALTER TYPE public."Phase2Status" ADD VALUE IF NOT EXISTS 'APPOINTMENT';
ALTER TYPE public."Phase2Status" ADD VALUE IF NOT EXISTS 'REACHED';

-- +goose Down

-- Une valeur d'enum ne se retire pas.
