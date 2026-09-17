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
           AND (sqlc.narg('projet')::"Projet" IS NULL OR i."projet" = sqlc.narg('projet')::"Projet")
           AND i."disparueLe" IS NULL
       ))::int AS inscrits
FROM "prospects" p
WHERE (sqlc.narg('projet')::"Projet" IS NULL OR p."projet" = sqlc.narg('projet')::"Projet")
  AND p."deletedAt" IS NULL
  AND p."phase2Status" = 'METHOD_OBTAINED';

-- name: LotStatsRepresentants :one
SELECT COUNT(*)::int AS calls, COUNT(DISTINCT a."representantId")::int AS fiches
FROM "lot_export_items" i
INNER JOIN "rep_call_attempts" a ON a."representantId" = i."representantId"
WHERE i."lotId" = $1 AND a."clientCreatedAt" >= $2;

-- Les lignes rendues (fiche plateforme ou hors projet) n'ont plus de téléconseiller :
-- elles sortent du dénominateur de la campagne.
-- name: LotStatsProspects :one
SELECT COUNT(a."id")::int AS calls, COUNT(DISTINCT a."prospectId")::int AS fiches
FROM "lot_export_items" i
LEFT JOIN "call_attempts" a ON a."prospectId" = i."prospectId" AND a."clientCreatedAt" >= $2
WHERE i."lotId" = $1;

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

-- name: QualiteBaseRepresentants :one
-- La base est eprouvee des qu'un appel a eu lieu : avant cela une fiche ne dit
-- rien de sa valeur. « Joint » se lit sur l'effet du statut du referentiel,
-- « productif » sur les prospects que le representant a reellement apportes.
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE r."lastCallAt" IS NOT NULL)::int AS eprouves,
  COUNT(*) FILTER (
    WHERE sq."effect" IN ('REACHED', 'REFUSED', 'SCHEDULE_CALLBACK')
  )::int AS joints,
  COUNT(*) FILTER (WHERE apport.prospects > 0)::int AS productifs,
  COALESCE(SUM(apport.prospects), 0)::int AS prospects_apportes
FROM "representants" r
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS prospects
  FROM "prospects" p
  WHERE p."representantId" = r."id" AND p."deletedAt" IS NULL
) apport ON TRUE
WHERE r."deletedAt" IS NULL;

-- name: RepresentantsParStatut :many
SELECT
  COALESCE(sq."code", 'NON_QUALIFIE')::text AS code,
  COALESCE(sq."label", 'Non qualifié')::text AS label,
  COALESCE(sq."effect"::text, '')::text AS effect,
  COUNT(*)::int AS count
FROM "representants" r
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
WHERE r."deletedAt" IS NULL
GROUP BY 1, 2, 3, sq."sortOrder"
ORDER BY sq."sortOrder" NULLS FIRST;

-- name: QualiteParDepartement :many
SELECT
  d."id",
  d."name" AS label,
  COUNT(r."id")::int AS fiches,
  COUNT(r."id") FILTER (
    WHERE sq."effect" IN ('REACHED', 'REFUSED', 'SCHEDULE_CALLBACK')
  )::int AS joints,
  COALESCE(SUM(apport.prospects), 0)::int AS prospects
FROM "departements" d
JOIN "representants" r ON r."departementId" = d."id" AND r."deletedAt" IS NULL
LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS prospects
  FROM "prospects" p
  WHERE p."representantId" = r."id" AND p."deletedAt" IS NULL
) apport ON TRUE
GROUP BY d."id", d."name"
ORDER BY fiches DESC, label ASC;

-- name: ChampsRenseignesRepresentants :one
SELECT
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(r."prenom"), '') IS NOT NULL)::int AS prenom,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(r."etablissement"), '') IS NOT NULL)::int AS etablissement,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(r."profession"), '') IS NOT NULL)::int AS profession,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(r."syndicat"), '') IS NOT NULL)::int AS syndicat,
  COUNT(*) FILTER (WHERE r."iefId" IS NOT NULL)::int AS ief,
  COUNT(*) FILTER (WHERE r."whatsappStatus" <> 'NON_DEMANDE')::int AS whatsapp
FROM "representants" r
WHERE r."deletedAt" IS NULL;

-- name: QualiteMarketing :one
-- Ce que valent les prospects qu'un canal nous amene : ils repondent, et ils
-- se convertissent. « Joint » exclut les deux issues qui ferment sans reponse.
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE p."canalProvenanceId" IS NOT NULL)::int AS avec_canal,
  COUNT(*) FILTER (WHERE p."lastCallAt" IS NOT NULL)::int AS eprouves,
  COUNT(*) FILTER (
    WHERE p."lastCallOutcome" IN ('METHOD_OBTAINED', 'CALLBACK', 'REFUSED', 'OTHER')
  )::int AS joints,
  COUNT(*) FILTER (WHERE p."statut" = 'CONVERTI')::int AS convertis
FROM "prospects" p
WHERE p."deletedAt" IS NULL;

