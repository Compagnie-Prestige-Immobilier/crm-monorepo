-- Quatrième méthode d'enrôlement : la prise de rendez-vous.
--
-- SEULE dans sa migration. PostgreSQL refuse d'utiliser une valeur d'énumération
-- dans la transaction qui l'ajoute, et la migration suivante s'en sert dans une
-- contrainte CHECK.
ALTER TYPE "EnrollmentMethod" ADD VALUE 'APPOINTMENT';
