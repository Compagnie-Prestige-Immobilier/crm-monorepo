-- AlterTable
ALTER TABLE "representants" ADD COLUMN     "iefId" TEXT;

-- CreateTable
CREATE TABLE "iefs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departementId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "iefs_code_key" ON "iefs"("code");

-- CreateIndex
CREATE INDEX "iefs_updatedAt_idx" ON "iefs"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "iefs_departementId_name_key" ON "iefs"("departementId", "name");

-- AddForeignKey
ALTER TABLE "iefs" ADD CONSTRAINT "iefs_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "departements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representants" ADD CONSTRAINT "representants_iefId_fkey" FOREIGN KEY ("iefId") REFERENCES "iefs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
