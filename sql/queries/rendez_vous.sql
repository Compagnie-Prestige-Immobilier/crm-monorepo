-- name: RendezVousObtenus :many
SELECT
  p."id",
  p."prenom",
  p."nom",
  p."phoneE164",
  r."label" AS "type",
  r."code" AS "typeCode",
  -- sqlc tient la colonne d'une jointure externe pour non nulle : un NULL scanné en date échouerait.
  COALESCE(to_char(rdv."quand", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '')::text AS "quand",
  p."lastCallAt",
  COALESCE(u."fullName", '') AS "prisPar",
  COALESCE(p."rendezVousIssue", '') AS "issue",
  COALESCE(vs."nom", '')::text AS "site",
  COALESCE(vs."prixUnitaireDefaut", 0)::bigint AS "sitePrix",
  COALESCE(pr."label", '')::text AS "pointRencontre",
  COALESCE(dernier."pointRencontreCommentaire", '')::text AS "pointRencontreCommentaire",
  count(*) OVER () AS "total"
FROM "prospects" p
JOIN "call_outcome_reasons" r ON r."id" = p."lastReasonId"
LEFT JOIN "users" u ON u."id" = p."lastCallById"
-- Un rappel annulé garde la date du rendez-vous ; un rappel supplanté ne la donne jamais.
LEFT JOIN LATERAL (
  SELECT sc."scheduledAt" AS "quand" FROM "scheduled_callbacks" sc
  WHERE sc."prospectId" = p."id" AND sc."status" <> 'SUPERSEDED'
  ORDER BY (sc."status" = 'PENDING') DESC, sc."createdAt" DESC LIMIT 1
) rdv ON true
LEFT JOIN LATERAL (
  SELECT a."siteId", a."pointRencontreId", a."pointRencontreCommentaire" FROM "call_attempts" a
  WHERE a."prospectId" = p."id" ORDER BY a."clientCreatedAt" DESC, a."id" DESC LIMIT 1
) dernier ON true
LEFT JOIN "ventes_sites" vs ON vs."id" = dernier."siteId"
LEFT JOIN "points_rencontre" pr ON pr."id" = dernier."pointRencontreId"
WHERE p."deletedAt" IS NULL
  AND p."phase2Status" = 'APPOINTMENT'
  -- Le comptoir ne reçoit pas les rendez-vous téléphoniques ; la fiche, elle, les montre.
  AND (r."code" <> 'RDV_TELEPHONIQUE' OR sqlc.narg('prospect_id')::text IS NOT NULL)
  AND (sqlc.narg('prospect_id')::text IS NULL OR p."id" = sqlc.narg('prospect_id')::text)
  AND (sqlc.narg('type_code')::text IS NULL OR r."code" = sqlc.narg('type_code')::text)
  AND (sqlc.narg('issue')::text IS NULL
       OR (sqlc.narg('issue')::text = 'SANS' AND p."rendezVousIssue" IS NULL)
       OR p."rendezVousIssue" = sqlc.narg('issue')::text)
  AND (sqlc.narg('du')::timestamp IS NULL OR rdv."quand" >= sqlc.narg('du')::timestamp)
  AND (sqlc.narg('au')::timestamp IS NULL OR rdv."quand" < sqlc.narg('au')::timestamp)
  AND (sqlc.narg('recherche')::text IS NULL
       OR p."nom" ILIKE '%' || sqlc.narg('recherche')::text || '%'
       OR p."prenom" ILIKE '%' || sqlc.narg('recherche')::text || '%'
       -- Une recherche sans chiffre laisserait un motif vide, qui prend tout.
       OR (regexp_replace(sqlc.narg('recherche')::text, '\D', '', 'g') <> ''
           AND p."phoneE164" LIKE '%' || regexp_replace(sqlc.narg('recherche')::text, '\D', '', 'g') || '%'))
ORDER BY rdv."quand" DESC NULLS LAST, p."id"
LIMIT @prendre::int OFFSET @sauter::int;
