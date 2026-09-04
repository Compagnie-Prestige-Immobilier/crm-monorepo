CREATE TABLE "device_call_detections" (
  "id" TEXT NOT NULL,
  "performedById" TEXT NOT NULL,
  "representantId" TEXT,
  "prospectId" TEXT,
  "deviceCallType" TEXT NOT NULL,
  "deviceCallDurationSeconds" INTEGER NOT NULL,
  "deviceCallAt" TIMESTAMP(3) NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL,
  "attemptId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_call_detections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "device_call_detections_performedById_deviceCallAt_idx"
  ON "device_call_detections"("performedById", "deviceCallAt");
CREATE INDEX "device_call_detections_representantId_deviceCallAt_idx"
  ON "device_call_detections"("representantId", "deviceCallAt");
CREATE INDEX "device_call_detections_prospectId_deviceCallAt_idx"
  ON "device_call_detections"("prospectId", "deviceCallAt");

ALTER TABLE "device_call_detections"
  ADD CONSTRAINT "device_call_detections_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "device_call_detections"
  ADD CONSTRAINT "device_call_detections_representantId_fkey"
  FOREIGN KEY ("representantId") REFERENCES "representants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "device_call_detections"
  ADD CONSTRAINT "device_call_detections_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
