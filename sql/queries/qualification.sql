-- name: RepresentantAQualifier :one
SELECT r."fullName", r."prenom", r."phoneE164", r."etablissement", r."notes",
       r."departementId", r."iefId", r."whatsappStatus", r."whatsappE164",
       r."profession", r."syndicat", r."connaitUES", r."contacte",
       r."relationStatus", r."lastCallAt"
FROM "representants" r
WHERE r."id" = @id AND r."deletedAt" IS NULL
  AND (@tous::bool
       OR r."createdById" = @agent
       OR EXISTS (SELECT 1 FROM "lot_export_items" li
                  JOIN "lots_export" l ON l."id" = li."lotId" AND l."pausedAt" IS NULL
                  WHERE li."representantId" = r."id" AND li."assigneeId" = @agent));

-- name: RepresentantExisteAilleurs :one
SELECT EXISTS (SELECT 1 FROM "representants" WHERE "id" = $1 AND "deletedAt" IS NULL);

-- name: RepresentantParNumeroExact :one
SELECT "id" FROM "representants"
WHERE "phoneE164" = $1 AND "deletedAt" IS NULL LIMIT 1;

-- name: ProprietaireDuNumeroRepresentant :one
SELECT u."fullName"
FROM "representants" r JOIN "users" u ON u."id" = r."createdById"
WHERE r."phoneE164" = @phone AND r."deletedAt" IS NULL AND r."id" <> @id
LIMIT 1;

-- name: StatutQualificationParId :one
SELECT "id", "label", "effect", "relationStatus", "retryAfterMinutes",
       "requiresComment", "isActive"
FROM "statuts_qualification" WHERE "id" = $1;

-- name: RepAttemptExiste :one
SELECT EXISTS (SELECT 1 FROM "rep_call_attempts" WHERE "id" = $1);

-- name: InsererRepAttempt :execrows
INSERT INTO "rep_call_attempts" (
  "id", "representantId", "performedById", "comment",
  "callbackAt", "etablissementConfirme", "numeroConfirme", "contacte", "connaitUES",
  "syndicat", "statutQualificationId", "clientCreatedAt")
VALUES (@id, @representant_id, @performed_by_id, @comment,
        @callback_at, @etablissement_confirme, @numero_confirme, @contacte, @connait_ues,
        @syndicat, @statut_qualification_id, @client_created_at)
ON CONFLICT ("id") DO NOTHING;

-- name: InsererSuggestion :exec
INSERT INTO "representant_suggestions" (
  "id", "sourceRepresentantId", "suggestedName", "suggestedPhoneE164", "note",
  "suggestedById", "resolvedRepresentantId", "sourceAttemptId", "clientCreatedAt")
VALUES (@id, @source_representant_id, @suggested_name, @suggested_phone_e164, @note,
        @suggested_by_id, @resolved_representant_id, @source_attempt_id, @client_created_at);

-- name: MajRepresentantApresAppel :one
UPDATE "representants" SET
  "whatsappStatus" = COALESCE(CAST(sqlc.narg('whatsapp_status') AS text)::"WhatsappStatus", "whatsappStatus"),
  "whatsappE164" = CASE WHEN @maj_whatsapp_e164::bool THEN sqlc.narg('whatsapp_e164') ELSE "whatsappE164" END,
  "profession" = CASE WHEN @maj_profession::bool THEN sqlc.narg('profession') ELSE "profession" END,
  "syndicat" = CASE WHEN @maj_syndicat::bool THEN sqlc.narg('syndicat') ELSE "syndicat" END,
  "etablissement" = CASE WHEN @maj_etablissement::bool THEN sqlc.narg('etablissement') ELSE "etablissement" END,
  "connaitUES" = COALESCE(sqlc.narg('connait_ues'), "connaitUES"),
  "contacte" = COALESCE(sqlc.narg('contacte'), "contacte"),
  "statutQualificationId" = COALESCE(sqlc.narg('statut_qualification_id'), "statutQualificationId"),
  "phoneE164" = COALESCE(sqlc.narg('phone_e164'), "phoneE164"),
  "lastCallAt" = CASE WHEN @maj_dernier_appel::bool THEN sqlc.narg('last_call_at') ELSE "lastCallAt" END,
  "lastCallById" = CASE WHEN @maj_dernier_appel::bool THEN sqlc.narg('last_call_by_id') ELSE "lastCallById" END,
  "nextCallbackAt" = CASE WHEN @maj_dernier_appel::bool THEN sqlc.narg('next_callback_at') ELSE "nextCallbackAt" END,
  "nextCallbackOrigine" = CASE WHEN @maj_dernier_appel::bool
    THEN CAST(sqlc.narg('next_callback_origine') AS text)::"RappelOrigine" ELSE "nextCallbackOrigine" END,
  "rev" = "rev" + 1
