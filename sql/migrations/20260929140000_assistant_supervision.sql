-- +goose Up
-- La supervision a l'assistant complet : tous les outils et la requête libre.
INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('SUPERVISEUR', 'assistant.tout_lire'),
    ('DIRECTION', 'assistant.tout_lire')
ON CONFLICT DO NOTHING;

-- Une connexion ouvre une famille de jetons : l'assistant compte les connexions
-- sans jamais lire l'empreinte du jeton.
GRANT SELECT ("id", "userId", "familyId", "expiresAt", "revokedAt", "userAgent", "createdAt", "usurpePar")
    ON public.refresh_tokens TO assistant_lecture;

-- +goose Down
REVOKE SELECT ON public.refresh_tokens FROM assistant_lecture;
DELETE FROM public.role_permissions
WHERE "permission" = 'assistant.tout_lire' AND "roleId" IN ('SUPERVISEUR', 'DIRECTION');
