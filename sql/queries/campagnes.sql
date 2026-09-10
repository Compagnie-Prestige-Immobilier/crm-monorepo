-- name: LotParId :one
SELECT l."id", l."name", l."cible", l."projet", l."filters", l."itemCount",
       l."createdById", l."createdAt", u."fullName" AS "createdByName"
FROM "lots_export" l
INNER JOIN "users" u ON u."id" = l."createdById"
WHERE l."id" = $1;

-- name: CompterLots :one
SELECT COUNT(*)::int
FROM "lots_export" l
WHERE (sqlc.narg('search')::text IS NULL OR l."name" ILIKE '%' || sqlc.narg('search')::text || '%')
  AND (sqlc.narg('cible')::"LotExportCible" IS NULL OR l."cible" = sqlc.narg('cible'))
  AND (sqlc.narg('projet')::"Projet" IS NULL OR l."projet" = sqlc.narg('projet'))
  AND (sqlc.narg('created_by')::text IS NULL OR l."createdById" = sqlc.narg('created_by'))
  AND (sqlc.narg('date_from')::timestamp IS NULL OR l."createdAt" >= sqlc.narg('date_from'))
  AND (sqlc.narg('date_to')::timestamp IS NULL OR l."createdAt" <= sqlc.narg('date_to'));

-- name: ListerLots :many
SELECT l."id", l."name", l."cible", l."projet", l."filters", l."itemCount",
       l."createdById", l."createdAt", u."fullName" AS "createdByName"
FROM "lots_export" l
INNER JOIN "users" u ON u."id" = l."createdById"
WHERE (sqlc.narg('search')::text IS NULL OR l."name" ILIKE '%' || sqlc.narg('search')::text || '%')
  AND (sqlc.narg('cible')::"LotExportCible" IS NULL OR l."cible" = sqlc.narg('cible'))
  AND (sqlc.narg('projet')::"Projet" IS NULL OR l."projet" = sqlc.narg('projet'))
  AND (sqlc.narg('created_by')::text IS NULL OR l."createdById" = sqlc.narg('created_by'))
  AND (sqlc.narg('date_from')::timestamp IS NULL OR l."createdAt" >= sqlc.narg('date_from'))
  AND (sqlc.narg('date_to')::timestamp IS NULL OR l."createdAt" <= sqlc.narg('date_to'))
ORDER BY l."createdAt" DESC, l."id" DESC
LIMIT $1 OFFSET $2;

-- name: InsertLot :exec
INSERT INTO "lots_export" ("id", "name", "cible", "projet", "filters", "itemCount", "createdById")
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: InsertLotItems :copyfrom
INSERT INTO "lot_export_items" ("lotId", "representantId", "prospectId", "position", "assigneeId", "day")
VALUES ($1, $2, $3, $4, $5, $6);

-- name: RenommerLot :exec
UPDATE "lots_export" SET "name" = $2 WHERE "id" = $1;

-- name: EcrireFiltresLot :exec
UPDATE "lots_export" SET "filters" = $2 WHERE "id" = $1;

-- name: SupprimerLot :execrows
DELETE FROM "lots_export" WHERE "id" = $1;

-- name: LotGroupes :many
SELECT i."assigneeId", i."day", COUNT(*)::int AS fiches, MIN(i."position")::int AS "minPosition"
FROM "lot_export_items" i
WHERE i."lotId" = $1
GROUP BY i."assigneeId", i."day";

-- name: LotProgrammes :many
SELECT i."assigneeId", i."day", MIN(i."position")::int AS "minPosition"
FROM "lot_export_items" i
WHERE i."lotId" = $1 AND i."assigneeId" IS NOT NULL
GROUP BY i."assigneeId", i."day"
ORDER BY MIN(i."position"), i."day";

-- name: LotJourMax :one
SELECT COALESCE(MAX(i."day"), 1)::int FROM "lot_export_items" i WHERE i."lotId" = $1;

-- name: LotFichesAttribuees :many
SELECT DISTINCT i."representantId", i."prospectId"
FROM "lot_export_items" i
WHERE i."assigneeId" = $1;

-- name: LotPositionsDeplacables :many
SELECT i."position", i."assigneeId"
FROM "lot_export_items" i
WHERE i."lotId" = $1 AND i."position" = ANY($2::int[]) AND i."assigneeId" IS DISTINCT FROM $3;

