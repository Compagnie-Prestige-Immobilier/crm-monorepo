-- +goose Up
-- Ce que l'accueil note au suivi d'un rendez-vous : présent, absent ou reporté.
ALTER TABLE "prospects" ADD COLUMN "rendezVousCommentaire" text;

-- +goose Down
ALTER TABLE "prospects" DROP COLUMN "rendezVousCommentaire";
