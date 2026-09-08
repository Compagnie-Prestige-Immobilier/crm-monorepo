# Audit architecture Go et sécurité

Lecture seule, 8 septembre 2026. Un seul défaut v1 exploitable confirmé (§3,
limite multipart globale à 500 Mo) ; le reste est de la parité et des trous de
configuration.

## 1. Authentification et session

| Comportement v1 | Preuve | v2 |
| --- | --- | --- |
| Identifiant e-mail ou nom d'utilisateur, insensible à la casse, `deletedAt: null` | `auth.service.ts:50-58` | identique, `lower()` en SQL |
| Condensat factice si identifiant inconnu (anti-énumération temporelle) | `auth.service.ts:23-27,60-61` | obligatoire : `ComparePasswordAndHash` sur un PHC constant calculé au boot |
| argon2id `m=19456, t=2, p=1` | `password.ts:5-10` | mêmes paramètres, sinon l'admin semé devient invérifiable |
| Politique 8 à 24 | `password-policy.ts:16-17` | tags huma |
| Rotation refresh + révocation de famille au rejeu | `auth.service.ts:86-151` | disparaît : jeton opaque non rotatif, `familyId` = `id` |
| SHA-256 nu du refresh | `auth.service.ts:16-19` | identique |
| Rôle relu en base à chaque requête | `fresh-session.guard.ts:17-56` | conservé, cache mémoire 30 s |
| Révocation à la désactivation, au changement de rôle, à la suppression, à la réinitialisation admin | `users.service.ts:226,352,394,403` | `UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL` |
| Changement de son propre mot de passe : aucune révocation | `auth.service.ts:196-200,222-233` | à corriger : révoquer toutes les sessions sauf la courante, 1 ligne |
| `dev-login`, 404 hors développement | `app/api/auth/dev-login/route.ts:31-33`, défauts en dur `:22,26` | supprimé (voir `go-web.md` §9) |
| Throttle login 10/60 s | `auth.controller.ts:30` | conservé ; `AUTH_LOGIN_RATE_LIMIT` (`env.ts:61`, `deploy.py:581`) n'est jamais lue en v1 : la lire |

CSRF : `SameSite=Lax` seul ne suffit pas (OWASP CSRF Prevention Cheat Sheet :
défense en profondeur, pas un remplacement ; un sous-domaine reste same-site
et `cpi-chues.com` porte déjà deux hôtes, `deploy.py:82-83`). Recommandation :
cookie `__Host-cpi_session` `HttpOnly; Secure; SameSite=Lax; Path=/` sans
`Domain`, plus un middleware de 12 lignes qui, sur toute méthode hors
`GET/HEAD/OPTIONS`, exige `Origin` (à défaut `Referer`) égal à l'origine
servie, 403 sinon. Pas de jeton double soumission, pas de `X-Requested-With`.

Durée fixe 30 jours (`env.ts:60`), pas de session glissante, pas de limite de
sessions par compte. Cookie `Secure` posé inconditionnellement (Go voit du HTTP
derrière Traefik) ; `X-Forwarded-For` lu seulement si `API_TRUST_PROXY_HEADERS`,
dernier élément seulement ; `CF-Connecting-IP` préféré s'il est présent.

## 2. Autorisation

155 `@Roles(` sur 35 fichiers plus 48 appels `isAdmin`/`readsEveryone`/
`assertOwnership`/`attributionScope`/`ownerScope`. Piège v1 : `getAllAndOverride`
fait qu'un `@Roles` de méthode remplace celui de la classe
(`roles.guard.ts:13-17`, documenté `client-requests.controller.ts:34-35`).

`roles.go` : `map[string][]Role` dont la clé est `r.Pattern` (motif `ServeMux`
apparié, Go 1.23+). Deux assertions au démarrage, ~20 lignes : toute route
enregistrée (`api.OpenAPI().Paths`) absente de la table → `log.Fatal` ; toute
entrée sans route → `log.Fatal`. Parcours « matrice des rôles » : `go run
./apps/go -roles` écrit `{pattern: [roles]}` sur stdout, non commité, produit
en CI avant Playwright ; la spec itère et attend 403 ou 401.

Cas hors table, dans le SQL ou le handler : propriété de la fiche (`WHERE
created_by_id = $2`, 0 ligne → 403), portée de lecture (paramètre
`$scope_all`), `CHARGE_CLIENTELE` sur `CONVERTI`, dernier admin (`SELECT
count(*) … FOR UPDATE` dans la transaction), transitions (`common/transitions.ts:23-64`).

## 3. Entrées

