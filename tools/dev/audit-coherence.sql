-- Contrôles de cohérence sur une copie de la base : chaque ligne rendue est un
-- écart à expliquer. Sur une base saine, tous les compteurs valent 0.
--   psql -X -d <copie> -f tools/dev/audit-coherence.sql
\pset pager off
\timing off

WITH dernier AS (
  SELECT DISTINCT ON (a."prospectId") a."prospectId", a."reasonId", a."method", r."effect"
  FROM call_attempts a JOIN call_outcome_reasons r ON r."id" = a."reasonId"
  ORDER BY a."prospectId", a."clientCreatedAt" DESC, a."id" DESC
), attendu AS (
  SELECT d."prospectId", d."reasonId", CASE
      WHEN d."effect"::text = 'CLOSE_UNREACHABLE' THEN 'UNREACHABLE'
      WHEN d."effect"::text = 'CLOSE_INTERESTED' THEN 'INTERESTED'
      WHEN d."effect"::text = 'CLOSE_HESITANT' THEN 'HESITANT'
      WHEN d."effect"::text = 'CLOSE_APPOINTMENT' THEN 'APPOINTMENT'
      WHEN d."effect"::text = 'CLOSE_REACHED' THEN 'REACHED'
      WHEN d."effect"::text IN ('CLOSE_REFUSED', 'CLOSE_LOST') THEN 'REFUSED'
      WHEN d."effect"::text = 'CLOSE_WRONG_NUMBER' THEN 'WRONG_NUMBER'
      WHEN d."effect"::text = 'CLOSE_METHOD' THEN 'METHOD_OBTAINED'
      ELSE 'PENDING' END AS phase2
  FROM dernier d
)
SELECT * FROM (
  SELECT 'statuts : appel sur un motif éteint' AS controle,
         count(*) FROM call_attempts a JOIN call_outcome_reasons r ON r."id" = a."reasonId" WHERE NOT r."isActive"
  UNION ALL SELECT 'fiches : état hors dernier statut posé',
         count(*) FROM prospects p JOIN attendu e ON e."prospectId" = p."id"
         WHERE p."phase2Status"::text <> e.phase2 AND p."enrollmentMethod" IS NULL
  UNION ALL SELECT 'fiches : dernier motif désaccordé',
         count(*) FROM prospects p JOIN attendu e ON e."prospectId" = p."id"
         WHERE p."lastReasonId" IS DISTINCT FROM e."reasonId"
  UNION ALL SELECT 'fiches : classée sans aucun appel',
         count(*) FROM prospects p WHERE p."phase2Status" <> 'PENDING'
           AND NOT EXISTS (SELECT 1 FROM call_attempts a WHERE a."prospectId" = p."id")
  UNION ALL SELECT 'fiches : parcours du projet désaccordé',
         count(*) FROM prospect_journeys j JOIN prospects p ON p."id" = j."prospectId"
         WHERE j."projet" = p."projet" AND j."enrollmentMethod" IS NULL
           AND j."phase2Status" IS DISTINCT FROM p."phase2Status"
  UNION ALL SELECT 'fiches : état méthode obtenue sans méthode',
         count(*) FROM prospects WHERE "phase2Status" = 'METHOD_OBTAINED' AND "enrollmentMethod" IS NULL
  UNION ALL SELECT 'fiches : sans parcours sur son projet',
         count(*) FROM prospects p WHERE p."deletedAt" IS NULL
           AND NOT EXISTS (SELECT 1 FROM prospect_journeys j WHERE j."prospectId" = p."id" AND j."projet" = p."projet")
           AND EXISTS (SELECT 1 FROM call_attempts a WHERE a."prospectId" = p."id")
  UNION ALL SELECT 'fiches : deux fiches vivantes au même numéro',
         coalesce(sum(n - 1), 0)::bigint FROM (
           SELECT count(*) AS n FROM prospects WHERE "deletedAt" IS NULL AND "phoneE164" IS NOT NULL
           GROUP BY "phoneE164" HAVING count(*) > 1) doublons
  UNION ALL SELECT 'fiches : convertie sans conversion signée',
         count(*) FROM prospect_journeys j WHERE j."statut" = 'CONVERTI'
           AND NOT EXISTS (SELECT 1 FROM prospect_conversions c WHERE c."journeyId" = j."id")
  UNION ALL SELECT 'rappels : en attente sur une fiche fermée hors rendez-vous',
         count(*) FROM scheduled_callbacks c JOIN prospects p ON p."id" = c."prospectId"
         WHERE c."status" = 'PENDING' AND p."phase2Status"::text NOT IN ('PENDING', 'APPOINTMENT')
  UNION ALL SELECT 'rappels : en attente sur une fiche supprimée',
         count(*) FROM scheduled_callbacks c JOIN prospects p ON p."id" = c."prospectId"
         WHERE c."status" = 'PENDING' AND p."deletedAt" IS NOT NULL
  UNION ALL SELECT 'rappels : en attente confiés à un compte fermé',
         count(*) FROM scheduled_callbacks c JOIN users u ON u."id" = c."assignedToId"
         WHERE c."status" = 'PENDING' AND NOT u."isActive"
  UNION ALL SELECT 'campagnes : fiche attribuée à un compte fermé',
         count(*) FROM lot_export_items i JOIN users u ON u."id" = i."assigneeId" WHERE NOT u."isActive"
  UNION ALL SELECT 'campagnes : fiche d''un lot de prospects sans fiche',
         count(*) FROM lot_export_items i JOIN lots_export l ON l."id" = i."lotId"
         WHERE l."cible"::text = 'PROSPECTS' AND i."prospectId" IS NULL
  UNION ALL SELECT 'campagnes : fiche supprimée encore distribuée',
         count(*) FROM lot_export_items i JOIN prospects p ON p."id" = i."prospectId" WHERE p."deletedAt" IS NOT NULL
  UNION ALL SELECT 'campagnes : même fiche deux fois dans un lot',
         coalesce(sum(n - 1), 0)::bigint FROM (
           SELECT count(*) AS n FROM lot_export_items WHERE "prospectId" IS NOT NULL
           GROUP BY "lotId", "prospectId" HAVING count(*) > 1) d
  UNION ALL SELECT 'campagnes : réaffectation vers un compte hors équipe',
         count(*) FROM lot_export_reaffectations r
         WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u."id" = r."toAssigneeId")
  UNION ALL SELECT 'représentants : dernier appel désaccordé du statut posé',
         count(*) FROM representants r JOIN (
           SELECT DISTINCT ON (a."representantId") a."representantId", a."statutQualificationId"
           FROM rep_call_attempts a ORDER BY a."representantId", a."clientCreatedAt" DESC, a."id" DESC) d
           ON d."representantId" = r."id"
         WHERE r."statutQualificationId" IS DISTINCT FROM d."statutQualificationId"
  UNION ALL SELECT 'représentants : ambassadeur sans appel ni statut posé',
         count(*) FROM representants r WHERE r."relationStatus" = 'AMBASSADEUR'
           AND r."statutQualificationId" IS NULL
           AND NOT EXISTS (SELECT 1 FROM rep_call_attempts a WHERE a."representantId" = r."id")
  UNION ALL SELECT 'enrôlement : inscription liée à une fiche supprimée',
         count(*) FROM inscriptions_plateforme i JOIN prospects p ON p."id" = i."prospectId"
         WHERE p."deletedAt" IS NOT NULL AND i."disparueLe" IS NULL
  UNION ALL SELECT 'banque : dossier sans référence',
         count(*) FROM bank_cases WHERE "reference" IS NULL OR btrim("reference") = ''
  UNION ALL SELECT 'banque : deux dossiers pour la même référence',
         coalesce(sum(n - 1), 0)::bigint FROM (
           SELECT count(*) AS n FROM bank_cases GROUP BY "reference" HAVING count(*) > 1) d
  UNION ALL SELECT 'banque : dossier sur une fiche sans méthode d''enrôlement',
         count(*) FROM bank_cases c JOIN prospects p ON p."id" = c."prospectId" WHERE p."enrollmentMethod" IS NULL
  UNION ALL SELECT 'comptes : téléconseiller fermé encore dans une équipe',
         count(DISTINCT u."id") FROM users u JOIN lot_export_items i ON i."assigneeId" = u."id" WHERE NOT u."isActive"
  UNION ALL SELECT 'comptes : rôle personnalisé sans permission',
         count(*) FROM roles r WHERE NOT EXISTS (SELECT 1 FROM role_permissions p WHERE p."roleId" = r."id")
) resultats
WHERE count > 0
ORDER BY controle;
