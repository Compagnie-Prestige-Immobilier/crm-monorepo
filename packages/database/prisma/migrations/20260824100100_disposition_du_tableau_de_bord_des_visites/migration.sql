-- Les deux tables naissent vides : la validation des clés étrangères ne coûte
-- rien et il n'y a pas lieu de les poser `NOT VALID`. Le `lock_timeout` protège
-- `users` et `import_jobs`, dont la référence prend un verrou.
SET LOCAL lock_timeout = '3s';

-- Lignes RÉÉCRITES par un import. Seul l'aller-retour du registre en produit.
ALTER TABLE "import_jobs" ADD COLUMN "updatedRows" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "visite_dashboard_layouts" (
    "userId"    TEXT NOT NULL,
    "layout"    JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visite_dashboard_layouts_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "visite_dashboard_layouts"
  ADD CONSTRAINT "visite_dashboard_layouts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "VisiteImportChangeKind" AS ENUM ('CREATE', 'UPDATE');

CREATE TABLE "visite_import_changes" (
    "id"          TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "sheet"       TEXT NOT NULL,
    "rowNumber"   INTEGER NOT NULL,
    "kind"        "VisiteImportChangeKind" NOT NULL,
    "reference"   TEXT,
    "visiteId"    TEXT,
    "label"       TEXT NOT NULL,
    "fields"      JSONB NOT NULL,
    "rowHash"     TEXT,
    "selected"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visite_import_changes_pkey" PRIMARY KEY ("id")
);

-- La jointure entre la simulation et l'application : celle-ci relit le même
-- fichier et retrouve les mêmes numéros de ligne. Elle rend aussi le
-- `createMany` de la simulation idempotent si une tranche est rejouée.
CREATE UNIQUE INDEX "visite_import_changes_importJobId_sheet_rowNumber_key"
  ON "visite_import_changes" ("importJobId", "sheet", "rowNumber");
CREATE INDEX "visite_import_changes_importJobId_kind_idx"
  ON "visite_import_changes" ("importJobId", "kind");

ALTER TABLE "visite_import_changes"
  ADD CONSTRAINT "visite_import_changes_importJobId_fkey"
  FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
