-- +goose NO TRANSACTION
-- +goose Up

-- Une seule instruction, donc atomique hors transaction, et rejouée à chaque reprise : un doublon
-- inséré avant la fin de l'index est retiré au redémarrage suivant. La plus petite position reste.
WITH retirees AS (
    DELETE FROM public.lot_export_items i
    USING (
        SELECT "lotId", "position",
               row_number() OVER (PARTITION BY "lotId", "prospectId", "representantId" ORDER BY "position") AS rang
        FROM public.lot_export_items
    ) d
    WHERE d."lotId" = i."lotId" AND d."position" = i."position" AND d.rang > 1
    RETURNING i."lotId"
)
UPDATE public.lots_export l
SET "itemCount" = (SELECT count(*) FROM public.lot_export_items i WHERE i."lotId" = l."id") - r.n
FROM (SELECT "lotId", count(*)::integer AS n FROM retirees GROUP BY "lotId") r
WHERE l."id" = r."lotId";

-- Un CONCURRENTLY interrompu laisse un index INVALID : la reprise le supprime avant de le refaire.
DROP INDEX CONCURRENTLY IF EXISTS public."lot_export_items_lotId_prospectId_key";
CREATE UNIQUE INDEX CONCURRENTLY "lot_export_items_lotId_prospectId_key"
    ON public.lot_export_items ("lotId", "prospectId") WHERE "prospectId" IS NOT NULL;

DROP INDEX CONCURRENTLY IF EXISTS public."lot_export_items_lotId_representantId_key";
CREATE UNIQUE INDEX CONCURRENTLY "lot_export_items_lotId_representantId_key"
    ON public.lot_export_items ("lotId", "representantId") WHERE "representantId" IS NOT NULL;

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS public."lot_export_items_lotId_prospectId_key";
DROP INDEX CONCURRENTLY IF EXISTS public."lot_export_items_lotId_representantId_key";
