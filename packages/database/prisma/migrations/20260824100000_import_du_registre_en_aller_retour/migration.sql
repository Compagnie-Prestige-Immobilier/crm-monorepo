-- AlterEnum
--
-- Seule dans sa migration : PostgreSQL interdit d'UTILISER une valeur d'enum
-- dans la transaction qui l'ajoute, et la suivante s'en sert.
ALTER TYPE "ImportKind" ADD VALUE 'VISITES_REGISTRE';
