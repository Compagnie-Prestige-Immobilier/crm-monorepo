-- EB-20 : l'etablissement du prospect, saisi a la creation.
ALTER TABLE "prospects" ADD COLUMN "etablissement" TEXT;

-- EB-23 : la question « ce numero est-il un numero WhatsApp ? », posee a la
-- conversion. Meme forme que sur `representants` : un statut a quatre etats,
-- pas un booleen, parce que « il n'a pas WhatsApp » et « on ne lui a pas pose
-- la question » ne se rappellent pas de la meme facon.
ALTER TABLE "prospects"
  ADD COLUMN "whatsappStatus" "WhatsappStatus" NOT NULL DEFAULT 'NON_DEMANDE';

-- Reprise des numeros deja saisis a la creation d'une fiche diaspora, ou la
-- colonne existait seule. Un numero identique au telephone devient MEME_NUMERO
-- et la colonne se vide : la garder recopiee designerait un autre abonne des la
-- premiere correction du telephone.
UPDATE "prospects"
   SET "whatsappStatus" = 'MEME_NUMERO', "whatsappE164" = NULL
 WHERE "whatsappE164" IS NOT NULL AND "whatsappE164" = "phoneE164";

UPDATE "prospects"
   SET "whatsappStatus" = 'AUTRE_NUMERO'
 WHERE "whatsappE164" IS NOT NULL;

-- Valide sans `NOT VALID` : les deux UPDATE qui precedent tournent dans la meme
-- transaction, plus aucune ligne ne peut violer la regle et le parcours ne
-- coute rien de plus que l'ALTER.
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_whatsapp_number_matches_status"
  CHECK (
    ("whatsappStatus" = 'AUTRE_NUMERO' AND "whatsappE164" IS NOT NULL)
    OR ("whatsappStatus" <> 'AUTRE_NUMERO' AND "whatsappE164" IS NULL)
  );
