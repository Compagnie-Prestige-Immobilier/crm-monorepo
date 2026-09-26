-- +goose NO TRANSACTION
-- +goose Up

-- Pendant de prospects_nom_prenom_unaccent_trgm : sans lui, chercher « prénom nom » parcourt toute la table.
DROP INDEX CONCURRENTLY IF EXISTS public.prospects_prenom_nom_unaccent_trgm;
CREATE INDEX CONCURRENTLY prospects_prenom_nom_unaccent_trgm ON public.prospects
    USING gin (public.immutable_unaccent(lower(prenom) || ' ' || lower(nom)) public.gin_trgm_ops);

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS public.prospects_prenom_nom_unaccent_trgm;
