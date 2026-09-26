-- +goose NO TRANSACTION
-- +goose Up

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
