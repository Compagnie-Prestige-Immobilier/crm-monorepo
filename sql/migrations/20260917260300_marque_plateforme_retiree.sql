-- +goose Up

-- Plus rien n'écrit ni ne lit la marque : le relevé des plateformes ne crée
-- plus de fiche, et le classeur des leads laisse ses lignes plateforme où elles
-- sont.
DROP INDEX IF EXISTS public."prospects_plateformeDepuis_idx";
ALTER TABLE public.prospects DROP COLUMN "plateformeDepuis";

DELETE FROM public.app_settings WHERE "key" = 'plateforme.objectifAppelsParJour';

-- +goose Down
ALTER TABLE public.prospects ADD COLUMN "plateformeDepuis" timestamp(3) without time zone;
CREATE INDEX "prospects_plateformeDepuis_idx" ON public.prospects ("plateformeDepuis" DESC)
  WHERE "plateformeDepuis" IS NOT NULL;
