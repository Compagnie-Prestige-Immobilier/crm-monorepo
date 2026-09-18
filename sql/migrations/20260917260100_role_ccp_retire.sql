-- +goose Up

-- Le suivi des inscrits des plateformes se fait désormais sur les plateformes.
-- Les comptes qui le portaient ici sont fermés ; leur historique d'appels reste
-- sur les fiches.
INSERT INTO public.audit_logs ("id", "userId", "action", "entity", "entityId", "before", "after")
SELECT gen_random_uuid()::text, NULL, 'user.role_ccp_retire', 'user', u."id",
       jsonb_build_object('role', u."role", 'roleId', u."roleId", 'isActive', u."isActive"),
       jsonb_build_object('role', 'CHARGE_CLIENTELE', 'roleId', 'CHARGE_CLIENTELE', 'isActive', false)
FROM public.users u WHERE u."role" = 'CCP';

UPDATE public.users SET "isActive" = false, "role" = 'CHARGE_CLIENTELE' WHERE "role" = 'CCP';

DELETE FROM public.roles WHERE "roleDeBase" = 'CCP';

DELETE FROM public.role_permissions
WHERE "permission" IN ('plateforme.equipe', 'plateforme.saisir', 'plateforme.voir');

-- La valeur 'CCP' reste dans l'enum public."Role" : PostgreSQL ne sait pas
-- retirer une valeur d'enum. Plus aucun compte ni rôle ne la porte.

-- +goose Down

-- Les comptes fermés ne se rouvrent pas au hasard : le rôle système renaît seul.
INSERT INTO public.roles ("id", "libelle", "roleDeBase", "systeme")
VALUES ('CCP', 'Chargé de clientèle plateforme', 'CCP', true)
ON CONFLICT ("id") DO NOTHING;
