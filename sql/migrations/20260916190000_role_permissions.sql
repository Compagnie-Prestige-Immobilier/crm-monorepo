-- +goose Up
-- Les huit rôles d'origine sont des rôles système : identifiant = rôle de base.
CREATE TABLE public.roles (
    "id" text PRIMARY KEY,
    "libelle" text NOT NULL,
    "roleDeBase" public."Role" NOT NULL,
    "systeme" boolean NOT NULL DEFAULT false,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT roles_systeme_id CHECK (NOT "systeme" OR "id" = "roleDeBase"::text)
);
CREATE UNIQUE INDEX roles_libelle_key ON public.roles (lower("libelle"));
CREATE TRIGGER set_updated_at BEFORE INSERT OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.roles ("id", "libelle", "roleDeBase", "systeme") VALUES
    ('ADMIN', 'Administrateur', 'ADMIN', true),
    ('COMMERCIAL', 'Téléconseiller', 'COMMERCIAL', true),
    ('BANQUE_FINANCE', 'Banque & Finance', 'BANQUE_FINANCE', true),
    ('SUPERVISEUR', 'Supervision', 'SUPERVISEUR', true),
    ('DIRECTION', 'Direction', 'DIRECTION', true),
    ('ACCUEIL', 'Accueil', 'ACCUEIL', true),
    ('CHARGE_CLIENTELE', 'Chargé de clientèle', 'CHARGE_CLIENTELE', true),
    ('CCP', 'Chargé de clientèle plateforme', 'CCP', true);

CREATE TABLE public.role_permissions (
    "roleId" text NOT NULL REFERENCES public.roles ("id") ON DELETE CASCADE,
    "permission" text NOT NULL,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("roleId", "permission")
);

