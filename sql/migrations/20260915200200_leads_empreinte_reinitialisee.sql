-- +goose Up

-- Le classeur SharePoint n'a pas changé, l'importeur si : sans cette ligne le
-- relevé horaire le tiendrait pour déjà lu. Ce relevé-là ne crée rien de neuf :
-- il ne part pas en courriel.
DELETE FROM public.app_settings WHERE "key" = 'imports.leadsEmpreinte';
INSERT INTO public.app_settings ("key", "value", "updatedAt")
VALUES ('imports.leadsReleveSilencieux', '1', now())
ON CONFLICT ("key") DO NOTHING;

-- +goose Down
-- Pas de revert : l'empreinte se repose au prochain relevé.
DELETE FROM public.app_settings WHERE "key" = 'imports.leadsReleveSilencieux';
