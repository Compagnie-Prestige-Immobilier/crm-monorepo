# Audit v2 : critique adversariale de la version 1 du plan (7 septembre 2026)

Le plan critiqué ici est la version 1 de `../plan.md` ; ses erreurs et manques
ont été intégrés dans la version 2.1.

Périmètre lu : le plan en entier, `apps/api/src` (31 modules, 233 décorateurs de route), `apps/web/src/app` (62 `page.tsx`), `apps/mobile/lib` + `apps/mobile/android`, `packages/database/prisma`, `infra/`, `docs/`. Vérifications externes : documentations officielles PowerSync, Better Auth, Drizzle, Next.js (URLs en fin de note). Les points E3, E4, E6, E11, E12 et B11 ont été revérifiés à la main dans le code après réception.

## 1. Erreurs factuelles du plan

### E1. « uploadData suffit, c'est le même code que les handlers du panneau »

Plan §3 : « un handler Next par entité les applique, c'est le même code que les handlers du panneau ».

PowerSync documente que renvoyer un 4xx depuis `uploadData` bloque la file d'envoi du client : « Validation/conflicts (4xx): avoid error responses as they block the PowerSync client's upload queue ». Il faut renvoyer 2xx et transporter l'erreur dans le corps ou dans une table synchronisée.

Le moteur actuel est construit sur l'inverse : il traduit les exceptions en verdicts de corps, `apps/api/src/modules/sync/sync.service.ts:222-244` (« le push ne renvoie jamais d'erreur HTTP pour une opération isolée, sous peine de condamner les 199 autres du lot »), `OperationError` `:102-112`, cinq statuts `:93-100` (`applied`, `duplicate`, `conflict`, `invalid`, `skipped_dependency_failed`).

Les handlers du panneau lèvent : `PROSPECT_PHONE_CONFLICT` (`sync.service.ts:1982-1987`), `REPRESENTANT_PHONE_CONFLICT` (`:2052-2056`), `REV_CONFLICT` (`:1781-1789`), `PHASE2_ALREADY_COMPLETED` 409 (`phase2-sync.service.ts:111-117`), `PHASE2_NOT_ASSIGNED` 403 (`:105-109`), `OUVERTURE_FICHE_DEJA_OUVERTE` 409 (`ouvertures.controller.ts:51-55`), `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD` 422 (`sync.service.ts:312-318`). Réutiliser ces handlers tels quels bloque la file d'un téléphone au premier doublon de numéro.

### E2. Six entités d'écriture annoncées, douze réelles

Plan §3 : `representants`, `prospects`, `rep-call-attempts`, `call-attempts`, `comments`, `device-calls`.

`SyncEntity` (`apps/api/src/modules/sync/dto.ts:78-85`) : `representant`, `representant_comment`, `prospect`, `call_attempt`, `visite`, `appel_detecte`. `rep_call_attempt` et `ouverture` sont des routes dédiées (`apps/mobile/lib/core/sync/sync_engine.dart:24-39`, `rep-campaigns.controller.ts:20-34`). Chemins d'écriture hors file (`apps/mobile/lib/core/sync/api_port.dart:210-321`) :

| Écriture                          | Route                                         | Ligne               |
| --------------------------------- | --------------------------------------------- | ------------------- |
| `ouvrirFiche`                     | `POST /v1/ouvertures`                         | `api_port.dart:252` |
| `enregistrerBrouillonOuverture`   | `PUT /v1/ouvertures/:id/brouillon`            | `:258`              |
| `uploadCallRecording` (multipart) | `POST /v1/phase2/call-attempts/:id/recording` | `:263`              |
| `updateVisite`                    | `PATCH /v1/visites/:id`                       | `:311`              |
| `changeMyPassword`                | `PUT /v1/auth/me/password`                    | `:222`              |

### E3. Le WebSocket de présence est omis

`apps/api/src/bootstrap.ts:67` (`register(websocket)`), `:78` (`http.get('/api/v1/presence/live', { websocket: true })`). Consommé par le mobile : `apps/mobile/lib/core/providers/sync_coordinator.dart:313-324`. Alimente `heartbeat`, donc l'écran « activité et présence » de la checklist. Next.js ne sert pas de WebSocket dans un route handler et le serveur `standalone` ne transmet pas l'en-tête Upgrade : serveur Node personnalisé ou service séparé.

### E4. Aucune tâche planifiée mentionnée, il y en a sept

