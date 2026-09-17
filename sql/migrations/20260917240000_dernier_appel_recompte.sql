-- +goose Up

-- La migration de conformité lisait la famille des appels avant de la corriger :
-- une fiche gardait le « dernier appel » d'avant. Ce recompte le reprend après.
UPDATE public.prospects p SET "lastCallOutcome" = d."outcome"
FROM (SELECT DISTINCT ON (a."prospectId") a."prospectId", a."outcome"
      FROM public.call_attempts a
      ORDER BY a."prospectId", a."clientCreatedAt" DESC, a."id" DESC) d
WHERE d."prospectId" = p."id" AND p."lastCallOutcome" IS DISTINCT FROM d."outcome";

-- +goose Down

-- Pas de descente : le dernier appel recompté est celui que le serveur écrirait.
