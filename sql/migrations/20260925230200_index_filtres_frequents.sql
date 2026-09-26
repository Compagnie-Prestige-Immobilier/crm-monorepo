-- +goose NO TRANSACTION
-- +goose Up

-- Un CONCURRENTLY interrompu laisse un index INVALID : la reprise le supprime avant de le refaire.
DROP INDEX CONCURRENTLY IF EXISTS public."lot_export_items_assigneeId_idx";
CREATE INDEX CONCURRENTLY "lot_export_items_assigneeId_idx"
    ON public.lot_export_items ("assigneeId") WHERE "assigneeId" IS NOT NULL;

DROP INDEX CONCURRENTLY IF EXISTS public."ouvertures_fiche_closingAttemptId_idx";
CREATE INDEX CONCURRENTLY "ouvertures_fiche_closingAttemptId_idx"
    ON public.ouvertures_fiche ("closingAttemptId") WHERE "closingAttemptId" IS NOT NULL;

DROP INDEX CONCURRENTLY IF EXISTS public."audit_logs_after_prospect_id_idx";
CREATE INDEX CONCURRENTLY "audit_logs_after_prospect_id_idx"
    ON public.audit_logs ((("after"->>'prospectId'))) WHERE "entity" IN ('lot_export', 'scheduled_callback');

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS public."lot_export_items_assigneeId_idx";
DROP INDEX CONCURRENTLY IF EXISTS public."ouvertures_fiche_closingAttemptId_idx";
DROP INDEX CONCURRENTLY IF EXISTS public."audit_logs_after_prospect_id_idx";
