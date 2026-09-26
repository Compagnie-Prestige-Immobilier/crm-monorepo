-- +goose Up

-- Les inscrits des plateformes se suivent sur les plateformes. Leurs fiches
-- n'avaient de sens ici que pour les CCP : appels, rappels et lignes de
-- campagne partent avec elles (cascade). Le journal garde qui elles étaient.
INSERT INTO public.audit_logs ("id", "userId", "action", "entity", "entityId", "before", "after")
SELECT gen_random_uuid()::text, NULL, 'prospect.purge_plateforme', 'prospect', p."id",
       jsonb_build_object('nom', p."nom", 'prenom', p."prenom", 'phoneE164', p."phoneE164",
                          'projet', p."projet", 'plateformeDepuis', p."plateformeDepuis"),
       NULL
FROM public.prospects p WHERE p."plateformeDepuis" IS NOT NULL;

DELETE FROM public.prospects WHERE "plateformeDepuis" IS NOT NULL;

-- +goose Down

-- Une fiche supprimée ne se reconstitue pas : le journal en garde la trace.
-- Ce Down ne restaure rien. Revenir en arrière passe par la sauvegarde.
