-- La relation et la qualification ne font plus qu'un pour l'utilisateur :
-- AMBASSADEUR se lit « Accepté », REFUS se lit « Refusé ». Un refus sans
-- statut (avant la liste du Lot 1) recoit « Refusé » ; un refus motive
-- (Décédé, Retraité, Hors cible) garde son motif.
CREATE OR REPLACE FUNCTION representant_ambassadeur_vaut_accepte() RETURNS trigger AS $$
BEGIN
  IF NEW."relationStatus" = 'AMBASSADEUR' THEN
    NEW."statutQualificationId" := (SELECT "id" FROM "statuts_qualification" WHERE "code" = 'ACCEPTE');
  ELSIF NEW."relationStatus" = 'REFUS' AND NEW."statutQualificationId" IS NULL THEN
    NEW."statutQualificationId" := (SELECT "id" FROM "statuts_qualification" WHERE "code" = 'REFUSE');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE "representants" r
SET "statutQualificationId" = s."id"
FROM "statuts_qualification" s
WHERE s."code" = 'REFUSE'
  AND r."relationStatus" = 'REFUS'
  AND r."statutQualificationId" IS NULL;
