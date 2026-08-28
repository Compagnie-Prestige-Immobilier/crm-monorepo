-- Les renseignements que la phase 3 (Conversion) recueille pendant l'appel.
--
-- Tous facultatifs : une tentative déjà remontée reste valide, et un
-- téléconseiller qui n'obtient pas une réponse ne doit pas perdre la saisie
-- entière. Nom, prénom, téléphone, profession, syndicat et banque n'entrent PAS
-- ici : ils vivent sur `prospects`, et la tentative les y écrit.
ALTER TABLE "call_attempts"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "fonctionnaire" BOOLEAN,
  ADD COLUMN "engagementEnCours" BOOLEAN,
  ADD COLUMN "dureeEtablissementMois" INTEGER,
  ADD COLUMN "rendezVousAt" TIMESTAMP(3);

-- La date de rendez-vous est présente SI ET SEULEMENT SI la méthode est la
-- prise de rendez-vous. Écrite avec `IS DISTINCT FROM` : `method <> 'APPOINTMENT'`
-- vaut NULL quand la méthode est nulle, et un CHECK qui vaut NULL passe.
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_rendez_vous_matches_method"
  CHECK (
    (method = 'APPOINTMENT' AND "rendezVousAt" IS NOT NULL)
    OR (method IS DISTINCT FROM 'APPOINTMENT' AND "rendezVousAt" IS NULL)
  );

ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_duree_etablissement_range"
  CHECK ("dureeEtablissementMois" IS NULL OR "dureeEtablissementMois" BETWEEN 0 AND 600);

ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_email_max_length"
  CHECK ("email" IS NULL OR length("email") <= 160);
