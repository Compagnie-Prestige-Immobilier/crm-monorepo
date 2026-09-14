-- name: InsertImportJob :one
INSERT INTO "import_jobs" (
  "id", "kind", "status", "mode", "requestedById",
  "fileName", "fileBytes", "storagePath", "expiresAt", "updatedAt"
) VALUES (@id, @kind, 'queued', 'DRY_RUN', @requested_by_id, @file_name, @file_bytes, @storage_path, @expires_at, now())
RETURNING *;

-- name: ImportJobByID :one
SELECT * FROM "import_jobs" WHERE "id" = $1;

-- RATTRAPAGE PONCTUEL, à retirer avec `imports_rattrapage.go`.
-- name: ImportsSansFeuille :many
SELECT j."id", j."fileName", j."storagePath"
FROM "import_jobs" j
WHERE j."kind" = 'PROSPECTS_GRAND_PUBLIC'
  AND EXISTS (SELECT 1 FROM "prospects" p
              WHERE p."importJobId" = j."id" AND p."deletedAt" IS NULL AND p."importFeuille" IS NULL)
ORDER BY j."createdAt";

-- name: RattraperFeuilleProspect :execrows
UPDATE "prospects" SET "importFeuille" = @feuille
WHERE "importJobId" = @import_job_id AND "phoneE164" = @phone_e164 AND "importFeuille" IS NULL;

-- Le relevé automatique n'a pas d'appelant : l'administrateur le plus ancien porte ses imports.
-- name: ImportDemandeurSysteme :one
SELECT "id" FROM "users" WHERE "role" = 'ADMIN' AND "isActive"
ORDER BY "createdAt" ASC, "id" ASC LIMIT 1;

-- name: ListImportJobs :many
SELECT * FROM "import_jobs"
WHERE (sqlc.narg('kind')::"ImportKind" IS NULL OR "kind" = sqlc.narg('kind')::"ImportKind")
  AND (sqlc.narg('status')::"ImportStatus" IS NULL OR "status" = sqlc.narg('status')::"ImportStatus")
ORDER BY "createdAt" DESC, "id" DESC
LIMIT @take OFFSET @skip;

-- name: CountImportJobs :one
SELECT count(*) FROM "import_jobs"
WHERE (sqlc.narg('kind')::"ImportKind" IS NULL OR "kind" = sqlc.narg('kind')::"ImportKind")
  AND (sqlc.narg('status')::"ImportStatus" IS NULL OR "status" = sqlc.narg('status')::"ImportStatus");

-- Bail : queued jamais pris, bail perimé, ou horloge revenue en arrière.
-- name: ClaimImportJob :one
UPDATE "import_jobs"
SET "status" = 'running', "claimToken" = @token::text, "claimedAt" = @now::timestamp, "updatedAt" = now()
WHERE "id" = @id
  AND (
    ("status" = 'queued' AND "claimedAt" IS NULL)
    OR ("status" IN ('queued', 'running') AND "claimedAt" < @lease_expired::timestamp)
    OR ("status" IN ('queued', 'running') AND "claimedAt" > @clock_jumped_back::timestamp)
  )
RETURNING *;

-- name: MarkImportRunning :execrows
UPDATE "import_jobs"
SET "status" = 'running', "startedAt" = coalesce("startedAt", @now::timestamp),
    "totalRows" = sqlc.narg('total_rows'), "claimedAt" = @now::timestamp, "updatedAt" = now()
WHERE "id" = @id AND "claimToken" = @token::text;

-- name: AdvanceImportJob :execrows
UPDATE "import_jobs"
SET "status" = 'running', "processedRows" = @processed_rows, "createdRows" = @created_rows,
    "updatedRows" = @updated_rows, "skippedRows" = @skipped_rows, "errorRows" = @error_rows,
    "claimedAt" = @now::timestamp, "updatedAt" = now()
WHERE "id" = @id AND "claimToken" = @token::text;

