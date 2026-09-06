-- Ordre de reprise d'une fiche qualifiee : un « Tres interesse » joint se
-- rappelle avant un « Non eligible ».
--
-- Migration PUREMENT ADDITIVE : un type et une colonne a defaut, rien de
-- supprime, donc la version precedente de l'application ignore ce qu'elle ne
-- connait pas. Voir docs/migrations-en-attente.md pour ce qu'une seule
-- suppression couterait.
--
-- L'ORDRE DES VALEURS EST LE TRI : PostgreSQL classe un type enumere par
-- l'ordre de declaration, et c'est lui que lit le tri de l'annuaire.
CREATE TYPE "PrioriteTraitement" AS ENUM ('HAUTE', 'NORMALE', 'BASSE');

ALTER TABLE "statuts_qualification"
  ADD COLUMN "priorite" "PrioriteTraitement" NOT NULL DEFAULT 'NORMALE';
