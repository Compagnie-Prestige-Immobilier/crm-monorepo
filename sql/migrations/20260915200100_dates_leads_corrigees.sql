-- +goose Up

-- Le classeur des leads a été lu en locale US : « 11/09/2026 » est devenu le
-- 9 novembre. Le jour de l'onglet fait foi, même règle que socle.DateDuNomDeFeuille.
-- Une inversion jour/mois garde son heure, tout autre écart prend midi ; chaque
-- fiche touchée laisse sa date d'avant dans audit_logs.
WITH onglet AS (
  SELECT p."id", p."importFeuille", p."clientCreatedAt", p."createdAt",
         regexp_match(translate(lower(p."importFeuille"), 'éèêëàâäîïôöûüç', 'eeeeaaaiioouuc'),
                      '(\d{1,2})\s+([a-z]{3,10})\.?(?:\s+(\d{2,4}))?') AS m
  FROM public.prospects p
  WHERE p."importFeuille" IS NOT NULL
), lu AS (
  SELECT o."id", o."importFeuille", o."clientCreatedAt",
         o.m[1]::int AS quantieme,
         CASE WHEN o.m[2] LIKE 'janv%' THEN 1  WHEN o.m[2] LIKE 'fevr%' THEN 2
              WHEN o.m[2] LIKE 'mars%' THEN 3  WHEN o.m[2] LIKE 'avri%' THEN 4
              WHEN o.m[2] LIKE 'mai%'  THEN 5  WHEN o.m[2] LIKE 'juin%' THEN 6
              WHEN o.m[2] LIKE 'juil%' THEN 7  WHEN o.m[2] LIKE 'aout%' THEN 8
              WHEN o.m[2] LIKE 'sept%' THEN 9  WHEN o.m[2] LIKE 'octo%' THEN 10
              WHEN o.m[2] LIKE 'nove%' THEN 11 WHEN o.m[2] LIKE 'dece%' THEN 12 END AS mois,
         CASE WHEN o.m[3] IS NULL THEN EXTRACT(YEAR FROM o."createdAt")::int
              WHEN o.m[3]::int < 100 THEN o.m[3]::int + 2000
              ELSE o.m[3]::int END AS annee
  FROM onglet o
  WHERE o.m IS NOT NULL
), jour AS (
  SELECT l.*, (make_date(l.annee, l.mois, 1) + (l.quantieme - 1))::date AS jour_onglet
  FROM lu l
  WHERE l.mois IS NOT NULL AND l.quantieme BETWEEN 1 AND 31
    AND l.annee BETWEEN 2000 AND EXTRACT(YEAR FROM now())::int
), cible AS (
  SELECT j."id", j."importFeuille", j."clientCreatedAt" AS avant, j.jour_onglet,
         (EXTRACT(YEAR FROM j."clientCreatedAt") = j.annee
          AND EXTRACT(MONTH FROM j."clientCreatedAt") = j.quantieme
          AND EXTRACT(DAY FROM j."clientCreatedAt") = j.mois) AS inversion
  FROM jour j
  WHERE EXTRACT(MONTH FROM j.jour_onglet) = j.mois
    AND j.jour_onglet <= CURRENT_DATE
    AND j."clientCreatedAt"::date <> j.jour_onglet
), corrigee AS (
  UPDATE public.prospects p
  SET "clientCreatedAt" = LEAST(
        CASE WHEN c.inversion THEN c.jour_onglet + c.avant::time
             ELSE c.jour_onglet + time '12:00' END,
        (now() AT TIME ZONE 'UTC')),
      "rev" = p."rev" + 1
  FROM cible c
  WHERE c."id" = p."id"
  RETURNING p."id", c."importFeuille", c.avant, p."clientCreatedAt" AS apres,
            CASE WHEN c.inversion THEN 'inversion' ELSE 'onglet' END AS regle
)
INSERT INTO public.audit_logs ("id", "userId", "action", "entity", "entityId", "before", "after")
SELECT gen_random_uuid()::text, NULL, 'prospect.date_corrigee', 'prospect', c."id",
       jsonb_build_object('clientCreatedAt', c.avant, 'importFeuille', c."importFeuille"),
       jsonb_build_object('clientCreatedAt', c.apres, 'regle', c.regle)
FROM corrigee c;

-- Filet : aucune fiche, quelle que soit son origine, ne date de demain.
WITH cible AS (
  SELECT "id", "importFeuille", "clientCreatedAt" AS avant
  FROM public.prospects
  WHERE "clientCreatedAt" >= (CURRENT_DATE + 1)::timestamp
), corrigee AS (
  UPDATE public.prospects p
  SET "clientCreatedAt" = p."createdAt", "rev" = p."rev" + 1
  FROM cible c
  WHERE c."id" = p."id"
  RETURNING p."id", c."importFeuille", c.avant, p."clientCreatedAt" AS apres
)
INSERT INTO public.audit_logs ("id", "userId", "action", "entity", "entityId", "before", "after")
SELECT gen_random_uuid()::text, NULL, 'prospect.date_corrigee', 'prospect', c."id",
       jsonb_build_object('clientCreatedAt', c.avant, 'importFeuille', c."importFeuille"),
       jsonb_build_object('clientCreatedAt', c.apres, 'regle', 'sans_onglet')
FROM corrigee c;

-- +goose Down
-- Le journal porte la date d'avant : la descente la repose et retire ses lignes.
UPDATE public.prospects p
SET "clientCreatedAt" = (a."before"->>'clientCreatedAt')::timestamp
FROM (SELECT DISTINCT ON ("entityId") "entityId", "before"
      FROM public.audit_logs
      WHERE "action" = 'prospect.date_corrigee' AND "entity" = 'prospect'
      ORDER BY "entityId", "at") a
WHERE a."entityId" = p."id";
DELETE FROM public.audit_logs WHERE "action" = 'prospect.date_corrigee';
