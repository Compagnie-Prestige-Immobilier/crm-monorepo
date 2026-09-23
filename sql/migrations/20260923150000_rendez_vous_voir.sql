-- +goose Up
-- Le comptoir accueille les prospects convoqués par téléphone : il lui faut la
-- liste des rendez-vous, sans lui ouvrir les fiches pour autant.
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ADMIN', 'rendez_vous.voir')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'rendez_vous.voir';
