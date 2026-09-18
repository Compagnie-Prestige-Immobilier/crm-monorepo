-- +goose Up
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('DIRECTION', 'prospects.convertir')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "roleId" = 'DIRECTION' AND "permission" = 'prospects.convertir';
