-- AlterTable
ALTER TABLE "representants" ADD COLUMN     "lastCallAt" TIMESTAMP(3),
ADD COLUMN     "lastCallById" TEXT,
ADD COLUMN     "lastCallOutcome" "RepCallOutcome",
ADD COLUMN     "nextCallbackAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "representants_lastCallById_lastCallOutcome_idx" ON "representants"("lastCallById", "lastCallOutcome");

-- CreateIndex
CREATE INDEX "representants_nextCallbackAt_idx" ON "representants"("nextCallbackAt");

-- AddForeignKey
ALTER TABLE "representants" ADD CONSTRAINT "representants_lastCallById_fkey" FOREIGN KEY ("lastCallById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reprise : le dernier appel connu de chaque représentant. Un rappel promis
-- déjà passé reste porté : la liste « à rappeler » le montre en retard.
UPDATE "representants" r
SET "lastCallOutcome" = a."outcome",
    "lastCallAt"      = a."clientCreatedAt",
    "lastCallById"    = a."performedById",
    "nextCallbackAt"  = a."callbackAt"
FROM (
  SELECT DISTINCT ON ("representantId")
    "representantId", "outcome", "clientCreatedAt", "performedById", "callbackAt"
  FROM "rep_call_attempts"
  ORDER BY "representantId", "clientCreatedAt" DESC, "id" DESC
) a
WHERE a."representantId" = r."id";
