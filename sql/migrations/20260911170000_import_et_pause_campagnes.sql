-- +goose Up
ALTER TABLE "prospects" ADD COLUMN "importJobId" text REFERENCES "import_jobs" ("id") ON DELETE SET NULL;
CREATE INDEX "prospects_importJobId_idx" ON "prospects" ("importJobId") WHERE "importJobId" IS NOT NULL;
ALTER TABLE "lots_export" ADD COLUMN "pausedAt" timestamp(3) without time zone;

-- +goose Down
ALTER TABLE "lots_export" DROP COLUMN "pausedAt";
ALTER TABLE "prospects" DROP COLUMN "importJobId";
