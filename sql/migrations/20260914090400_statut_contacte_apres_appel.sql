-- +goose Up

-- Les appels consignés avant le marquage ont laissé des fiches et parcours à
-- « Nouveau » malgré leurs tentatives : les remettre à « Contacté ».
UPDATE public.prospects SET "statut" = 'CONTACTE'
WHERE "statut" = 'NOUVEAU'
  AND EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."prospectId" = prospects."id");

UPDATE public.prospect_journeys SET "statut" = 'CONTACTE'
WHERE "statut" = 'NOUVEAU'
  AND EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."prospectId" = prospect_journeys."prospectId");

-- +goose Down

-- Rattrapage sans retour : on ne sait plus quelles fiches étaient vraiment nouvelles.
SELECT 1;