-- name: LotPositionsDunAgent :many
SELECT i."position"
FROM "lot_export_items" i
WHERE i."lotId" = $1 AND i."assigneeId" = $2
ORDER BY i."position";

-- name: LotTenuesAuxPositions :many
SELECT i."position", i."assigneeId"
FROM "lot_export_items" i
WHERE i."lotId" = $1 AND i."position" = ANY($2::int[]);

-- name: DeplacerPositions :exec
UPDATE "lot_export_items" SET "assigneeId" = $3
WHERE "lotId" = $1 AND "position" = ANY($2::int[]);

-- name: InsertReaffectation :exec
INSERT INTO "lot_export_reaffectations"
  ("id", "lotId", "fromAssigneeId", "toAssigneeId", "fiches", "positions", "performedById")
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: LotReaffectations :many
SELECT r."id", f."fullName" AS "fromName", r."toAssigneeId", t."fullName" AS "toName",
       r."fiches", r."positions", p."fullName" AS "performedByName", r."createdAt"
FROM "lot_export_reaffectations" r
LEFT JOIN "users" f ON f."id" = r."fromAssigneeId"
INNER JOIN "users" t ON t."id" = r."toAssigneeId"
INNER JOIN "users" p ON p."id" = r."performedById"
WHERE r."lotId" = $1
ORDER BY r."createdAt" DESC, r."id" DESC
LIMIT 100;

-- name: LotReaffectationsRecues :many
SELECT r."positions", r."createdAt"
FROM "lot_export_reaffectations" r
WHERE r."lotId" = $1 AND r."toAssigneeId" = $2
  AND (sqlc.narg('reaffectation_id')::text IS NULL OR r."id" = sqlc.narg('reaffectation_id'))
ORDER BY r."createdAt" DESC;

-- name: Teleconseillers :many
SELECT u."id", u."fullName", u."role"
FROM "users" u
WHERE u."id" = ANY($1::text[]) AND u."isActive" AND u."deletedAt" IS NULL
  AND u."role" IN ('COMMERCIAL', 'SUPERVISEUR', 'DIRECTION');

-- name: NomsUtilisateurs :many
SELECT u."id", u."fullName" FROM "users" u WHERE u."id" = ANY($1::text[]);

-- name: LotPerformanceRepresentants :many
WITH membres AS (
  SELECT i."assigneeId" AS id, u."fullName" AS name, u."role" AS role, COUNT(*)::int AS assigned
  FROM "lot_export_items" i
  INNER JOIN "users" u ON u."id" = i."assigneeId"
  WHERE i."lotId" = $1
  GROUP BY i."assigneeId", u."fullName", u."role"
), conformes AS (
  SELECT i."assigneeId" AS id,
         COUNT(a."representantId")::int AS "assignedCalls",
         COUNT(DISTINCT i."position")::int AS treated
  FROM "lot_export_items" i
  INNER JOIN "rep_call_attempts" a
    ON a."representantId" = i."representantId"
   AND a."performedById" = i."assigneeId"
   AND a."clientCreatedAt" >= $2
  WHERE i."lotId" = $1
  GROUP BY i."assigneeId"
), hors_attribution AS (
  SELECT a."performedById" AS id, COUNT(*)::int AS "outsideAssignmentCalls"
  FROM "lot_export_items" i
  INNER JOIN "rep_call_attempts" a
    ON a."representantId" = i."representantId"
   AND a."performedById" <> i."assigneeId"
   AND a."clientCreatedAt" >= $2
  WHERE i."lotId" = $1
    AND a."performedById" IN (
      SELECT own."assigneeId" FROM "lot_export_items" own
      WHERE own."lotId" = $1 AND own."assigneeId" IS NOT NULL
    )
  GROUP BY a."performedById"
)
SELECT m.id, m.name, m.role, m.assigned,
       COALESCE(c.treated, 0)::int AS treated,
       COALESCE(c."assignedCalls", 0)::int AS "assignedCalls",
       COALESCE(h."outsideAssignmentCalls", 0)::int AS "outsideAssignmentCalls"
FROM membres m
LEFT JOIN conformes c ON c.id = m.id
LEFT JOIN hors_attribution h ON h.id = m.id
ORDER BY m.name ASC;

