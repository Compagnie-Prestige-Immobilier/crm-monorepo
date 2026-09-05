-- Reprise des lignes portant « Vocal ou messagerie electronique ».
--
-- Elles partent vers EMAIL et non vers WHATSAPP : l'ancienne valeur couvrait
-- les deux canaux sans les distinguer, et l'e-mail est celui dont on garde une
-- trace ecrite. Choisir WHATSAPP aurait affirme un canal que la donnee ne dit
-- pas.
--
-- La valeur reste declaree dans le type : la retirer exigerait de recreer
-- l'enumeration, ce qui coute le retour arriere de la version entiere. Sa
-- suppression est ecrite et retenue, voir docs/migrations-en-attente.md.

UPDATE "prospects"
  SET "enrollmentMethod" = 'EMAIL'
  WHERE "enrollmentMethod" = 'VOICE_OR_ELECTRONIC_MESSAGING';

UPDATE "prospect_journeys"
  SET "enrollmentMethod" = 'EMAIL'
  WHERE "enrollmentMethod" = 'VOICE_OR_ELECTRONIC_MESSAGING';

UPDATE "call_attempts"
  SET "method" = 'EMAIL'
  WHERE "method" = 'VOICE_OR_ELECTRONIC_MESSAGING';
