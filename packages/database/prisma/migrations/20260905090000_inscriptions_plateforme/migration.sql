CREATE TABLE "inscriptions_plateforme" (
  "id" TEXT NOT NULL,
  "projet" "Projet" NOT NULL,
  "identifiantDistant" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "prenom" TEXT NOT NULL,
  "phoneE164" TEXT,
  "email" TEXT,
  "statutDistant" TEXT NOT NULL,
  "etapeDistante" INTEGER,
  "inscriteLe" TIMESTAMP(3),
  "soumiseLe" TIMESTAMP(3),
  "decideeLe" TIMESTAMP(3),
  "disparueLe" TIMESTAMP(3),
  "prospectId" TEXT,
  "chargeUtile" JSONB NOT NULL,
  "premierTirageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dernierTirageAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inscriptions_plateforme_pkey" PRIMARY KEY ("id")
);

-- La cle d'idempotence du tirage : la plateforme est relue en entier, une ligne
-- deja vue est mise a jour au lieu d'etre redeposee.
CREATE UNIQUE INDEX "inscriptions_plateforme_projet_identifiantDistant_key"
  ON "inscriptions_plateforme"("projet", "identifiantDistant");

CREATE INDEX "inscriptions_plateforme_projet_statutDistant_idx"
  ON "inscriptions_plateforme"("projet", "statutDistant");
CREATE INDEX "inscriptions_plateforme_projet_inscriteLe_idx"
  ON "inscriptions_plateforme"("projet", "inscriteLe");
CREATE INDEX "inscriptions_plateforme_prospectId_idx"
  ON "inscriptions_plateforme"("prospectId");

ALTER TABLE "inscriptions_plateforme"
  ADD CONSTRAINT "inscriptions_plateforme_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