WHERE "id" = @id
RETURNING "fullName", "prenom", "phoneE164", "etablissement", "notes", "departementId",
          "iefId", "whatsappStatus", "whatsappE164", "profession", "syndicat",
          "connaitUES", "contacte";

-- name: BasculerRelation :execrows
UPDATE "representants"
SET "relationStatus" = CAST(@vers AS text)::"RepresentantRelation", "rev" = "rev" + 1
WHERE "id" = @id AND "deletedAt" IS NULL
  AND "relationStatus" = CAST(@depuis AS text)::"RepresentantRelation";

-- name: InsererRelationChange :exec
INSERT INTO "representant_relation_changes"
  ("id", "representantId", "fromStatus", "toStatus", "changedById", "source")
VALUES (@id, @representant_id, CAST(@depuis AS text)::"RepresentantRelation",
        CAST(@vers AS text)::"RepresentantRelation", @changed_by_id, 'WEB');

-- name: CallAttemptExiste :one
SELECT EXISTS (SELECT 1 FROM "call_attempts" WHERE "id" = $1);

-- name: ProspectPourTentative :one
SELECT "id", "projet", "rev", "updatedAt", "lastCallAt", "incomeBandId",
       "phoneE164", "whatsappStatus", "whatsappE164"
FROM "prospects" WHERE "id" = $1 AND "deletedAt" IS NULL;

-- Un rappel promis se tient, même quand la campagne a rendu la fiche, et le
-- dernier à avoir appelé requalifie depuis « Mes contacts ». Une fiche
-- attribuée à un autre échappe à son créateur et à l'encadrement : deux
-- personnes appelleraient la même.
-- name: ProspectAttribue :one
SELECT EXISTS (
  SELECT 1 FROM "prospects" p
  WHERE p."id" = @id AND p."deletedAt" IS NULL
    AND ((@tous::bool OR p."createdById" = @agent)
         AND (@ignorer_attribution::bool
              OR NOT EXISTS (SELECT 1 FROM "lot_export_items" lc
                             WHERE lc."prospectId" = p."id" AND lc."assigneeId" IS NOT NULL
                               AND lc."assigneeId" <> @agent))
         OR EXISTS (SELECT 1 FROM "lot_export_items" li
                    JOIN "lots_export" l ON l."id" = li."lotId" AND l."pausedAt" IS NULL
                    WHERE li."prospectId" = p."id" AND li."assigneeId" = @agent)
         OR EXISTS (SELECT 1 FROM "scheduled_callbacks" c
                    WHERE c."prospectId" = p."id" AND c."assignedToId" = @agent AND c."status" = 'PENDING')
         OR p."lastCallById" = @agent));

-- name: ProspectOuvrable :one
SELECT EXISTS (
  SELECT 1 FROM "prospects" p
  WHERE p."id" = @id AND p."deletedAt" IS NULL
    AND ((@tous::bool OR p."createdById" = @agent)
         AND (@ignorer_attribution::bool
              OR NOT EXISTS (SELECT 1 FROM "lot_export_items" lc
                             WHERE lc."prospectId" = p."id" AND lc."assigneeId" IS NOT NULL
                               AND lc."assigneeId" <> @agent))
         OR EXISTS (SELECT 1 FROM "lot_export_items" li
                    JOIN "lots_export" l ON l."id" = li."lotId" AND l."pausedAt" IS NULL
                    WHERE li."prospectId" = p."id" AND li."assigneeId" = @agent)
         OR EXISTS (SELECT 1 FROM "scheduled_callbacks" c
                    WHERE c."prospectId" = p."id" AND c."assignedToId" = @agent AND c."status" = 'PENDING')
         OR p."lastCallById" = @agent
         OR (@converti_visible::bool AND p."statut" IN ('CONVERTI', 'VENDU'))));

