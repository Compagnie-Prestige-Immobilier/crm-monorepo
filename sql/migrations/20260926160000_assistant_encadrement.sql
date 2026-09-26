-- +goose Up
-- La direction et la supervision interrogent l'assistant ; la requête libre
-- (assistant.tout_lire) reste à l'ADMIN.
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('DIRECTION', 'assistant.utiliser'),
    ('SUPERVISEUR', 'assistant.utiliser')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions
WHERE "permission" = 'assistant.utiliser' AND "roleId" IN ('DIRECTION', 'SUPERVISEUR');
