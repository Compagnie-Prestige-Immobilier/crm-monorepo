-- name: ListProspects :many
SELECT
  sqlc.embed(p),
  b.name AS banque_name,
  b."shortName" AS banque_short_name,
  sy.sigle AS syndicat_sigle,
  r."fullName" AS representant_name,
  r."phoneE164" AS representant_phone,
  r."departementId" AS departement_id,
  d.name AS departement_name,
  o."fullName" AS owner_name,
  ec."fullName" AS enrollment_captured_by_name,
  rv."fullName" AS revue_by_name,
  lc."fullName" AS last_call_by_name,
  cp.label AS canal_label,
  pf.label AS profession_label,
  pf."isTeaching" AS profession_is_teaching,
  ib.label AS income_band_label,
  ep.label AS employeur_label,
  pa.label AS pays_label
FROM "prospects" p
JOIN "users" o ON o."id" = p."createdById"
LEFT JOIN "banques" b ON b."id" = p."banqueId"
LEFT JOIN "syndicats" sy ON sy."id" = p."syndicatId"
LEFT JOIN "representants" r ON r."id" = p."representantId"
LEFT JOIN "departements" d ON d."id" = r."departementId"
LEFT JOIN "users" ec ON ec."id" = p."enrollmentCapturedById"
LEFT JOIN "users" rv ON rv."id" = p."revueById"
LEFT JOIN "users" lc ON lc."id" = p."lastCallById"
LEFT JOIN "canaux_provenance" cp ON cp."id" = p."canalProvenanceId"
LEFT JOIN "professions" pf ON pf."id" = p."professionId"
LEFT JOIN "income_bands" ib ON ib."id" = p."incomeBandId"
LEFT JOIN "employeurs" ep ON ep."id" = p."employeurId"
LEFT JOIN "pays" pa ON pa."id" = p."paysResidenceId"
WHERE p."deletedAt" IS NULL
  AND (sqlc.narg('id')::text IS NULL OR p."id" = sqlc.narg('id')::text)
  AND (
    sqlc.arg('scope_all')::boolean
    OR p."createdById" = sqlc.arg('scope_user_id')::text
    OR (sqlc.arg('scope_converti')::boolean AND p."statut" = 'CONVERTI')
    OR EXISTS (
      SELECT 1 FROM "lot_export_items" li
      WHERE li."prospectId" = p."id" AND li."assigneeId" = sqlc.arg('scope_user_id')::text
    )
  )
  AND (sqlc.narg('commercial_id')::text IS NULL OR p."createdById" = sqlc.narg('commercial_id')::text)
  AND (sqlc.narg('type')::"ProspectType" IS NULL OR p."type" = sqlc.narg('type')::"ProspectType")
  AND (sqlc.narg('canal_provenance_id')::text IS NULL OR p."canalProvenanceId" = sqlc.narg('canal_provenance_id')::text)
  AND (sqlc.narg('representant_id')::text IS NULL OR p."representantId" = sqlc.narg('representant_id')::text)
  AND (sqlc.narg('banque_id')::text IS NULL OR p."banqueId" = sqlc.narg('banque_id')::text)
  AND (sqlc.narg('syndicat_id')::text IS NULL OR p."syndicatId" = sqlc.narg('syndicat_id')::text)
  AND (sqlc.narg('origin')::text IS NULL OR p."origin" = sqlc.narg('origin')::text)
  AND (sqlc.narg('phase2_status')::"Phase2Status" IS NULL OR p."phase2Status" = sqlc.narg('phase2_status')::"Phase2Status")
  AND (sqlc.narg('enrollment_method')::"EnrollmentMethod" IS NULL OR p."enrollmentMethod" = sqlc.narg('enrollment_method')::"EnrollmentMethod")
  AND (sqlc.narg('enrollment_captured_by_id')::text IS NULL OR p."enrollmentCapturedById" = sqlc.narg('enrollment_captured_by_id')::text)
  AND (sqlc.narg('last_call_by_id')::text IS NULL OR p."lastCallById" = sqlc.narg('last_call_by_id')::text)
  AND (sqlc.narg('departement_id')::text IS NULL OR r."departementId" = sqlc.narg('departement_id')::text)
  AND (
    sqlc.narg('projet')::"Projet" IS NULL
    OR EXISTS (
      SELECT 1 FROM "prospect_journeys" j
      WHERE j."prospectId" = p."id"
        AND j."projet" = sqlc.narg('projet')::"Projet"
        AND (sqlc.narg('statut')::"ProspectStatut" IS NULL OR j."statut" = sqlc.narg('statut')::"ProspectStatut")
    )
  )
  AND (
    sqlc.narg('projet')::"Projet" IS NOT NULL
    OR sqlc.narg('statut')::"ProspectStatut" IS NULL
    OR p."statut" = sqlc.narg('statut')::"ProspectStatut"
  )
  AND (
    sqlc.narg('revue')::boolean IS NULL
    OR (p."statut" = 'CONVERTI' AND (p."revueAt" IS NOT NULL) = sqlc.narg('revue')::boolean)
  )
  AND (
    sqlc.narg('segment')::text IS NULL
    OR sqlc.narg('segment')::text = CASE
      WHEN sy."sigle" IS NULL OR b."shortName" IS NULL THEN NULL
      WHEN sy."sigle" = 'CHUES' AND b."shortName" = 'CBAO' THEN 'BDD1'
      WHEN sy."sigle" = 'CHUES' THEN 'BDD2'
      WHEN b."shortName" = 'CBAO' THEN 'BDD3'
      ELSE 'BDD4'
    END
  )
  AND (
    sqlc.narg('appele_par')::text IS NULL
    OR EXISTS (
      SELECT 1 FROM "call_attempts" ca
      WHERE ca."prospectId" = p."id" AND ca."performedById" = sqlc.narg('appele_par')::text
    )
  )
  AND (sqlc.narg('date_from')::timestamp IS NULL OR p."clientCreatedAt" >= sqlc.narg('date_from')::timestamp)
  AND (sqlc.narg('date_to')::timestamp IS NULL OR p."clientCreatedAt" <= sqlc.narg('date_to')::timestamp)
  AND (
    sqlc.narg('search')::text IS NULL
    OR public.immutable_unaccent(lower(p."nom") || ' ' || lower(p."prenom"))
       LIKE '%' || public.immutable_unaccent(lower(sqlc.narg('search')::text)) || '%'
    OR (sqlc.narg('phone_search')::text IS NOT NULL AND p."phoneE164" LIKE '%' || sqlc.narg('phone_search')::text || '%')
  )
