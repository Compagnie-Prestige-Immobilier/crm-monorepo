-- +goose Up
-- Un 500 de Brevo perdait le courriel définitivement : le statut passait à
-- ECHEC et rien ne le reprenait. Le compteur borne le rejeu à trois passages.
ALTER TABLE public.courriels ADD COLUMN tentatives integer DEFAULT 0 NOT NULL;
CREATE INDEX courriels_rejeu_idx ON public.courriels ("statut", "tentatives")
  WHERE "statut" = 'ECHEC';

-- +goose Down
DROP INDEX public.courriels_rejeu_idx;
ALTER TABLE public.courriels DROP COLUMN tentatives;