-- name: LotPerformanceProspects :many
WITH membres AS (
  SELECT i."assigneeId" AS id, u."fullName" AS name, u."role" AS role, COUNT(*)::int AS assigned
  FROM "lot_export_items" i
  INNER JOIN "users" u ON u."id" = i."assigneeId"
  WHERE i."lotId" = $1
  GROUP BY i."assigneeId", u."fullName", u."role"
), conformes AS (
  SELECT i."assigneeId" AS id,
         COUNT(a."prospectId")::int AS "assignedCalls",
         COUNT(DISTINCT i."position")::int AS treated
  FROM "lot_export_items" i
  INNER JOIN "call_attempts" a
    ON a."prospectId" = i."prospectId"
   AND a."performedById" = i."assigneeId"
   AND a."clientCreatedAt" >= $2
  WHERE i."lotId" = $1
  GROUP BY i."assigneeId"
), hors_attribution AS (
  SELECT a."performedById" AS id, COUNT(*)::int AS "outsideAssignmentCalls"
  FROM "lot_export_items" i
  INNER JOIN "call_attempts" a
    ON a."prospectId" = i."prospectId"
   AND a."performedById" <> i."assigneeId"
   AND a."clientCreatedAt" >= $2
  WHERE i."lotId" = $1
    AND a."performedById" IN (
      SELECT own."assigneeId" FROM "lot_export_items" own
      WHERE own."lotId" = $1 AND own."assigneeId" IS NOT NULL
    )
  GROUP BY a."performedById"
)
SELECT m.id, m.name, m.role, m.assigned,
       COALESCE(c.treated, 0)::int AS treated,
       COALESCE(c."assignedCalls", 0)::int AS "assignedCalls",
       COALESCE(h."outsideAssignmentCalls", 0)::int AS "outsideAssignmentCalls"
FROM membres m
LEFT JOIN conformes c ON c.id = m.id
LEFT JOIN hors_attribution h ON h.id = m.id
ORDER BY m.name ASC;

-- name: LotAttemptsRepresentants :many
SELECT a."id", r."phoneE164", a."outcome"::text AS outcome, a."comment",
       u."fullName" AS "performedByName", a."createdAt"
FROM "rep_call_attempts" a
INNER JOIN "representants" r ON r."id" = a."representantId"
INNER JOIN "users" u ON u."id" = a."performedById"
WHERE a."clientCreatedAt" >= $2
  AND EXISTS (
    SELECT 1 FROM "lot_export_items" i
    WHERE i."lotId" = $1 AND i."representantId" = a."representantId"
  )
ORDER BY a."clientCreatedAt" DESC, a."id" DESC
LIMIT 50;

-- name: LotAttemptsProspects :many
SELECT a."id", p."phoneE164", a."outcome"::text AS outcome,
       COALESCE(a."method"::text, '')::text AS method,
       a."comment", u."fullName" AS "performedByName", a."createdAt", a."email",
       a."fonctionnaire", a."engagementEnCours", a."dureeEtablissementMois", a."rendezVousAt"
FROM "call_attempts" a
INNER JOIN "prospects" p ON p."id" = a."prospectId"
INNER JOIN "users" u ON u."id" = a."performedById"
WHERE a."clientCreatedAt" >= $2
  AND EXISTS (
    SELECT 1 FROM "lot_export_items" i
    WHERE i."lotId" = $1 AND i."prospectId" = a."prospectId"
  )
ORDER BY a."clientCreatedAt" DESC, a."id" DESC
LIMIT 50;

-- name: LotFichesRepresentants :many
SELECT i."position", i."day", i."assigneeId", u."fullName" AS "assigneeName",
       r."id" AS "ficheId", r."fullName", r."phoneE164", r."nextCallbackAt",
       sq."label" AS "statutLabel"
FROM "lot_export_items" i
LEFT JOIN "users" u ON u."id" = i."assigneeId"
LEFT JOIN "representants" r ON r."id" = i."representantId"
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
WHERE i."lotId" = $1
  AND (sqlc.narg('assignee_id')::text IS NULL OR i."assigneeId" = sqlc.narg('assignee_id'))
ORDER BY i."position";

-- name: LotFichesProspects :many
SELECT i."position", i."day", i."assigneeId", u."fullName" AS "assigneeName",
       p."id" AS "ficheId", p."nom", p."prenom", p."phoneE164",
       COALESCE(p."lastCallOutcome"::text, '')::text AS "lastCallOutcome"
