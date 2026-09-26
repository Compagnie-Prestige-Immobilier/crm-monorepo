-- La période est bornée à 366 jours et chaque liste porte sa limite : un
-- tableau rendu au modèle puis à l'écran ne peut pas grandir sans borne.

-- name: AssistantQuestions :many
SELECT q."id", q."libelle", q."question", q."partagee", q."epinglee", q."createdAt",
       q."userId" = @user_id::text AS "miennes", u."fullName" AS "auteur"
FROM "assistant_questions" q
JOIN "users" u ON u."id" = q."userId"
WHERE q."userId" = @user_id::text OR q."partagee"
ORDER BY q."createdAt" DESC
LIMIT 100;

-- name: InsertAssistantQuestion :exec
INSERT INTO "assistant_questions" ("id", "userId", "libelle", "question", "partagee")
VALUES (@id, @user_id, @libelle, @question, @partagee);

-- name: DeleteAssistantQuestion :execrows
DELETE FROM "assistant_questions" WHERE "id" = @id AND "userId" = @user_id;

-- name: AssistantAppels :many
-- Un téléconseiller ne compte que ses appels : `teleconseiller` NULL les compte tous.
SELECT
  to_char(ca."clientCreatedAt", 'YYYY-MM-DD') AS jour,
  COUNT(*)::int AS appels,
  COUNT(*) FILTER (WHERE r."countsAsReached")::int AS joints,
  COUNT(DISTINCT ca."prospectId")::int AS fiches
FROM "call_attempts" ca
JOIN "call_outcome_reasons" r ON r."id" = ca."reasonId"
JOIN "prospects" p ON p."id" = ca."prospectId" AND p."deletedAt" IS NULL
WHERE ca."clientCreatedAt" >= @du::timestamp AND ca."clientCreatedAt" < @au::timestamp
  AND (sqlc.narg('teleconseiller')::text IS NULL OR ca."performedById" = sqlc.narg('teleconseiller'))
  AND (sqlc.narg('projet')::text IS NULL OR p."projet"::text = sqlc.narg('projet'))
GROUP BY jour
ORDER BY jour
LIMIT 400;

-- name: AssistantConversionsParCanal :many
SELECT
  COALESCE(c."label", 'Non renseignée') AS canal,
  COUNT(*)::int AS prospects,
  COUNT(*) FILTER (WHERE lr."countsAsReached")::int AS joints,
  COUNT(*) FILTER (WHERE p."statut" IN ('CONVERTI', 'VENDU'))::int AS convertis,
  COUNT(*) FILTER (WHERE p."statut" = 'PERDU')::int AS perdus
FROM "prospects" p
LEFT JOIN "canaux_provenance" c ON c."id" = p."canalProvenanceId"
LEFT JOIN "call_outcome_reasons" lr ON lr."id" = p."lastReasonId"
WHERE p."deletedAt" IS NULL
  AND p."createdAt" >= @du::timestamp AND p."createdAt" < @au::timestamp
  AND (sqlc.narg('teleconseiller')::text IS NULL OR p."createdById" = sqlc.narg('teleconseiller'))
  AND (sqlc.narg('projet')::text IS NULL OR p."projet"::text = sqlc.narg('projet'))
GROUP BY canal
ORDER BY prospects DESC
LIMIT 50;

-- name: AssistantPrevision :many
-- Par canal et projet : les fiches tranchées depuis `depuis` donnent le taux,
-- les fiches encore ouvertes reçoivent ce taux.
SELECT
  COALESCE(c."label", 'Non renseignée') AS canal,
  p."projet"::text AS projet,
  COUNT(*) FILTER (WHERE p."statut" IN ('CONVERTI', 'VENDU') AND p."createdAt" >= @depuis::timestamp)::int AS convertis,
  COUNT(*) FILTER (WHERE p."statut" = 'PERDU' AND p."createdAt" >= @depuis::timestamp)::int AS perdus,
  COUNT(*) FILTER (WHERE p."statut" IN ('NOUVEAU', 'CONTACTE'))::int AS ouverts
FROM "prospects" p
LEFT JOIN "canaux_provenance" c ON c."id" = p."canalProvenanceId"
WHERE p."deletedAt" IS NULL
  AND (sqlc.narg('teleconseiller')::text IS NULL OR p."createdById" = sqlc.narg('teleconseiller'))
  AND (sqlc.narg('projet')::text IS NULL OR p."projet"::text = sqlc.narg('projet'))
GROUP BY canal, p."projet"
ORDER BY ouverts DESC
LIMIT 50;

-- name: AssistantQuestionLisible :one
SELECT "question" FROM "assistant_questions"
WHERE "id" = @id AND ("userId" = @user_id OR "partagee");

-- name: EpinglerAssistantQuestion :execrows
UPDATE "assistant_questions" SET "epinglee" = @epinglee WHERE "id" = @id AND "userId" = @user_id;

-- name: CompterQuestionsEpinglees :one
SELECT count(*)::int FROM "assistant_questions" WHERE "userId" = @user_id AND "epinglee" AND "id" <> @sauf;

