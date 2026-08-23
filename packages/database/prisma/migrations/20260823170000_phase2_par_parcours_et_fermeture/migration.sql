-- ─────────────────────────────────────────────────────────────────────────────
-- La phase 2 devient un état du PARCOURS, et un parcours peut se fermer.
--
-- Portée par `prospects`, la phase 2 rendait un prospect définitivement
-- inappelable dans le second projet : refusé en CHUES, la campagne Grand Public
-- le tirait quand même et chaque tentative revenait en 409, bloquant sur le
-- téléphone toute la partition de file de ce prospect.
--
-- Les colonnes de `prospects` sont CONSERVÉES : le contrat de synchronisation
-- les expose encore, et un APK déjà déployé les lit. Elles deviennent le reflet
-- du parcours d'ENTRÉE, plus l'autorité.
--
-- `SET LOCAL` et non `SET` : le plafond doit mourir avec cette transaction,
-- sinon il fuit sur toutes les migrations suivantes appliquées sur la même
-- connexion. Voir `20260814090000` pour le détail.
-- ─────────────────────────────────────────────────────────────────────────────
SET LOCAL lock_timeout = '3s';

-- Phase 2 par parcours.
ALTER TABLE "prospect_journeys"
  ADD COLUMN "phase2Status" "Phase2Status" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "enrollmentMethod" "EnrollmentMethod",
  ADD COLUMN "enrollmentCapturedAt" TIMESTAMP(3),
  ADD COLUMN "enrollmentCapturedById" TEXT;

-- Fermeture d'un parcours. Jamais de suppression : ce serait effacer
-- l'historique d'un projet réellement suivi.
ALTER TABLE "prospect_journeys"
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "closedReason" TEXT,
  ADD COLUMN "closedById" TEXT;

-- Reprise : l'état de phase 2 de la fiche descend sur SES parcours. Une fiche
-- suivie dans les deux projets voit donc son état recopié des deux côtés — ce
-- qui est exact au moment de la bascule, chaque parcours évoluant ensuite seul.
UPDATE "prospect_journeys" j
SET "phase2Status"           = p."phase2Status",
    "enrollmentMethod"       = p."enrollmentMethod",
    "enrollmentCapturedAt"   = p."enrollmentCapturedAt",
    "enrollmentCapturedById" = p."enrollmentCapturedById"
FROM "prospects" p
WHERE p."id" = j."prospectId";

-- `NOT VALID` puis validation à part : la vérification des lignes existantes
-- prend un verrou plus faible et ne bloque pas les écritures en cours.
ALTER TABLE "prospect_journeys"
  ADD CONSTRAINT "prospect_journeys_enrollmentCapturedById_fkey"
  FOREIGN KEY ("enrollmentCapturedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

ALTER TABLE "prospect_journeys"
  ADD CONSTRAINT "prospect_journeys_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

CREATE INDEX "prospect_journeys_projet_phase2Status_closedAt_idx"
  ON "prospect_journeys" ("projet", "phase2Status", "closedAt");

-- ─────────────────────────────────────────────────────────────────────────────
-- Index de curseur des flux de synchronisation.
--
-- Le pull lit chacun de ces flux en `ORDER BY "updatedAt", "id"` et n'avait
-- aucun index pour le servir : chaque page triait la table entière pour en
-- garder 200. Sur un rattrapage de soixante pages, un téléphone faisait lire
-- des centaines de milliers de lignes.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX "call_tasks_updatedAt_id_idx" ON "call_tasks" ("updatedAt", "id");
CREATE INDEX "visites_updatedAt_id_idx" ON "visites" ("updatedAt", "id");
CREATE INDEX "canaux_provenance_updatedAt_id_idx" ON "canaux_provenance" ("updatedAt", "id");
CREATE INDEX "visite_entreprises_updatedAt_id_idx" ON "visite_entreprises" ("updatedAt", "id");
CREATE INDEX "visite_objets_updatedAt_id_idx" ON "visite_objets" ("updatedAt", "id");
CREATE INDEX "visite_directions_updatedAt_id_idx" ON "visite_directions" ("updatedAt", "id");
CREATE INDEX "visite_destinataires_updatedAt_id_idx" ON "visite_destinataires" ("updatedAt", "id");

-- Déjà créés par `20260820160000` mais absents du schéma : les redéclarer ici
-- évite qu'un `migrate dev` les propose à la SUPPRESSION.
CREATE INDEX IF NOT EXISTS "prospects_projet_idx" ON "prospects" ("projet");
CREATE INDEX IF NOT EXISTS "prospects_canalProvenanceId_idx" ON "prospects" ("canalProvenanceId");