| Tâche                                    | Fichier:ligne                           | Fréquence           |
| ---------------------------------------- | --------------------------------------- | ------------------- |
| Balayage des imports Excel               | `imports/imports.cron.ts:44`            | chaque minute       |
| Expédition des notifications programmées | `notifications/reminders.service.ts:96` | chaque minute       |
| Rappels métier                           | `reminders.service.ts:137`              | cron, fuseau métier |
| Compte rendu de fin de journée           | `reminders.service.ts:191`              | cron, fuseau métier |
| Balayage des dumps                       | `db-dump/db-dump.service.ts:110`        | 10 min              |
| Purge des notes vocales                  | `phase2/recordings.service.ts:35`       | 1 h                 |
| Tirage des plateformes d'enrôlement      | `enrolement/enrolement.service.ts:188`  | chaque minute       |

Next.js auto-hébergé n'a aucun ordonnanceur.

### E5. « Jeton JWT à durée longue pour PowerSync » est impossible

Documentation PowerSync : le JWT doit expirer en 24 h ou moins, 60 min recommandées, `iat` et `exp` obligatoires, et un JWT âgé de plus de 60 minutes est refusé à la connexion. La parade du plan §8 ne couvre pas « session expirée pendant une journée hors ligne ».

### E6. « Règles de sync par rôle » change le comportement, ce n'est pas la parité

`sync.service.ts:265-267` : `mineOrAssignedRepresentant` rend `{}` dans les deux branches. Tout le monde reçoit tout l'annuaire, assumé en `:253-257`. Pour les prospects, `apps/api/src/common/scope.ts:66-74` : « Portée des prospects sur le TÉLÉPHONE : aucune. Le tirage est GLOBAL et c'est l'appareil qui filtre, sans quoi une réattribution de campagne effacerait des fiches déjà ouvertes hors ligne ». Le filtre vit sur l'appareil via `mes-attributions` (`api_port.dart:286-292`).

### E7. `drizzle-kit pull` ne reproduit pas ce schéma

Drizzle ORM sait exprimer `check()`, `.where()` et les index d'expression ; `drizzle-kit pull` ne sait pas les lire : CHECK non générés (drizzle-orm#3520), index UNIQUE partiel mal interprété (#6145), index fonctionnel rendu `sql.raw("true")` (#5224). Le dépôt utilise les trois : `20260812122400_partial_unique_phone/migration.sql:12-18`, `20260823180000_index_trigramme_unaccent/migration.sql:19-35` (fonction `immutable_unaccent()`, opclass `public.gin_trgm_ops`). Ni les extensions, ni la fonction, ni le schéma `demo` ne sortent d'un `pull`.

### E8. Le runbook cite `backup.sh`, qui ne tourne pas en production

`infra/README.md:284-285`, `docker-compose.prod.yml:1-8`. La sauvegarde de prod est le routeur Dokploy vers S3, `pg_dump -Fc`, à restaurer avec `pg_restore` (`infra/README.md:117-120`, `:186-192`).

### E9. « Arrêt de `cpi-go-api` et `cpi-go-web` » décrit une infra qui n'est pas la production

Prod = Dokploy + Traefik (`infra/README.md:10-15`, `infra/dokploy/deploy.py`). Le `Caddyfile` ne sert rien en prod. Le runbook ne dit pas comment exposer `powersync-service` derrière Traefik puis Cloudflare.

### E10. L'espace démo est un second schéma migré à chaque démarrage

`api-entrypoint.sh:35-44` rejoue `migrate deploy` sur `demo` à chaque boot et refuse de démarrer sinon. Contexte porté par `apps/api/src/workspaces/workspace.ts:6-47`, lu par le cache, le SSE (`live.service.ts:24-33`) et l'export (`export.controller.ts:76`). La suppression du schéma est une migration destructive ; la publication `powersync` doit l'exclure ; le retour arrière J+1 rejouerait les migrations sur un `demo` vide.

### E11. Inventaire : 62 `page.tsx`, pas 57 ; 80 specs, pas 84

Les sept pages hors comptage sont celles qu'aucune phase ne couvre : `(auth)/connexion`, `(hub)/espaces`, `compte`, `notifications`, `demande/[jeton]`, `app/page.tsx`, `[ancien]/[[...segments]]` (les redirections existent déjà, `apps/web/src/app/[ancien]/[[...segments]]/page.tsx:10-23`).

### E12. Neuf classes natives, pas quatre ; Shorebird absent du plan

