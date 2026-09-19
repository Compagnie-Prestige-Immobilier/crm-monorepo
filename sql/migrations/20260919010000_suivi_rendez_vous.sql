-- +goose Up
ALTER TABLE public.prospects
    ADD COLUMN "rendezVousIssue" text CHECK ("rendezVousIssue" IN ('HONORE', 'NON_HONORE', 'REPORTE')),
    ADD COLUMN "rendezVousReporteAt" timestamp(3),
    ADD COLUMN "suiteRencontre" text CHECK ("suiteRencontre" IN ('TRES_CHAUD', 'CHAUD', 'A_SUIVRE')),
    ADD CONSTRAINT prospects_rendez_vous_reporte_date CHECK (("rendezVousIssue" = 'REPORTE') = ("rendezVousReporteAt" IS NOT NULL)),
    ADD CONSTRAINT prospects_suite_si_honore CHECK ("suiteRencontre" IS NULL OR "rendezVousIssue" = 'HONORE');

INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ADMIN', 'rendez_vous.suivre'),
    ('DIRECTION', 'rendez_vous.suivre'),
    ('CHARGE_CLIENTELE', 'rendez_vous.suivre')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'rendez_vous.suivre';
ALTER TABLE public.prospects
    DROP COLUMN "rendezVousIssue", DROP COLUMN "rendezVousReporteAt", DROP COLUMN "suiteRencontre";
