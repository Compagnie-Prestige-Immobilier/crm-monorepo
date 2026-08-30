CREATE TYPE "LotExportCible" AS ENUM ('REPRESENTANTS', 'PROSPECTS');

CREATE TABLE "lots_export" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cible" "LotExportCible" NOT NULL,
    "projet" "Projet",
    "filters" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lots_export_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lot_export_items" (
    "lotId" TEXT NOT NULL,
    "representantId" TEXT,
    "prospectId" TEXT,
    "position" INTEGER NOT NULL,
    CONSTRAINT "lot_export_items_pkey" PRIMARY KEY ("lotId", "position")
);

CREATE INDEX "lots_export_cible_createdAt_idx" ON "lots_export"("cible", "createdAt");
CREATE INDEX "lots_export_createdById_createdAt_idx" ON "lots_export"("createdById", "createdAt");
CREATE INDEX "lot_export_items_representantId_idx" ON "lot_export_items"("representantId");
CREATE INDEX "lot_export_items_prospectId_idx" ON "lot_export_items"("prospectId");

ALTER TABLE "lots_export" ADD CONSTRAINT "lots_export_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lot_export_items" ADD CONSTRAINT "lot_export_items_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots_export"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lot_export_items" ADD CONSTRAINT "lot_export_items_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES "representants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lot_export_items" ADD CONSTRAINT "lot_export_items_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lot_export_items" ADD CONSTRAINT "lot_export_items_une_seule_cible" CHECK (num_nonnulls("representantId", "prospectId") = 1) NOT VALID;
