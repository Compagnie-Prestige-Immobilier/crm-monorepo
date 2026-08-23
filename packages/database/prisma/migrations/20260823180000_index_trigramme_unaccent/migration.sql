-- ─────────────────────────────────────────────────────────────────────────────
-- L'index trigramme le plus coûteux du dépôt ne servait AUCUNE requête.
--
-- `prospects_nom_prenom_trgm` indexe `lower(nom) || ' ' || lower(prenom)`. La
-- recherche des dossiers bancaires, elle, interroge la même expression enveloppée
-- dans `unaccent(…)` : PostgreSQL n'y voit pas la même expression, l'index ne
-- s'applique pas, et la branche `unaccent` SUBSUME la branche compatible — pour
-- un terme sans accent, `unaccent` étant une substitution caractère à caractère,
-- tout ce que trouve la première est trouvé par la seconde. Aucun plan ne pouvait
-- donc emprunter l'index, qui était pourtant payé à chaque INSERT.
--
-- `unaccent` est déclarée STABLE et non IMMUTABLE, parce que son résultat dépend
-- du dictionnaire nommé. Fixer le dictionnaire dans une enveloppe IMMUTABLE est
-- la seule façon de l'indexer ; `SELECT unaccent('unaccent', $1)` désigne
-- explicitement le dictionnaire, ce que la forme à un argument ne fait pas.
-- ─────────────────────────────────────────────────────────────────────────────
SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

-- L'OPCLASS EST QUALIFIÉE, et ce n'est pas cosmétique : `pg_trgm` est installée
-- dans `public`, et la même migration rejouée sous `search_path = demo` échoue
-- sur « operator class gin_trgm_ops does not exist ». Les index trigrammes déjà
-- en place ne passaient que parce que le `search_path` du moment incluait
-- `public` — un hasard, pas une garantie.

CREATE INDEX "prospects_nom_prenom_unaccent_trgm"
  ON "prospects"
  USING gin (immutable_unaccent(lower("nom") || ' ' || lower("prenom")) public.gin_trgm_ops);

-- L'ancien index n'a plus de consommateur : la requête passe entièrement par la
-- forme sans accents, et le maintenir doublerait le coût d'écriture pour rien.
DROP INDEX IF EXISTS "prospects_nom_prenom_trgm";
