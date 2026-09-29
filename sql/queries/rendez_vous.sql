-- name: RendezVousObtenus :many
-- Un rappel annulé garde la date du rendez-vous ; un rappel supplanté ne la donne jamais. Un report la remplace.
WITH dates AS (
  SELECT p."id", COALESCE(p."rendezVousReporteAt", (
    SELECT sc."scheduledAt" FROM "scheduled_callbacks" sc
    WHERE sc."prospectId" = p."id" AND sc."status" <> 'SUPERSEDED'
    ORDER BY (sc."status" = 'PENDING') DESC, sc."createdAt" DESC LIMIT 1
  )) AS "quand"
  FROM "prospects" p
  WHERE p."deletedAt" IS NULL AND p."phase2Status" = 'APPOINTMENT'
), rdv AS (
  SELECT d."id", d."quand", public.rendez_vous_etape(d."quand", p."rendezVousConfirmation", p."rendezVousIssue",
    EXISTS (SELECT 1 FROM "rendez_vous_closings" c WHERE c."prospectId" = d."id"), @debut_jour::timestamp)::text AS "etape"
  FROM dates d JOIN "prospects" p ON p."id" = d."id"
)
SELECT
  p."id",
  p."prenom",
  p."nom",
  p."phoneE164",
  (r."label" || COALESCE(' · ' || CASE dernier."rvExterneType"
    WHEN 'PERSONNE' THEN 'Personne'
    WHEN 'COOPERATIVE' THEN 'Coopérative'
    WHEN 'ENTREPRISE' THEN 'Entreprise'
    WHEN 'VISITE_BIEN' THEN 'Visite bien'
    WHEN 'AUTRE' THEN 'Autres : ' || dernier."rvExternePrecision"
  END, ''))::text AS "type",
  r."code" AS "typeCode",
  -- sqlc tient la colonne d'une jointure externe pour non nulle : un NULL scanné en date échouerait.
  COALESCE(to_char(rdv."quand", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '')::text AS "quand",
  p."lastCallAt",
  COALESCE(u."fullName", '') AS "prisPar",
  COALESCE(p."rendezVousIssue", '') AS "issue",
  COALESCE(p."rendezVousConfirmation", '') AS "confirmation",
  (p."rendezVousReporteAt" IS NOT NULL)::boolean AS "reporte",
  rdv."etape",
  COALESCE(vs."nom", '')::text AS "site",
  COALESCE(vs."prixUnitaireDefaut", 0)::bigint AS "sitePrix",
  COALESCE(pr."label", '')::text AS "pointRencontre",
  COALESCE(dernier."pointRencontreCommentaire", '')::text AS "pointRencontreCommentaire",
  COALESCE(p."rendezVousRecontacterNote", '')::text AS "recontacterNote",
  COALESCE(to_char(p."rendezVousRecontacterLe", 'YYYY-MM-DD'), '')::text AS "recontacterLe",
  COALESCE(to_char(p."rendezVousRecontacterAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '')::text AS "recontacterAt",
  COALESCE(rp."fullName", '')::text AS "recontacterPar",
  count(*) OVER () AS "total"
FROM "prospects" p
JOIN "call_outcome_reasons" r ON r."id" = p."lastReasonId"
JOIN rdv ON rdv."id" = p."id"
LEFT JOIN "users" u ON u."id" = p."lastCallById"
LEFT JOIN "users" rp ON rp."id" = p."rendezVousRecontacterPar"
LEFT JOIN LATERAL (
  SELECT a."siteId", a."pointRencontreId", a."pointRencontreCommentaire", a."rvExterneType", a."rvExternePrecision"
  FROM "call_attempts" a
  WHERE a."prospectId" = p."id" ORDER BY a."clientCreatedAt" DESC, a."id" DESC LIMIT 1
) dernier ON true
LEFT JOIN "ventes_sites" vs ON vs."id" = dernier."siteId"
LEFT JOIN "points_rencontre" pr ON pr."id" = dernier."pointRencontreId"
-- Le comptoir ne reçoit pas les rendez-vous téléphoniques ; la fiche, elle, les montre.
WHERE (r."code" <> 'RDV_TELEPHONIQUE' OR sqlc.narg('prospect_id')::text IS NOT NULL)
  AND (sqlc.narg('prospect_id')::text IS NULL OR p."id" = sqlc.narg('prospect_id')::text)
  AND (sqlc.narg('type_code')::text IS NULL OR r."code" = sqlc.narg('type_code')::text)
  AND (sqlc.narg('etape')::text IS NULL OR rdv."etape" = sqlc.narg('etape')::text
       OR (sqlc.narg('etape')::text = 'A_TRAITER' AND rdv."etape" <> 'HISTORIQUE'))
  -- L'agenda ne garde pas le créneau d'un rendez-vous à recontacter.
  AND (sqlc.narg('du')::timestamp IS NULL OR (rdv."quand" >= sqlc.narg('du')::timestamp AND rdv."etape" <> 'A_RECONTACTER'))
  AND (sqlc.narg('au')::timestamp IS NULL OR rdv."quand" < sqlc.narg('au')::timestamp)
  AND (sqlc.narg('recherche')::text IS NULL
       OR public.immutable_unaccent(lower(p."nom") || ' ' || lower(p."prenom"))
          LIKE '%' || public.immutable_unaccent(lower(sqlc.narg('recherche')::text)) || '%'
       OR public.immutable_unaccent(lower(p."prenom") || ' ' || lower(p."nom"))
          LIKE '%' || public.immutable_unaccent(lower(sqlc.narg('recherche')::text)) || '%'
       -- Une recherche sans chiffre laisserait un motif vide, qui prend tout.
       OR (regexp_replace(sqlc.narg('recherche')::text, '\D', '', 'g') <> ''
           AND p."phoneE164" LIKE '%' || regexp_replace(sqlc.narg('recherche')::text, '\D', '', 'g') || '%'))
-- Le travail se lit du plus ancien au plus lointain ; l'historique, du plus récent au plus ancien.
ORDER BY CASE WHEN rdv."etape" <> 'HISTORIQUE' THEN rdv."quand" END ASC NULLS LAST,
  rdv."quand" DESC NULLS LAST, p."id"
LIMIT @prendre::int OFFSET @sauter::int;

-- name: RendezVousParEtape :many
SELECT public.rendez_vous_etape(
    COALESCE(p."rendezVousReporteAt", (
      SELECT sc."scheduledAt" FROM "scheduled_callbacks" sc
      WHERE sc."prospectId" = p."id" AND sc."status" <> 'SUPERSEDED'
      ORDER BY (sc."status" = 'PENDING') DESC, sc."createdAt" DESC LIMIT 1
    )),
    p."rendezVousConfirmation", p."rendezVousIssue",
    EXISTS (SELECT 1 FROM "rendez_vous_closings" c WHERE c."prospectId" = p."id"), @debut_jour::timestamp
  )::text AS "etape",
  count(*)::bigint AS "nombre"
FROM "prospects" p
JOIN "call_outcome_reasons" r ON r."id" = p."lastReasonId"
WHERE p."deletedAt" IS NULL
  AND p."phase2Status" = 'APPOINTMENT'
  AND r."code" <> 'RDV_TELEPHONIQUE'
  AND (sqlc.narg('type_code')::text IS NULL OR r."code" = sqlc.narg('type_code')::text)
GROUP BY 1;

-- name: LireClosing :one
SELECT * FROM "rendez_vous_closings" WHERE "prospectId" = @prospect_id;

-- name: EnregistrerClosing :one
INSERT INTO "rendez_vous_closings" AS c (
  "prospectId", "localite", "superficie", "natureJuridique", "etatSite", "position", "auNomDe",
  "pieceIdentiteVerifiee", "paiementAcompte", "origineFondsJustifiee", "freinPrincipal", "autresPromoteurs",
  "parrain", "chargeDeClientele", "prochaineAction", "dateRelance", "compteRendu", "auteurId",
  "titulaires", "personnePolitiquementExposee"
) VALUES (
  @prospect_id, @localite, @superficie, @nature_juridique, @etat_site, @position, @au_nom_de,
  @piece_identite_verifiee, @paiement_acompte, @origine_fonds_justifiee, @frein_principal, @autres_promoteurs,
  @parrain, @charge_de_clientele, @prochaine_action, @date_relance, @compte_rendu, @auteur_id,
  @titulaires, @personne_politiquement_exposee
)
ON CONFLICT ("prospectId") DO UPDATE SET
  "localite" = EXCLUDED."localite", "superficie" = EXCLUDED."superficie",
  "natureJuridique" = EXCLUDED."natureJuridique", "etatSite" = EXCLUDED."etatSite",
  "position" = EXCLUDED."position", "auNomDe" = EXCLUDED."auNomDe",
  "pieceIdentiteVerifiee" = EXCLUDED."pieceIdentiteVerifiee", "paiementAcompte" = EXCLUDED."paiementAcompte",
  "origineFondsJustifiee" = EXCLUDED."origineFondsJustifiee", "freinPrincipal" = EXCLUDED."freinPrincipal",
  "autresPromoteurs" = EXCLUDED."autresPromoteurs", "parrain" = EXCLUDED."parrain",
  "chargeDeClientele" = EXCLUDED."chargeDeClientele", "prochaineAction" = EXCLUDED."prochaineAction",
  "dateRelance" = EXCLUDED."dateRelance", "compteRendu" = EXCLUDED."compteRendu",
  "titulaires" = EXCLUDED."titulaires",
  "personnePolitiquementExposee" = EXCLUDED."personnePolitiquementExposee",
  "auteurId" = EXCLUDED."auteurId", "updatedAt" = CURRENT_TIMESTAMP
RETURNING *;

-- name: ChargesDeClientele :many
SELECT "fullName" FROM "users"
WHERE "role" <> 'ADMIN' AND "isActive" AND "deletedAt" IS NULL
ORDER BY "fullName"
LIMIT 200;
