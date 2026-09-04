-- Un « Numero occupe » ou un « Pas de reponse » se retente : le statut porte le
-- delai apres lequel l'application propose d'elle-meme un reessai, que le
-- teleconseiller peut deplacer avant d'enregistrer.
--
-- Migration PUREMENT ADDITIVE : colonne NULLABLE sans defaut, la version
-- precedente de l'application l'ignore. Nul : aucun reessai propose.
ALTER TABLE "statuts_qualification"
  ADD COLUMN "retryAfterMinutes" INTEGER;
