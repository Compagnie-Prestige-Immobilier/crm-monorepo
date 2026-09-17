-- +goose Up

-- Conformité après la bascule du 17 septembre 2026 : pendant le déploiement,
-- l'ancien binaire a consigné des appels avec la famille et l'état d'avant.
-- Ce rattrapage redérive famille, état et rappels depuis le statut posé, et ne
-- change rien quand tout concorde déjà.
CREATE TEMP TABLE derniers ON COMMIT DROP AS
SELECT d."prospectId", d."outcome", d."method", d."effect", CASE
    WHEN d."method" IS NOT NULL THEN 'METHOD_OBTAINED'
    WHEN d."effect" = 'CLOSE_UNREACHABLE' THEN 'UNREACHABLE'
    WHEN d."effect" = 'CLOSE_INTERESTED' THEN 'INTERESTED'
    WHEN d."effect" = 'CLOSE_HESITANT' THEN 'HESITANT'
    WHEN d."effect" = 'CLOSE_APPOINTMENT' THEN 'APPOINTMENT'
    WHEN d."effect" = 'CLOSE_REACHED' THEN 'REACHED'
    WHEN d."effect" IN ('CLOSE_REFUSED', 'CLOSE_LOST') THEN 'REFUSED'
    WHEN d."effect" = 'CLOSE_WRONG_NUMBER' THEN 'WRONG_NUMBER'
    ELSE 'PENDING' END AS phase2
FROM (SELECT DISTINCT ON (a."prospectId") a."prospectId", a."outcome", a."method", r."effect"
      FROM public.call_attempts a
      JOIN public.call_outcome_reasons r ON r."id" = a."reasonId"
      ORDER BY a."prospectId", a."clientCreatedAt" DESC, a."id" DESC) d;

UPDATE public.call_attempts a SET "outcome" = f.famille::public."CallOutcome"
FROM (SELECT a2."id", CASE
        WHEN a2."method" IS NOT NULL THEN 'METHOD_OBTAINED'
        WHEN r2."effect" = 'CLOSE_UNREACHABLE' THEN 'UNREACHABLE'
        WHEN r2."effect" = 'KEEP_OPEN' AND NOT r2."countsAsReached" THEN 'UNREACHABLE'
        WHEN r2."effect" IN ('CLOSE_REFUSED', 'CLOSE_LOST') THEN 'REFUSED'
        WHEN r2."effect" = 'CLOSE_WRONG_NUMBER' THEN 'WRONG_NUMBER'
        WHEN r2."effect" IN ('SCHEDULE_CALLBACK', 'CLOSE_APPOINTMENT') THEN 'CALLBACK'
        WHEN r2."effect" = 'CLOSE_METHOD' THEN 'METHOD_OBTAINED'
        ELSE 'OTHER' END AS famille
      FROM public.call_attempts a2 JOIN public.call_outcome_reasons r2 ON r2."id" = a2."reasonId") f
WHERE f."id" = a."id" AND a."outcome"::text <> f.famille;

UPDATE public.prospects p SET "lastCallOutcome" = d."outcome"
FROM derniers d WHERE d."prospectId" = p."id" AND p."lastCallOutcome" IS DISTINCT FROM d."outcome";

-- Une méthode d'enrôlement acquise ne recule pas.
UPDATE public.prospects p SET "phase2Status" = d.phase2::public."Phase2Status"
FROM derniers d
WHERE d."prospectId" = p."id" AND p."enrollmentMethod" IS NULL
  AND d.phase2 <> 'METHOD_OBTAINED' AND p."phase2Status"::text <> d.phase2;

UPDATE public.prospect_journeys j SET "phase2Status" = p."phase2Status"
FROM public.prospects p
WHERE p."id" = j."prospectId" AND j."projet" = p."projet"
  AND j."enrollmentMethod" IS NULL AND j."phase2Status" IS DISTINCT FROM p."phase2Status";

-- Une fiche fermée sur autre chose qu'un rendez-vous ne reste pas dans « Rappels promis ».
UPDATE public.scheduled_callbacks c SET "status" = 'DONE'
FROM public.prospects p
WHERE p."id" = c."prospectId" AND c."status" = 'PENDING'
  AND p."phase2Status"::text NOT IN ('PENDING', 'APPOINTMENT');

-- +goose Down

-- Pas de descente : l'état conforme est celui que le serveur écrirait aujourd'hui.
