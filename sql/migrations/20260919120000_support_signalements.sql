-- +goose Up
CREATE TABLE public.support_signalements (
    "id" text PRIMARY KEY,
    "auteurId" text NOT NULL,
    "cle" text NOT NULL,
    "empreinte" text NOT NULL,
    "description" text NOT NULL,
    "contexte" text DEFAULT ''::text NOT NULL,
    "urgence" integer NOT NULL,
    "categorie" integer NOT NULL,
    "auteurLogin" text NOT NULL,
    "auteurNom" text NOT NULL,
    "auteurEmail" text NOT NULL,
    "auteurRoleLibelle" text NOT NULL,
    "auteurPilotage" boolean DEFAULT false NOT NULL,
    "auteurGroupe" boolean DEFAULT false NOT NULL,
    "etat" text DEFAULT 'en_attente'::text NOT NULL,
    "creationEngagee" boolean DEFAULT false NOT NULL,
    "numeroGlpi" integer,
    "tentatives" integer DEFAULT 0 NOT NULL,
    "prochaineTentative" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "jeton" text,
    "prisAt" timestamp(3) without time zone,
    "numeroAt" timestamp(3) without time zone,
    "finAt" timestamp(3) without time zone,
    "codeErreur" text,
    "diagnostic" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT support_signalements_etat_check CHECK ("etat" IN ('en_attente', 'en_cours', 'reessai_planifie', 'a_verifier', 'echec', 'termine')),
    CONSTRAINT support_signalements_numero_si_termine CHECK ("etat" <> 'termine' OR "numeroGlpi" IS NOT NULL),
    CONSTRAINT support_signalements_cle_key UNIQUE ("auteurId", "cle"),
    CONSTRAINT support_signalements_auteur_fkey FOREIGN KEY ("auteurId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX support_signalements_dus_idx ON public.support_signalements ("prochaineTentative")
    WHERE "etat" IN ('en_attente', 'en_cours', 'reessai_planifie');
CREATE INDEX support_signalements_auteur_idx ON public.support_signalements ("auteurId", "createdAt" DESC);

CREATE TABLE public.support_signalement_images (
    "id" text PRIMARY KEY,
    "signalementId" text NOT NULL,
    "position" integer NOT NULL,
    "nom" text NOT NULL,
    "typeMime" text NOT NULL,
    "octets" integer NOT NULL,
    "empreinte" text NOT NULL,
    "contenu" bytea NOT NULL,
    "transmiseAt" timestamp(3) without time zone,
    "documentGlpi" integer,
    CONSTRAINT support_images_position_key UNIQUE ("signalementId", "position"),
    CONSTRAINT support_images_signalement_fkey FOREIGN KEY ("signalementId") REFERENCES public.support_signalements("id") ON UPDATE CASCADE ON DELETE CASCADE
);

-- Le dernier catalogue validé : le formulaire reste ouvrable pendant une panne GLPI.
CREATE TABLE public.support_categories (
    "id" integer PRIMARY KEY,
    "nom" text NOT NULL,
    "releveAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- +goose Down
DROP TABLE public.support_categories;
DROP TABLE public.support_signalement_images;
DROP TABLE public.support_signalements;
