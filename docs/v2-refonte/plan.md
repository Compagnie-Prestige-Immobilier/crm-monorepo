# Refonte v2 : plan et arbitrages

Statut : version 3.1 du plan, 8 septembre 2026. Historique : version 1 le
7 septembre, cinq audits en lecture seule (`audits/api.md`, `web.md`,
`mobile.md`, `donnees-infra.md`, `critique-plan.md`) ; version 2 le
8 septembre ; version 2.2, backend Go ; version 3, abandon de l'application
mobile ; version 3.1, quatre audits de portage Go (`audits/go-api.md`,
`go-web.md`, `go-donnees.md`, `go-securite.md`) et leurs arbitrages. Chaque
affirmation technique renvoie à un `chemin:ligne` ou à une documentation
officielle citée dans les audits. Ce qui n'a pas pu être vérifié est marqué
« à prouver en phase 0 ». Le registre des risques est dans `risques.md`.

## 0. Où se fait le travail

Toute la v2 se construit dans un worktree git séparé, jamais dans le clone
principal, pour que `dev` et `prod` restent disponibles sans bascule de branche :

```
git fetch origin
git worktree add ../crm-monorepo-v2 -b v2 origin/dev
cd ../crm-monorepo-v2 && go build ./apps/go/... && pnpm --dir apps/go/web install
```

- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo` reste sur `dev` ou
  `prod` : correctifs de production, release v1 de maintenance, déploiements.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo-v2` porte la branche
  `v2` : `apps/go` et l'infra v2.
- Les correctifs prod sont reportés dans `v2` chaque soir par
  `git -C ../crm-monorepo-v2 merge origin/prod`, résolus dans le worktree.
- Les deux worktrees partagent le même `.git` : un `git worktree list` doit
  toujours montrer les deux, et `git worktree remove` n'est lancé qu'après la
  bascule.
- Les serveurs de développement des deux arbres n'utilisent pas les mêmes
  ports (v1 : 3000, 3001, 5434, 6381 ; v2 : Go 4000, Vite 5173, Postgres 5435).

## 1. Pourquoi

| Mesure au 7 septembre 2026                                                               | Valeur                                                                                    |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Lignes écrites à la main (API, web, mobile, packages)                                    | 165 000                                                                                   |
| Lignes générées commises dans git (34 schémas Drift, tests de migration, client OpenAPI) | 212 000                                                                                   |
| Routes API                                                                               | 234 sur 37 contrôleurs (`audits/go-api.md` §0)                                            |
| Pages web (`page.tsx`)                                                                   | 62, dont 55 dans les quatre espaces                                                       |
| Écrans mobile                                                                            | 26, plus 5 feuilles modales                                                               |
| Fichiers Playwright                                                                      | 82 specs                                                                                  |
| Tâches planifiées                                                                        | 7 crons                                                                                   |
| Requêtes SQL brutes                                                                      | 79, dont 13 statiques, 56 assemblées à l'exécution, 10 mortes (`audits/go-donnees.md` §1) |
| Contraintes vivant seulement dans le SQL des migrations                                  | ~35 CHECK, 12 index partiels, 2 extensions, 1 fonction                                    |

Les deux décisions qui ont coûté le plus sont le moteur de synchronisation
maison (`sync_engine.dart` 2 647 lignes, `sync.service.ts` 2 058 lignes) et la
double stack backend (classes DTO Nest + Swagger, OpenAPI, codegen, relais
Next). L'abandon du mobile supprime la première sans la remplacer ; le binaire
Go supprime la seconde. Cible mesurée par l'audit : environ 14 200 lignes de
Go (`audits/go-api.md` §6) plus la SPA.

## 2. Arbitrages

### 2.1 En vigueur

