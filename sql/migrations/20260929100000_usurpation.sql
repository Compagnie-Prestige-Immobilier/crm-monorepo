-- +goose Up
-- Une session ouverte par un administrateur au nom d'un autre compte.
ALTER TABLE public.refresh_tokens
    ADD COLUMN "usurpePar" text REFERENCES public.users(id) ON DELETE CASCADE;

-- +goose Down
DELETE FROM public.refresh_tokens WHERE "usurpePar" IS NOT NULL;
ALTER TABLE public.refresh_tokens DROP COLUMN "usurpePar";
