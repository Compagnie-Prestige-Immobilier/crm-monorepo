-- EB-27 : le formulaire public rapproche par numero OU par e-mail. Sans colonne
-- sur la fiche, la seule adresse connue vit sur `call_attempts`, donc sur les
-- seuls prospects deja appeles : deux demandes publiques du meme visiteur avec
-- deux numeros creeraient deux fiches.
--
-- Pas d'unicite : deux membres d'un foyer partagent une adresse, et un index
-- unique ferait echouer une saisie legitime.
ALTER TABLE "prospects" ADD COLUMN "email" TEXT;

-- Partiel comme l'index de numero : le rapprochement ne lit que les fiches
-- vivantes qui portent une adresse, et la colonne reste nulle presque partout.
CREATE INDEX "prospects_email_active_idx"
  ON "prospects" ("email")
  WHERE "deletedAt" IS NULL AND "email" IS NOT NULL;
