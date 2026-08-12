-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "ProspectStatut" AS ENUM ('NOUVEAU', 'CONTACTE', 'CONVERTI', 'PERDU');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OperationResult" AS ENUM ('APPLIED', 'DUPLICATE', 'CONFLICT', 'INVALID', 'SKIPPED_DEPENDENCY_FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneE164" TEXT,
    "role" "Role" NOT NULL DEFAULT 'COMMERCIAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "departementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banques" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syndicats" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sigle" TEXT NOT NULL,
    "secteur" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syndicats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "representants" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "notes" TEXT,
    "rev" INTEGER NOT NULL DEFAULT 1,
    "departementId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "clientCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "representants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "rev" INTEGER NOT NULL DEFAULT 1,
    "banqueId" TEXT NOT NULL,
    "syndicatId" TEXT NOT NULL,
    "representantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "statut" "ProspectStatut" NOT NULL DEFAULT 'NOUVEAU',
    "clientCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_batches" (
    "idempotency_key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "httpStatus" INTEGER,
    "responseJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_batches_pkey" PRIMARY KEY ("userId","idempotency_key")
);

-- CreateTable
CREATE TABLE "sync_operations" (
    "opId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "result" "OperationResult" NOT NULL,
    "resultJson" JSONB,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("opId")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_revokedAt_idx" ON "refresh_tokens"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "regions_code_key" ON "regions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departements_code_key" ON "departements"("code");

-- CreateIndex
CREATE INDEX "departements_updatedAt_idx" ON "departements"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "departements_regionId_name_key" ON "departements"("regionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "banques_name_key" ON "banques"("name");

-- CreateIndex
CREATE UNIQUE INDEX "banques_shortName_key" ON "banques"("shortName");

-- CreateIndex
CREATE INDEX "banques_updatedAt_idx" ON "banques"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "syndicats_name_key" ON "syndicats"("name");

-- CreateIndex
CREATE UNIQUE INDEX "syndicats_sigle_key" ON "syndicats"("sigle");

-- CreateIndex
CREATE INDEX "syndicats_updatedAt_idx" ON "syndicats"("updatedAt");

-- CreateIndex
CREATE INDEX "representants_phoneE164_idx" ON "representants"("phoneE164");

-- CreateIndex
CREATE INDEX "representants_createdById_idx" ON "representants"("createdById");

-- CreateIndex
CREATE INDEX "representants_departementId_idx" ON "representants"("departementId");

-- CreateIndex
CREATE INDEX "representants_updatedAt_id_idx" ON "representants"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "representants_deletedAt_idx" ON "representants"("deletedAt");

-- CreateIndex
CREATE INDEX "prospects_phoneE164_idx" ON "prospects"("phoneE164");

-- CreateIndex
CREATE INDEX "prospects_representantId_idx" ON "prospects"("representantId");

-- CreateIndex
CREATE INDEX "prospects_createdById_idx" ON "prospects"("createdById");

-- CreateIndex
CREATE INDEX "prospects_banqueId_idx" ON "prospects"("banqueId");

-- CreateIndex
CREATE INDEX "prospects_syndicatId_idx" ON "prospects"("syndicatId");

-- CreateIndex
CREATE INDEX "prospects_statut_idx" ON "prospects"("statut");

-- CreateIndex
CREATE INDEX "prospects_clientCreatedAt_idx" ON "prospects"("clientCreatedAt");

-- CreateIndex
CREATE INDEX "prospects_updatedAt_id_idx" ON "prospects"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "prospects_deletedAt_idx" ON "prospects"("deletedAt");

-- CreateIndex
CREATE INDEX "sync_batches_expiresAt_idx" ON "sync_batches"("expiresAt");

-- CreateIndex
CREATE INDEX "sync_operations_userId_appliedAt_idx" ON "sync_operations"("userId", "appliedAt");

-- CreateIndex
CREATE INDEX "sync_operations_entityId_idx" ON "sync_operations"("entityId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_at_idx" ON "audit_logs"("userId", "at");

-- CreateIndex
CREATE INDEX "audit_logs_at_idx" ON "audit_logs"("at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "departements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departements" ADD CONSTRAINT "departements_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representants" ADD CONSTRAINT "representants_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "departements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representants" ADD CONSTRAINT "representants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_banqueId_fkey" FOREIGN KEY ("banqueId") REFERENCES "banques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_syndicatId_fkey" FOREIGN KEY ("syndicatId") REFERENCES "syndicats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES "representants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_batches" ADD CONSTRAINT "sync_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_userId_batchKey_fkey" FOREIGN KEY ("userId", "batchKey") REFERENCES "sync_batches"("userId", "idempotency_key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
