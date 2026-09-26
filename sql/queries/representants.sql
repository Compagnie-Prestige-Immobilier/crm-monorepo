-- name: ListRepresentants :many
SELECT
  r.*,
  d."name" AS departement_name,
  i."name" AS ief_name,
  cb."fullName" AS created_by_name,
  lcb."fullName" AS last_call_by_name,
  sq."label" AS statut_qualification_label,
  sq."effect" AS statut_qualification_effect,
  (SELECT count(*) FROM "prospects" p WHERE p."representantId" = r."id" AND p."deletedAt" IS NULL)::int AS prospect_count,
  (SELECT count(*) FROM "rep_call_attempts" a WHERE a."representantId" = r."id")::int AS call_attempt_count
FROM "representants" r
JOIN "departements" d ON d."id" = r."departementId"
JOIN "users" cb ON cb."id" = r."createdById"
LEFT JOIN "iefs" i ON i."id" = r."iefId"
LEFT JOIN "users" lcb ON lcb."id" = r."lastCallById"
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
WHERE r."deletedAt" IS NULL
  AND (sqlc.narg('id')::text IS NULL OR r."id" = sqlc.narg('id')::text)
  AND (sqlc.narg('phone_e164')::text IS NULL OR r."phoneE164" = sqlc.narg('phone_e164')::text)
  AND (
    sqlc.arg('reads_everyone')::boolean
    OR r."createdById" = sqlc.arg('owner_id')::text
    OR EXISTS (
      SELECT 1 FROM "rep_call_attempts" a
      WHERE a."representantId" = r."id" AND a."performedById" = sqlc.arg('owner_id')::text
    )
    OR EXISTS (
      SELECT 1 FROM "lot_export_items" li
      JOIN "lots_export" l ON l."id" = li."lotId" AND l."pausedAt" IS NULL
      WHERE li."representantId" = r."id" AND li."assigneeId" = sqlc.arg('owner_id')::text
    )
  )
  AND (sqlc.narg('commercial_id')::text IS NULL OR r."createdById" = sqlc.narg('commercial_id')::text)
  AND (sqlc.narg('departement_id')::text IS NULL OR r."departementId" = sqlc.narg('departement_id')::text)
  AND (sqlc.narg('ief_id')::text IS NULL OR r."iefId" = sqlc.narg('ief_id')::text)
  AND (sqlc.narg('statut_qualification_id')::text IS NULL OR r."statutQualificationId" = sqlc.narg('statut_qualification_id')::text)
  AND (sqlc.narg('last_call_by_id')::text IS NULL OR r."lastCallById" = sqlc.narg('last_call_by_id')::text)
  AND (
    sqlc.narg('appele_par')::text IS NULL
    OR EXISTS (
      SELECT 1 FROM "rep_call_attempts" ap
      WHERE ap."representantId" = r."id" AND ap."performedById" = sqlc.narg('appele_par')::text
    )
  )
  AND (sqlc.narg('relation_status')::text[] IS NULL OR r."relationStatus"::text = ANY(sqlc.narg('relation_status')::text[]))
  AND (sqlc.narg('whatsapp_statuses')::text[] IS NULL OR r."whatsappStatus"::text = ANY(sqlc.narg('whatsapp_statuses')::text[]))
  AND (sqlc.narg('date_from')::timestamp IS NULL OR r."clientCreatedAt" >= sqlc.narg('date_from')::timestamp)
  AND (sqlc.narg('date_to')::timestamp IS NULL OR r."clientCreatedAt" <= sqlc.narg('date_to')::timestamp)
  AND (
    sqlc.narg('suivi')::text IS NULL
    OR (sqlc.narg('suivi')::text = 'A_RAPPELER' AND r."nextCallbackAt" IS NOT NULL)
    OR (sqlc.narg('suivi')::text = 'INJOIGNABLE' AND sq."effect" = 'UNREACHABLE')
  )
  AND (
    sqlc.narg('has_prospects')::boolean IS NULL
    OR sqlc.narg('has_prospects')::boolean = EXISTS (
      SELECT 1 FROM "prospects" p WHERE p."representantId" = r."id" AND p."deletedAt" IS NULL
    )
  )
  AND (
    sqlc.narg('search')::text IS NULL
    OR r."fullName" ILIKE '%' || sqlc.narg('search')::text || '%'
    OR (sqlc.narg('search_digits')::text IS NOT NULL AND r."phoneE164" LIKE '%' || sqlc.narg('search_digits')::text || '%')
  )
