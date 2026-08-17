-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('REPRESENTANTS', 'PROSPECTS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "ImportMode" AS ENUM ('DRY_RUN', 'APPLY');

-- CreateEnum
CREATE TYPE "ChangeSource" AS ENUM ('WEB', 'MOBILE');

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "kind" "ImportKind" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'queued',
    "mode" "ImportMode" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "totalRows" INTEGER,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "report" JSONB,
    "failureCode" TEXT,
    "failureMsg" TEXT,
    "claimToken" TEXT,
    "claimedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segment_changes" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "fromSegment" "BddSegment" NOT NULL,
    "toSegment" "BddSegment" NOT NULL,
    "fromBanqueId" TEXT NOT NULL,
    "toBanqueId" TEXT NOT NULL,
    "fromSyndicatId" TEXT NOT NULL,
    "toSyndicatId" TEXT NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "source" "ChangeSource" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "segment_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_jobs_kind_status_createdAt_idx" ON "import_jobs"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "import_jobs_requestedById_createdAt_idx" ON "import_jobs"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "import_jobs_status_claimedAt_idx" ON "import_jobs"("status", "claimedAt");

-- CreateIndex
CREATE INDEX "import_jobs_isDemo_idx" ON "import_jobs"("isDemo");

-- CreateIndex
CREATE INDEX "segment_changes_prospectId_changedAt_idx" ON "segment_changes"("prospectId", "changedAt");

-- CreateIndex
CREATE INDEX "segment_changes_toSegment_changedAt_idx" ON "segment_changes"("toSegment", "changedAt");

-- CreateIndex
CREATE INDEX "segment_changes_changedById_changedAt_idx" ON "segment_changes"("changedById", "changedAt");

-- CreateIndex
CREATE INDEX "segment_changes_isDemo_idx" ON "segment_changes"("isDemo");

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_changes" ADD CONSTRAINT "segment_changes_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_changes" ADD CONSTRAINT "segment_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