ORDER BY
  CASE WHEN sqlc.arg('sort_order')::text = 'asc' THEN CASE sqlc.arg('sort_by')::text
    WHEN 'nom' THEN p."nom" WHEN 'prenom' THEN p."prenom" WHEN 'statut' THEN p."statut"::text END END ASC,
  CASE WHEN sqlc.arg('sort_order')::text = 'desc' THEN CASE sqlc.arg('sort_by')::text
    WHEN 'nom' THEN p."nom" WHEN 'prenom' THEN p."prenom" WHEN 'statut' THEN p."statut"::text END END DESC,
  CASE WHEN sqlc.arg('sort_order')::text = 'asc' THEN CASE sqlc.arg('sort_by')::text
    WHEN 'createdAt' THEN p."createdAt" WHEN 'lastCallAt' THEN p."lastCallAt" ELSE p."clientCreatedAt" END END ASC,
  CASE WHEN sqlc.arg('sort_order')::text = 'desc' THEN CASE sqlc.arg('sort_by')::text
    WHEN 'createdAt' THEN p."createdAt" WHEN 'lastCallAt' THEN p."lastCallAt" ELSE p."clientCreatedAt" END END DESC,
  p."id" DESC
LIMIT sqlc.arg('taille')::int OFFSET sqlc.arg('saut')::int;