-- name: AssistantVentes :many
-- L'encaissé d'une vente est son acompte et ses versements, comme sur l'écran des ventes.
WITH lues AS (
  SELECT
    CASE @axe::text
      WHEN 'site' THEN v."site"
      WHEN 'teleconseiller' THEN COALESCE(NULLIF(btrim(v."nomTeleconseiller"), ''), 'Non renseigné')
      WHEN 'canal' THEN v."canal"
      WHEN 'jour' THEN to_char(v."dateSouscription", 'YYYY-MM-DD')
      ELSE 'Total'
    END AS groupe,
    v."nombreLots", v."prixTotal",
    v."acompte" + COALESCE((SELECT sum(vv."montant") FROM "ventes_versements" vv WHERE vv."venteId" = v."id"), 0) AS encaisse
  FROM "ventes" v
  WHERE v."archiveeLe" IS NULL
    AND v."dateSouscription" >= @du::timestamp AND v."dateSouscription" < @au::timestamp
)
SELECT groupe::text AS groupe, COUNT(*)::int AS ventes, COALESCE(SUM("nombreLots"), 0)::int AS lots,
       COALESCE(SUM("prixTotal"), 0)::bigint AS montant, COALESCE(SUM(encaisse), 0)::bigint AS encaisse
FROM lues
GROUP BY groupe
ORDER BY CASE WHEN @axe::text = 'jour' THEN groupe END, montant DESC, groupe
LIMIT 200;

-- name: AssistantDossiersBancaires :many
-- Même périmètre que le tableau de bord Banque & Finance : dossiers créés sur la période.
SELECT
  CASE WHEN @axe::text = 'banque' THEN COALESCE(b."shortName", 'Sans banque') ELSE s."label" END::text AS groupe,
  COUNT(*)::int AS dossiers,
  COUNT(*) FILTER (WHERE s."type" = 'CASHED')::int AS encaisses,
  COUNT(*) FILTER (WHERE s."type" = 'REJECTED')::int AS rejetes,
  COALESCE(SUM(c."amountXof") FILTER (WHERE s."type" = 'CASHED'), 0)::bigint AS montant_encaisse
FROM "bank_cases" c
JOIN "bank_case_stages" s ON s."id" = c."currentStageId"
LEFT JOIN "banques" b ON b."id" = c."processingBankId"
WHERE c."deletedAt" IS NULL
  AND c."createdAt" >= @du::timestamp AND c."createdAt" < @au::timestamp
  AND (sqlc.narg('projet')::text IS NULL
       OR EXISTS (SELECT 1 FROM "prospect_journeys" pj
                  WHERE pj."prospectId" = c."prospectId" AND pj."projet"::text = sqlc.narg('projet'))
       OR EXISTS (SELECT 1 FROM "inscriptions_plateforme" ip
                  WHERE ip."id" = c."inscriptionId" AND ip."projet"::text = sqlc.narg('projet')))
GROUP BY 1
ORDER BY CASE WHEN @axe::text = 'banque' THEN 0 ELSE MIN(s."position") END, dossiers DESC, 1
LIMIT 100;

-- name: AssistantVisites :many
SELECT
  CASE WHEN @axe::text = 'objet' THEN COALESCE(o."label", 'Sans objet') ELSE to_char(v."visitedAt", 'YYYY-MM-DD') END::text AS groupe,
  COUNT(*)::int AS visites
FROM "visites" v
LEFT JOIN "visite_objets" o ON o."id" = v."objetId"
WHERE v."deletedAt" IS NULL AND v."visitedAt" >= @du::timestamp AND v."visitedAt" < @au::timestamp
GROUP BY 1
ORDER BY CASE WHEN @axe::text = 'objet' THEN NULL ELSE 1 END, visites DESC, 1
LIMIT 400;

-- name: AssistantRendezVous :many
-- La date d'un rendez-vous est celle de son rappel, comme sur l'écran des rendez-vous.
SELECT
  CASE WHEN @axe::text = 'jour' THEN to_char(rdv."quand", 'YYYY-MM-DD') ELSE r."label" END::text AS groupe,
  COUNT(*)::int AS obtenus,
  COUNT(*) FILTER (WHERE p."rendezVousIssue" = 'HONORE')::int AS honores,
  COUNT(*) FILTER (WHERE p."rendezVousIssue" = 'NON_HONORE')::int AS non_honores,
  COUNT(*) FILTER (WHERE p."rendezVousIssue" = 'REPORTE')::int AS reportes
FROM "prospects" p
JOIN "call_outcome_reasons" r ON r."id" = p."lastReasonId"
JOIN LATERAL (
  SELECT sc."scheduledAt" AS "quand" FROM "scheduled_callbacks" sc
  WHERE sc."prospectId" = p."id" AND sc."status" <> 'SUPERSEDED'
  ORDER BY (sc."status" = 'PENDING') DESC, sc."createdAt" DESC LIMIT 1
) rdv ON true
WHERE p."deletedAt" IS NULL AND p."phase2Status" = 'APPOINTMENT'
  AND rdv."quand" >= @du::timestamp AND rdv."quand" < @au::timestamp
  AND (sqlc.narg('teleconseiller')::text IS NULL OR p."lastCallById" = sqlc.narg('teleconseiller'))
  AND (sqlc.narg('projet')::text IS NULL OR p."projet"::text = sqlc.narg('projet'))
