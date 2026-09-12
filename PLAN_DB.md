# Plusieurs bases Postgres, une seule application

## Les trois lignes

- **Qui l'exige** : le propriétaire veut une base de démonstration (et demain
  une base par client) sans `if demo` ni `workspace_id` dans le code métier.
- **Plus petit changement complet** : le binaire ouvre un pool par base
  déclarée dans l'environnement, monte l'API une fois par base, et un
  répartiteur de 15 lignes choisit l'instance d'après un cookie `cpi_base`.
  Le code métier (341 `s.Q`, 57 `s.Pool`) ne bouge pas.
- **Hors périmètre** : mot de passe maître, sélection par nom de domaine,
  réinitialisation de la base démo, réglages Brevo ou Turnstile par base,
  suffixe « DEMONSTRATION » sur les exports, suppression du menu v1 mort
  « Ouvrir l'espace démo ».

Point à signaler : `docs/v2-refonte/plan.md` classe « espace de démonstration »
comme abandonné le 8 septembre. Ici l'espace n'existe pas dans le code, c'est
une base Postgres de plus, créée par l'exploitant. Le plan.md reçoit une ligne.

## Ce que le code fait aujourd'hui

- `cmd/server/main.go` : un `DATABASE_URL`, un pool, `database.Migrer`, un
  `socle.Deps{Q, Pool, Cfg, Live}`, un `http.ServeMux`, une API huma, un
  planificateur gocron. Chaîne : `JournalEtRecuperation(mux,
LimiterApi(cfg, GarderAcces(mux, d.Q)), cfg)`.
- Chaque domaine est `type service struct{ *socle.Deps }` construit au montage.
  La base est donc choisie une fois, au démarrage. C'est exactement le point
  d'accroche : construire N `Deps` au lieu d'un.
- `GarderAcces` lit le cookie de session et cherche la ligne dans
  `refresh_tokens` de la base du `Deps`. Une session n'existe que dans sa base.
- `auth.me` renvoie déjà `workspace: "public"` (contrat v1 figé, enum
  `public | demo`). Le panneau lit `user.workspace`.
- État global de paquet qui poserait problème avec deux bases :
  - `qualification.noteConfig.dir`, `IMPORTS_DIR`, `DB_DUMP_DIR` : trois
    dossiers partagés. `balayerNotesVocales` et `balayerOrphelins` (dumps)
    **suppriment les fichiers absents de leur base** : le balayage de la base
    publique détruirait les notes de la démo, et inversement.
  - `analytics.cacheLectures` : clé `route:portée:filtres` sans la base, la
    démo lirait les chiffres de la prod.
  - `admin_dump` lit `s.Cfg.DatabaseURL` pour `pg_dump` : doit être celle de
    la base courante.
  - `socle.Garde`, `huma.NewError`, `formulaireTurnstile`, `noteBattements`,
    `verrouDump`, `balayageImportsEnCours` : identiques ou inoffensifs entre
    bases, rien à faire.

## Décisions

1. **Nommage** : `DATABASE_URL` est la base `public` (nom déjà dans le contrat
   et le panneau). Toute variable `DATABASE_URL_<NOM>` déclare une base nommée
   `<nom>` en minuscules : `DATABASE_URL_DEMO` donne `demo`. Zéro nouvelle
   variable pour un déploiement à une seule base.
2. **Choix de la base** : cookie `cpi_base=<nom>`, écrit par le navigateur
   depuis la page de connexion, lu par le serveur sur chaque requête. Absent ou
   inconnu : `public`. Le serveur ne fait jamais confiance au nom pour autre
   chose qu'une recherche dans sa liste blanche. Un jeton de session ne vaut
   que dans sa base : changer le cookie à la main donne un 401, pas une fuite.
3. **Pas de mot de passe maître.** La liste des noms n'est pas un secret, et
   chaque base garde ses propres comptes et mots de passe. Un second secret à
   gérer n'ajouterait aucune isolation. Le raccourci clavier reste une
   commodité, comme le dit la proposition elle-même.
