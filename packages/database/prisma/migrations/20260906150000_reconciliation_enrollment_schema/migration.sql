ALTER TABLE "prospects"
  ADD COLUMN IF NOT EXISTS "etablissement" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappStatus" "WhatsappStatus" NOT NULL DEFAULT 'NON_DEMANDE';

ALTER TYPE "EnrollmentMethod" ADD VALUE IF NOT EXISTS 'WHATSAPP';
ALTER TYPE "EnrollmentMethod" ADD VALUE IF NOT EXISTS 'RDV_CPI';
ALTER TYPE "EnrollmentMethod" ADD VALUE IF NOT EXISTS 'PLATEFORME_EN_LIGNE';
ALTER TYPE "EnrollmentMethod" ADD VALUE IF NOT EXISTS 'MAIL';

ALTER TABLE "prospects" DROP CONSTRAINT IF EXISTS "prospects_whatsapp_number_matches_status";
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_whatsapp_number_matches_status"
  CHECK (
    ("whatsappStatus" = 'AUTRE_NUMERO' AND "whatsappE164" IS NOT NULL)
    OR ("whatsappStatus" <> 'AUTRE_NUMERO' AND "whatsappE164" IS NULL)
  );

ALTER TABLE "call_attempts" DROP CONSTRAINT IF EXISTS "call_attempts_rendez_vous_matches_method";
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_rendez_vous_matches_method"
  CHECK (
    method::text = 'RDV_CPI'
    OR (method = 'APPOINTMENT' AND "rendezVousAt" IS NOT NULL)
    OR (method IS DISTINCT FROM 'APPOINTMENT' AND "rendezVousAt" IS NULL)
  );
