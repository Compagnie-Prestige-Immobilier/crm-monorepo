-- +goose Up
-- Les statuts système des représentants existent en production mais aucune
-- migration ne les posait : une base neuve (CI, poste) n'en avait aucun et
-- la reprise des appels ne trouvait rien à rattacher.
INSERT INTO public.statuts_qualification
  ("id", "code", "label", "effect", "isSystem", "sortOrder", "retryAfterMinutes", "relationStatus", "updatedAt")
SELECT gen_random_uuid()::text, s.code, s.label, s.effect::"StatutQualificationEffect", true, s.ordre,
       s.retry, s.relation::"RepresentantRelation", now()
FROM (VALUES
  ('ACCEPTE', 'Accepté', 'REACHED', 10, NULL::int, 'AMBASSADEUR'),
  ('REFUSE', 'Refusé', 'REFUSED', 20, NULL, 'REFUS'),
  ('A_RAPPELER', 'À rappeler', 'SCHEDULE_CALLBACK', 30, NULL, NULL),
  ('DECEDE', 'Décédé', 'REFUSED', 40, NULL, NULL),
  ('RETRAITE', 'Retraité', 'REFUSED', 50, NULL, NULL),
  ('HORS_CIBLE', 'Hors cible', 'REFUSED', 60, NULL, NULL),
  ('AFFECTE_AILLEURS', 'Affecté ailleurs', 'REFUSED', 70, NULL, NULL),
  ('FAUX_NUMERO', 'Faux numéro', 'WRONG_NUMBER', 80, NULL, NULL),
  ('AUTRE_JOINT', 'Autre joint', 'REACHED', 90, NULL, NULL),
  ('PAS_DE_REPONSE', 'Pas de réponse', 'UNREACHABLE', 110, 120, NULL),
  ('NUMERO_OCCUPE', 'Occupé', 'UNREACHABLE', 120, 30, NULL),
  ('MESSAGERIE', 'Messagerie', 'UNREACHABLE', 130, 240, NULL),
  ('TELEPHONE_INDISPONIBLE', 'Téléphone indisponible', 'UNREACHABLE', 140, 1440, NULL),
  ('INJOIGNABLE_DEFINITIF', 'Injoignable définitif', 'UNREACHABLE', 150, NULL, NULL),
  ('AUTRE_NON_JOINT', 'Autre non joint', 'UNREACHABLE', 160, 1440, NULL)
) AS s(code, label, effect, ordre, retry, relation)
WHERE NOT EXISTS (SELECT 1 FROM public.statuts_qualification e WHERE e."code" = s.code);

UPDATE public.statuts_qualification SET "requiresCallback" = true
WHERE "code" = 'A_RAPPELER' AND "isSystem" AND NOT "requiresCallback";

-- +goose Down
SELECT 1;
