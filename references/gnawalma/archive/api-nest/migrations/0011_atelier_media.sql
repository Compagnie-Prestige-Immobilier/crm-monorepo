BEGIN;

-- Les colonnes `logo_url`, `cover_url` et `atelier_portfolio_items.image_url`
-- existent depuis 0004, mais rien ne les écrivait : aucun endpoint ne recevait
-- de fichier. Les seules fiches illustrées étaient celles du jeu de démo, dont
-- les URLs pointent vers un hébergeur externe. Les médias téléversés sont
-- désormais des lignes ici, et les colonnes portent un chemin relatif servi par
-- l'API elle-même.
CREATE TABLE IF NOT EXISTS atelier_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('logo', 'cover', 'portfolio')),
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer NOT NULL CHECK (byte_size > 0),
  storage_key text NOT NULL UNIQUE,
  created_by uuid REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atelier_media_atelier_idx ON atelier_media(atelier_id, kind, created_at DESC);

COMMIT;
