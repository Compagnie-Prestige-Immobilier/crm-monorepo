-- +goose Up
-- Le formulaire Meta pose six questions de plus : les réponses sont gardées
-- telles que le classeur des leads les livre, sans interprétation.
ALTER TABLE public.prospects
  ADD COLUMN "formulaireProjet" text,
  ADD COLUMN "formulaireZone" text,
  ADD COLUMN "formulaireBudget" text,
  ADD COLUMN "formulaireModalitePaiement" text,
  ADD COLUMN "formulaireEcheance" text,
  ADD COLUMN "formulaireRoleDecision" text;

-- +goose Down
ALTER TABLE public.prospects
  DROP COLUMN "formulaireProjet",
  DROP COLUMN "formulaireZone",
  DROP COLUMN "formulaireBudget",
  DROP COLUMN "formulaireModalitePaiement",
  DROP COLUMN "formulaireEcheance",
  DROP COLUMN "formulaireRoleDecision";
