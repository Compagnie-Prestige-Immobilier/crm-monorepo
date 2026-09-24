-- name: LotParId :one
SELECT l."id", l."name", l."cible", l."projet", l."filters", l."itemCount",
       l."createdById", l."createdAt", l."pausedAt", u."fullName" AS "createdByName"
FROM "lots_export" l
INNER JOIN "users" u ON u."id" = l."createdById"
WHERE l."id" = $1;

-- name: CompterLots :one
SELECT COUNT(*)::int
FROM "lots_export" l
INNER JOIN "users" u ON u."id" = l."createdById"
WHERE (sqlc.narg('search')::text IS NULL OR concat_ws(' ', l."name", u."fullName",
         'semaine ' || EXTRACT(WEEK FROM l."createdAt")::int, replace(l."projet"::text, '_', ' '),
         CASE l."cible" WHEN 'PROSPECTS' THEN 'prospects' WHEN 'CONTACTS_RECOMMANDES' THEN 'contacts recommandés'
           WHEN 'REPRESENTANTS_INJOIGNABLES' THEN 'représentants injoignables' ELSE 'représentants' END
       ) ILIKE '%' || sqlc.narg('search')::text || '%')
  AND (sqlc.narg('cible')::"LotExportCible" IS NULL OR l."cible" = sqlc.narg('cible'))
  AND (sqlc.narg('projet')::"Projet" IS NULL OR l."projet" = sqlc.narg('projet'))
  AND (sqlc.narg('created_by')::text IS NULL OR l."createdById" = sqlc.narg('created_by'))
  AND (sqlc.narg('date_from')::timestamp IS NULL OR l."createdAt" >= sqlc.narg('date_from'))
  AND (sqlc.narg('date_to')::timestamp IS NULL OR l."createdAt" <= sqlc.narg('date_to'));

-- name: ListerLots :many
SELECT l."id", l."name", l."cible", l."projet", l."filters", l."itemCount",
       l."createdById", l."createdAt", l."pausedAt", u."fullName" AS "createdByName"
FROM "lots_export" l
INNER JOIN "users" u ON u."id" = l."createdById"
WHERE (sqlc.narg('search')::text IS NULL OR concat_ws(' ', l."name", u."fullName",
         'semaine ' || EXTRACT(WEEK FROM l."createdAt")::int, replace(l."projet"::text, '_', ' '),
         CASE l."cible" WHEN 'PROSPECTS' THEN 'prospects' WHEN 'CONTACTS_RECOMMANDES' THEN 'contacts recommandés'
           WHEN 'REPRESENTANTS_INJOIGNABLES' THEN 'représentants injoignables' ELSE 'représentants' END
       ) ILIKE '%' || sqlc.narg('search')::text || '%')
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

-- name: PauserLot :exec
UPDATE "lots_export" SET "pausedAt" = sqlc.narg('at') WHERE "id" = $1;

-- Les fiches créées par chaque import, pour le projet de la campagne à monter.
-- Un classeur de leads porte un onglet par jour et garde le nom de fichier du
-- premier : le lot se compte par onglet, sinon les trois jours se confondent.
-- name: ImportsAvecFiches :many
WITH fiches AS (
  SELECT j."id" AS "jobId", j."fileName", j."createdAt", j."finishedAt", p."importFeuille",
         p."lastCallAt" IS NOT NULL AS appelee,
         p."projet" = 'GRAND_PUBLIC' AS gp,
         p."projet" = 'CHUES' AS chues
  FROM "import_jobs" j
  JOIN "prospects" p ON p."importJobId" = j."id" AND p."deletedAt" IS NULL
)
SELECT MAX("jobId")::text AS "id",
       MAX("fileName")::text AS "fileName",
       "importFeuille",
       MIN("createdAt")::timestamp AS "createdAt",
       MAX("finishedAt")::timestamp AS "finishedAt",
       COUNT(*) FILTER (WHERE gp)::int AS "fichesGp",
       COUNT(*) FILTER (WHERE gp AND appelee)::int AS "appeleesGp",
       COUNT(*) FILTER (WHERE chues)::int AS "fichesChues",
       COUNT(*) FILTER (WHERE chues AND appelee)::int AS "appeleesChues"
FROM fiches
GROUP BY "fileName", COALESCE("importFeuille", "jobId"), "importFeuille"
ORDER BY MAX("finishedAt") DESC, MAX("jobId") DESC
LIMIT 1000;

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
JOIN "lots_export" l ON l."id" = i."lotId" AND l."pausedAt" IS NULL
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