GROUP BY 1
ORDER BY CASE WHEN @axe::text = 'jour' THEN 1 END, obtenus DESC, 1
LIMIT 400;

-- name: AssistantAppelsRepresentants :many
-- Joint : tout statut autre qu'injoignable, comme la supervision.
SELECT
  CASE WHEN @axe::text = 'teleconseiller' THEN u."fullName" ELSE to_char(rca."clientCreatedAt", 'YYYY-MM-DD') END::text AS groupe,
  COUNT(*)::int AS appels,
  COUNT(*) FILTER (WHERE sq."effect" <> 'UNREACHABLE')::int AS joints,
  COUNT(DISTINCT rca."representantId")::int AS representants
FROM "rep_call_attempts" rca
JOIN "statuts_qualification" sq ON sq."id" = rca."statutQualificationId"
JOIN "users" u ON u."id" = rca."performedById"
WHERE rca."clientCreatedAt" >= @du::timestamp AND rca."clientCreatedAt" < @au::timestamp
  AND (sqlc.narg('teleconseiller')::text IS NULL OR rca."performedById" = sqlc.narg('teleconseiller'))
GROUP BY 1
ORDER BY CASE WHEN @axe::text = 'teleconseiller' THEN NULL ELSE 1 END, appels DESC, 1
LIMIT 400;

-- name: AssistantRappels :many
SELECT
  u."fullName"::text AS teleconseiller,
  COUNT(*)::int AS promis,
  COUNT(*) FILTER (WHERE sc."status" = 'DONE')::int AS honores,
  COUNT(*) FILTER (WHERE sc."status" = 'PENDING' AND sc."scheduledAt" < @maintenant::timestamp)::int AS en_retard,
  COUNT(*) FILTER (WHERE sc."status" = 'PENDING' AND sc."scheduledAt" >= @maintenant::timestamp)::int AS a_venir,
  COUNT(*) FILTER (WHERE sc."status" = 'CANCELLED')::int AS annules
FROM "scheduled_callbacks" sc
JOIN "users" u ON u."id" = sc."assignedToId"
JOIN "prospects" p ON p."id" = sc."prospectId" AND p."deletedAt" IS NULL
WHERE sc."status" <> 'SUPERSEDED'
  AND sc."scheduledAt" >= @du::timestamp AND sc."scheduledAt" < @au::timestamp
  AND (sqlc.narg('teleconseiller')::text IS NULL OR sc."assignedToId" = sqlc.narg('teleconseiller'))
  AND (sqlc.narg('projet')::text IS NULL OR p."projet"::text = sqlc.narg('projet'))
GROUP BY u."id", u."fullName"
ORDER BY en_retard DESC, promis DESC, 1
LIMIT 100;

-- name: AvancementCampagnes :many
-- Une fiche est traitée quand elle a reçu un appel depuis la création de la
-- campagne, comme dans le rendement des campagnes de la supervision.
SELECT
  l."id", l."name", COALESCE(l."projet"::text, '')::text AS projet, (l."pausedAt" IS NOT NULL)::boolean AS en_pause,
  COUNT(*)::int AS fiches,
  COUNT(*) FILTER (WHERE a."dernier" IS NOT NULL)::int AS traitees,
  COUNT(*) FILTER (WHERE a."dernier" >= @depuis::timestamp)::int AS appelees_depuis,
  COALESCE(to_char(MAX(a."dernier"), 'YYYY-MM-DD'), '')::text AS dernier_appel
FROM "lots_export" l
JOIN "lot_export_items" i ON i."lotId" = l."id" AND i."assigneeId" IS NOT NULL
LEFT JOIN LATERAL (
  SELECT MAX(t."clientCreatedAt") AS "dernier" FROM (
    SELECT r."clientCreatedAt" FROM "rep_call_attempts" r
    WHERE i."representantId" IS NOT NULL AND r."representantId" = i."representantId" AND r."clientCreatedAt" >= l."createdAt"
    UNION ALL
    SELECT c."clientCreatedAt" FROM "call_attempts" c
    WHERE i."representantId" IS NULL AND c."prospectId" = i."prospectId" AND c."clientCreatedAt" >= l."createdAt"
  ) t
) a ON true
WHERE l."createdAt" >= @du::timestamp AND l."createdAt" < @au::timestamp
  AND (sqlc.narg('teleconseiller')::text IS NULL OR i."assigneeId" = sqlc.narg('teleconseiller'))
  AND (sqlc.narg('projet')::text IS NULL OR l."projet"::text = sqlc.narg('projet'))
GROUP BY l."id", l."name", l."projet", l."pausedAt", l."createdAt"
ORDER BY l."createdAt" DESC, l."name"
LIMIT 100;

-- name: AssistantProchainRappel :one
SELECT "scheduledAt" FROM "scheduled_callbacks"
WHERE "prospectId" = @prospect_id AND "status" = 'PENDING'
ORDER BY "scheduledAt"
LIMIT 1;
