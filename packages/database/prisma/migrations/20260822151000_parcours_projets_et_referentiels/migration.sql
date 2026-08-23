CREATE TYPE "GrandPublicConsent" AS ENUM ('NON_DEMANDE', 'INTERESSE', 'REFUSE');
CREATE TYPE "PaymentMode" AS ENUM ('COMPTANT', 'ECHELONNE');

ALTER TYPE "CampaignScope" ADD VALUE 'GP1';
ALTER TYPE "CampaignScope" ADD VALUE 'GP2';
ALTER TYPE "CampaignScope" ADD VALUE 'GP3';
ALTER TYPE "CampaignScope" ADD VALUE 'GP4';
ALTER TYPE "CampaignStatus" ADD VALUE 'DRAFT' BEFORE 'ACTIVE';
ALTER TYPE "CampaignStatus" ADD VALUE 'PAUSED' AFTER 'ACTIVE';

CREATE TABLE "professions" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isTeaching" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "professions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "professions_code_key" ON "professions"("code");
CREATE UNIQUE INDEX "professions_label_key" ON "professions"("label");
CREATE INDEX "professions_isActive_position_idx" ON "professions"("isActive", "position");

CREATE TABLE "income_bands" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "minXof" INTEGER,
  "maxXof" INTEGER,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "income_bands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "income_bands_code_key" ON "income_bands"("code");
CREATE UNIQUE INDEX "income_bands_label_key" ON "income_bands"("label");
CREATE INDEX "income_bands_isActive_position_idx" ON "income_bands"("isActive", "position");

CREATE TABLE "offers" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "offers_code_key" ON "offers"("code");
CREATE UNIQUE INDEX "offers_label_key" ON "offers"("label");
CREATE INDEX "offers_isActive_position_idx" ON "offers"("isActive", "position");

ALTER TABLE "prospects"
  ADD COLUMN "professionId" TEXT,
  ADD COLUMN "incomeBandId" TEXT,
  ADD COLUMN "paymentMode" "PaymentMode";

ALTER TABLE "prospects"
  ADD CONSTRAINT "prospects_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "professions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "prospects_incomeBandId_fkey" FOREIGN KEY ("incomeBandId") REFERENCES "income_bands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "prospects_professionId_idx" ON "prospects"("professionId");
CREATE INDEX "prospects_incomeBandId_idx" ON "prospects"("incomeBandId");

CREATE TABLE "prospect_journeys" (
  "id" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "projet" "Projet" NOT NULL,
  "statut" "ProspectStatut" NOT NULL DEFAULT 'NOUVEAU',
  "consent" "GrandPublicConsent" NOT NULL DEFAULT 'NON_DEMANDE',
  "consentAt" TIMESTAMP(3),
  "consentById" TEXT,
  "convertedAt" TIMESTAMP(3),
  "convertedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prospect_journeys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "prospect_journeys_prospectId_projet_key" ON "prospect_journeys"("prospectId", "projet");
CREATE INDEX "prospect_journeys_projet_statut_idx" ON "prospect_journeys"("projet", "statut");
CREATE INDEX "prospect_journeys_projet_consent_idx" ON "prospect_journeys"("projet", "consent");
ALTER TABLE "prospect_journeys"
  ADD CONSTRAINT "prospect_journeys_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "prospect_journeys_consentById_fkey" FOREIGN KEY ("consentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "prospect_journeys_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "prospect_journeys" ("id", "prospectId", "projet", "statut", "consent", "consentAt", "createdAt", "updatedAt")
SELECT substr(md5('journey:' || p."id" || ':' || p."projet"::text), 1, 8) || '-' ||
       substr(md5('journey:' || p."id" || ':' || p."projet"::text), 9, 4) || '-4' ||
       substr(md5('journey:' || p."id" || ':' || p."projet"::text), 14, 3) || '-a' ||
       substr(md5('journey:' || p."id" || ':' || p."projet"::text), 18, 3) || '-' ||
       substr(md5('journey:' || p."id" || ':' || p."projet"::text), 21, 12),
       p."id",
       p."projet",
       p."statut",
       CASE WHEN p."projet" = 'GRAND_PUBLIC' THEN 'INTERESSE'::"GrandPublicConsent" ELSE 'NON_DEMANDE'::"GrandPublicConsent" END,
       CASE WHEN p."projet" = 'GRAND_PUBLIC' THEN p."createdAt" ELSE NULL END,
       p."createdAt",
       p."updatedAt"
FROM "prospects" p;

CREATE TABLE "prospect_conversions" (
  "id" TEXT NOT NULL,
  "journeyId" TEXT NOT NULL,
  "offerId" TEXT,
  "paymentMode" "PaymentMode",
  "amountXof" INTEGER,
  "durationMonths" INTEGER,
  "confirmedById" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospect_conversions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prospect_conversions_amount_check" CHECK ("amountXof" IS NULL OR "amountXof" >= 0),
  CONSTRAINT "prospect_conversions_duration_check" CHECK ("durationMonths" IS NULL OR "durationMonths" BETWEEN 1 AND 300),
  CONSTRAINT "prospect_conversions_payment_check" CHECK ("paymentMode" = 'ECHELONNE' OR "durationMonths" IS NULL)
);
CREATE UNIQUE INDEX "prospect_conversions_journeyId_key" ON "prospect_conversions"("journeyId");
CREATE INDEX "prospect_conversions_offerId_confirmedAt_idx" ON "prospect_conversions"("offerId", "confirmedAt");
ALTER TABLE "prospect_conversions"
  ADD CONSTRAINT "prospect_conversions_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "prospect_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "prospect_conversions_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "prospect_conversions_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "call_campaigns"
  ADD COLUMN "projet" "Projet" NOT NULL DEFAULT 'CHUES',
  ADD COLUMN "offerId" TEXT,
  ADD COLUMN "audienceFilters" JSONB;
ALTER TABLE "call_campaigns"
  ADD CONSTRAINT "call_campaigns_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "call_campaigns_projet_status_createdAt_idx" ON "call_campaigns"("projet", "status", "createdAt");