-- name: LotsDeLEquipe :many
SELECT l."id", l."name" FROM "lots_export" l
WHERE jsonb_exists(l."filters"->'distribution'->'teleconseillerIds', @teleconseiller_id::text)
ORDER BY l."createdAt", l."id";

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
SELECT a."id", r."phoneE164", sq."label" AS "statutLabel", a."comment",
       u."fullName" AS "performedByName", a."createdAt"
FROM "rep_call_attempts" a
INNER JOIN "representants" r ON r."id" = a."representantId"
INNER JOIN "users" u ON u."id" = a."performedById"
INNER JOIN "statuts_qualification" sq ON sq."id" = a."statutQualificationId"
WHERE a."clientCreatedAt" >= $2
  AND EXISTS (
    SELECT 1 FROM "lot_export_items" i
    WHERE i."lotId" = $1 AND i."representantId" = a."representantId"
  )
ORDER BY a."clientCreatedAt" DESC, a."id" DESC
LIMIT 50;

-- name: LotAttemptsProspects :many
SELECT a."id", p."phoneE164", cr."label" AS "reasonLabel",
       COALESCE(a."method"::text, '')::text AS method,
       a."comment", u."fullName" AS "performedByName", a."createdAt", a."email",
       a."fonctionnaire", a."engagementEnCours", a."dureeEtablissementMois", a."rendezVousAt"
FROM "call_attempts" a
INNER JOIN "prospects" p ON p."id" = a."prospectId"
INNER JOIN "users" u ON u."id" = a."performedById"
INNER JOIN "call_outcome_reasons" cr ON cr."id" = a."reasonId"
WHERE a."clientCreatedAt" >= $2
  AND EXISTS (
    SELECT 1 FROM "lot_export_items" i
    WHERE i."lotId" = $1 AND i."prospectId" = a."prospectId"
  )
ORDER BY a."clientCreatedAt" DESC, a."id" DESC
LIMIT 50;

-- L'état se calculait en Go après avoir remonté les 3 080 lignes du lot, à
-- chaque page. Il se dit ici, ce qui rend la pagination et le filtre au serveur.
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
  AND (sqlc.narg('etat')::text IS NULL OR sqlc.narg('etat')::text = CASE
        WHEN r."nextCallbackAt" IS NOT NULL THEN 'A_RAPPELER'
        WHEN EXISTS (SELECT 1 FROM "rep_call_attempts" a
                     WHERE a."representantId" = i."representantId"
                       AND a."clientCreatedAt" >= sqlc.arg('depuis')) THEN 'TRAITEE'
        ELSE 'NON_TRAITEE' END)
ORDER BY i."position"
LIMIT sqlc.arg('page_size')::bigint OFFSET sqlc.arg('page_offset')::bigint;

-- name: LotFichesRepresentantsCount :one
SELECT COUNT(*)::int FROM "lot_export_items" i
LEFT JOIN "representants" r ON r."id" = i."representantId"
WHERE i."lotId" = $1
  AND (sqlc.narg('assignee_id')::text IS NULL OR i."assigneeId" = sqlc.narg('assignee_id'))
  AND (sqlc.narg('etat')::text IS NULL OR sqlc.narg('etat')::text = CASE
        WHEN r."nextCallbackAt" IS NOT NULL THEN 'A_RAPPELER'
        WHEN EXISTS (SELECT 1 FROM "rep_call_attempts" a
                     WHERE a."representantId" = i."representantId"
                       AND a."clientCreatedAt" >= sqlc.arg('depuis')) THEN 'TRAITEE'
        ELSE 'NON_TRAITEE' END);

-- name: LotFichesProspects :many
SELECT i."position", i."day", i."assigneeId", u."fullName" AS "assigneeName",
       p."id" AS "ficheId", p."nom", p."prenom", p."phoneE164",
       COALESCE((SELECT cr."label" FROM "call_outcome_reasons" cr WHERE cr."id" = p."lastReasonId"), '')::text AS "lastReasonLabel"
FROM "lot_export_items" i
LEFT JOIN "users" u ON u."id" = i."assigneeId"
LEFT JOIN "prospects" p ON p."id" = i."prospectId"
WHERE i."lotId" = $1
  AND (sqlc.narg('assignee_id')::text IS NULL OR i."assigneeId" = sqlc.narg('assignee_id'))
  AND (sqlc.narg('etat')::text IS NULL OR sqlc.narg('etat')::text = CASE
        WHEN EXISTS (SELECT 1 FROM "call_attempts" a
                     WHERE a."prospectId" = i."prospectId"
                       AND a."clientCreatedAt" >= sqlc.arg('depuis')) THEN 'TRAITEE'
        ELSE 'NON_TRAITEE' END)
ORDER BY i."position"
LIMIT sqlc.arg('page_size')::bigint OFFSET sqlc.arg('page_offset')::bigint;