FROM "lot_export_items" i
LEFT JOIN "users" u ON u."id" = i."assigneeId"
LEFT JOIN "prospects" p ON p."id" = i."prospectId"
WHERE i."lotId" = $1
  AND (sqlc.narg('assignee_id')::text IS NULL OR i."assigneeId" = sqlc.narg('assignee_id'))
ORDER BY i."position";

-- name: LotLignesRepresentants :many
SELECT i."position", i."day", i."assigneeId", u."fullName" AS "assigneeName", r."fullName", r."phoneE164",
       d."name" AS departement, ief."name" AS ief, c."fullName" AS commercial,
       r."notes", r."clientCreatedAt"
FROM "lot_export_items" i
INNER JOIN "representants" r ON r."id" = i."representantId"
INNER JOIN "departements" d ON d."id" = r."departementId"
INNER JOIN "users" c ON c."id" = r."createdById"
LEFT JOIN "users" u ON u."id" = i."assigneeId"
LEFT JOIN "iefs" ief ON ief."id" = r."iefId"
WHERE i."lotId" = $1
ORDER BY i."position";

-- name: LotLignesProspects :many
SELECT i."position", i."day", i."assigneeId", u."fullName" AS "assigneeName", p."nom", p."prenom", p."phoneE164",
       b."name" AS banque, s."sigle" AS syndicat, rep."fullName" AS representant,
       d."name" AS departement, c."fullName" AS commercial, p."clientCreatedAt"
FROM "lot_export_items" i
INNER JOIN "prospects" p ON p."id" = i."prospectId"
INNER JOIN "users" c ON c."id" = p."createdById"
LEFT JOIN "users" u ON u."id" = i."assigneeId"
LEFT JOIN "banques" b ON b."id" = p."banqueId"
LEFT JOIN "syndicats" s ON s."id" = p."syndicatId"
LEFT JOIN "representants" rep ON rep."id" = p."representantId"
LEFT JOIN "departements" d ON d."id" = rep."departementId"
WHERE i."lotId" = $1
ORDER BY i."position";

-- name: LotItemsPourPdfJour :many
SELECT u."fullName" AS "assigneeName", r."fullName" AS "repName", r."etablissement",
       r."phoneE164" AS "repPhone", p."nom", p."prenom", p."phoneE164" AS "prospectPhone"
FROM "lot_export_items" i
LEFT JOIN "users" u ON u."id" = i."assigneeId"
LEFT JOIN "representants" r ON r."id" = i."representantId"
LEFT JOIN "prospects" p ON p."id" = i."prospectId"
WHERE i."lotId" = $1 AND i."assigneeId" = $2 AND i."day" = $3
ORDER BY i."position";

-- name: LotItemsPourPdfPositions :many
SELECT u."fullName" AS "assigneeName", r."fullName" AS "repName", r."etablissement",
       r."phoneE164" AS "repPhone", p."nom", p."prenom", p."phoneE164" AS "prospectPhone"
FROM "lot_export_items" i
LEFT JOIN "users" u ON u."id" = i."assigneeId"
LEFT JOIN "representants" r ON r."id" = i."representantId"
LEFT JOIN "prospects" p ON p."id" = i."prospectId"
WHERE i."lotId" = $1 AND i."assigneeId" = $2 AND i."position" = ANY($3::int[])
ORDER BY i."position";

-- name: CompterRepresentantsCible :one
SELECT COUNT(*)::int
FROM "representants" r
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
WHERE r."deletedAt" IS NULL
  AND (sqlc.narg('departement_id')::text IS NULL OR r."departementId" = sqlc.narg('departement_id'))
  AND (sqlc.narg('ief_id')::text IS NULL OR r."iefId" = sqlc.narg('ief_id'))
  AND (sqlc.narg('relation_status')::"RepresentantRelation" IS NULL OR r."relationStatus" = sqlc.narg('relation_status'))
  AND (NOT sqlc.arg('injoignables')::boolean
       OR (r."lastCallOutcome" = 'UNREACHABLE' AND sq."effect" = 'UNREACHABLE' AND sq."retryAfterMinutes" IS NOT NULL));