4. **Une instance complète par base** : pool, migrations, `Deps`, mux, API,
   bus SSE, planificateur. Le bus SSE et les tâches planifiées sont isolés
   gratuitement. Coût mémoire : quelques centaines de routes enregistrées N
   fois, négligeable.
5. **Stockage par base** : `Config.Dossier(variable, defaut)` renvoie le
   dossier de l'environnement pour `public` (les fichiers de prod restent où
   ils sont) et un sous-dossier `<dossier>/<nom>` pour les autres bases.
6. **Marqueur visible** : `me.workspace` renvoie le nom de la base ; le menu
   utilisateur affiche une pastille avec ce nom dès qu'il n'est pas `public`.

## Changements, fichier par fichier

### Go (~130 lignes, aucun fichier nouveau)

- `internal/shared/socle/config.go`
  - `Config.Base string`.
  - `Bases(cfg) []*Config` : lit `DATABASE_URL_*`, renvoie une copie de la
    config par base avec `Base` et `DatabaseURL` ; `public` en premier.
  - `func (c *Config) Dossier(variable, defaut string) string`.
- `internal/shared/socle/socle.go` : `Deps.Bases []string` (noms, pour
  `auth.bases`).
- `internal/shared/socle/session.go` : `Utilisateur` inchangé.
- `cmd/server/main.go`
  - `instance(cfg, pool) (mux, deps, api, err)` : ce que `serveur` fait
    aujourd'hui sans le `http.Server`.
  - `run` : boucle sur `socle.Bases(cfg)` : `pgxpool`, `Migrer`, `instance`,
    `planifier`. `-seed` continue de ne viser que `DATABASE_URL`.
  - `repartir(instances map[string]http.Handler) http.Handler` : lit le
    cookie `cpi_base`, sert `GarderAcces(mux_b, q_b)` de la base, sinon
    `public`.
  - Chaîne finale : `JournalEtRecuperation(muxPublic, LimiterApi(cfg,
repartir(...)), cfg)` : un journal, un limiteur, N gardes.
  - `-openapi` et `-roles` construisent une seule instance sans pool, comme
    aujourd'hui.
- `internal/auth/auth.go`
  - `GET /api/v1/auth/bases` public, réponse `{ "bases": ["public","demo"] }`.
  - `me` : `Workspace = s.Cfg.Base`, tag `enum:"public"` retiré.
- `internal/qualification/qualification_notes.go` : `noteConfig.dir` supprimé,
  `NoteRacine(cfg *socle.Config)` ouvre `cfg.Dossier("NOTE_VOCALE_DIR", ...)`.
  `internal/prospects/prospects.go:658` suit.
- `internal/imports/imports.go`, `internal/accueil/accueil_import.go` :
  `reglagesImport.dir` remplacé par `s.Cfg.Dossier("IMPORTS_DIR", ...)` aux
  deux sites qui l'utilisent.
- `internal/admin/admin_dump.go` : `repertoireDump(cfg)` ;
  `lancerPgDump` reçoit déjà `s.Cfg.DatabaseURL`, donc la bonne base.
- `internal/analytics/cache.go` : la clé est préfixée par le nom de la base là
  où elle est construite.

### Panneau (~55 lignes)

- `web/src/components/auth/login-form.tsx`
  - `⌘/Ctrl+Shift+D` ou `⌘/Ctrl+Shift+N` affiche un `Select`
    (`components/ui/select.tsx`) « Base » alimenté par `GET /api/v1/auth/bases` ; le changement écrit
    `document.cookie = "cpi_base=<nom>; path=/; max-age=31536000; SameSite=Lax"`.
  - Si le cookie vaut déjà autre chose que `public`, le sélecteur est visible
    d'emblée : on voit sur quelle base on va se connecter.
- `web/src/components/layout/user-menu.tsx` : pastille `user.workspace` quand
  différent de `public`. Le menu est déjà rendu par le panneau et par le hub.
