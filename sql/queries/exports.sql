-- Classeurs d'export. Les pages sont keyset : $1 nul = première page.
-- Les prospects filtrés, les représentants filtrés et les dossiers bancaires
-- ont des prédicats optionnels et restent en pgx direct (plan.md 2.1).

-- name: ExportBanquesActives :many
SELECT "shortName" FROM "banques" WHERE "isActive" ORDER BY "sortOrder" ASC, "shortName" ASC;

-- name: ExportSyndicatsActifs :many
SELECT "sigle" FROM "syndicats" WHERE "isActive" ORDER BY "sortOrder" ASC, "sigle" ASC;

-- name: ExportCanauxActifs :many
SELECT "label" FROM "canaux_provenance" WHERE "isActive" ORDER BY "position" ASC, "label" ASC;

-- name: ExportEmployeursActifs :many
SELECT "label" FROM "employeurs" WHERE "isActive" ORDER BY "position" ASC, "label" ASC;

-- name: ExportPaysActifs :many
SELECT "label" FROM "pays" WHERE "isActive" ORDER BY "position" ASC, "label" ASC;

-- name: ExportDepartementsActifs :many
SELECT "name" FROM "departements" WHERE "isActive" ORDER BY "name" ASC;

-- name: ExportIefsActives :many
SELECT "name" FROM "iefs" WHERE "isActive" ORDER BY "name" ASC;

-- name: ExportReglagesConversion :one
SELECT "value" FROM "app_settings" WHERE "key" = $1;

-- name: ExportGlobalRepresentants :many
SELECT
  r."id", r."fullName", r."prenom", r."phoneE164", r."etablissement",
  reg."name" AS region, d."name" AS departement, i."name" AS ief,
  cb."fullName" AS teleconseiller, r."createdById",
  sq."label" AS qualification,
  r."whatsappStatus"::text AS whatsapp_statut,
  COALESCE(CASE r."whatsappStatus"
    WHEN 'MEME_NUMERO' THEN r."phoneE164"
    WHEN 'AUTRE_NUMERO' THEN r."whatsappE164"
  END, '')::text AS whatsapp,
  r."profession", r."syndicat", r."connaitUES", r."contacte", r."notes",
  COALESCE(r."lastCallOutcome"::text, '')::text AS derniere_issue, r."lastCallAt",
  lb."fullName" AS dernier_appel_par, r."lastCallById",
  r."nextCallbackAt", COALESCE(r."nextCallbackOrigine"::text, '')::text AS relance_origine,
  r."clientCreatedAt", r."createdAt", r."updatedAt",
  (SELECT COUNT(*) FROM "prospects" p
   WHERE p."representantId" = r."id" AND p."deletedAt" IS NULL)::int AS prospects
FROM "representants" r
INNER JOIN "departements" d ON d."id" = r."departementId"
INNER JOIN "regions" reg ON reg."id" = d."regionId"
LEFT JOIN "iefs" i ON i."id" = r."iefId"
INNER JOIN "users" cb ON cb."id" = r."createdById"
LEFT JOIN "users" lb ON lb."id" = r."lastCallById"
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
WHERE r."deletedAt" IS NULL AND (sqlc.narg('apres')::text IS NULL OR r."id" > sqlc.narg('apres')::text)
ORDER BY r."id" ASC
LIMIT 1000;

-- name: ExportGlobalRappels :many
SELECT
  c."id", c."prospectId", p."prenom", p."nom", p."phoneE164",
  u."fullName" AS assigne, c."assignedToId", c."scheduledAt",
  c."status"::text AS statut, c."comment", c."sourceAttemptId", c."closedAttemptId",
  c."createdAt", c."updatedAt"
FROM "scheduled_callbacks" c
INNER JOIN "prospects" p ON p."id" = c."prospectId"
INNER JOIN "users" u ON u."id" = c."assignedToId"
WHERE p."deletedAt" IS NULL AND (sqlc.narg('apres')::text IS NULL OR c."id" > sqlc.narg('apres')::text)
ORDER BY c."id" ASC
LIMIT 1000;

