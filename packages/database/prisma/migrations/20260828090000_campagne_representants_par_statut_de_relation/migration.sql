-- Campagne d'appels aux représentants bornée par statut de relation.
--
-- Colonne AJOUTÉE avec un défaut vide : les campagnes existantes gardent le
-- tirage sans filtre, et une API plus ancienne qui n'écrit pas la colonne reste
-- valide.
ALTER TABLE "rep_call_campaigns"
ADD COLUMN "relationStatuses" "RepresentantRelation"[] DEFAULT ARRAY[]::"RepresentantRelation"[];
