-- +goose Up

-- Les appels sans statut ni motif prennent le référentiel le plus proche de
-- leur ancienne issue : l'effet du référentiel devient la seule vérité.
-- Un appel représentant reprend d'abord le statut posé sur la fiche quand son
-- effet est de la même famille, sinon le statut générique de cette famille.
UPDATE public.rep_call_attempts a SET "statutQualificationId" = r."statutQualificationId"
FROM (VALUES ('REACHED', 'REACHED'), ('PROSPECTS_PROMISED', 'REACHED'), ('OTHER', 'REACHED'),
             ('REFUSED', 'REFUSED'), ('CALLBACK', 'SCHEDULE_CALLBACK'), ('UNREACHABLE', 'UNREACHABLE'),
             ('WRONG_NUMBER', 'WRONG_NUMBER')) AS reprise(issue, effet),
     public.representants r JOIN public.statuts_qualification s ON s."id" = r."statutQualificationId"
WHERE a."statutQualificationId" IS NULL AND a."representantId" = r."id"
  AND a."outcome"::text = reprise.issue AND s."effect"::text = reprise.effet;

UPDATE public.rep_call_attempts a SET "statutQualificationId" = s."id"
FROM (VALUES ('REACHED', 'AUTRE_JOINT'), ('PROSPECTS_PROMISED', 'AUTRE_JOINT'), ('OTHER', 'AUTRE_JOINT'),
             ('REFUSED', 'REFUSE'), ('CALLBACK', 'A_RAPPELER'), ('UNREACHABLE', 'AUTRE_NON_JOINT'),
             ('WRONG_NUMBER', 'FAUX_NUMERO')) AS reprise(issue, code),
     public.statuts_qualification s
WHERE a."statutQualificationId" IS NULL AND a."outcome"::text = reprise.issue AND s."code" = reprise.code;

UPDATE public.representants r SET "statutQualificationId" = d."statutQualificationId"
FROM (SELECT DISTINCT ON ("representantId") "representantId", "statutQualificationId"
      FROM public.rep_call_attempts ORDER BY "representantId", "clientCreatedAt" DESC, "id" DESC) d
WHERE r."statutQualificationId" IS NULL AND d."representantId" = r."id";

UPDATE public.call_attempts a SET "reasonId" = r."id"
FROM (VALUES ('METHOD_OBTAINED', 'INTERESSE'), ('CALLBACK', 'CALLBACK'), ('UNREACHABLE', 'PAS_DE_REPONSE'),
             ('REFUSED', 'PAS_INTERESSE'), ('WRONG_NUMBER', 'WRONG_NUMBER'),
             ('OTHER', 'DEMANDE_INFORMATION')) AS reprise(issue, code),
     public.call_outcome_reasons r
WHERE a."reasonId" IS NULL AND a."outcome"::text = reprise.issue AND r."code" = reprise.code;

ALTER TABLE public.rep_call_attempts ALTER COLUMN "statutQualificationId" SET NOT NULL;
ALTER TABLE public.call_attempts ALTER COLUMN "reasonId" SET NOT NULL;

ALTER TABLE public.prospects ADD COLUMN "lastReasonId" text
  REFERENCES public.call_outcome_reasons("id") ON UPDATE CASCADE ON DELETE RESTRICT;
UPDATE public.prospects p SET "lastReasonId" = d."reasonId"
FROM (SELECT DISTINCT ON ("prospectId") "prospectId", "reasonId"
      FROM public.call_attempts ORDER BY "prospectId", "clientCreatedAt" DESC, "id" DESC) d
WHERE d."prospectId" = p."id";

DELETE FROM public.call_outcome_reasons r
WHERE NOT r."isActive"
  AND NOT EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."reasonId" = r."id")
  AND NOT EXISTS (SELECT 1 FROM public.prospects p WHERE p."lastReasonId" = r."id")
  AND NOT EXISTS (SELECT 1 FROM public.call_outcome_reasons e WHERE e."parentId" = r."id");

DROP INDEX IF EXISTS public."prospects_lastCallById_lastCallOutcome_idx";
DROP INDEX IF EXISTS public."representants_lastCallById_lastCallOutcome_idx";
CREATE INDEX "prospects_lastCallById_idx" ON public.prospects USING btree ("lastCallById");
CREATE INDEX "representants_lastCallById_idx" ON public.representants USING btree ("lastCallById");

ALTER TABLE public.call_attempts
  DROP CONSTRAINT IF EXISTS call_attempts_method_matches_outcome,
  DROP CONSTRAINT IF EXISTS call_attempts_other_requires_comment,
  DROP COLUMN "outcome";
ALTER TABLE public.rep_call_attempts
  DROP CONSTRAINT IF EXISTS rep_call_attempts_other_requires_comment,
  DROP CONSTRAINT IF EXISTS rep_call_attempts_promised_only_when_promised,
  DROP COLUMN "outcome",
  DROP COLUMN "promisedProspects";
ALTER TABLE public.prospects DROP COLUMN "lastCallOutcome";
ALTER TABLE public.representants DROP COLUMN "lastCallOutcome";

DROP TYPE public."RepCallOutcome";
DROP TYPE public."CallOutcome";

-- +goose Down
CREATE TYPE public."CallOutcome" AS ENUM ('METHOD_OBTAINED', 'UNREACHABLE', 'CALLBACK', 'REFUSED', 'WRONG_NUMBER', 'OTHER');
CREATE TYPE public."RepCallOutcome" AS ENUM ('REACHED', 'PROSPECTS_PROMISED', 'UNREACHABLE', 'CALLBACK', 'REFUSED', 'WRONG_NUMBER', 'OTHER');
ALTER TABLE public.call_attempts ADD COLUMN "outcome" public."CallOutcome";
ALTER TABLE public.rep_call_attempts ADD COLUMN "outcome" public."RepCallOutcome", ADD COLUMN "promisedProspects" integer;
ALTER TABLE public.prospects ADD COLUMN "lastCallOutcome" public."CallOutcome", DROP COLUMN "lastReasonId";
ALTER TABLE public.representants ADD COLUMN "lastCallOutcome" public."RepCallOutcome";
ALTER TABLE public.rep_call_attempts ALTER COLUMN "statutQualificationId" DROP NOT NULL;
ALTER TABLE public.call_attempts ALTER COLUMN "reasonId" DROP NOT NULL;
