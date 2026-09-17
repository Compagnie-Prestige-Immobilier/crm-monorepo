# RBAC : rôles personnalisés et permissions, éditables dans « Utilisateurs et rôles »

Révisé le 16 septembre 2026 sur deux décisions du propriétaire : les rôles
personnalisés sont retenus (D1), l'onglet « Utilisateurs » est réécrit (phase 5).

Plan d'exécution, écrit le 16 septembre 2026 après cinq audits en lecture seule
(points de décision Go, panneau web, base, preuves, conception). Il s'adresse
à un agent qui exécute une phase à la fois, sans contexte préalable. Chaque
phase est livrable seule, laisse le produit strictement identique pour les
utilisateurs jusqu'à la phase 5, et se termine par les mêmes commandes de
preuve. Un agent qui saute une étape « casser le test » n'a pas fini la phase.

## 0. Décisions arrêtées

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                                      | Raison                                                                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Rôles personnalisés : table `roles`. Les huit rôles actuels y sont des rôles système (`id` = code, ni supprimables ni renommables). Un ADMIN crée un rôle avec un libellé, un **rôle de base** choisi parmi les huit, et ses permissions. Chaque compte porte `users."roleId"` (son rôle, qui donne les permissions) et garde `users.role` (enum, toujours égal au rôle de base de son rôle). | Le rôle est une donnée dans 26 endroits (audiences de notification, journal d'audit, plan de purge, routage CCP, profils de démonstration, cohortes des rapports, page d'accueil). Le rôle de base les alimente sans en toucher un seul : un « Chef d'équipe » de base SUPERVISEUR reçoit les notifications des superviseurs et arrive sur leur page. |
| D2  | Les permissions sont un catalogue fermé dans le code Go (`internal/shared/socle/permissions.go`), constantes typées, une par action métier.                                                                                                                                                                                                                                                   | Une permission gouverne une route ou un prédicat de portée : c'est du code. Un catalogue en base ne peut pas être vérifié au démarrage ni par le compilateur.                                                                                                                                                                                         |
| D3  | L'attribution rôle → permissions vit en base (`role_permissions`, clé `roleId`), semée par migration avec la matrice actuelle à l'identique pour les huit rôles système, modifiable par un ADMIN dans l'écran « Utilisateurs et rôles », chargée en mémoire et rechargée après chaque écriture.                                                                                               | Un seul processus en production : pas de Redis, pas de TTL, pas de bus. Le changement prend effet à la requête suivante.                                                                                                                                                                                                                              |
| D4  | Ce qui n'est pas une permission ne le devient pas : les règles d'identité pure (verrou d'ouverture de fiche, auteur d'un commentaire, rappel en attente qui donne accès, détenteur d'un doublon), les transitions de statut, et tout usage du rôle comme donnée.                                                                                                                              | Ces règles dépendent de la ligne, pas du rôle. Les convertir est la première source de bug relevée par l'audit.                                                                                                                                                                                                                                       |
| D5  | Le contrat v1 reste compatible : `role` (rôle de base) reste dans `AuthUserDto` et `UserDto`, on AJOUTE `roleId`, `roleLibelle` et, sur la session, `permissions: string[]`. `CreateUserDto` et `UpdateUserDto` acceptent `roleId` ; `role` seul reste accepté et vaut le rôle système du même code. Les nouveaux endpoints sont additifs.                                                    | Le contrat est figé depuis le 10 septembre ; un ajout de champ ne casse aucun client.                                                                                                                                                                                                                                                                 |
| D6  | Invariant serveur : le rôle `ADMIN` conserve toujours `comptes.administrer` et `roles.administrer`. Toute écriture qui les retirerait est refusée (`ROLE_ADMIN_VERROUILLE`).                                                                                                                                                                                                                  | Miroir de la règle « dernier admin actif » (`internal/admin/admin.go:390-407`). Un ADMIN ne peut pas se couper l'accès à l'écran qui répare.                                                                                                                                                                                                          |
| D7  | Preuve de non-régression : la matrice route × rôles du binaire AVANT migration est gelée dans un fichier de test, et un test d'intégration exige que la matrice calculée par le modèle à permissions lui soit identique, entrée par entrée.                                                                                                                                                   | C'est la seule preuve qui ne dépend pas de la lecture d'un humain.                                                                                                                                                                                                                                                                                    |
| D8  | L'URL `/admin/commerciaux` ne change pas. Le libellé devient « Utilisateurs et rôles ». Deux onglets : « Utilisateurs » (réécrit), « Rôles ».                                                                                                                                                                                                                                                 | Les liens enregistrés et `moved-routes.ts` restent valides.                                                                                                                                                                                                                                                                                           |

| D9 | Un rôle personnalisé ne se supprime que s'il n'a aucun compte, actif ou non (409 `ROLE_UTILISE`). Changer le rôle de base d'un rôle qui a des comptes est refusé (409 `ROLE_DE_BASE_FIGE`). | Changer le rôle de base déplacerait des comptes entre cohortes, audiences et files CCP sans que personne ne le voie. Pour le faire : créer un nouveau rôle et y passer les comptes un par un, chaque passage audité. |
| D10 | `users.role` n'a qu'un chemin d'écriture : la création et la modification de compte, qui l'écrivent depuis `roles."roleDeBase"` dans la même transaction que `roleId`. | Les deux colonnes ne peuvent pas diverger si une seule requête les écrit. Un test d'intégration le vérifie sur toute la table. |

Ce que D1 implique et qu'il faut dire aux ADMIN, dans l'écran : un rôle
personnalisé hérite de TOUT ce que son rôle de base porte comme donnée
(notifications par rôle, page d'accueil, files de rappels plateforme si la
base est CCP, rapports quotidiens, compteurs de comptes par rôle). Ses
permissions, elles, sont les siennes. Un rôle de base COMMERCIAL avec la
permission `plateforme.saisir` peut saisir sur une fiche plateforme, mais
aucun rappel plateforme ne lui est routé : la file suit la base CCP.

Idées différées, à ne pas coder : permissions par utilisateur en plus du rôle ;
historique consultable des matrices (le journal d'audit suffit) ; rôle sans
rôle de base.

## 1. Modèle

### 1.1 Catalogue des permissions

Fichier : `internal/shared/socle/permissions.go` (nouveau, environ 220 lignes,
zéro logique, que des données).

```go
type Permission string

type definitionPermission struct {
	Domaine string   // groupe d'affichage dans l'écran, en français
	Libelle string   // une ligne, affichée telle quelle
	Defaut  []Role   // matrice au 16 septembre 2026, ne bouge JAMAIS après la phase 1
}

var Catalogue = map[Permission]definitionPermission{ ... }
```

Règles de nommage, à appliquer sans exception :

1. `domaine.action`, minuscules, sans accent, verbe à l'infinitif ou nom
   d'objet : `fiches.tenir`, `campagnes.gerer`, `banque.dossiers`.
2. Une permission par ensemble de rôles DISTINCT réellement utilisé dans un
   domaine. Deux routes du même paquet Go avec le même ensemble de rôles
   partagent la permission. Deux paquets différents avec le même ensemble
   ont chacun la leur (l'écran groupe par domaine).
3. Jamais élargir ni restreindre un ensemble pour « faire rentrer » une route
   dans une permission existante. Si l'ensemble n'existe pas encore, on crée
   la permission. Le test de la phase 1 refuse tout écart.
4. Le libellé dit ce que la personne peut faire, pas le nom de la route :
   « Lire et modifier les fiches de son portefeuille », pas « GET prospects ».

Catalogue de départ, dérivé des 215 entrées de garde (17 cartes, 23 ensembles
distincts) et des 37 prédicats de portée. L'agent de la phase 1 complète la
colonne « routes » en lisant chaque carte `Garde` ; il ne modifie pas la
colonne « rôles par défaut ».

| Permission                           | Rôles par défaut                                                 | Remplace                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `panneau.acceder`                    | les 8                                                            | `socle.Tous` (16 routes : déconnexion, `/auth/me`, live, notifications personnelles)                                                                                                                                                                                                                                                                 |
| `fiches.tenir`                       | ADMIN, COMMERCIAL, CHARGE_CLIENTELE, CCP, SUPERVISEUR, DIRECTION | `socle.Parcours` (36 routes) et `prospectLecture` (5 routes, même ensemble)                                                                                                                                                                                                                                                                          |
| `<domaine>.superviser`               | ADMIN, SUPERVISEUR, DIRECTION                                    | `socle.Encadrement` (31 routes), une permission par paquet : `campagnes.superviser`, `analytics.superviser`, `qualification.superviser`, `imports.superviser`, `referentiels.superviser`, `prospects.superviser`…                                                                                                                                    |
| `<domaine>.administrer`              | ADMIN                                                            | `socle.AdminSeul` (60 routes), une permission par paquet : `comptes.administrer`, `roles.administrer` (nouvelle), `referentiels.administrer`, `imports.administrer`, `exploitation.administrer`, `courriels.administrer`, `enrolement.administrer`, `notifications.administrer`, `banque.administrer`, `parametres.administrer`, `bases.administrer` |
| `banque.dossiers`                    | ADMIN, BANQUE_FINANCE                                            | `socle.Banque` (15 routes)                                                                                                                                                                                                                                                                                                                           |
| `banque.lire`                        | ADMIN, BANQUE_FINANCE, SUPERVISEUR, DIRECTION                    | `socle.BanqueLecture` (3 routes)                                                                                                                                                                                                                                                                                                                     |
| `accueil.registre`                   | ADMIN, DIRECTION, ACCUEIL                                        | `socle.Registre` (7 routes)                                                                                                                                                                                                                                                                                                                          |
| `accueil.listes`                     | ADMIN, DIRECTION                                                 | `listesVisiteEcriture` (5 routes) et les 5 routes `{Admin, Direction}` du même paquet                                                                                                                                                                                                                                                                |
| `campagnes.gerer`                    | ADMIN, SUPERVISEUR                                               | `campagnesEcriture` (7 routes)                                                                                                                                                                                                                                                                                                                       |
| `chiffres.disposer`                  | ADMIN, DIRECTION, SUPERVISEUR, ACCUEIL                           | `rolesChiffres` (3 routes)                                                                                                                                                                                                                                                                                                                           |
| dix permissions nommées à la phase 1 | l'ensemble exact de chaque route                                 | les 10 ensembles « à la pièce » (`{Admin, Commercial, ChargeClientele, CCP}`, `{Admin, BanqueFinance, Superviseur}`, `{Direction}`…)                                                                                                                                                                                                                 |
| `portefeuille.voir_tout`             | ADMIN, SUPERVISEUR, DIRECTION                                    | `representantLitTout` (`representants.go:228`), `qualificationVoitTout` (`qualification.go:126`), `litToutLeTravail` (`analytics.go:50`), `exports.go:412`                                                                                                                                                                                           |
| `plateforme.voir`                    | ADMIN, SUPERVISEUR, DIRECTION                                    | branche `nil` de `PorteePlateforme` (`roles.go:66`)                                                                                                                                                                                                                                                                                                  |
| `plateforme.saisir`                  | CCP                                                              | `PorteeSaisiePlateforme` (`roles.go:78`), `qualificationTientLaPlateforme` (`qualification.go:131`), et chaque `\|\| u.Role == socle.CCP` (`prospects.go:352`, `qualification.go:1003`, `qualification_annuaire.go:87`, `qualification_ouvertures.go:128,347`, `exports_prospects.go:61`)                                                            |
| `fiches.voir_converties`             | CHARGE_CLIENTELE                                                 | `prospects.go:353`, `qualification_annuaire.go:89`, `qualification_ouvertures.go:348`, `exports_prospects.go:66`                                                                                                                                                                                                                                     |
| `fiches.ignorer_propriete`           | ADMIN                                                            | les `u.Role != socle.Admin && X.CreatedById != u.ID` et `AssignedToId` : `prospects.go:442,817,838,1020,1430,1434`, `representants.go:568,585,842,1335`, `qualification_ouvertures.go:177,203`                                                                                                                                                       |
| `fiches.forcer_transition`           | ADMIN                                                            | `prospects.go:1132`, `qualification_ouvertures.go:645`                                                                                                                                                                                                                                                                                               |
| `fiches.parametres_reserves`         | ADMIN                                                            | `prospects_conversion.go:845`                                                                                                                                                                                                                                                                                                                        |
| `donnees.voir_supprimees`            | ADMIN                                                            | `analytics.go:159`, `exports_prospects.go:180`                                                                                                                                                                                                                                                                                                       |
| `chiffres.voir_montants`             | ADMIN, DIRECTION                                                 | `admin.go:1238` et `web/src/components/chiffres/vue.tsx:366`                                                                                                                                                                                                                                                                                         |
| `visites.voir_archivees`             | DIRECTION                                                        | `accueil.go:276` (ADMIN exclu : ne pas « corriger »)                                                                                                                                                                                                                                                                                                 |
| `banque.voir_tous_portefeuilles`     | ADMIN                                                            | `banque.go:1080`                                                                                                                                                                                                                                                                                                                                     |
| `campagnes.attributions_toutes`      | ADMIN, SUPERVISEUR, DIRECTION, BANQUE_FINANCE, ACCUEIL           | `campagnes_attributions.go:84` (ensemble bizarre, mais c'est celui d'aujourd'hui)                                                                                                                                                                                                                                                                    |
| `exports.voir_tout`                  | ADMIN, SUPERVISEUR, DIRECTION                                    | `exports.go:418`, `exports_prospects.go:175`                                                                                                                                                                                                                                                                                                         |

`socle.Public` reste un marqueur de route publique, distinct du catalogue :
la valeur `Publique Permission = "publique"` n'apparaît dans aucun `Defaut`
et n'est jamais attribuable.

### 1.2 Ce qui reste hors permissions (interdit d'y toucher)

| Lieu                                                                                                                                                                                                                                      | Règle                                                  | Pourquoi elle reste                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `qualification_ouvertures.go:292,328,463`                                                                                                                                                                                                 | verrou d'ouverture : identité seule, ADMIN compris     | invariant de concurrence, pas un droit                                    |
| `representants.go:1263`                                                                                                                                                                                                                   | modifier un commentaire : son auteur seul              | signature                                                                 |
| `qualification.go:1003`, `ProspectAttribue`                                                                                                                                                                                               | un rappel PENDING donne accès à la fiche               | grant temporaire lié à la ligne                                           |
| `prospects.go:411-431`                                                                                                                                                                                                                    | 404 contre 403 par seconde requête                     | oracle d'énumération                                                      |
| `prospects.go:817`, `representants.go:585`                                                                                                                                                                                                | forme du 409 selon le détenteur du doublon             | divulgation de champ                                                      |
| `prospects.go:1131-1145`, `qualification_ouvertures.go:636`                                                                                                                                                                               | tables de transitions                                  | logique métier ; seul le contournement devient `fiches.forcer_transition` |
| `sql/queries/prospects.sql:55-73`, `plateforme.sql`, `campagnes.sql`                                                                                                                                                                      | disjonctions par propriétaire, lot, `pausedAt`, statut | déjà en SQL, alimentées par des booléens calculés en Go                   |
| `exports_prospects.go:56-70`                                                                                                                                                                                                              | portée d'export plus large que la liste                | divergence CONNUE, à signaler au propriétaire, pas à réconcilier ici      |
| Classe C : `auth.go:74-83`, `notifications*.go`, `admin.go:390-407,452-459,555-557,685-690,800-804`, `campagnes.go:396`, `sql/queries/notifications.sql`, `plateforme.sql`, `imports.sql:26`, `exploitation.sql:180`, `exports.sql:155`   | rôle comme donnée                                      | D1                                                                        |
| Web classe 5 : `dev-role-switcher.tsx`, `login-form.tsx`, `user-form-dialog.tsx`, `commerciaux-view.tsx` (filtre et badge), `notification-composer.tsx`, `audience.ts`, `journal-libelles.ts`, `lot-create-dialog.tsx`, `user-filters.ts` | rôle affiché ou saisi                                  | D1                                                                        |

### 1.3 Chargement et évaluation

`internal/shared/socle/permissions.go` porte aussi :

```go
var attributions atomic.Pointer[map[string]map[Permission]bool]     // clé : roleId

func ChargerAttributions(ctx context.Context, q *db.Queries) error   // lit role_permissions, ignore et journalise (slog.Warn) toute permission inconnue du catalogue
func AttributionsParDefaut() map[string]map[Permission]bool          // huit rôles système, depuis Catalogue[*].Defaut ; utilisé par -roles et par les tests
func (u Utilisateur) Peut(p Permission) bool                          // attributions[u.RoleID][p], lecture atomique, O(1)
func RolesAutorises(p Permission) []Role                              // pour -roles : rôles système seulement
```

`socle.Utilisateur` gagne `RoleID string` et `RoleLibelle string`, lus par
la même requête de session que `Role` (jointure `users` → `roles`). `Role`
reste le rôle de base et garde tous ses usages de donnée.

`socle.Garde` devient `map[string]Permission`. `GarderAcces` lit
`Garde[motif]`, puis `u.Peut(p)`. `VerifierGarde` garde ses deux contrôles
(route sans entrée, entrée sans route) et en gagne deux : permission de garde
absente du catalogue ; permission du catalogue jamais référencée par une
route ni par un prédicat (liste des prédicats déclarée dans le même fichier,
`permissionsDePortee`). Les quatre arrêtent le démarrage.

Le drapeau `cpi-go -roles` imprime la matrice `route → rôles` calculée depuis
`AttributionsParDefaut()`, dans le même format JSON qu'aujourd'hui (clé
`"METHODE /chemin"`, valeur tableau de rôles, `PUBLIC` conservé). Ainsi
`e2e/roles.spec.ts` et `e2e/global-setup.ts` ne changent pas d'une ligne.

### 1.4 Base

Migration `sql/migrations/<horodatage>_role_permissions.sql` :

```sql
-- +goose Up
CREATE TABLE public.roles (
    id text NOT NULL PRIMARY KEY,
    libelle text NOT NULL,
    "roleDeBase" public."Role" NOT NULL,
    systeme boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT roles_systeme_id CHECK (NOT systeme OR id = "roleDeBase"::text)
);
CREATE UNIQUE INDEX roles_libelle_key ON public.roles (lower(libelle));
INSERT INTO public.roles (id, libelle, "roleDeBase", systeme, "updatedAt") VALUES
    ('ADMIN', 'Administrateur', 'ADMIN', true, now()), ...  -- les huit, libellés de ROLE_LABELS
;
CREATE TABLE public.role_permissions (
    "roleId" text NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
    permission text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY ("roleId", permission)
);
INSERT INTO public.role_permissions ("roleId", permission) VALUES
    ('ADMIN', 'panneau.acceder'), ...   -- généré une fois, voir phase 3
;
ALTER TABLE public.users ADD COLUMN "roleId" text REFERENCES public.roles (id);
UPDATE public.users SET "roleId" = role::text;
ALTER TABLE public.users ALTER COLUMN "roleId" SET NOT NULL;
CREATE INDEX "users_roleId_idx" ON public.users ("roleId");
-- +goose Down
ALTER TABLE public.users DROP COLUMN "roleId";
DROP TABLE public.role_permissions;
DROP TABLE public.roles;
```

Le `ON DELETE CASCADE` ne vaut que pour `role_permissions`. La clé de
`users."roleId"` n'en a pas : supprimer un rôle qui porte un compte échoue en
base, en plus du 409 de D9.

Requêtes `sql/queries/roles.sql` : `ListRoles` (avec `comptesActifs` et
`comptes` par sous-requête), `ListRolePermissions`, `InsertRole`,
`UpdateRoleLibelle`, `UpdateRoleDeBase` (refusée par D9 avant l'appel),
`DeleteRole`, `DeleteRolePermissions`, `InsertRolePermission`. Toutes les
écritures passent par une transaction qui écrit aussi le journal d'audit.
`sql/queries/admin.sql` : `InsertUser` et `UpdateUser` prennent `roleId` et
écrivent `role` par `(SELECT "roleDeBase" FROM roles WHERE id = @role_id)`
(D10). La requête de session lit `roleId` et `roles.libelle`. Le
`sql/schema.sql` reçoit les deux tables au même endroit que les autres
(ordre alphabétique) et la colonne `users."roleId"`.

### 1.5 API

Routes dans `internal/admin/admin_roles.go` (nouveau fichier, admin.go
approche du plafond). Toutes portent `roles.administrer` et écrivent le
journal d'audit (`role.create`, `role.update`, `role.delete`,
`role.permissions_change`, avant et après triés), puis `ChargerAttributions`.

| Route                       | Entrée                                                                                                                       | Refus                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/roles`        | `{ libelle, roleDeBase, permissions }` ; `permissions` absent = copie des permissions ACTUELLES du rôle système de même base | 409 `ROLE_LIBELLE_PRIS` (insensible à la casse) ; 422 `PERMISSION_INCONNUE` ; 422 si `roleDeBase` hors des huit                             |
| `PATCH /api/v1/roles/{id}`  | `{ libelle?, roleDeBase? }`                                                                                                  | 409 `ROLE_SYSTEME` pour tout changement d'un rôle système ; 409 `ROLE_DE_BASE_FIGE` si le rôle a des comptes (D9) ; 409 `ROLE_LIBELLE_PRIS` |
| `DELETE /api/v1/roles/{id}` | aucune                                                                                                                       | 409 `ROLE_SYSTEME` ; 409 `ROLE_UTILISE` avec le nombre de comptes (D9)                                                                      |

Et les deux routes de lecture et d'attribution :

| Route                                | Permission            | Corps                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/roles`                  | `comptes.administrer` | `{ roles: [{ id, libelle, roleDeBase, systeme, comptes, comptesActifs, permissions: [string] }], catalogue: [{ permission, domaine, libelle, parDefaut: [Role] }] }` ; lu aussi par l'onglet « Utilisateurs » pour le choix du rôle                                                                                     |
| `PUT /api/v1/roles/{id}/permissions` | `roles.administrer`   | entrée `{ permissions: [string] }`, sortie = l'objet rôle ; 422 `PERMISSION_INCONNUE` sur une permission hors catalogue ; 409 `ROLE_ADMIN_VERROUILLE` si `id = ADMIN` et `comptes.administrer` ou `roles.administrer` manque ; audit `role.permissions_change` avec `before`/`after` triés ; puis `ChargerAttributions` |

La lecture est gardée par `comptes.administrer` parce que l'onglet
« Utilisateurs » en a besoin pour proposer les rôles. Les écritures de rôles
exigent `roles.administrer`. L'onglet « Rôles » n'apparaît qu'avec
`roles.administrer`.

Invariant D6 élargi aux rôles personnalisés : au moins un compte actif doit
toujours porter un rôle qui a `roles.administrer`. Un `PUT` de permissions, un
changement de rôle de compte ou une désactivation qui violerait cet invariant
est refusé (409 `DERNIER_ADMINISTRATEUR_DES_ROLES`), sous le même verrou que
`LockActiveAdmins` (`sql/queries/admin.sql:49`).

Le `PUT` remplace l'ensemble : pas de PATCH par permission, pas de
« restaurer les défauts » côté serveur (l'écran envoie `parDefaut` comme
n'importe quel ensemble).

`AuthUserDto` (`internal/auth/auth.go` `CompteConnecte`) gagne
`Permissions []string` json `permissions`, trié, calculé à la réponse, plus
`roleId` et `roleLibelle`. `UserDto`, `CreateUserDto`, `UpdateUserDto` et
`SupervisedUserDto` gagnent `roleId` et `roleLibelle` (D5). Les profils de
démonstration (`internal/auth/auth.go:74-83`) restent indexés par rôle
système : ils n'ont pas à connaître les rôles personnalisés.

### 1.6 Web

- `web/src/lib/guard.ts` : `guardPermission(p: Permission)` qui lit
  `context.user.permissions`. `guardRoles` est supprimé à la fin de la
  phase 4 ; `RefusPermission` garde son nom et son rendu.
- `web/src/lib/types.ts` : `type Permission = Schemas['Permission']` ;
  `peut(user, p)` ; les aides `readsOnly`, `canExportProspects`,
  `peutTenirUneFiche`, `canExportRepresentants`, `peutRevoirUneDemande`
  sont réécrites sur `peut` avec la permission dont l'ensemble par défaut
  est identique à leur liste actuelle (vérifier la liste, pas le nom).
- `nav-items.ts` : `roles: Role[]` devient `permission: Permission` sur
  chaque entrée et chaque coque ; `INBOX_ROLES`, `TERRAIN`, `ENCADREMENT`
  disparaissent au profit de permissions ; `homePathForRole`,
  `coqueHomePath`, `ROLE_LABELS` restent (le rôle de base choisit la page
  d'accueil, c'est un usage du rôle comme donnée, D1). Partout où un libellé
  de rôle est AFFICHÉ pour un compte (menu utilisateur, liste des comptes,
  supervision, destinataires de notification), afficher `roleLibelle` et non
  `ROLE_LABELS[role]` ; `ROLE_LABELS` reste pour nommer un rôle de base.
  Une coque ou une entrée de navigation dont aucune permission n'est détenue
  disparaît : un rôle personnalisé sans aucune permission d'écran voit la page
  « Accès refusé » avec le lien de déconnexion, jamais une page blanche.
- 62 `beforeLoad: guardRoles([...])` et 8 redirections par rôle : la garde
  devient `guardPermission(...)` ; les redirections restent par rôle.
- 48 conditions d'interface et 17 filtres par rôle (classe 3 et 4 de
  l'inventaire) : chaque `role === 'X'` ou `['A','B'].includes(role)` devient
  `peut(user, permission)` avec la permission au même ensemble. Les
  incohérences actuelles (`canFilter` liste blanche sur un écran, liste noire
  `role !== 'COMMERCIAL'` sur trois autres) sont CONSERVÉES telles quelles :
  on choisit la permission qui reproduit l'ensemble de chaque écran, on
  signale l'incohérence en une ligne dans le rapport, on ne l'harmonise pas.
- Écran : voir phase 5.

## 2. Phases

Commandes de preuve communes, dans cet ordre, à la fin de CHAQUE phase.
Toutes doivent être vertes ; la première rouge arrête la phase.

```
rtk make lint
rtk make build
rtk make test                       # intégration Go contre Postgres
rtk pnpm typecheck
rtk pnpm plafonds
rtk pnpm complexite:go              # aucune nouvelle fonction au-dessus de 15
rtk pnpm --dir e2e test -- --workers=29   # binaire reconstruit avant (make e2e le fait)
```

Puis, sans exception, l'étape « casser » propre à la phase, avec le test
remis exactement comme avant. Un commit par phase, Conventional Commits, sans
mention d'assistant, en n'ajoutant que ses propres fichiers (`git add <fichiers>`,
jamais `git add .` ; d'autres sessions écrivent dans le même arbre). Vérifier
`git branch --show-current` avant de commettre : la branche de travail est `v3`.

### Phase 0 : geler la matrice actuelle

1. `rtk make build` sur l'arbre courant, sans aucune modification.
2. `./cpi-go -roles > cmd/server/testdata/matrice-roles-2026-09-16.json`.
3. Vérifier : 218 clés, chaque valeur un tableau non vide de rôles, présence
   de `"GET /api/v1/auth/me": ["ADMIN", ...]` et de `"GET /health/live": ["PUBLIC"]`.
4. Commit : `test(api): geler la matrice route x roles avant les permissions`.

Ce fichier est une donnée de test, pas un artefact de build : il n'est jamais
régénéré. Il justifie en une ligne, dans le message de commit, le dépassement
du principe « rien de généré » : c'est le comportement figé que la migration
doit préserver, et il ne peut être produit que par le binaire d'avant.

### Phase 1 : catalogue et gardes par permission, comportement identique

Fichiers : `internal/shared/socle/permissions.go` (nouveau),
`internal/shared/socle/roles.go`, `internal/shared/socle/middleware.go`,
`internal/shared/socle/live.go`, `cmd/server/main.go` (`ecrireRoles`),
`cmd/server/domaines.go`, `cmd/server/bases.go` (`GardeBases`), les 16 cartes
`Garde` des paquets `internal/*`, `cmd/server/roles_integration_test.go`
(nouveau).

Étapes :

1. Écrire le catalogue (§1.1). Pour chaque paquet, lire sa carte `Garde`
   ligne par ligne ; pour chaque entrée, trouver la permission dont `Defaut`
   est EXACTEMENT l'ensemble de rôles de l'entrée dans ce domaine ; sinon en
   créer une. Ne jamais toucher à un `Defaut` existant pour faire rentrer une
   route.
2. Remplacer chaque `map[string][]socle.Role{...}` par
   `map[string]socle.Permission{...}` ; les routes publiques prennent
   `socle.Publique`.
3. Dans `roles.go`, supprimer `Tous`, `Parcours`, `Encadrement`, `Registre`,
   `Banque`, `BanqueLecture`, `AdminSeul` seulement quand plus rien ne les
   référence (les prédicats de la phase 2 en utilisent encore certains : les
   laisser jusque-là). `Autorise` disparaît.
4. `GarderAcces` : `p, gardee := Garde[motif]` ; `publique := p == Publique` ;
   refus si `!u.Peut(p)`. Les sessions restent inchangées.
5. `VerifierGarde` : quatre contrôles (§1.3).
6. `ecrireRoles` imprime `RolesAutorises` pour chaque route, même format.
7. Tant qu'il n'y a pas de table (phase 3), `attributions` est initialisée
   depuis `AttributionsParDefaut()` au démarrage.
8. Test d'intégration `TestMatriceRolesInchangee` : charge
   `cmd/server/testdata/matrice-roles-2026-09-16.json`, calcule la matrice
   depuis `Garde` et `AttributionsParDefaut()`, compare clé par clé avec les
   tableaux triés ; le message d'échec nomme la route et les deux ensembles.
9. Test `TestCatalogueSansPermissionMorte` : appelle `VerifierGarde` sur
   l'API montée et vérifie l'absence d'erreur (les contrôles 3 et 4 sont
   ainsi exercés au moins une fois).

Casser : retirer `socle.Direction` du `Defaut` de `fiches.tenir` ;
`TestMatriceRolesInchangee` doit rougir sur au moins 36 routes ; remettre.
Puis ajouter au catalogue `test.inutile` sans route : `make build` puis
lancement doivent échouer sur « permission jamais référencée » ; retirer.

Commit : `feat(api): gardes de routes par permission, matrice de roles inchangee`.

### Phase 2 : prédicats de portée par permission

Fichiers : les 21 fichiers Go listés en §1.1 (colonne « Remplace »),
`internal/shared/socle/roles.go` (`PorteePlateforme`,
`PorteeSaisiePlateforme`), et les fichiers `cmd/server/*_integration_test.go`
des domaines touchés.

Étapes, dans cet ordre, sans inverser 1 et 2 :

1. AVANT toute conversion, ajouter dans les fonctions `Test*` existantes
   les dix assertions manquantes relevées par l'audit, et les voir vertes sur
   le code actuel :
   1. export prospects xlsx d'un téléconseiller : la fiche d'un collègue est
      absente du classeur ;
   2. export représentants xlsx : idem, assertion négative ;
   3. `includeDeleted=true` sur analytics et export : sans effet hors ADMIN ;
   4. visites archivées : 403 pour ACCUEIL et COMMERCIAL, 200 pour DIRECTION,
      403 pour ADMIN ;
   5. disposition du tableau de bord : widget montants absent hors
      ADMIN/DIRECTION ;
   6. report ou annulation du rappel d'un collègue : 403 `NOT_OWNER`, 200
      pour ADMIN, 403 pour SUPERVISEUR ;
   7. réaffectation avec `commercialId` par un non-ADMIN : 403 ;
   8. paramètre de conversion hors textes partagés par un non-ADMIN : 403
      `PARAMETRE_RESERVE_ADMIN` ;
   9. transition forcée vers `CONVERTI` par un non-ADMIN : refusée ;
   10. conflit téléphone (prospect et représentant) vu par un tiers : le
       corps ne contient que le nom du détenteur, jamais la fiche.
2. Convertir chaque site de la colonne « Remplace » en `u.Peut(...)` en
   respectant ces formes exactes :
   - `PorteePlateforme(u)` : `Peut(plateforme.voir)` → `nil` ; sinon
     `Peut(plateforme.saisir)` → `&vrai` ; sinon `&faux`. Le tri-état reste.
   - `PorteeSaisiePlateforme(u)` : `Peut(plateforme.saisir)` → `&vrai`,
     sinon `&faux`.
   - `voitTout || u.Role == CCP` devient
     `u.Peut(portefeuille.voir_tout) || u.Peut(plateforme.saisir)`.
   - `u.Role != Admin && X != u.ID` devient
     `!u.Peut(fiches.ignorer_propriete) && X != u.ID`.
   - Les fonctions nommées (`representantLitTout`, `qualificationVoitTout`,
     `litToutLeTravail`, `qualificationTientLaPlateforme`,
     `banquePortefeuilleDemandes`, `teleconseillerLisible`) gardent leur nom
     et leur signature ; seul leur corps change. La clé de cache
     `porteeDeCache` (`analytics.go`) doit rester la chaîne du rôle pour
     les détenteurs de `portefeuille.voir_tout` et l'identifiant sinon.
   - `campagnes_attributions.go:84` : `tout := u.Peut(campagnes.attributions_toutes)`.
3. Supprimer les groupes de `roles.go` devenus sans référence.
4. `grep -rn 'u.Role ==\|u.Role !=\|socle.Admin\b\|socle.Superviseur\b' internal | grep '\.go:' | grep -v _test`
   ne doit plus renvoyer que des sites de §1.2 (classe C). Coller la liste
   restante dans le rapport de phase.

Casser : dans le catalogue, retirer `CCP` de `plateforme.saisir` ;
`TestFichesPlateformeReserveesAuxCCP` doit rougir ; remettre. Retirer
`DIRECTION` de `visites.voir_archivees` ; l'assertion 4 doit rougir ; remettre.

Commit : `feat(api): portees de lecture et d'ecriture par permission`.

### Phase 3 : table, chargement, endpoints

Fichiers : migration (§1.4), `sql/schema.sql`, `sql/queries/roles.sql`,
`sql/queries/admin.sql` (`InsertUser`, `UpdateUser`, `LockActiveAdmins`),
la requête de session (`sql/queries/auth.sql`),
`internal/shared/socle/permissions.go` (`ChargerAttributions`),
`internal/shared/socle/session.go` (`RoleID`, `RoleLibelle`),
`cmd/server/main.go` (appel après les migrations, avant `serveur`),
`internal/admin/admin_roles.go` (nouveau), `internal/admin/admin.go`
(`Garde` : cinq entrées ; création et modification de compte par `roleId`),
`cmd/server/seed.go` (comptes semés avec `roleId` = leur rôle),
`cmd/server/roles_integration_test.go`.

Étapes :

1. Générer une seule fois le bloc `INSERT` : drapeau temporaire
   `-roles-sql` dans `main.go` qui imprime, depuis `AttributionsParDefaut()`,
   les lignes `('ROLE', 'permission')` triées par rôle puis permission.
   Coller dans la migration. Supprimer le drapeau dans le même commit ; il
   ne doit pas survivre.
2. `rtk make sqlc` (le paquet `db/` n'est pas versionné) ; `sqlc vet`.
3. `ChargerAttributions` au démarrage ; si la table est vide (base créée
   avant la migration sans la semence), échouer au démarrage avec un message
   qui nomme la migration : ne pas retomber silencieusement sur les défauts.
4. Endpoints (§1.5), invariant D6, audit, rechargement après écriture.
5. Tests :
   - `TestPermissionsSemeesIdentiquesAuCatalogue` : après migrations, le
     contenu de `role_permissions` égale `AttributionsParDefaut()`.
   - `TestRoleAdminVerrouille` : `PUT` sur ADMIN sans `roles.administrer`
     → 409, aucune ligne modifiée, aucun audit.
   - `TestPermissionInconnueRefusee` : 422, aucune ligne modifiée.
   - `TestChangementDePermissionImmediat` : retirer `campagnes.gerer` à
     SUPERVISEUR par `PUT`, puis `POST /api/v1/campagnes` en SUPERVISEUR
     → 403 dans la même seconde, sans redémarrage ni reconnexion ; remettre
     par `PUT` → 201. Le test remet la ligne en `defer`, sinon les tests
     parallèles du domaine campagnes échouent.
   - `TestAuditDesPermissions` : une ligne `role.permissions_change` avec
     `before` et `after` triés.
   - `TestRolePersonnalise` : créer « Chef d'équipe » de base SUPERVISEUR sans
     `campagnes.gerer`, y passer un compte ; ce compte reçoit 403 sur
     `POST /api/v1/campagnes`, 200 sur `GET /api/v1/campagnes`, et figure dans
     `SuperviseursActifs` (`sql/queries/notifications.sql:248`) : la permission
     suit le rôle, la donnée suit la base.
   - `TestRoleEtRoleDeBaseNeDivergentJamais` (D10) : après création, changement
     de rôle, et semis, `SELECT count(*) FROM users u JOIN roles r ON r.id =
u."roleId" WHERE u.role <> r."roleDeBase"` vaut 0.
   - `TestRoleUtiliseNonSupprimable` et `TestRoleDeBaseFige` (D9) : 409, rien
     d'écrit, aucun audit.
   - `TestRoleSystemeIntouchable` : `PATCH` et `DELETE` sur `SUPERVISEUR` → 409.
   - `TestDernierAdministrateurDesRoles` : deux transactions concurrentes qui
     retirent chacune `roles.administrer` au dernier rôle qui le porte encore ;
     une seule passe (même forme que `TestAdminDerniereRetrogradationSimultanee`,
     `cmd/server/admin_integration_test.go:142`).
   - `TestLibelleDeRoleUnique` : « chef d'équipe » après « Chef d'équipe » → 409.
6. `e2e/roles.spec.ts` reste vert sans modification : la base e2e est semée
   par la migration, `-roles` imprime les défauts, les deux coïncident. Si
   un test e2e antérieur a modifié une attribution sans la remettre, ce spec
   rougit : c'est voulu, corriger le test fautif.

Casser : dans la migration, retirer une ligne `('ACCUEIL', 'accueil.registre')` ;
`TestPermissionsSemeesIdentiquesAuCatalogue` doit rougir ; remettre. Dans
`UpdateUser`, écrire `role` depuis l'entrée au lieu de `roles."roleDeBase"` ;
`TestRoleEtRoleDeBaseNeDivergentJamais` doit rougir ; remettre. Retirer
`Peut` de `GarderAcces` au profit de `u.Role` ; `TestRolePersonnalise` doit
rougir ; remettre.

Commit : `feat(api): roles personnalises et permissions en base, modifiables`.

### Phase 4 : contrat et panneau sur les permissions

Fichiers : `web/contrat-v1.openapi.json` (minifié ; fusion à la main, ne
pas reformater : le fichier reste sur une ligne), `web/src/lib/types.ts`,
`web/src/lib/guard.ts`, `web/src/lib/data/auth.ts`,
`web/src/components/layout/nav-items.ts`, les 64 fichiers de routes, les
fichiers de classe 3 et 4 de l'inventaire, `web/src/lib/data/roles.ts`
(nouveau, 90 lignes : `useRoles`, `useCreerRole`, `useModifierRole`,
`useSupprimerRole`, `useReplacerPermissions`), `web/src/lib/data/users.ts`
(`roleId` dans les charges de création et de modification).

Étapes :

1. Contrat : `AuthUserDto.permissions` (tableau de `Permission`, requis),
   `roleId` et `roleLibelle` sur `AuthUserDto`, `UserDto`, `CreateUserDto`,
   `UpdateUserDto`, `SupervisedUserDto` ; schéma `Permission` (`type: string`,
   sans enum : le catalogue est côté serveur), schémas `RoleDto`,
   `PermissionDto`, `RolesOutput`, `CreateRoleInput`, `UpdateRoleInput`,
   `ReplacePermissionsInput`, les cinq chemins. Le build régénère
   `schema*.d.ts`, jamais commité.
2. `types.ts` : `Permission`, `peut`. Réécrire les cinq aides sur `peut`.
   `ROLE_LABELS` reste.
3. `guard.ts` : `guardPermission`. Puis, fichier par fichier, remplacer chaque
   `guardRoles([...])` par `guardPermission(<permission au même ensemble>)`.
   Tenir un tableau `fichier → liste de rôles → permission` dans le rapport
   de phase ; une permission dont le `Defaut` diffère de la liste du fichier
   est une erreur, pas une approximation.
4. `nav-items.ts` : `permission:` par entrée et par coque (§1.6).
5. Classes 3 et 4 : même conversion, mêmes règles, incohérences conservées.
6. `guardRoles` supprimé ; `rtk pnpm dead-code` ne doit rien signaler de
   nouveau.
7. `grep -rn "role ===\|role !==\|includes(.*role" web/src | grep -v routeTree`
   ne doit plus renvoyer que : redirections d'accueil, `dev-role-switcher`,
   `login-form`, `user-form-dialog`, `commerciaux-view` (filtre, badge),
   `notification-composer`, `audience.ts`, `journal-libelles.ts`,
   `lot-create-dialog.tsx`, `user-filters.ts`, `delete-users-dialog.tsx`
   (dernier COMMERCIAL), `admin_supervision` côté web (`pilotage/onglets.tsx`
   si c'est une partition d'affichage). Coller la liste dans le rapport.

Preuve spécifique : les parcours Playwright existants passent sans
modification (`administration`, `plateforme`, `leads-importes`,
`recherche-globale`, `roles`) ; ils exercent nav, gardes et redirections
pour six rôles. Casser : dans `nav-items.ts`, mettre `permission:
'banque.dossiers'` sur l'entrée « Représentants » ; `listes-et-fiches.spec.ts`
ou `qualification-representants.spec.ts` doit rougir ; remettre.

Commit : `feat(web): gardes, navigation et conditions d'ecran par permission`.

### Phase 5 : écran « Utilisateurs et rôles »

Fichiers : `web/src/routes/_panneau/admin/commerciaux.tsx`,
`web/src/components/commerciaux/utilisateurs-et-roles.tsx` (nouveau, coque à
deux onglets, moins de 120 lignes), `web/src/components/commerciaux/roles-view.tsx`
(nouveau, moins de 300 lignes), `web/src/components/commerciaux/role-dialog.tsx`
(nouveau, création et renommage, moins de 200 lignes),
`web/src/components/commerciaux/commerciaux-view.tsx` (réécrit, moins de 300
lignes), `web/src/components/commerciaux/user-form-dialog.tsx` (réécrit, moins
de 250 lignes), `web/src/components/ui/switch.tsx` (nouveau,
copié depuis le registre shadcn dans sa variante Base UI, la primitive de
`web/src/components/ui/tabs.tsx` est `@base-ui/react`), `nav-items.ts`
(libellé), `e2e/roles-ecran.spec.ts` (nouveau,
un parcours).

Contraintes d'interface, non négociables :

- Composants existants uniquement : `tabs`, `table`, `sortable-table-head`,
  `tri-local`, `badge`, `button`, `input`, `select`, `dropdown-menu`,
  `confirm-dialog`, `dialog`, `sheet`, `skeleton`, `sonner`, plus le
  `switch` ajouté. Aucun style ad hoc, aucune grille de cartes, aucune icône
  hors la famille déjà utilisée dans `web/src/components/layout`.
- Vocabulaire figé : `teleconseiller`, jamais « commercial » dans une chaîne
  affichée. Le libellé du rôle `COMMERCIAL` vient de `ROLE_LABELS`.
- Texte sobre : un état vide dit quoi faire ; une erreur dit ce qui s'est
  passé et quoi faire ; aucun texte de réassurance.
- Clavier et lecteur d'écran : chaque interrupteur a un `aria-label`
  « <libellé de la permission> pour <libellé du rôle> » ; les onglets sont
  ceux du composant `tabs` (rôles ARIA fournis) ; le focus revient sur le
  bouton « Enregistrer » après le toast.
- Aucun `localStorage`, aucun brouillon local.

Onglet « Utilisateurs » : réécriture complète de `commerciaux-view.tsx` et
`user-form-dialog.tsx`. Avant d'écrire, l'agent relit les deux fichiers et
liste dans son rapport chaque action existante (création, modification,
réinitialisation du mot de passe, désactivation, suppression unitaire et
groupée, reprise du portefeuille par un téléconseiller) : aucune ne disparaît.

- En-tête : titre « Utilisateurs », compteur de comptes actifs, bouton
  « Nouveau compte ».
- Barre de filtres, reflétée dans l'URL par `user-filters.ts` comme
  aujourd'hui : recherche (nom, identifiant, courriel, téléphone), rôle (liste
  des rôles de `GET /api/v1/roles`, groupée « Rôles système » puis « Rôles
  personnalisés »), état (actifs par défaut, inactifs, tous). Un bouton
  « Effacer les filtres » n'apparaît que si un filtre est posé.
- Tableau (`table`, `sortable-table-head`, `tri-local`) : case de sélection,
  nom et identifiant sur deux lignes, courriel, rôle (`badge` au libellé du
  rôle ; pour un rôle personnalisé, le rôle de base en texte secondaire
  « base : Superviseur »), état (`badge`), dernière connexion en date
  relative avec la date exacte en `title`, menu d'actions (`dropdown-menu` :
  modifier, réinitialiser le mot de passe, désactiver ou réactiver,
  supprimer). Le compte courant n'a ni « désactiver » ni « supprimer ».
- Sélection multiple : une barre apparaît au-dessus du tableau avec
  « Désactiver » et « Supprimer », qui ouvrent les dialogues existants
  `deactivate-user-dialog.tsx` et `delete-users-dialog.tsx`, réutilisés.
- États : chargement par `skeleton` de la forme du tableau ; liste vide sans
  filtre « Aucun compte. Créez le premier avec Nouveau compte. » ; liste vide
  avec filtres « Aucun compte ne correspond. » avec « Effacer les filtres » ;
  erreur de chargement « La liste des comptes n'a pas pu être chargée. » avec
  « Réessayer ».
- Téléphone (400 px) : le tableau devient une liste, une ligne par compte :
  nom, badge de rôle, état ; le menu d'actions reste à droite ; les filtres
  passent dans un `sheet` ouvert par un bouton « Filtres » qui affiche le
  nombre de filtres actifs.
- `user-form-dialog.tsx` réécrit : nom complet, identifiant, courriel,
  téléphone (format E.164 comme aujourd'hui), rôle (`select` sur les rôles de
  l'API, même groupement, chaque option montre son libellé ; sous le champ, en
  texte d'aide, le rôle de base du rôle choisi quand il est personnalisé),
  mot de passe initial à la création seulement. Validation par le schéma zod
  existant, messages sous chaque champ. Changer le rôle de son propre compte
  demande confirmation. La réponse 409 `DERNIER_ADMINISTRATEUR_DES_ROLES`
  s'affiche sous le champ rôle : « Ce compte est le dernier à pouvoir
  administrer les rôles. »
- `password-dialog.tsx`, `deactivate-user-dialog.tsx` et
  `delete-users-dialog.tsx` sont réutilisés ; seul le test « dernier
  téléconseiller actif » de `delete-users-dialog.tsx` passe du libellé au
  rôle de base.

Onglet « Rôles » (`roles-view.tsx`, visible avec `roles.administrer`) :

- Colonne gauche : les rôles en deux groupes, « Rôles système » puis « Rôles
  personnalisés », chacun avec libellé et nombre de comptes actifs ; le rôle
  sélectionné est surligné et reflété dans l'URL (`?role=`). Sous la liste,
  bouton « Nouveau rôle ». `ADMIN` porte un `badge` « verrouillé » avec le
  texte d'aide « Garde toujours l'administration des comptes et des rôles ».
- En tête de la colonne droite, pour un rôle personnalisé : libellé, « Rôle de
  base : Superviseur », et un `dropdown-menu` avec « Renommer », « Changer le
  rôle de base » (désactivé avec la raison en `title` s'il a des comptes) et
  « Supprimer » (désactivé avec « Retirez d'abord les N comptes » s'il en a).
  Suppression par `confirm-dialog`. Pour un rôle système : libellé et badge
  « système », pas de menu.
- Texte d'aide fixe sous l'en-tête d'un rôle personnalisé, une phrase : « Les
  notifications, la page d'accueil et les files de rappels suivent le rôle de
  base. »
- `role-dialog.tsx` : libellé, rôle de base (`select` des huit, libellés
  `ROLE_LABELS`), et à la création « Partir des permissions de » (le rôle de
  base, par défaut ; ou n'importe quel rôle existant ; ou « Aucune »). 409
  `ROLE_LIBELLE_PRIS` sous le champ libellé : « Un rôle porte déjà ce nom. »
  Après création, le nouveau rôle est sélectionné.
- Colonne droite : les permissions du catalogue groupées par `domaine`, une
  ligne par permission : `switch`, libellé, et, pour un rôle système
  seulement, un `badge` discret « modifié » quand la valeur diffère de
  `parDefaut` (dans un sens ou dans l'autre). Pour un rôle personnalisé,
  « Rétablir » repart des permissions par défaut de son rôle de base.
  Les deux interrupteurs verrouillés de `ADMIN` sont `disabled` avec le même
  `aria-label` suivi de « (verrouillé) ».
- Barre d'actions collante en bas : « Rétablir les valeurs par défaut »
  (renvoie `parDefaut`, sans confirmation : c'est un état de formulaire,
  rien n'est envoyé), « Annuler » (revient au dernier état chargé),
  « Enregistrer » (désactivé sans changement). Enregistrer sur son propre
  rôle demande confirmation (`confirm-dialog`) : « Vous modifiez votre propre
  rôle. Les accès changent dès la prochaine action. »
- Après enregistrement : toast « Permissions de <rôle> enregistrées »,
  `invalidateQueries` sur `roles` ET sur `auth/me` (l'utilisateur courant
  peut avoir perdu un accès : nav et gardes se recalculent).
- Erreurs : 409 → message « Le rôle ADMIN garde l'administration des comptes
  et des rôles. » sous la barre ; 422 → « Une permission n'existe plus.
  Rechargez la page. » ; réseau → le message générique de
  `mutation-feedback.ts`.
- Sur téléphone (400 px) : les deux colonnes s'empilent, la liste des rôles
  devient un `select` en tête, la barre d'actions reste collante.

Parcours e2e `roles-ecran.spec.ts` (un seul fichier, deux `test` en série) :

Premier, rôle personnalisé de bout en bout : ADMIN crée « Chef d'équipe
<marque> » de base SUPERVISEUR en partant de ses permissions, décoche
`campagnes.gerer`, enregistre ; onglet « Utilisateurs », crée un compte avec
ce rôle, vérifie le badge et la mention de base dans la liste ; ce compte se
connecte (nouveau contexte), arrive sur la page d'accueil des superviseurs,
ne voit pas « Nouvelle campagne », et `POST /api/v1/campagnes` répond 403 ;
ADMIN tente de supprimer le rôle, l'action est désactivée ; ADMIN supprime le
compte puis le rôle. Le parcours nettoie en `afterAll` par SQL direct
(`e2e/donnees-admin.ts` `ecrire`) si une étape a échoué.

Second, rôle système : ADMIN ouvre « Utilisateurs et rôles », onglet « Rôles », choisit SUPERVISEUR,
désactive `campagnes.gerer`, enregistre, vérifie le toast ; en SUPERVISEUR
(nouveau contexte), le bouton « Nouvelle campagne » est absent et
`POST /api/v1/campagnes` répond 403 ; en ADMIN, « Rétablir les valeurs par
défaut » puis enregistrer ; en SUPERVISEUR, le bouton est revenu. Tentative de
retirer `roles.administrer` à ADMIN : interrupteur désactivé, aucune requête
émise (vérifier avec `page.waitForRequest` en négatif ou en comptant les
requêtes `PUT`). Le parcours remet l'état en `afterAll` par `PUT` direct,
sinon `roles.spec.ts` rougit sur les autres workers.

Le parcours `administration.spec.ts` existant (actions sur un compte) doit
passer sans modification contre l'onglet réécrit ; s'il cible un sélecteur
disparu, c'est l'écran qui a perdu une action, pas le test à adapter. Seul un
libellé renommé à dessein autorise à toucher le test, et le rapport le nomme.

Casser : dans `roles-view.tsx`, envoyer `permissions` sans la permission
décochée (bug volontaire) ; le parcours doit rougir sur le 403 attendu ;
remettre. Dans `user-form-dialog.tsx`, envoyer `role` au lieu de `roleId` ;
le premier `test` doit rougir sur le badge du rôle personnalisé ; remettre.

Commit : `feat(web): ecran Utilisateurs et roles, roles personnalises`.

### Phase 6 : nettoyage et documentation

1. `roles.go` ne contient plus que `Role`, ses constantes, `Public`,
   `Garde`, `FusionnerGardes`, `VerifierGarde`, `PorteePlateforme`,
   `PorteeSaisiePlateforme`.
2. `rtk pnpm dead-code`, `rtk pnpm lint:go`, `rtk pnpm complexite:go` : rien
   de nouveau au-dessus des seuils.
3. Ce document reçoit une section « Exécuté » : date, commits, écarts
   constatés, liste des sites classe C restants, incohérences web conservées.
4. `AGENTS.md`, section « Cap v2 » : une phrase « Autorisation : permissions
   par rôle (docs/decisions/rbac.md) ; le rôle reste une donnée. »

Commit : `docs(rbac): plan execute et sites restants`.

## 3. Mesures

### 3.1 Lignes

| Zone                                                                        | Ajoutées    | Modifiées | Supprimées               |
| --------------------------------------------------------------------------- | ----------- | --------- | ------------------------ |
| `permissions.go` (catalogue, chargement, `Peut`)                            | 320         | 0         | 0                        |
| `roles.go`, `middleware.go`, `main.go`, `live.go`                           | 40          | 60        | 45 (groupes, `Autorise`) |
| 17 cartes `Garde`                                                           | 0           | 215       | 0                        |
| 37 prédicats de portée (21 fichiers)                                        | 0           | 60        | 0                        |
| `admin_roles.go` (5 routes, D6, D9, D10) + `roles.sql` + migration + schéma | 620         | 5         | 0                        |
| `admin.go`, `admin.sql`, `session.go`, requête de session, semis (`roleId`) | 40          | 60        | 10                       |
| Tests d'intégration Go (fixture exclue)                                     | 700         | 40        | 0                        |
| Fixture `matrice-roles-2026-09-16.json`                                     | 1 136       | 0         | 0                        |
| Contrat JSON (équivalent déplié)                                            | 110         | 15        | 0                        |
| `types.ts`, `guard.ts`, `data/auth.ts`, `data/roles.ts`, `data/users.ts`    | 120         | 50        | 15                       |
| `nav-items.ts`                                                              | 10          | 65        | 20                       |
| 64 routes + classes 3 et 4 + libellés `roleLibelle`                         | 0           | 230       | 0                        |
| Écran : coque + rôles + dialogue de rôle + `switch`                         | 640         | 0         | 0                        |
| Onglet utilisateurs réécrit (vue + formulaire)                              | 550         | 10        | 915                      |
| e2e `roles-ecran.spec.ts`                                                   | 200         | 0         | 0                        |
| Docs                                                                        | 30          | 5         | 0                        |
| **Total hors fixture**                                                      | **≈ 3 360** | **≈ 755** | **≈ 1 005**              |

Net produit : environ +2 350 lignes, +1 136 de fixture. Nouveaux fichiers :
10 (deux Go, un SQL de migration, un SQL de requêtes, un JSON de test, cinq
web). Aucun paquet nouveau, aucune dépendance Go nouvelle, une primitive UI
copiée. Par rapport à la version sans rôles personnalisés : environ +1 000
lignes nettes, deux tables au lieu d'une, trois routes et neuf tests
d'intégration de plus.

### 3.2 Complexité

| Mesure                                                  | Avant                                   | Après                                                                                                                                                                         |
| ------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endroits où un ensemble de rôles est écrit en dur (Go)  | 215 gardes + 37 prédicats + 7 groupes   | 0 dans les gardes, 0 dans les prédicats, 1 catalogue                                                                                                                          |
| Endroits où un ensemble de rôles est écrit en dur (web) | 62 gardes + 33 nav + 48 UI + 17 filtres | 0 ; le web lit `permissions`                                                                                                                                                  |
| Sources de vérité de la matrice                         | 1 (code Go, immuable)                   | 2 (catalogue = défauts, table = état) réconciliées par `TestPermissionsSemeesIdentiquesAuCatalogue` au moment de la migration ; ensuite la table fait foi, le catalogue borne |
| Contrôles au démarrage                                  | 2                                       | 4                                                                                                                                                                             |
| Fonctions nouvelles au-dessus de gocognit 15            | 0                                       | 0 (le `PUT` tient en 3 fonctions : valider, écrire, recharger)                                                                                                                |
| Fichiers Go au-dessus de 1 500 lignes                   | 0                                       | 0 (`admin_roles.go` séparé)                                                                                                                                                   |
| Composants web nouveaux au-dessus de 300 lignes         | 0                                       | 0                                                                                                                                                                             |
| Chemins d'écriture de l'attribution                     | 0                                       | 1 (`PUT /roles/{id}/permissions`)                                                                                                                                             |
| Chemins d'écriture de `users.role`                      | 1                                       | 1 (inchangé, dérivé de `roleId`, D10)                                                                                                                                         |
| Colonnes qui disent le rôle d'un compte                 | 1                                       | 2 (`roleId` pour les droits, `role` pour la donnée), tenues égales par D10 et un test                                                                                         |

Ce qui augmente réellement : deux tables, cinq routes, un rechargement
atomique, une seconde colonne de rôle sur `users`, et le fait qu'une matrice
modifiable en production n'est plus prouvée par la CI mais par les invariants
D6, D9, D10 et le journal d'audit. C'est le prix de la fonctionnalité
demandée, pas un accident.

### 3.3 Temps d'agent

Estimation pour un agent Claude Code sur Opus 5 (abonnement Max), une phase
par session, vérifications comprises (`make test` et Playwright à 29
workers coûtent 15 à 25 minutes par passage complet, deux passages par phase
avec l'étape « casser »).

| Phase     | Travail                                                     | Vérification | Total                                 |
| --------- | ----------------------------------------------------------- | ------------ | ------------------------------------- |
| 0         | 5 min                                                       | 10 min       | 15 min                                |
| 1         | 1 h 30 à 2 h                                                | 45 min       | 2 h 15 à 2 h 45                       |
| 2         | 2 h à 3 h (les dix assertions d'abord)                      | 1 h          | 3 h à 4 h                             |
| 3         | 3 h à 4 h (rôles, `roleId`, neuf tests)                     | 1 h          | 4 h à 5 h                             |
| 4         | 2 h 30 à 3 h 30 (mécanique, 85 fichiers, `typecheck` guide) | 45 min       | 3 h 15 à 4 h 15                       |
| 5         | 4 h à 5 h (deux onglets, dont la réécriture)                | 1 h 15       | 5 h 15 à 6 h 15                       |
| 6         | 30 min                                                      | 30 min       | 1 h                                   |
| **Total** |                                                             |              | **19 h à 24 h, huit à neuf sessions** |

Relecture du propriétaire : une heure par phase pour les phases 1, 2, 4 et 5
(tableaux de correspondance rôle → permission), quinze minutes pour les
autres. La phase 5 mérite un passage à l'écran sur téléphone.

Hypothèses : Postgres local prêt (`make setup`), `cpi-go` reconstruit avant
chaque `-roles`, aucun autre chantier ne touche `nav-items.ts` ni les cartes
`Garde` pendant les phases 1 et 4 (conflits garantis sinon ; vérifier
`git status` avant de commencer et n'inclure que ses fichiers).

## 4. Garantie de non-régression, résumée

| Risque relevé par l'audit                             | Ce qui l'attrape                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Une route change d'ensemble de rôles                  | `TestMatriceRolesInchangee` (phase 1), `roles.spec.ts` (218 routes × 8 rôles)                                                             |
| Fusion des deux « voit tout » (CCP)                   | permissions distinctes `portefeuille.voir_tout` et `plateforme.saisir` ; `TestFichesPlateformeReserveesAuxCCP` ; étape « casser » phase 2 |
| Tri-état plateforme aplati                            | forme imposée de `PorteePlateforme` ; même test                                                                                           |
| Écriture accordée à l'attributaire d'un lot           | `fiches.ignorer_propriete` ne remplace que `Role != Admin` ; `TestProspectPorteeDeLecture` et assertion 6                                 |
| Hiérarchie « ADMIN a tout »                           | aucune hiérarchie dans le modèle ; `visites.voir_archivees` sans ADMIN ; assertion 4                                                      |
| Sites d'export et d'analyse jamais testés             | assertions 1, 2, 3, 5 écrites AVANT la conversion                                                                                         |
| Semence de la table différente du code                | `TestPermissionsSemeesIdentiquesAuCatalogue`                                                                                              |
| Changement de permission sans effet avant redémarrage | `TestChangementDePermissionImmediat`                                                                                                      |
| ADMIN se verrouille dehors                            | D6, `TestRoleAdminVerrouille`, interrupteurs désactivés à l'écran                                                                         |
| Panneau et serveur divergent                          | le panneau ne connaît plus les ensembles : il lit `permissions` du serveur                                                                |
| Test e2e qui laisse une attribution modifiée          | `roles.spec.ts` rougit ; `afterAll` obligatoire dans `roles-ecran.spec.ts`                                                                |
| Permission morte ou route sans permission             | `VerifierGarde`, arrêt au démarrage, CI rouge                                                                                             |
| `users.role` et `users."roleId"` divergent            | D10, `TestRoleEtRoleDeBaseNeDivergentJamais`                                                                                              |
| Rôle personnalisé qui perd les données de sa base     | `TestRolePersonnalise` (cohorte des superviseurs), premier `test` de `roles-ecran.spec.ts` (page d'accueil)                               |
| Rôle supprimé ou rebasé sous des comptes              | D9, clé étrangère sans cascade, `TestRoleUtiliseNonSupprimable`, `TestRoleDeBaseFige`                                                     |
| Plus personne ne peut administrer les rôles           | D6 élargi, `TestDernierAdministrateurDesRoles` en concurrence                                                                             |
| Réécriture de l'onglet qui perd une action            | inventaire des actions au début de la phase 5, `administration.spec.ts` inchangé                                                          |

Ce que le plan ne garantit pas, à dire au propriétaire : une attribution
modifiée en production par un ADMIN n'est plus couverte par la CI ; elle est
tracée dans le journal d'audit et bornée par D6, D9 et D10 seulement. La
matrice e2e de 218 routes ne parcourt que les huit rôles système ; un rôle
personnalisé est prouvé par construction (il n'a que des permissions du
catalogue, chacune déjà exercée) et par un seul parcours, pas par une matrice
à lui. Un rôle personnalisé hérite des données de sa base : si un ADMIN crée
un « Chef d'équipe » de base COMMERCIAL avec des droits d'encadrement, il
reçoit les rapports quotidiens des téléconseillers, pas ceux des superviseurs. Les incohérences
déjà présentes (export plus large que la liste, `canFilter` divergent entre
écrans) sont conservées à l'identique et listées dans le rapport de la phase
concernée ; les corriger est une décision séparée.

## 5. Exécuté

Branche `v3`, 16 et 17 septembre 2026.

| Phase | Commit     | Preuve                                                                                                                                                                                                                                                                   |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | `be094205` | matrice gelée, 221 routes                                                                                                                                                                                                                                                |
| 1     | `9d0a367e` | `TestMatriceRolesInchangee`                                                                                                                                                                                                                                              |
| 2     | `62df5a4a` | régression trouvée en revue : `Encadrement` converti en `fiches.ignorer_propriete` (ADMIN seul), corrigée par `e548ae9b` (`fiches.modifier_toutes`) ; `portees_integration_test.go` passe sur `a5484c66` comme après, chaque test rougit quand sa permission est faussée |
| 3     | `88c826d9` | tables `roles` et `role_permissions`, `users."roleId"`, trigger qui tient `role` égal au rôle de base, 13 tests d'intégration cassés un à un                                                                                                                             |
| 4     | `c862787f` | 167 sites relus : ensemble de rôles identique avant et après pour les huit rôles                                                                                                                                                                                         |
| 5     | `89e57071` | `roles-ecran.spec.ts` rougit si l'écran n'envoie pas la permission décochée ; suite Playwright complète verte à 4 travailleurs                                                                                                                                           |

Suite d'intégration : mêmes résultats qu'à `a5484c66`, tests ajoutés en plus.

Écarts au plan, voulus :

- Pas de global : les attributions sont chargées par base (`Deps.Attributions`), chaque base de démonstration a sa table.
- Garde-fou ajouté après revue : sans `roles.administrer`, on ne donne ni ne touche un compte dont le rôle dépasse ses propres permissions (`ROLE_HORS_DROITS`) ; sinon `comptes.administrer` suffisait à se faire ADMIN.
- Deux permissions de plus : `fiches.modifier_toutes` et `visites.detruire` (la destruction d'une visite archivée ne suit plus la lecture des archives).
- Web : un site ne passe à la permission que si un ensemble de rôles identique existe **et** que le sens correspond. Restent sur le rôle de base : `readsOnly`, `canExportProspects`, `canExportRepresentants`, boîte de réception (`INBOX_ROLES`), `canCreateProspect` de la console Téléconseil, les écrans du terrain (`TERRAIN`), l'onglet admin des pilotages, les redirections d'accueil. Un rôle personnalisé y suit sa base.
- Écran : cases à cocher natives plutôt qu'un `switch` ajouté ; rôle choisi en état local, pas dans l'URL ; le filtre de la liste des comptes reste sur le rôle de base.
- Le cache des analyses (60 s) garde l'ancienne portée d'un rôle système dont on vient de changer les permissions, au plus une minute.
