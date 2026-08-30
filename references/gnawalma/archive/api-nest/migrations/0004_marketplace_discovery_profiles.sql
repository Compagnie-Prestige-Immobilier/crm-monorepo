BEGIN;

ALTER TABLE ateliers
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS response_time_minutes integer CHECK (response_time_minutes IS NULL OR response_time_minutes >= 0),
  ADD COLUMN IF NOT EXISTS profile_completeness smallint NOT NULL DEFAULT 0 CHECK (profile_completeness BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS accepts_new_clients boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS next_available_at timestamptz;

CREATE TABLE IF NOT EXISTS atelier_portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  title text CHECK (title IS NULL OR char_length(title) <= 120),
  garment_type text CHECK (garment_type IS NULL OR char_length(garment_type) <= 80),
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atelier_portfolio_published_idx
  ON atelier_portfolio_items(atelier_id, sort_order, created_at DESC)
  WHERE is_published = true;

-- `array_to_string` is declared STABLE, not IMMUTABLE, because in general it
-- depends on the element type's output function. PostgreSQL therefore refuses
-- it inside a STORED generated column:
--
--   ERROR:  generation expression is not immutable
--
-- This was verified to fail identically on PostgreSQL 16, 17 and 18, so no
-- server version accepts the expression and bumping the image cannot fix it.
-- Until this wrapper existed the whole migration aborted, leaving `ateliers`
-- without `logo_url` and every GET /marketplace/ateliers returning 500.
--
-- For `text[]` the join genuinely is immutable — text output is not
-- locale- or setting-dependent — so declaring it so is sound rather than a
-- loophole.
CREATE OR REPLACE FUNCTION gnawalma_join_text_array(value text[])
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  RETURNS NULL ON NULL INPUT
AS $$ SELECT array_to_string(value, ' ') $$;

DROP INDEX IF EXISTS ateliers_search_document_idx;
ALTER TABLE ateliers DROP COLUMN IF EXISTS search_document;
ALTER TABLE ateliers
  ADD COLUMN search_document tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(address_text, '') || ' ' ||
      coalesce(gnawalma_join_text_array(specialties), '')
    )
  ) STORED;
CREATE INDEX ateliers_search_document_idx
  ON ateliers USING gin(search_document);

COMMIT;