-- name: OuvrirParcours :one
INSERT INTO "prospect_journeys" ("id", "prospectId", "projet")
VALUES (@id, @prospect_id, CAST(@projet AS text)::"Projet")
ON CONFLICT ("prospectId", "projet") DO UPDATE SET "prospectId" = EXCLUDED."prospectId"
RETURNING "id", "phase2Status", "enrollmentMethod", "enrollmentCapturedById", "enrollmentCapturedAt";

-- name: ParcoursDuProspect :one
SELECT "id", "phase2Status", "enrollmentMethod", "enrollmentCapturedById", "enrollmentCapturedAt"
FROM "prospect_journeys"
WHERE "prospectId" = @prospect_id AND "projet" = CAST(@projet AS text)::"Projet";

-- name: MotifIssueParCode :one
SELECT "id", "label", "effect", "requiresComment", "requiresCallback", "isActive", "countsAsReached"
FROM "call_outcome_reasons" WHERE "code" = $1;

-- name: InsererCallAttempt :execrows
INSERT INTO "call_attempts" (
  "id", "prospectId", "performedById", "reasonId", "method", "comment",
  "email", "fonctionnaire", "engagementEnCours", "dureeEtablissementMois",
  "rendezVousAt", "clientCreatedAt")
VALUES (@id, @prospect_id, @performed_by_id, @reason_id, CAST(sqlc.narg('method') AS text)::"EnrollmentMethod", @comment,
        @email, @fonctionnaire, @engagement_en_cours, @duree_etablissement_mois,
        @rendez_vous_at, @client_created_at)
ON CONFLICT ("id") DO NOTHING;

-- name: CorrigerProspectParTentative :one
UPDATE "prospects" SET
  "nom" = COALESCE(sqlc.narg('nom'), "nom"),
  "prenom" = COALESCE(sqlc.narg('prenom'), "prenom"),
  "profession" = COALESCE(sqlc.narg('profession'), "profession"),
  "banqueId" = COALESCE(sqlc.narg('banque_id'), "banqueId"),
  "syndicatId" = COALESCE(sqlc.narg('syndicat_id'), "syndicatId"),
  "type" = COALESCE(CAST(sqlc.narg('type') AS text)::"ProspectType", "type"),
  "incomeBandId" = COALESCE(sqlc.narg('income_band_id'), "incomeBandId"),
  "paymentMode" = COALESCE(CAST(sqlc.narg('payment_mode') AS text)::"PaymentMode", "paymentMode"),
  "dureeSystemeMois" = COALESCE(sqlc.narg('duree_systeme_mois'), "dureeSystemeMois"),
  "whatsappStatus" = COALESCE(CAST(sqlc.narg('whatsapp_status') AS text)::"WhatsappStatus", "whatsappStatus"),
  "whatsappE164" = CASE WHEN @maj_whatsapp_e164::bool THEN sqlc.narg('whatsapp_e164') ELSE "whatsappE164" END,
  "champsLibres" = CASE WHEN @maj_champs_libres::bool
    THEN COALESCE("champsLibres", '{}'::jsonb) || sqlc.narg('champs_libres')::jsonb
    ELSE "champsLibres" END,
  "lastReasonId" = CASE WHEN @maj_dernier_appel::bool THEN sqlc.narg('last_reason_id') ELSE "lastReasonId" END,
  "lastCallAt" = CASE WHEN @maj_dernier_appel::bool THEN sqlc.narg('last_call_at') ELSE "lastCallAt" END,
  "lastCallById" = CASE WHEN @maj_dernier_appel::bool THEN sqlc.narg('last_call_by_id') ELSE "lastCallById" END,
  "rev" = "rev" + CASE WHEN @maj_fiche::bool THEN 1 ELSE 0 END