-- name: TirerRepresentantsCible :many
SELECT r."id"
FROM "representants" r
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
WHERE r."deletedAt" IS NULL
  AND (sqlc.narg('departement_id')::text IS NULL OR r."departementId" = sqlc.narg('departement_id'))
  AND (sqlc.narg('ief_id')::text IS NULL OR r."iefId" = sqlc.narg('ief_id'))
  AND (sqlc.narg('relation_status')::"RepresentantRelation" IS NULL OR r."relationStatus" = sqlc.narg('relation_status'))
  AND (NOT sqlc.arg('injoignables')::boolean
       OR (r."lastCallOutcome" = 'UNREACHABLE' AND sq."effect" = 'UNREACHABLE' AND sq."retryAfterMinutes" IS NOT NULL))
ORDER BY r."id" ASC
LIMIT sqlc.arg('places');

-- name: CompterProspectsCible :one
SELECT COUNT(*)::int
FROM "prospects" p
WHERE p."deletedAt" IS NULL
  AND (sqlc.narg('projet')::"Projet" IS NULL
       OR EXISTS (SELECT 1 FROM "prospect_journeys" j
                  WHERE j."prospectId" = p."id" AND j."projet" = sqlc.narg('projet')))
  AND (sqlc.narg('type')::"ProspectType" IS NULL OR p."type" = sqlc.narg('type'))
  AND (NOT sqlc.arg('par_segment')::boolean
       OR (EXISTS (SELECT 1 FROM "syndicats" s
                   WHERE s."id" = p."syndicatId" AND (s."sigle" = 'CHUES') = sqlc.arg('chues')::boolean)
       AND EXISTS (SELECT 1 FROM "banques" b
                   WHERE b."id" = p."banqueId" AND (b."shortName" = 'CBAO') = sqlc.arg('cbao')::boolean)));

-- name: TirerProspectsCible :many
SELECT p."id"
FROM "prospects" p
WHERE p."deletedAt" IS NULL
  AND (sqlc.narg('projet')::"Projet" IS NULL
       OR EXISTS (SELECT 1 FROM "prospect_journeys" j
                  WHERE j."prospectId" = p."id" AND j."projet" = sqlc.narg('projet')))
  AND (sqlc.narg('type')::"ProspectType" IS NULL OR p."type" = sqlc.narg('type'))
  AND (NOT sqlc.arg('par_segment')::boolean
       OR (EXISTS (SELECT 1 FROM "syndicats" s
                   WHERE s."id" = p."syndicatId" AND (s."sigle" = 'CHUES') = sqlc.arg('chues')::boolean)
       AND EXISTS (SELECT 1 FROM "banques" b
                   WHERE b."id" = p."banqueId" AND (b."shortName" = 'CBAO') = sqlc.arg('cbao')::boolean)))
ORDER BY p."id" ASC
LIMIT sqlc.arg('places');

-- name: CompterSuggestions :one
SELECT COUNT(DISTINCT s."suggestedPhoneE164")::int
FROM "representant_suggestions" s
INNER JOIN "representants" src ON src."id" = s."sourceRepresentantId"
WHERE s."deletedAt" IS NULL AND s."status" = 'A_APPELER' AND s."resolvedRepresentantId" IS NULL
  AND src."deletedAt" IS NULL
  AND (sqlc.narg('departement_id')::text IS NULL OR src."departementId" = sqlc.narg('departement_id'))
  AND (sqlc.narg('ief_id')::text IS NULL OR src."iefId" = sqlc.narg('ief_id'));

-- name: TirerSuggestions :many
SELECT s."id", s."suggestedName", s."suggestedPhoneE164", src."departementId", src."iefId"
FROM "representant_suggestions" s
INNER JOIN "representants" src ON src."id" = s."sourceRepresentantId"
WHERE s."deletedAt" IS NULL AND s."status" = 'A_APPELER' AND s."resolvedRepresentantId" IS NULL
  AND src."deletedAt" IS NULL
  AND (sqlc.narg('departement_id')::text IS NULL OR src."departementId" = sqlc.narg('departement_id'))
  AND (sqlc.narg('ief_id')::text IS NULL OR src."iefId" = sqlc.narg('ief_id'))
ORDER BY s."createdAt" ASC;

-- name: TelephonesRepresentantsConnus :many
SELECT r."phoneE164" FROM "representants" r
WHERE r."phoneE164" = ANY($1::text[]) AND r."deletedAt" IS NULL;

-- name: InsertRepresentantRecommande :exec
INSERT INTO "representants" ("id", "fullName", "phoneE164", "departementId", "iefId", "createdById", "clientCreatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: ResoudreSuggestion :exec
UPDATE "representant_suggestions" SET "resolvedRepresentantId" = $2 WHERE "id" = $1;
