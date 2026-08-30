BEGIN;

-- L'accueil client n'avait aucun emplacement éditorial : tout ce qu'un visiteur
-- voyait venait de la recherche. Les mises en avant sont des lignes ici plutôt
-- qu'une liste figée dans l'application, pour être changées sans publier une
-- nouvelle version.
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  subtitle text CHECK (subtitle IS NULL OR char_length(subtitle) <= 240),
  image_url text NOT NULL,
  -- Facultatif : une mise en avant peut renvoyer vers un atelier précis, ou
  -- n'être qu'une annonce.
  atelier_id uuid REFERENCES ateliers(id) ON DELETE SET NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS promotions_live_idx
  ON promotions(sort_order, created_at DESC)
  WHERE is_active = true;

COMMIT;
