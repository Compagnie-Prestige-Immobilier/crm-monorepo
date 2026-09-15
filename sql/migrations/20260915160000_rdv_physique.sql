-- +goose Up
-- Le téléconseiller distingue le rendez-vous au téléphone de celui en agence.
-- La ligne copie la configuration de RDV_TELEPHONIQUE, qui reste intacte : les
-- appels déjà consignés gardent leur motif et leurs statistiques.
INSERT INTO public.call_outcome_reasons
  ("id", "code", "label", "effect", "requiresComment", "requiresCallback",
   "countsAsReached", "color", "sortOrder", "isSystem", "minPayloadVersion", "updatedAt")
SELECT gen_random_uuid()::text, 'RDV_PHYSIQUE', 'RDV physique', r."effect",
       r."requiresComment", r."requiresCallback", r."countsAsReached", r."color",
       22, false, r."minPayloadVersion", now()
FROM public.call_outcome_reasons r
WHERE r."code" = 'RDV_TELEPHONIQUE'
ON CONFLICT ("code") DO NOTHING;

-- Les rangs suivants reculent d'un cran pour laisser la place au nouveau motif.
UPDATE public.call_outcome_reasons SET "sortOrder" = 23, "updatedAt" = now() WHERE "code" = 'TRANSFERT_ENROLEMENT';
UPDATE public.call_outcome_reasons SET "sortOrder" = 24, "updatedAt" = now() WHERE "code" = 'CONSTRUCTION';
UPDATE public.call_outcome_reasons SET "sortOrder" = 25, "updatedAt" = now() WHERE "code" = 'PARTENARIAT';
UPDATE public.call_outcome_reasons SET "sortOrder" = 26, "updatedAt" = now() WHERE "code" = 'HORS_CIBLE';
UPDATE public.call_outcome_reasons SET "sortOrder" = 27, "updatedAt" = now() WHERE "code" = 'AUTRES';

-- +goose Down
DELETE FROM public.call_outcome_reasons
WHERE "code" = 'RDV_PHYSIQUE'
  AND NOT EXISTS (SELECT 1 FROM public.call_attempts a WHERE a."reasonId" = call_outcome_reasons."id");

UPDATE public.call_outcome_reasons SET "sortOrder" = 22, "updatedAt" = now() WHERE "code" = 'TRANSFERT_ENROLEMENT';
UPDATE public.call_outcome_reasons SET "sortOrder" = 23, "updatedAt" = now() WHERE "code" = 'CONSTRUCTION';
UPDATE public.call_outcome_reasons SET "sortOrder" = 24, "updatedAt" = now() WHERE "code" = 'PARTENARIAT';
UPDATE public.call_outcome_reasons SET "sortOrder" = 25, "updatedAt" = now() WHERE "code" = 'HORS_CIBLE';
UPDATE public.call_outcome_reasons SET "sortOrder" = 26, "updatedAt" = now() WHERE "code" = 'AUTRES';
