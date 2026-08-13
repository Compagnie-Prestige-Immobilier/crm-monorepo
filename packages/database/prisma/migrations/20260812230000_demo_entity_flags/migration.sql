-- Keep the demo flag in the database for every entity that can be generated
-- by the demo seeder. The columns are additive so this is safe on an existing
-- development database.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "representants" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "call_campaigns" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "call_tasks" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "call_attempts" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bank_cases" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bank_case_transitions" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "users_isDemo_idx" ON "users"("isDemo");
CREATE INDEX IF NOT EXISTS "representants_isDemo_idx" ON "representants"("isDemo");
CREATE INDEX IF NOT EXISTS "prospects_isDemo_idx" ON "prospects"("isDemo");
CREATE INDEX IF NOT EXISTS "call_campaigns_isDemo_idx" ON "call_campaigns"("isDemo");
CREATE INDEX IF NOT EXISTS "call_tasks_isDemo_idx" ON "call_tasks"("isDemo");
CREATE INDEX IF NOT EXISTS "call_attempts_isDemo_idx" ON "call_attempts"("isDemo");
CREATE INDEX IF NOT EXISTS "bank_cases_isDemo_idx" ON "bank_cases"("isDemo");
CREATE INDEX IF NOT EXISTS "bank_case_transitions_isDemo_idx" ON "bank_case_transitions"("isDemo");