WHERE "id" = @id
RETURNING "id", "projet", "statut", "rev", "updatedAt", "lastCallAt", "incomeBandId",
          "phoneE164", "whatsappStatus", "whatsappE164";

-- name: ProspectPourRequalification :one
SELECT p."id", p."projet", p."statut", p."lastCallById", p."createdById",
       COALESCE(cr."label", '')::text AS "motifLabel",
       COALESCE(t."fullName", '')::text AS "titulaireNom"
FROM "prospects" p
LEFT JOIN "call_outcome_reasons" cr ON cr."id" = p."lastReasonId"
LEFT JOIN "users" t ON t."id" = p."createdById"
WHERE p."id" = $1 AND p."deletedAt" IS NULL;

-- name: RequalifierMotifProspect :exec
UPDATE "prospects" SET "lastReasonId" = @reason_id::text, "rev" = "rev" + 1 WHERE "id" = @id;

-- name: RepresentantPourRequalification :one
SELECT r."relationStatus", r."createdById", COALESCE(sq."label", '')::text AS "statutLabel",
       COALESCE(t."fullName", '')::text AS "titulaireNom"
FROM "representants" r
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
LEFT JOIN "users" t ON t."id" = r."createdById"
WHERE r."id" = $1 AND r."deletedAt" IS NULL;

-- name: RequalifierRepresentant :exec
UPDATE "representants" SET
  "statutQualificationId" = @statut_qualification_id,
  "nextCallbackAt" = sqlc.narg('next_callback_at'),
  "nextCallbackOrigine" = CAST(sqlc.narg('next_callback_origine') AS text)::"RappelOrigine",
  "rev" = "rev" + 1
WHERE "id" = @id;

-- name: SupplanterRappels :exec
UPDATE "scheduled_callbacks" SET "status" = 'SUPERSEDED'
WHERE "prospectId" = $1 AND "status" = 'PENDING';

-- name: InsererRappel :exec
INSERT INTO "scheduled_callbacks"
  ("id", "prospectId", "assignedToId", "scheduledAt", "comment", "sourceAttemptId")
VALUES (@id, @prospect_id, @assigned_to_id, @scheduled_at, @comment, @source_attempt_id)
ON CONFLICT DO NOTHING;

-- name: CloreRappels :exec
UPDATE "scheduled_callbacks" SET "status" = 'DONE', "closedAttemptId" = @attempt_id
WHERE "prospectId" = @prospect_id AND "status" = 'PENDING';

-- name: MarquerProspectContacte :execrows
UPDATE "prospects" SET "statut" = 'CONTACTE' WHERE "id" = $1 AND "statut" = 'NOUVEAU';

-- name: MarquerParcoursContacte :exec
UPDATE "prospect_journeys" SET "statut" = 'CONTACTE' WHERE "id" = $1 AND "statut" = 'NOUVEAU';

-- L'enrôlement est un fait acquis : la fiche prend le statut du dernier appel,
-- mais seule une nouvelle méthode remplace celle déjà obtenue.
-- name: CloreParcours :exec
UPDATE "prospect_journeys" SET
  "phase2Status" = CAST(@phase2_status AS text)::"Phase2Status",
  "enrollmentMethod" = COALESCE(CAST(sqlc.narg('method') AS text)::"EnrollmentMethod", "enrollmentMethod"),
  "enrollmentCapturedAt" = COALESCE(@at, "enrollmentCapturedAt"),
  "enrollmentCapturedById" = COALESCE(@by, "enrollmentCapturedById")
WHERE "id" = @id;

-- name: MarquerProspectPerdu :execrows
UPDATE "prospects" SET "statut" = 'PERDU' WHERE "id" = @id AND "statut" <> 'PERDU';

-- name: CloreProspectParTentative :exec
UPDATE "prospects" SET
  "phase2Status" = CAST(@phase2_status AS text)::"Phase2Status",
  "enrollmentMethod" = COALESCE(CAST(sqlc.narg('method') AS text)::"EnrollmentMethod", "enrollmentMethod"),
  "enrollmentCapturedAt" = COALESCE(@at, "enrollmentCapturedAt"),
  "enrollmentCapturedById" = COALESCE(@by, "enrollmentCapturedById"), "rev" = "rev" + 1
