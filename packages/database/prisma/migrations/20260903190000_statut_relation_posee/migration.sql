-- La relation que le statut pose sur la fiche : « Non interesse » range le
-- representant en REFUS sans qu'on ait a lui reposer la question.
--
-- Migration PUREMENT ADDITIVE : une colonne NULLABLE et sans defaut, rien de
-- supprime, donc la version precedente de l'application ignore ce qu'elle ne
-- connait pas. Voir docs/migrations-en-attente.md pour ce qu'une seule
-- suppression couterait.
--
-- Sans defaut, et c'est le point : un statut qui ne tranche rien ne pose rien.
ALTER TABLE "statuts_qualification"
  ADD COLUMN "relationStatus" "RepresentantRelation";
