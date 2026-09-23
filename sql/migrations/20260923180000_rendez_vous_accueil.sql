-- +goose Up
-- Le comptoir reçoit les prospects convoqués : il voit leurs rendez-vous, note
-- qui s'est présenté, et emporte la liste. La Direction suit la même chose.
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ACCUEIL', 'rendez_vous.voir'),
    ('ACCUEIL', 'rendez_vous.suivre'),
    ('ACCUEIL', 'rendez_vous.exporter'),
    ('DIRECTION', 'rendez_vous.voir'),
    ('DIRECTION', 'rendez_vous.exporter')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions
WHERE ("roleId" = 'ACCUEIL' AND "permission" IN ('rendez_vous.voir', 'rendez_vous.suivre', 'rendez_vous.exporter'))
   OR ("roleId" = 'DIRECTION' AND "permission" IN ('rendez_vous.voir', 'rendez_vous.exporter'));