-- name: ExportGlobalParcours :many
SELECT
  j."id", j."prospectId", p."prenom", p."nom", p."phoneE164",
  j."projet"::text AS projet, j."statut"::text AS statut,
  j."consent"::text AS consentement, j."consentAt", cs."fullName" AS consentement_par,
  j."phase2Status"::text AS phase2, COALESCE(j."enrollmentMethod"::text, '')::text AS methode,
  j."enrollmentCapturedAt", ec."fullName" AS methode_par,
  j."convertedAt", cv."fullName" AS converti_par,
  j."closedAt", j."closedReason", cl."fullName" AS ferme_par,
  j."createdAt", j."updatedAt"
FROM "prospect_journeys" j
INNER JOIN "prospects" p ON p."id" = j."prospectId"
LEFT JOIN "users" cs ON cs."id" = j."consentById"
LEFT JOIN "users" ec ON ec."id" = j."enrollmentCapturedById"
LEFT JOIN "users" cv ON cv."id" = j."convertedById"
LEFT JOIN "users" cl ON cl."id" = j."closedById"
WHERE p."deletedAt" IS NULL AND (sqlc.narg('apres')::text IS NULL OR j."id" > sqlc.narg('apres')::text)
ORDER BY j."id" ASC
LIMIT 1000;

-- name: ExportGlobalConversions :many
SELECT
  c."id", c."journeyId", j."prospectId", p."prenom", p."nom",
  j."projet"::text AS projet, o."label" AS offre,
  COALESCE(c."paymentMode"::text, '')::text AS paiement, c."amountXof", c."durationMonths",
  u."fullName" AS confirme_par, c."confirmedById", c."confirmedAt"
FROM "prospect_conversions" c
INNER JOIN "prospect_journeys" j ON j."id" = c."journeyId"
INNER JOIN "prospects" p ON p."id" = j."prospectId"
LEFT JOIN "offers" o ON o."id" = c."offerId"
INNER JOIN "users" u ON u."id" = c."confirmedById"
WHERE p."deletedAt" IS NULL AND (sqlc.narg('apres')::text IS NULL OR c."id" > sqlc.narg('apres')::text)
ORDER BY c."id" ASC
LIMIT 1000;

-- name: ExportGlobalAppelsProspects :many
SELECT
  a."id", a."prospectId", p."prenom", p."nom", p."phoneE164",
  u."fullName" AS teleconseiller, a."performedById", a."clientCreatedAt",
  a."outcome"::text AS issue, rs."label" AS motif, a."comment",
  COALESCE(a."method"::text, '')::text AS methode, a."rendezVousAt", a."email",
  a."fonctionnaire", a."engagementEnCours", a."dureeEtablissementMois",
  a."deviceCallType", a."deviceCallDurationSeconds", a."deviceCallAt", a."createdAt"
FROM "call_attempts" a
INNER JOIN "prospects" p ON p."id" = a."prospectId"
INNER JOIN "users" u ON u."id" = a."performedById"
LEFT JOIN "call_outcome_reasons" rs ON rs."id" = a."reasonId"
WHERE p."deletedAt" IS NULL AND (sqlc.narg('apres')::text IS NULL OR a."id" > sqlc.narg('apres')::text)
ORDER BY a."id" ASC
LIMIT 1000;

-- name: ExportGlobalAppelsRepresentants :many
SELECT
  a."id", a."representantId", r."fullName", r."phoneE164",
  u."fullName" AS teleconseiller, a."performedById", a."clientCreatedAt",
  a."outcome"::text AS issue, a."comment", a."promisedProspects", a."callbackAt",
  a."etablissementConfirme", a."numeroConfirme", a."contacte", a."connaitUES",
  a."syndicat", sq."label" AS qualification,
  a."deviceCallType", a."deviceCallDurationSeconds", a."deviceCallAt", a."createdAt"
