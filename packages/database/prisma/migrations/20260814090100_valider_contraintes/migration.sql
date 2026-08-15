-- ─────────────────────────────────────────────────────────────────────────────
-- Validation différée des contraintes posées en `NOT VALID`.
--
-- POURQUOI UN FICHIER SÉPARÉ.
--
-- La migration précédente pose trois CHECK en `NOT VALID` sur des tables déjà
-- en service. `NOT VALID` sert exactement à une chose : obtenir le verrou
-- ACCESS EXCLUSIVE le temps d'écrire une ligne de catalogue, sans parcourir la
-- table. Le parcours, lui, revient au `VALIDATE CONSTRAINT`, qui ne prend
-- qu'un SHARE UPDATE EXCLUSIVE et laisse donc passer lectures et écritures.
--
-- Mais Prisma exécute CHAQUE FICHIER de migration dans UNE seule transaction.
-- Un `VALIDATE` écrit à la suite de son `ADD ... NOT VALID` s'exécuterait donc
-- alors que la transaction détient toujours l'ACCESS EXCLUSIVE pris par
-- l'`ADD` : les verrous ne sont relâchés qu'au COMMIT. Le découpage en deux
-- temps ne coûterait rien et ne rapporterait rien, la table resterait bloquée
-- pendant tout le parcours.
--
-- Le seul découpage qui achète quelque chose est donc un découpage en deux
-- FICHIERS, donc en deux transactions. C'est ce fichier.
--
-- Conséquence assumée : entre les deux migrations, les contraintes sont
-- actives pour les écritures à venir mais l'existant n'est pas encore
-- certifié. Si ce fichier échoue parce qu'une ligne ancienne viole la règle,
-- il est rejouable tel quel après correction des données, sans toucher au
-- schéma.
-- ─────────────────────────────────────────────────────────────────────────────

-- Pas de `lock_timeout` court ici : SHARE UPDATE EXCLUSIVE n'entre en conflit
-- ni avec les lectures ni avec les écritures ordinaires, seulement avec un
-- autre DDL. Couper au bout de trois secondes ferait échouer la validation
-- d'une grande table sans qu'aucune requête applicative n'ait été gênée.

ALTER TABLE "call_campaigns" VALIDATE CONSTRAINT "call_campaigns_spread_days_range";

ALTER TABLE "call_tasks" VALIDATE CONSTRAINT "call_tasks_day_index_non_negative";

ALTER TABLE "prospects" VALIDATE CONSTRAINT "prospects_origin_known";