WHERE "id" = @id;

-- name: ListerRappels :many
SELECT c."id", c."prospectId", c."scheduledAt", c."comment", c."assignedToId",
       p."phoneE164", p."prenom", p."nom", p."projet",
       cr."label" AS "reasonLabel",
       u."fullName" AS "assignedToName"
FROM "scheduled_callbacks" c
JOIN "prospects" p ON p."id" = c."prospectId"
JOIN "users" u ON u."id" = c."assignedToId"
-- Le statut promis vient de l'appel qui l'a promis : « RV téléphonique » se lit ici.
LEFT JOIN "call_attempts" a ON a."id" = c."sourceAttemptId"
LEFT JOIN "call_outcome_reasons" cr ON cr."id" = a."reasonId"
WHERE c."status" = 'PENDING'
  AND (sqlc.narg('avant')::timestamp IS NULL
       OR c."scheduledAt" <= sqlc.narg('avant')::timestamp)
  AND (CAST(sqlc.narg('assigned_to_id') AS text) IS NULL
       OR c."assignedToId" = CAST(sqlc.narg('assigned_to_id') AS text))
  AND (CAST(sqlc.narg('projet') AS text) IS NULL
       OR EXISTS (SELECT 1 FROM "prospect_journeys" j
                  WHERE j."prospectId" = p."id"
                    AND j."projet"::text = CAST(sqlc.narg('projet') AS text)))
ORDER BY c."scheduledAt" ASC, c."id" ASC
LIMIT sqlc.arg('page_size')
OFFSET sqlc.arg('page_offset');

-- La liste s'arrête à 500 rappels : le total dit ce qu'elle ne montre pas.
-- name: CompterRappels :one
SELECT COUNT(*)::int
FROM "scheduled_callbacks" c
JOIN "prospects" p ON p."id" = c."prospectId"
WHERE c."status" = 'PENDING'
  AND (sqlc.narg('avant')::timestamp IS NULL
       OR c."scheduledAt" <= sqlc.narg('avant')::timestamp)
  AND (CAST(sqlc.narg('assigned_to_id') AS text) IS NULL
       OR c."assignedToId" = CAST(sqlc.narg('assigned_to_id') AS text))
  AND (CAST(sqlc.narg('projet') AS text) IS NULL
       OR EXISTS (SELECT 1 FROM "prospect_journeys" j
                  WHERE j."prospectId" = p."id"
                    AND j."projet"::text = CAST(sqlc.narg('projet') AS text)));

-- name: RappelParId :one
SELECT c."id", c."prospectId", c."scheduledAt", c."comment", c."assignedToId",
       c."status", p."phoneE164", p."prenom", p."nom", p."projet",
       u."fullName" AS "assignedToName"
FROM "scheduled_callbacks" c
JOIN "prospects" p ON p."id" = c."prospectId"
JOIN "users" u ON u."id" = c."assignedToId"
WHERE c."id" = $1;

-- name: AnnulerRappel :exec
UPDATE "scheduled_callbacks" SET "status" = 'CANCELLED'
WHERE "id" = $1 AND "status" = 'PENDING';

-- name: ReporterRappel :exec
UPDATE "scheduled_callbacks" SET "scheduledAt" = @scheduled_at
WHERE "id" = @id AND "status" = 'PENDING';

-- name: ListerOuvertures :many
SELECT o."id", o."openedById", u."fullName" AS "openedByName",
       o."representantId", o."prospectId",
       COALESCE(r."fullName", btrim(p."prenom" || ' ' || p."nom"), '') AS "ficheNom",
       o."openedAt", o."firstInputAt", o."closedAt", o."closingAttemptId", o."draft",
       lu."fullName" AS "releasedByName", o."releasedAt"
