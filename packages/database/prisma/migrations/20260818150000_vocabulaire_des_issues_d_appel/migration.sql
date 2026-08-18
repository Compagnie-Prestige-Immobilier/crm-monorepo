-- CreateEnum
CREATE TYPE "CallOutcomeEffect" AS ENUM ('CLOSE_METHOD', 'CLOSE_REFUSED', 'CLOSE_WRONG_NUMBER', 'KEEP_OPEN', 'SCHEDULE_CALLBACK');

-- CreateTable
CREATE TABLE "call_outcome_reasons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "effect" "CallOutcomeEffect" NOT NULL,
    "requiresComment" BOOLEAN NOT NULL DEFAULT false,
    "requiresCallback" BOOLEAN NOT NULL DEFAULT false,
    "countsAsReached" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "color" TEXT,
    "minPayloadVersion" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_outcome_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_outcome_reasons_code_key" ON "call_outcome_reasons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "call_outcome_reasons_label_key" ON "call_outcome_reasons"("label");

-- CreateIndex
CREATE INDEX "call_outcome_reasons_isActive_sortOrder_idx" ON "call_outcome_reasons"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "call_outcome_reasons_effect_isActive_idx" ON "call_outcome_reasons"("effect", "isActive");
