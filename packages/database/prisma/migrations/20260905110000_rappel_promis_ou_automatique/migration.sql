-- Une fiche non jointe repasse d'elle-meme dans la file de rappel apres le
-- delai de son statut. La file mele donc deux echeances de nature differente :
-- celle que le representant a convenue, et celle qu'un delai a calculee.
-- Deplacer la premiere est une parole trahie, deplacer la seconde ne coute
-- rien : la file ne peut pas les confondre.
--
-- Migration PUREMENT ADDITIVE : un type, une colonne NULLABLE, une contrainte
-- qui accepte tout l'existant. La version precedente de l'application ignore ce
-- qu'elle ne connait pas.
--
-- Pas de table de rappel cote representants : l'echeance vit sur la fiche
-- (`representants.nextCallbackAt`), un appel de plus l'honore et l'efface. Une
-- table jumelle de `scheduled_callbacks` obligerait a tenir deux verites de
-- l'echeance courante, et le mobile pull la fiche, pas une file.
CREATE TYPE "RappelOrigine" AS ENUM ('PROMIS', 'AUTOMATIQUE');

ALTER TABLE "representants" ADD COLUMN "nextCallbackOrigine" "RappelOrigine";

-- Tout ce qui est deja en file a ete promis : jusqu'ici seul « A rappeler »
-- posait une echeance.
UPDATE "representants"
SET "nextCallbackOrigine" = 'PROMIS'
WHERE "nextCallbackAt" IS NOT NULL;

-- Une echeance sans origine, ou une origine sans echeance, ne se lit pas.
ALTER TABLE "representants" ADD CONSTRAINT "representants_next_callback_origine_check"
  CHECK (("nextCallbackAt" IS NULL) = ("nextCallbackOrigine" IS NULL));
