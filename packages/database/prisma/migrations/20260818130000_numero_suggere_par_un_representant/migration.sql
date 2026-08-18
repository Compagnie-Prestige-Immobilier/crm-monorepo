-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('A_APPELER', 'APPELE', 'ABANDONNE');

-- CreateTable
CREATE TABLE "representant_suggestions" (
    "id" TEXT NOT NULL,
    "sourceRepresentantId" TEXT NOT NULL,
    "suggestedName" TEXT,
    "suggestedPhoneE164" TEXT NOT NULL,
    "note" TEXT,
    "suggestedById" TEXT NOT NULL,
    "resolvedRepresentantId" TEXT,
    "sourceAttemptId" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'A_APPELER',
    "clientCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "representant_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "representant_suggestions_sourceAttemptId_key" ON "representant_suggestions"("sourceAttemptId");

-- CreateIndex
CREATE INDEX "representant_suggestions_suggestedPhoneE164_idx" ON "representant_suggestions"("suggestedPhoneE164");

-- CreateIndex
CREATE INDEX "representant_suggestions_sourceRepresentantId_createdAt_idx" ON "representant_suggestions"("sourceRepresentantId", "createdAt");

-- CreateIndex
CREATE INDEX "representant_suggestions_status_createdAt_idx" ON "representant_suggestions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "representant_suggestions_isDemo_idx" ON "representant_suggestions"("isDemo");

-- AddForeignKey
ALTER TABLE "representant_suggestions" ADD CONSTRAINT "representant_suggestions_sourceRepresentantId_fkey" FOREIGN KEY ("sourceRepresentantId") REFERENCES "representants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representant_suggestions" ADD CONSTRAINT "representant_suggestions_suggestedById_fkey" FOREIGN KEY ("suggestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representant_suggestions" ADD CONSTRAINT "representant_suggestions_resolvedRepresentantId_fkey" FOREIGN KEY ("resolvedRepresentantId") REFERENCES "representants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representant_suggestions" ADD CONSTRAINT "representant_suggestions_sourceAttemptId_fkey" FOREIGN KEY ("sourceAttemptId") REFERENCES "rep_call_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
