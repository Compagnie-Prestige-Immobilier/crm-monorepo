-- Le motif saisi sur le terrain, a cote de `outcome` qui reste l'effet
-- historique. Purement additif: nullable, sans defaut, et les tentatives deja
-- remontees restent lisibles telles quelles.
--
-- RESTRICT et non SET NULL: un motif reference par l'historique ne doit pas
-- s'effacer en silence. Le plan de purge supprime `callAttempts` avant
-- `callOutcomeReasons`, et le domaine « Referentiels » exige transitivement
-- « Tentatives d'appel »: l'ordre tient.

-- AlterTable
ALTER TABLE "call_attempts" ADD COLUMN     "reasonId" TEXT;

-- CreateIndex
CREATE INDEX "call_attempts_reasonId_clientCreatedAt_idx" ON "call_attempts"("reasonId", "clientCreatedAt");

-- AddForeignKey
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "call_outcome_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
