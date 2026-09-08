# Registre des risques v2

Consolidé le 8 septembre 2026 à partir de `plan.md` version 3 et des cinq
audits. Gravité : B = bloquant pour la bascule, H = haute, M = moyenne. Phase =
où le risque est traité. État : ouvert, couvert (parade décidée), fermé
(preuve faite).

## 0. Réévaluation du 8 septembre

- Version 3.1 : quatre audits de portage Go (`audits/go-*.md`). R23 à R32
  ajoutés ; R10 réécrit (beat HTTP au lieu du WebSocket).
- Version 3 du plan : l'application mobile est abandonnée. Les risques liés à
  PowerSync, aux buckets, à `uploadData`, à la téléphonie native, à l'APK, à
  Shorebird et au vidage des bases locales sont retirés. Les numéros
  repartent de 1.
- Version 2.2 : backend en Go, panneau SPA embarqué, sqlc et goose sur du SQL
  pur, sessions dans `refresh_tokens`.
- Le clone principal est aujourd'hui sur `prod`, 25 commits devant
  `origin/dev`, avec des modifications locales non commises. Le travail v2
  dans un worktree séparé (`plan.md` §0) évite qu'une bascule de branche
  emporte ce genre d'en-cours.
- Le déploiement prod passe par le job CI `deploy` et `deploy.py redeploy`,
  Dokploy n'ayant pas de webhook (`audits/donnees-infra.md` §4).

## 1. Bloquants pour la bascule

| N° | Risque | Preuve | Parade | Phase | État |
| --- | --- | --- | --- | --- | --- |
| R1 | Restauration de sauvegarde jamais exécutée | `docs/migrations-en-attente.md:50-54`, `infra/README.md:243-248` | Première tâche de la phase 0, avant toute autre | 0 | ouvert |
| R2 | Saisies mobiles encore en file à J, perdues à l'arrêt de la v1 | outbox locale (`audits/mobile.md`), `heartbeat` ne mesure pas la file (`presence-socket.service.ts:28-35`) | J-3 message, J-1 vérification par téléconseiller dans `sync_batches` ; perte acceptée par écrit au go/no-go | 7 | ouvert |
| R3 | Le schéma de référence v2 diverge de la base réelle (20 CHECK, 12 index partiels, index fonctionnel) | `audits/donnees-infra.md` §2 | `sql/schema.sql` est le `pg_dump --schema-only` de la copie de prod ; sqlc compile chaque requête contre lui, preuve A | 0 | couvert |
| R4 | Écrans téléconseiller inutilisables au pouce sur téléphone | `RepScript` 1 705 lignes, `ConsoleView` 1 061 lignes (`audits/web.md` §1) | Preuve C sur Android réel en phase 0 ; conception en largeur téléphone d'abord en phase 2 ; checklist cochée sur téléphone | 0, 2, 7 | ouvert |
| R5 | Schéma `demo` migré à chaque démarrage, retour arrière impossible avec lui | `api-entrypoint.sh:35-44` | Suppression en phase 0 par la release v1 | 0 | couvert |
| R6 | 155 `@Roles` et 48 contrôles de portée à reporter sans en perdre un | `audits/go-securite.md` §2 | `roles.go` clé `r.Pattern`, deux assertions au démarrage, parcours « matrice » généré par `-roles` | 1, 7 | couvert |
| R23 | `POST /sync/push` est le seul chemin d'écriture d'une qualification prospect du panneau ; le supprimer sans remplaçant casse le geste central | `console.ts:849`, `audits/go-api.md` §0 | `POST /phase2/call-attempts`, idempotent par `attemptId`, règles de `phase2-sync.service.ts` reprises ; parcours 5 | 2 | couvert |
| R24 | 56 requêtes brutes sont assemblées à l'exécution ; `sqlc.narg` sur `prospects` (500 000 lignes) perd les index partiels | `audits/go-donnees.md` §1 | pgx direct avec assemblage de 40 lignes pour les 39 agrégats et le tri bancaire ; une requête par variante pour 12 ; preuve A élargie | 0, 2 | ouvert |

## 2. Hauts

