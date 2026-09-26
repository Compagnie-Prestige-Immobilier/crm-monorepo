-- +goose Up
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ADMIN', 'kairos.assistant'),
    ('COMMERCIAL', 'kairos.assistant'),
    ('BANQUE_FINANCE', 'kairos.assistant'),
    ('SUPERVISEUR', 'kairos.assistant'),
    ('DIRECTION', 'kairos.assistant'),
    ('ACCUEIL', 'kairos.assistant'),
    ('CHARGE_CLIENTELE', 'kairos.assistant')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'kairos.assistant';
