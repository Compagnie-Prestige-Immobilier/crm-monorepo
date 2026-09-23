-- +goose Up
-- Le classeur des rendez-vous se donne à part de leur lecture : emporter la
-- liste n'est pas la consulter.
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ADMIN', 'rendez_vous.exporter')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'rendez_vous.exporter';
