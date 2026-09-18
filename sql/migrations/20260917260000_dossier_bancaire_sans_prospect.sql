-- +goose Up

-- Le dossier bancaire naît d'une inscription validée sur la plateforme. Les
-- plateformes portent seules le suivi de leurs inscrits : le CRM n'a plus de
-- fiche à leur opposer, et le dossier garde déjà le nom et le numéro du client.
ALTER TABLE public.bank_cases ALTER COLUMN "prospectId" DROP NOT NULL;
ALTER TABLE public.bank_cases DROP CONSTRAINT "bank_cases_prospectId_fkey";
ALTER TABLE public.bank_cases
    ADD CONSTRAINT "bank_cases_prospectId_fkey" FOREIGN KEY ("prospectId")
    REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Une demande approuvée garde son approbation quand la fiche qu'elle a créée
-- disparaît ensuite.
ALTER TABLE public.client_creation_requests
    DROP CONSTRAINT client_creation_requests_approved_has_prospect;
ALTER TABLE public.client_creation_requests
    DROP CONSTRAINT "client_creation_requests_createdProspectId_fkey";
ALTER TABLE public.client_creation_requests
    ADD CONSTRAINT "client_creation_requests_createdProspectId_fkey" FOREIGN KEY ("createdProspectId")
    REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- +goose Down
ALTER TABLE public.client_creation_requests
    DROP CONSTRAINT "client_creation_requests_createdProspectId_fkey";
ALTER TABLE public.client_creation_requests
    ADD CONSTRAINT "client_creation_requests_createdProspectId_fkey" FOREIGN KEY ("createdProspectId")
    REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.client_creation_requests
    ADD CONSTRAINT client_creation_requests_approved_has_prospect
    CHECK ((status <> 'APPROVED'::public."ClientRequestStatus") OR ("createdProspectId" IS NOT NULL));

ALTER TABLE public.bank_cases DROP CONSTRAINT "bank_cases_prospectId_fkey";
ALTER TABLE public.bank_cases
    ADD CONSTRAINT "bank_cases_prospectId_fkey" FOREIGN KEY ("prospectId")
    REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.bank_cases ALTER COLUMN "prospectId" SET NOT NULL;