-- name: FinishImportJob :execrows
UPDATE "import_jobs"
SET "status" = 'succeeded', "processedRows" = @processed_rows, "createdRows" = @created_rows,
    "updatedRows" = @updated_rows, "skippedRows" = @skipped_rows, "errorRows" = @error_rows,
    "totalRows" = @total_rows::int, "report" = @report, "finishedAt" = @now::timestamp,
    "claimedAt" = @now::timestamp, "updatedAt" = now()
WHERE "id" = @id AND "claimToken" = @token::text;

-- name: FailImportJob :execrows
UPDATE "import_jobs"
SET "status" = 'failed', "failureCode" = @failure_code, "failureMsg" = @failure_msg,
    "finishedAt" = @now::timestamp, "claimedAt" = @now::timestamp, "updatedAt" = now()
WHERE "id" = @id AND "claimToken" = @token::text;

-- name: RequeueImportJobForApply :execrows
UPDATE "import_jobs"
SET "mode" = 'APPLY', "status" = 'queued', "claimToken" = NULL, "claimedAt" = NULL,
    "startedAt" = NULL, "finishedAt" = NULL, "totalRows" = NULL, "processedRows" = 0,
    "createdRows" = 0, "updatedRows" = 0, "skippedRows" = 0, "errorRows" = 0,
    "report" = NULL, "failureCode" = NULL, "failureMsg" = NULL, "updatedAt" = now()
WHERE "id" = @id AND "status" = 'succeeded' AND "mode" = 'DRY_RUN' AND "expiresAt" > @now::timestamp;

-- Compteurs CONSERVÉS : ils portent la position de reprise.
-- name: ResumeFailedImportApply :execrows
UPDATE "import_jobs"
SET "status" = 'queued', "claimToken" = NULL, "claimedAt" = NULL, "finishedAt" = NULL,
    "failureCode" = NULL, "failureMsg" = NULL, "updatedAt" = now()
WHERE "id" = @id AND "status" = 'failed' AND "mode" = 'APPLY' AND "expiresAt" > @now::timestamp;

-- name: DueImportJobs :many
SELECT "id", "storagePath" FROM "import_jobs"
WHERE "expiresAt" <= @now::timestamp AND "status" <> 'expired'
LIMIT 100;

-- name: ExpireImportJob :execrows
UPDATE "import_jobs"
SET "status" = 'expired', "claimToken" = NULL, "finishedAt" = @now::timestamp, "updatedAt" = now()
WHERE "id" = @id AND "status" <> 'expired';

-- name: ClaimableImportJobs :many
SELECT "id" FROM "import_jobs"
WHERE "status" IN ('queued', 'running') AND "expiresAt" > @now::timestamp
  AND ("claimedAt" IS NULL OR "claimedAt" < @lease_expired::timestamp OR "claimedAt" > @clock_jumped_back::timestamp)
ORDER BY "createdAt" ASC
LIMIT @take;

-- name: ImportDepartements :many
SELECT "id", "code", "name" FROM "departements" WHERE "isActive";

-- name: ImportIefs :many
SELECT "id", "code", "name", "departementId" FROM "iefs" WHERE "isActive";

-- name: ImportComptes :many
SELECT "id", "username", "email", "fullName" FROM "users" WHERE "isActive" AND "deletedAt" IS NULL;

-- name: ImportBanques :many
SELECT "id", "shortName" FROM "banques" WHERE "isActive" ORDER BY "sortOrder", "shortName";

-- name: ImportSyndicats :many
SELECT "id", "sigle" FROM "syndicats" WHERE "isActive" ORDER BY "sortOrder", "sigle";

-- name: ImportCanaux :many
SELECT "id", "code", "label" FROM "canaux_provenance" WHERE "isActive" ORDER BY "position", "label";

-- name: ImportEmployeurs :many
SELECT "id", "code", "label" FROM "employeurs" WHERE "isActive" ORDER BY "position", "label";

-- name: ImportPays :many
SELECT "id", "code", "label" FROM "pays" WHERE "isActive" ORDER BY "position", "label";

