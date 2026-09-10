-- +goose Up
ALTER TABLE public.bank_cases ADD COLUMN "inscriptionId" text REFERENCES public.inscriptions_plateforme(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX bank_cases_inscription_unique ON public.bank_cases ("inscriptionId")
  WHERE "inscriptionId" IS NOT NULL AND "deletedAt" IS NULL;

ALTER TABLE public.inscriptions_plateforme ADD COLUMN "completeSignaleeLe" timestamp(3) without time zone;

CREATE TABLE public.references_bancaires (
    projet public."Projet" NOT NULL,
    annee integer NOT NULL,
    dernier integer DEFAULT 0 NOT NULL,
    PRIMARY KEY (projet, annee)
);

CREATE TABLE public.courriels (
    id text NOT NULL PRIMARY KEY,
    type text NOT NULL,
    sujet text NOT NULL,
    destinataires text[] NOT NULL,
    copies text[] DEFAULT ARRAY[]::text[] NOT NULL,
    "objetType" text NOT NULL,
    "objetId" text NOT NULL,
    html text NOT NULL,
    texte text NOT NULL,
    "nomPieceJointe" text,
    "pieceJointe" bytea,
    statut text NOT NULL,
    "messageId" text,
    erreur text,
    "envoyeLe" timestamp(3) without time zone,
    "remisLe" timestamp(3) without time zone,
    "ouvertLe" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX courriels_objet_idx ON public.courriels ("objetType", "objetId", "createdAt" DESC);
CREATE INDEX courriels_message_idx ON public.courriels ("messageId");
CREATE TRIGGER set_updated_at BEFORE INSERT OR UPDATE ON public.courriels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- +goose Down
DROP TABLE public.courriels;
DROP TABLE public.references_bancaires;
ALTER TABLE public.inscriptions_plateforme DROP COLUMN "completeSignaleeLe";
DROP INDEX public.bank_cases_inscription_unique;
ALTER TABLE public.bank_cases DROP COLUMN "inscriptionId";
