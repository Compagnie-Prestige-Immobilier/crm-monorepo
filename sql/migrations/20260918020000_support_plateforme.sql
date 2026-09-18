-- +goose Up
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ADMIN', 'support.plateforme'),
    ('DIRECTION', 'support.plateforme'),
    ('SUPERVISEUR', 'support.plateforme')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'support.plateforme';