ORDER BY
  CASE WHEN sqlc.arg('sort_dir')::text = 'asc' THEN CASE sqlc.arg('sort_by')::text
    WHEN 'clientCreatedAt' THEN r."clientCreatedAt"
    WHEN 'createdAt' THEN r."createdAt"
    WHEN 'lastCallAt' THEN r."lastCallAt"
    WHEN 'nextCallbackAt' THEN r."nextCallbackAt"
  END END ASC,
  CASE WHEN sqlc.arg('sort_dir')::text = 'desc' THEN CASE sqlc.arg('sort_by')::text
    WHEN 'clientCreatedAt' THEN r."clientCreatedAt"
    WHEN 'createdAt' THEN r."createdAt"
    WHEN 'lastCallAt' THEN r."lastCallAt"
    WHEN 'nextCallbackAt' THEN r."nextCallbackAt"
  END END DESC,
  CASE WHEN sqlc.arg('sort_dir')::text = 'asc' AND sqlc.arg('sort_by')::text = 'fullName' THEN r."fullName" END ASC,
  CASE WHEN sqlc.arg('sort_dir')::text = 'desc' AND sqlc.arg('sort_by')::text = 'fullName' THEN r."fullName" END DESC,
  CASE WHEN sqlc.arg('sort_dir')::text = 'asc' AND sqlc.arg('sort_by')::text = 'priorite' THEN sq."priorite" END ASC,
  CASE WHEN sqlc.arg('sort_dir')::text = 'desc' AND sqlc.arg('sort_by')::text = 'priorite' THEN sq."priorite" END DESC,
  CASE WHEN sqlc.arg('sort_dir')::text = 'asc' AND sqlc.arg('sort_by')::text = 'prospects'
    THEN (SELECT count(*) FROM "prospects" p WHERE p."representantId" = r."id" AND p."deletedAt" IS NULL) END ASC,
  CASE WHEN sqlc.arg('sort_dir')::text = 'desc' AND sqlc.arg('sort_by')::text = 'prospects'
    THEN (SELECT count(*) FROM "prospects" p WHERE p."representantId" = r."id" AND p."deletedAt" IS NULL) END DESC,
  r."id" DESC
LIMIT sqlc.arg('lim')::int OFFSET sqlc.arg('off')::int;

-- name: CountRepresentants :one
-- Mêmes prédicats que ListRepresentants : toute retouche ici se reporte là-bas.
SELECT count(*)::int
FROM "representants" r
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
WHERE r."deletedAt" IS NULL
  AND (
    sqlc.arg('reads_everyone')::boolean
    OR r."createdById" = sqlc.arg('owner_id')::text
    OR EXISTS (
      SELECT 1 FROM "rep_call_attempts" a
      WHERE a."representantId" = r."id" AND a."performedById" = sqlc.arg('owner_id')::text
    )
    OR EXISTS (
      SELECT 1 FROM "lot_export_items" li
      JOIN "lots_export" l ON l."id" = li."lotId" AND l."pausedAt" IS NULL
      WHERE li."representantId" = r."id" AND li."assigneeId" = sqlc.arg('owner_id')::text
    )
  )
  AND (sqlc.narg('commercial_id')::text IS NULL OR r."createdById" = sqlc.narg('commercial_id')::text)
  AND (sqlc.narg('departement_id')::text IS NULL OR r."departementId" = sqlc.narg('departement_id')::text)
  AND (sqlc.narg('ief_id')::text IS NULL OR r."iefId" = sqlc.narg('ief_id')::text)
  AND (sqlc.narg('statut_qualification_id')::text IS NULL OR r."statutQualificationId" = sqlc.narg('statut_qualification_id')::text)
  AND (sqlc.narg('last_call_by_id')::text IS NULL OR r."lastCallById" = sqlc.narg('last_call_by_id')::text)
  AND (
    sqlc.narg('appele_par')::text IS NULL
    OR EXISTS (
      SELECT 1 FROM "rep_call_attempts" ap
      WHERE ap."representantId" = r."id" AND ap."performedById" = sqlc.narg('appele_par')::text
    )
  )
  AND (sqlc.narg('relation_status')::text[] IS NULL OR r."relationStatus"::text = ANY(sqlc.narg('relation_status')::text[]))
  AND (sqlc.narg('whatsapp_statuses')::text[] IS NULL OR r."whatsappStatus"::text = ANY(sqlc.narg('whatsapp_statuses')::text[]))
  AND (sqlc.narg('date_from')::timestamp IS NULL OR r."clientCreatedAt" >= sqlc.narg('date_from')::timestamp)
  AND (sqlc.narg('date_to')::timestamp IS NULL OR r."clientCreatedAt" <= sqlc.narg('date_to')::timestamp)
  AND (
    sqlc.narg('suivi')::text IS NULL
    OR (sqlc.narg('suivi')::text = 'A_RAPPELER' AND r."nextCallbackAt" IS NOT NULL)
    OR (sqlc.narg('suivi')::text = 'INJOIGNABLE' AND sq."effect" = 'UNREACHABLE')
  )
  AND (
    sqlc.narg('has_prospects')::boolean IS NULL
    OR sqlc.narg('has_prospects')::boolean = EXISTS (
      SELECT 1 FROM "prospects" p WHERE p."representantId" = r."id" AND p."deletedAt" IS NULL
    )
  )
  AND (
    sqlc.narg('search')::text IS NULL
    OR r."fullName" ILIKE '%' || sqlc.narg('search')::text || '%'
    OR (sqlc.narg('search_digits')::text IS NOT NULL AND r."phoneE164" LIKE '%' || sqlc.narg('search_digits')::text || '%')
  );

