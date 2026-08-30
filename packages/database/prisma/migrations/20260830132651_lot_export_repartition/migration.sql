-- AlterTable
ALTER TABLE "lot_export_items" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "day" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "lot_export_items_lotId_assigneeId_day_idx" ON "lot_export_items"("lotId", "assigneeId", "day");

-- AddForeignKey
ALTER TABLE "lot_export_items" ADD CONSTRAINT "lot_export_items_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
