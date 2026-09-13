-- +goose Up

-- Les leads des réseaux sociaux arrivent sans numéro : Messenger ne donne qu'un
-- nom. L'index unique reste, et ignore les NULL : deux fiches sans numéro ne se
-- heurtent pas, et celles qui en portent un se dédoublonnent toujours.
ALTER TABLE public.prospects ALTER COLUMN "phoneE164" DROP NOT NULL;

-- Meta ne distingue pas les deux réseaux dans ses exports, et Messenger est un
-- canal à lui seul : sans ces deux lignes, chaque lead du fichier est refusé
-- sur une provenance inconnue.
INSERT INTO public.canaux_provenance ("id", "code", "label", "position", "updatedAt")
VALUES (gen_random_uuid()::text, 'FACEBOOK_INSTAGRAM', 'Facebook / Instagram', 35, now()),
       (gen_random_uuid()::text, 'MESSENGER', 'Messenger', 45, now())
ON CONFLICT DO NOTHING;

-- +goose Down

-- L'index unique porte sur les fiches vivantes : une même chaîne vide pour
-- toutes les fiches sans numéro ferait échouer le retour en arrière.
UPDATE public.prospects SET "phoneE164" = 'SANS-NUMERO-' || "id" WHERE "phoneE164" IS NULL;
ALTER TABLE public.prospects ALTER COLUMN "phoneE164" SET NOT NULL;