FROM "ouvertures_fiche" o
JOIN "users" u ON u."id" = o."openedById"
LEFT JOIN "users" lu ON lu."id" = o."releasedById"
LEFT JOIN "representants" r ON r."id" = o."representantId"
LEFT JOIN "prospects" p ON p."id" = o."prospectId"
WHERE (CAST(sqlc.narg('id') AS text) IS NULL OR o."id" = CAST(sqlc.narg('id') AS text))
  AND (CAST(sqlc.narg('opened_by_id') AS text) IS NULL
       OR o."openedById" = CAST(sqlc.narg('opened_by_id') AS text))
  AND (NOT @ouvertes_seulement::bool OR o."closedAt" IS NULL)
  AND (sqlc.narg('cible')::text IS NULL
       OR (sqlc.narg('cible')::text = 'prospect') = (o."prospectId" IS NOT NULL))
ORDER BY o."openedAt" ASC, o."id" ASC;

-- name: CreerOuverture :exec
INSERT INTO "ouvertures_fiche"
  ("id", "openedById", "representantId", "prospectId", "openedAt", "draft")
VALUES (@id, @opened_by_id, @representant_id, @prospect_id, @opened_at, @draft);

-- name: BrouillonPrecedent :one
SELECT "draft" FROM "ouvertures_fiche"
WHERE "openedById" = @opened_by_id AND "closedAt" IS NOT NULL
  AND "representantId" IS NOT DISTINCT FROM CAST(sqlc.narg('representant_id') AS text)
  AND "prospectId" IS NOT DISTINCT FROM CAST(sqlc.narg('prospect_id') AS text)
ORDER BY "openedAt" DESC, "id" DESC LIMIT 1;

-- name: EnregistrerBrouillon :execrows
UPDATE "ouvertures_fiche" SET "draft" = @draft
WHERE "id" = @id AND "openedById" = @opened_by_id AND "closedAt" IS NULL;

-- name: PoserPremiereSaisie :exec
UPDATE "ouvertures_fiche" SET "firstInputAt" = GREATEST(@at, "openedAt")
WHERE "id" = @id AND "openedById" = @opened_by_id
  AND "closedAt" IS NULL AND "firstInputAt" IS NULL;

-- name: OuvertureEtat :one
SELECT "openedById", "representantId", "prospectId", "closedAt"
FROM "ouvertures_fiche" WHERE "id" = $1;

-- name: FermerOuverture :exec
UPDATE "ouvertures_fiche" SET
  "closedAt" = GREATEST(@at, COALESCE("firstInputAt", "openedAt")),
  "closingAttemptId" = @attempt_id
WHERE "id" = @id AND "openedById" = @opened_by_id AND "closedAt" IS NULL;

-- name: FermerAutreOuverture :exec
UPDATE "ouvertures_fiche"
SET "closedAt" = GREATEST(@at, COALESCE("firstInputAt", "openedAt"))
WHERE "openedById" = @opened_by_id AND "closedAt" IS NULL
  AND ("representantId" IS DISTINCT FROM CAST(sqlc.narg('representant_id') AS text)
       OR "prospectId" IS DISTINCT FROM CAST(sqlc.narg('prospect_id') AS text));

-- name: ComptageOuvertures :many
SELECT o."openedById", u."fullName" AS "openedByName",
       to_char(date_trunc('day', o."openedAt"), 'YYYY-MM-DD') AS jour,
       COUNT(*)::int AS ouvertures,
       COUNT(*) FILTER (WHERE o."closingAttemptId" IS NOT NULL)::int AS qualifiees,
       COUNT(*) FILTER (WHERE o."releasedById" IS NOT NULL)::int AS liberees,
       COUNT(*) FILTER (
         WHERE o."closedAt" IS NOT NULL AND o."firstInputAt" IS NOT NULL
       )::int AS mesurees,
       COALESCE(AVG(EXTRACT(EPOCH FROM (o."closedAt" - o."firstInputAt")))::int, 0)::int AS "dureeMoyenneSecondes",
       COUNT(*) FILTER (WHERE deja."qualifiee")::int AS "ouverturesDejaQualifiees",
       COUNT(*) FILTER (WHERE deja."qualifiee" AND o."closingAttemptId" IS NOT NULL)::int AS requalifiees