INSERT INTO public.role_permissions ("roleId", "permission") VALUES
    ('ACCUEIL', 'accueil.registre'),
    ('ACCUEIL', 'campagnes.attributions_toutes'),
    ('ACCUEIL', 'chiffres.disposer'),
    ('ACCUEIL', 'panneau.acceder'),
    ('ADMIN', 'accueil.listes'),
    ('ADMIN', 'accueil.registre'),
    ('ADMIN', 'analytics.superviser'),
    ('ADMIN', 'banque.administrer'),
    ('ADMIN', 'banque.dossiers'),
    ('ADMIN', 'banque.lire'),
    ('ADMIN', 'banque.voir_tous_portefeuilles'),
    ('ADMIN', 'bases.administrer'),
    ('ADMIN', 'campagnes.administrer'),
    ('ADMIN', 'campagnes.attributions_toutes'),
    ('ADMIN', 'campagnes.gerer'),
    ('ADMIN', 'campagnes.superviser'),
    ('ADMIN', 'chiffres.disposer'),
    ('ADMIN', 'chiffres.voir_montants'),
    ('ADMIN', 'comptes.administrer'),
    ('ADMIN', 'comptes.lister'),
    ('ADMIN', 'courriels.administrer'),
    ('ADMIN', 'donnees.voir_supprimees'),
    ('ADMIN', 'enrolement.administrer'),
    ('ADMIN', 'exploitation.administrer'),
    ('ADMIN', 'exports.banque'),
    ('ADMIN', 'exports.globaux'),
    ('ADMIN', 'exports.modeles'),
    ('ADMIN', 'exports.prospects'),
    ('ADMIN', 'exports.voir_tout'),
    ('ADMIN', 'fiches.forcer_transition'),
    ('ADMIN', 'fiches.ignorer_propriete'),
    ('ADMIN', 'fiches.modifier_toutes'),
    ('ADMIN', 'fiches.parametres_reserves'),
    ('ADMIN', 'fiches.tenir'),
    ('ADMIN', 'formulaires.administrer'),
    ('ADMIN', 'imports.administrer'),
    ('ADMIN', 'notifications.administrer'),
    ('ADMIN', 'panneau.acceder'),
    ('ADMIN', 'parametres.administrer'),
    ('ADMIN', 'plateforme.equipe'),
    ('ADMIN', 'plateforme.voir'),
    ('ADMIN', 'portefeuille.voir_tout'),
    ('ADMIN', 'prospects.convertir'),
    ('ADMIN', 'prospects.fusionner'),
    ('ADMIN', 'prospects.lire'),
    ('ADMIN', 'prospects.reaffecter'),
    ('ADMIN', 'prospects.reaffecter_tout'),
    ('ADMIN', 'prospects.revoir'),
    ('ADMIN', 'prospects.superviser'),
    ('ADMIN', 'qualification.rappels'),
    ('ADMIN', 'referentiels.superviser'),
    ('ADMIN', 'roles.administrer'),
    ('ADMIN', 'ventes.lire'),
    ('BANQUE_FINANCE', 'banque.dossiers'),
    ('BANQUE_FINANCE', 'banque.lire'),
    ('BANQUE_FINANCE', 'campagnes.attributions_toutes'),
    ('BANQUE_FINANCE', 'exports.banque'),
    ('BANQUE_FINANCE', 'panneau.acceder'),
    ('CCP', 'exports.prospects'),
    ('CCP', 'fiches.tenir'),
    ('CCP', 'panneau.acceder'),
    ('CCP', 'plateforme.equipe'),
    ('CCP', 'plateforme.saisir'),
    ('CCP', 'prospects.lire'),
    ('CCP', 'qualification.rappels'),
    ('CHARGE_CLIENTELE', 'exports.prospects'),
    ('CHARGE_CLIENTELE', 'fiches.tenir'),
    ('CHARGE_CLIENTELE', 'fiches.voir_converties'),
    ('CHARGE_CLIENTELE', 'panneau.acceder'),
    ('CHARGE_CLIENTELE', 'prospects.convertir'),
    ('CHARGE_CLIENTELE', 'prospects.fusionner'),
    ('CHARGE_CLIENTELE', 'prospects.lire'),
    ('CHARGE_CLIENTELE', 'prospects.reaffecter'),
    ('CHARGE_CLIENTELE', 'prospects.revoir'),
    ('CHARGE_CLIENTELE', 'qualification.rappels'),
    ('COMMERCIAL', 'exports.prospects'),
    ('COMMERCIAL', 'fiches.tenir'),
    ('COMMERCIAL', 'panneau.acceder'),
    ('COMMERCIAL', 'prospects.convertir'),
    ('COMMERCIAL', 'prospects.fusionner'),
    ('COMMERCIAL', 'prospects.lire'),
    ('COMMERCIAL', 'prospects.reaffecter'),
    ('COMMERCIAL', 'qualification.rappels'),
    ('DIRECTION', 'accueil.listes'),
    ('DIRECTION', 'accueil.registre'),
    ('DIRECTION', 'analytics.superviser'),
    ('DIRECTION', 'banque.lire'),
    ('DIRECTION', 'campagnes.attributions_toutes'),
    ('DIRECTION', 'campagnes.superviser'),
    ('DIRECTION', 'chiffres.disposer'),
    ('DIRECTION', 'chiffres.voir_montants'),
    ('DIRECTION', 'comptes.lister'),
    ('DIRECTION', 'exports.globaux'),
    ('DIRECTION', 'exports.prospects'),
    ('DIRECTION', 'exports.voir_tout'),
    ('DIRECTION', 'fiches.modifier_toutes'),
    ('DIRECTION', 'fiches.tenir'),
    ('DIRECTION', 'panneau.acceder'),
    ('DIRECTION', 'plateforme.equipe'),
    ('DIRECTION', 'plateforme.voir'),
    ('DIRECTION', 'portefeuille.voir_tout'),
    ('DIRECTION', 'prospects.lire'),
    ('DIRECTION', 'prospects.superviser'),
    ('DIRECTION', 'referentiels.superviser'),
    ('DIRECTION', 'ventes.lire'),
    ('DIRECTION', 'visites.detruire'),
    ('DIRECTION', 'visites.voir_archivees'),
    ('SUPERVISEUR', 'analytics.superviser'),
    ('SUPERVISEUR', 'banque.lire'),
    ('SUPERVISEUR', 'campagnes.attributions_toutes'),
    ('SUPERVISEUR', 'campagnes.gerer'),
    ('SUPERVISEUR', 'campagnes.superviser'),
    ('SUPERVISEUR', 'chiffres.disposer'),
    ('SUPERVISEUR', 'comptes.lister'),
    ('SUPERVISEUR', 'exports.banque'),
    ('SUPERVISEUR', 'exports.globaux'),
    ('SUPERVISEUR', 'exports.prospects'),
    ('SUPERVISEUR', 'exports.voir_tout'),
    ('SUPERVISEUR', 'fiches.modifier_toutes'),
    ('SUPERVISEUR', 'fiches.tenir'),
    ('SUPERVISEUR', 'panneau.acceder'),
    ('SUPERVISEUR', 'plateforme.equipe'),
    ('SUPERVISEUR', 'plateforme.voir'),
    ('SUPERVISEUR', 'portefeuille.voir_tout'),
    ('SUPERVISEUR', 'prospects.convertir'),
    ('SUPERVISEUR', 'prospects.lire'),
    ('SUPERVISEUR', 'prospects.reaffecter'),
    ('SUPERVISEUR', 'prospects.reaffecter_tout'),
    ('SUPERVISEUR', 'prospects.revoir'),
    ('SUPERVISEUR', 'prospects.superviser'),
    ('SUPERVISEUR', 'referentiels.superviser');

ALTER TABLE public.users ADD COLUMN "roleId" text REFERENCES public.roles ("id");
ALTER TABLE public.users DISABLE TRIGGER set_updated_at;
UPDATE public.users SET "roleId" = "role"::text;
ALTER TABLE public.users ENABLE TRIGGER set_updated_at;
ALTER TABLE public.users ALTER COLUMN "roleId" SET NOT NULL;
CREATE INDEX "users_roleId_idx" ON public.users ("roleId");

-- `role` suit toujours le rôle de base de `roleId`, quel que soit le chemin
-- d'écriture : un INSERT qui ne donne que `role` reçoit le rôle système du même code.
-- +goose StatementBegin
CREATE FUNCTION public.users_role_de_base() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."role" IS DISTINCT FROM OLD."role" AND NEW."roleId" IS NOT DISTINCT FROM OLD."roleId" THEN
    NEW."roleId" := NEW."role"::text;
  END IF;
  NEW."roleId" := COALESCE(NEW."roleId", NEW."role"::text);
  NEW."role" := (SELECT r."roleDeBase" FROM public.roles r WHERE r."id" = NEW."roleId");
  RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER users_role_de_base BEFORE INSERT OR UPDATE OF "role", "roleId" ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.users_role_de_base();

-- +goose Down
DROP TRIGGER users_role_de_base ON public.users;
DROP FUNCTION public.users_role_de_base();
ALTER TABLE public.users DROP COLUMN "roleId";
DROP TABLE public.role_permissions;
DROP TABLE public.roles;
