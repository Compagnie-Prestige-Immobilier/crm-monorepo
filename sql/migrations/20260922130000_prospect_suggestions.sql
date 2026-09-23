-- +goose Up
CREATE TABLE public.prospect_suggestions (
    id text NOT NULL,
    "sourceProspectId" text NOT NULL,
    "suggestedName" text,
    "suggestedPhoneE164" text NOT NULL,
    note text,
    "suggestedById" text NOT NULL,
    "resolvedProspectId" text,
    "sourceAttemptId" text NOT NULL,
    status public."SuggestionStatus" DEFAULT 'A_APPELER'::public."SuggestionStatus" NOT NULL,
    "clientCreatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    CONSTRAINT prospect_suggestions_pkey PRIMARY KEY (id),
    CONSTRAINT "prospect_suggestions_sourceProspectId_fkey" FOREIGN KEY ("sourceProspectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "prospect_suggestions_resolvedProspectId_fkey" FOREIGN KEY ("resolvedProspectId") REFERENCES public.prospects(id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT "prospect_suggestions_sourceAttemptId_fkey" FOREIGN KEY ("sourceAttemptId") REFERENCES public.call_attempts(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "prospect_suggestions_suggestedById_fkey" FOREIGN KEY ("suggestedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Plusieurs recommandations peuvent naître du même appel : contrairement à
-- representant_suggestions, sourceAttemptId n'est pas unique ici.
CREATE INDEX "prospect_suggestions_sourceProspectId_createdAt_idx" ON public.prospect_suggestions USING btree ("sourceProspectId", "createdAt");
CREATE INDEX "prospect_suggestions_status_createdAt_idx" ON public.prospect_suggestions USING btree (status, "createdAt");
CREATE INDEX "prospect_suggestions_suggestedPhoneE164_idx" ON public.prospect_suggestions USING btree ("suggestedPhoneE164");
CREATE INDEX "prospect_suggestions_sourceAttemptId_idx" ON public.prospect_suggestions USING btree ("sourceAttemptId");

-- Un contact recommandé matérialisé en fiche porte cette origine : sans elle,
-- impossible de le retrouver dans le tableau ou l'export sans rejouer la jointure.
ALTER TABLE public.prospects DROP CONSTRAINT prospects_origin_known;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_origin_known
    CHECK (((origin IS NULL) OR (origin = ANY (ARRAY['BANQUE'::text, 'FORMULAIRE_PUBLIC'::text, 'PARRAINAGE'::text]))));

-- +goose Down
ALTER TABLE public.prospects DROP CONSTRAINT prospects_origin_known;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_origin_known
    CHECK (((origin IS NULL) OR (origin = ANY (ARRAY['BANQUE'::text, 'FORMULAIRE_PUBLIC'::text]))));
DROP TABLE public.prospect_suggestions;
