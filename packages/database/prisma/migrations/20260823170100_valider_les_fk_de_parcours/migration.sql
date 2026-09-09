-- Validation des deux contraintes posées `NOT VALID` par la migration
-- précédente. Fichier séparé, et transaction séparée : c'est ce qui permet à la
-- vérification des lignes existantes de prendre un verrou SHARE UPDATE
-- EXCLUSIVE, qui laisse passer les écritures, au lieu de bloquer la table.
SET LOCAL lock_timeout = '3s';

ALTER TABLE "prospect_journeys" VALIDATE CONSTRAINT "prospect_journeys_enrollmentCapturedById_fkey";
ALTER TABLE "prospect_journeys" VALIDATE CONSTRAINT "prospect_journeys_closedById_fkey";
