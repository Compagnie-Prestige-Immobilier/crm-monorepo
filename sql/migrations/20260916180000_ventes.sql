-- +goose Up

-- Le dernier classeur déposé fait foi : un nouveau dépôt remplace le précédent.
CREATE TABLE public.ventes_classeurs (
    "id" text PRIMARY KEY,
    "nomFichier" text NOT NULL,
    "contenu" bytea NOT NULL,
    "depuis" date,
    "importeParId" text NOT NULL REFERENCES public.users ("id"),
    "importeLe" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.ventes (
    "id" bigserial PRIMARY KEY,
    "classeurId" text NOT NULL REFERENCES public.ventes_classeurs ("id") ON DELETE CASCADE,
    "numero" integer NOT NULL,
    "canal" text NOT NULL,
    "dateSouscription" date,
    "client" text NOT NULL,
    "telephone" text NOT NULL,
    "site" text NOT NULL,
    "nombreLots" integer NOT NULL,
    "numerosLots" text NOT NULL,
    "superficie" text NOT NULL,
    "prixUnitaire" bigint NOT NULL,
    "prixTotal" bigint NOT NULL,
    "acompte" bigint NOT NULL,
    "reliquat" bigint NOT NULL,
    "partProprietaire" bigint NOT NULL,
    "partApporteur" bigint NOT NULL,
    "partCpi" bigint NOT NULL
);

CREATE TABLE public.ventes_versements (
    "venteId" bigint NOT NULL REFERENCES public.ventes ("id") ON DELETE CASCADE,
    "rang" integer NOT NULL,
    "date" date NOT NULL,
    "montant" bigint NOT NULL,
    PRIMARY KEY ("venteId", "rang")
);

-- +goose Down
DROP TABLE public.ventes_versements;
DROP TABLE public.ventes;
DROP TABLE public.ventes_classeurs;