`sn/cpi/go/` contient aussi `BootReceiver.kt`, `NetworkValidationChannel.kt`, `TelephoniePrefs.kt`, `UpdatesChannel.kt`, `MainActivity.kt`. `SynchroService.kt:88-98` est piloté depuis Dart au drain de l'outbox, objet qui disparaît. `apps/mobile/shorebird.yaml:8` déclare un `app_id` Shorebird (code push actif, `auto_update` non désactivé), à croiser avec la mise à jour obligatoire et `APK_SIGNER_MISMATCH` (`app-updates.controller.ts:164-173`).

### E13. « `drift_sqlite_async` permet de garder Drift » : vrai pour le paquet, faux pour le schéma

`drift_sqlite_async` 0.3.1 exige `drift >=2.28.0 <3.0.0`, le dépôt épingle `>=2.33.0 <2.34.0` : compatible. Mais le schéma client PowerSync n'a que trois types, les tables sont des vues sur `ps_data__*`, les index sont simples. `schema.drift:271-337` s'appuie sur `NOT NULL`, `REFERENCES ON UPDATE CASCADE`, `DEFAULT`, `BOOLEAN`/`DATETIME`, un index UNIQUE partiel ; `database.dart:13` pose `PRAGMA foreign_keys = ON`. Les 28 tables locales sont à re-spécifier.

### E14. Better Auth : les faits tiennent, le modèle de données ne tient pas

Exact : `password.hash`/`.verify` acceptent argon2id ; JWT EdDSA, JWKS, `audience`, `expirationTime`, `definePayload` ; PowerSync accepte EdDSA et `client_auth.jwks_uri`.

Ne tient pas : (1) Better Auth range le mot de passe sur `account`, pas sur `user` ; « tables ajoutées à côté de `users` » crée deux identités alors que `users.id` est la cible de dizaines de FK (`schema.prisma:301-330`). (2) La v1 accepte e-mail ou nom d'utilisateur (`auth.controller.ts:48`, `auth.service.ts:48`) ; Better Auth sépare `signIn.email` et le plugin `username`. (3) Perdus en silence : rotation de refresh avec révocation de famille (`auth.service.ts:119-128`) et `FreshSessionGuard` (`fresh-session.guard.ts:10-56`).

### E15. Quatre limiteurs de débit, pas un

`@fastify/rate-limit` 600/min (`bootstrap.ts:103`) ; `ThrottlerModule` `API_GLOBAL_RATE_LIMIT` (`app.module.ts:107-109`) ; `@Throttle` formulaire public 5/min et 30/min (`formulaire-public.controller.ts:24,40`) ; APK 1000/h avec clé selon `Range` (`app-updates.controller.ts:42-59`).

## 2. Manques

### 2.1 Bloquants pour la bascule

- B1. Module `ouvertures` absent : 6 endpoints, verrou 409 (`ouvertures.controller.ts:46-55`), brouillon serveur, chronomètre (`sync.service.ts:990-997`), mixin mobile `ouverture_fiche_mixin.dart`, table `schema.drift:1159`, file dédiée `sync_engine.dart:29`.
- B2. `payloadVersion` inexprimable en sync rules : `statuts-qualification.service.ts:110-116` filtre `minPayloadVersion <= payloadVersion` ; client à 8 (`sync_engine.dart:88`) ; PowerSync n'admet que `=`, `IN`, `IS NULL` sur paramètre.
- B3. `mes-attributions` et le filtre appareil (`api_port.dart:286-292`, table `attributions` `schema.drift:584`) : supprimés implicitement, sans remplaçant.
- B4. Onze canaux de lecture, neuf hors `/sync/pull` (`api_port.dart:210-321`) : `phase2/directory`, `call-outcome-reasons`, `statuts-qualification`, clichés entiers des référentiels et des listes du registre (`api_port.dart:97-103`).
- B5. L'écran « À corriger » (`corrections_screen.dart:42`, `needsAttentionProvider`) perd sa source : verdicts par opération (`sync.service.ts:1689-1739`) que PowerSync ne fournit pas.
- B6. Notes vocales : `record` + `just_audio` + `audio_session` (`pubspec.yaml:83-88`), multipart (`phase2.controller.ts:48-76`), lecture (`:78-100`), rétention et purge (`recordings.service.ts:35`).
- B7. Aucune restauration de sauvegarde jamais exécutée (`docs/migrations-en-attente.md:50-54`, `infra/README.md:243-248`).
- B8. `wal_level = logical` exige un redémarrage de Postgres en production, absent du runbook.
- B9. Exposition de `powersync-service` : Cloudflare (corps 100 Mo, UA 1010), Traefik `readTimeout` posé par API Dokploy le 2026-09-07 et non versionné ; l'app Flutter passe avec `User-Agent: CPI-GO/1.0 (Android)` (`api_environment.dart:18`).
- B10. Stockage de buckets dans le même Postgres : `pg_dump` admin (`db-dump.runner.ts:25-34`) et sauvegarde nocturne embarquent les buckets.
- B11. La v1 déployée affiche le nombre de saisies en attente sur l'écran de mise à jour (`app_update_screen.dart:29,80-83`) mais ne refuse pas l'installation tant que la file n'est pas vide. La parade du §8 exige une v1 supplémentaire pendant le gel.
- B12. Le §7.7 détruit : outbox en `blocked`/« À corriger », `form_drafts` (`schema.drift:556`), `rep_callback_reminders` et leurs alarmes (`schema.drift:984`, `rep_callback_notifications.dart`), `preuves_appel` (`schema.drift:1057`).
- B13. Isolat Workmanager (`core/background/background_sync.dart:19-64`) : PowerSync n'autorise `.connect()` que depuis une instance ; spike à faire.
- B14. `seed` (`api-entrypoint.sh:57-72`, `node dist/seed.js`) écrit en Prisma dans `packages/database`, que le plan supprime.

