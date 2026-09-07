-- EB-29 : chaque modification d'un reglage est tracee, ancienne valeur comprise.
--
-- `app_settings` ecrase : elle porte son dernier auteur et sa derniere date,
-- jamais ce que la valeur disait la veille. Cette table est append-only.
--
-- Migration PUREMENT ADDITIVE : une table. Aucune ligne existante ne change,
-- et la version precedente de l'API l'ignore.

CREATE TABLE "app_setting_changes" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_setting_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_setting_changes_key_changedAt_idx" ON "app_setting_changes"("key", "changedAt");

ALTER TABLE "app_setting_changes" ADD CONSTRAINT "app_setting_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