| N° | Risque | Preuve | Parade | Phase | État |
| --- | --- | --- | --- | --- | --- |
| R7 | Choix de Go sans mesure de consommation préalable | `audits/donnees-infra.md` §4 : aucune limite ni relevé | Preuve B (`docker stats` sur la prod) ; RSS du binaire relevée en phase 1 et comparée | 0, 1 | ouvert |
| R8 | Exports xlsx, pdf, zip réécrits sans les bibliothèques JS ; export `consolidated` à 500 000 lignes | `apps/api/package.json`, `export.service.ts:199-231` | excelize `StreamWriter` vers `http.ResponseWriter`, maroto, `archive/zip` ; mémoire relevée sur la copie de prod ; chaque export dans la checklist | 2, 6 | ouvert |
| R9 | Sept crons à héberger dans le même processus que l'API | `imports.cron.ts:44`, `reminders.service.ts:96,137,191`, `db-dump.service.ts:110`, `enrolement.service.ts:188`, `recordings.service.ts:35` | gocron dans `main.go`, `gocron.Shutdown()` avant `srv.Shutdown()` | 1 | couvert |
| R10 | Présence sans source une fois le mobile retiré : aucun client WebSocket dans `apps/web` | `logs/api.2.log` (UA Dart seul), `audits/go-api.md` §0 | `POST /presence/beat` toutes les 60 s depuis la SPA, `UPSERT agent_heartbeats` ; pas de WebSocket ; ligne de checklist | 1 | couvert |
| R25 | `MediaRecorder` produit un conteneur que le serveur refuse (v1 n'accepte que `audio/mp4`) | `recordings.service.ts:23`, doc MDN | Serveur accepte `audio/webm` et `audio/mp4`, vérification par contenu ; preuve C relève `isTypeSupported` sur le parc ; repli commentaire écrit | 0, 2 | ouvert |
| R26 | Cookie `SameSite=Lax` seul ne suffit pas contre le CSRF (sous-domaines same-site, navigations de premier niveau) | OWASP CSRF Cheat Sheet, `deploy.py:82-83` | Cookie `__Host-` sans `Domain` + vérification d'`Origin` sur toute méthode d'écriture ; ligne de checklist | 1 | couvert |
| R27 | Limite multipart globale à 500 Mo héritée de la v1 | `bootstrap.ts:104-106`, `env.ts:75` | `http.MaxBytesReader` par route, `MultipartReader` en flux | 1 | couvert |
| R28 | Comptage du dernier ADMIN non verrouillé : deux rétrogradations simultanées vident les ADMIN | `users.service.ts:158` | `SERIALIZABLE` ou `FOR UPDATE` sur les trois gestes ; ligne « dernier admin refusé » | 6 | couvert |
| R29 | `updatedAt` : 37 colonnes sans DEFAULT ni trigger, pgx ne les remplit pas ; deux index en dépendent | `init/migration.sql:31`, `schema.prisma:942` | Trigger `BEFORE INSERT OR UPDATE` par table, migration goose au jour J, compatible v1 | 7 | couvert |
| R30 | `minPayloadVersion` filtre les statuts de qualification pour le panneau ; supprimer la colonne découvre des codes inconnus | `statuts-qualification.service.ts:110-113`, `statuts-qualification.ts:20` | Colonne gardée, paramètre retiré, tous les statuts actifs servis | 2 | couvert |
| R31 | Volume des imports jamais monté : un redéploiement pendant un import perd le fichier | `imports.env.ts:4`, `deploy.py` | Volume `imports` ajouté ; ligne « reprise après redéploiement » | 1 | couvert |
| R32 | `nyaruka/phonenumbers` ne canonise pas les préfixes `00`/`221` comme `common/phone.ts` : déduplication aléatoire sur la base existante | `common/phone.ts:24-46,50-72` | `canonicalizePrefix` recopiée ; comparaison sur les numéros réels de la copie de prod en phase 2 | 2 | ouvert |
| R11 | Rejeu de refresh token plus détecté | `auth.service.ts:119-128` | Jeton opaque unique de 30 jours haché dans `refresh_tokens`, révoqué à la déconnexion ; rôle relu à chaque requête | 1 | couvert |
| R12 | Deux systèmes d'import de représentants en v1 | `representants-import.service.ts`, `imports/representants.adapter.ts:20-64` | Un seul système à jobs en v2 | 6 | couvert |
| R13 | Gel de trois semaines, correctifs prod à reporter | `plan.md` §2 | Report chaque soir par merge de `origin/prod` dans le worktree v2 | toutes | couvert |
| R14 | Quatre limiteurs de débit à reproduire (600/min, 300/min, login 10/min) | `bootstrap.ts:103`, `app.module.ts:107-109` | Un seul limiteur en v2 avec trois règles nommées ; ligne de checklist | 1 | couvert |
| R15 | Invalidation de cache couplée au SSE : un handler qui oublie `bump` perd une invalidation | `redis/cache.interceptor.ts:58-62` | Cache mémoire dans le processus Go ; une fonction `invalidate(group)` unique appelée par les handlers d'écriture ; parcours Playwright sur les référentiels | 1 | couvert |
| R16 | Dumps sur volume : `pg_dump` 18 dans l'image | `db-dump.runner.ts:25-34` | `postgresql-client-18` dans le Dockerfile v2 | 1, 6 | couvert |

## 3. Moyens

| N° | Risque | Preuve | Parade | Phase | État |
| --- | --- | --- | --- | --- | --- |
| R17 | Deux routes de la checklist sans aucun écran v1 (`corrections`, `render`) | `audits/go-api.md` A4 | Point §9 de `plan.md` ; par défaut routes portées, lignes retirées de la checklist | 2, 6 | ouvert |
| R18 | Formulaire public avec Turnstile oublié du périmètre v1 | `formulaire-public.controller.ts:50-59` | Phase 3, ligne de checklist | 3 | couvert |
| R19 | Volumes réels par table inconnus hors `prospects` et `representants` | aucun chiffre en dépôt | Comptage sur la copie de prod en phase 0 | 0 | ouvert |
| R20 | Ports de développement des deux worktrees en collision | `plan.md` §0 | v2 sur 4000, 5173, 5435 ; `.env.example` de `apps/go` | 1 | couvert |
| R21 | Colonnes mortes (`users.departementId`, `device_tokens`, `notifications.payload`) reprises telles quelles dans `sql/schema.sql` | `docs/migrations-en-attente.md` §1-2 | Migration de suppression en phase 0, avec la release v1, avant le `pg_dump` de référence | 0 | couvert |
| R22 | Nettoyage de J+7 rend la v1 indémarrable | `plan.md` §7 | Retour arrière borné à J+7, écrit dans le runbook et accepté au go/no-go | 7 | couvert |