FROM "ouvertures_fiche" o
JOIN "users" u ON u."id" = o."openedById"
CROSS JOIN LATERAL (
  SELECT EXISTS (
           SELECT 1 FROM "ouvertures_fiche" p
           WHERE p."prospectId" = o."prospectId" AND p."openedAt" < o."openedAt"
             AND p."closingAttemptId" IS NOT NULL)
         OR EXISTS (
           SELECT 1 FROM "ouvertures_fiche" p
           WHERE p."representantId" = o."representantId" AND p."openedAt" < o."openedAt"
             AND p."closingAttemptId" IS NOT NULL) AS "qualifiee"
) deja
WHERE (CAST(sqlc.narg('opened_by_id') AS text) IS NULL
       OR o."openedById" = CAST(sqlc.narg('opened_by_id') AS text))
  AND (CAST(sqlc.narg('depuis') AS timestamp) IS NULL
       OR o."openedAt" >= CAST(sqlc.narg('depuis') AS timestamp))
  AND (CAST(sqlc.narg('jusqua') AS timestamp) IS NULL
       OR o."openedAt" <= CAST(sqlc.narg('jusqua') AS timestamp))
GROUP BY 1, 2, 3
ORDER BY 3 DESC, 2 ASC;

-- name: ListerSuggestions :many
SELECT s."id", s."sourceRepresentantId", s."suggestedName", s."suggestedPhoneE164",
       s."note", s."status", s."suggestedById", u."fullName" AS "suggestedByName",
       s."resolvedRepresentantId", s."clientCreatedAt", s."createdAt",
       COUNT(*) OVER ()::int AS total
FROM "representant_suggestions" s
JOIN "users" u ON u."id" = s."suggestedById"
WHERE s."deletedAt" IS NULL
  AND (@tous::bool OR s."suggestedById" = @agent)
  AND (CAST(sqlc.narg('id') AS text) IS NULL OR s."id" = CAST(sqlc.narg('id') AS text))
  AND (CAST(sqlc.narg('statut') AS text) IS NULL
       OR s."status"::text = CAST(sqlc.narg('statut') AS text))
ORDER BY s."createdAt" DESC, s."id" DESC
LIMIT @lim OFFSET @decalage;

-- name: SuggestionCourante :one
SELECT "status" FROM "representant_suggestions"
WHERE "id" = @id AND "deletedAt" IS NULL AND (@tous::bool OR "suggestedById" = @agent);

-- name: BasculerSuggestion :execrows
UPDATE "representant_suggestions" SET "status" = CAST(@vers AS text)::"SuggestionStatus"
WHERE "id" = @id AND "deletedAt" IS NULL
  AND "status" = CAST(@depuis AS text)::"SuggestionStatus"
  AND (@tous::bool OR "suggestedById" = @agent);

-- name: BattementAgent :exec
INSERT INTO "agent_heartbeats" ("userId", "lastPullAt") VALUES (@user_id, @at)
ON CONFLICT ("userId") DO UPDATE SET "lastPullAt" = EXCLUDED."lastPullAt";

-- Recopiee telle quelle de heartbeat.service.ts:55 : l'ecart qui enjambe une
-- frontiere d'heure est porte en entier par la tranche du nouveau signal.
-- name: TrancheDActivite :exec
WITH signal AS (SELECT @at::timestamp AS "at"),
precedent AS (
  SELECT MAX("lastSeenAt") AS "lastSeenAt"
  FROM "agent_activity_slots" WHERE "userId" = @user_id
)
INSERT INTO "agent_activity_slots"
  ("userId", "slot", "firstSeenAt", "lastSeenAt", "activeSeconds")
SELECT
  @user_id,
  date_trunc('hour', s."at"),
  s."at",
  s."at",
  CASE
    WHEN p."lastSeenAt" < s."at"
      AND s."at" - p."lastSeenAt" <= interval '90 seconds'
    THEN EXTRACT(EPOCH FROM (s."at" - p."lastSeenAt"))::int
    ELSE 0
  END
