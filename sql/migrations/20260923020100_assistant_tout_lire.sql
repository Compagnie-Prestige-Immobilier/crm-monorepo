-- +goose Up
-- L'ADMIN interroge la base sans se limiter aux chiffres prévus : le modèle
-- écrit la lecture, le serveur l'exécute en lecture seule et la journalise.
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ADMIN', 'assistant.tout_lire')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM public.role_permissions WHERE "permission" = 'assistant.tout_lire';
