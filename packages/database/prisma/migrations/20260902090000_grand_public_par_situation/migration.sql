CREATE TYPE "TypeContrat" AS ENUM ('CDI', 'CDD', 'AUTRE');
CREATE TYPE "ModeEpargne" AS ENUM ('TONTINE', 'MOBILE_MONEY', 'BANQUE', 'AUCUN');
CREATE TYPE "EmployeurType" AS ENUM ('MINISTERE', 'ENTREPRISE', 'AUTRE');

CREATE TABLE "employeurs" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "EmployeurType" NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employeurs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employeurs_code_key" ON "employeurs"("code");
CREATE INDEX "employeurs_isActive_position_idx" ON "employeurs"("isActive", "position");
CREATE INDEX "employeurs_updatedAt_id_idx" ON "employeurs"("updatedAt", "id");

CREATE TABLE "pays" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "indicatif" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pays_code_key" ON "pays"("code");
CREATE INDEX "pays_isActive_position_idx" ON "pays"("isActive", "position");
CREATE INDEX "pays_updatedAt_id_idx" ON "pays"("updatedAt", "id");

-- Toutes NULLABLES : la saisie terrain abandonne la fiche entière dès qu'un
-- champ de plus est exigé. Aucun CHECK par situation pour la même raison.
ALTER TABLE "prospects"
  ADD COLUMN "employeurId" TEXT,
  ADD COLUMN "employeur" TEXT,
  ADD COLUMN "typeContrat" "TypeContrat",
  ADD COLUMN "ancienneteMois" INTEGER,
  ADD COLUMN "lieuActivite" TEXT,
  ADD COLUMN "modeEpargne" "ModeEpargne",
  ADD COLUMN "paysResidenceId" TEXT,
  ADD COLUMN "villeResidence" TEXT,
  ADD COLUMN "whatsappE164" TEXT,
  ADD COLUMN "relaisNom" TEXT,
  ADD COLUMN "relaisPhoneE164" TEXT;

ALTER TABLE "prospects"
  ADD CONSTRAINT "prospects_employeurId_fkey" FOREIGN KEY ("employeurId") REFERENCES "employeurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "prospects_paysResidenceId_fkey" FOREIGN KEY ("paysResidenceId") REFERENCES "pays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "prospects_employeurId_idx" ON "prospects"("employeurId");
CREATE INDEX "prospects_paysResidenceId_idx" ON "prospects"("paysResidenceId");