FROM signal s CROSS JOIN precedent p
ON CONFLICT ("userId", "slot") DO UPDATE SET
  "activeSeconds" = "agent_activity_slots"."activeSeconds" +
    CASE
      WHEN EXCLUDED."lastSeenAt" > "agent_activity_slots"."lastSeenAt"
        AND EXCLUDED."lastSeenAt" - "agent_activity_slots"."lastSeenAt" <= interval '90 seconds'
      THEN EXTRACT(EPOCH FROM (
        EXCLUDED."lastSeenAt" - "agent_activity_slots"."lastSeenAt"
      ))::int
      ELSE 0
    END,
  "lastSeenAt" = GREATEST(
    "agent_activity_slots"."lastSeenAt",
    EXCLUDED."lastSeenAt"
  );

-- name: AnnuairePhase2 :many
SELECT p."id", p."phoneE164", p."phase2Status", p."enrollmentMethod", p."rev", p."updatedAt"
FROM "prospects" p
WHERE p."deletedAt" IS NULL
  AND p."phoneE164" IS NOT NULL
  AND (
    sqlc.arg('scope_all')::boolean
    OR (p."createdById" = sqlc.arg('scope_user_id')::text
        AND NOT EXISTS (
          SELECT 1 FROM "lot_export_items" lc
          WHERE lc."prospectId" = p."id" AND lc."assigneeId" IS NOT NULL
            AND lc."assigneeId" <> sqlc.arg('scope_user_id')::text
        ))
    OR (sqlc.arg('scope_converti')::boolean AND p."statut" IN ('CONVERTI', 'VENDU'))
    OR EXISTS (
      SELECT 1 FROM "lot_export_items" li
      JOIN "lots_export" l ON l."id" = li."lotId" AND l."pausedAt" IS NULL
      WHERE li."prospectId" = p."id" AND li."assigneeId" = sqlc.arg('scope_user_id')::text
    )
  )
  AND (
    sqlc.narg('depuis_at')::timestamp IS NULL
    OR p."updatedAt" > sqlc.narg('depuis_at')::timestamp
    OR (p."updatedAt" = sqlc.narg('depuis_at')::timestamp AND p."id" > sqlc.arg('depuis_id')::text)
  )
ORDER BY p."updatedAt" ASC, p."id" ASC
LIMIT sqlc.arg('taille')::int;

-- name: ProspectPourCourrielEnrolement :one
SELECT p."id", p."nom", p."prenom", p."phoneE164", p."email", p."projet"::text AS "projet",
       b."name" AS "banqueName", su."fullName" AS "suiviParName",
       p."enrollmentMethod"::text AS "methode", p."enrollmentCapturedAt",
       (SELECT a."rendezVousAt" FROM "call_attempts" a
         WHERE a."prospectId" = p."id" AND a."rendezVousAt" IS NOT NULL
         ORDER BY a."createdAt" DESC LIMIT 1) AS "rendezVousAt"
FROM "prospects" p
LEFT JOIN "banques" b ON b."id" = p."banqueId"
LEFT JOIN "users" su ON su."id" = COALESCE(p."lastCallById", p."createdById")
WHERE p."id" = $1;

-- Une fiche que personne ne suit encore (titulaire = compte d'import) va au
-- premier qui l'appelle ; entre téléconseillers, elle change de main seulement
-- quand le second joint la personne.
-- name: PrendreLaFiche :execrows
UPDATE "prospects" p SET "createdById" = @agent, "rev" = p."rev" + 1
WHERE p."id" = @id AND p."createdById" <> @agent
  AND (@joint::bool OR EXISTS (SELECT 1 FROM "users" u WHERE u."id" = p."createdById" AND u."role" = 'ADMIN'));

-- name: PrendreLeRepresentant :execrows
UPDATE "representants" r SET "createdById" = @agent, "rev" = r."rev" + 1
WHERE r."id" = @id AND r."createdById" <> @agent
  AND (@joint::bool OR EXISTS (SELECT 1 FROM "users" u WHERE u."id" = r."createdById" AND u."role" = 'ADMIN'));

-- name: TransfererRappels :exec
UPDATE "scheduled_callbacks" SET "assignedToId" = @vers
WHERE "prospectId" = @prospect_id AND "status" = 'PENDING';
