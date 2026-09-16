-- +goose Up

-- Un rappel promis sur une fiche plateforme appartient au CCP, pas au
-- téléconseiller qui ne peut plus l'ouvrir. Le CCP le moins chargé les reçoit,
-- chaque transfert laisse sa trace.
WITH ccp AS (
  SELECT u."id" FROM public.users u
  WHERE u."role" = 'CCP' AND u."isActive"
  ORDER BY (SELECT count(*) FROM public.scheduled_callbacks c
            WHERE c."assignedToId" = u."id" AND c."status" = 'PENDING'), u."createdAt", u."id"
  LIMIT 1
), cible AS (
  SELECT c."id", c."assignedToId" AS avant, c."prospectId"
  FROM public.scheduled_callbacks c
  JOIN public.prospects p ON p."id" = c."prospectId"
  JOIN public.users a ON a."id" = c."assignedToId"
  WHERE c."status" = 'PENDING' AND p."plateformeDepuis" IS NOT NULL AND a."role" <> 'CCP'
    AND EXISTS (SELECT 1 FROM ccp)
), faite AS (
  UPDATE public.scheduled_callbacks c
  SET "assignedToId" = (SELECT "id" FROM ccp), "updatedAt" = now()
  FROM cible
  WHERE cible."id" = c."id"
  RETURNING c."id", cible.avant, c."assignedToId" AS apres, c."prospectId"
)
INSERT INTO public.audit_logs ("id", "userId", "action", "entity", "entityId", "before", "after")
SELECT gen_random_uuid()::text, NULL, 'rappel.reattribue', 'scheduled_callback', f."id",
       jsonb_build_object('assignedToId', f.avant),
       jsonb_build_object('assignedToId', f.apres, 'prospectId', f."prospectId")
FROM faite f;

-- +goose Down
UPDATE public.scheduled_callbacks c
SET "assignedToId" = (a."before"->>'assignedToId')
FROM (SELECT DISTINCT ON ("entityId") "entityId", "before"
      FROM public.audit_logs
      WHERE "action" = 'rappel.reattribue' AND "userId" IS NULL
      ORDER BY "entityId", "at") a
WHERE a."entityId" = c."id";
DELETE FROM public.audit_logs WHERE "action" = 'rappel.reattribue' AND "userId" IS NULL;