-- name: RepresentantPourEcriture :one
SELECT * FROM "representants" WHERE "id" = $1 AND "deletedAt" IS NULL;

-- name: RepresentantExiste :one
SELECT EXISTS (SELECT 1 FROM "representants" WHERE "id" = $1 AND "deletedAt" IS NULL);

-- name: ProprietaireDeLIdentifiant :one
SELECT "createdById" FROM "representants" WHERE "id" = $1;

-- name: RepresentantParTelephone :one
SELECT r."id", r."fullName", r."phoneE164", r."createdAt", r."createdById", cb."fullName" AS created_by_name
FROM "representants" r
JOIN "users" cb ON cb."id" = r."createdById"
WHERE r."phoneE164" = $1 AND r."deletedAt" IS NULL
LIMIT 1;

-- name: InsertRepresentant :exec
INSERT INTO "representants" (
  "id", "fullName", "phoneE164", "notes", "prenom", "etablissement",
  "departementId", "iefId", "createdById", "clientCreatedAt"
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);

-- name: UpdateRepresentant :execrows
UPDATE "representants" SET
  "fullName" = sqlc.arg('full_name'),
  "phoneE164" = sqlc.arg('phone_e164'),
  "notes" = sqlc.narg('notes'),
  "prenom" = sqlc.narg('prenom'),
  "etablissement" = sqlc.narg('etablissement'),
  "departementId" = sqlc.arg('departement_id'),
  "iefId" = sqlc.narg('ief_id'),
  "clientCreatedAt" = sqlc.arg('client_created_at'),
  "whatsappStatus" = sqlc.arg('whatsapp_status'),
  "whatsappE164" = sqlc.narg('whatsapp_e164'),
  "profession" = sqlc.narg('profession'),
  "syndicat" = sqlc.narg('syndicat'),
  "connaitUES" = sqlc.narg('connait_ues'),
  "contacte" = sqlc.narg('contacte'),
  "rev" = "rev" + 1
WHERE "id" = sqlc.arg('id') AND "rev" = sqlc.arg('rev') AND "deletedAt" IS NULL;

-- name: UpdateRelationStatus :execrows
UPDATE "representants" SET "relationStatus" = sqlc.arg('to_status'), "rev" = "rev" + 1
WHERE "id" = sqlc.arg('id') AND "relationStatus" = sqlc.arg('from_status') AND "deletedAt" IS NULL;

-- name: InsertRelationChange :exec
INSERT INTO "representant_relation_changes" (
  "id", "representantId", "fromStatus", "toStatus", "reason", "changedById", "source"
) VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: ListRelationChanges :many
SELECT c.*, u."fullName" AS changed_by_name
FROM "representant_relation_changes" c
JOIN "users" u ON u."id" = c."changedById"
WHERE c."representantId" = $1
ORDER BY c."changedAt" DESC, c."id" DESC;

