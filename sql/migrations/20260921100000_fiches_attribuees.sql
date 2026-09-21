-- +goose Up
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ADMIN', 'fiches.ouvrir_attribuees'),
    ('SUPERVISEUR', 'fiches.ouvrir_attribuees'),
    ('DIRECTION', 'fiches.ouvrir_attribuees')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" IN ('fiches.ouvrir_attribuees', 'fiches.consigner_attribuees');
