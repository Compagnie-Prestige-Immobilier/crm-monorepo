-- +goose Up
-- L'observateur n'ouvre que le panneau : l'ADMIN coche ce qu'il lit.
INSERT INTO public.roles ("id", "libelle", "roleDeBase", "systeme")
VALUES ('OBSERVATEUR', 'Observateur', 'OBSERVATEUR', true)
ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions ("roleId", "permission")
VALUES ('OBSERVATEUR', 'panneau.acceder')
ON CONFLICT DO NOTHING;

-- Permissions accordées à un compte en plus de celles de son rôle ; jamais un retrait.
CREATE TABLE public.user_permissions (
    "userId" text NOT NULL REFERENCES public.users ("id") ON DELETE CASCADE,
    "permission" text NOT NULL,
    "accordePar" text REFERENCES public.users ("id") ON DELETE SET NULL,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("userId", "permission")
);

-- +goose Down
DROP TABLE public.user_permissions;
DELETE FROM public.roles WHERE "id" = 'OBSERVATEUR';
