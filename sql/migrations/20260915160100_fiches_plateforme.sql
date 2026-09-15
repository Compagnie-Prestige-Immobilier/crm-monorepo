-- +goose Up

-- Une fiche rapprochée d'une inscription plateforme appartient aux chargés de
-- clientèle plateforme : la date se pose une fois et ne se retire jamais.
ALTER TABLE public.prospects ADD COLUMN "plateformeDepuis" timestamp(3) without time zone;
CREATE INDEX "prospects_plateformeDepuis_idx" ON public.prospects ("plateformeDepuis" DESC)
  WHERE "plateformeDepuis" IS NOT NULL;

ALTER TABLE public.prospects DROP CONSTRAINT prospects_origin_known;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_origin_known
  CHECK (origin IS NULL OR origin IN ('BANQUE', 'FORMULAIRE_PUBLIC', 'PLATEFORME'));

UPDATE public.prospects p SET "plateformeDepuis" = i.depuis
FROM (SELECT "prospectId", MIN(COALESCE("inscriteLe", "premierTirageAt")) AS depuis
      FROM public.inscriptions_plateforme
      WHERE "prospectId" IS NOT NULL AND "disparueLe" IS NULL
      GROUP BY "prospectId") i
WHERE i."prospectId" = p.id AND p."plateformeDepuis" IS NULL;

-- Retrait immédiat des campagnes en cours : la ligne garde sa position et
-- l'historique des appels, l'attribution seule disparaît.
UPDATE public.lot_export_items li SET "assigneeId" = NULL
FROM public.prospects p
WHERE p.id = li."prospectId" AND p."plateformeDepuis" IS NOT NULL AND li."assigneeId" IS NOT NULL;

-- +goose Down
ALTER TABLE public.prospects DROP CONSTRAINT prospects_origin_known;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_origin_known
  CHECK (origin IS NULL OR origin IN ('BANQUE', 'FORMULAIRE_PUBLIC'));
DROP INDEX IF EXISTS public."prospects_plateformeDepuis_idx";
ALTER TABLE public.prospects DROP COLUMN "plateformeDepuis";
