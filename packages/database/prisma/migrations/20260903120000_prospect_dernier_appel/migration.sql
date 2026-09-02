-- AlterTable
ALTER TABLE "prospects" ADD COLUMN     "lastCallAt" TIMESTAMP(3),
ADD COLUMN     "lastCallById" TEXT,
ADD COLUMN     "lastCallOutcome" "CallOutcome";

-- CreateIndex
CREATE INDEX "prospects_lastCallById_lastCallOutcome_idx" ON "prospects"("lastCallById", "lastCallOutcome");

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_lastCallById_fkey" FOREIGN KEY ("lastCallById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reprise : le dernier appel connu de chaque prospect.
UPDATE "prospects" p
SET "lastCallOutcome" = a."outcome",
    "lastCallAt"      = a."clientCreatedAt",
    "lastCallById"    = a."performedById"
FROM (
  SELECT DISTINCT ON ("prospectId")
    "prospectId", "outcome", "clientCreatedAt", "performedById"
  FROM "call_attempts"
  ORDER BY "prospectId", "clientCreatedAt" DESC, "id" DESC
) a
WHERE a."prospectId" = p."id";
