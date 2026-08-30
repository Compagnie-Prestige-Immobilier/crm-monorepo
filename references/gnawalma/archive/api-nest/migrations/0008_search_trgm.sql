BEGIN;

-- 'french' full-text search (0006) stems words but only matches whole
-- lexemes: a typo like "coutrier" for "couturier", or a partial name like
-- "Awa" for "Atelier Awa Couture", returns nothing. A client who doesn't
-- remember (or mistypes) the exact name has no way to find the atelier.
--
-- pg_trgm adds trigram similarity, matched with `%` / similarity() below in
-- MarketplaceService.search. It's ORed with the existing full-text match, so
-- stemmed word matches keep working exactly as before and typo/partial-name
-- matches are added on top, not swapped in.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS ateliers_name_trgm_idx
  ON ateliers USING gin (name gin_trgm_ops);

COMMIT;