-- name: ListRepCallAttempts :many
SELECT
  a.*,
  u."fullName" AS performed_by_name,
  sq."label" AS statut_qualification_label,
  sq."effect" AS statut_qualification_effect,
  sq."requiresComment" AS statut_qualification_requires_comment,
  s."suggestedName" AS suggested_name,
  s."suggestedPhoneE164" AS suggested_phone_e164,
  s."note" AS suggested_note
FROM "rep_call_attempts" a
JOIN "users" u ON u."id" = a."performedById"
JOIN "statuts_qualification" sq ON sq."id" = a."statutQualificationId"
LEFT JOIN "representant_suggestions" s ON s."sourceAttemptId" = a."id"
WHERE a."representantId" = $1
ORDER BY a."clientCreatedAt" DESC, a."id" DESC
LIMIT 500;

-- name: DureesDeTraitement :many
SELECT "closingAttemptId", "firstInputAt", "closedAt"
FROM "ouvertures_fiche"
WHERE "representantId" = $1 AND "closingAttemptId" IS NOT NULL AND "firstInputAt" IS NOT NULL
LIMIT 5000;

-- name: ListFicheChanges :many
SELECT a."id", a."userId", a."action", a."before", a."after", a."at", u."fullName" AS changed_by_name
FROM "audit_logs" a
LEFT JOIN "users" u ON u."id" = a."userId"
WHERE a."entity" = 'representant' AND a."entityId" = $1 AND a."action" LIKE 'representant.fiche.%'
ORDER BY a."at" DESC, a."id" DESC
LIMIT 500;

-- name: NomsDesReferences :many
SELECT "id", "name" FROM "departements" WHERE "id" = ANY(sqlc.arg('ids')::text[])
UNION ALL
SELECT "id", "name" FROM "iefs" WHERE "id" = ANY(sqlc.arg('ids')::text[])
LIMIT 1000;

-- name: ListRepresentantComments :many
SELECT c.*, u."fullName" AS author_name
FROM "representant_comments" c
JOIN "users" u ON u."id" = c."authorId"
WHERE c."representantId" = $1 AND c."deletedAt" IS NULL
ORDER BY c."clientCreatedAt" DESC, c."id" DESC
LIMIT sqlc.arg('lim')::int OFFSET sqlc.arg('off')::int;

-- name: CountRepresentantComments :one
SELECT count(*)::int FROM "representant_comments"
WHERE "representantId" = $1 AND "deletedAt" IS NULL;

-- name: InsertRepresentantComment :exec
INSERT INTO "representant_comments" ("id", "representantId", "authorId", "body", "clientCreatedAt")
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT ("id") DO NOTHING;

-- name: RepresentantCommentParId :one
SELECT c.*, u."fullName" AS author_name
FROM "representant_comments" c
JOIN "users" u ON u."id" = c."authorId"
WHERE c."id" = $1;

-- name: SoftDeleteRepresentantComment :execrows
UPDATE "representant_comments" SET "deletedAt" = now()
WHERE "id" = sqlc.arg('id') AND "representantId" = sqlc.arg('representant_id') AND "deletedAt" IS NULL;

-- name: CompterProspectsVivants :one
SELECT count(*)::int FROM "prospects" WHERE "representantId" = $1 AND "deletedAt" IS NULL;

-- name: SoftDeleteProspectsDuRepresentant :exec
UPDATE "prospects" SET "deletedAt" = now(), "rev" = "rev" + 1
WHERE "representantId" = $1 AND "deletedAt" IS NULL;

-- name: SoftDeleteRepresentant :execrows
UPDATE "representants" SET "deletedAt" = now(), "rev" = "rev" + 1
WHERE "id" = $1 AND "deletedAt" IS NULL;

-- name: AffecterRepresentant :one
UPDATE "representants" r SET "createdById" = @vers::text, "rev" = r."rev" + 1
WHERE r."id" = @id::text AND r."deletedAt" IS NULL
RETURNING (SELECT u."fullName" FROM "users" u WHERE u."id" = @vers::text)::text AS "versNom";
