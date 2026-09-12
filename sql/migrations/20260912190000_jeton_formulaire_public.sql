-- +goose Up
-- Le lien public portait l'identifiant du compte : il ne se révoquait qu'en
-- désactivant le compte. Un jeton propre se régénère sans toucher au compte.
-- Le défaut en base le pose aussi pour tout compte créé ensuite, sans quoi le
-- lien d'un nouveau téléconseiller serait vide.
ALTER TABLE public.users ADD COLUMN "formulaireJeton" text
  NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');
CREATE UNIQUE INDEX users_formulaire_jeton_key ON public.users ("formulaireJeton");

-- +goose Down
DROP INDEX public.users_formulaire_jeton_key;
ALTER TABLE public.users DROP COLUMN "formulaireJeton";
