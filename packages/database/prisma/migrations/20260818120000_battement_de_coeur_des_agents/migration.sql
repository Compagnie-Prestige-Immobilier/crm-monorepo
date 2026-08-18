-- CreateTable
CREATE TABLE "agent_heartbeats" (
    "userId" TEXT NOT NULL,
    "lastPullAt" TIMESTAMP(3),
    "lastPushAt" TIMESTAMP(3),
    "pendingOps" INTEGER,
    "appVersion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_heartbeats_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "agent_heartbeats" ADD CONSTRAINT "agent_heartbeats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