| Sujet                  | Décision                                                                                                                                                                                                           | Date        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Clients                | Un seul : le panneau web, même arbre sur poste et sur téléphone                                                                                                                                                    | 8 septembre |
| Mobile                 | Application Flutter abandonnée, APK retiré au jour J ; ni PowerSync, ni sync, ni Shorebird, ni Maestro                                                                                                             | 8 septembre |
| Backend                | Un binaire Go, `apps/go`, à la place de NestJS + Prisma                                                                                                                                                            | 8 septembre |
| Cadre HTTP             | `net/http` standard ; huma pour la validation des entrées, les erreurs par champ et le document OpenAPI ; pas de Gin, Echo ni Fiber                                                                                | 8 septembre |
| Contrat                | Les structs Go sont le contrat ; OpenAPI et types TypeScript produits au build, rien de commité                                                                                                                    | 8 septembre |
| Base                   | Même Postgres, mêmes tables ; pgx + sqlc pour les ~250 requêtes simples et les 13 brutes statiques ; pgx direct pour les 39 agrégats analytiques et le tri bancaire ; goose en SQL                                 | 8 septembre |
| Authentification       | Sessions opaques dans `refresh_tokens`, cookie `__Host-` avec vérification d'`Origin`, hachages argon2id repris, rôle relu à chaque requête, révocation au changement de mot de passe                              | 8 septembre |
| Panneau                | SPA Vite + React 19 embarquée ; TanStack Router et Query ; shadcn sur Base UI, Lucide inchangés                                                                                                                    | 8 septembre |
| Notes vocales          | Conservées, enregistrées dans le navigateur par `MediaRecorder`, mêmes routes que la v1, conteneurs `audio/webm` et `audio/mp4`, 2 minutes, 48 h ; périmètre conversion, comme le mobile                           | 8 septembre |
| Qualification prospect | `POST /phase2/call-attempts` remplace `POST /sync/push`, seul chemin d'écriture du panneau aujourd'hui (`console.ts:849`)                                                                                          | 8 septembre |
| Présence               | `POST /presence/beat` toutes les 60 s depuis la SPA, `UPSERT agent_heartbeats` ; pas de WebSocket                                                                                                                  | 8 septembre |
| Stratégie              | Réécriture en parallèle, bascule unique, sans pilote, checklist de parité                                                                                                                                          | 7 septembre |
| Intouchable            | Les quatre espaces et les sept rôles                                                                                                                                                                               | 7 septembre |
| Infra conservée        | SSE (4 topics) ; purge, dump par l'API ; import/export Excel complets ; export classeur du tableau de bord côté client                                                                                             | 7 septembre |
| Redis                  | Supprimé, cache mémoire à version de groupe dans le binaire. À confirmer par le propriétaire                                                                                                                       | 8 septembre |
| Abandonné              | Espace de démonstration ; `dev-login` et `DevRoleSwitcher` ; 13 routes analytics sans écran ; import de représentants tout-ou-rien au profit du système à jobs                                                     | 8 septembre |
| Tableaux de bord       | Disposition personnalisable conservée                                                                                                                                                                              | 7 septembre |
| Routes web             | Un seul arbre, `projet` dans l'URL ; anciennes adresses en 301 côté Go                                                                                                                                             | 7 septembre |
| Tests                  | Quinze parcours métier + un seizième « matrice des rôles » généré depuis `roles.go` ; parcours 3 à 8 et 11 rejoués en 390 px ; tests d'intégration Go sous tag `integration` contre Postgres ; aucun test unitaire | 8 septembre |
| Cadre                  | Gel des fonctionnalités sur `dev`, une seule release v1 de maintenance nommée                                                                                                                                      | 7 septembre |
| Ordre                  | Socle, CHUES, Grand Public, Banque, Accueil, Admin                                                                                                                                                                 | 7 septembre |
| Durée                  | 16 jours ouvrés, phase 0 d'un jour, durées figées après les preuves                                                                                                                                                | 8 septembre |

Pourquoi Go : le propriétaire veut la consommation la plus basse sur le VPS.
Aucune mesure n'existe en dépôt et Dokploy ne pose aucune limite
(`audits/donnees-infra.md` §4). Ordres de grandeur retenus, à mesurer en
phase 0 : un serveur Node avec Next occupe 150 à 250 Mo au repos, un binaire
Go 15 à 40 Mo. Rust est écarté : son gain sur Go est invisible à côté de
Postgres, et rien ici n'est limité par le CPU.

### 2.2 Ce qui disparaît avec le mobile

Source : `audits/go-api.md` §1, `audits/go-donnees.md` §5.

