-- CreateEnum
CREATE TYPE "WhatsappStatus" AS ENUM ('NON_DEMANDE', 'MEME_NUMERO', 'AUTRE_NUMERO', 'AUCUN');

-- AlterTable
ALTER TABLE "representants"
  ADD COLUMN "whatsappStatus" "WhatsappStatus" NOT NULL DEFAULT 'NON_DEMANDE',
  ADD COLUMN "whatsappE164" TEXT,
  ADD COLUMN "profession" TEXT;

-- CreateIndex
CREATE INDEX "representants_whatsappStatus_idx" ON "representants"("whatsappStatus");

-- Le numéro WhatsApp est renseigné SI ET SEULEMENT SI le statut vaut
-- AUTRE_NUMERO. Sur MEME_NUMERO la colonne reste NULLE : une copie de
-- `phoneE164` survivrait à la correction du téléphone et désignerait un autre
-- abonné. Posé en CHECK, donc opposable aussi à un correctif SQL manuel.
--
-- Validé sans `NOT VALID` : les trois colonnes viennent de naître, aucune ligne
-- existante ne peut violer la règle et le parcours ne coûte rien de plus que
-- l'ALTER qui précède, dans la même transaction et sous le même verrou.
ALTER TABLE "representants" ADD CONSTRAINT "representants_whatsapp_number_matches_status"
  CHECK (
    ("whatsappStatus" = 'AUTRE_NUMERO' AND "whatsappE164" IS NOT NULL)
    OR ("whatsappStatus" <> 'AUTRE_NUMERO' AND "whatsappE164" IS NULL)
  );
