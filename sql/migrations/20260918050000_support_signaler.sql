-- +goose Up
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ADMIN', 'support.signaler'),
    ('DIRECTION', 'support.signaler'),
    ('SUPERVISEUR', 'support.signaler')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'support.signaler';
