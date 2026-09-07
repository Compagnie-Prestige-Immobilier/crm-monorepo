-- EB-27 : « FORMULAIRE_PUBLIC » rejoint les origines connues d'un prospect.
--
-- La contrainte n'admettait que « BANQUE ». Le formulaire public ecrivait deja
-- cette origine dans `PROSPECT_ORIGINS` cote TypeScript, mais la base la
-- refusait : toute demande deposee par un prospect echouait en 23514, et
-- l'ecran ne pouvait dire que « Votre demande n'a pas pu etre enregistree ».
--
-- La contrainte est remplacee, pas assouplie : elle continue de refuser une
-- origine inventee. `NOT VALID` puis `VALIDATE` comme la precedente, pour ne
-- pas verrouiller la table en ecriture pendant le controle des lignes.

ALTER TABLE "prospects" DROP CONSTRAINT IF EXISTS "prospects_origin_known";

ALTER TABLE "prospects" ADD CONSTRAINT "prospects_origin_known"
  CHECK ("origin" IS NULL OR "origin" IN ('BANQUE', 'FORMULAIRE_PUBLIC')) NOT VALID;

ALTER TABLE "prospects" VALIDATE CONSTRAINT "prospects_origin_known";
