-- +goose Up

-- Les quatre premiers lots créés par l'API avaient des positions 0..n-1.
-- La position est affichée et manipulée comme un rang 1..n.
CREATE TEMP TABLE campagnes_positions_zero AS
SELECT i."lotId"
FROM public.lot_export_items i
GROUP BY i."lotId"
HAVING MIN(i."position") = 0
   AND MAX(i."position") = COUNT(*) - 1;

UPDATE public.lot_export_items i
SET "position" = i."position" + 1000000
WHERE i."lotId" IN (SELECT "lotId" FROM campagnes_positions_zero);

UPDATE public.lot_export_items i
SET "position" = i."position" - 999999
WHERE i."lotId" IN (SELECT "lotId" FROM campagnes_positions_zero);

DROP TABLE campagnes_positions_zero;

UPDATE public.lots_export l
SET "filters" = jsonb_set(
    l."filters",
    '{distribution,objectifs}',
    COALESCE((
        SELECT jsonb_object_agg(e.key, e.value)
        FROM jsonb_each(
            CASE
                WHEN jsonb_typeof(l."filters"->'distribution'->'objectifs') = 'object'
                THEN l."filters"->'distribution'->'objectifs'
                ELSE '{}'::jsonb
            END
        ) AS e(key, value)
        WHERE jsonb_exists(l."filters"->'distribution'->'teleconseillerIds', e.key)
    ), '{}'::jsonb)
)
WHERE jsonb_typeof(l."filters"->'distribution'->'objectifs') = 'object'
  AND EXISTS (
      SELECT 1
      FROM jsonb_object_keys(l."filters"->'distribution'->'objectifs') AS e(key)
      WHERE NOT jsonb_exists(l."filters"->'distribution'->'teleconseillerIds', e.key)
  );

-- +goose Down
-- Les positions corrigées ne doivent pas redevenir 0-based.
