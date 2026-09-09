-- EB-24 : « RDV CPI » remplace « Prise de rendez-vous » ET « Physique ».
--
-- La reprise ne touche QUE l'etat retenu sur la fiche et sur le parcours. Elle
-- laisse `call_attempts.method` intacte, et ce n'est pas un oubli :
-- `call_attempts_rendez_vous_matches_method` exige une date sur APPOINTMENT, et
-- par construction aucune ligne PHYSICAL n'en porte, la meme contrainte l'ayant
-- interdit jusqu'ici. Les convertir demanderait d'inventer un rendez-vous ou de
-- desarmer la contrainte qui fait justement tenir EB-24. Le fait enregistre par
-- l'appel ne bouge donc pas ; seul son libelle change, `PHYSICAL` se lisant
-- « RDV CPI » dans `phase2-labels.ts`.
--
-- Idempotente : au second passage plus aucune ligne ne vaut PHYSICAL.
UPDATE "prospects" SET "enrollmentMethod" = 'APPOINTMENT'
 WHERE "enrollmentMethod" = 'PHYSICAL';

UPDATE "prospect_journeys" SET "enrollmentMethod" = 'APPOINTMENT'
 WHERE "enrollmentMethod" = 'PHYSICAL';