-- name: LotFichesProspectsCount :one
SELECT COUNT(*)::int FROM "lot_export_items" i
WHERE i."lotId" = $1
  AND (sqlc.narg('assignee_id')::text IS NULL OR i."assigneeId" = sqlc.narg('assignee_id'))
  AND (sqlc.narg('etat')::text IS NULL OR sqlc.narg('etat')::text = CASE
        WHEN EXISTS (SELECT 1 FROM "call_attempts" a
                     WHERE a."prospectId" = i."prospectId"
                       AND a."clientCreatedAt" >= sqlc.arg('depuis')) THEN 'TRAITEE'
        ELSE 'NON_TRAITEE' END);

-- name: LotLignesRepresentants :many
SELECT i."position", i."day", i."assigneeId", u."fullName" AS "assigneeName", r."fullName", r."phoneE164",
       d."name" AS departement, ief."name" AS ief, c."fullName" AS commercial,
       r."notes", r."clientCreatedAt", sq."label" AS statut
FROM "lot_export_items" i
INNER JOIN "representants" r ON r."id" = i."representantId"
INNER JOIN "departements" d ON d."id" = r."departementId"
INNER JOIN "users" c ON c."id" = r."createdById"
LEFT JOIN "users" u ON u."id" = i."assigneeId"
LEFT JOIN "iefs" ief ON ief."id" = r."iefId"
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
WHERE i."lotId" = $1
ORDER BY i."position";

-- name: LotLignesProspects :many
SELECT i."position", i."day", i."assigneeId", u."fullName" AS "assigneeName", p."nom", p."prenom", p."phoneE164",
       b."name" AS banque, s."sigle" AS syndicat, rep."fullName" AS representant,
       d."name" AS departement, c."fullName" AS commercial, p."clientCreatedAt", cr."label" AS statut
FROM "lot_export_items" i
INNER JOIN "prospects" p ON p."id" = i."prospectId"
INNER JOIN "users" c ON c."id" = p."createdById"
LEFT JOIN "users" u ON u."id" = i."assigneeId"
LEFT JOIN "banques" b ON b."id" = p."banqueId"
LEFT JOIN "syndicats" s ON s."id" = p."syndicatId"
LEFT JOIN "representants" rep ON rep."id" = p."representantId"
LEFT JOIN "departements" d ON d."id" = rep."departementId"
LEFT JOIN "call_outcome_reasons" cr ON cr."id" = p."lastReasonId"
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
       OR (sq."effect" = 'UNREACHABLE' AND sq."retryAfterMinutes" IS NOT NULL));

-- name: TirerRepresentantsCible :many
SELECT r."id"
FROM "representants" r
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
WHERE r."deletedAt" IS NULL
  AND (sqlc.narg('departement_id')::text IS NULL OR r."departementId" = sqlc.narg('departement_id'))
  AND (sqlc.narg('ief_id')::text IS NULL OR r."iefId" = sqlc.narg('ief_id'))
  AND (sqlc.narg('relation_status')::"RepresentantRelation" IS NULL OR r."relationStatus" = sqlc.narg('relation_status'))
  AND (NOT sqlc.arg('injoignables')::boolean
       OR (sq."effect" = 'UNREACHABLE' AND sq."retryAfterMinutes" IS NOT NULL))
ORDER BY r."id" ASC
LIMIT sqlc.arg('places');

