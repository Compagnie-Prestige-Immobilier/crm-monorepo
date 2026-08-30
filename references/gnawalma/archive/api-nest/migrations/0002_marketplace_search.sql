BEGIN;

ALTER TABLE ateliers
  ADD COLUMN IF NOT EXISTS search_document tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS ateliers_search_document_idx
  ON ateliers USING gin(search_document);

ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_body_check;

ALTER TABLE reviews
  ADD CONSTRAINT reviews_body_check CHECK (char_length(body) <= 200);

COMMIT;