| Élément                                                                                                                        | Sort                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /sync/push`, `GET /sync/pull`, `sync_batches`, `sync_operations`, `SYNC_*`, `IDEMPOTENCY_*`                              | Supprimés ; la qualification prospect passe par la route REST de §2.1                                                                                    |
| Détection d'appel : `device_call_detections`, `GET :id/device-calls`, `common/device-call.ts`, alerte « appels non consignés » | Supprimés, impossible depuis un navigateur                                                                                                               |
| APK : `app-updates` (6 routes), `android_releases`, `APK_*`, `AndroidReleaseCard`                                              | Supprimés ; le volume `cpi-go-releases` reste monté jusqu'à J+7                                                                                          |
| `GET /lots-export/mes-attributions`, `GET /phase2/directory`, `GET /referentiels/pays`                                         | Supprimés                                                                                                                                                |
| Hors ligne                                                                                                                     | Abandonné ; le panneau exige le réseau. Idée différée, non codée : mode hors ligne PWA                                                                   |
| `minPayloadVersion`                                                                                                            | Colonne gardée, paramètre `payloadVersion` retiré : tous les statuts actifs sont servis (`audits/go-api.md` A3)                                          |
| `agent_heartbeats`, `app_settings`                                                                                             | Conservées, vivantes (`audits/go-donnees.md` §5)                                                                                                         |
| Ouvertures de fiche                                                                                                            | Conservées : les 6 routes sont consommées par le panneau (`lib/data/ouvertures.ts:54-108`), verrou et chronomètre déjà dans `RepScript` et `ConsoleView` |
| Journal de fiche `WEB\|MOBILE\|APPEL\|IMPORT`, enum `ChangeSource`                                                             | Valeurs conservées en lecture, `WEB` et `IMPORT` seuls écrits                                                                                            |
| `apps/mobile`, `sn.cpi.go`, Shorebird, Maestro                                                                                 | Supprimés de la branche `v2`                                                                                                                             |

### 2.3 Corrections v1 faites au portage

Défauts trouvés par les audits, corrigés parce que l'invariant existe déjà :

- Comptage du dernier ADMIN non verrouillé (`users.service.ts:158`) : les
  trois gestes passent en `SERIALIZABLE` ou `SELECT … FOR UPDATE`.
- Changement de son propre mot de passe sans révocation
  (`auth.service.ts:196-200`) : toutes les sessions sauf la courante sont
  révoquées.
- Limite multipart globale à 500 Mo (`bootstrap.ts:104-106`) :
  `http.MaxBytesReader` par route, 25 Mo pour les imports.
- Type MIME jamais vérifié par contenu (`import-file.store.ts:37`) :
  `http.DetectContentType` puis ouverture réelle.
- Volume des imports jamais monté (`imports.env.ts:4`) : ajouté dans `deploy.py`.
- Aucun `HEALTHCHECK` : ajouté, le binaire sonde `/health/ready`.
- `AUTH_LOGIN_RATE_LIMIT` posée mais jamais lue (`env.ts:61`) : lue.
- HSTS posé par un Caddy qui ne tourne pas en prod : posé par le binaire.

## 3. Cible

```
Navigateur (poste ou téléphone) ──HTTPS, cookie──► binaire Go (apps/go) ──pgx──► Postgres 18.4
                                                     │  net/http · huma · sqlc · SPA embarquée
                                                     ├── 7 crons, SSE, cache mémoire, notes vocales sur volume
                                                     └── Brevo, Turnstile, plateformes d'enrôlement (net/http)
```

Stack, versions vérifiées sur `proxy.golang.org` et `go.dev` le 8 septembre
2026 :

- Go 1.27. `net/http` (`ServeMux` avec méthode et motif) sert l'API, la SPA
  embarquée (`embed`), le SSE `/api/v1/live` (`http.Flusher`) et les notes
  vocales (`http.ServeContent`, donc `Range` et `ETag`). huma 2.39
  (`humago`) valide depuis les tags de struct, rejette les champs inconnus
  (`additionalProperties:false`, à vérifier au premier handler), renvoie
  RFC 9457 avec `errors[]` par champ et produit le document OpenAPI. Une
  struct étend `huma.ErrorModel` avec `code`, `message`, `statusCode`,
  `requestId` et les extensions à plat (`existing`) pour que le panneau
  garde son contrat (`audits/go-api.md` §5). `gocron` 2.22 pour les sept
  crons. `golang.org/x/time/rate` pour quatre limiteurs nommés : global
  300/min, connexion 10/min, formulaire public 5/min, imports et dump 5/min.
  `log/slog` JSON avec masquage de `authorization`, `cookie`, mots de passe
  et `phoneE164` ; jamais le corps ni l'URL en clair. `X-Request-Id` accepté
  si `^[\w-]{1,64}$`.
- Serveur : `ReadHeaderTimeout 10s`, `ReadTimeout 30s`, `IdleTimeout 120s`,
  `WriteTimeout 0` (exports et SSE), arrêt propre 30 s sur `SIGTERM`.
  En-têtes posés à la main : CSP (`default-src 'self'`, `frame-src` et
  `connect-src` Turnstile, `style-src 'unsafe-inline'` à vérifier au premier
  build), HSTS, `nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`. Pas
  de CORS : même origine. `X-Forwarded-For` lu seulement si
  `API_TRUST_PROXY_HEADERS`, dernier élément ; `CF-Connecting-IP` préféré.
- pgx 5.11 et sqlc 1.31. `apps/go/sql/schema.sql` est le
  `pg_dump --schema-only --no-owner --no-privileges --no-comments
