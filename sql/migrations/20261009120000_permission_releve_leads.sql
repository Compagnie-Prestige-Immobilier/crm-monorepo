-- +goose Up
-- Le relevé des leads à la demande ne revient qu'à l'administrateur ; les autres rôles le reçoivent par l'écran des rôles.
INSERT INTO public.role_permissions ("roleId", "permission")
SELECT "id", 'imports.relever' FROM public.roles WHERE "id" = 'ADMIN'
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'imports.relever';
DELETE FROM public.user_permissions WHERE "permission" = 'imports.relever';
