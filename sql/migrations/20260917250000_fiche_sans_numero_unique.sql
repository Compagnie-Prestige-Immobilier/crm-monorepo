-- +goose Up

-- Un numéro vivant est unique (`prospects_phone_e164_active_key`), une fiche
-- sans numéro ne l'était pas : le relevé horaire des leads a recréé la même
-- personne à chaque passage, quatre fois, sans appel ni campagne derrière.
-- La plus ancienne reste, les suivantes passent en supprimées sans rien perdre.
UPDATE public.prospects p SET "deletedAt" = now(), "updatedAt" = now()
FROM (SELECT "id", row_number() OVER (PARTITION BY lower("email"), "projet" ORDER BY "createdAt", "id") AS rang
      FROM public.prospects
      WHERE "deletedAt" IS NULL AND "phoneE164" IS NULL AND "email" IS NOT NULL) doublon
WHERE doublon."id" = p."id" AND doublon.rang > 1
  AND NOT EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."prospectId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM public.lot_export_items i WHERE i."prospectId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM public.scheduled_callbacks c WHERE c."prospectId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM public.inscriptions_plateforme s WHERE s."prospectId" = p."id");

CREATE UNIQUE INDEX IF NOT EXISTS prospects_email_sans_numero_actif_key
  ON public.prospects (lower("email"), "projet")
  WHERE "deletedAt" IS NULL AND "phoneE164" IS NULL AND "email" IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS public.prospects_email_sans_numero_actif_key;