-- name: ImportReferentielsVisite :many
SELECT 'entreprises' AS liste, "id", "code", "label" FROM "visite_entreprises" WHERE "isActive"
UNION ALL SELECT 'directions', "id", "code", "label" FROM "visite_directions" WHERE "isActive"
UNION ALL SELECT 'destinataires', "id", "code", "label" FROM "visite_destinataires" WHERE "isActive"
UNION ALL SELECT 'objets de visite', "id", "code", "label" FROM "visite_objets" WHERE "isActive";

-- name: ImportRepresentantsParTelephone :many
SELECT "id", "phoneE164" FROM "representants" WHERE "deletedAt" IS NULL;

-- name: ImportTelephonesRepresentantsConnus :many
SELECT "phoneE164" FROM "representants"
WHERE "phoneE164" = ANY(@phones::text[]) AND "deletedAt" IS NULL;

-- name: ImportProspectsConnus :many
SELECT "phoneE164", "representantId", "projet",
       EXISTS (SELECT 1 FROM "prospect_journeys" j WHERE j."prospectId" = p."id" AND j."projet" = 'GRAND_PUBLIC') AS "parcoursGp",
       EXISTS (SELECT 1 FROM "prospect_journeys" j WHERE j."prospectId" = p."id" AND j."projet" = 'CHUES') AS "parcoursChues"
FROM "prospects" p
WHERE "phoneE164" = ANY(@phones::text[]) AND "deletedAt" IS NULL;

-- Réglée dans Paramètres CHUES, d'où le préfixe : une liste JSON de règles.
-- name: ImportReglesProvenance :many
SELECT "value" FROM "app_settings" WHERE "key" = 'chues.codificationProvenances';

-- Le courriel se compare sans casse : la plateforme et les campagnes ne
-- s'accordent pas sur les majuscules.
-- name: ImportProspectsConnusParEmail :many
SELECT lower("email") AS "email", "projet",
       EXISTS (SELECT 1 FROM "prospect_journeys" j WHERE j."prospectId" = p."id" AND j."projet" = 'GRAND_PUBLIC') AS "parcoursGp",
       EXISTS (SELECT 1 FROM "prospect_journeys" j WHERE j."prospectId" = p."id" AND j."projet" = 'CHUES') AS "parcoursChues"
FROM "prospects" p
WHERE lower("email") = ANY(@emails::text[]) AND "deletedAt" IS NULL;

-- name: ImportProspectsParTelephone :many
SELECT "id", "phoneE164" FROM "prospects"
WHERE "phoneE164" = ANY(@phones::text[]) AND "deletedAt" IS NULL;

-- name: ImportVisitesConnues :many
SELECT "visitedAt", "timeKnown", "visitorName", "entrepriseId" FROM "visites"
WHERE "visitedAt" = ANY(@instants::timestamp[]) AND "entrepriseId" = ANY(@entreprises::text[]);

-- name: ImportDerniereReferenceVisite :one
SELECT "reference" FROM "visites"
WHERE "reference" LIKE @prefixe || '%' ORDER BY "reference" DESC LIMIT 1;

-- name: InsertImportRepresentant :batchexec
INSERT INTO "representants" (
  "id", "fullName", "phoneE164", "departementId", "iefId", "notes", "etablissement",
  "relationStatus", "whatsappStatus", "createdById", "clientCreatedAt", "updatedAt"
) VALUES (@id, @full_name, @phone_e164, @departement_id, sqlc.narg('ief_id'), sqlc.narg('notes'),
          sqlc.narg('etablissement'), @relation_status, @whatsapp_status, @created_by_id, @client_created_at, now())
ON CONFLICT DO NOTHING;

-- name: InsertImportRepCallAttempt :batchexec
INSERT INTO "rep_call_attempts" ("id", "representantId", "performedById", "outcome", "comment", "clientCreatedAt")
VALUES (@id, @representant_id, @performed_by_id, @outcome, sqlc.narg('comment'), @client_created_at)
ON CONFLICT DO NOTHING;

