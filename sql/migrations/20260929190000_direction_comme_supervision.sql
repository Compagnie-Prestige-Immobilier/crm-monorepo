-- +goose Up
-- La direction a au moins tout ce que la supervision a, y compris ce qu'un ADMIN y a ajouté.
INSERT INTO public.role_permissions ("roleId", "permission")
SELECT 'DIRECTION', "permission" FROM public.role_permissions WHERE "roleId" = 'SUPERVISEUR'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('SUPERVISEUR', 'accueil.registre'),
    ('SUPERVISEUR', 'accueil.listes'),
    ('SUPERVISEUR', 'rendez_vous.suivre'),
    ('SUPERVISEUR', 'rendez_vous.voir'),
    ('SUPERVISEUR', 'rendez_vous.closer'),
    ('SUPERVISEUR', 'rendez_vous.exporter'),
    ('SUPERVISEUR', 'visites.voir_archivees')
ON CONFLICT DO NOTHING;

-- Le segment ne s'affichait qu'aux rôles de base ADMIN et COMMERCIAL : la permission reprend ce périmètre.
INSERT INTO public.role_permissions ("roleId", "permission")
SELECT "id", 'fiches.voir_segment' FROM public.roles WHERE "roleDeBase" IN ('ADMIN', 'COMMERCIAL')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'fiches.voir_segment';
DELETE FROM public.role_permissions
WHERE "roleId" = 'SUPERVISEUR' AND "permission" IN (
    'accueil.registre', 'accueil.listes', 'rendez_vous.suivre', 'rendez_vous.voir',
    'rendez_vous.closer', 'rendez_vous.exporter', 'visites.voir_archivees'
);
