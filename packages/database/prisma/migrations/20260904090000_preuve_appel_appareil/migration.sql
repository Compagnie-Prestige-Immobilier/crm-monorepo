ALTER TABLE "call_attempts"
  ADD COLUMN "deviceCallType" TEXT,
  ADD COLUMN "deviceCallDurationSeconds" INTEGER,
  ADD COLUMN "deviceCallAt" TIMESTAMP(3);

ALTER TABLE "rep_call_attempts"
  ADD COLUMN "deviceCallType" TEXT,
  ADD COLUMN "deviceCallDurationSeconds" INTEGER,
  ADD COLUMN "deviceCallAt" TIMESTAMP(3);
