-- +goose Up
-- La colonne « Canal » du classeur des leads nomme la campagne publicitaire ; seul le canal en était gardé.
ALTER TABLE public.prospects ADD COLUMN "campagneMarketing" text;

-- Voir d'où vient une fiche suit la lecture des prospects : personne ne perd ce qu'il voyait.
INSERT INTO public.role_permissions ("roleId", "permission")
SELECT "roleId", 'fiches.voir_origine' FROM public.role_permissions WHERE "permission" = 'prospects.lire'
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'fiches.voir_origine';
ALTER TABLE public.prospects DROP COLUMN "campagneMarketing";
