-- ─────────────────────────────────────────────────────────────────────────────
-- Sécurité de verrouillage.
--
-- Cette migration touche des tables DÉJÀ EN SERVICE (`prospects`,
-- `call_tasks`, `call_campaigns`). Un `ALTER TABLE` y demande un verrou
-- ACCESS EXCLUSIVE : si une seule requête longue le retient, la migration
-- attend indéfiniment DERRIÈRE elle, et toutes les requêtes suivantes
-- s'empilent derrière la migration. L'API entière se fige sur une opération
-- censée durer une seconde.
--
-- Trois secondes : au-delà, mieux vaut un déploiement en échec, rejouable, que
-- des minutes d'indisponibilité totale.
--
-- `SET LOCAL` ET NON `SET`, ET LA DIFFÉRENCE EST GRAVE.
--
-- `SET` seul vaut pour la SESSION, pas pour la transaction. Prisma applique les
-- migrations successives sur la MÊME connexion : le plafond fuyait donc sur
-- toutes les migrations suivantes, dont celle qui supprime `device_tokens`.
-- Une suppression de table qui ne décroche pas son verrou en trois secondes
-- échoue, `api-entrypoint.sh` refuse alors de démarrer, et le déploiement se
-- solde par une indisponibilité totale au lieu du garde-fou qu'on croyait
-- poser. `SET LOCAL` meurt avec la transaction qui porte CE fichier.
-- ─────────────────────────────────────────────────────────────────────────────
SET LOCAL lock_timeout = '3s';