-- name: InsertImportProspect :batchexec
INSERT INTO "prospects" (
  "id", "nom", "prenom", "phoneE164", "banqueId", "syndicatId", "representantId", "createdById",
  "phase2Status", "enrollmentMethod", "enrollmentCapturedAt", "enrollmentCapturedById",
  "clientCreatedAt", "importJobId", "updatedAt"
) VALUES (@id, @nom, @prenom, @phone_e164, @banque_id, @syndicat_id, @representant_id, @created_by_id,
          @phase2_status, sqlc.narg('enrollment_method'), sqlc.narg('enrollment_captured_at'),
          sqlc.narg('enrollment_captured_by_id'), @client_created_at, @import_job_id, now())
ON CONFLICT DO NOTHING;

-- name: InsertImportProspectGrandPublic :batchexec
INSERT INTO "prospects" (
  "id", "projet", "nom", "prenom", "phoneE164", "email", "statut", "profession", "syndicatId", "banqueId",
  "type", "dureeSystemeMois", "canalProvenanceId", "employeurId", "employeur", "typeContrat",
  "ancienneteMois", "lieuActivite", "modeEpargne", "paysResidenceId", "villeResidence",
  "whatsappStatus", "whatsappE164", "relaisNom", "relaisPhoneE164",
  "createdById", "clientCreatedAt", "importJobId", "importFeuille", "updatedAt"
) VALUES (@id, @projet, @nom, @prenom, sqlc.narg('phone_e164'), sqlc.narg('email'), @statut, sqlc.narg('profession'),
          sqlc.narg('syndicat_id'), sqlc.narg('banque_id'), sqlc.narg('type'),
          sqlc.narg('duree_systeme_mois'), sqlc.narg('canal_provenance_id'), sqlc.narg('employeur_id'),
          sqlc.narg('employeur'), sqlc.narg('type_contrat'), sqlc.narg('anciennete_mois'),
          sqlc.narg('lieu_activite'), sqlc.narg('mode_epargne'), sqlc.narg('pays_residence_id'),
          sqlc.narg('ville_residence'), @whatsapp_status, sqlc.narg('whatsapp_e164'),
          sqlc.narg('relais_nom'), sqlc.narg('relais_phone_e164'),
          @created_by_id, @client_created_at, @import_job_id, sqlc.narg('import_feuille'), now())
ON CONFLICT DO NOTHING;

-- name: InsertImportProspectJourney :batchexec
INSERT INTO "prospect_journeys" ("id", "prospectId", "projet", "consent", "consentAt", "updatedAt")
VALUES (@id, @prospect_id, @projet, 'INTERESSE', @consent_at, now())
ON CONFLICT DO NOTHING;

-- name: InsertImportVisite :batchexec
INSERT INTO "visites" (
  "id", "reference", "visitedAt", "timeKnown", "visitorName", "phone", "phoneE164",
  "entrepriseId", "objetId", "directionId", "destinataireId", "comment", "createdById", "updatedAt"
) VALUES (@id, @reference, @visited_at, @time_known, @visitor_name, sqlc.narg('phone'),
          sqlc.narg('phone_e164'), @entreprise_id, @objet_id, sqlc.narg('direction_id'),
          sqlc.narg('destinataire_id'), sqlc.narg('comment'), @created_by_id, now())
ON CONFLICT DO NOTHING;

-- Relecture obligatoire : `ON CONFLICT DO NOTHING` écarte en silence.
-- name: ImportIdentifiantsEcrits :many
SELECT "id" FROM "representants" WHERE "id" = ANY(@ids::text[]);

-- name: ImportProspectsEcrits :one
SELECT count(*) FROM "prospects" WHERE "id" = ANY(@ids::text[]);

-- name: ImportJourneysEcrits :one
SELECT count(*) FROM "prospect_journeys" WHERE "id" = ANY(@ids::text[]);

-- name: ImportVisitesEcrites :one
SELECT count(*) FROM "visites" WHERE "id" = ANY(@ids::text[]);
