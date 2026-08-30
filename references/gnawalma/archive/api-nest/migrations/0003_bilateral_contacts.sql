BEGIN;

ALTER TABLE contact_events
  ADD COLUMN IF NOT EXISTS client_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS atelier_confirmed_at timestamptz;

COMMIT;
