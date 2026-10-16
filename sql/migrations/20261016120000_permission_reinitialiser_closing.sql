-- +goose Up
-- Remettre à zéro un closing ne revient qu'à l'administrateur ; les autres rôles le reçoivent par l'écran des rôles.
INSERT INTO public.role_permissions ("roleId", "permission")
SELECT "id", 'rendez_vous.reinitialiser_closing' FROM public.roles WHERE "id" = 'ADMIN'
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'rendez_vous.reinitialiser_closing';
DELETE FROM public.user_permissions WHERE "permission" = 'rendez_vous.reinitialiser_closing';
