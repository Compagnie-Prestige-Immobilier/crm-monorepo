-- +goose Up
-- Chaque lecture prend sa propre permission, donnée à tout rôle qui la tenait par la permission d'écriture.
INSERT INTO public.role_permissions ("roleId", "permission")
SELECT "roleId", 'analytics.lire' FROM public.role_permissions WHERE "permission" = 'fiches.tenir'
UNION SELECT "roleId", 'representants.lire' FROM public.role_permissions WHERE "permission" = 'fiches.tenir'
UNION SELECT "roleId", 'banque.dossiers_lire' FROM public.role_permissions WHERE "permission" = 'banque.dossiers'
UNION SELECT "roleId", 'accueil.consulter' FROM public.role_permissions WHERE "permission" = 'accueil.registre'
UNION SELECT "roleId", 'chiffres.consulter' FROM public.role_permissions WHERE "permission" = 'chiffres.disposer'
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" IN (
    'analytics.lire', 'representants.lire', 'banque.dossiers_lire', 'accueil.consulter', 'chiffres.consulter'
);
