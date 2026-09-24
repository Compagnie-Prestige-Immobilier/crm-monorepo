-- +goose Up
CREATE TABLE public.points_rencontre (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "code" text NOT NULL UNIQUE,
    "label" text NOT NULL UNIQUE,
    "position" integer NOT NULL DEFAULT 0,
    "isActive" boolean NOT NULL DEFAULT true,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.points_rencontre ("code", "label", "position") VALUES
    ('DEPART_CPI', 'Depart CPI', 10),
    ('ROND_POINT_YOFF', 'Rond point Yoff', 20),
    ('STADE_LSS', 'En face Stade LSS ( arret AIBD)', 30),
    ('NABIL_CHOUCAIR', 'Nabil Choucair', 40),
    ('YEUNGOULEN', 'Yeungoulen', 50),
    ('CAMBERENE', 'Camberene', 60),
    ('DALAL_JAMM', 'Dalal Jamm', 70),
    ('MALIKA', 'Malika', 80),
    ('KEUR_MASSAR', 'Keur massar', 90),
    ('APIX', 'APIX', 100),
    ('SORTIES_PEAGE', 'Sorties peage', 110);

ALTER TABLE public.call_attempts
    ADD COLUMN "siteId" text REFERENCES public.ventes_sites("id") ON DELETE RESTRICT,
    ADD COLUMN "pointRencontreId" text REFERENCES public.points_rencontre("id") ON DELETE RESTRICT,
    ADD COLUMN "pointRencontreCommentaire" text;

-- +goose Down
ALTER TABLE public.call_attempts
    DROP COLUMN "siteId",
    DROP COLUMN "pointRencontreId",
    DROP COLUMN "pointRencontreCommentaire";
DROP TABLE public.points_rencontre;