- `web/contrat-v1.openapi.json` : `workspace` passe d'`enum [public, demo]` à
  chaîne libre sur `AuthUserDto` (deux occurrences, fichier gardé minifié). Le
  fichier est en conflit de fusion dans l'arbre courant : à résoudre avant.

### Preuve (~40 lignes)

- `e2e/connexion.spec.ts`, un parcours : ouvrir `/connexion`, `Ctrl+Shift+D`,
  choisir `demo`, se connecter avec un compte qui n'existe que dans la base
  démo, voir la pastille « demo » ; se déconnecter, choisir `public`, mêmes
  identifiants refusés.
- `e2e/comptes.ts` : `creerComptes(url)` paramétré ; `global-setup.ts` crée
  un compte admin dans la base démo si `DATABASE_URL_DEMO` est défini.
- `e2e/playwright.config.ts` : transmet `DATABASE_URL_DEMO` au serveur.
- `.github/workflows/ci.yml` : `CREATE DATABASE crm_demo` + `schema.sql`, et
  `DATABASE_URL_DEMO` dans l'environnement du job `go`.
- Avant de garder le parcours, le casser : faire renvoyer `public` par `me`
  sur la base démo, vérifier qu'il rougit, remettre.
- Les tests d'intégration Go existants appellent `serveur(cfg, pool)` et
  `nouveauDeps` : signatures conservées.

### Exploitation (~10 lignes)

- `.env.example` : deux lignes commentées sous `DATABASE_URL`.
- `README.md` : créer une base locale de plus :
  `createdb cpi_v2_demo && psql cpi_v2_demo -f sql/schema.sql`, puis
  `DATABASE_URL=postgres://localhost:5432/cpi_v2_demo?sslmode=disable go run ./cmd/server -seed`.
- `infra/dokploy/README.md` : même recette sur le conteneur Postgres de prod,
  puis `DATABASE_URL_DEMO` dans l'environnement Dokploy. Le seed s'exécute
  avec l'image existante, `DATABASE_URL` surchargé le temps de la commande.
- `docs/v2-refonte/plan.md` : une ligne dans le tableau des décisions.

## Vérification

```
make lint && make test
pnpm plafonds && pnpm verify:local
make e2e            # avec DATABASE_URL_DEMO défini, --workers=29
```

À la main : deux bases locales, connexion sur chacune depuis le même
navigateur, notes vocales déposées sur les deux, attendre un balayage, les deux
fichiers survivent ; tableau de bord ouvert sur `public` puis sur `demo`,
chiffres différents.

## Ce que ferait la version large de la proposition

Fenêtre « Administration », mot de passe maître `DB_SELECTOR_ADMIN_PASSWORD`
haché et vérifié par `POST /api/v1/auth/bases` avant de rendre la liste, cookie
posé par le serveur en `HttpOnly`. Coût : une variable d'environnement, ~40
lignes Go, ~50 lignes de panneau (modale, champ, erreur), un parcours de plus.
Ce qu'elle protège : le fait qu'une autre base existe. Ce qu'elle ne protège
pas de plus : l'accès aux données, déjà tenu par les comptes de chaque base.
Non recommandée ; se construit sur la version minimale si le propriétaire la
veut après lecture de ce plan.

## Idées différées, une ligne chacune

- Sélection par nom d'hôte (`demo.cpi.sn`) : un `if` dans `repartir`.
- Réinitialisation de la base démo : un dump de référence rejoué par cron.
- Suffixe « DEMONSTRATION » sur les exports : `withDemoSuffix` existe déjà côté panneau.

## Réalisé le 10 septembre

Deux écarts avec le plan, décidés par le propriétaire avant de coder : les
notes vocales sont retirées (inutilisées) au lieu de recevoir un dossier par
base, et le dossier des dumps reste partagé, ses fichiers étant temporaires.
`Config.Dossier` n'existe donc pas. La réponse de connexion porte désormais le
même compte que `me` (`workspace` inclus), sinon la pastille attendait un
rechargement. Le panneau lisait `payload.error` là où l'API répond `message` :
corrigé, les messages d'erreur de connexion s'affichent.
