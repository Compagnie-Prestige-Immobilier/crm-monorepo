-- +goose NO TRANSACTION
-- +goose Up

-- Effacer une inscription liée coupait le lien du dossier bancaire, qui redevenait « à ouvrir ».
ALTER TABLE public.bank_cases
    DROP CONSTRAINT IF EXISTS "bank_cases_inscriptionId_fkey",
    ADD CONSTRAINT "bank_cases_inscriptionId_fkey" FOREIGN KEY ("inscriptionId")
        REFERENCES public.inscriptions_plateforme(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.bank_cases VALIDATE CONSTRAINT "bank_cases_inscriptionId_fkey";

-- +goose Down
ALTER TABLE public.bank_cases
    DROP CONSTRAINT IF EXISTS "bank_cases_inscriptionId_fkey",
    ADD CONSTRAINT "bank_cases_inscriptionId_fkey" FOREIGN KEY ("inscriptionId")
        REFERENCES public.inscriptions_plateforme(id) ON DELETE SET NULL;
