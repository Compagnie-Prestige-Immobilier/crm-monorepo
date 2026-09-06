-- EB-31 : le role Charge de clientele, et la revue d'une demande convertie
-- avant sa transmission a l'enrolement.
--
-- Migration PUREMENT ADDITIVE. La valeur ajoutee a l'enumeration n'est employee
-- nulle part dans ce fichier : PostgreSQL refuse une valeur creee et utilisee
-- dans la meme transaction, et `migrate deploy` en ouvre une par migration.
ALTER TYPE "Role" ADD VALUE 'CHARGE_CLIENTELE';

-- AlterTable
ALTER TABLE "prospects" ADD COLUMN     "revueAt" TIMESTAMP(3),
ADD COLUMN     "revueById" TEXT;

-- AddForeignKey
-- SetNull comme `enrollmentCapturedById` : le depart d'un compte ne retient pas
-- la fiche, et la date garde la preuve que la revue a eu lieu.
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_revueById_fkey" FOREIGN KEY ("revueById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
