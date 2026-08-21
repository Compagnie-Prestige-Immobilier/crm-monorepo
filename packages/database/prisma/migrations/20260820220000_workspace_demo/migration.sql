DO $$
DECLARE
  table_name text;
  remaining bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'representants', 'prospects', 'call_campaigns', 'call_tasks',
    'call_attempts', 'scheduled_callbacks', 'rep_call_campaigns', 'rep_call_tasks',
    'rep_call_attempts', 'client_creation_requests', 'bank_cases',
    'bank_case_transitions', 'device_tokens', 'notification_templates',
    'notifications', 'notification_deliveries', 'representant_comments',
    'representant_suggestions', 'representant_relation_changes', 'import_jobs',
    'segment_changes', 'visites'
  ]
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE "isDemo" = TRUE', table_name)
      INTO remaining;
    IF remaining > 0 THEN
      RAISE EXCEPTION 'Purge demo requise avant migration: % contient % ligne(s)',
        table_name, remaining;
    END IF;
  END LOOP;
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
