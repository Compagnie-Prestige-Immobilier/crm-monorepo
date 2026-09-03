-- Degre d'interet recueilli en qualifiant un representant.
--
-- Migration PUREMENT ADDITIVE : elle n'ajoute que des tables et des colonnes,
-- donc la version precedente de l'application ignore ce qu'elle ne connait pas
-- et le retour arriere ne touche pas la base. Voir docs/migrations-en-attente.md
-- pour ce qu'une seule suppression couterait.

CREATE TYPE "StatutQualificationEffect" AS ENUM (
  'REACHED',
  'REFUSED',
  'SCHEDULE_CALLBACK',
  'UNREACHABLE',
  'WRONG_NUMBER'
);

CREATE TABLE "statuts_qualification" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "effect" "StatutQualificationEffect" NOT NULL,
    "requiresCallback" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "minPayloadVersion" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statuts_qualification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "statuts_qualification_code_key" ON "statuts_qualification"("code");
CREATE UNIQUE INDEX "statuts_qualification_label_key" ON "statuts_qualification"("label");
CREATE INDEX "statuts_qualification_isActive_sortOrder_idx" ON "statuts_qualification"("isActive", "sortOrder");

-- Les deux colonnes sont NULLABLES et sans defaut : les fiches deja en base
-- n'ont jamais eu la question posee, et un defaut leur inventerait une reponse.
ALTER TABLE "representants" ADD COLUMN "statutQualificationId" TEXT;
ALTER TABLE "rep_call_attempts" ADD COLUMN "statutQualificationId" TEXT;

-- Le filtre de l'annuaire, puis l'axe de tirage d'un lot : le tirage borne par
-- IEF avant de trier, d'ou le composite en plus du simple.
CREATE INDEX "representants_statutQualificationId_idx" ON "representants"("statutQualificationId");
CREATE INDEX "representants_statutQualificationId_iefId_idx" ON "representants"("statutQualificationId", "iefId");

ALTER TABLE "representants" ADD CONSTRAINT "representants_statutQualificationId_fkey"
  FOREIGN KEY ("statutQualificationId") REFERENCES "statuts_qualification"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rep_call_attempts" ADD CONSTRAINT "rep_call_attempts_statutQualificationId_fkey"
  FOREIGN KEY ("statutQualificationId") REFERENCES "statuts_qualification"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
