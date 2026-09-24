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
  sq.label AS statut_qualification,
  cp.label AS canal_label,
  pf.label AS profession_label,
  pf."isTeaching" AS profession_is_teaching,
  ib.label AS income_band_label,
  ep.label AS employeur_label,
  pa.label AS pays_label,
  COALESCE((SELECT u2."fullName" FROM "ouvertures_fiche" o
   JOIN "users" u2 ON u2."id" = o."openedById"
   WHERE o."prospectId" = p."id" AND o."closedAt" IS NULL
     AND o."openedById" <> sqlc.arg('scope_user_id')::text
     AND o."openedAt" > (now() AT TIME ZONE 'UTC') - interval '2 hours'
   ORDER BY o."openedAt" DESC LIMIT 1), '')::text AS en_cours_par,
  ra."lastCallAt" AS representant_appele_at,
  ru."fullName" AS representant_appele_par
FROM "prospects" p
JOIN "users" o ON o."id" = p."createdById"
LEFT JOIN "banques" b ON b."id" = p."banqueId"
LEFT JOIN "syndicats" sy ON sy."id" = p."syndicatId"
LEFT JOIN "representants" r ON r."id" = p."representantId"
LEFT JOIN "departements" d ON d."id" = r."departementId"
LEFT JOIN "users" ec ON ec."id" = p."enrollmentCapturedById"
LEFT JOIN "users" rv ON rv."id" = p."revueById"
LEFT JOIN "users" lc ON lc."id" = p."lastCallById"
LEFT JOIN "call_outcome_reasons" sq ON sq."id" = p."lastReasonId"
LEFT JOIN "canaux_provenance" cp ON cp."id" = p."canalProvenanceId"
LEFT JOIN "professions" pf ON pf."id" = p."professionId"
LEFT JOIN "income_bands" ib ON ib."id" = p."incomeBandId"
LEFT JOIN "employeurs" ep ON ep."id" = p."employeurId"
LEFT JOIN "pays" pa ON pa."id" = p."paysResidenceId"
-- Le même numéro figure parfois dans les représentants, déjà appelés en
-- campagne : la fiche le dit, pour ne pas rappeler la même personne.
LEFT JOIN LATERAL (
  SELECT r2."lastCallAt", r2."lastCallById" FROM "representants" r2
  WHERE r2."phoneE164" = p."phoneE164" AND r2."deletedAt" IS NULL AND r2."lastCallAt" IS NOT NULL
  ORDER BY r2."lastCallAt" DESC LIMIT 1
) ra ON true
LEFT JOIN "users" ru ON ru."id" = ra."lastCallById"
WHERE p."deletedAt" IS NULL
  AND (sqlc.narg('id')::text IS NULL OR p."id" = sqlc.narg('id')::text)
  AND (
    sqlc.arg('scope_all')::boolean
    OR (p."createdById" = sqlc.arg('scope_user_id')::text
        AND NOT EXISTS (
          SELECT 1 FROM "lot_export_items" lc
          WHERE lc."prospectId" = p."id" AND lc."assigneeId" IS NOT NULL
            AND lc."assigneeId" <> sqlc.arg('scope_user_id')::text
        ))
    OR (sqlc.arg('scope_converti')::boolean AND p."statut" IN ('CONVERTI', 'VENDU'))
    OR (sqlc.arg('scope_rendez_vous')::boolean AND p."phase2Status" = 'APPOINTMENT')
    OR EXISTS (
      SELECT 1 FROM "lot_export_items" li
      JOIN "lots_export" l ON l."id" = li."lotId" AND l."pausedAt" IS NULL
      WHERE li."prospectId" = p."id" AND li."assigneeId" = sqlc.arg('scope_user_id')::text
    )
    -- Une fiche appelée reste visible après la pause ou le retrait du lot.
    OR EXISTS (
      SELECT 1 FROM "call_attempts" sa
      WHERE sa."prospectId" = p."id" AND sa."performedById" = sqlc.arg('scope_user_id')::text
    )
  )
  AND (
    NOT sqlc.arg('attribue')::boolean
    OR EXISTS (
      SELECT 1 FROM "lot_export_items" la
      WHERE la."prospectId" = p."id" AND la."assigneeId" = sqlc.arg('scope_user_id')::text
    )
  )
  AND (
    NOT sqlc.arg('reste_a_appeler')::boolean
    OR (p."statut" <> 'PERDU'
        AND (NOT EXISTS (SELECT 1 FROM "call_outcome_reasons" lr WHERE lr."id" = p."lastReasonId" AND NOT lr."countsAsReached")
             OR p."remiseATraiterAt" > p."lastCallAt") AND (
        -- Un rappel promis quitte cette file : il se tient depuis « Rappels ».
        NOT EXISTS (
          SELECT 1 FROM "scheduled_callbacks" sc
          WHERE sc."prospectId" = p."id" AND sc."assignedToId" = sqlc.arg('scope_user_id')::text AND sc."status" = 'PENDING'
        )
        -- Une reaffectation remet la fiche dans la file : la borne suit la date
        -- d'affectation, pas celle de creation du lot.
        AND NOT EXISTS (
          SELECT 1 FROM "call_attempts" ra
          WHERE ra."prospectId" = p."id" AND ra."performedById" = sqlc.arg('scope_user_id')::text
            AND ra."createdAt" >= COALESCE((
              SELECT max(GREATEST(rl."createdAt", COALESCE(rr."createdAt", '-infinity'::timestamp)))
              FROM "lot_export_items" rli
              JOIN "lots_export" rl ON rl."id" = rli."lotId" AND rl."pausedAt" IS NULL
              LEFT JOIN "lot_export_reaffectations" rr ON rr."lotId" = rli."lotId"
                AND rr."toAssigneeId" = rli."assigneeId" AND rli."position" = ANY (rr."positions")
              WHERE rli."prospectId" = p."id" AND rli."assigneeId" = sqlc.arg('scope_user_id')::text
            ), '-infinity'::timestamp)
            AND ra."createdAt" >= COALESCE(p."remiseATraiterAt", '-infinity'::timestamp)
        )
    ))
  )
  AND (sqlc.narg('commercial_id')::text IS NULL OR p."createdById" = sqlc.narg('commercial_id')::text)
  AND (sqlc.narg('type')::"ProspectType" IS NULL OR p."type" = sqlc.narg('type')::"ProspectType")
  AND (sqlc.narg('canal_provenance_id')::text IS NULL OR p."canalProvenanceId" = sqlc.narg('canal_provenance_id')::text)
  AND (sqlc.narg('representant_id')::text IS NULL OR p."representantId" = sqlc.narg('representant_id')::text)
  AND (sqlc.narg('banque_id')::text IS NULL OR p."banqueId" = sqlc.narg('banque_id')::text)
  AND (sqlc.narg('syndicat_id')::text IS NULL OR p."syndicatId" = sqlc.narg('syndicat_id')::text)
  AND (sqlc.narg('origin')::text IS NULL OR p."origin" = sqlc.narg('origin')::text)
  AND (
    (NOT sqlc.arg('phase2_status_tout')::boolean
     AND (sqlc.narg('phase2_status')::"Phase2Status" IS NULL OR p."phase2Status" = sqlc.narg('phase2_status')::"Phase2Status"
          -- Un intéressé qui a donné sa méthode reste un intéressé, avec cette précision.
          OR (sqlc.narg('phase2_status')::"Phase2Status" = 'INTERESTED' AND p."phase2Status" = 'METHOD_OBTAINED'
              AND (SELECT mr."effect" FROM "call_attempts" ma JOIN "call_outcome_reasons" mr ON mr."id" = ma."reasonId"
                   WHERE ma."prospectId" = p."id" ORDER BY ma."clientCreatedAt" DESC, ma."id" DESC LIMIT 1) = 'CLOSE_INTERESTED')))
    -- « Tout » régroupe les onglets Intéressés, Hésitants et Rendez-vous.
    OR (sqlc.arg('phase2_status_tout')::boolean
        AND (p."phase2Status" = ANY (ARRAY['INTERESTED', 'HESITANT', 'APPOINTMENT']::"Phase2Status"[])
             OR (p."phase2Status" = 'METHOD_OBTAINED'
                 AND (SELECT mr."effect" FROM "call_attempts" ma JOIN "call_outcome_reasons" mr ON mr."id" = ma."reasonId"
                      WHERE ma."prospectId" = p."id" ORDER BY ma."clientCreatedAt" DESC, ma."id" DESC LIMIT 1) = 'CLOSE_INTERESTED')))
  )
  AND (sqlc.narg('sans_motif')::text IS NULL
       OR NOT EXISTS (SELECT 1 FROM "call_outcome_reasons" sm WHERE sm."id" = p."lastReasonId" AND sm."code" = sqlc.narg('sans_motif')::text))
  AND (sqlc.narg('motif')::text IS NULL
       OR p."lastReasonId" IN (SELECT m."id" FROM "call_outcome_reasons" m
                               LEFT JOIN "call_outcome_reasons" mp ON mp."id" = m."parentId"
                               WHERE sqlc.narg('motif')::text IN (m."code", mp."code")))
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
    OR (p."statut" IN ('CONVERTI', 'VENDU') AND (p."revueAt" IS NOT NULL) = sqlc.narg('revue')::boolean)
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
  CASE WHEN sqlc.arg('reste_a_appeler')::boolean THEN p."remiseATraiterAt" END DESC NULLS LAST,
  CASE WHEN sqlc.arg('sort_order')::text = 'asc' THEN CASE sqlc.arg('sort_by')::text
    WHEN 'nom' THEN p."nom" WHEN 'prenom' THEN p."prenom" WHEN 'statut' THEN p."statut"::text END END ASC,
  CASE WHEN sqlc.arg('sort_order')::text = 'desc' THEN CASE sqlc.arg('sort_by')::text
    WHEN 'nom' THEN p."nom" WHEN 'prenom' THEN p."prenom" WHEN 'statut' THEN p."statut"::text END END DESC,
  CASE WHEN sqlc.arg('sort_order')::text = 'asc' THEN CASE sqlc.arg('sort_by')::text
    WHEN 'createdAt' THEN p."createdAt" WHEN 'lastCallAt' THEN p."lastCallAt"
    ELSE p."clientCreatedAt" END END ASC,
  CASE WHEN sqlc.arg('sort_order')::text = 'desc' THEN CASE sqlc.arg('sort_by')::text
    WHEN 'createdAt' THEN p."createdAt" WHEN 'lastCallAt' THEN p."lastCallAt"
    ELSE p."clientCreatedAt" END END DESC,
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
    OR (p."createdById" = sqlc.arg('scope_user_id')::text
        AND NOT EXISTS (
          SELECT 1 FROM "lot_export_items" lc
          WHERE lc."prospectId" = p."id" AND lc."assigneeId" IS NOT NULL
            AND lc."assigneeId" <> sqlc.arg('scope_user_id')::text
        ))
    OR (sqlc.arg('scope_converti')::boolean AND p."statut" IN ('CONVERTI', 'VENDU'))
    OR (sqlc.arg('scope_rendez_vous')::boolean AND p."phase2Status" = 'APPOINTMENT')
    OR EXISTS (
      SELECT 1 FROM "lot_export_items" li
      JOIN "lots_export" l ON l."id" = li."lotId" AND l."pausedAt" IS NULL
      WHERE li."prospectId" = p."id" AND li."assigneeId" = sqlc.arg('scope_user_id')::text
    )
    -- Une fiche appelée reste visible après la pause ou le retrait du lot.
    OR EXISTS (
      SELECT 1 FROM "call_attempts" sa
      WHERE sa."prospectId" = p."id" AND sa."performedById" = sqlc.arg('scope_user_id')::text
    )
  )
  AND (
    NOT sqlc.arg('attribue')::boolean
    OR EXISTS (
      SELECT 1 FROM "lot_export_items" la
      WHERE la."prospectId" = p."id" AND la."assigneeId" = sqlc.arg('scope_user_id')::text
    )
  )
  AND (
    NOT sqlc.arg('reste_a_appeler')::boolean
    OR (p."statut" <> 'PERDU'
        AND (NOT EXISTS (SELECT 1 FROM "call_outcome_reasons" lr WHERE lr."id" = p."lastReasonId" AND NOT lr."countsAsReached")
             OR p."remiseATraiterAt" > p."lastCallAt") AND (
        -- Un rappel promis quitte cette file : il se tient depuis « Rappels ».
        NOT EXISTS (
          SELECT 1 FROM "scheduled_callbacks" sc
          WHERE sc."prospectId" = p."id" AND sc."assignedToId" = sqlc.arg('scope_user_id')::text AND sc."status" = 'PENDING'
        )
        -- Une reaffectation remet la fiche dans la file : la borne suit la date
        -- d'affectation, pas celle de creation du lot.
        AND NOT EXISTS (
          SELECT 1 FROM "call_attempts" ra
          WHERE ra."prospectId" = p."id" AND ra."performedById" = sqlc.arg('scope_user_id')::text
            AND ra."createdAt" >= COALESCE((
              SELECT max(GREATEST(rl."createdAt", COALESCE(rr."createdAt", '-infinity'::timestamp)))
              FROM "lot_export_items" rli
              JOIN "lots_export" rl ON rl."id" = rli."lotId" AND rl."pausedAt" IS NULL
              LEFT JOIN "lot_export_reaffectations" rr ON rr."lotId" = rli."lotId"
                AND rr."toAssigneeId" = rli."assigneeId" AND rli."position" = ANY (rr."positions")
              WHERE rli."prospectId" = p."id" AND rli."assigneeId" = sqlc.arg('scope_user_id')::text
            ), '-infinity'::timestamp)
            AND ra."createdAt" >= COALESCE(p."remiseATraiterAt", '-infinity'::timestamp)
        )
    ))
  )
  AND (sqlc.narg('commercial_id')::text IS NULL OR p."createdById" = sqlc.narg('commercial_id')::text)
  AND (sqlc.narg('type')::"ProspectType" IS NULL OR p."type" = sqlc.narg('type')::"ProspectType")
  AND (sqlc.narg('canal_provenance_id')::text IS NULL OR p."canalProvenanceId" = sqlc.narg('canal_provenance_id')::text)
  AND (sqlc.narg('representant_id')::text IS NULL OR p."representantId" = sqlc.narg('representant_id')::text)
  AND (sqlc.narg('banque_id')::text IS NULL OR p."banqueId" = sqlc.narg('banque_id')::text)
  AND (sqlc.narg('syndicat_id')::text IS NULL OR p."syndicatId" = sqlc.narg('syndicat_id')::text)
  AND (sqlc.narg('origin')::text IS NULL OR p."origin" = sqlc.narg('origin')::text)
  AND (
    (NOT sqlc.arg('phase2_status_tout')::boolean
     AND (sqlc.narg('phase2_status')::"Phase2Status" IS NULL OR p."phase2Status" = sqlc.narg('phase2_status')::"Phase2Status"
          -- Un intéressé qui a donné sa méthode reste un intéressé, avec cette précision.
          OR (sqlc.narg('phase2_status')::"Phase2Status" = 'INTERESTED' AND p."phase2Status" = 'METHOD_OBTAINED'
              AND (SELECT mr."effect" FROM "call_attempts" ma JOIN "call_outcome_reasons" mr ON mr."id" = ma."reasonId"
                   WHERE ma."prospectId" = p."id" ORDER BY ma."clientCreatedAt" DESC, ma."id" DESC LIMIT 1) = 'CLOSE_INTERESTED')))
    -- « Tout » régroupe les onglets Intéressés, Hésitants et Rendez-vous.
    OR (sqlc.arg('phase2_status_tout')::boolean
        AND (p."phase2Status" = ANY (ARRAY['INTERESTED', 'HESITANT', 'APPOINTMENT']::"Phase2Status"[])
             OR (p."phase2Status" = 'METHOD_OBTAINED'
                 AND (SELECT mr."effect" FROM "call_attempts" ma JOIN "call_outcome_reasons" mr ON mr."id" = ma."reasonId"
                      WHERE ma."prospectId" = p."id" ORDER BY ma."clientCreatedAt" DESC, ma."id" DESC LIMIT 1) = 'CLOSE_INTERESTED')))
  )
  AND (sqlc.narg('sans_motif')::text IS NULL
       OR NOT EXISTS (SELECT 1 FROM "call_outcome_reasons" sm WHERE sm."id" = p."lastReasonId" AND sm."code" = sqlc.narg('sans_motif')::text))
  AND (sqlc.narg('motif')::text IS NULL
       OR p."lastReasonId" IN (SELECT m."id" FROM "call_outcome_reasons" m
                               LEFT JOIN "call_outcome_reasons" mp ON mp."id" = m."parentId"
                               WHERE sqlc.narg('motif')::text IN (m."code", mp."code")))
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
    OR (p."statut" IN ('CONVERTI', 'VENDU') AND (p."revueAt" IS NOT NULL) = sqlc.narg('revue')::boolean)
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
       "champsLibres", "projet"
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
  "champsLibres", "typeBien"
) VALUES (
  $1, $2, $3, $4, $5, $6, now(),
  $7, $8, $9, $10, $11, $12, $13,
  $14, $15, $16, $17, $18,
  $19, $20, $21, $22, $23,
  $24, $25, $26, $27, $28,
  $29, $30, $31, $32, $33, $34,
  $35, $36
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

-- Une vente validée vaut conversion : toute fiche vivante devient vendue. Le
-- `statut <> 'VENDU'` protège la transition, un double dépôt ne fait rien.
-- name: MarquerProspectVendu :execrows
UPDATE "prospects" SET "statut" = 'VENDU', "rev" = "rev" + 1
WHERE "id" = $1 AND "statut" <> 'VENDU' AND "deletedAt" IS NULL;

-- name: MarquerParcoursVendu :exec
UPDATE "prospect_journeys" j SET "statut" = 'VENDU', "convertedAt" = COALESCE(j."convertedAt", now())
FROM "prospects" p
WHERE j."prospectId" = p."id" AND p."id" = $1 AND j."projet" = p."projet";

-- Les clients d'un téléconseiller : ses contacts vendus, avec la vente
-- rapprochée par téléphone.
-- name: ClientsDuTeleconseiller :many
SELECT p."id", p."prenom", p."nom", p."phoneE164", p."projet", p."lastCallAt",
       (v."id" IS NOT NULL)::bool AS "vente", COALESCE(v."site", '')::text AS "site", v."dateSouscription",
       COALESCE(v."nombreLots", 0)::int AS "nombreLots", COALESCE(v."numerosLots", '')::text AS "numerosLots",
       COALESCE(v."prixTotal", 0)::bigint AS "prixTotal", COALESCE(v."reliquat", 0)::bigint AS "reliquat",
       COALESCE(v."canal", '')::text AS "canal"
FROM "prospects" p
LEFT JOIN LATERAL (
  SELECT v.* FROM "ventes" v
  WHERE v."archiveeLe" IS NULL AND regexp_replace(v."telephone", '\D', '', 'g') <> ''
    AND p."phoneE164" LIKE '%' || regexp_replace(v."telephone", '\D', '', 'g')
  ORDER BY v."dateSouscription" DESC NULLS LAST, v."id" DESC LIMIT 1
) v ON true
WHERE p."deletedAt" IS NULL AND p."statut" = 'VENDU'
  AND EXISTS (SELECT 1 FROM "call_attempts" ca WHERE ca."prospectId" = p."id" AND ca."performedById" = @appele_par::text)
  AND (sqlc.narg('projet')::"Projet" IS NULL OR p."projet" = sqlc.narg('projet'))
ORDER BY v."dateSouscription" DESC NULLS LAST, p."lastCallAt" DESC
LIMIT 200;

-- name: ProspectsVivantsParTelephones :many
SELECT p."id", p."phoneE164", p."statut", u."fullName" AS "teleconseiller",
       parrain."nom" AS "parrainNom", parrain."prenom" AS "parrainPrenom"
FROM "prospects" p
LEFT JOIN "users" u ON u."id" = p."lastCallById"
LEFT JOIN "prospect_suggestions" ps ON ps."resolvedProspectId" = p."id" AND ps."deletedAt" IS NULL
LEFT JOIN "prospects" parrain ON parrain."id" = ps."sourceProspectId" AND parrain."deletedAt" IS NULL
WHERE p."phoneE164" = ANY(sqlc.arg('telephones')::text[]) AND p."deletedAt" IS NULL;

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

-- Le parcours de « Mes contacts » : tout ce que ce téléconseiller a appelé,
-- de l'appel à la vente.
-- name: PipelineDesContacts :one
SELECT COUNT(*)::int AS appelees,
       COUNT(*) FILTER (WHERE cr."countsAsReached")::int AS joignables,
       COUNT(*) FILTER (WHERE p."phase2Status" IN ('INTERESTED', 'HESITANT', 'APPOINTMENT'))::int AS interessees,
       COUNT(*) FILTER (WHERE p."phase2Status" = 'METHOD_OBTAINED')::int AS methodes,
       COUNT(*) FILTER (WHERE p."statut" = 'CONVERTI')::int AS converties,
       COUNT(*) FILTER (WHERE p."statut" = 'VENDU')::int AS vendues
FROM "prospects" p
LEFT JOIN "call_outcome_reasons" cr ON cr."id" = p."lastReasonId"
WHERE p."deletedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "call_attempts" ca WHERE ca."prospectId" = p."id" AND ca."performedById" = @appele_par::text)
  AND (sqlc.narg('projet')::"Projet" IS NULL OR p."projet" = sqlc.narg('projet'));

-- Une fiche confiée par « Affecter à » passe en tête du reste à appeler.
-- name: PrioriserProspect :exec
UPDATE "prospects" SET "remiseATraiterAt" = now() WHERE "id" = $1;

-- name: ReaffecterProspects :exec
UPDATE "prospects" SET
  "representantId" = COALESCE(sqlc.narg('representant_id')::text, "representantId"),
  "createdById" = COALESCE(sqlc.narg('commercial_id')::text, "createdById"),
  "rev" = "rev" + 1
WHERE "id" = ANY(sqlc.arg('ids')::text[]);

-- name: DernieresTentatives :many
SELECT
  p."id" AS prospect_id,
  a."comment",
  a."createdAt" AS at,
  a."reason_label",
  a."counts_as_reached",
  (SELECT count(*) FROM "call_attempts" n WHERE n."prospectId" = p."id")::int AS nombre
FROM "prospects" p
JOIN LATERAL (
  SELECT ca."comment", ca."createdAt", cr."label" AS reason_label, cr."countsAsReached" AS counts_as_reached
  FROM "call_attempts" ca
  JOIN "call_outcome_reasons" cr ON cr."id" = ca."reasonId"
  WHERE ca."prospectId" = p."id"
  ORDER BY ca."createdAt" DESC, ca."id" DESC
  LIMIT 1
) a ON TRUE
WHERE p."id" = ANY(sqlc.arg('ids')::text[]);

-- name: TentativesDuProspect :many
SELECT
  a."id", a."method", a."comment", a."email", a."fonctionnaire",
  a."engagementEnCours", a."dureeEtablissementMois", a."rendezVousAt", a."deviceCallType",
  a."deviceCallDurationSeconds", a."deviceCallAt", a."performedById", a."clientCreatedAt",
  u."fullName" AS performed_by_name,
  cr."label" AS reason_label,
  cr."countsAsReached" AS counts_as_reached,
  ou."firstInputAt" AS ouverture_first_input_at,
  ou."closedAt" AS ouverture_closed_at
FROM "call_attempts" a
JOIN "users" u ON u."id" = a."performedById"
JOIN "call_outcome_reasons" cr ON cr."id" = a."reasonId"
LEFT JOIN "ouvertures_fiche" ou ON ou."closingAttemptId" = a."id" AND ou."firstInputAt" IS NOT NULL
WHERE a."prospectId" = $1
ORDER BY a."clientCreatedAt" DESC, a."id" DESC;

-- name: AppSettingParCle :one
SELECT "key", "value", "updatedAt" FROM "app_settings" WHERE "key" = $1;

-- name: AppSettingsParCles :many
SELECT "key", "value" FROM "app_settings" WHERE "key" = ANY(sqlc.arg('keys')::text[]);

-- Tout ce que le journal sait d'une fiche : ses propres lignes, et celles des
-- campagnes et rappels qui la nomment. « CPI GO » signe ce qu'une migration a fait.
-- name: JournalDeLaFiche :many
-- Le journal nomme le téléconseiller au lieu de son identifiant.
SELECT a."id", a."action", a."entity",
       (a."before" - 'teleconseillerId')::jsonb AS "before",
       CASE WHEN a."after" ? 'teleconseillerId'
         THEN (a."after" - 'teleconseillerId') || jsonb_build_object('teleconseiller', COALESCE(t."fullName", 'inconnu'))
         ELSE a."after" END::jsonb AS "after",
       a."at",
       COALESCE(u."fullName", 'CPI GO')::text AS auteur
FROM "audit_logs" a
LEFT JOIN "users" u ON u."id" = a."userId"
LEFT JOIN "users" t ON t."id" = a."after"->>'teleconseillerId'
WHERE (a."entity" = 'prospect' AND a."entityId" = @prospect_id::text)
   OR (a."entity" IN ('lot_export', 'scheduled_callback') AND a."after"->>'prospectId' = @prospect_id::text)
ORDER BY a."at" DESC, a."id" DESC
LIMIT 500;

-- name: SupprimerAppSetting :execrows
DELETE FROM "app_settings" WHERE "key" = $1;

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
SELECT "id" FROM "users"
WHERE "formulaireJeton" = $1 AND "isActive" AND "deletedAt" IS NULL;

-- name: JetonFormulaireDuCompte :one
SELECT "formulaireJeton" FROM "users" WHERE "id" = $1;

-- name: JetonFormulaireRegenere :one
UPDATE "users" SET "formulaireJeton" = replace(gen_random_uuid()::text, '-', '')
WHERE "id" = $1
RETURNING "formulaireJeton";

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

-- name: ListerRequalifications :many
SELECT a."id", a."before", a."after", a."at", u."fullName" AS changed_by_name
FROM "audit_logs" a
LEFT JOIN "users" u ON u."id" = a."userId"
WHERE a."entity" = 'prospect' AND a."entityId" = $1 AND a."action" = 'prospect.requalification'
ORDER BY a."at" DESC, a."id" DESC
LIMIT 50;

-- name: RequalifierJourney :execrows
UPDATE "prospect_journeys" SET
  "statut" = @statut::"ProspectStatut",
  "consent" = CASE WHEN @statut = 'NOUVEAU' THEN 'NON_DEMANDE' ELSE "consent" END,
  "phase2Status" = CASE WHEN @statut = 'NOUVEAU' THEN 'PENDING' ELSE "phase2Status" END,
  "enrollmentMethod" = CASE WHEN @statut = 'NOUVEAU' THEN NULL ELSE "enrollmentMethod" END,
  "closedAt" = NULL, "closedReason" = NULL, "closedById" = NULL, "updatedAt" = now()
WHERE "prospectId" = @prospect_id AND "projet" = @projet AND "statut" NOT IN ('CONVERTI', 'VENDU');

-- name: RequalifierProspect :exec
UPDATE "prospects" SET
  "statut" = @statut::"ProspectStatut",
  "phase2Status" = CASE WHEN @statut = 'NOUVEAU' THEN 'PENDING' ELSE "phase2Status" END,
  "enrollmentMethod" = CASE WHEN @statut = 'NOUVEAU' THEN NULL ELSE "enrollmentMethod" END,
  "remiseATraiterAt" = CASE WHEN @statut = 'NOUVEAU' THEN now() ELSE "remiseATraiterAt" END,
  "rev" = "rev" + 1, "updatedAt" = now()
WHERE "id" = @prospect_id AND "projet" = @projet AND "statut" NOT IN ('CONVERTI', 'VENDU');

-- Sans méthode, une fiche ne peut plus rester « méthode obtenue » : elle redevient jointe.
-- name: ModifierMethodeJourney :exec
UPDATE "prospect_journeys" SET
  "enrollmentMethod" = CAST(sqlc.narg('methode') AS text)::"EnrollmentMethod",
  "phase2Status" = CASE
    WHEN sqlc.narg('methode')::text IS NOT NULL THEN 'METHOD_OBTAINED'
    WHEN "phase2Status" = 'METHOD_OBTAINED' THEN 'REACHED'
    ELSE "phase2Status" END,
  "enrollmentCapturedAt" = CASE WHEN sqlc.narg('methode')::text IS NULL THEN NULL ELSE now() END,
  "enrollmentCapturedById" = CASE WHEN sqlc.narg('methode')::text IS NULL THEN NULL ELSE @par::text END,
  "updatedAt" = now()
WHERE "prospectId" = @prospect_id AND "projet" = @projet;

-- name: ModifierMethodeProspect :exec
UPDATE "prospects" SET
  "enrollmentMethod" = CAST(sqlc.narg('methode') AS text)::"EnrollmentMethod",
  "phase2Status" = CASE
    WHEN sqlc.narg('methode')::text IS NOT NULL THEN 'METHOD_OBTAINED'
    WHEN "phase2Status" = 'METHOD_OBTAINED' THEN 'REACHED'
    ELSE "phase2Status" END,
  "enrollmentCapturedAt" = CASE WHEN sqlc.narg('methode')::text IS NULL THEN NULL ELSE now() END,
  "enrollmentCapturedById" = CASE WHEN sqlc.narg('methode')::text IS NULL THEN NULL ELSE @par::text END,
  "rev" = "rev" + 1, "updatedAt" = now()
WHERE "id" = @prospect_id;

-- name: SuivreRendezVous :one
UPDATE "prospects" p SET
  "rendezVousIssue" = sqlc.arg('issue')::text,
  "rendezVousReporteAt" = sqlc.narg('reporte_at')::timestamp,
  "suiteRencontre" = sqlc.narg('suite')::text,
  "rev" = p."rev" + 1, "updatedAt" = now()
FROM "prospects" avant
WHERE p."id" = @id AND avant."id" = p."id" AND p."deletedAt" IS NULL AND p."phase2Status" = 'APPOINTMENT'
RETURNING avant."rendezVousIssue" AS issue_avant, avant."suiteRencontre" AS suite_avant;