-- name: CountProspects :one
SELECT count(*)::int AS total
FROM "prospects" p
LEFT JOIN "banques" b ON b."id" = p."banqueId"
LEFT JOIN "syndicats" sy ON sy."id" = p."syndicatId"
LEFT JOIN "representants" r ON r."id" = p."representantId"
WHERE p."deletedAt" IS NULL
  AND (
    sqlc.arg('scope_all')::boolean
    OR p."createdById" = sqlc.arg('scope_user_id')::text
    OR (sqlc.arg('scope_converti')::boolean AND p."statut" = 'CONVERTI')
    OR EXISTS (
      SELECT 1 FROM "lot_export_items" li
      WHERE li."prospectId" = p."id" AND li."assigneeId" = sqlc.arg('scope_user_id')::text
    )
  )
  AND (sqlc.narg('commercial_id')::text IS NULL OR p."createdById" = sqlc.narg('commercial_id')::text)
  AND (sqlc.narg('type')::"ProspectType" IS NULL OR p."type" = sqlc.narg('type')::"ProspectType")
  AND (sqlc.narg('canal_provenance_id')::text IS NULL OR p."canalProvenanceId" = sqlc.narg('canal_provenance_id')::text)
  AND (sqlc.narg('representant_id')::text IS NULL OR p."representantId" = sqlc.narg('representant_id')::text)
  AND (sqlc.narg('banque_id')::text IS NULL OR p."banqueId" = sqlc.narg('banque_id')::text)
  AND (sqlc.narg('syndicat_id')::text IS NULL OR p."syndicatId" = sqlc.narg('syndicat_id')::text)
  AND (sqlc.narg('origin')::text IS NULL OR p."origin" = sqlc.narg('origin')::text)
  AND (sqlc.narg('phase2_status')::"Phase2Status" IS NULL OR p."phase2Status" = sqlc.narg('phase2_status')::"Phase2Status")
  AND (sqlc.narg('enrollment_method')::"EnrollmentMethod" IS NULL OR p."enrollmentMethod" = sqlc.narg('enrollment_method')::"EnrollmentMethod")
  AND (sqlc.narg('enrollment_captured_by_id')::text IS NULL OR p."enrollmentCapturedById" = sqlc.narg('enrollment_captured_by_id')::text)
  AND (sqlc.narg('last_call_by_id')::text IS NULL OR p."lastCallById" = sqlc.narg('last_call_by_id')::text)
  AND (sqlc.narg('departement_id')::text IS NULL OR r."departementId" = sqlc.narg('departement_id')::text)
  AND (
    sqlc.narg('projet')::"Projet" IS NULL
    OR EXISTS (
      SELECT 1 FROM "prospect_journeys" j
      WHERE j."prospectId" = p."id"
        AND j."projet" = sqlc.narg('projet')::"Projet"
        AND (sqlc.narg('statut')::"ProspectStatut" IS NULL OR j."statut" = sqlc.narg('statut')::"ProspectStatut")
    )
  )
  AND (
    sqlc.narg('projet')::"Projet" IS NOT NULL
    OR sqlc.narg('statut')::"ProspectStatut" IS NULL
    OR p."statut" = sqlc.narg('statut')::"ProspectStatut"
  )
  AND (
    sqlc.narg('revue')::boolean IS NULL
    OR (p."statut" = 'CONVERTI' AND (p."revueAt" IS NOT NULL) = sqlc.narg('revue')::boolean)
  )
  AND (
    sqlc.narg('segment')::text IS NULL
    OR sqlc.narg('segment')::text = CASE
      WHEN sy."sigle" IS NULL OR b."shortName" IS NULL THEN NULL
      WHEN sy."sigle" = 'CHUES' AND b."shortName" = 'CBAO' THEN 'BDD1'
      WHEN sy."sigle" = 'CHUES' THEN 'BDD2'
      WHEN b."shortName" = 'CBAO' THEN 'BDD3'
      ELSE 'BDD4'
    END
  )
  AND (
    sqlc.narg('appele_par')::text IS NULL
    OR EXISTS (
      SELECT 1 FROM "call_attempts" ca
      WHERE ca."prospectId" = p."id" AND ca."performedById" = sqlc.narg('appele_par')::text
    )
  )
  AND (sqlc.narg('date_from')::timestamp IS NULL OR p."clientCreatedAt" >= sqlc.narg('date_from')::timestamp)
  AND (sqlc.narg('date_to')::timestamp IS NULL OR p."clientCreatedAt" <= sqlc.narg('date_to')::timestamp)
  AND (
    sqlc.narg('search')::text IS NULL
    OR public.immutable_unaccent(lower(p."nom") || ' ' || lower(p."prenom"))
       LIKE '%' || public.immutable_unaccent(lower(sqlc.narg('search')::text)) || '%'
    OR (sqlc.narg('phone_search')::text IS NOT NULL AND p."phoneE164" LIKE '%' || sqlc.narg('phone_search')::text || '%')
  );

