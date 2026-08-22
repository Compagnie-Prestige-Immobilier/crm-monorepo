-- ═══ POURQUOI CETTE MIGRATION SUPPRIME AU LIEU DE REFUSER ═══
--
-- Sa premiere version LEVAIT s'il restait une ligne `isDemo = TRUE`, exigeant
-- que la purge soit faite avant. C'etait un blocage circulaire : la purge n'est
-- joignable que par l'API, et l'entrypoint refuse de demarrer l'API tant que les
-- migrations ne sont pas passees. Chacun attendait l'autre, et le deploiement
-- restait en 502. Constate en pre-production, pas en theorie.
--
-- Par definition, une ligne `isDemo = TRUE` est FICTIVE : la supprimer EST la
-- purge. Elle a lieu dans la transaction de la migration, donc soit tout part,
-- soit rien ne bouge.
--
-- L'ordre suit `PURGE_STEP_ORDER`, celui que la purge applicative avait deja
-- eprouve : les aretes `onDelete: Restrict` ne pardonnent pas, et un enfant
-- oublie fait echouer le lot entier plutot que de laisser un orphelin.
DO $$
DECLARE
  cible text;
  partis bigint;
  total bigint := 0;
BEGIN
  FOREACH cible IN ARRAY ARRAY[
    'bank_case_transitions', 'bank_cases',
    'call_attempts', 'scheduled_callbacks', 'call_tasks', 'call_campaigns',
    'representant_suggestions', 'rep_call_attempts', 'rep_call_tasks',
    'rep_call_campaigns',
    'client_creation_requests', 'visites',
    'representant_comments', 'representant_relation_changes', 'segment_changes',
    'import_jobs',
    'prospects', 'representants',
    'notification_deliveries', 'notifications', 'notification_templates',
    'device_tokens', 'users'
  ]
  LOOP
    EXECUTE format('DELETE FROM %I WHERE "isDemo" = TRUE', cible);
    GET DIAGNOSTICS partis = ROW_COUNT;
    total := total + partis;
    IF partis > 0 THEN
      RAISE NOTICE 'Espace demo : % ligne(s) retiree(s) de %', partis, cible;
    END IF;
  END LOOP;
  RAISE NOTICE 'Espace demo : % ligne(s) au total.', total;
END $$;

ALTER TABLE "users" DROP COLUMN "isDemo";
ALTER TABLE "representants" DROP COLUMN "isDemo";
ALTER TABLE "prospects" DROP COLUMN "isDemo";
ALTER TABLE "call_campaigns" DROP COLUMN "isDemo";
ALTER TABLE "call_tasks" DROP COLUMN "isDemo";
ALTER TABLE "call_attempts" DROP COLUMN "isDemo";
ALTER TABLE "scheduled_callbacks" DROP COLUMN "isDemo";
ALTER TABLE "rep_call_campaigns" DROP COLUMN "isDemo";
ALTER TABLE "rep_call_tasks" DROP COLUMN "isDemo";
ALTER TABLE "rep_call_attempts" DROP COLUMN "isDemo";
ALTER TABLE "client_creation_requests" DROP COLUMN "isDemo";
ALTER TABLE "bank_cases" DROP COLUMN "isDemo";
ALTER TABLE "bank_case_transitions" DROP COLUMN "isDemo";
ALTER TABLE "device_tokens" DROP COLUMN "isDemo";
ALTER TABLE "notification_templates" DROP COLUMN "isDemo";
ALTER TABLE "notifications" DROP COLUMN "isDemo";
ALTER TABLE "notification_deliveries" DROP COLUMN "isDemo";
ALTER TABLE "representant_comments" DROP COLUMN "isDemo";
ALTER TABLE "representant_suggestions" DROP COLUMN "isDemo";
ALTER TABLE "representant_relation_changes" DROP COLUMN "isDemo";
ALTER TABLE "import_jobs" DROP COLUMN "isDemo";
ALTER TABLE "segment_changes" DROP COLUMN "isDemo";
ALTER TABLE "visites" DROP COLUMN "isDemo";
DROP TABLE "demo_entities";
