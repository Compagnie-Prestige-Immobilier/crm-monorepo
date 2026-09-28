-- +goose Up
-- Un report déplace le rendez-vous et le renvoie à confirmer : la date reportée
-- devient celle du rendez-vous, l'issue retombe à vide.
ALTER TABLE public.prospects
    DROP CONSTRAINT prospects_rendez_vous_reporte_date,
    ADD COLUMN "rendezVousConfirmation" text CHECK ("rendezVousConfirmation" IN ('CONFIRME', 'ANNULE'));

UPDATE public.prospects SET "rendezVousIssue" = NULL WHERE "rendezVousIssue" = 'REPORTE';

ALTER TABLE public.prospects
    DROP CONSTRAINT "prospects_rendezVousIssue_check",
    ADD CONSTRAINT prospects_rendez_vous_issue CHECK ("rendezVousIssue" IN ('HONORE', 'NON_HONORE'));

CREATE TABLE public.rendez_vous_closings (
    "prospectId" text PRIMARY KEY REFERENCES public.prospects ("id") ON DELETE CASCADE,
    "localite" text NOT NULL DEFAULT '' CHECK (length("localite") <= 120),
    "superficie" text NOT NULL DEFAULT '' CHECK (length("superficie") <= 120),
    "natureJuridique" text NOT NULL DEFAULT '' CHECK (length("natureJuridique") <= 120),
    "etatSite" text NOT NULL DEFAULT '' CHECK (length("etatSite") <= 120),
    "position" text NOT NULL DEFAULT '' CHECK (length("position") <= 120),
    "auNomDe" text NOT NULL DEFAULT '' CHECK (length("auNomDe") <= 120),
    "pieceIdentiteVerifiee" text NOT NULL DEFAULT '' CHECK (length("pieceIdentiteVerifiee") <= 120),
    "paiementAcompte" text NOT NULL DEFAULT '' CHECK (length("paiementAcompte") <= 120),
    "origineFondsJustifiee" text NOT NULL DEFAULT '' CHECK (length("origineFondsJustifiee") <= 120),
    "freinPrincipal" text NOT NULL DEFAULT '' CHECK (length("freinPrincipal") <= 120),
    "autresPromoteurs" text NOT NULL DEFAULT '' CHECK (length("autresPromoteurs") <= 120),
    "parrain" text NOT NULL DEFAULT '' CHECK (length("parrain") <= 120),
    "chargeDeClientele" text NOT NULL DEFAULT '' CHECK (length("chargeDeClientele") <= 120),
    "prochaineAction" text NOT NULL CHECK ("prochaineAction" <> '' AND length("prochaineAction") <= 120),
    "dateRelance" date NOT NULL,
    "compteRendu" text NOT NULL DEFAULT '' CHECK (length("compteRendu") <= 4000),
    "auteurId" text NOT NULL REFERENCES public.users ("id"),
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- +goose StatementBegin
CREATE FUNCTION public.rendez_vous_etape(quand timestamp, confirmation text, issue text, clos boolean, debut_jour timestamp)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN confirmation = 'ANNULE' OR issue = 'NON_HONORE' OR (issue = 'HONORE' AND clos) THEN 'HISTORIQUE'
    WHEN issue = 'HONORE' THEN 'A_CLOSER'
    WHEN quand < debut_jour THEN 'EN_RETARD'
    WHEN confirmation = 'CONFIRME' THEN 'CONFIRMES'
    ELSE 'A_CONFIRMER'
  END
$$;
-- +goose StatementEnd

INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ADMIN', 'rendez_vous.closer'),
    ('DIRECTION', 'rendez_vous.closer'),
    ('CHARGE_CLIENTELE', 'rendez_vous.closer'),
    ('CHARGE_CLIENTELE', 'rendez_vous.voir'),
    ('CHARGE_CLIENTELE', 'accueil.registre')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions
WHERE "permission" = 'rendez_vous.closer'
   OR ("roleId" = 'CHARGE_CLIENTELE' AND "permission" IN ('rendez_vous.voir', 'accueil.registre'));
DROP FUNCTION public.rendez_vous_etape(timestamp, text, text, boolean, timestamp);
DROP TABLE public.rendez_vous_closings;
UPDATE public.prospects SET "rendezVousReporteAt" = NULL WHERE "rendezVousIssue" IS NOT NULL;
ALTER TABLE public.prospects
    DROP CONSTRAINT prospects_rendez_vous_issue,
    ADD CONSTRAINT "prospects_rendezVousIssue_check" CHECK ("rendezVousIssue" IN ('HONORE', 'NON_HONORE', 'REPORTE')),
    DROP COLUMN "rendezVousConfirmation";
UPDATE public.prospects SET "rendezVousIssue" = 'REPORTE' WHERE "rendezVousReporteAt" IS NOT NULL;
ALTER TABLE public.prospects
    ADD CONSTRAINT prospects_rendez_vous_reporte_date CHECK (("rendezVousIssue" = 'REPORTE') = ("rendezVousReporteAt" IS NOT NULL));
