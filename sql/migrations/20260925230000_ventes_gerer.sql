-- +goose Up
-- Lire les ventes ne suffit plus pour les écrire : saisie, classeur, sites et canaux.
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ADMIN', 'ventes.gerer'),
    ('DIRECTION', 'ventes.gerer')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'ventes.gerer';
