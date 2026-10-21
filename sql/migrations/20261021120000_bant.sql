-- +goose Up
ALTER TABLE public.prospects
  ADD COLUMN "bantProjet" text CHECK ("bantProjet" IN ('TERRAIN', 'BIEN', 'CONSTRUIRE', 'COLLECTIF', 'CONSEIL', 'AUTRE')),
  ADD COLUMN "bantZone" text,
  ADD COLUMN "bantDocument" text CHECK ("bantDocument" IN ('TITRE_FONCIER', 'BAIL', 'DELIBERATION', 'CONSEIL', 'AUTRE')),
  ADD COLUMN "bantBudget" text CHECK ("bantBudget" IN ('M1_5', 'M5_15', 'M15_30', 'M30_75', 'PLUS_75')),
  ADD COLUMN "bantSuivi" text CHECK ("bantSuivi" IN ('MOI_MEME', 'PROCHE_PROCURATION', 'PROCHE_SANS_PROCURATION', 'MANDATAIRE', 'DISTANCE')),
  ADD COLUMN "bantCalendrier" smallint CHECK ("bantCalendrier" BETWEEN 1 AND 5),
  ADD COLUMN "bantBesoin" smallint CHECK ("bantBesoin" BETWEEN 1 AND 5),
  ADD COLUMN "bantAutorite" smallint CHECK ("bantAutorite" BETWEEN 1 AND 5),
  ADD COLUMN "bantCapacite" smallint CHECK ("bantCapacite" BETWEEN 1 AND 5),
  ADD COLUMN "bantScore" smallint GENERATED ALWAYS AS (
    CASE WHEN COALESCE("bantCalendrier", "bantBesoin", "bantAutorite", "bantCapacite") IS NOT NULL THEN
      COALESCE("bantCalendrier", 0) * 4 + COALESCE("bantBesoin", 0) * 5
      + COALESCE("bantAutorite", 0) * 5 + COALESCE("bantCapacite", 0) * 6
    END) STORED;

-- +goose Down
ALTER TABLE public.prospects
  DROP COLUMN "bantScore", DROP COLUMN "bantProjet", DROP COLUMN "bantZone", DROP COLUMN "bantDocument",
  DROP COLUMN "bantBudget", DROP COLUMN "bantSuivi", DROP COLUMN "bantCalendrier", DROP COLUMN "bantBesoin",
  DROP COLUMN "bantAutorite", DROP COLUMN "bantCapacite";
