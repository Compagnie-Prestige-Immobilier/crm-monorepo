-- name: RendezVousObtenus :many
-- Ce que le comptoir doit voir d'un rendez-vous, et rien de plus : qui vient,
-- comment le joindre, quel type, qui l'a pris, et où en est sa venue.
SELECT
  p."id",
  p."prenom",
  p."nom",
  p."phoneE164",
  r."label" AS "type",
  r."code" AS "typeCode",
  p."lastCallAt",
  COALESCE(u."fullName", '') AS "prisPar",
  COALESCE(p."rendezVousIssue", '') AS "issue",
  count(*) OVER () AS "total"
FROM "prospects" p
JOIN "call_outcome_reasons" r ON r."id" = p."lastReasonId"
LEFT JOIN "users" u ON u."id" = p."lastCallById"
WHERE p."deletedAt" IS NULL
  AND p."phase2Status" = 'APPOINTMENT'
  AND r."code" <> 'RDV_TELEPHONIQUE'
  AND (sqlc.narg('type_code')::text IS NULL OR r."code" = sqlc.narg('type_code')::text)
  AND (sqlc.narg('recherche')::text IS NULL
       OR p."nom" ILIKE '%' || sqlc.narg('recherche')::text || '%'
       OR p."prenom" ILIKE '%' || sqlc.narg('recherche')::text || '%'
       -- Une recherche sans chiffre laisserait un motif vide, qui prend tout.
       OR (regexp_replace(sqlc.narg('recherche')::text, '\D', '', 'g') <> ''
           AND p."phoneE164" LIKE '%' || regexp_replace(sqlc.narg('recherche')::text, '\D', '', 'g') || '%'))
ORDER BY p."lastCallAt" DESC NULLS LAST, p."id"
LIMIT @prendre::int OFFSET @sauter::int;
