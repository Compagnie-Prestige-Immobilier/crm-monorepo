-- Une preuve d'appel appareil incomplete fausse la DMC : le calcul de
-- supervision compte une ligne des qu'elle a `deviceCallAt`, et prend 0
-- seconde si `deviceCallDurationSeconds` manque au lieu de l'exclure. Meme
-- principe que `representants_next_callback_origine_check` : les trois
-- colonnes se lisent ensemble ou pas du tout.
--
-- Migration PUREMENT ADDITIVE : une contrainte que tout l'existant satisfait
-- deja (les trois colonnes n'existent que depuis cette meme livraison, aucune
-- ligne ne les a encore renseignees).

ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_preuve_appareil_toutes_ou_aucune"
  CHECK (
    ("deviceCallType" IS NULL AND "deviceCallDurationSeconds" IS NULL AND "deviceCallAt" IS NULL)
    OR ("deviceCallType" IS NOT NULL AND "deviceCallDurationSeconds" IS NOT NULL AND "deviceCallAt" IS NOT NULL)
  );

ALTER TABLE "rep_call_attempts" ADD CONSTRAINT "rep_call_attempts_preuve_appareil_toutes_ou_aucune"
  CHECK (
    ("deviceCallType" IS NULL AND "deviceCallDurationSeconds" IS NULL AND "deviceCallAt" IS NULL)
    OR ("deviceCallType" IS NOT NULL AND "deviceCallDurationSeconds" IS NOT NULL AND "deviceCallAt" IS NOT NULL)
  );
