-- +goose Up
-- Le compte qui a importé une fiche n'en est pas le titulaire : la fiche est
-- à celui qui l'a appelée en dernier.
UPDATE public.prospects p SET "createdById" = p."lastCallById"
WHERE p."lastCallById" IS NOT NULL AND p."createdById" <> p."lastCallById"
  AND EXISTS (SELECT 1 FROM public.users u WHERE u."id" = p."createdById" AND u."role" = 'ADMIN');

UPDATE public.representants r SET "createdById" = r."lastCallById"
WHERE r."lastCallById" IS NOT NULL AND r."createdById" <> r."lastCallById"
  AND EXISTS (SELECT 1 FROM public.users u WHERE u."id" = r."createdById" AND u."role" = 'ADMIN');

-- +goose Down
SELECT 1;