### 2.2 À ajouter au périmètre

- Formulaire public `/demande/[jeton]` : page, 2 endpoints, Turnstile (`formulaire-public.controller.ts:50-59`), `TURNSTILE_SITE_KEY` (`docker-compose.prod.yml:197`).
- `client-requests` : 5 endpoints. `suggestions` : 2 endpoints, page `/chues/suggestions`, deux specs. `heartbeat` / présence : module, WebSocket, `work-shifts.service.ts`, `agent_activity_days`/`agent_activity_slots`. `imports` : 7 endpoints, runner avec bail (`imports.cron.ts:69-106`). `lots-export` : 14 endpoints, réaffectations (`schema.prisma:2541-2571`). `referentiels` : 29 + 5 + 5 endpoints. `export` : 6 endpoints en `ExcelJS.stream.xlsx.WorkbookWriter` vers `Writable` Node (`export.service.ts:199-231`), pont vers `ReadableStream` Web à écrire ; `exceljs` aussi côté client (`apps/web/package.json:28`). `db-dump` : `spawn('pg_dump')` (`db-dump.runner.ts:25-34`), `postgresql-client` 18 absent de `Dockerfile.web`.
- Matrice des rôles : 223 sites d'autorisation (29 sur `referentiels.controller.ts`, 15 sur `representants.controller.ts`) ; specs `roles-refus`, `roles-trous`, `roles-navigation`, `roles-renvois`, `roles-espaces`, `accessibilite-*` supprimées par « quinze parcours ».
- `prospect_journeys` : `openJourney` (`sync.service.ts:2021-2039`), toute écriture mobile doit l'ouvrir.

### 2.3 À documenter

- `lot_export_items` sans colonne `id` : PowerSync exige `id` texte (concaténation possible).
- Mapping de types : enums, `timestamptz`, `jsonb`, `numeric` en `text` côté client.
- Retard de sécurité de 2 s du pull (`sync.service.ts:72-82`) et keyset remplacés par les checkpoints PowerSync : ADR.
- `sync_batches`/`sync_operations` (`sync.service.ts:301-348`, `:1741-1757`) sans objet, lues par le diagnostic.
- `@Cached` : 11 usages, invalidation par groupe qui émet aussi le SSE (`redis/cache.interceptor.ts:58-62`).
- `docs/adr/0001` et `0002` annulés par ce plan, non cités.

## 3. Risques et parades

