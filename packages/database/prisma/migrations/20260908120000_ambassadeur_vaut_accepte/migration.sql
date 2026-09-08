-- Une fiche AMBASSADEUR porte toujours le statut « Accepté ». Les 700 fiches
-- qualifiees avant la liste du Lot 1 n'avaient aucun statut, et un rappel
-- « Messagerie » sur un ambassadeur effacait le sien : le compteur « Accepté »
-- ne recoupait plus le compteur d'ambassadeurs.
CREATE OR REPLACE FUNCTION representant_ambassadeur_vaut_accepte() RETURNS trigger AS $$
BEGIN
  IF NEW."relationStatus" = 'AMBASSADEUR' THEN
    NEW."statutQualificationId" := (SELECT "id" FROM "statuts_qualification" WHERE "code" = 'ACCEPTE');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER representants_ambassadeur_vaut_accepte
  BEFORE INSERT OR UPDATE OF "relationStatus", "statutQualificationId" ON "representants"
  FOR EACH ROW EXECUTE FUNCTION representant_ambassadeur_vaut_accepte();

UPDATE "representants" r
SET "statutQualificationId" = s."id"
FROM "statuts_qualification" s
WHERE s."code" = 'ACCEPTE'
  AND r."relationStatus" = 'AMBASSADEUR'
  AND r."statutQualificationId" IS DISTINCT FROM s."id";
