-- +goose Up

UPDATE public.call_outcome_reasons SET "effect" = 'CLOSE_UNREACHABLE', "updatedAt" = now()
WHERE "code" IN ('MESSAGERIE', 'PAS_DE_REPONSE', 'AUTRE_NON_JOINT');
UPDATE public.call_outcome_reasons SET "effect" = 'CLOSE_INTERESTED', "updatedAt" = now()
WHERE "code" IN ('INTERESSE', 'TERRAIN', 'VILLA', 'CONSTRUCTION', 'FORMALITES_DOMANIALES');
UPDATE public.call_outcome_reasons SET "effect" = 'CLOSE_HESITANT', "updatedAt" = now()
WHERE "code" = 'HESITANT';
UPDATE public.call_outcome_reasons SET "effect" = 'CLOSE_REACHED', "updatedAt" = now()
WHERE "code" IN ('DEMANDE_INFORMATION', 'PARTENARIAT');
UPDATE public.call_outcome_reasons SET "effect" = 'CLOSE_APPOINTMENT', "updatedAt" = now()
WHERE "code" IN ('RENDEZ_VOUS', 'RV_CPI', 'RV_SITE', 'RV_EXTERNE', 'RDV_TELEPHONIQUE');
UPDATE public.call_outcome_reasons SET "label" = 'À supprimer · Farceur / Non sérieux', "updatedAt" = now()
WHERE "code" = 'A_SUPPRIMER';

-- Les appels consignés sous un ancien statut prennent celui choisi par les équipes.
UPDATE public.call_attempts a SET "reasonId" = nouveau."id"
FROM public.call_outcome_reasons ancien,
     (VALUES ('TELEPHONE_INDISPONIBLE', 'MESSAGERIE'), ('UNREACHABLE', 'PAS_DE_REPONSE'),
             ('NUMERO_OCCUPE', 'PAS_DE_REPONSE'), ('INJOIGNABLE_DEFINITIF', 'PAS_DE_REPONSE'),
             ('AUTRES', 'PAS_INTERESSE'), ('HORS_CIBLE', 'PAS_INTERESSE'),
             ('REFUS_NE_VEUT_PAS', 'PAS_INTERESSE'), ('REFUS_DEJA_ENGAGE', 'PAS_INTERESSE'),
             ('OTHER', 'PAS_INTERESSE'), ('REFUSED', 'PAS_INTERESSE'),
             ('REFUS_PAS_POUR_LE_MOMENT', 'HESITANT'), ('REFUS_PAS_CONFIANCE', 'HESITANT'),
             ('REFUS_MEFIANT', 'HESITANT'), ('TRANSFERT_ENROLEMENT', 'INTERESSE'),
             ('METHOD_OBTAINED', 'INTERESSE'), ('RDV_AGENCE', 'RV_CPI')) AS reprise(ancien, nouveau),
     public.call_outcome_reasons nouveau
WHERE ancien."code" = reprise.ancien AND nouveau."code" = reprise.nouveau
  AND a."reasonId" = ancien."id";

-- La famille de chaque appel suit son statut ; une méthode saisie reste une adhésion.
UPDATE public.call_attempts a SET "outcome" = CASE
    WHEN a."method" IS NOT NULL THEN 'METHOD_OBTAINED'
    WHEN r."effect" IN ('CLOSE_UNREACHABLE') THEN 'UNREACHABLE'
    WHEN r."effect" = 'KEEP_OPEN' AND NOT r."countsAsReached" THEN 'UNREACHABLE'
    WHEN r."effect" IN ('CLOSE_REFUSED', 'CLOSE_LOST') THEN 'REFUSED'
    WHEN r."effect" = 'CLOSE_WRONG_NUMBER' THEN 'WRONG_NUMBER'
    WHEN r."effect" IN ('SCHEDULE_CALLBACK', 'CLOSE_APPOINTMENT') THEN 'CALLBACK'
    WHEN r."effect" = 'CLOSE_METHOD' THEN 'METHOD_OBTAINED'
    ELSE 'OTHER' END::public."CallOutcome"
FROM public.call_outcome_reasons r
WHERE r."id" = a."reasonId"
  AND a."outcome" IS DISTINCT FROM (CASE
    WHEN a."method" IS NOT NULL THEN 'METHOD_OBTAINED'
    WHEN r."effect" IN ('CLOSE_UNREACHABLE') THEN 'UNREACHABLE'
    WHEN r."effect" = 'KEEP_OPEN' AND NOT r."countsAsReached" THEN 'UNREACHABLE'
    WHEN r."effect" IN ('CLOSE_REFUSED', 'CLOSE_LOST') THEN 'REFUSED'
    WHEN r."effect" = 'CLOSE_WRONG_NUMBER' THEN 'WRONG_NUMBER'
    WHEN r."effect" IN ('SCHEDULE_CALLBACK', 'CLOSE_APPOINTMENT') THEN 'CALLBACK'
    WHEN r."effect" = 'CLOSE_METHOD' THEN 'METHOD_OBTAINED'
    ELSE 'OTHER' END)::public."CallOutcome";

-- Chaque fiche déjà qualifiée se ferme sur le statut de son dernier appel.
-- Une méthode obtenue ne recule pas ; « À rappeler » laisse la fiche ouverte.
CREATE TEMP TABLE fiches_fermees ON COMMIT DROP AS
SELECT d."prospectId", d."outcome", CASE
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
      LEFT JOIN public.call_outcome_reasons r ON r."id" = a."reasonId"
      ORDER BY a."prospectId", a."clientCreatedAt" DESC, a."id" DESC) d;

UPDATE public.prospects p SET "lastCallOutcome" = f."outcome"
FROM fiches_fermees f
WHERE f."prospectId" = p."id" AND p."lastCallOutcome" IS DISTINCT FROM f."outcome";

UPDATE public.prospects p SET "phase2Status" = f.phase2::public."Phase2Status"
FROM fiches_fermees f
WHERE f."prospectId" = p."id" AND p."phase2Status" <> 'METHOD_OBTAINED'
  AND f.phase2 NOT IN ('PENDING', 'METHOD_OBTAINED') AND p."phase2Status"::text <> f.phase2;

UPDATE public.prospect_journeys j SET "phase2Status" = f.phase2::public."Phase2Status"
FROM fiches_fermees f, public.prospects p
WHERE f."prospectId" = j."prospectId" AND p."id" = j."prospectId" AND j."projet" = p."projet"
  AND j."phase2Status" <> 'METHOD_OBTAINED'
  AND f.phase2 NOT IN ('PENDING', 'METHOD_OBTAINED') AND j."phase2Status"::text <> f.phase2;

-- +goose Down

-- Pas de descente : les appels repris gardent leur nouveau statut.
