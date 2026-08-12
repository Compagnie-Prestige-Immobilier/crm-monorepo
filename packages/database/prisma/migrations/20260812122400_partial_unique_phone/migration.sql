-- Unicité du téléphone : index PARTIEL, restreint aux lignes vivantes.
--
-- Prisma ne sait pas exprimer une clause WHERE sur un index, d'où ce SQL écrit
-- à la main. Un `@unique` ordinaire réserverait le numéro À VIE : un commercial
-- supprime une fiche saisie par erreur, puis se retrouve incapable de ressaisir
-- ce numéro, avec une erreur d'unicité qu'aucun message métier n'explique.
--
-- Ces deux index sont la troisième ligne de défense de l'idempotence, après la
-- table sync_batches (niveau lot) et sync_operations (niveau opération) : même
-- si les deux étaient corrompues, la base refuserait elle-même le doublon.

CREATE UNIQUE INDEX "representants_phone_e164_active_key"
  ON "representants" ("phoneE164")
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "prospects_phone_e164_active_key"
  ON "prospects" ("phoneE164")
  WHERE "deletedAt" IS NULL;