-- name: MarketingParCanal :many
SELECT
  c."id",
  c."code",
  c."label",
  COUNT(p."id")::int AS prospects,
  COUNT(p."id") FILTER (
    WHERE p."lastCallOutcome" IN ('METHOD_OBTAINED', 'CALLBACK', 'REFUSED', 'OTHER')
  )::int AS joints,
  COUNT(p."id") FILTER (WHERE p."statut" = 'CONVERTI')::int AS convertis
FROM "canaux_provenance" c
JOIN "prospects" p ON p."canalProvenanceId" = c."id" AND p."deletedAt" IS NULL
GROUP BY c."id", c."code", c."label", c."position"
ORDER BY prospects DESC, c."position";

-- name: ProspectsParMotifDAppel :many
-- Le motif que le teleconseiller a choisi au dernier appel, tel qu'il est
-- defini dans les listes de reference. Une fiche jamais appelee n'a pas de
-- motif : elle n'a pas encore ete eprouvee.
SELECT
  COALESCE(r."label", 'Jamais appelé')::text AS label,
  COALESCE(r."effect"::text, '')::text AS effect,
  COUNT(*)::int AS count
FROM "prospects" p
LEFT JOIN LATERAL (
  SELECT c."reasonId"
  FROM "call_attempts" c
  WHERE c."prospectId" = p."id"
  ORDER BY c."createdAt" DESC
  LIMIT 1
) dernier ON TRUE
LEFT JOIN "call_outcome_reasons" r ON r."id" = dernier."reasonId"
WHERE p."deletedAt" IS NULL
GROUP BY 1, 2, r."sortOrder"
ORDER BY count DESC;

-- name: LeadsImportesParImport :many
-- Ce qu'a donne chaque classeur de leads : le motif du dernier appel dit si la
-- fiche vaut d'etre suivie.
SELECT
  j."id",
  j."fileName" AS fichier,
  j."createdAt" AS importe_le,
  COUNT(p."id") FILTER (WHERE p."plateformeDepuis" IS NULL)::int AS importes,
  COUNT(p."id") FILTER (WHERE p."plateformeDepuis" IS NULL AND p."lastCallAt" IS NOT NULL)::int AS appeles,
  COUNT(p."id") FILTER (
    WHERE p."plateformeDepuis" IS NULL
      AND p."lastCallOutcome" IN ('METHOD_OBTAINED', 'CALLBACK', 'REFUSED', 'OTHER')
  )::int AS joints,
  COUNT(p."id") FILTER (WHERE p."plateformeDepuis" IS NULL AND r."code" = ANY(@motifs::text[]))::int AS interesses,
  -- Passées plateforme : suivies par les CCP, hors de ce tableau mais comptées pour qu'il boucle avec l'import.
  COUNT(p."id") FILTER (WHERE p."plateformeDepuis" IS NOT NULL)::int AS plateforme
FROM "import_jobs" j
JOIN "prospects" p ON p."importJobId" = j."id" AND p."deletedAt" IS NULL
LEFT JOIN LATERAL (
  SELECT c."reasonId"
  FROM "call_attempts" c
  WHERE c."prospectId" = p."id"
  ORDER BY c."createdAt" DESC
  LIMIT 1
) dernier ON TRUE
LEFT JOIN "call_outcome_reasons" r ON r."id" = dernier."reasonId"
GROUP BY j."id", j."fileName", j."createdAt"
ORDER BY j."createdAt" DESC;

-- Le tableau s'arrête à 500 lignes : le total dit ce qu'il ne montre pas.
-- name: LeadsImportesInteressesTotal :one
SELECT COUNT(*)::int
FROM "prospects" p
JOIN "import_jobs" j ON j."id" = p."importJobId" AND p."plateformeDepuis" IS NULL
JOIN LATERAL (
  SELECT c."reasonId"
  FROM "call_attempts" c
  WHERE c."prospectId" = p."id"
  ORDER BY c."createdAt" DESC
  LIMIT 1
) dernier ON TRUE
JOIN "call_outcome_reasons" r ON r."id" = dernier."reasonId" AND r."code" = ANY(@motifs::text[])
WHERE p."deletedAt" IS NULL;

-- name: LeadsImportesInteresses :many
SELECT
  p."id",
  p."nom",
  p."prenom",
  p."phoneE164",
  p."statut",
  j."fileName" AS fichier,
  p."importFeuille" AS feuille,
  dernier."createdAt" AS appele_le,
  u."fullName" AS appele_par,
  r."label" AS motif,
  dernier."comment" AS commentaire
FROM "prospects" p
JOIN "import_jobs" j ON j."id" = p."importJobId" AND p."plateformeDepuis" IS NULL
JOIN LATERAL (
  SELECT c."reasonId", c."createdAt", c."comment", c."performedById"
  FROM "call_attempts" c
  WHERE c."prospectId" = p."id"
  ORDER BY c."createdAt" DESC
  LIMIT 1
) dernier ON TRUE
JOIN "call_outcome_reasons" r ON r."id" = dernier."reasonId" AND r."code" = ANY(@motifs::text[])
JOIN "users" u ON u."id" = dernier."performedById"
WHERE p."deletedAt" IS NULL
ORDER BY dernier."createdAt" DESC
LIMIT 500;
