-- Un lot de représentants est CHUES par construction ; un lot de prospects sans
-- projet n'a pu venir que d'un appel direct, antérieur au filtre de création.
UPDATE "lots_export" SET "projet" = 'CHUES' WHERE "projet" IS NULL;
ALTER TABLE "lots_export" ALTER COLUMN "projet" SET NOT NULL;

-- Le flux `professions` du pull mobile pagine sur (updatedAt, id), comme les
-- autres référentiels.
CREATE INDEX "professions_updatedAt_id_idx" ON "professions"("updatedAt", "id");

-- Reprise des anciennetés écrites dans la durée du plan de paiement.
--
-- Le formulaire mobile posait « Ancienneté » et l'envoyait dans
-- `dureeSystemeMois` jusqu'à l'ajout d'`ancienneteMois`. Les deux autres
-- écritures de cette colonne sont exclues : la conversion et la phase 3
-- laissent toujours une tentative d'appel, et l'import Grand Public écrit une
-- VRAIE durée de plan pendant la fenêtre de son travail.
UPDATE "prospects" p
SET "ancienneteMois" = p."dureeSystemeMois", "dureeSystemeMois" = NULL
WHERE p."projet" = 'GRAND_PUBLIC'
  AND p."dureeSystemeMois" IS NOT NULL
  AND p."ancienneteMois" IS NULL
  AND p."paymentMode" IS NULL
  AND p."phase2Status" = 'PENDING'
  AND NOT EXISTS (
    SELECT 1 FROM "call_attempts" ca WHERE ca."prospectId" = p."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "import_jobs" j
    WHERE j."kind" = 'PROSPECTS_GRAND_PUBLIC'
      AND j."mode" = 'APPLY'
      AND j."startedAt" IS NOT NULL
      AND j."finishedAt" IS NOT NULL
      AND p."createdAt" BETWEEN j."startedAt" AND j."finishedAt"
  );
