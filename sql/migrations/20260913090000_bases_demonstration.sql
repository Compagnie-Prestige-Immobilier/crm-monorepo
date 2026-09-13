-- +goose Up
-- Les bases de démonstration se créent depuis le panneau et non par variable
-- d'environnement : sans cette table, un redéploiement les ferait disparaître
-- du sélecteur alors que la base Postgres, elle, resterait là.
CREATE TABLE public.bases_demonstration (
    nom text PRIMARY KEY,
    "baseSql" text NOT NULL UNIQUE,
    "createdById" text REFERENCES public.users(id) ON DELETE SET NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- +goose Down
DROP TABLE public.bases_demonstration;
