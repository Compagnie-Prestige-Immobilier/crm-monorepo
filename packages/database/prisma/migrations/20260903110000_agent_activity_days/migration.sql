CREATE TABLE "agent_activity_days" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "agent_activity_days_pkey" PRIMARY KEY ("userId", "day")
);

CREATE INDEX "agent_activity_days_day_idx" ON "agent_activity_days"("day");

ALTER TABLE "agent_activity_days" ADD CONSTRAINT "agent_activity_days_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