| Sujet | v1 | v2 |
| --- | --- | --- |
| Limite multipart globale | `bootstrap.ts:104-106` : `fileSize: APK_MAX_SIZE_BYTES`, 500 Mo par défaut (`env.ts:75`), pour toutes les routes multipart ; les imports rebornent à 25 Mo après coup (`imports/import-file.store.ts:39-48`) | `http.MaxBytesReader` par route, 25 Mo imports (`imports.env.ts:8-13`), plafond notes vocales |
| Type MIME | déclaré par le client, jamais sniffé (`recordings.service.ts:23`, `import-file.store.ts:37` n'y teste rien) | `http.DetectContentType` sur 512 octets plus ouverture réelle par excelize ; WebM `\x1aE\xdf\xa3` |
| Traversée de chemin | correcte : `resolve` + `basename` d'un UUID serveur (`import-file.store.ts:36-38`, `phase2.controller.ts:66`) | aucun nom client dans un chemin, `filepath.Join(dir, id.String()+ext)` |
| `pg_dump` | `spawn` sans shell, arguments constants, connexion par `PG*` (`db-dump.runner.ts:18-23,34-37`) | `exec.CommandContext`, `cmd.Env = pgEnv`, jamais `DATABASE_URL` en argument |
| Formulaire public | Turnstile obligatoire sauf `TURNSTILE_ALLOW_DEGRADED` (`turnstile.ts:38-49`), 5/60 s écriture, 30/60 s lecture (`formulaire-public.controller.ts:24,41`), champ piège | identique, refus par défaut sans clé |
| Téléphone | `common/phone.ts`, région `SN`, préfixes `00`/`221` | `nyaruka/phonenumbers` avec la même canonisation, à vérifier ligne à ligne |
| Injection de formule | CSV client protégé (`lib/csv.ts:1-16`) ; xlsx écrit en chaînes par ExcelJS, non évalué | excelize `SetCellStr`, jamais `SetCellValue` ; garde `csv.ts` reporté |

Notes vocales : liste MIME élargie (`audio/webm`, `audio/mp4`), vérification
par contenu, rétention 48 h et cron (`env.ts:102`, `recordings.service.ts:34`).
~150 l. Go, 1 volume, 1 cron.

## 4. En-têtes et transport

| Sujet | Décision |
| --- | --- |
| helmet | `bootstrap.ts:102` ; en Go, 6 en-têtes à la main |
| CSP | `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'` ; `unsafe-inline` à vérifier au premier build |
| HSTS | posé par Caddy qui ne tourne pas en prod (`Caddyfile:45`) : le poser dans le binaire, `max-age=31536000; includeSubDomains` |
| CORS | inutile, même origine ; supprimer `API_CORS_ORIGINS` ; `PUBLIC_WEB_URL` à garder si les liens de notification en dépendent |
| WebSocket | remplacé par un beat HTTP (`go-api.md` A2) ; plus de dépendance |
| SSE | même cookie, même middleware d'`Origin` |
| Corps | `http.MaxBytesReader` 4 Mio global (`bootstrap.ts:44`), dérogation par route |
| Timeouts | `ReadHeaderTimeout: 10s`, `ReadTimeout: 30s`, `IdleTimeout: 120s`, `WriteTimeout: 0` (exports et SSE) ; contrôle par `context` |
| Arrêt propre | `srv.Shutdown(ctx)` 30 s sur `SIGTERM`, crons annulés, pool fermé |

## 5. Secrets et configuration

Gardées : `PORT`, `LOG_LEVEL`, `DATABASE_URL`, `DATABASE_POOL_SIZE`,
`BUSINESS_TIME_ZONE`, `PHONE_DEFAULT_REGION`, `PASSWORD_MIN_LENGTH`,
`PASSWORD_MAX_LENGTH`, `API_TRUST_PROXY_HEADERS`, `DB_DUMP_DIR`,
`DB_DUMP_ENABLED`, `CALL_RECORDING_DIR`, `CALL_RECORDING_MAX_SIZE_BYTES`,
`CALL_RECORDING_RETENTION_HOURS`, `PLATEFORME_*`, `IMPORTS_*`,
`NOTIFICATIONS_*`, `BREVO_*`, `TURNSTILE_*`, `SEED_ADMIN_*`, `AUTH_LOGIN_RATE_LIMIT`.
Supprimées : `JWT_*` (3), `REDIS_URL`, `APK_*` (4), `SYNC_MAX_BATCH_SIZE`,
`IDEMPOTENCY_TTL_DAYS`, `DEMO_WORKSPACE_ENABLED`, `API_CORS_ORIGINS`,
`API_DOCS_ENABLED`, `NEXT_PUBLIC_API_URL`, `API_INTERNAL_URL`, `API_URL`,
`SHOREBIRD_TOKEN`. Ajoutée : `SESSION_TTL_DAYS`. Les secrets restent dans
l'environnement Dokploy (`deploy.py:569-606`, `.secrets.generated`), rien dans
l'image ; `gitleaks` tourne déjà (`security.yml:53-71`). `JWT_*` restent posés
jusqu'à J+7 pour le retour arrière.

## 6. Image et déploiement

Étapes : `node:24-bookworm-slim` (types OpenAPI puis `dist/`),
`golang:1.27-bookworm` (`CGO_ENABLED=0 -trimpath -ldflags="-s -w"`, `embed`
de `dist/`), `debian:bookworm-slim` + bloc PGDG de `Dockerfile.api:115-133`
pour `pg_dump` 18, `useradd --uid 10001`, `mkdir` + `chown` des volumes avant
`USER` (`Dockerfile.api:170-172`). Taille 140 à 160 Mo. `HEALTHCHECK CMD
["/cpi", "-healthcheck"]` (absent aujourd'hui, `GET /health/ready` existe,
`bootstrap.ts:117`). Volumes : `cpi-go-db-dumps` conservé (`deploy.py:654`),
`cpi-go-releases` conservé jusqu'à J+7, `call-recordings` ajouté, imports
ajouté (`IMPORTS_DIR=./storage/imports`, `imports.env.ts:4`, non monté
aujourd'hui : un redéploiement pendant un import perd le fichier). `deploy.py`
: une application `cpi-go`, les deux domaines gardés sur elle (liens de
notification déjà envoyés).

## 7. CI

| Job | Étapes |
| --- | --- |
| `go` | `go vet` · `golangci-lint run` (errcheck, govet, staticcheck, ineffassign, unused, gosec, bodyclose, rowserrcheck, sqlclosecheck) · `sqlc vet` · `go build` · `govulncheck` |
| `web` | `tsc --noEmit` · `oxlint` · `vite build` |
| `securite` | `security.yml` tel quel, semgrep `p/golang` à la place de `p/typescript,p/nodejs`, `p/jwt` retiré |
| `deploy` | inchangé |

Tests d'intégration Go : `//go:build integration`, un fichier par domaine,
`httptest.Server` sur le vrai mux, vrai pool, base migrée par goose et semée,
aucun mock. Portillon : tout `apps/go/*_test.go` dont la première ligne n'est
pas `//go:build integration` fait échouer la CI ; à casser une fois pour
prouver qu'il rougit.

## 8. Observabilité

`slog` JSON, `X-Request-Id` accepté si `^[\w-]{1,64}$` sinon UUID
(`bootstrap.ts:57-60`), jamais le corps ni l'URL en clair (`r.Pattern`, pas
`r.URL.Path`), masquage de `app.module.ts:82-104` dont `phoneE164`. Audit :
une fonction prenant `pgx.Tx`, jamais le pool (`common/audit.ts`), 13
constantes. Pas de Prometheus ni d'OpenTelemetry.

## 9. Structure du package

Ajouter `middleware.go` (session, garde, `Origin`, limiteurs,
`MaxBytesReader`, journal, `recover`), `cache.go`, `errors.go`, `brevo.go`
à côté de `notifications.go`. Cache mémoire à la main, ~45 l. : la v1 est un
cache à invalidation par version de groupe (`cache.interceptor.ts:58-62`),
qu'aucun package Go ne fournit ; clé `groupe:version:scope:url`, `scope` = rôle
si `readsEveryone` sinon identifiant utilisateur, à conserver exactement.
Limiteurs : `map[string]*rate.Limiter` + éviction 10 min, ~30 l. Erreurs :
`huma.NewError` écrasé, ~25 l. `context` propagé jusqu'à pgx ; `gocron.Shutdown()`
avant `srv.Shutdown()`.

## 10. Arbitrages

| # | Arbitrage | Recommandation | Coût |
| --- | --- | --- | --- |
| A2 | CSRF | cookie `__Host-` + vérification d'`Origin` | 12 l. |
| A3 | Révocation au changement de son propre mot de passe | corriger | 1 requête |
| A4 | Limite multipart 500 Mo | `MaxBytesReader` par route | 3 l. |
| A5 | HSTS | dans le binaire | 1 l. |
| A6 | Volume imports | ajouter dans `deploy.py` | ~8 l. |
| A7 | Healthcheck | `HEALTHCHECK` + `-healthcheck` | ~10 l. |
| A8 | Deux domaines | garder les deux | 1 appel |
| A9 | Secrets JWT en prod | laisser jusqu'à J+7 | 0 |
| A10 | `AUTH_LOGIN_RATE_LIMIT` | la lire | 1 l. |
| A11 | Session glissante | non | 0 |
| A12 | Limite de sessions | non | 0 |
| A13 | `r.Pattern` + assertions au démarrage | oui | ~20 l. |
| A14 | Cache à la main | oui | ~45 l. |

## Hypothèses et non vérifié

Vite ne pose aucun script inline en production (sinon nonce CSP). Rien
exécuté : ni build, ni scanner. Configuration Cloudflare et Traefik hors
dépôt. Versions Go à vérifier au premier `go mod tidy` avec `govulncheck`.
`nyaruka/phonenumbers` contre `common/phone.ts` : comparaison à exécuter sur
des numéros réels. Les 35 contrôleurs n'ont pas été relus un à un ;
l'exhaustivité de `roles.go` repose sur l'assertion de démarrage.
