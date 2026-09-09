-- EB-27 : une fiche entree par le formulaire public attend une relecture.
--
-- Migration PUREMENT ADDITIVE : une colonne nullable, aucune ligne existante
-- reecrite, aucun defaut a calculer. La version precedente de l'application
-- ignore la colonne, le retour arriere ne demande rien.
--
-- Pas de nouvelle valeur a declarer pour `origin` : la colonne est un TEXT
-- libre, et `FORMULAIRE_PUBLIC` s'y ecrit comme `BANQUE` s'y ecrit deja.

ALTER TABLE "prospects" ADD COLUMN "aRevoirAt" TIMESTAMP(3);

-- Index PARTIEL, comme `prospects_origin_idx` : la file de relecture tient
-- quelques lignes, un index plein porterait les centaines de milliers de fiches
-- sans marque pour ne jamais servir.
CREATE INDEX "prospects_a_revoir_idx"
  ON "prospects" ("aRevoirAt")
  WHERE "aRevoirAt" IS NOT NULL;
