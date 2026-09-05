-- Le chronometre part a la premiere saisie, pas a l'ouverture : le temps de
-- lecture de la fiche n'est pas du traitement.
--
-- Migration PUREMENT ADDITIVE : une colonne nullable et une contrainte qui ne
-- rejette aucune ligne existante. La version precedente l'ignore.

ALTER TABLE "ouvertures_fiche" ADD COLUMN "firstInputAt" TIMESTAMP(3);

-- Meme forme que `ouvertures_fiche_chronometre_check` : les trois bornes
-- restent ordonnees quelles que soient celles qui existent.
ALTER TABLE "ouvertures_fiche" ADD CONSTRAINT "ouvertures_fiche_premiere_saisie_check"
  CHECK (
    ("firstInputAt" IS NULL OR "firstInputAt" >= "openedAt")
    AND ("firstInputAt" IS NULL OR "closedAt" IS NULL OR "closedAt" >= "firstInputAt")
  );
