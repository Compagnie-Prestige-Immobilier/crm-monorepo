-- La liste de statuts du Lot 1, et la reprise des fiches deja qualifiees.
--
-- AUCUNE ligne n'est supprimee : l'historique en designe, et la cle etrangere
-- est ON DELETE RESTRICT. Les statuts retires sont DESACTIVES et relegues au
-- rang 900, en fin de liste dans l'administration.
--
-- L'ORDRE COMPTE. Les neuf statuts neufs sont inseres AVANT que les sept
-- anciens ne soient desactives : l'API refuse de vider une branche du script
-- (`STATUT_QUALIFICATION_LAST_OF_BRANCH`), et le SQL brut ne passe pas par ce
-- garde-fou. Inverser les deux blocs laisserait un instant la branche jointe
-- sans issue possible.
--
-- La famille reste DEDUITE de l'effet, sans colonne a cote : EB-03 ne deplace
-- pas un statut, il deplace l'effet WRONG_NUMBER tout entier du cote joint.

INSERT INTO "statuts_qualification" (
  "id", "code", "label", "effect", "requiresCallback", "requiresComment",
  "retryAfterMinutes", "priorite", "relationStatus", "isSystem", "isActive",
  "sortOrder", "minPayloadVersion", "createdAt", "updatedAt"
)
VALUES
  (gen_random_uuid()::text, 'ACCEPTE',               'Accepté',               'REACHED',     false, false, NULL,  'HAUTE',   'AMBASSADEUR', true, true,  10, 6, now(), now()),
  (gen_random_uuid()::text, 'REFUSE',                'Refusé',                'REFUSED',     false, false, NULL,  'BASSE',   'REFUS',       true, true,  20, 6, now(), now()),
  (gen_random_uuid()::text, 'DECEDE',                'Décédé',                'REFUSED',     false, false, NULL,  'BASSE',   NULL,          true, true,  40, 6, now(), now()),
  (gen_random_uuid()::text, 'RETRAITE',              'Retraité',              'REFUSED',     false, false, NULL,  'BASSE',   NULL,          true, true,  50, 6, now(), now()),
  (gen_random_uuid()::text, 'HORS_CIBLE',            'Hors cible',            'REFUSED',     false, false, NULL,  'BASSE',   NULL,          true, true,  60, 6, now(), now()),
  (gen_random_uuid()::text, 'AFFECTE_AILLEURS',      'Affecté ailleurs',      'REFUSED',     false, false, NULL,  'BASSE',   NULL,          true, true,  70, 6, now(), now()),
  (gen_random_uuid()::text, 'AUTRE_JOINT',           'Autre joint',           'REACHED',     false, true,  NULL,  'NORMALE', NULL,          true, true,  90, 6, now(), now()),
  (gen_random_uuid()::text, 'INJOIGNABLE_DEFINITIF', 'Injoignable définitif', 'UNREACHABLE', false, false, NULL,  'BASSE',   NULL,          true, true, 150, 6, now(), now()),
  (gen_random_uuid()::text, 'AUTRE_NON_JOINT',       'Autre non joint',       'UNREACHABLE', false, true,  1440, 'NORMALE', NULL,          true, true, 160, 6, now(), now())
ON CONFLICT ("code") DO NOTHING;

-- Les six statuts reconduits. Le CODE ne bouge pas : il est immuable et
-- l'historique le designe. Seuls le libelle, le rang, la priorite et le delai
-- de reessai suivent EB-01 et EB-06.
UPDATE "statuts_qualification" SET
  "label" = CASE "code" WHEN 'NUMERO_OCCUPE' THEN 'Occupé' ELSE "label" END,
  "retryAfterMinutes" = CASE "code"
    WHEN 'NUMERO_OCCUPE'          THEN 30
    WHEN 'PAS_DE_REPONSE'         THEN 120
    WHEN 'MESSAGERIE'             THEN 240
    WHEN 'TELEPHONE_INDISPONIBLE' THEN 1440
    ELSE NULL
  END,
  "sortOrder" = CASE "code"
    WHEN 'A_RAPPELER'             THEN 30
    WHEN 'FAUX_NUMERO'            THEN 80
    WHEN 'PAS_DE_REPONSE'         THEN 110
    WHEN 'NUMERO_OCCUPE'          THEN 120
    WHEN 'MESSAGERIE'             THEN 130
    WHEN 'TELEPHONE_INDISPONIBLE' THEN 140
    ELSE "sortOrder"
  END,
  "priorite" = CASE "code"
    WHEN 'A_RAPPELER'  THEN 'HAUTE'::"PrioriteTraitement"
    WHEN 'FAUX_NUMERO' THEN 'BASSE'::"PrioriteTraitement"
    ELSE 'NORMALE'::"PrioriteTraitement"
  END,
  "isActive" = true,
  "updatedAt" = now()
