-- +goose Up
-- La requête SQL libre de l'assistant s'exécute sous ce rôle. Les rôles sont
-- communs à toutes les bases du serveur : la seconde base le trouve déjà créé.
-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'assistant_lecture') THEN
    CREATE ROLE assistant_lecture NOLOGIN;
  END IF;
END $$;
-- +goose StatementEnd

-- Les tables présentes aujourd'hui, sauf les secrets ; une table ajoutée plus
-- tard reste invisible à l'assistant tant qu'une migration ne la lui ouvre pas.
-- +goose StatementBegin
DO $$
DECLARE
  nom text;
BEGIN
  FOR nom IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('users', 'refresh_tokens', 'device_tokens', 'support_signalement_images', 'goose_db_version')
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO assistant_lecture', nom);
  END LOOP;
END $$;
-- +goose StatementEnd

GRANT SELECT ("id", "email", "username", "fullName", "phoneE164", "role", "isActive", "lastLoginAt",
  "departementId", "createdAt", "updatedAt", "deletedAt", "roleId") ON public.users TO assistant_lecture;

-- Sous `SET ROLE`, set_config('role', ...) rendrait le superutilisateur et
-- lèverait le délai de la requête : le superutilisateur, lui, n'est pas concerné.
REVOKE EXECUTE ON FUNCTION pg_catalog.set_config(text, text, boolean) FROM PUBLIC;

-- +goose Down
GRANT EXECUTE ON FUNCTION pg_catalog.set_config(text, text, boolean) TO PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM assistant_lecture;
