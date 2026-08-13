-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('ANNONCE', 'RAPPEL', 'CAMPAGNE', 'DOSSIER', 'SYSTEME');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('ALL', 'ROLE', 'DEPARTEMENT', 'USERS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SCHEDULED', 'SENDING', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'ANDROID',
    "appVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "pendingOps" INTEGER NOT NULL DEFAULT 0,
    "pendingSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'ANNONCE',
    "titleTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "route" TEXT,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'ANNONCE',
    "route" TEXT,
    "payload" JSONB,
    "audience" "NotificationAudience" NOT NULL DEFAULT 'ALL',
    "audienceRole" "Role",
    "audienceDepartementId" TEXT,
    "audienceUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "transportStatus" TEXT,
    "templateId" TEXT,
    "createdById" TEXT,
    "reminderKey" TEXT,
    "period" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "deviceToken" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "reminderKey" TEXT,
    "period" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_userId_revokedAt_idx" ON "device_tokens"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "device_tokens_revokedAt_idx" ON "device_tokens"("revokedAt");

-- CreateIndex
CREATE INDEX "device_tokens_isDemo_idx" ON "device_tokens"("isDemo");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_name_key" ON "notification_templates"("name");

-- CreateIndex
CREATE INDEX "notification_templates_category_idx" ON "notification_templates"("category");

-- CreateIndex
CREATE INDEX "notification_templates_isDemo_idx" ON "notification_templates"("isDemo");

-- CreateIndex
CREATE INDEX "notifications_status_scheduledFor_idx" ON "notifications"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_category_idx" ON "notifications"("category");

-- CreateIndex
CREATE INDEX "notifications_createdById_idx" ON "notifications"("createdById");

-- CreateIndex
CREATE INDEX "notifications_isDemo_idx" ON "notifications"("isDemo");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_reminderKey_period_key" ON "notifications"("reminderKey", "period");

-- CreateIndex
CREATE INDEX "notification_deliveries_userId_status_idx" ON "notification_deliveries"("userId", "status");

-- CreateIndex
CREATE INDEX "notification_deliveries_userId_createdAt_idx" ON "notification_deliveries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_deliveries_notificationId_status_idx" ON "notification_deliveries"("notificationId", "status");

-- CreateIndex
CREATE INDEX "notification_deliveries_isDemo_idx" ON "notification_deliveries"("isDemo");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notificationId_userId_key" ON "notification_deliveries"("notificationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_reminderKey_userId_period_key" ON "notification_deliveries"("reminderKey", "userId", "period");

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_audienceDepartementId_fkey" FOREIGN KEY ("audienceDepartementId") REFERENCES "departements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