-- name: ProspectVivant :one
SELECT "id", "createdById", "statut", "phoneE164", "nom", "prenom", "whatsappStatus", "whatsappE164",
       "paymentMode", "dureeSystemeMois", "representantId", "clientCreatedAt", "banqueId", "syndicatId",
       "email", "profession", "professionId", "employeur", "etablissement", "incomeBandId", "type",
       "champsLibres"
FROM "prospects" WHERE "id" = $1 AND "deletedAt" IS NULL;

-- name: ProspectProprietaire :one
SELECT "id", "createdById" FROM "prospects" WHERE "id" = $1;

-- name: ProspectDoublonTelephone :one
SELECT p."id", p."nom", p."prenom", p."createdAt", p."createdById", p."representantId",
       o."fullName" AS owner_name, r."fullName" AS representant_name
FROM "prospects" p
JOIN "users" o ON o."id" = p."createdById"
LEFT JOIN "representants" r ON r."id" = p."representantId"
WHERE p."phoneE164" = sqlc.arg('phone_e164') AND p."deletedAt" IS NULL
  AND (sqlc.narg('sauf_id')::text IS NULL OR p."id" <> sqlc.narg('sauf_id')::text)
LIMIT 1;

-- name: ProspectRattachable :one
SELECT p."id", p."createdById",
       EXISTS (SELECT 1 FROM "prospect_journeys" j WHERE j."prospectId" = p."id" AND j."projet" = sqlc.arg('projet')) AS a_le_parcours
FROM "prospects" p
WHERE p."phoneE164" = sqlc.arg('phone_e164') AND p."deletedAt" IS NULL
LIMIT 1;

-- name: RepresentantVivant :one
SELECT "id" FROM "representants" WHERE "id" = $1 AND "deletedAt" IS NULL;

-- name: UtilisateurVivant :one
SELECT "id" FROM "users" WHERE "id" = $1 AND "deletedAt" IS NULL;

-- name: InsertProspect :exec
INSERT INTO "prospects" (
  "id", "nom", "prenom", "phoneE164", "createdById", "clientCreatedAt", "updatedAt",
  "statut", "projet", "banqueId", "syndicatId", "representantId", "type", "profession",
  "professionId", "etablissement", "incomeBandId", "paymentMode", "dureeSystemeMois",
  "canalProvenanceId", "employeurId", "employeur", "typeContrat", "ancienneteMois",
  "lieuActivite", "modeEpargne", "paysResidenceId", "villeResidence", "relaisNom",
  "relaisPhoneE164", "whatsappStatus", "whatsappE164", "email", "origin", "aRevoirAt",
  "champsLibres"
) VALUES (
  $1, $2, $3, $4, $5, $6, now(),
  $7, $8, $9, $10, $11, $12, $13,
  $14, $15, $16, $17, $18,
  $19, $20, $21, $22, $23,
  $24, $25, $26, $27, $28,
  $29, $30, $31, $32, $33, $34,
  $35
);

-- name: SoftDeleteProspect :exec
UPDATE "prospects" SET "deletedAt" = now(), "rev" = "rev" + 1 WHERE "id" = $1;

-- name: AnnulerRappelsEnAttente :exec
UPDATE "scheduled_callbacks" SET "status" = 'CANCELLED'
WHERE "prospectId" = $1 AND "status" = 'PENDING';

-- name: MarquerProspectRevue :exec
UPDATE "prospects" SET "revueAt" = now(), "revueById" = $2 WHERE "id" = $1 AND "revueAt" IS NULL;

-- name: MarquerProspectConverti :exec
UPDATE "prospects" SET "statut" = 'CONVERTI', "rev" = "rev" + 1 WHERE "id" = $1;

