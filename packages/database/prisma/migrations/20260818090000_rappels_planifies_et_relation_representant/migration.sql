-- CreateEnum
CREATE TYPE "RepresentantRelation" AS ENUM ('INCONNU', 'CONTACTE', 'AMBASSADEUR', 'REFUS');

-- CreateEnum
CREATE TYPE "ScheduledCallbackStatus" AS ENUM ('PENDING', 'DONE', 'CANCELLED', 'SUPERSEDED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERVISEUR';

-- AlterTable
ALTER TABLE "representants" ADD COLUMN     "relationStatus" "RepresentantRelation" NOT NULL DEFAULT 'INCONNU';

-- CreateTable
CREATE TABLE "scheduled_callbacks" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "taskId" TEXT,
    "campaignId" TEXT,
    "assignedToId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "sourceAttemptId" TEXT NOT NULL,
    "status" "ScheduledCallbackStatus" NOT NULL DEFAULT 'PENDING',
    "closedAttemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "scheduled_callbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "representant_relation_changes" (
    "id" TEXT NOT NULL,
    "representantId" TEXT NOT NULL,
    "fromStatus" "RepresentantRelation" NOT NULL,
    "toStatus" "RepresentantRelation" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "source" "ChangeSource" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "representant_relation_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_callbacks_sourceAttemptId_key" ON "scheduled_callbacks"("sourceAttemptId");

-- CreateIndex
CREATE INDEX "scheduled_callbacks_assignedToId_status_scheduledAt_idx" ON "scheduled_callbacks"("assignedToId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "scheduled_callbacks_prospectId_status_idx" ON "scheduled_callbacks"("prospectId", "status");

-- CreateIndex
CREATE INDEX "scheduled_callbacks_scheduledAt_status_idx" ON "scheduled_callbacks"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "scheduled_callbacks_isDemo_idx" ON "scheduled_callbacks"("isDemo");

-- CreateIndex
CREATE INDEX "representant_relation_changes_representantId_changedAt_idx" ON "representant_relation_changes"("representantId", "changedAt");

-- CreateIndex
CREATE INDEX "representant_relation_changes_toStatus_changedAt_idx" ON "representant_relation_changes"("toStatus", "changedAt");

-- CreateIndex
CREATE INDEX "representant_relation_changes_changedById_changedAt_idx" ON "representant_relation_changes"("changedById", "changedAt");

-- CreateIndex
CREATE INDEX "representant_relation_changes_isDemo_idx" ON "representant_relation_changes"("isDemo");

-- CreateIndex
CREATE INDEX "representants_relationStatus_idx" ON "representants"("relationStatus");

-- CreateIndex
CREATE INDEX "representants_relationStatus_departementId_idx" ON "representants"("relationStatus", "departementId");

-- AddForeignKey
ALTER TABLE "scheduled_callbacks" ADD CONSTRAINT "scheduled_callbacks_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_callbacks" ADD CONSTRAINT "scheduled_callbacks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "call_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_callbacks" ADD CONSTRAINT "scheduled_callbacks_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "call_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_callbacks" ADD CONSTRAINT "scheduled_callbacks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representant_relation_changes" ADD CONSTRAINT "representant_relation_changes_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES "representants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representant_relation_changes" ADD CONSTRAINT "representant_relation_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un seul rappel en attente par prospect, index PARTIEL parce que Prisma ne
-- sait pas exprimer la clause WHERE. Un `@unique` ordinaire interdirait de
-- reprogrammer un rappel apres un premier deja honore. Le rappel remplace passe
-- a SUPERSEDED dans la meme transaction que l'insertion du nouveau ; sans cet
-- index, deux tentatives simultanees en laisseraient deux en attente et la file
-- du jour afficherait le meme prospect deux fois.
CREATE UNIQUE INDEX "scheduled_callbacks_one_pending_per_prospect"
  ON "scheduled_callbacks" ("prospectId")
  WHERE "status" = 'PENDING';
