-- +goose Up
-- Avant le commit e0e481d4 (15/09 23:41), l'import Grand Public comptait comme
-- « créée » un parcours ajouté à une fiche déjà en base, et un doublon dans le
-- fichier à la fois dans « ignorées » et dans « erreurs ». Les compteurs de ces
-- travaux sont recalculés sur ce qui est réellement en base ; les fiches ne bougent pas.
WITH reel AS (
  SELECT j."id",
         (SELECT COUNT(*) FROM public.prospects p WHERE p."importJobId" = j."id")::int AS creees
  FROM public.import_jobs j
  WHERE j."kind" = 'PROSPECTS_GRAND_PUBLIC' AND j."mode" = 'APPLY' AND j."createdAt" < '2026-09-15 23:42:00'
), corrige AS (
  SELECT j."id",
         r.creees,
         j."updatedRows" + GREATEST(j."createdRows" - r.creees, 0) AS maj,
         GREATEST(j."skippedRows" - GREATEST(
           j."updatedRows" + GREATEST(j."createdRows", r.creees) + j."skippedRows" + j."errorRows" - j."totalRows", 0
         ), 0) AS ignorees
  FROM public.import_jobs j JOIN reel r ON r."id" = j."id"
)
UPDATE public.import_jobs j SET
  "createdRows" = c.creees,
  "updatedRows" = c.maj,
  "skippedRows" = c.ignorees,
  "report" = CASE WHEN j."report" IS NULL THEN NULL ELSE j."report" || jsonb_build_object(
    'createdRows', c.creees, 'updatedRows', c.maj, 'skippedRows', c.ignorees) END
FROM corrige c
WHERE c."id" = j."id"
  AND (j."createdRows", j."updatedRows", j."skippedRows") IS DISTINCT FROM (c.creees, c.maj, c.ignorees);

-- +goose Down
SELECT 1;
