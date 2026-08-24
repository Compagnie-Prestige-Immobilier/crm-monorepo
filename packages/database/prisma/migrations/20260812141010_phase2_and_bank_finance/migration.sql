-- CreateEnum
CREATE TYPE "Phase2Status" AS ENUM ('PENDING', 'METHOD_OBTAINED', 'REFUSED', 'WRONG_NUMBER');

-- CreateEnum
CREATE TYPE "EnrollmentMethod" AS ENUM ('PLATFORM', 'PHYSICAL', 'VOICE_OR_ELECTRONIC_MESSAGING');

-- CreateEnum
CREATE TYPE "BddSegment" AS ENUM ('BDD1', 'BDD2', 'BDD3', 'BDD4');

-- CreateEnum
CREATE TYPE "CampaignScope" AS ENUM ('BDD1', 'BDD2', 'BDD3', 'BDD4', 'ALL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "CallTaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('METHOD_OBTAINED', 'UNREACHABLE', 'CALLBACK', 'REFUSED', 'WRONG_NUMBER', 'OTHER');

-- CreateEnum
CREATE TYPE "BankStageType" AS ENUM ('OPEN', 'CASHED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'BANQUE_FINANCE';

-- AlterTable
ALTER TABLE "prospects" ADD COLUMN     "enrollmentCapturedAt" TIMESTAMP(3),
ADD COLUMN     "enrollmentCapturedById" TEXT,
ADD COLUMN     "enrollmentMethod" "EnrollmentMethod",
ADD COLUMN     "phase2Status" "Phase2Status" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "call_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "CampaignScope" NOT NULL,
    "seed" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "call_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_campaign_commerciaux" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "call_campaign_commerciaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_tasks" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "CallTaskStatus" NOT NULL DEFAULT 'OPEN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "call_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_attempts" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "taskId" TEXT,
    "campaignId" TEXT,
    "performedById" TEXT NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "method" "EnrollmentMethod",
    "comment" TEXT,
    "clientCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_case_stages" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "type" "BankStageType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_case_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_rejection_reasons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_rejection_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_cases" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "referenceKey" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhoneE164" TEXT NOT NULL,
    "processingBankId" TEXT NOT NULL,
    "currentStageId" TEXT NOT NULL,
    "amountXof" DECIMAL(18,0),
    "rejectionReasonId" TEXT,
    "rejectionDetail" TEXT,
    "rev" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bank_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_case_transitions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "amountXof" DECIMAL(18,0),
    "rejectionReasonId" TEXT,
    "rejectionDetail" TEXT,
    "comment" TEXT,
    "correctionReason" TEXT,
    "clientAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_case_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_campaigns_status_createdAt_idx" ON "call_campaigns"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "call_campaign_commerciaux_campaignId_userId_key" ON "call_campaign_commerciaux"("campaignId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "call_campaign_commerciaux_campaignId_position_key" ON "call_campaign_commerciaux"("campaignId", "position");

-- CreateIndex
CREATE INDEX "call_tasks_assignedToId_status_idx" ON "call_tasks"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "call_tasks_prospectId_idx" ON "call_tasks"("prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "call_tasks_campaignId_prospectId_key" ON "call_tasks"("campaignId", "prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "call_tasks_campaignId_assignedToId_position_key" ON "call_tasks"("campaignId", "assignedToId", "position");

-- CreateIndex
CREATE INDEX "call_attempts_prospectId_createdAt_idx" ON "call_attempts"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "call_attempts_performedById_createdAt_idx" ON "call_attempts"("performedById", "createdAt");

-- CreateIndex
CREATE INDEX "call_attempts_campaignId_idx" ON "call_attempts"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_case_stages_code_key" ON "bank_case_stages"("code");

-- CreateIndex
CREATE INDEX "bank_case_stages_type_isActive_position_idx" ON "bank_case_stages"("type", "isActive", "position");

-- CreateIndex
CREATE UNIQUE INDEX "bank_rejection_reasons_code_key" ON "bank_rejection_reasons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "bank_rejection_reasons_label_key" ON "bank_rejection_reasons"("label");

-- CreateIndex
CREATE UNIQUE INDEX "bank_cases_referenceKey_key" ON "bank_cases"("referenceKey");

-- CreateIndex
CREATE INDEX "bank_cases_currentStageId_idx" ON "bank_cases"("currentStageId");

-- CreateIndex
CREATE INDEX "bank_cases_processingBankId_idx" ON "bank_cases"("processingBankId");

-- CreateIndex
CREATE INDEX "bank_cases_createdById_idx" ON "bank_cases"("createdById");

-- CreateIndex
CREATE INDEX "bank_cases_prospectId_idx" ON "bank_cases"("prospectId");

-- CreateIndex
CREATE INDEX "bank_cases_createdAt_idx" ON "bank_cases"("createdAt");

-- CreateIndex
CREATE INDEX "bank_cases_deletedAt_idx" ON "bank_cases"("deletedAt");

-- CreateIndex
CREATE INDEX "bank_case_transitions_caseId_createdAt_idx" ON "bank_case_transitions"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "bank_case_transitions_performedById_createdAt_idx" ON "bank_case_transitions"("performedById", "createdAt");

-- CreateIndex
CREATE INDEX "bank_case_transitions_toStageId_idx" ON "bank_case_transitions"("toStageId");

-- CreateIndex
CREATE INDEX "prospects_syndicatId_banqueId_idx" ON "prospects"("syndicatId", "banqueId");

-- CreateIndex
CREATE INDEX "prospects_phase2Status_idx" ON "prospects"("phase2Status");

-- CreateIndex
CREATE INDEX "prospects_enrollmentMethod_idx" ON "prospects"("enrollmentMethod");

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_enrollmentCapturedById_fkey" FOREIGN KEY ("enrollmentCapturedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_campaigns" ADD CONSTRAINT "call_campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_campaign_commerciaux" ADD CONSTRAINT "call_campaign_commerciaux_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "call_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_campaign_commerciaux" ADD CONSTRAINT "call_campaign_commerciaux_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_tasks" ADD CONSTRAINT "call_tasks_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "call_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_tasks" ADD CONSTRAINT "call_tasks_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_tasks" ADD CONSTRAINT "call_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "call_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "call_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_cases" ADD CONSTRAINT "bank_cases_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_cases" ADD CONSTRAINT "bank_cases_processingBankId_fkey" FOREIGN KEY ("processingBankId") REFERENCES "banques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_cases" ADD CONSTRAINT "bank_cases_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "bank_case_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_cases" ADD CONSTRAINT "bank_cases_rejectionReasonId_fkey" FOREIGN KEY ("rejectionReasonId") REFERENCES "bank_rejection_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_cases" ADD CONSTRAINT "bank_cases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_cases" ADD CONSTRAINT "bank_cases_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_case_transitions" ADD CONSTRAINT "bank_case_transitions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "bank_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_case_transitions" ADD CONSTRAINT "bank_case_transitions_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "bank_case_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_case_transitions" ADD CONSTRAINT "bank_case_transitions_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "bank_case_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_case_transitions" ADD CONSTRAINT "bank_case_transitions_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_case_transitions" ADD CONSTRAINT "bank_case_transitions_rejectionReasonId_fkey" FOREIGN KEY ("rejectionReasonId") REFERENCES "bank_rejection_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Invariants que Prisma ne sait pas exprimer.
--
-- Ils sont posés en CHECK et en index partiels, pas seulement validés dans les
-- DTO : une correction SQL manuelle en production, un script d'import ou un
-- futur chemin d'écriture oublié doivent tous se heurter à la base.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. La méthode d'enrôlement est présente SI ET SEULEMENT SI le statut est
--    METHOD_OBTAINED. Un prospect REFUSED avec une méthode renseignée serait
--    une contradiction qui fausserait silencieusement les statistiques.
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_enrollment_method_matches_status"
  CHECK (
    ("phase2Status" = 'METHOD_OBTAINED' AND "enrollmentMethod" IS NOT NULL)
    OR ("phase2Status" <> 'METHOD_OBTAINED' AND "enrollmentMethod" IS NULL)
  );

-- 2. Une tentative METHOD_OBTAINED porte une méthode ; aucune autre n'en porte.
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_method_matches_outcome"
  CHECK (
    (outcome = 'METHOD_OBTAINED' AND method IS NOT NULL)
    OR (outcome <> 'METHOD_OBTAINED' AND method IS NULL)
  );

-- 3. OTHER exige un commentaire non vide. Sans lui, « Autre » est une case
--    fourre-tout dont personne ne peut rien tirer six mois plus tard.
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_other_requires_comment"
  CHECK (outcome <> 'OTHER' OR (comment IS NOT NULL AND length(btrim(comment)) > 0));

ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_comment_max_length"
  CHECK (comment IS NULL OR length(comment) <= 2000);

-- 4. Deux tâches ACTIVES ne peuvent pas viser le même prospect : sans cet
--    index, deux campagnes simultanées distribueraient le même numéro à deux
--    commerciaux, qui appelleraient tous les deux la même personne.
CREATE UNIQUE INDEX "call_tasks_one_active_per_prospect"
  ON "call_tasks" ("prospectId")
  WHERE "isActive" = true;

-- 5. Règles financières des étapes terminales.
--    Encaissé  : montant strictement positif, aucun motif de rejet.
--    Rejeté    : montant à zéro, motif obligatoire.
--    Ouvert    : ni montant ni motif.
--    L'étape étant une ligne d'une autre table, la vérification complète se
--    fait dans le service ; ces contraintes couvrent la cohérence interne de la
--    ligne, qui est la partie qu'un UPDATE manuel casserait le plus facilement.
ALTER TABLE "bank_cases" ADD CONSTRAINT "bank_cases_amount_non_negative"
  CHECK ("amountXof" IS NULL OR "amountXof" >= 0);

ALTER TABLE "bank_cases" ADD CONSTRAINT "bank_cases_rejection_detail_max_length"
  CHECK ("rejectionDetail" IS NULL OR length("rejectionDetail") <= 2000);

-- 6. Une seule étape initiale, une seule étape d'encaissement, une seule de
--    rejet. Le workflow est global : plusieurs étapes initiales rendraient la
--    création de dossier non déterministe.
CREATE UNIQUE INDEX "bank_case_stages_single_initial"
  ON "bank_case_stages" (("isInitial")) WHERE "isInitial" = true;

CREATE UNIQUE INDEX "bank_case_stages_single_cashed"
  ON "bank_case_stages" ((type)) WHERE type = 'CASHED';

CREATE UNIQUE INDEX "bank_case_stages_single_rejected"
  ON "bank_case_stages" ((type)) WHERE type = 'REJECTED';

-- 7. Unicité de la référence bancaire sur sa forme normalisée, hors dossiers
--    supprimés logiquement.
DROP INDEX IF EXISTS "bank_cases_referenceKey_key";
CREATE UNIQUE INDEX "bank_cases_reference_key_active"
  ON "bank_cases" ("referenceKey")
  WHERE "deletedAt" IS NULL;

-- 8. Recherche rapide de l'annuaire phase 2 et de l'autocomplétion bancaire
--    sur 500 000 lignes.
CREATE INDEX IF NOT EXISTS "prospects_phase2_directory"
  ON "prospects" ("updatedAt", "id")
  WHERE "deletedAt" IS NULL;

-- Recherche par nom pour l'autocomplétion Banque & Finance, insensible à la
-- casse et aux accents.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- L'OPCLASS EST QUALIFIÉE : `pg_trgm` vit dans `public`, et cette migration
-- rejouée sous `search_path = demo` échoue sinon sur « operator class
-- gin_trgm_ops does not exist », bloquant tout le démarrage de l'API.
CREATE INDEX IF NOT EXISTS "prospects_nom_prenom_trgm"
  ON "prospects" USING gin ((lower("nom") || ' ' || lower("prenom")) public.gin_trgm_ops);
