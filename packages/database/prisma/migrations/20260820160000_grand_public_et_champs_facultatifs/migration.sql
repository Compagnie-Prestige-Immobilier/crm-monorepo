-- Le Grand Public entre en base. Il ne passe par aucun representant et ne
-- releve d'aucun syndicat : les trois liens deviennent facultatifs, et le
-- projet dit desormais de quel processus une fiche releve.
CREATE TYPE "Projet" AS ENUM ('CHUES', 'GRAND_PUBLIC');
CREATE TYPE "ProspectType" AS ENUM ('FONCTIONNAIRE', 'SECTEUR_PRIVE', 'INFORMEL', 'DIASPORA');

ALTER TABLE "prospects"
  ADD COLUMN "projet" "Projet" NOT NULL DEFAULT 'CHUES',
  ADD COLUMN "type" "ProspectType",
  ADD COLUMN "profession" TEXT,
  ALTER COLUMN "banqueId" DROP NOT NULL,
  ALTER COLUMN "syndicatId" DROP NOT NULL,
  ALTER COLUMN "representantId" DROP NOT NULL;

-- D'ou vient un prospect. Referentiel et non enumeration : les canaux se creent
-- au fil des campagnes, une valeur figee couterait une migration a chaque fois.
CREATE TABLE "canaux_provenance" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "canaux_provenance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "canaux_provenance_code_key" ON "canaux_provenance" ("code");
CREATE UNIQUE INDEX "canaux_provenance_label_key" ON "canaux_provenance" ("label");
CREATE INDEX "canaux_provenance_isActive_position_idx" ON "canaux_provenance" ("isActive", "position");

ALTER TABLE "prospects"
  ADD COLUMN "dureeSystemeMois" INTEGER,
  ADD COLUMN "canalProvenanceId" TEXT;

ALTER TABLE "prospects"
  ADD CONSTRAINT "prospects_canalProvenanceId_fkey"
  FOREIGN KEY ("canalProvenanceId") REFERENCES "canaux_provenance"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "prospects_canalProvenanceId_idx" ON "prospects" ("canalProvenanceId");

ALTER TABLE "representants"
  ADD COLUMN "prenom" TEXT,
  ADD COLUMN "etablissement" TEXT;

-- Les ecrans CHUES filtrent tous sur le projet : sans index, chaque liste
-- balaye les 12 929 lignes pour en ecarter zero.
CREATE INDEX "prospects_projet_idx" ON "prospects" ("projet");
