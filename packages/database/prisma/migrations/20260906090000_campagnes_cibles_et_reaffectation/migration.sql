-- Deux nouvelles cibles de campagne, et la trace des reaffectations.
--
-- Migration PUREMENT ADDITIVE : deux valeurs d'enum et une table. Aucune ligne
-- existante ne change, la version precedente de l'API les ignore.

ALTER TYPE "LotExportCible" ADD VALUE 'REPRESENTANTS_INJOIGNABLES';
ALTER TYPE "LotExportCible" ADD VALUE 'CONTACTS_RECOMMANDES';

CREATE TABLE "lot_export_reaffectations" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "fromAssigneeId" TEXT,
    "toAssigneeId" TEXT NOT NULL,
    "fiches" INTEGER NOT NULL,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_export_reaffectations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lot_export_reaffectations_lotId_createdAt_idx" ON "lot_export_reaffectations"("lotId", "createdAt");

ALTER TABLE "lot_export_reaffectations" ADD CONSTRAINT "lot_export_reaffectations_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots_export"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lot_export_reaffectations" ADD CONSTRAINT "lot_export_reaffectations_fromAssigneeId_fkey" FOREIGN KEY ("fromAssigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lot_export_reaffectations" ADD CONSTRAINT "lot_export_reaffectations_toAssigneeId_fkey" FOREIGN KEY ("toAssigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lot_export_reaffectations" ADD CONSTRAINT "lot_export_reaffectations_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