-- Une fiche appartient à UN projet, celui qu'elle porte aujourd'hui. Un ancien
-- parcours dans l'autre projet ne la rend pas à ses campagnes.
-- name: CompterProspectsCible :one
SELECT COUNT(*)::int
FROM "prospects" p
WHERE p."deletedAt" IS NULL
  AND p."statut" <> 'PERDU'
  AND (sqlc.narg('projet')::"Projet" IS NULL OR p."projet" = sqlc.narg('projet'))
  AND (sqlc.narg('type')::"ProspectType" IS NULL OR p."type" = sqlc.narg('type'))
  -- Un classeur releve plusieurs fois donne plusieurs travaux d'import, et
  -- l'onglet du jour se repartit entre eux. Le selecteur les groupe par onglet
  -- et ne peut rendre qu'un identifiant : borner sur ce seul travail ne tirait
  -- que sa part, parfois aucune fiche.
  AND (sqlc.narg('import_job_id')::text IS NULL
       OR p."importJobId" = sqlc.narg('import_job_id')
       OR (sqlc.narg('import_feuille')::text IS NOT NULL
           AND EXISTS (SELECT 1 FROM "import_jobs" ja JOIN "import_jobs" jb ON jb."fileName" = ja."fileName"
                       WHERE ja."id" = sqlc.narg('import_job_id')::text AND jb."id" = p."importJobId")))
  AND (sqlc.narg('import_feuille')::text IS NULL OR p."importFeuille" = sqlc.narg('import_feuille'))
  AND (NOT sqlc.arg('injoignables')::boolean
       OR EXISTS (SELECT 1 FROM "call_outcome_reasons" lr WHERE lr."id" = p."lastReasonId" AND NOT lr."countsAsReached"))
  -- Hors relance des injoignables, une fiche déjà appelée ou déjà distribuée
  -- ne se retire pas : deux attributaires appelleraient la même personne.
  AND (sqlc.arg('injoignables')::boolean
       OR (p."lastCallAt" IS NULL
           AND NOT EXISTS (SELECT 1 FROM "lot_export_items" li WHERE li."prospectId" = p."id")))
  AND (NOT sqlc.arg('par_segment')::boolean
       OR (EXISTS (SELECT 1 FROM "syndicats" s
                   WHERE s."id" = p."syndicatId" AND (s."sigle" = 'CHUES') = sqlc.arg('chues')::boolean)
       AND EXISTS (SELECT 1 FROM "banques" b
                   WHERE b."id" = p."banqueId" AND (b."shortName" = 'CBAO') = sqlc.arg('cbao')::boolean)));

-- name: TirerProspectsCible :many
SELECT p."id"
FROM "prospects" p
WHERE p."deletedAt" IS NULL
  AND p."statut" <> 'PERDU'
  AND (sqlc.narg('projet')::"Projet" IS NULL OR p."projet" = sqlc.narg('projet'))
  AND (sqlc.narg('type')::"ProspectType" IS NULL OR p."type" = sqlc.narg('type'))
  -- Un classeur releve plusieurs fois donne plusieurs travaux d'import, et
  -- l'onglet du jour se repartit entre eux. Le selecteur les groupe par onglet
  -- et ne peut rendre qu'un identifiant : borner sur ce seul travail ne tirait
  -- que sa part, parfois aucune fiche.
  AND (sqlc.narg('import_job_id')::text IS NULL
       OR p."importJobId" = sqlc.narg('import_job_id')
       OR (sqlc.narg('import_feuille')::text IS NOT NULL
           AND EXISTS (SELECT 1 FROM "import_jobs" ja JOIN "import_jobs" jb ON jb."fileName" = ja."fileName"
                       WHERE ja."id" = sqlc.narg('import_job_id')::text AND jb."id" = p."importJobId")))
  AND (sqlc.narg('import_feuille')::text IS NULL OR p."importFeuille" = sqlc.narg('import_feuille'))
  AND (NOT sqlc.arg('injoignables')::boolean
       OR EXISTS (SELECT 1 FROM "call_outcome_reasons" lr WHERE lr."id" = p."lastReasonId" AND NOT lr."countsAsReached"))
  -- Hors relance des injoignables, une fiche déjà appelée ou déjà distribuée
  -- ne se retire pas : deux attributaires appelleraient la même personne.
  AND (sqlc.arg('injoignables')::boolean
       OR (p."lastCallAt" IS NULL
           AND NOT EXISTS (SELECT 1 FROM "lot_export_items" li WHERE li."prospectId" = p."id")))
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

-- name: LotsActifsDeLaFiche :many
SELECT i."lotId", i."position"
FROM "lot_export_items" i
JOIN "lots_export" l ON l."id" = i."lotId" AND l."pausedAt" IS NULL
WHERE (sqlc.narg('prospect_id')::text IS NOT NULL AND i."prospectId" = sqlc.narg('prospect_id')::text)
   OR (sqlc.narg('representant_id')::text IS NOT NULL AND i."representantId" = sqlc.narg('representant_id')::text)
ORDER BY l."createdAt" ASC, i."position" ASC;

-- name: AjouterFicheAuLot :one
INSERT INTO "lot_export_items" ("lotId", "representantId", "prospectId", "position", "assigneeId", "day")
SELECT @lot_id, sqlc.narg('representant_id'), sqlc.narg('prospect_id'),
       COALESCE(MAX(i."position"), 0) + 1, @assignee_id, 1
FROM "lot_export_items" i WHERE i."lotId" = @lot_id
RETURNING "position";

-- name: IncrementerItemCount :exec
UPDATE "lots_export" SET "itemCount" = "itemCount" + 1 WHERE "id" = $1;

-- name: LotChargeParMembre :many
SELECT i."assigneeId", COUNT(*)::int AS fiches
FROM "lot_export_items" i
WHERE i."lotId" = $1 AND i."assigneeId" IS NOT NULL
GROUP BY i."assigneeId";
