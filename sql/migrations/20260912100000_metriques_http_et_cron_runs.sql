-- +goose Up
-- La classe est le premier chiffre du statut, sauf 9 : le 401 de
-- `GET /api/v1/auth/me` que le panneau émet avant toute connexion est
-- structurel et resterait le premier poste du taux d'erreur 4xx.
CREATE TABLE public.metriques_http (
    heure timestamp(3) without time zone,
    route text,
    classe smallint CHECK (classe BETWEEN 1 AND 9),
    appels integer DEFAULT 0,
    ms_total bigint DEFAULT 0,
    seau_50 integer DEFAULT 0,
    seau_200 integer DEFAULT 0,
    seau_500 integer DEFAULT 0,
    seau_1000 integer DEFAULT 0,
    seau_3000 integer DEFAULT 0,
    seau_plus integer DEFAULT 0,
    PRIMARY KEY (heure, route, classe)
);

-- La ligne est posée au départ du passage : `fin` nulle signale un passage en
-- cours, ou interrompu par un blocage, une panique ou un redémarrage.
CREATE TABLE public.cron_runs (
    id bigserial PRIMARY KEY,
    nom text,
    debut timestamp(3) without time zone,
    fin timestamp(3) without time zone,
    duree_ms bigint,
    ok boolean,
    erreur text
);

CREATE INDEX cron_runs_nom_debut_idx ON public.cron_runs (nom, debut DESC);

-- +goose Down
DROP TABLE public.cron_runs;
DROP TABLE public.metriques_http;
