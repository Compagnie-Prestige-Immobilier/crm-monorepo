-- +goose Up

-- Le navigateur décidait la famille de l'appel et le serveur acceptait la
-- sienne : des appels où la personne a répondu (motif joint, fiche gardée
-- ouverte) dorment en « Injoignable ». Le serveur dérive la famille du motif
-- depuis le 2026-09-15 ; ceci aligne ce qui a été consigné avant.
UPDATE public.call_attempts a SET "outcome" = 'OTHER'
FROM public.call_outcome_reasons r
WHERE r."id" = a."reasonId"
  AND a."outcome" = 'UNREACHABLE'
  AND r."effect" = 'KEEP_OPEN'
  AND r."countsAsReached";

UPDATE public.prospects p SET "lastCallOutcome" = d."outcome"
FROM (SELECT DISTINCT ON ("prospectId") "prospectId", "outcome"
      FROM public.call_attempts
      ORDER BY "prospectId", "clientCreatedAt" DESC, "id" DESC) d
WHERE d."prospectId" = p."id"
  AND p."lastCallOutcome" IS DISTINCT FROM d."outcome";

-- +goose Down
-- Pas de revert : la famille corrigée est celle que le serveur écrirait aujourd'hui.
