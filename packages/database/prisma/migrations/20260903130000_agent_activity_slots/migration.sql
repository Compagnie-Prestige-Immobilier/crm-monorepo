DROP TABLE "agent_activity_days";

CREATE TABLE "agent_activity_slots" (
    "userId" TEXT NOT NULL,
    "slot" TIMESTAMP(3) NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "agent_activity_slots_pkey" PRIMARY KEY ("userId", "slot")
);

CREATE INDEX "agent_activity_slots_slot_idx" ON "agent_activity_slots"("slot");

ALTER TABLE "agent_activity_slots" ADD CONSTRAINT "agent_activity_slots_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
