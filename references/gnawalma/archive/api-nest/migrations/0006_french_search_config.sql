BEGIN;

-- Search moves from the 'simple' text search configuration to 'french'.
--
-- 'simple' does no stemming and strips no stop words, so a query only ever
-- matched a literal token. In a French-language product that means the
-- singular never finds the plural: a client typing "robe" got zero results
-- against an atelier whose specialty is "Robes de cérémonie", and "retouche"
-- found nothing on "Retouches". Measured against the dev seed, three of the
-- eight client-facing categories returned an empty list for this reason alone.
--
-- 'french' stems both sides of the comparison, so robe/robes and
-- retouche/retouches collapse to one lexeme. It also drops French stop words,
-- which keeps "de", "du" and "la" out of the index.
--
-- The query side must use the same configuration or the two never meet — see
-- websearch_to_tsquery in MarketplaceService.search.

DROP INDEX IF EXISTS ateliers_search_document_idx;
ALTER TABLE ateliers DROP COLUMN IF EXISTS search_document;
ALTER TABLE ateliers
  ADD COLUMN search_document tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'french',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(address_text, '') || ' ' ||
      coalesce(gnawalma_join_text_array(specialties), '')
    )
  ) STORED;
CREATE INDEX ateliers_search_document_idx
  ON ateliers USING gin(search_document);

COMMIT;