-- name: JourneysDesProspects :many
SELECT "id", "prospectId", "projet", "statut", "consent", "consentAt", "convertedAt"
FROM "prospect_journeys"
WHERE "prospectId" = ANY(sqlc.arg('ids')::text[])
ORDER BY "prospectId", "createdAt";

-- name: JourneyParProjet :one
SELECT "id", "statut", "consent" FROM "prospect_journeys"
WHERE "prospectId" = $1 AND "projet" = $2;

-- name: InsertJourney :exec
INSERT INTO "prospect_journeys" ("id", "prospectId", "projet", "statut", "consent", "consentAt", "consentById", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, now());

-- name: UpsertJourneyStatut :exec
INSERT INTO "prospect_journeys" ("id", "prospectId", "projet", "statut", "consent", "consentAt", "updatedAt")
VALUES (sqlc.arg('id'), sqlc.arg('prospect_id'), sqlc.arg('projet'), sqlc.arg('statut'), sqlc.arg('consent'), sqlc.narg('consent_at'), now())
ON CONFLICT ("prospectId", "projet") DO UPDATE
SET "statut" = COALESCE(sqlc.narg('statut_maj')::"ProspectStatut", "prospect_journeys"."statut");

-- name: UpsertJourneyConsentement :exec
INSERT INTO "prospect_journeys" ("id", "prospectId", "projet", "consent", "consentAt", "consentById", "updatedAt")
VALUES (sqlc.arg('id'), sqlc.arg('prospect_id'), 'GRAND_PUBLIC', sqlc.arg('consent'), sqlc.narg('consent_at'), sqlc.narg('consent_by_id'), now())
ON CONFLICT ("prospectId", "projet") DO UPDATE
SET "consent" = EXCLUDED."consent", "consentAt" = EXCLUDED."consentAt", "consentById" = EXCLUDED."consentById";

-- name: ConvertirJourney :exec
UPDATE "prospect_journeys"
SET "statut" = 'CONVERTI', "convertedAt" = $2, "convertedById" = $3
WHERE "id" = $1;

-- name: UpsertConversion :exec
INSERT INTO "prospect_conversions" ("id", "journeyId", "offerId", "paymentMode", "amountXof", "durationMonths", "confirmedById", "confirmedAt")
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT ("journeyId") DO UPDATE
SET "offerId" = EXCLUDED."offerId",
    "paymentMode" = COALESCE(EXCLUDED."paymentMode", "prospect_conversions"."paymentMode"),
    "amountXof" = COALESCE(EXCLUDED."amountXof", "prospect_conversions"."amountXof"),
    "durationMonths" = COALESCE(EXCLUDED."durationMonths", "prospect_conversions"."durationMonths"),
    "confirmedById" = EXCLUDED."confirmedById",
    "confirmedAt" = EXCLUDED."confirmedAt";

-- name: JourneysAFusionner :many
SELECT j."id", j."projet", j."statut", j."consent", (c."id" IS NOT NULL)::boolean AS a_conversion
FROM "prospect_journeys" j
LEFT JOIN "prospect_conversions" c ON c."journeyId" = j."id"
WHERE j."prospectId" = $1;

-- name: DeplacerJourney :exec
UPDATE "prospect_journeys" SET "prospectId" = $2 WHERE "id" = $1;

-- name: FusionnerJourney :exec
UPDATE "prospect_journeys" SET "statut" = $2, "consent" = $3 WHERE "id" = $1;

-- name: SupprimerJourney :exec
DELETE FROM "prospect_journeys" WHERE "id" = $1;

-- name: CompterDossiersBancairesOuverts :one
SELECT count(*)::int AS total
FROM "bank_cases" bc
JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
WHERE bc."prospectId" = ANY(sqlc.arg('ids')::text[]) AND st."type" = 'OPEN';

-- name: DeplacerDossiersBancaires :exec
UPDATE "bank_cases" SET "prospectId" = $2 WHERE "prospectId" = $1;

-- name: DeplacerTentatives :exec
UPDATE "call_attempts" SET "prospectId" = $2 WHERE "prospectId" = $1;

-- name: DeplacerRappels :exec
UPDATE "scheduled_callbacks" SET "prospectId" = $2 WHERE "prospectId" = $1;

