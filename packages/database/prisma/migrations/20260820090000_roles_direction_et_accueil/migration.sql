-- Deux roles de plus: la direction commerciale, qui lit tout sans rien purger,
-- et l'accueil, qui ne tient que le registre des visites.
ALTER TYPE "Role" ADD VALUE 'DIRECTION';
ALTER TYPE "Role" ADD VALUE 'ACCUEIL';
