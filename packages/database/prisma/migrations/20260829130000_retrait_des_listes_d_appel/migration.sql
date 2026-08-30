-- Les tables de listes d'appel sont des intentions temporaires, pas des faits.
-- Les tentatives et rappels restent autonomes après cette contraction.

ALTER TABLE "call_attempts"
  DROP CONSTRAINT "call_attempts_taskId_fkey",
  DROP CONSTRAINT "call_attempts_campaignId_fkey",
  DROP COLUMN "taskId",
  DROP COLUMN "campaignId";

ALTER TABLE "scheduled_callbacks"
  DROP CONSTRAINT "scheduled_callbacks_taskId_fkey",
  DROP CONSTRAINT "scheduled_callbacks_campaignId_fkey",
  DROP COLUMN "taskId",
  DROP COLUMN "campaignId";

ALTER TABLE "rep_call_attempts"
  DROP CONSTRAINT "rep_call_attempts_taskId_fkey",
  DROP CONSTRAINT "rep_call_attempts_campaignId_fkey",
  DROP COLUMN "taskId",
  DROP COLUMN "campaignId";

DROP TABLE "call_tasks";
DROP TABLE "call_campaign_commerciaux";
DROP TABLE "call_campaigns";
DROP TABLE "rep_call_tasks";
DROP TABLE "rep_call_campaign_commerciaux";
DROP TABLE "rep_call_campaigns";

DROP TYPE "CallTaskStatus";
DROP TYPE "CampaignStatus";
DROP TYPE "CampaignScope";