| Risque                                                                                          | Preuve                                                                                                                                             | Parade                                                                                          |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Un 409 doublon bloque la file d'un téléphone pour toujours                                      | Doc PowerSync ; `sync.service.ts:222-244`, `:1969-1987`                                                                                            | `uploadData` répond 2xx et écrit le verdict dans une table synchronisée, lue par « À corriger » |
| Explosion du nombre de buckets si « fiches confiées par campagne » passe par `lot_export_items` | Doc PowerSync : pas de JOIN en data query, limite 1 000 buckets par utilisateur ; ~3 080 représentants, 12 929 prospects (`schema.prisma:747-750`) | Mesurer sur copie de prod avant la phase 1 ; alternative : tirage global + filtre appareil      |
| Compte désactivé qui continue de télécharger jusqu'à l'expiration du jeton                      | `fresh-session.guard.ts:8,33-52` ; PowerSync exp ≤ 24 h                                                                                            | `expirationTime` court, délai de révocation accepté par écrit                                   |
| Perte de la détection de rejeu de refresh                                                       | `auth.service.ts:119-128`                                                                                                                          | Décision explicite                                                                              |
| Gel de 16 semaines intenable si la v1 reçoit B11                                                | §2 vs §8 ; `app_update_controller.dart`                                                                                                            | Exception nommée au gel, ou autre façon de vider les files                                      |
| Réplication logique + purge de masse                                                            | `purge.service.ts`, `purge-steps.ts`                                                                                                               | Exclure les buckets des dumps, mesurer la purge sur copie                                       |
| Téléphone hors ligne depuis des semaines : `heartbeat` mesure la présence, pas la file          | `presence-socket.service.ts:28-35`                                                                                                                 | Aucune donnée « opérations en attente par appareil » côté serveur                               |
| Restauration jamais testée                                                                      | `docs/migrations-en-attente.md:50-54`                                                                                                              | Exercice `infra/README.md` §4.3 avant la phase 0                                                |
| Notes vocales : PowerSync ne synchronise pas de binaire                                         | `recordings.service.ts`                                                                                                                            | Routes HTTP classiques conservées                                                               |
| Shorebird : un patch remet du code v1 en circulation                                            | `shorebird.yaml:8`                                                                                                                                 | Décider avant J-1                                                                               |

## 4. Décisions à soumettre au propriétaire

1. Sémantique de `uploadData` : 2xx systématique + table de verdicts, ou abandon de PowerSync pour les écritures à règle serveur.
2. Filtrage des fiches : buckets par rôle, ou tirage global + filtre appareil comme aujourd'hui.
3. Sync Rules ou Sync Streams (`edition: 3`, JOIN et sous-requêtes).
4. Remplacement de `payloadVersion` : abandon, ou canal HTTP conservé.
5. WebSocket de présence : serveur Node personnalisé, service séparé, ou abandon de l'écran.
6. Ordonnanceur des sept tâches : conteneur cron, `pg_cron`, ou service Node.
7. Identité : table `users` réutilisée via `modelName`/`fields` de Better Auth, ou tables parallèles.
8. Détection de rejeu de refresh : reconstruite ou abandonnée.
9. Schéma `demo` : suppression avant ou après la bascule.
10. Preuve de non-régression : quinze parcours, ou famille `roles-*` conservée.
11. Shorebird : conservé, gelé, retiré.
12. Phase 0 : prouver sur copie de prod les quatre points qui peuvent tuer le plan (sémantique d'erreur de `uploadData`, nombre de buckets réel, téléphonie + isolat sous PowerSync, fidélité de `drizzle-kit pull`).
13. Estimation : 16 semaines pour 233 endpoints, 62 pages, 26 écrans, un moteur de sync remplacé et une infra réécrite, à deux.

## Sources externes

- https://docs.powersync.com/installation/app-backend-setup/writing-client-changes
- https://docs.powersync.com/installation/authentication-setup/custom
- https://docs.powersync.com/usage/sync-rules
- https://docs.powersync.com/usage/sync-rules/parameter-queries
- https://docs.powersync.com/usage/sync-rules/operators-and-functions
- https://docs.powersync.com/usage/sync-rules/types
- https://docs.powersync.com/usage/sync-rules/client-id
- https://docs.powersync.com/usage/sync-rules/guide-many-to-many-and-join-tables
- https://docs.powersync.com/sync/streams/overview
- https://docs.powersync.com/usage/installation/client-side-setup/define-your-schema
- https://docs.powersync.com/self-hosting/installation/powersync-service-setup
- https://docs.powersync.com/installation/database-setup
- https://docs.powersync.com/usage/use-case-examples/background-syncing
- https://pub.dev/packages/powersync
- https://pub.dev/packages/drift_sqlite_async
- https://www.better-auth.com/docs/plugins/jwt
- https://www.better-auth.com/docs/authentication/email-password
- https://www.better-auth.com/docs/concepts/database
- https://www.better-auth.com/docs/plugins/username
- https://github.com/drizzle-team/drizzle-orm/issues/3520
- https://github.com/drizzle-team/drizzle-orm/issues/6145
- https://github.com/drizzle-team/drizzle-orm/issues/5224
- https://nextjs.org/docs/app/api-reference/file-conventions/route
- https://nextjs.org/docs/app/guides/self-hosting
- https://github.com/vercel/next.js/discussions/95514