WHERE "code" IN (
  'A_RAPPELER', 'FAUX_NUMERO', 'PAS_DE_REPONSE', 'NUMERO_OCCUPE', 'MESSAGERIE',
  'TELEPHONE_INDISPONIBLE'
);

-- Reprise de donnees, une seule fois. L'historique des tentatives est immuable
-- par principe (EB-11) : ce qui est fige, c'est le FAIT qu'un appel a eu lieu et
-- ce qu'il a produit, pas le mot du referentiel qui le nomme. Les sept
-- conversions preservent toutes l'effet (REACHED vers REACHED, REFUSED vers
-- REFUSED, WRONG_NUMBER vers WRONG_NUMBER) : ni `outcome` ni `relationStatus`,
-- deja ecrits sur la tentative et sur la fiche, ne se retrouvent en desaccord
-- avec le statut qu'ils designent. Laisser ces lignes pointer un mot que plus
-- aucun ecran ne propose aurait coute une table de correspondance a maintenir
-- dans chaque tableau de bord, pour toujours.
--
-- Idempotente : au second passage plus aucune ligne ne porte un ancien
-- identifiant, les deux UPDATE ne touchent rien.
UPDATE "representants" r
SET "statutQualificationId" = nouveau."id"
FROM (VALUES
  ('INTERESSE',       'ACCEPTE'),
  ('TRES_INTERESSE',  'ACCEPTE'),
  ('RDV_OBTENU',      'ACCEPTE'),
  ('DEMANDE_INFOS',   'ACCEPTE'),
  ('NON_INTERESSE',   'REFUSE'),
  ('NON_ELIGIBLE',    'REFUSE'),
  ('NUMERO_INVALIDE', 'FAUX_NUMERO')
) AS t("ancienCode", "nouveauCode")
JOIN "statuts_qualification" ancien  ON ancien."code"  = t."ancienCode"
JOIN "statuts_qualification" nouveau ON nouveau."code" = t."nouveauCode"
WHERE r."statutQualificationId" = ancien."id";

UPDATE "rep_call_attempts" a
SET "statutQualificationId" = nouveau."id"
FROM (VALUES
  ('INTERESSE',       'ACCEPTE'),
  ('TRES_INTERESSE',  'ACCEPTE'),
  ('RDV_OBTENU',      'ACCEPTE'),
  ('DEMANDE_INFOS',   'ACCEPTE'),
  ('NON_INTERESSE',   'REFUSE'),
  ('NON_ELIGIBLE',    'REFUSE'),
  ('NUMERO_INVALIDE', 'FAUX_NUMERO')
) AS t("ancienCode", "nouveauCode")
JOIN "statuts_qualification" ancien  ON ancien."code"  = t."ancienCode"
JOIN "statuts_qualification" nouveau ON nouveau."code" = t."nouveauCode"
WHERE a."statutQualificationId" = ancien."id";

-- « Non interesse » est desactive au meme titre que les six autres : la famille
-- jointe d'EB-01 ne le nomme pas, et ses fiches viennent de passer en
-- « Refuse ». Le laisser proposable rouvrirait la liste qu'on ferme.
UPDATE "statuts_qualification"
SET "isActive" = false, "sortOrder" = 900, "updatedAt" = now()
WHERE "code" IN (
  'INTERESSE', 'TRES_INTERESSE', 'RDV_OBTENU', 'DEMANDE_INFOS',
  'NON_INTERESSE', 'NON_ELIGIBLE', 'NUMERO_INVALIDE'
);
