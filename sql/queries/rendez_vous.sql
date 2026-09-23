-- name: RendezVousObtenus :many
-- Ce que le comptoir doit voir d'un rendez-vous, et rien de plus : qui vient,
-- quand, comment le joindre, quel type, qui l'a pris, et où en est sa venue.
-- La date du rendez-vous est celle du rappel promis par l'appel qui l'a fermé.
SELECT
  p."id",
  p."prenom",
  p."nom",
  p."phoneE164",
  r."label" AS "type",
  r."code" AS "typeCode",
  -- Rendue en texte ISO : sqlc tient la colonne d'une jointure externe pour
  -- non nulle, et un scan de NULL dans une date échouerait à l'exécution.
  COALESCE(to_char(rdv."quand", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '')::text AS "quand",
  p."lastCallAt",
  COALESCE(u."fullName", '') AS "prisPar",
  COALESCE(p."rendezVousIssue", '') AS "issue",
  count(*) OVER () AS "total"
FROM "prospects" p
JOIN "call_outcome_reasons" r ON r."id" = p."lastReasonId"
LEFT JOIN "users" u ON u."id" = p."lastCallById"
-- Le dernier rappel promis porte la date du rendez-vous ; une fiche sans rappel
-- garde une date vide, et la jointure externe le dit au type rendu.
LEFT JOIN (
  SELECT "prospectId", MAX("scheduledAt") AS "quand"
  FROM "scheduled_callbacks" GROUP BY "prospectId"
) rdv ON rdv."prospectId" = p."id"
WHERE p."deletedAt" IS NULL
  AND p."phase2Status" = 'APPOINTMENT'
  AND r."code" <> 'RDV_TELEPHONIQUE'
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
