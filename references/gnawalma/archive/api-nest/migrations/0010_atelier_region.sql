BEGIN;

-- La région n'existait que côté application, dérivée d'une liste de quartiers
-- codée en dur. La recherche cliente doit filtrer dessus, et `address_text` est
-- une chaîne libre : « Médina, Dakar », « Dakar », « rue 10 x Blaise Diagne ».
-- Un filtre par `ILIKE` sur cette colonne renverrait l'atelier « Dakar Couture »
-- de Ziguinchor. La région devient donc une valeur à part entière.
ALTER TABLE ateliers ADD COLUMN IF NOT EXISTS region text;

CREATE INDEX IF NOT EXISTS ateliers_region_idx ON ateliers(region) WHERE region IS NOT NULL;

-- Reprise des lignes existantes : le nom de région est déjà dans l'adresse pour
-- tout atelier créé par l'assistant, qui composait « quartier, région ».
UPDATE ateliers a
   SET region = r.name
  FROM (VALUES
    ('Dakar'), ('Diourbel'), ('Fatick'), ('Kaffrine'), ('Kaolack'),
    ('Kédougou'), ('Kolda'), ('Louga'), ('Matam'), ('Saint-Louis'),
    ('Sédhiou'), ('Tambacounda'), ('Thiès'), ('Ziguinchor')
  ) AS r(name)
 WHERE a.region IS NULL
   AND a.address_text IS NOT NULL
   AND a.address_text ILIKE '%' || r.name || '%';

COMMIT;
