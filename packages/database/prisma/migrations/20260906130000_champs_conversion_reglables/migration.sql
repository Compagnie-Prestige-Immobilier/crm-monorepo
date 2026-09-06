-- EB-28 : reponses aux champs libres du formulaire de conversion.
--
-- Migration PUREMENT ADDITIVE : une colonne nullable, ignoree par la version
-- precedente de l'API.
--
-- Les reglages eux-memes (visibilite, caractere obligatoire, ordre, et les
-- definitions des champs libres) n'ont PAS de table : ils tiennent dans
-- "app_settings" sous la cle conversion.champs.<projet>, comme les reglages
-- d'enrolement.
--
-- Un objet JSON plat, identifiant du champ -> valeur, et non une table de
-- couples : ces reponses ne se filtrent ni ne se joignent, elles s'affichent
-- sur la fiche et sortent dans le classeur, toujours avec le prospect.

ALTER TABLE "prospects" ADD COLUMN "champsLibres" JSONB;