FROM "rep_call_attempts" a
INNER JOIN "representants" r ON r."id" = a."representantId"
INNER JOIN "users" u ON u."id" = a."performedById"
LEFT JOIN "statuts_qualification" sq ON sq."id" = a."statutQualificationId"
WHERE r."deletedAt" IS NULL AND (sqlc.narg('apres')::text IS NULL OR a."id" > sqlc.narg('apres')::text)
ORDER BY a."id" ASC
LIMIT 1000;

-- name: ExportGlobalCampagnes :many
SELECT
  l."id", l."name", l."cible"::text AS cible, l."projet"::text AS projet,
  l."itemCount", l."filters", u."fullName" AS cree_par, l."createdById", l."createdAt"
FROM "lots_export" l
INNER JOIN "users" u ON u."id" = l."createdById"
WHERE (sqlc.narg('apres')::text IS NULL OR l."id" > sqlc.narg('apres')::text)
ORDER BY l."id" ASC
LIMIT 1000;

-- name: ExportGlobalAffectations :many
SELECT
  i."position", i."day", i."prospectId", i."representantId",
  p."prenom", p."nom", p."phoneE164" AS prospect_phone,
  COALESCE(p."lastCallOutcome"::text, '')::text AS prospect_issue, p."lastCallAt" AS prospect_appel,
  r."fullName", r."phoneE164" AS representant_phone,
  COALESCE(r."lastCallOutcome"::text, '')::text AS representant_issue, r."lastCallAt" AS representant_appel,
  u."fullName" AS assigne, i."assigneeId", COALESCE(u."role"::text, '')::text AS role
FROM "lot_export_items" i
LEFT JOIN "prospects" p ON p."id" = i."prospectId" AND p."deletedAt" IS NULL
LEFT JOIN "representants" r ON r."id" = i."representantId" AND r."deletedAt" IS NULL
LEFT JOIN "users" u ON u."id" = i."assigneeId"
WHERE i."lotId" = $1 AND i."position" > $2 AND (p."id" IS NOT NULL OR r."id" IS NOT NULL)
ORDER BY i."position" ASC
LIMIT 1000;

-- name: ExportGlobalCommentaires :many
SELECT
  c."id", c."representantId", r."fullName", r."phoneE164", c."body",
  u."fullName" AS auteur, c."authorId", c."clientCreatedAt", c."createdAt"
FROM "representant_comments" c
INNER JOIN "representants" r ON r."id" = c."representantId"
INNER JOIN "users" u ON u."id" = c."authorId"
WHERE c."deletedAt" IS NULL AND r."deletedAt" IS NULL AND (sqlc.narg('apres')::text IS NULL OR c."id" > sqlc.narg('apres')::text)
ORDER BY c."id" ASC
LIMIT 1000;

-- name: ExportGlobalChangementsSegment :many
SELECT
  s."id", s."prospectId", p."prenom", p."nom",
  s."fromSegment"::text AS avant, s."toSegment"::text AS apres, s."reason",
  u."fullName" AS auteur, s."changedById", s."changedAt", s."source"::text AS source,
  COALESCE(bf."name", s."fromBanqueId") AS banque_avant,
  COALESCE(bt."name", s."toBanqueId") AS banque_apres,
  COALESCE(sf."sigle", s."fromSyndicatId") AS syndicat_avant,
  COALESCE(st."sigle", s."toSyndicatId") AS syndicat_apres
FROM "segment_changes" s
INNER JOIN "prospects" p ON p."id" = s."prospectId"
INNER JOIN "users" u ON u."id" = s."changedById"
LEFT JOIN "banques" bf ON bf."id" = s."fromBanqueId"
LEFT JOIN "banques" bt ON bt."id" = s."toBanqueId"
LEFT JOIN "syndicats" sf ON sf."id" = s."fromSyndicatId"
LEFT JOIN "syndicats" st ON st."id" = s."toSyndicatId"
WHERE p."deletedAt" IS NULL AND (sqlc.narg('apres')::text IS NULL OR s."id" > sqlc.narg('apres')::text)
ORDER BY s."id" ASC
LIMIT 1000;

-- name: ExportGlobalChangementsQualification :many
SELECT
  c."id", c."representantId", r."fullName",
  c."fromStatus"::text AS avant, c."toStatus"::text AS apres, c."reason",
  u."fullName" AS auteur, c."changedById", c."changedAt", c."source"::text AS source