-- name: DeplacerDemandesClient :exec
UPDATE "client_creation_requests" SET "createdProspectId" = $2 WHERE "createdProspectId" = $1;

-- name: FusionnerProspect :exec
UPDATE "prospects" t SET
  "nom" = CASE WHEN sqlc.arg('prefer_source')::boolean THEN s."nom" ELSE t."nom" END,
  "prenom" = CASE WHEN sqlc.arg('prefer_source')::boolean THEN s."prenom" ELSE t."prenom" END,
  "phoneE164" = CASE WHEN sqlc.arg('prefer_source')::boolean THEN s."phoneE164" ELSE t."phoneE164" END,
  "banqueId" = CASE WHEN sqlc.arg('prefer_source')::boolean THEN s."banqueId" ELSE t."banqueId" END,
  "syndicatId" = CASE WHEN sqlc.arg('prefer_source')::boolean THEN s."syndicatId" ELSE t."syndicatId" END,
  "statut" = CASE WHEN sqlc.arg('prefer_source')::boolean THEN s."statut" ELSE t."statut" END,
  "clientCreatedAt" = LEAST(s."clientCreatedAt", t."clientCreatedAt"),
  "rev" = t."rev" + 1
FROM "prospects" s
WHERE s."id" = sqlc.arg('source_id') AND t."id" = sqlc.arg('target_id');

-- name: ProspectsAReaffecter :many
SELECT "id" FROM "prospects"
WHERE "id" = ANY(sqlc.arg('ids')::text[]) AND "deletedAt" IS NULL
  AND (sqlc.arg('scope_all')::boolean OR "createdById" = sqlc.arg('scope_user_id')::text);

-- name: ReaffecterProspects :exec
UPDATE "prospects" SET
  "representantId" = COALESCE(sqlc.narg('representant_id')::text, "representantId"),
  "createdById" = COALESCE(sqlc.narg('commercial_id')::text, "createdById"),
  "rev" = "rev" + 1
WHERE "id" = ANY(sqlc.arg('ids')::text[]);

-- name: DernieresTentatives :many
SELECT
  p."id" AS prospect_id,
  a."outcome",
  a."comment",
  a."createdAt" AS at,
  (SELECT count(*) FROM "call_attempts" n WHERE n."prospectId" = p."id")::int AS nombre
FROM "prospects" p
JOIN LATERAL (
  SELECT ca."outcome", ca."comment", ca."createdAt"
  FROM "call_attempts" ca
  WHERE ca."prospectId" = p."id"
  ORDER BY ca."createdAt" DESC, ca."id" DESC
  LIMIT 1
) a ON TRUE
WHERE p."id" = ANY(sqlc.arg('ids')::text[]);

-- name: TentativesDuProspect :many
SELECT
  a."id", a."outcome", a."method", a."comment", a."email", a."fonctionnaire",
  a."engagementEnCours", a."dureeEtablissementMois", a."rendezVousAt", a."deviceCallType",
  a."deviceCallDurationSeconds", a."deviceCallAt", a."performedById", a."clientCreatedAt",
  u."fullName" AS performed_by_name,
  cr."label" AS reason_label,
  ou."firstInputAt" AS ouverture_first_input_at,
  ou."closedAt" AS ouverture_closed_at
FROM "call_attempts" a
JOIN "users" u ON u."id" = a."performedById"
LEFT JOIN "call_outcome_reasons" cr ON cr."id" = a."reasonId"
LEFT JOIN "ouvertures_fiche" ou ON ou."closingAttemptId" = a."id" AND ou."firstInputAt" IS NOT NULL
WHERE a."prospectId" = $1
ORDER BY a."clientCreatedAt" DESC, a."id" DESC;

-- name: AppSettingParCle :one
SELECT "key", "value", "updatedAt" FROM "app_settings" WHERE "key" = $1;

-- name: AppSettingsParCles :many
SELECT "key", "value" FROM "app_settings" WHERE "key" = ANY(sqlc.arg('keys')::text[]);

