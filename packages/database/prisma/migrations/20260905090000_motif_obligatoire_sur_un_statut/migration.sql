-- « Autre » ne dit rien tant qu'on ne l'a pas ecrit : le statut porte lui-meme
-- l'exigence du motif, comme le fait deja `call_outcome_reasons` cote prospects.
--
-- Migration PUREMENT ADDITIVE : une colonne a defaut, rien de supprime, donc la
-- version precedente de l'application ignore ce qu'elle ne connait pas. Voir
-- docs/migrations-en-attente.md pour ce qu'une seule suppression couterait.
--
-- Pas de contrainte CHECK sur `rep_call_attempts` : la regle traverse une
-- jointure vers le referentiel, ce qu'un CHECK PostgreSQL ne sait pas faire.
-- Elle est tenue a l'ecriture, dans l'API.
ALTER TABLE "statuts_qualification"
  ADD COLUMN "requiresComment" BOOLEAN NOT NULL DEFAULT false;
