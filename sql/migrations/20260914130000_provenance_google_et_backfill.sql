-- +goose Up
INSERT INTO "canaux_provenance" ("id", "code", "label", "position", "updatedAt")
VALUES (gen_random_uuid()::text, 'GOOGLE', 'Google (Search / Ads)', 22, now())
ON CONFLICT ("code") DO NOTHING;

-- Backfill des prospects Grand Public sans canal de provenance
UPDATE "prospects" p
SET "canalProvenanceId" = c."id"
FROM "canaux_provenance" c
WHERE p."canalProvenanceId" IS NULL
  AND p."projet" = 'GRAND_PUBLIC'
  AND (
    (c."code" = 'GOOGLE' AND (p."champsLibres"->>'feuille' ILIKE '%google%' OR p."champsLibres"->>'provenance' ILIKE '%google%'))
    OR (c."code" = 'META' AND (p."champsLibres"->>'feuille' ILIKE '%fb%' OR p."champsLibres"->>'feuille' ILIKE '%pay%' OR p."champsLibres"->>'provenance' ILIKE '%fb%' OR p."champsLibres"->>'provenance' ILIKE '%pay%'))
    OR (c."code" = 'SITE_WEB' AND (p."champsLibres"->>'feuille' ILIKE '%direct%' OR p."champsLibres"->>'provenance' ILIKE '%direct%'))
  );

-- +goose Down
-- Pas de revert nécessaire pour les données nettoyées
