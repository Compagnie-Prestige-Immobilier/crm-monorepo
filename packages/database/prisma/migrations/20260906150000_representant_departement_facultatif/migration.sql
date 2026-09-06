-- Une fiche représentant naît normalement en tournée, où le département se
-- déduit du secteur. La saisie manuelle (l'exception) ne le force plus.
ALTER TABLE "representants" ALTER COLUMN "departementId" DROP NOT NULL;

ALTER TABLE "representants" DROP CONSTRAINT "representants_departementId_fkey";
ALTER TABLE "representants" ADD CONSTRAINT "representants_departementId_fkey"
  FOREIGN KEY ("departementId") REFERENCES "departements"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
