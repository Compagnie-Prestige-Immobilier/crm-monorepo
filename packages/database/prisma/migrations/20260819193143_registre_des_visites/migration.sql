-- CreateTable
CREATE TABLE "visite_entreprises" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visite_entreprises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visite_directions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visite_directions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visite_destinataires" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visite_destinataires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visite_objets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visite_objets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visites" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "timeKnown" BOOLEAN NOT NULL DEFAULT true,
    "visitorName" TEXT NOT NULL,
    "phone" TEXT,
    "phoneE164" TEXT,
    "entrepriseId" TEXT NOT NULL,
    "objetId" TEXT NOT NULL,
    "directionId" TEXT,
    "destinataireId" TEXT,
    "comment" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "visites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visite_entreprises_code_key" ON "visite_entreprises"("code");

-- CreateIndex
CREATE UNIQUE INDEX "visite_entreprises_label_key" ON "visite_entreprises"("label");

-- CreateIndex
CREATE INDEX "visite_entreprises_isActive_sortOrder_idx" ON "visite_entreprises"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "visite_directions_code_key" ON "visite_directions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "visite_directions_label_key" ON "visite_directions"("label");

-- CreateIndex
CREATE INDEX "visite_directions_isActive_sortOrder_idx" ON "visite_directions"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "visite_destinataires_code_key" ON "visite_destinataires"("code");

-- CreateIndex
CREATE UNIQUE INDEX "visite_destinataires_label_key" ON "visite_destinataires"("label");

-- CreateIndex
CREATE INDEX "visite_destinataires_isActive_sortOrder_idx" ON "visite_destinataires"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "visite_objets_code_key" ON "visite_objets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "visite_objets_label_key" ON "visite_objets"("label");

-- CreateIndex
CREATE INDEX "visite_objets_isActive_sortOrder_idx" ON "visite_objets"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "visites_reference_key" ON "visites"("reference");

-- CreateIndex
CREATE INDEX "visites_visitedAt_idx" ON "visites"("visitedAt");

-- CreateIndex
CREATE INDEX "visites_entrepriseId_idx" ON "visites"("entrepriseId");

-- CreateIndex
CREATE INDEX "visites_directionId_idx" ON "visites"("directionId");

-- CreateIndex
CREATE INDEX "visites_destinataireId_idx" ON "visites"("destinataireId");

-- CreateIndex
CREATE INDEX "visites_objetId_idx" ON "visites"("objetId");

-- CreateIndex
CREATE INDEX "visites_createdById_idx" ON "visites"("createdById");

-- CreateIndex
CREATE INDEX "visites_isDemo_idx" ON "visites"("isDemo");

-- AddForeignKey
ALTER TABLE "visites" ADD CONSTRAINT "visites_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "visite_entreprises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visites" ADD CONSTRAINT "visites_objetId_fkey" FOREIGN KEY ("objetId") REFERENCES "visite_objets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visites" ADD CONSTRAINT "visites_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "visite_directions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visites" ADD CONSTRAINT "visites_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES "visite_destinataires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visites" ADD CONSTRAINT "visites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
