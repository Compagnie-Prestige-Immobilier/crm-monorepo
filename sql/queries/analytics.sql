-- Les requêtes brutes statiques de la v1, collées telles quelles (audits/go-donnees.md §1).

-- name: StockRepresentants :one
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE r."lastCallAt" IS NULL)::int AS jamais_appeles,
  COUNT(*) FILTER (
    WHERE sq."effect" = 'UNREACHABLE' AND sq."code" <> 'INJOIGNABLE_DEFINITIF'
  )::int AS injoignables
FROM "representants" r
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
WHERE r."deletedAt" IS NULL;

-- name: StockParDepartement :many
SELECT d."id", d."name" AS label, COUNT(r."id")::int AS count
FROM "departements" d
LEFT JOIN "representants" r ON r."departementId" = d."id" AND r."deletedAt" IS NULL
GROUP BY d."id", d."name"
ORDER BY count DESC, label ASC;

-- name: StockParIef :many
SELECT i."id", i."name" AS label, COUNT(r."id")::int AS count
FROM "iefs" i
LEFT JOIN "representants" r ON r."iefId" = i."id" AND r."deletedAt" IS NULL
GROUP BY i."id", i."name"
ORDER BY count DESC, label ASC;

-- name: ConversionEnrolement :one
SELECT COUNT(*)::int AS convertis,
       COUNT(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM "inscriptions_plateforme" i
         WHERE i."prospectId" = p."id"
           AND i."projet" = @projet::"Projet"
           AND i."disparueLe" IS NULL
       ))::int AS inscrits
FROM "prospects" p
WHERE p."projet" = @projet::"Projet"
  AND p."deletedAt" IS NULL
  AND p."phase2Status" = 'METHOD_OBTAINED';

-- name: LotStatsRepresentants :one
SELECT COUNT(*)::int AS calls, COUNT(DISTINCT a."representantId")::int AS fiches
FROM "lot_export_items" i
INNER JOIN "rep_call_attempts" a ON a."representantId" = i."representantId"
WHERE i."lotId" = $1 AND a."clientCreatedAt" >= $2;

-- name: LotStatsProspects :one
SELECT COUNT(*)::int AS calls, COUNT(DISTINCT a."prospectId")::int AS fiches
FROM "lot_export_items" i
INNER JOIN "call_attempts" a ON a."prospectId" = i."prospectId"
WHERE i."lotId" = $1 AND a."clientCreatedAt" >= $2;

-- name: LotAppelsParAgentRepresentants :many
SELECT u."fullName" AS name, COUNT(*)::int AS calls
FROM "rep_call_attempts" a
INNER JOIN "lot_export_items" i ON i."representantId" = a."representantId"
INNER JOIN "users" u ON u."id" = a."performedById"
WHERE i."lotId" = $1 AND a."clientCreatedAt" >= $2
GROUP BY u."id", u."fullName";

-- name: LotAppelsParAgentProspects :many
SELECT u."fullName" AS name, COUNT(*)::int AS calls
FROM "call_attempts" a
INNER JOIN "lot_export_items" i ON i."prospectId" = a."prospectId"
INNER JOIN "users" u ON u."id" = a."performedById"
WHERE i."lotId" = $1 AND a."clientCreatedAt" >= $2
GROUP BY u."id", u."fullName";

-- name: LotPositionsAppeleesRepresentants :many
SELECT DISTINCT i.position FROM "lot_export_items" i
INNER JOIN "rep_call_attempts" a ON a."representantId" = i."representantId"
WHERE i."lotId" = $1 AND a."clientCreatedAt" >= $2;

-- name: LotPositionsAppeleesProspects :many
SELECT DISTINCT i.position FROM "lot_export_items" i
INNER JOIN "call_attempts" a ON a."prospectId" = i."prospectId"
WHERE i."lotId" = $1 AND a."clientCreatedAt" >= $2;

-- name: LockStagePosition :exec
SELECT pg_advisory_xact_lock($1);

-- name: CreneauxTravail :one
SELECT value, "updatedAt" FROM "app_settings" WHERE key = 'supervision.creneaux';

-- name: EnregistrerCreneauxTravail :one
INSERT INTO "app_settings" (key, value, "updatedById", "updatedAt")
VALUES ('supervision.creneaux', $1, $2, now())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, "updatedById" = EXCLUDED."updatedById", "updatedAt" = now()
RETURNING "updatedAt";
