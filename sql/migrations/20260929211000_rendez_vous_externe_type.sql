-- +goose Up
ALTER TABLE public.call_attempts
    ADD COLUMN "rvExterneType" text
        CHECK ("rvExterneType" IN ('PERSONNE', 'COOPERATIVE', 'ENTREPRISE', 'VISITE_BIEN', 'AUTRE')),
    ADD COLUMN "rvExternePrecision" text;

-- +goose Down
ALTER TABLE public.call_attempts
    DROP COLUMN "rvExterneType",
    DROP COLUMN "rvExternePrecision";