FROM "representant_relation_changes" c
INNER JOIN "representants" r ON r."id" = c."representantId"
INNER JOIN "users" u ON u."id" = c."changedById"
WHERE r."deletedAt" IS NULL AND (sqlc.narg('apres')::text IS NULL OR c."id" > sqlc.narg('apres')::text)
ORDER BY c."id" ASC
LIMIT 1000;

-- name: ExportGlobalReaffectations :many
SELECT
  a."id", a."lotId", l."name", fa."fullName" AS de, ta."fullName" AS vers,
  u."fullName" AS auteur, a."performedById", a."createdAt", a."fiches", a."positions"
FROM "lot_export_reaffectations" a
INNER JOIN "lots_export" l ON l."id" = a."lotId"
LEFT JOIN "users" fa ON fa."id" = a."fromAssigneeId"
INNER JOIN "users" ta ON ta."id" = a."toAssigneeId"
INNER JOIN "users" u ON u."id" = a."performedById"
WHERE (sqlc.narg('apres')::text IS NULL OR a."id" > sqlc.narg('apres')::text)
ORDER BY a."id" ASC
LIMIT 1000;

-- name: ExportGlobalSuggestions :many
SELECT
  s."id", s."sourceRepresentantId", src."fullName" AS source,
  s."suggestedName", s."suggestedPhoneE164", s."note",
  u."fullName" AS suggere_par, s."suggestedById", s."status"::text AS statut,
  s."resolvedRepresentantId", res."fullName" AS retrouve,
  s."sourceAttemptId", s."clientCreatedAt", s."createdAt"
FROM "representant_suggestions" s
INNER JOIN "representants" src ON src."id" = s."sourceRepresentantId"
INNER JOIN "users" u ON u."id" = s."suggestedById"
LEFT JOIN "representants" res ON res."id" = s."resolvedRepresentantId"
WHERE s."deletedAt" IS NULL AND src."deletedAt" IS NULL AND (sqlc.narg('apres')::text IS NULL OR s."id" > sqlc.narg('apres')::text)
ORDER BY s."id" ASC
LIMIT 1000;

-- name: ExportVisites :many
SELECT
  v."reference", v."visitedAt", v."timeKnown", v."visitorName", v."phone",
  e."label" AS entreprise, d."label" AS direction, ds."label" AS destinataire,
  o."label" AS objet, v."comment", v."createdAt"
FROM "visites" v
INNER JOIN "visite_entreprises" e ON e."id" = v."entrepriseId"
INNER JOIN "visite_objets" o ON o."id" = v."objetId"
LEFT JOIN "visite_directions" d ON d."id" = v."directionId"
LEFT JOIN "visite_destinataires" ds ON ds."id" = v."destinataireId"
WHERE (sqlc.narg('apres')::text IS NULL OR v."reference" > sqlc.narg('apres')::text)
  AND (sqlc.narg('du')::timestamp IS NULL OR v."visitedAt" >= sqlc.narg('du')::timestamp)
  AND (sqlc.narg('au')::timestamp IS NULL OR v."visitedAt" <= sqlc.narg('au')::timestamp)
  AND (sqlc.narg('entreprise')::text IS NULL OR v."entrepriseId" = sqlc.narg('entreprise')::text)
  AND (sqlc.narg('direction')::text IS NULL OR v."directionId" = sqlc.narg('direction')::text)
  AND (sqlc.narg('destinataire')::text IS NULL OR v."destinataireId" = sqlc.narg('destinataire')::text)
  AND (sqlc.narg('objet')::text IS NULL OR v."objetId" = sqlc.narg('objet')::text)
  AND (sqlc.narg('recherche')::text IS NULL
       OR v."visitorName" ILIKE '%' || sqlc.narg('recherche')::text || '%'
       OR v."reference" LIKE '%' || upper(sqlc.narg('recherche')::text) || '%')
ORDER BY v."reference" ASC
LIMIT 1000;