--schema=public` de la copie de prod, relu à la main en phase 0 :
  extensions et `immutable_unaccent` conservées, `_prisma_migrations`
  retirée. Les 13 requêtes brutes statiques et les ~250 requêtes Prisma
  simples passent en sqlc ; les 39 agrégats analytiques à prédicats
  optionnels et le tri bancaire à 10 variantes passent en pgx direct avec un
  assemblage `strings.Builder` + `[]any` de 40 lignes reprenant la forme de
  `analytics.sql.ts`, pour garder les index partiels de `prospects`
  (`audits/go-donnees.md` §1, §10). Le code sqlc est produit au build et
  n'est pas commité. goose 3.28 applique les migrations v2 en SQL pur au
  démarrage ; `_prisma_migrations` reste en place. `updatedAt` : un trigger
  `BEFORE INSERT OR UPDATE` sur les 37 tables, posé au jour J, compatible
  v1. `uuid(7)` : `google/uuid` v7 en `TEXT`. Pool : `MaxConns 10`,
  `MinConns 2`, `MaxConnLifetime 30 min`. Imports : `pgx.Batch`, jamais
  `CopyFrom` (22 sites `ON CONFLICT DO NOTHING`). Exports de 500 000
  lignes : pages keyset de 1 000 lignes hors transaction vers le
  `StreamWriter` excelize.
- Authentification : jeton opaque de 32 octets, SHA-256 dans
  `refresh_tokens.tokenHash`, 30 jours fixes, `revokedAt` à la déconnexion,
  à la désactivation, au changement de rôle et de mot de passe ; cookie
  `__Host-cpi_session` `HttpOnly; Secure; SameSite=Lax; Path=/` posé
  inconditionnellement ; middleware qui exige `Origin` égal à l'origine
  servie sur toute méthode hors `GET/HEAD/OPTIONS`. Condensat factice sur
  identifiant inconnu (`auth.service.ts:23-27`). `alexedwards/argon2id` 1.0
  sur les chaînes PHC actuelles (`m=19456,t=2,p=1`). Politique 8 à 24.
  Identifiant unique à l'écran, aiguillage sur `@`.
- Autorisation : `roles.go`, `map[string][]Role` dont la clé est `r.Pattern`
  (Go 1.23+), 197 entrées ; deux assertions au démarrage (route sans
  entrée, entrée sans route) ; `go run ./apps/go -roles` écrit la matrice
  pour Playwright, non commitée. Propriété de la fiche, portées de lecture et
  dernier admin restent dans le SQL des handlers (`audits/go-securite.md` §2).
- Bibliothèques remplaçant `apps/api/package.json` : excelize 2.11
  (`SetCellStr`, `StreamWriter`), maroto 2.4 sur fpdf (`pdfkit`),
  `archive/zip` (`jszip`), `nyaruka/phonenumbers` 1.8 avec la
  `canonicalizePrefix` de `common/phone.ts` recopiée, Brevo et Turnstile par
  `net/http`. Cache mémoire écrit à la main (~45 lignes) : clé
  `groupe:version:scope:url`, `scope` = rôle si `readsEveryone` sinon
  identifiant utilisateur, invalidation par version de groupe couplée au SSE,
  comme `cache.interceptor.ts:58-62`.
- Panneau : `apps/go/web`, Vite, React 19.2, TanStack Router 1.170 (seul à
  typer les paramètres de recherche `?volet=`, `?fiche=`, `?rep=`),
  TanStack Query (réglages de `lib/query-client.ts` repris), `openapi-fetch`
  avec les types produits par `openapi-typescript` au build depuis
  `go run ./apps/go -openapi`. Validation client conservée là où elle
  évite un aller-retour sur téléphone : `validateConversion` piloté par
  `champs-conversion`, `manqueDe` de `RepScript`, confirmation de mot de
  passe, attributs natifs `required`/`pattern`/`min`/`max` ; le serveur
  garde unicité, doublon, cohérence, jeton. Erreurs RFC 9457 affichées par
  champ par un adaptateur unique remplaçant `extractMessage`. `next-themes`
  remplacé par ~30 lignes ; repli sidebar lu de façon synchrone au
  démarrage. Export classeur du tableau de bord inchangé, côté client avec
  `exceljs`. `dist/` embarqué ; en développement Vite sur 5173 relaie
  `/api` vers 4000.
- Écrans téléconseiller en largeur 390 px d'abord (`audits/go-web.md` §3) :
  pied collant sur « Enregistrer » et la rangée d'issues ; `<Kbd>` masqués au
  tactile, raccourcis conservés ; les quatre tableaux (rappels, suivi, mes
  contacts) en cartes sous 768 px sur le patron de `suggestions-view.tsx` ;
  `RepScript` coupé en cinq fichiers et `ConsoleView` en trois, tous sous
  300 lignes, `Qualification` gardant ses 17 `useState` et `useBrouillonAuto`.
- Notes vocales : bouton dans `Consignation`, `MediaRecorder` natif,
  `isTypeSupported()` dans l'ordre `audio/webm;codecs=opus`, `audio/mp4`,
  vide ; 2 minutes ; `visibilitychange` arrête et envoie ; blob gardé en
  mémoire pour un nouvel essai ; bouton absent sans `mediaDevices` ou sans
  permission. Écoute dans `HistoriqueAppels`. Serveur : `.part` en `O_EXCL`
  puis `rename`, idempotent, auteur en écriture, ADMIN et SUPERVISEUR en
  lecture, balayage horaire par âge et par orphelin (`audits/go-api.md` §4).
- Image Docker : Node pour les types et `dist/`, Go (`CGO_ENABLED=0
-trimpath -ldflags="-s -w"`, `embed`), `debian:bookworm-slim` avec le
  bloc PGDG de `Dockerfile.api:115-133` pour `pg_dump` 18, utilisateur
  10001, `HEALTHCHECK` par le binaire, 140 à 160 Mo. Volumes :
  `db-dumps`, `call-recordings`, `imports`, `releases` jusqu'à J+7. Une
  application Dokploy `cpi-go`, les deux domaines conservés dessus.
- CI : `go vet`, `golangci-lint` (errcheck, govet, staticcheck, ineffassign,
  unused, gosec, bodyclose, rowserrcheck, sqlclosecheck), `sqlc vet`,
  `go build`, `govulncheck` ; `tsc`, `oxlint`, `vite build` ; `security.yml`
  avec semgrep `p/golang`. Portillon : tout `apps/go/*_test.go` sans
  `//go:build integration` en première ligne fait échouer la CI.

## 4. Structure du dépôt

```
apps/go/
  main.go              mux, embed, SSE, configuration, slog            ~450
  middleware.go        session, garde, Origin, limiteurs, MaxBytes, recover ~250
  errors.go            RFC 9457 + code métier                           ~60
  cache.go             cache mémoire à version de groupe                ~45
  auth.go              sessions, argon2id, me, mot de passe             ~380
  roles.go             table rôle x route, 197 entrées, assertions      ~280
  representants.go                                                     ~1 050
  prospects.go         CRUD, fusion, réaffectation, revue, Grand Public ~980
  qualification.go     campagnes représentants, tentatives phase 2, rappels, ouvertures, suggestions, notes vocales, présence ~1 400
  campagnes.go         lots d'export, répartition, PDF, ZIP             ~900
  banque.go            dossiers, étapes, demandes de création           ~1 150
  accueil.go           registre, référentiels de visite, import         ~760
  admin.go             utilisateurs, purge, dump, enrôlement, tableaux de bord, paramètres, champs de conversion ~1 480
  referentiels.go                                                      ~820
  analytics.go         7 routes + 5 supervision + créneaux, pgx direct  ~700
  notifications.go     composeur, gabarits, bail, rappels, compte rendu ~900
  brevo.go             client Brevo                                    ~250
  imports.go           job unique, bail, tranches, 4 adaptateurs, revue ~1 400
  exports.go           7 classeurs excelize, PDF maroto, ZIP            ~950
  formulaire_public.go formulaire, Turnstile, rapprochement             ~380
  sql/schema.sql       pg_dump relu en phase 0, lu par sqlc
  sql/queries/         requêtes sqlc, un fichier par domaine
  sql/migrations/      goose, SQL pur, à partir de l'état v1
  sqlc.yaml go.mod
  web/                 Vite + React 19, panneau ; dist/ embarqué
infra/                 Dockerfile, deploy.py
docs/v2-refonte/       ce plan, audits/, risques.md
```

Un seul package Go, vingt fichiers, aucun au-dessus de 1 500 lignes
(`audits/go-api.md` §6) ; un sous-package n'apparaît que si deux fichiers
l'importent réellement. Les clients des plateformes d'enrôlement tiennent
dans `admin.go`.

Disparaissent : `apps/api`, `apps/web`, `packages/api-client`,
`packages/api-client-chues` et `-grand-public`, `packages/database`, tests de
migration générés, `openapi.json`, `docs/adr/0001` et `0002` (remplacés par
un ADR v2). Le `seed` (20 `upsert`, contrôle `DEPARTEMENT_COUNT`, admin
jamais réécrit, `packages/database/src/seed.ts:104-105,360-398`) devient
`go run ./apps/go -seed` avec la même forme.

## 5. Phases

Durées en jours ouvrés, binôme propriétaire + agents. Les durées
définitives sont figées à la fin de la phase 0. Calendrier dans
`diagrammes/07-calendrier.puml` : du 14 septembre au 5 octobre 2026.

### Phase 0. Preuves et préparation, 1 jour

Sortie : trois preuves écrites, go/no-go signé par le propriétaire.

1. Restauration d'une sauvegarde Dokploy (`pg_dump -Fc`, `pg_restore`) sur un
   Postgres de travail. Jamais fait à ce jour (`docs/migrations-en-attente.md:50-54`).
   Sans restauration réussie, rien d'autre ne commence.
2. Preuve A, schéma : `pg_dump --schema-only` de la copie devient
   `sql/schema.sql` relu ; les 13 requêtes brutes statiques et dix requêtes
   Prisma représentatives (`groupBy`, `ON CONFLICT`, keyset, `unaccent`)
   passent `sqlc generate` et `go build` ; goose démarre sans toucher
   `_prisma_migrations` ; un premier handler huma prouve le rejet des champs
   inconnus.
3. Preuve B, consommation : `docker stats` sur la prod pour `cpi-go-api`,
   `cpi-go-web`, Postgres et Redis, RAM totale du VPS. Référence pour juger
   le binaire Go au jour J.
4. Preuve C, téléphone : les quatre écrans téléconseiller du panneau v1
   parcourus sur un Android réel en navigateur ; `MediaRecorder.isTypeSupported`
   relevé sur cet appareil ; liste écrite de ce qui ne tient pas.
5. Release v1 de maintenance, exception nommée au gel : suppression du schéma
   `demo` et de `DEMO_WORKSPACE_ENABLED` ; suppression de `device_tokens`,
   `DevicePlatform`, `users.departementId` et des colonnes mortes retenues
   dans `docs/migrations-en-attente.md`, avant le `pg_dump` de référence.
   Rien côté mobile : l'APK v1 reste tel quel jusqu'au jour J.

### Phase 1. Socle, 3 jours

`apps/go` : `main.go`, `middleware.go`, `errors.go`, `cache.go`, `auth.go`,
`roles.go` avec ses assertions, sqlc, goose, quatre limiteurs, SSE, sept
crons enregistrés, `presence/beat`, Dockerfile, `deploy.py`, CI. Panneau :
coque Vite, connexion, layout des quatre espaces, client typé, adaptateur
d'erreurs, thème, sidebar. Sortie : un utilisateur de chaque rôle se
connecte, voit son espace, est compté présent ; le parcours « matrice des
rôles » passe ; le binaire tourne sur le Postgres de travail avec sa RSS
relevée.

### Phase 2. CHUES, 5 jours

`representants.go`, `prospects.go`, `qualification.go`, `campagnes.go`,
`analytics.go`, `exports.go` pour CHUES. Représentants, qualification
(script, statuts, suggestions, personne proposée), prospects,
`POST /phase2/call-attempts`, conversion avec champs configurables,
ouvertures de fiche, rappels et origines, mes contacts, campagnes et lots
d'export (13 routes, exports xlsx/zip/pdf), commentaires, historique unifié
et journal du formulaire, notes vocales (enregistrement, écoute, balayage),
supervision (activité, présence, fiches restées), statistiques avec
disposition personnalisable, `parametres-chues`. Panneau : `RepScript` et
`ConsoleView` coupés, tableaux en cartes, pied collant, `MediaRecorder`.
Sortie : checklist §6 cochée pour téléconseiller, chargé de clientèle,
superviseur, direction, sur poste et sur téléphone.

### Phase 3. Grand Public, 1 jour

Quatre chemins de `prospects.go` et `formulaire_public.go`. Formulaire Grand
Public, consentement, conversion, console, rappels, statistiques. Formulaire
public `/demande/[jeton]` avec Turnstile et limiteur par adresse réelle.
Sortie : checklist Grand Public.

### Phase 4. Banque, 1 jour

`banque.go` : dossiers, étapes avec advisory lock, transitions, demandes de
création de client, vue d'ensemble, export 3 feuilles en `RepeatableRead`.
Sortie : checklist Banque & Finance.

### Phase 5. Accueil, 1 jour

`accueil.go` : registre, listes, tableau de bord, impression, import avec revue.

### Phase 6. Admin, 3 jours

`admin.go`, `referentiels.go`, `notifications.go`, `brevo.go`, `imports.go`.
Utilisateurs (reprise de portefeuille, dernier admin verrouillé), référentiels
(25 + 10 routes), imports de masse unifiés (job avec bail, tranches
`pgx.Batch`, reprise, quatre adaptateurs), notifications (composeur,
gabarits, Brevo, bail d'expédition, rappels planifiés, compte rendu),
plateformes d'enrôlement (tirage, indicateurs), paramètres, champs de
conversion, purge avec plan topologique (57 étapes), dump.

### Phase 7. Parité et bascule, 1 jour

Seize parcours Playwright dont la matrice des rôles, les parcours 3 à 8 et 11
rejoués en 390 px, checklist complète sur copie de prod, runbook §7 répété
deux fois à blanc, mesure de la RSS et de la latence de `/supervision/activite`
comparée à la preuve B.

Total : 16 jours ouvrés. La release v1 de maintenance se fait en parallèle de
la phase 0, dans le clone principal.

## 6. Checklist de parité

Une ligne par geste, cochée à la main sur la v2 branchée sur une copie de
prod. Les lignes téléconseiller et chargé de clientèle sont cochées deux fois :
sur poste et sur un téléphone Android en navigateur.

Téléconseiller et chargé de clientèle : connexion par e-mail et par nom
d'utilisateur ; ouvrir une fiche, brouillon, verrou « une fiche à la fois »,
libération ; qualifier (script, statut, motif, personne proposée, rappel
promis, prospects promis) ; ajouter un prospect avec doublon nommant le
propriétaire ; convertir (méthode, rendez-vous, champs ajoutés, note vocale
enregistrée puis réécoutée) ; rappels du jour ; mes contacts ; suggestions ;
fiche représentant avec toute l'histoire ; fiche prospect ; WhatsApp ; note
vocale refusée sans micro, sans permission, au-delà de 2 minutes.

Superviseur et direction : tableau de bord et disposition ; activité et
présence ; fiches restées ouvertes ; campagnes ; représentants et prospects ;
listes de référence ; paramètres CHUES ; export classeur ; créneaux de
travail ; écoute d'une note vocale.

Banque & Finance : vue d'ensemble ; dossier ouvert, avancé, rejeté, encaissé ;
export ; demandes de création et refus notifié.

Accueil : visite saisie ; tableau de bord ; impression ; import et revue.

Admin : compte créé, promu, désactivé avec reprise, supprimé ; dernier admin
refusé ; mot de passe réinitialisé ; imports représentants (système à jobs),
prospects, Grand Public, registre, reprise après redéploiement ;
notification envoyée, programmée, annulée ; plateformes d'enrôlement ; purge
après sauvegarde ; dump.

Transverse : anciennes adresses en 301 ; liens des notifications déjà
envoyées sur les deux domaines ; mots de passe actuels ; limiteurs (connexion
10/min, formulaire public 5/min compté par adresse réelle, imports 5/min) ;
formulaire public avec Turnstile ; SSE sur 4 topics ; compte désactivé coupé
à la requête suivante ; sessions révoquées au changement de mot de passe ;
requête sans `Origin` refusée ; champ inconnu refusé ; export
`consolidated` à 500 000 lignes sans dépassement mémoire.

## 7. Jour de bascule

Production réelle : Dokploy + Traefik + Cloudflare, applications `cpi-go-api`
et `cpi-go-web` (`infra/dokploy/deploy.py`), sauvegarde nocturne Dokploy vers
S3 au format `pg_dump -Fc`. Le `Caddyfile` et `backup.sh` du dépôt ne servent
pas en production.

1. J-3 : message aux téléconseillers : à partir de J, le panneau sur le
   téléphone remplace l'application ; synchroniser et vider « À corriger »
   avant J.
2. J-1 : pour chaque téléconseiller, dernier lot dans `sync_batches` et
   file vide confirmée de vive voix. Une file non vide à J est perdue.
3. J, 1. Sauvegarde Dokploy déclenchée, fichier téléchargé hors du VPS,
   restauration vérifiée sur la machine de travail.
4. J, 2. Arrêt de `cpi-go-api` et `cpi-go-web` dans Dokploy. Vérification
   que `sync_batches` n'a plus de lot `IN_PROGRESS` ni `import_jobs` en cours.
5. J, 3. Déploiement de `apps/go` par `deploy.py` (Dokploy n'a pas de
   webhook, le job CI `deploy` fait de même sur `prod`), volumes
   `call-recordings` et `imports` créés, deux domaines rattachés. goose
   applique la seule migration du jour : fonction et 37 triggers `updatedAt`.
   Les variables `JWT_*` et `REDIS_URL` restent posées. Vérification :
   connexion e-mail et nom d'utilisateur, un rôle par espace, SSE, présence,
   `docker stats` comparé à la preuve B.
6. J, 4. Un téléphone de test : qualification complète depuis le navigateur,
   note vocale enregistrée et réécoutée.
7. J, 5. Ouverture générale. L'application mobile v1 répond « serveur
   indisponible » ; elle est désinstallée par les téléconseillers.
8. J+7 : migration goose de nettoyage, sans `Down`, dans cet ordre :
   `sync_operations`, `sync_batches`, types `OperationResult` et
   `BatchStatus`, `device_call_detections`, `android_releases`. Retrait des
   variables `JWT_*`, `REDIS_URL`, du conteneur Redis et du volume
   `cpi-go-releases`.

Retour arrière, jusqu'à J+7 : arrêt de `apps/go`, redémarrage de `cpi-go-api`
et `cpi-go-web` sur la même base. `goose_db_version`, les triggers
`updatedAt` (Prisma envoie la valeur, le trigger la réécrit à l'identique) et
les sessions v2 dans `refresh_tokens` ne gênent pas la v1. Le schéma `demo`
n'existe plus (phase 0). Après le nettoyage de J+7, la v1 ne démarre plus.

## 8. Risques

Registre complet : `risques.md`. Les premiers :

| Risque                                                     | Preuve                                                 | Parade                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Restauration jamais faite                                  | `docs/migrations-en-attente.md:50-54`                  | Première tâche de la phase 0                                                                        |
| 56 requêtes brutes assemblées à l'exécution, pas 0         | `audits/go-donnees.md` §1                              | pgx direct pour les 39 agrégats, une requête par variante pour 12, `narg` keyset ; preuve A élargie |
| Saisies mobiles encore en file à J                         | outbox locale                                          | J-3 et J-1 du runbook ; perte acceptée au go/no-go                                                  |
| Écrans téléconseiller inutilisables au pouce               | `rep-script.tsx` 1 728 l., `console-view.tsx` 1 069 l. | Preuve C ; refonte 390 px en phase 2 ; checklist sur téléphone                                      |
| `MediaRecorder` produit un conteneur inattendu sur le parc | doc MDN, non mesuré                                    | Preuve C relève `isTypeSupported` ; serveur accepte webm et mp4 ; repli commentaire écrit           |
| Choix de Go sans mesure préalable                          | `audits/donnees-infra.md` §4                           | Preuve B ; RSS et latence comparées en phase 7 et à J                                               |
| Exports xlsx, pdf, zip réécrits                            | `apps/api/package.json`                                | excelize `StreamWriter`, maroto, `archive/zip` ; chaque export dans la checklist                    |
| 197 entrées de `roles.go` à remplir depuis 35 contrôleurs  | `audits/go-securite.md` §2                             | assertions au démarrage ; parcours matrice généré                                                   |
| Deux systèmes d'import de représentants                    | `representants-import.ts:21`, `imports.ts:99`          | un seul, celui à jobs ; plafond 5 000 lignes à vérifier                                             |
| Gel de trois semaines                                      | §2.1                                                   | correctifs prod sur `prod`, reportés dans `v2` chaque soir                                          |

## 9. Points restant à valider par le propriétaire

- Suppression de Redis (§2.1) : la ligne « Infra conservée » du 7 septembre
  le gardait.
- `POST /bank-cases/{id}/corrections` et
  `POST /notification-templates/{id}/render` : aucun écran v1 ne les appelle
  (`audits/go-api.md` A4). Soit l'écran manquait et il est à construire
  (~120 lignes de SPA chacun), soit les lignes « dossier corrigé » et
  « gabarit rendu » sortent de la checklist. Par défaut : routes portées,
  écrans non construits, lignes retirées.
- Notes vocales sur les appels représentants en plus de la conversion : non
  par défaut, périmètre du mobile.
- Plafond de 5 000 lignes de l'import tout-ou-rien : contrainte métier ou
  simple limite technique.
- Volumes réels par table sur la copie de prod.
- Qui coche la checklist par rôle, et sur quel téléphone.