-- name: UpsertAppSetting :exec
INSERT INTO "app_settings" ("key", "value", "updatedById", "updatedAt")
VALUES ($1, $2, $3, now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedById" = EXCLUDED."updatedById";

-- name: InsertAppSettingChange :exec
INSERT INTO "app_setting_changes" ("id", "key", "oldValue", "newValue", "changedById")
VALUES ($1, $2, $3, $4, $5);

-- name: JournalAppSettings :many
SELECT c."id", c."key", c."oldValue", c."newValue", c."changedAt", u."fullName" AS changed_by_name
FROM "app_setting_changes" c
LEFT JOIN "users" u ON u."id" = c."changedById"
WHERE c."key" = ANY(sqlc.arg('keys')::text[])
ORDER BY c."changedAt" DESC, c."id" DESC
LIMIT sqlc.arg('taille')::int;

-- name: BanquesActives :many
SELECT "id", "name" AS libelle FROM "banques" WHERE "isActive" ORDER BY "sortOrder", "name";

-- name: SyndicatsActifs :many
SELECT "id", "name" AS libelle FROM "syndicats" WHERE "isActive" ORDER BY "sortOrder", "name";

-- name: TranchesRevenuActives :many
SELECT "id", "label" AS libelle FROM "income_bands" WHERE "isActive" ORDER BY "position", "minXof";

-- name: ProfessionsActives :many
SELECT "id", "label" AS libelle FROM "professions" WHERE "isActive" ORDER BY "position", "label";

-- name: ProfessionActive :one
SELECT "id", "label" FROM "professions" WHERE "id" = $1 AND "isActive";

-- name: AgentParJeton :one
SELECT "id" FROM "users" WHERE "id" = $1 AND "isActive" AND "deletedAt" IS NULL;

-- name: ProspectParEmail :one
SELECT "id", "createdById", "statut", "phoneE164", "nom", "prenom", "whatsappStatus", "whatsappE164",
       "paymentMode", "dureeSystemeMois", "representantId", "clientCreatedAt", "banqueId", "syndicatId",
       "email", "profession", "professionId", "employeur", "etablissement", "incomeBandId", "type",
       "champsLibres"
FROM "prospects" WHERE "email" = $1 AND "deletedAt" IS NULL ORDER BY "id" LIMIT 1;

-- name: ProspectParTelephone :one
SELECT "id", "createdById", "statut", "phoneE164", "nom", "prenom", "whatsappStatus", "whatsappE164",
       "paymentMode", "dureeSystemeMois", "representantId", "clientCreatedAt", "banqueId", "syndicatId",
       "email", "profession", "professionId", "employeur", "etablissement", "incomeBandId", "type",
       "champsLibres"
FROM "prospects" WHERE "phoneE164" = $1 AND "deletedAt" IS NULL LIMIT 1;

-- name: ProspectPourSegment :one
SELECT p."rev", p."banqueId", p."syndicatId",
       b."shortName" AS banque_short_name, sy."sigle" AS syndicat_sigle
FROM "prospects" p
LEFT JOIN "banques" b ON b."id" = p."banqueId"
LEFT JOIN "syndicats" sy ON sy."id" = p."syndicatId"
WHERE p."id" = $1 AND p."deletedAt" IS NULL;

-- name: BasculerSegmentProspect :execrows
UPDATE "prospects"
SET "banqueId" = @banque_id, "syndicatId" = @syndicat_id, "rev" = "rev" + 1
WHERE "id" = @id AND "rev" = @rev AND "deletedAt" IS NULL;

-- name: InsererSegmentChange :exec
INSERT INTO "segment_changes" (
  "id", "prospectId", "fromSegment", "toSegment", "fromBanqueId", "toBanqueId",
  "fromSyndicatId", "toSyndicatId", "reason", "changedById", "source"
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);

-- name: ListerSegmentChanges :many
SELECT c.*, u."fullName" AS changed_by_name
FROM "segment_changes" c
JOIN "users" u ON u."id" = c."changedById"
WHERE c."prospectId" = $1
ORDER BY c."changedAt" DESC, c."id" DESC;

-- name: BanqueSigleSegment :one
SELECT "shortName" FROM "banques" WHERE "id" = $1;

-- name: SyndicatSigleSegment :one
SELECT "sigle" FROM "syndicats" WHERE "id" = $1;