-- CreateEnum
CREATE TYPE "RepCallOutcome" AS ENUM ('REACHED', 'PROSPECTS_PROMISED', 'UNREACHABLE', 'CALLBACK', 'REFUSED', 'WRONG_NUMBER', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "prospects" ADD COLUMN     "origin" TEXT,
ADD COLUMN     "originLabel" TEXT;

-- AlterTable
ALTER TABLE "call_campaigns" ADD COLUMN     "spreadDays" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "call_tasks" ADD COLUMN     "dayIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "rep_call_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "spreadDays" INTEGER NOT NULL DEFAULT 1,
    "departementId" TEXT,
    "iefId" TEXT,
    "onlyWithoutProspects" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rep_call_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rep_call_campaign_commerciaux" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "rep_call_campaign_commerciaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rep_call_tasks" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "representantId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "dayIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "CallTaskStatus" NOT NULL DEFAULT 'OPEN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rep_call_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rep_call_attempts" (
    "id" TEXT NOT NULL,
    "representantId" TEXT NOT NULL,
    "taskId" TEXT,
    "campaignId" TEXT,
    "performedById" TEXT NOT NULL,
    "outcome" "RepCallOutcome" NOT NULL,
    "promisedProspects" INTEGER,
    "comment" TEXT,
    "clientCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rep_call_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_creation_requests" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "note" TEXT,
    "banqueId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "ClientRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "createdProspectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "client_creation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rep_call_campaigns_status_createdAt_idx" ON "rep_call_campaigns"("status", "createdAt");

-- CreateIndex
CREATE INDEX "rep_call_campaigns_isDemo_idx" ON "rep_call_campaigns"("isDemo");

-- CreateIndex
CREATE UNIQUE INDEX "rep_call_campaign_commerciaux_campaignId_userId_key" ON "rep_call_campaign_commerciaux"("campaignId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "rep_call_campaign_commerciaux_campaignId_position_key" ON "rep_call_campaign_commerciaux"("campaignId", "position");

-- CreateIndex
CREATE INDEX "rep_call_tasks_assignedToId_status_idx" ON "rep_call_tasks"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "rep_call_tasks_representantId_idx" ON "rep_call_tasks"("representantId");

-- CreateIndex
CREATE INDEX "rep_call_tasks_campaignId_assignedToId_dayIndex_idx" ON "rep_call_tasks"("campaignId", "assignedToId", "dayIndex");

-- CreateIndex
CREATE INDEX "rep_call_tasks_isDemo_idx" ON "rep_call_tasks"("isDemo");

-- CreateIndex
CREATE UNIQUE INDEX "rep_call_tasks_campaignId_representantId_key" ON "rep_call_tasks"("campaignId", "representantId");

-- CreateIndex
CREATE UNIQUE INDEX "rep_call_tasks_campaignId_assignedToId_position_key" ON "rep_call_tasks"("campaignId", "assignedToId", "position");

-- CreateIndex
CREATE INDEX "rep_call_attempts_representantId_createdAt_idx" ON "rep_call_attempts"("representantId", "createdAt");

-- CreateIndex
CREATE INDEX "rep_call_attempts_performedById_createdAt_idx" ON "rep_call_attempts"("performedById", "createdAt");

-- CreateIndex
CREATE INDEX "rep_call_attempts_campaignId_idx" ON "rep_call_attempts"("campaignId");

-- CreateIndex
CREATE INDEX "rep_call_attempts_isDemo_idx" ON "rep_call_attempts"("isDemo");

-- CreateIndex
CREATE INDEX "client_creation_requests_status_createdAt_idx" ON "client_creation_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "client_creation_requests_requestedById_idx" ON "client_creation_requests"("requestedById");

-- CreateIndex
CREATE INDEX "client_creation_requests_phoneE164_idx" ON "client_creation_requests"("phoneE164");

-- CreateIndex
CREATE INDEX "client_creation_requests_isDemo_idx" ON "client_creation_requests"("isDemo");

-- CreateIndex
CREATE INDEX "client_creation_requests_banqueId_idx" ON "client_creation_requests"("banqueId");

-- CreateIndex
CREATE INDEX "representants_iefId_idx" ON "representants"("iefId");

-- CreateIndex
-- Index PARTIEL, posé ici et non dans le schéma parce que Prisma ne sait pas
-- exprimer la clause `WHERE`. La provenance est NULLE pour l'écrasante
-- majorité des fiches : indexer les ~120 000 lignes sans provenance ferait
-- porter à l'index le poids de toute la table pour ne jamais servir, aucune
-- requête ne demandant « les prospects SANS provenance ».
CREATE INDEX "prospects_origin_idx" ON "prospects"("origin") WHERE "origin" IS NOT NULL;

-- CreateIndex
CREATE INDEX "call_tasks_campaignId_assignedToId_dayIndex_idx" ON "call_tasks"("campaignId", "assignedToId", "dayIndex");

-- AddForeignKey
ALTER TABLE "rep_call_campaigns" ADD CONSTRAINT "rep_call_campaigns_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "departements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_call_campaigns" ADD CONSTRAINT "rep_call_campaigns_iefId_fkey" FOREIGN KEY ("iefId") REFERENCES "iefs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_call_campaigns" ADD CONSTRAINT "rep_call_campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_call_campaign_commerciaux" ADD CONSTRAINT "rep_call_campaign_commerciaux_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "rep_call_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_call_campaign_commerciaux" ADD CONSTRAINT "rep_call_campaign_commerciaux_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_call_tasks" ADD CONSTRAINT "rep_call_tasks_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "rep_call_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_call_tasks" ADD CONSTRAINT "rep_call_tasks_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES "representants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_call_tasks" ADD CONSTRAINT "rep_call_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_call_attempts" ADD CONSTRAINT "rep_call_attempts_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES "representants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_call_attempts" ADD CONSTRAINT "rep_call_attempts_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "rep_call_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_call_attempts" ADD CONSTRAINT "rep_call_attempts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "rep_call_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rep_call_attempts" ADD CONSTRAINT "rep_call_attempts_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_creation_requests" ADD CONSTRAINT "client_creation_requests_banqueId_fkey" FOREIGN KEY ("banqueId") REFERENCES "banques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_creation_requests" ADD CONSTRAINT "client_creation_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_creation_requests" ADD CONSTRAINT "client_creation_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- RESTRICT et non SET NULL. `client_creation_requests_approved_has_prospect`
-- exige qu'une demande APPROUVÉE porte son prospect : mettre la colonne à NULL
-- à la suppression du prospect ferait échouer la suppression sur une violation
-- de CHECK, message incompréhensible pour l'administrateur qui efface une
-- fiche. RESTRICT refuse la suppression franchement, et l'ordre de purge
-- (`purge-plan.ts`) efface les demandes AVANT les prospects.
ALTER TABLE "client_creation_requests" ADD CONSTRAINT "client_creation_requests_createdProspectId_fkey" FOREIGN KEY ("createdProspectId") REFERENCES "prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Garde-fous que Prisma ne sait pas exprimer dans le schéma.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Deux tâches ACTIVES ne peuvent pas viser le même représentant. Miroir
--    exact de "call_tasks_one_active_per_prospect" : sans cet index, deux
--    campagnes créées coup sur coup donneraient le même numéro à deux
--    commerciaux, qui appelleraient la même personne le même matin.
CREATE UNIQUE INDEX "rep_call_tasks_one_active_per_representant"
  ON "rep_call_tasks" ("representantId")
  WHERE "isActive" = true;

-- 2. OTHER exige un commentaire non vide. Sans cela, « Autre » devient un
--    fourre-tout dont personne ne peut rien tirer six mois plus tard.
ALTER TABLE "rep_call_attempts" ADD CONSTRAINT "rep_call_attempts_other_requires_comment"
  CHECK (outcome <> 'OTHER' OR (comment IS NOT NULL AND length(btrim(comment)) > 0));

ALTER TABLE "rep_call_attempts" ADD CONSTRAINT "rep_call_attempts_comment_max_length"
  CHECK (comment IS NULL OR length(comment) <= 2000);

-- 3. Un nombre de fiches promises n'a de sens que sur l'issue qui le prévoit,
--    et ne peut pas être négatif. Le laisser libre ferait apparaître des
--    promesses sur des appels sans réponse dans les statistiques de relance.
ALTER TABLE "rep_call_attempts" ADD CONSTRAINT "rep_call_attempts_promised_only_when_promised"
  CHECK (
    ("promisedProspects" IS NULL)
    OR (outcome = 'PROSPECTS_PROMISED' AND "promisedProspects" >= 0)
  );

-- 4. L'étalement est borné : une campagne sur zéro jour ne produirait aucun
--    programme, et au-delà d'un mois la liasse cesse d'être un plan de travail.
--
--    Sur les tables DÉJÀ PEUPLÉES, la contrainte est posée en deux temps.
--    `ADD CONSTRAINT` seul relit toute la table sous verrou ACCESS EXCLUSIVE :
--    sur `call_tasks`, cela bloque tous les téléconseillers le temps du
--    parcours. `NOT VALID` pose la règle instantanément pour les écritures À
--    VENIR, sans lire une seule ligne existante.
--
--    Le `VALIDATE CONSTRAINT` correspondant N'EST PAS ICI : Prisma enveloppe
--    chaque fichier de migration dans UNE transaction, et un `VALIDATE` placé
--    à la suite de son `ADD` garderait le verrou ACCESS EXCLUSIVE de l'`ADD`
--    pendant tout le parcours de la table. Le découpage serait décoratif.
--    La validation vit donc dans la migration suivante,
--    `20260814090100_valider_contraintes`, où elle s'exécute dans sa propre
--    transaction sous SHARE UPDATE EXCLUSIVE, qui laisse passer lectures et
--    écritures.
ALTER TABLE "call_campaigns" ADD CONSTRAINT "call_campaigns_spread_days_range"
  CHECK ("spreadDays" >= 1 AND "spreadDays" <= 31) NOT VALID;

-- Table créée par cette migration même : elle est vide, la validation est
-- immédiate et le détour par NOT VALID n'aurait aucun sens.
ALTER TABLE "rep_call_campaigns" ADD CONSTRAINT "rep_call_campaigns_spread_days_range"
  CHECK ("spreadDays" >= 1 AND "spreadDays" <= 31);

ALTER TABLE "call_tasks" ADD CONSTRAINT "call_tasks_day_index_non_negative"
  CHECK ("dayIndex" >= 0) NOT VALID;

ALTER TABLE "rep_call_tasks" ADD CONSTRAINT "rep_call_tasks_day_index_non_negative"
  CHECK ("dayIndex" >= 0);

-- 5. La provenance est un vocabulaire fermé : une valeur libre rendrait
--    l'agrégat « répartition par provenance » illisible dès la première faute
--    de frappe. Elle vient toujours de code, jamais d'une saisie.
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_origin_known"
  CHECK ("origin" IS NULL OR "origin" IN ('BANQUE')) NOT VALID;

-- 6. Une demande approuvée porte forcément le prospect qu'elle a produit, une
--    demande refusée porte forcément son motif. Sans ces deux contraintes,
--    l'écran d'arbitrage peut afficher « approuvée » sans rien à ouvrir.
ALTER TABLE "client_creation_requests" ADD CONSTRAINT "client_creation_requests_approved_has_prospect"
  CHECK ("status" <> 'APPROVED' OR "createdProspectId" IS NOT NULL);

ALTER TABLE "client_creation_requests" ADD CONSTRAINT "client_creation_requests_rejected_has_note"
  CHECK (
    "status" <> 'REJECTED'
    OR ("rejectionNote" IS NOT NULL AND length(btrim("rejectionNote")) > 0)
  );

-- 7. Un seul dossier EN ATTENTE par numéro. Le pré-contrôle applicatif
--    (`client-requests.service.ts`) lit puis écrit : deux agents de deux
--    banques qui déposent le même numéro à la même seconde le franchissent
--    tous les deux, et l'administrateur se retrouve à arbitrer deux fois la
--    même personne, dont la seconde approbation échouera sur l'unicité du
--    téléphone du prospect sans qu'aucun message ne l'explique.
--
--    Index PARTIEL sur PENDING seulement : un numéro refusé doit pouvoir être
--    redéposé, et un numéro approuvé garde sa demande historique. L'unicité ne
--    porte donc que sur la file d'attente. Prisma ne sait pas exprimer la
--    clause `WHERE` : l'index vit ici, comme
--    `representants_phone_e164_active_key`.
CREATE UNIQUE INDEX "client_creation_requests_pending_phone_key"
  ON "client_creation_requests" ("phoneE164")
  WHERE status = 'PENDING';
