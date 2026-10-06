-- +goose Up
-- La fiche ouverte pour le rendez-vous d'un représentant porte cette origine.
ALTER TABLE public.prospects DROP CONSTRAINT prospects_origin_known;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_origin_known
    CHECK (((origin IS NULL) OR (origin = ANY (ARRAY['BANQUE'::text, 'FORMULAIRE_PUBLIC'::text, 'PARRAINAGE'::text, 'REPRESENTANT'::text]))));

-- +goose Down
ALTER TABLE public.prospects DROP CONSTRAINT prospects_origin_known;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_origin_known
    CHECK (((origin IS NULL) OR (origin = ANY (ARRAY['BANQUE'::text, 'FORMULAIRE_PUBLIC'::text, 'PARRAINAGE'::text]))));
