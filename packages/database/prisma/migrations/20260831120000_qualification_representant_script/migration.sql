-- AlterTable
ALTER TABLE "representants" ADD COLUMN     "connaitUES" BOOLEAN,
ADD COLUMN     "contacte" BOOLEAN,
ADD COLUMN     "syndicat" TEXT;

-- AlterTable
ALTER TABLE "rep_call_attempts" ADD COLUMN     "connaitUES" BOOLEAN,
ADD COLUMN     "contacte" BOOLEAN,
ADD COLUMN     "etablissementConfirme" BOOLEAN,
ADD COLUMN     "numeroConfirme" BOOLEAN,
ADD COLUMN     "syndicat" TEXT;
