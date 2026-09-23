-- Reprise ponctuelle des rendez-vous tenus hors CRM : chaque ligne du classeur
-- désigne une fiche par son téléphone et le téléconseiller qui la suit.
--
-- Ce script se joue UNE fois, à la main, contre la base visée :
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/scripts/2026-09-23-rdv-teleconseillers.sql
--
-- Il attend à côté de lui un fichier `rdv.csv` exporté du classeur, avec cette
-- première ligne d'en-têtes, dans cet ordre :
--
--   nom,telephone,statut,type_rdv,teleconseiller,quand,confirme
--
-- Rien n'est écrit tant que le COMMIT final n'est pas atteint : le script
-- affiche d'abord ce qu'il ne sait pas rattacher, puis ce qu'il changerait.
-- Relisez ces deux tableaux avant de laisser le COMMIT s'exécuter.

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE reprise_rdv (
  nom text,
  telephone text,
  statut text,
  type_rdv text,
  teleconseiller text,
  quand text,
  confirme text
) ON COMMIT DROP;

\copy reprise_rdv FROM 'rdv.csv' WITH (FORMAT csv, HEADER true)

-- Les neuf derniers chiffres suffisent à rapprocher deux écritures du même
-- numéro sénégalais : +221 77 123 45 67, 00221771234567 et 77 123 45 67.
CREATE TEMP VIEW reprise_appariee AS
SELECT r.*,
       (SELECT p."id" FROM "prospects" p
        WHERE p."deletedAt" IS NULL
          AND right(regexp_replace(p."phoneE164", '\D', '', 'g'), 9)
              = right(regexp_replace(r.telephone, '\D', '', 'g'), 9)
        ORDER BY p."updatedAt" DESC
        LIMIT 1) AS prospect_id,
       (SELECT count(*) FROM "prospects" p
        WHERE p."deletedAt" IS NULL
          AND right(regexp_replace(p."phoneE164", '\D', '', 'g'), 9)
              = right(regexp_replace(r.telephone, '\D', '', 'g'), 9)) AS fiches_trouvees,
       (SELECT u."id" FROM "users" u
        WHERE lower(u."fullName") = lower(btrim(r.teleconseiller))
        LIMIT 1) AS teleconseiller_id
FROM reprise_rdv r;

\echo '--- Lignes à traiter à la main : fiche introuvable, fiche en double, ou téléconseiller inconnu ---'
SELECT nom, telephone, teleconseiller,
       CASE
         WHEN fiches_trouvees = 0 THEN 'aucune fiche pour ce numéro'
         WHEN fiches_trouvees > 1 THEN 'plusieurs fiches pour ce numéro'
         ELSE 'téléconseiller absent des comptes'
       END AS motif
FROM reprise_appariee
WHERE fiches_trouvees <> 1 OR teleconseiller_id IS NULL
ORDER BY motif, nom;

\echo '--- Attributions qui vont changer ---'
SELECT a.nom, a.telephone, ancien."fullName" AS avant, a.teleconseiller AS apres
FROM reprise_appariee a
JOIN "prospects" p ON p."id" = a.prospect_id
JOIN "users" ancien ON ancien."id" = p."createdById"
WHERE a.fiches_trouvees = 1 AND a.teleconseiller_id IS NOT NULL
  AND p."createdById" <> a.teleconseiller_id
ORDER BY a.nom;

-- La fiche change de main comme le fait l'écran de réaffectation : le
-- propriétaire est `createdById`, et `rev` avance pour que les panneaux ouverts
-- rechargent la fiche.
UPDATE "prospects" p SET
  "createdById" = a.teleconseiller_id,
  "rev" = p."rev" + 1,
  "updatedAt" = now()
FROM reprise_appariee a
WHERE p."id" = a.prospect_id
  AND a.fiches_trouvees = 1
  AND a.teleconseiller_id IS NOT NULL
  AND p."createdById" <> a.teleconseiller_id;

\echo '--- Ce que le classeur dit du rendez-vous, ajouté à la note de la fiche ---'
-- Les dates du classeur sont parfois des phrases (« entre le 20 et le 28
-- septembre », « attente de rdv telephonique ») : aucun champ date ne les
-- accepte. Elles rejoignent la note du classeur, que la fiche affiche déjà,
-- plutôt que d'être devinées. Une note existante est gardée, la reprise se pose
-- derrière elle, et une deuxième exécution ne la réécrit pas.
UPDATE "prospects" p SET
  "remarqueImport" = btrim(
    concat_ws(' · ', nullif(btrim(COALESCE(p."remarqueImport", '')), ''), a.note_reprise)),
  "updatedAt" = now()
FROM (
  SELECT prospect_id, fiches_trouvees,
         concat_ws(' · ',
           nullif(btrim(COALESCE(type_rdv, '')), ''),
           nullif(btrim(COALESCE(quand, '')), ''),
           nullif(btrim(COALESCE(statut, '')), '')) AS note_reprise
  FROM reprise_appariee
) a
WHERE p."id" = a.prospect_id
  AND a.fiches_trouvees = 1
  AND a.note_reprise <> ''
  AND POSITION(a.note_reprise IN COALESCE(p."remarqueImport", '')) = 0;

\echo '--- Compte final ---'
SELECT count(*) FILTER (WHERE fiches_trouvees = 1) AS fiches_rattachees,
       count(*) FILTER (WHERE fiches_trouvees <> 1) AS fiches_a_traiter,
       count(*) FILTER (WHERE teleconseiller_id IS NULL) AS teleconseillers_inconnus
FROM reprise_appariee;

COMMIT;
