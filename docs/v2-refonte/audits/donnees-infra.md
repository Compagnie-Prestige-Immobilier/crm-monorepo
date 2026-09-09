# Audit v2 : modèle de données et infrastructure (7 septembre 2026)

Sources : `packages/database/prisma/schema.prisma` (2 702 lignes), les 76 dossiers de `packages/database/prisma/migrations/`, `packages/database/src/*.ts`, `infra/**`, `.github/workflows/*.yml`, `turbo.json`, `pnpm-workspace.yaml`, `package.json` racine, `.env.example`, `docs/migrations-en-attente.md`, `docs/troubleshoot.md`, `apps/api/src/env.ts`, `apps/web/.env.local` (clés seulement), `apps/api/src/redis/*`, `apps/api/src/modules/live/live.service.ts`.

## 1. Modèle de données

Générateur `prisma-client-js`, pas d'`url` dans le `datasource` (`schema.prisma:33-39`) : la chaîne vient de `packages/database/prisma.config.ts:1-17`, repli dev sur `postgresql://crm:crm@localhost:5434/crm`, exception en production si `DATABASE_URL` est absent.

Pas de `@@schema` ni de `multiSchema`. Le multi-schéma `public`/`demo` est un artefact d'infrastructure : le même `schema.prisma` est déployé deux fois, une fois par valeur de `?schema=`.

- `packages/database/src/deploy-workspaces.ts:14-49` : boucle sur `['public', 'demo']`, `CREATE SCHEMA IF NOT EXISTS`, `prisma migrate deploy` avec l'URL réécrite.
- `infra/docker/api-entrypoint.sh:27-44` : migre `public` puis `demo`.
- `apps/api/src/prisma/prisma.service.ts:9-38` : deux `PrismaClient`, `options=-csearch_path=demo` pour le second. `assertMigrationParity()` (`:49-64`) compare `public."_prisma_migrations"` et `demo."_prisma_migrations"` (`docs/troubleshoot.md:146-159`).
- Routage requête → schéma : `AsyncLocalStorage` (`apps/api/src/workspaces/workspace.ts:1-45`), `Workspace = 'public' | 'demo'`, `Proxy` sur le client.
- Le mode démo est abandonné dans le plan v2. Historique : colonne `isDemo` (migrations `20260812230000_demo_entity_flags`, `20260813002432_demo_visibility_flag`, `20260814090000`), purgée par `20260820220000_workspace_demo/migration.sql` (22 tables). Fabrique actuelle `packages/database/src/demo-workspace-factory.ts` : TRUNCATE `demo.*`, copie de 19 tables référentielles (`MIRRORED_TABLES`, lignes 9-30), volume synthétique `demo-volume.ts:5-32` (~796 000 lignes, ex. `callAttempts: 150_000`, `auditLogs: 80_000`, `deviceCallDetections: 60_000`).

### Modèles (Prisma → `@@map`)

- `User` → `users` (`schema.prisma:280-369`). `id` UUID v7 généré par la base. `email`/`username` uniques, `role Role @default(COMMERCIAL)`, `deletedAt`. Colonne morte `departementId` (`:291-295`) + FK `SetNull` (retrait retenu, `docs/migrations-en-attente.md` §2). Index `[role, isActive]`, `[deletedAt]`.
- `RefreshToken` → `refresh_tokens` (`:378-393`) : `tokenHash` SHA-256 unique, `familyId` (détection de rejeu), `Cascade` sur `User`.
- `Region` → `regions` (`:399-408`), `Departement` → `departements` (`:410-429`, unique `[regionId, name]`), `Ief` → `iefs` (`:441-457`, unique `[departementId, name]`).
- `Banque` → `banques` (`:459-474`), `Syndicat` → `syndicats` (`:476-490`) : `sortOrder`/`isActive`, jamais supprimés.
- `Representant` → `representants` (`:496-617`). `id` UUID v7 client (sans `@default`, `:497`). `phoneE164` sans `@unique` Prisma (index partiel SQL, §2). `rev Int @default(1)`. `whatsappStatus`/`whatsappE164` avec CHECK. `statutQualificationId` nullable. `lastCallOutcome/lastCallAt/lastCallById/nextCallbackAt/nextCallbackOrigine` recopiés de `RepCallAttempt`. Index `[createdById, clientCreatedAt]`, `[updatedAt, id]`, `[statutQualificationId, iefId]`.
- `CanalProvenance`, `Profession`, `Employeur`, `Pays`, `IncomeBand`, `Offer` (`:625-736`) : référentiels ouverts, `isActive`, index `[updatedAt, id]`.
- `Prospect` → `prospects` (`:738-961`). UUID v7 client. `banqueId`/`syndicatId` optionnels (segment BDD calculé, jamais stocké). `champsLibres Json?`. `origin`/`originLabel`. `aRevoirAt` (index partiel). `phase2Status`/`enrollmentMethod`/`enrollmentCapturedAt/-ById` avec CHECK. `revueAt/revueById`. `lastCall*` recopiés. Commentaire `:954-956` : un index `[projet]` ajouté après un incident où `db:migrate` l'aurait supprimé. Index `[syndicatId, banqueId]`, `[updatedAt, id]` mappé `prospects_phase2_directory`.
- `ProspectJourney` → `prospect_journeys` (`:963-1011`) : phase 2 par parcours (`projet`), unique `[prospectId, projet]`.
- `ProspectConversion` → `prospect_conversions` (`:1013-1030`) : `journeyId` unique, `amountXof`/`durationMonths` avec CHECK.
- `SyncBatch` → `sync_batches` (`:1057-1074`, clé composite `[userId, key]`, `key` mappé `idempotency_key`), enum `BatchStatus {IN_PROGRESS, COMPLETED}` ; `SyncOperation` → `sync_operations` (`:1089-1103`), enum `OperationResult {APPLIED, DUPLICATE, CONFLICT, INVALID, SKIPPED_DEPENDENCY_FAILED}`.
- `AgentHeartbeat` → `agent_heartbeats` (`:1113-1130`) : `@id` = `userId`, `journalAppelsAutorise Boolean?` (EB-37).
- `AgentActivitySlot` → `agent_activity_slots` (`:1135-1147`) : clé composite `[userId, slot]`.
- `AuditLog` → `audit_logs` (`:1149-1164`) : `before`/`after` Json, `userId` `SetNull`.
- `CallAttempt` → `call_attempts` (`:1170-1221`) : append-only, UUID v7 client. CHECK sur `outcome`/`method`/`comment`. `email, fonctionnaire, engagementEnCours, dureeEtablissementMois, rendezVousAt`. Preuve device « toutes ou aucune ».
- `ScheduledCallback` → `scheduled_callbacks` (`:1233-1269`) : `sourceAttemptId` unique, enum `ScheduledCallbackStatus {PENDING, DONE, CANCELLED, SUPERSEDED}`.
- `RepCallAttempt` → `rep_call_attempts` (`:1273-1318`) : `promisedProspects`.
- `DeviceCallDetection` → `device_call_detections` (`:1324-1344`) : `representantId`/`prospectId` nullables sans CHECK (règle applicative).
- `OuvertureFiche` → `ouvertures_fiche` (`:1360-1418`) : verrou + chronomètre + brouillon (`draft Json?`) + comptage. CHECK triples, UUID v7 client.
- `ClientCreationRequest` → `client_creation_requests` (`:1437-1487`) : `createdProspectId` `Restrict` (ordre de purge dans `purge-plan.ts`).
- `BankCaseStage` → `bank_case_stages` (`:1501-1522`, enum `BankStageType {OPEN, CASHED, REJECTED}`), `BankRejectionReason` (`:1528-1541`), `BankCase` → `bank_cases` (`:1543-1599`, `amountXof Decimal(18,0)` exposé en chaîne, `rev`), `BankCaseTransition` (`:1604-1634`, append-only).
- `AppSetting` → `app_settings` (`:1660-1668`, `key` = `@id`), `AppSettingChange` (`:1644-1658`).
- `AndroidRelease` → `android_releases` (`:1672-1689`) : `@id` = `versionCode` entier.
- `NotificationTemplate` (`:1796-1818`), `Notification` → `notifications` (`:1828-1900`, unique `[reminderKey, period]`, `dispatchClaim`), `NotificationDelivery` (`:1909-1946`, uniques `[notificationId, userId]`, `[reminderKey, userId, period]`). Colonnes mortes conservées : `Notification.payload` (`:1839-1848`), `NotificationDelivery.deviceToken` (`:1919-1922`), `Notification.audienceDepartementId` (`:1852-1854`) + valeur `NotificationAudience.DEPARTEMENT` (`:1714`), modèle entier `DeviceToken` → `device_tokens` (`:1743-1764`, commentaire `:1724-1742`). Vérification : `grep -rn "deviceToken\|DeviceToken\|DevicePlatform" apps/api/src packages/database/src` doit rester vide (`docs/migrations-en-attente.md:41`).
- `ImportJob` → `import_jobs` (`:1995-2054`, enums `ImportKind`, `ImportStatus {queued, running, succeeded, failed, expired}`, `ImportMode {DRY_RUN, APPLY}`, bail `claimToken`/`claimedAt`), `VisiteImportChange` (`:2608-2641`, unique `[importJobId, sheet, rowNumber]`).
- `SegmentChange` → `segment_changes` (`:2080-2111`), `RepresentantRelationChange` → `representant_relation_changes` (`:2117-2142`) : append-only, `fromX`/`toX` stockés.
- `RepresentantComment` (`:2147-2166`), `RepresentantSuggestion` (`:2178-2216`, `sourceAttemptId` unique, enum `SuggestionStatus`).
- `CallOutcomeReason` (`:2241-2271`), `StatutQualification` (`:2293-2345`) : `code` immuable, `minPayloadVersion`.
- `VisiteEntreprise`, `VisiteDirection`, `VisiteDestinataire`, `VisiteObjet` (`:2347-2441`), `Visite` → `visites` (`:2444-2497`, `reference` au format `V-2026-000412`).
- `DashboardLayout` → `dashboard_layouts` (`:2505-2517`) : clé composite `[userId, ecran]`, `layout Json`.
- `LotExport` → `lots_export` (`:2519-2539`, enum `LotExportCible`), `LotExportItem` (`:2541-2564`, clé composite `[lotId, position]`), `LotExportReaffectation` (`:2571-2594`).
- `InscriptionPlateforme` → `inscriptions_plateforme` (`:2652-2701`) : unique `[projet, identifiantDistant]`, `chargeUtile Json`.

Tables disparues (présentes dans l'historique SQL seulement) : `call_campaigns`, `call_tasks`, `rep_call_campaigns`, `rep_call_tasks` (créées `20260812141010_phase2_and_bank_finance/migration.sql:35-77` et `20260814090000_.../migration.sql:43-72`, supprimées `20260829130000_retrait_des_listes_d_appel/migration.sql:22-27`), `demo_entities` (supprimée dans `20260820220000_workspace_demo`).

### Enums (35)

`Role` (7), `RepresentantRelation` (4), `WhatsappStatus` (4), `ProspectStatut` (4), `Phase2Status` (4), `EnrollmentMethod` (8, `PHYSICAL` conservé pour l'historique), `BddSegment` (4, jamais stocké), `Projet` (2), `ProspectType` (4), `TypeContrat` (3), `ModeEpargne` (4), `EmployeurType` (3), `GrandPublicConsent` (3), `PaymentMode` (2), `LotExportCible` (4), `CallOutcome` (6), `PrioriteTraitement` (3), `StatutQualificationEffect` (5), `RappelOrigine` (2), `RepCallOutcome` (7), `ClientRequestStatus` (3), `BankStageType` (3), `BatchStatus` (2), `OperationResult` (5), `ScheduledCallbackStatus` (4), `ChangeSource` (2), `SuggestionStatus` (3), `CallOutcomeEffect` (5), `NotificationCategory` (5), `NotificationAudience` (4, `DEPARTEMENT` morte), `DevicePlatform` (3, mort), `NotificationStatus` (4), `NotificationDeliveryStatus` (5), `ImportKind` (5), `ImportStatus` (5), `ImportMode` (2), `VisiteImportChangeKind` (2).

UUID v7 client : `Representant.id`, `Prospect.id`, `CallAttempt.id`, `RepCallAttempt.id`, `DeviceCallDetection.id`, `OuvertureFiche.id`, `RepresentantComment.id`. `rev` : `Representant`, `Prospect`, `BankCase`. `deletedAt` : `User`, `Representant`, `Prospect`, `RepresentantComment`, `BankCase`. `clientCreatedAt` : `Representant`, `Prospect`, `CallAttempt`, `RepCallAttempt`, `RepresentantComment`, `RepresentantSuggestion`.

## 2. Contraintes vivant seulement dans le SQL des migrations

CHECK (exhaustif) :

| Table                                 | Contrainte                                                           | Fichier                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prospects`                           | `prospects_enrollment_method_matches_status`                         | `20260812141010_phase2_and_bank_finance/migration.sql:320-324`                                                                                    |
| `call_attempts`                       | `call_attempts_method_matches_outcome`                               | `20260812141010_.../migration.sql:327-331`                                                                                                        |
| `call_attempts`                       | `call_attempts_other_requires_comment`                               | `:335-336` (repris `rep_call_attempts` `20260814090000_.../migration.sql:267-268`)                                                                |
| `call_attempts`                       | `call_attempts_comment_max_length` ≤ 2000                            | `:338-339` (idem `rep_call_attempts` `:270-271`)                                                                                                  |
| `bank_cases`                          | `bank_cases_amount_non_negative`                                     | `:355-356`                                                                                                                                        |
| `bank_cases`                          | `bank_cases_rejection_detail_max_length` ≤ 2000                      | `:358-359`                                                                                                                                        |
| `rep_call_attempts`                   | `rep_call_attempts_promised_only_when_promised`                      | `20260814090000_.../migration.sql:276-280`                                                                                                        |
| `prospects`                           | `prospects_origin_known` (`NOT VALID`)                               | `20260814090000_.../migration.sql:316-317`, réécrite `20260906210000_origine_formulaire_public/migration.sql:15`                                  |
| `client_creation_requests`            | `..._approved_has_prospect`                                          | `20260814090000_.../migration.sql:322-323`                                                                                                        |
| `client_creation_requests`            | `..._rejected_has_note`                                              | `:325-329`                                                                                                                                        |
| `representants`                       | `representants_whatsapp_number_matches_status`                       | `20260819090000_whatsapp_et_profession_du_representant/migration.sql:21-25`                                                                       |
| `prospect_conversions`                | `amount_check`, `duration_check` (1-300), `payment_check`            | `20260822151000_parcours_projets_et_referentiels/migration.sql:115-117`                                                                           |
| `call_attempts`                       | `call_attempts_rendez_vous_matches_method`                           | `20260827140100_renseignements_de_conversion/migration.sql:17-21`, réécrite `20260906150000_reconciliation_enrollment_schema/migration.sql:17-23` |
| `call_attempts`                       | `duree_etablissement_range` (0-600), `email_max_length` (≤160)       | `20260827140100_.../migration.sql:23-27`                                                                                                          |
| `lot_export_items`                    | `lot_export_items_une_seule_cible` (`num_nonnulls = 1`, `NOT VALID`) | `20260829100000_lots_export/migration.sql:32`                                                                                                     |
| `ouvertures_fiche`                    | `_cible_check` (XOR), `_chronometre_check`, `_liberation_check`      | `20260905120000_ouverture_de_fiche/migration.sql:24-34`                                                                                           |
| `representants`                       | `representants_next_callback_origine_check`                          | `20260905110000_rappel_promis_ou_automatique/migration.sql:26-27`                                                                                 |
| `prospects`                           | `prospects_whatsapp_number_matches_status`                           | `20260906120000_.../migration.sql:26-30`, redéfinie `20260906150000_.../migration.sql:10-15`                                                      |
| `ouvertures_fiche`                    | `_premiere_saisie_check`                                             | `20260905150000_chronometre_a_la_premiere_saisie/migration.sql:11-15`                                                                             |
| `call_attempts` / `rep_call_attempts` | `_preuve_appareil_toutes_ou_aucune`                                  | `20260906160000_preuve_appel_toutes_ou_aucune/migration.sql:11-21`                                                                                |

Prisma n'exprime aucune CHECK (`schema.prisma:14-21`). `drizzle-kit pull` ne les introspecte pas dans le schéma généré : à rejouer à la main.

Index uniques ou partiels en SQL brut :

| Index                                                 | Table                      | Expression                                                           | Fichier                                                   |
| ----------------------------------------------------- | -------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| `representants_phone_e164_active_key`                 | `representants`            | `(phoneE164) WHERE deletedAt IS NULL`                                | `20260812122400_partial_unique_phone/migration.sql:12-14` |
| `prospects_phone_e164_active_key`                     | `prospects`                | idem                                                                 | `:16-18`                                                  |
| `bank_case_stages_single_initial`                     | `bank_case_stages`         | `(isInitial) WHERE isInitial = true`                                 | `20260812141010_.../migration.sql:364-365`                |
| `bank_case_stages_single_cashed` / `_single_rejected` | `bank_case_stages`         | `(type) WHERE type = ...`                                            | `:367-371`                                                |
| `bank_cases_reference_key_active`                     | `bank_cases`               | `(referenceKey) WHERE deletedAt IS NULL`                             | `:376-378`                                                |
| `prospects_phase2_directory`                          | `prospects`                | `(updatedAt, id) WHERE deletedAt IS NULL`, mappé `schema.prisma:942` | `:382-384`                                                |
| `prospects_origin_idx`                                | `prospects`                | `(origin) WHERE origin IS NOT NULL`                                  | `20260814090000_.../migration.sql:193`                    |
| `client_creation_requests_pending_phone_key`          | `client_creation_requests` | `(phoneE164) WHERE status = 'PENDING'`                               | `:343-345`                                                |
| `scheduled_callbacks_one_pending_per_prospect`        | `scheduled_callbacks`      | `(prospectId) WHERE status = 'PENDING'`                              | `20260818090000_.../migration.sql:104-106`                |
| `ouvertures_fiche_verrou_unique`                      | `ouvertures_fiche`         | `(openedById) WHERE closedAt IS NULL`                                | `20260905120000_.../migration.sql:56-57`                  |
| `prospects_a_revoir_idx`                              | `prospects`                | `(aRevoirAt) WHERE aRevoirAt IS NOT NULL`                            | `20260906140000_formulaire_public/migration.sql:15-17`    |
| `prospects_email_active_idx`                          | `prospects`                | `(email) WHERE deletedAt IS NULL AND email IS NOT NULL`              | `20260907090000_prospect_email/migration.sql:12-14`       |

Extensions : `unaccent`, `pg_trgm` (`20260812141010_.../migration.sql:388-389`), qualifiées `public.` (`public.gin_trgm_ops`) car `demo` ne les possède pas. Fonction : `immutable_unaccent(text)` (`20260823180000_index_trigramme_unaccent/migration.sql:16-22`), seule fonction et seul index GIN/trigram (`prospects_nom_prenom_unaccent_trgm`). Aucune vue, séquence explicite, contrainte d'exclusion, trigger.

Verrou applicatif : `pg_advisory_xact_lock` dans `apps/api/src/modules/bank-cases/bank-case-stages.service.ts:50`.

DDL dynamique hors migrations : `packages/database/src/demo-workspace-factory.ts:69-86` (PL/pgSQL anonyme, TRUNCATE CASCADE, `json_populate_record`).

Défauts SQL : seulement ceux de Prisma (`now()`, `uuid(7)`, enums). Pas de trigger `updated_at` : `@updatedAt` est applicatif.

## 3. Migrations

76 dossiers, première `20260812122350_init`, dernière `20260907120000_reaffectation_positions`. Retenues hors version (`docs/migrations-en-attente.md`) : §1 (15 août) suppression `device_tokens`, `DevicePlatform`, `notification_deliveries.deviceToken`, `notifications.payload` (SQL `:73-86`, conditions `:56-65`) ; §2 (29 août) suppression `users.departementId`, `notifications.audienceDepartementId`, valeur `DEPARTEMENT` (SQL `:137-163`).

Seed (`packages/database/src/seed.ts:439-460`) : géographie (`DEPARTEMENT_COUNT`), banques, syndicats, canaux, professions, tranches, offres, employeurs, pays, étapes et motifs bancaires, 6 motifs d'issue (`isSystem`), statuts de qualification, référentiels visites, admin (`seedAdmin`, `:360-398`, upsert-si-absent, ≥12 caractères), 7 comptes fixtures (`seedFixtureUsers`, `:406-437`, `fixture.<prenom>@cpi.sn`, désactivés en production). Fixtures e2e : `seed-dev-chues.ts` (849 lignes). Démo : `demo-workspace-seed.ts`, `demo-workspace-factory.ts`, `demo-volume.ts`.

Data-migrations : `20260902140000_lot_projet_requis_anciennete_reprise/migration.sql:1-29` ; `20260903090000_representant_dernier_appel`, `20260903120000_prospect_dernier_appel` (rétro-remplissage `lastCall*`) ; `20260823170000_phase2_par_parcours_et_fermeture/migration.sql:39-42` ; `20260829090000_historique_des_releases_android/migration.sql:47-54` (`pg_input_is_valid`, Postgres 15+).

## 4. Infrastructure

Deux composes (`infra/README.md:1-22`) : `docker-compose.yml` (dev) et `docker-compose.prod.yml` (VPS nu, non utilisé en production réelle : la prod tourne sur Dokploy/Traefik via `infra/dokploy/deploy.py`).

`docker-compose.prod.yml` : `postgres` `postgres:18.4`, `--locale=C.UTF-8`, volume `pgdata`, aucun port publié, healthcheck `pg_isready`, aucun `wal_level` ; `redis` `redis:8-alpine` `--requirepass` ; `migrate` (cible `migrator`, `?schema=public` seulement) ; `api` (cible `runner`, 3001, `DEMO_WORKSPACE_ENABLED: 'false'`, volumes `db-dumps`, `apk-releases`, healthcheck `/health/ready`) ; `web` (`NEXT_PUBLIC_API_URL` figé au build, `API_INTERNAL_URL=http://api:3001`) ; `caddy` `caddy:2.10-alpine` 80/443/443-udp ; `backup` (non utilisé en prod). Réseau `cpi-go-prod`, logs 20 Mo × 5. Ordre : postgres → migrate → api → web → caddy (`infra/README.md:64-68`).

`api-entrypoint.sh` : `migrate deploy` public → demo → seed conditionnel (`SEED_ON_START`, non bloquant) → `exec node apps/api/dist/main.js`.

Caddy : `/api/*` → `api:3001` avec `response_header_timeout 120s` ; HSTS, nosniff, Referrer-Policy ; aucune limite d'upload explicite.

Sauvegardes : prod réelle via Dokploy (`pg_dump -Fc`, rclone S3 Scaleway, `0 2 * * *`, rétention 30, statut « à activer », aucune restauration testée, `docs/migrations-en-attente.md:51-54`) ; VPS nu via `backup.sh` (plain gzip, 14 j).

Dokploy (`infra/dokploy/deploy.py`, `infra/dokploy/README.md`) : `cpi-go-api` (`Dockerfile.api`, stage `runner`) et `cpi-go-web` ; domaines `go.cpi-chues.com:3001`, `go-admin.cpi-chues.com:3000`, `certificateType: none` (certificat d'origine Cloudflare) ; volumes `cpi-go-releases` → `/repo/storage/releases`, `cpi-go-db-dumps` → `/repo/storage/db-dumps`. Pas de webhook Dokploy : branchement `customGitUrl`, déploiement par le job `deploy` de `.github/workflows/ci.yml` (`deploy.py redeploy`). Aucune limite CPU/mémoire.

Env API en prod (`deploy.py:569-606`) : `NODE_ENV`, `PORT=3001`, `LOG_LEVEL`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL_DAYS=30`, `AUTH_LOGIN_RATE_LIMIT=10`, `PUBLIC_WEB_URL`, `API_CORS_ORIGINS`, `API_TRUST_PROXY_HEADERS=true`, `API_DOCS_ENABLED=false`, `APK_RELEASE_DIR`, `APK_DOWNLOAD_RATE_LIMIT=50000`, `DB_DUMP_DIR`, `DB_DUMP_ENABLED=true`, `BUSINESS_TIME_ZONE=Africa/Dakar`, `PHONE_DEFAULT_REGION=SN`, `SYNC_MAX_BATCH_SIZE=200`, `IDEMPOTENCY_TTL_DAYS=7`, `SEED_ADMIN_*`, Brevo/Turnstile si exportées. Web (`:657-668`) : `API_URL`/`API_INTERNAL_URL` (nom de service suffixé, `:671-687`), `NEXT_PUBLIC_API_URL`. Fichiers non commités : `.secrets.generated`, `.ids.generated`.

CI (`.github/workflows/ci.yml`, 636 lignes) : job `node` (Postgres 18.4 + Redis 8, `db:generate`, `format:check`, `lint`, `dead-code`, `typecheck`, portillon « aucun test unitaire » `:118-127`, `db:deploy`, portillon dérive schéma `prisma migrate diff --exit-code` `:147-153`, `db:seed`, `test:integration`, `build`) ; `securite` (security.yml) ; `sonar` ; `contract` (`check-generated` `:412-447`, `oasdiff breaking --fail-on WARN` `:464-498`) ; `mobile` ; `deploy` (push `prod`, `deploy.py redeploy`, secret `DOKPLOY_KEY`).

Docker : `Dockerfile.api` (`turbo prune`, stages `base → pruner → builder → prod-deps → migrator → runner`, `postgresql-client-18`, non-root ; ARGs `NODE_VERSION=24.18.0`, `PNPM_VERSION=11.15.1`, `TURBO_VERSION=2.10.5`, `PRISMA_VERSION=7.9.0`, `PG_MAJOR=18`) ; `Dockerfile.web` (`standalone`, ~200 Mo). Ports : 80/443 ; 3001/3000 internes ; 5434 et 6381 en dev.

## 5. Variables d'environnement

API (`apps/api/src/env.ts`, zod, `PROD_CHECKS`) : `NODE_ENV`, `LOG_LEVEL=info`, `PORT=3001`, `PUBLIC_WEB_URL`, `API_CORS_ORIGINS` (https en prod), `API_DOCS_ENABLED=false` (obligatoire en prod), `API_TRUST_PROXY_HEADERS`, `DATABASE_URL`, `DATABASE_POOL_SIZE=10` (divisé par 2 public/demo), `REDIS_URL` (obligatoire en prod), `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (≥32, différents), `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL_DAYS=30`, `AUTH_LOGIN_RATE_LIMIT=10`, `API_GLOBAL_RATE_LIMIT=300`, `BUSINESS_TIME_ZONE`, `PHONE_DEFAULT_REGION=SN`, `SYNC_MAX_BATCH_SIZE=200` (max 2000), `IDEMPOTENCY_TTL_DAYS=7`, `PASSWORD_MIN_LENGTH=8`/`MAX_LENGTH=24`, `APK_RELEASE_DIR`, `APK_MAX_SIZE_BYTES=524_288_000`, `APK_SIGNER_SHA256`, `APK_DOWNLOAD_RATE_LIMIT=1000`, `CALL_RECORDING_DIR`, `CALL_RECORDING_MAX_SIZE_BYTES=25_000_000`, `CALL_RECORDING_RETENTION_HOURS=48`, `DB_DUMP_DIR`, `DB_DUMP_ENABLED=false`, `DEMO_WORKSPACE_ENABLED=false` (obligatoire en prod), `PLATEFORME_CHUES_URL/_TOKEN`, `PLATEFORME_GRAND_PUBLIC_URL/_TOKEN`.

Hors zod (`.env.example`) : `SEED_ADMIN_EMAIL/_USERNAME/_PASSWORD/_FULL_NAME`, `SEED_FIXTURE_PASSWORD`, `API_INTERNAL_URL`, `NOTIFICATIONS_REMINDERS_ENABLED/_AT`, `NOTIFICATIONS_DAILY_REPORT_ENABLED/_AT`, `NOTIFICATIONS_BANK_PENDING_ENABLED/_DAYS`, `NOTIFICATIONS_BANK_STALE_ENABLED/_DAYS`, `BREVO_API_KEY/_SENDER_EMAIL/_SENDER_NAME`, `TURNSTILE_SITE_KEY/_SECRET_KEY/_ALLOW_DEGRADED`, `SHOREBIRD_TOKEN`.

Web (`apps/web/src`) : `API_INTERNAL_URL`, `API_URL`, `CI`, `DEMO_WORKSPACE_ENABLED`, `E2E_START_WEB`, `E2E_WEB_URL`, `NODE_ENV`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_FIXTURE_PASSWORD`, `TURNSTILE_SITE_KEY`. Pas de `apps/web/.env.example`.

Secrets CI : `DOKPLOY_KEY`, `DOKPLOY_URL`, `BACKUP_S3_*`.

## 6. Redis

Instance unique, cache pur, sans persistance (`apps/api/src/redis/redis.service.ts:40-48` : `maxmemory=128mb`, `allkeys-lru`, `save=''`). Connexion `:26-51`, `lazyConnect`, `maxRetriesPerRequest: 1`, timeout 2 s.

Clés `cpi:<workspace>:<name>` (`:90-92`). `@Cached(ttl, group?)` (`apps/api/src/redis/cache.interceptor.ts`) : clé `http:<scope>:<url>` (`:76-79`), version de groupe incrémentée à chaque mutation. TTL : 30 s (`admin.controller.ts:71`, `supervision.controller.ts:50,64`), 60 s (`analytics.controller.ts:47`, `supervision.controller.ts:39`, `bank-cases.controller.ts:81`, `visites.controller.ts:177`, `call-outcome-reasons.controller.ts:20`, `referentiels.controller.ts:51`, `statuts-qualification.controller.ts:20`, `app-updates.controller.ts:62`). Fraîcheur de session `user:<id>` (`fresh-session.guard.ts:7`, 30 s, `bust` dans `users.service.ts:227,395`). Groupes `LiveTopic` : `notifications`, `imports`, `db-dump`, `referentiels`, `app-updates` (`live.service.ts:8`).

Pub/Sub SSE non implémenté : `LiveService` (`live.service.ts:16-34`) est un `EventEmitter` en mémoire, mono-processus.

Sans Redis : rien ne casse, `cached()` retombe sur `load()` ; `FreshSessionGuard` revalide à chaque requête. Le limiteur de débit ne dépend pas de Redis (à confirmer).

## 7. Prérequis PowerSync sur cette base

- `wal_level` non configuré (défaut `replica`) : à poser (`command: postgres -c wal_level=logical`).
- Aucune publication, aucun rôle de réplication.
- Clés primaires non-UUID ou composites : `android_releases` (`versionCode`), `agent_heartbeats` (`userId`), `app_settings` (`key`), `sync_batches` `[userId, key]`, `agent_activity_slots` `[userId, slot]`, `lot_export_items` `[lotId, position]`, `dashboard_layouts` `[userId, ecran]`.
- Colonnes JSON : `Prospect.champsLibres`, `SyncBatch.responseJson`, `SyncOperation.resultJson`, `AuditLog.before/after`, `OuvertureFiche.draft`, `ImportJob.report`, `VisiteImportChange.fields`, `DashboardLayout.layout`, `InscriptionPlateforme.chargeUtile`, `Notification.payload`.
- 35 enums natifs (texte côté client).
- `Decimal(18,0)` (`BankCase.amountXof`, `BankCaseTransition.amountXof`) ; `String[]` (`NotificationTemplate.variables`, `Notification.audienceUserIds`, `LotExportReaffectation.positions`).
- Extensions et fonction `immutable_unaccent` non capturées par `drizzle-kit pull`.
- Volumes : `prospects` ~500 000 (`schema.prisma:944-946`), ~120 000 sans provenance (`20260814090000_.../migration.sql:189-191`), `representants` 12 929 (`schema.prisma:747-750`).
- Schéma `demo` à décommissionner ou à exclure de la publication.

## 8. Dettes et pièges

`docs/troubleshoot.md` : §1 `pnpm dev` sans build préalable ; §2 `db:deploy` ignore un `DATABASE_URL` non exporté ; `:146-159` `db:migrate` ne migre que `public`.

Colonnes mortes : `users.departementId`, `notifications.audienceDepartementId`, `NotificationAudience.DEPARTEMENT`, `notifications.payload`, `notification_deliveries.deviceToken`, `device_tokens` + `DevicePlatform`.

SQL brut Prisma (24 fichiers, ~79 occurrences hors tests) : `prisma.service.ts:51` ; `prospects/last-attempt.ts:20,29` ; `health.controller.ts:22` ; `admin/supervision.service.ts:449` ; `bank-cases-export.service.ts:259` ; `bank-case-stages.service.ts:50` (advisory lock) ; `lots-export.service.ts:898,901,976,979,998,1098,1102` ; `bank-cases.service.ts:101,105,409,427` ; `heartbeat.service.ts:55` ; `enrolement.service.ts:420` ; `bank-cases-analytics.service.ts:82,112,136,153,172,213,231` ; `enrolement/indicateurs.service.ts:82,92,106,123,155,170,185,211` ; `sync/batch-store.ts:28,35,52` ; `sync.service.ts:1747` ; `analytics/campagnes.service.ts:74` ; `analytics/quality.service.ts:57,129,142,189,196,233` ; `analytics/funnel.service.ts:47,93` ; `analytics/portfolio.service.ts:40,125,162` ; `analytics/stock-representants.service.ts:24,35,42` ; `analytics/supervision.service.ts:590,617,649,675,699,738,748,763,781,818,869` ; `analytics/analytics.service.ts:42,113,137,208,238,264,300,347` ; `analytics/pilotage.service.ts:26` ; `ouvertures.service.ts:332` ; `deploy-workspaces.ts:33` ; `demo-workspace-factory.ts:69,83` ; `demo-volume.ts:744-745`. Concentration dans `analytics/*`.

Transactions interactives (30 dans 17 fichiers) : `segment-change.service.ts:115`, `prospects.service.ts:652,718,821`, `auth.service.ts:222`, `purge.service.ts:63`, `import-runner.service.ts:283`, `lots-export.service.ts:168,334,380`, `bank-case-stages.service.ts:46,136`, `bank-cases.service.ts:192,336`, `representants-import.service.ts:239,351`, `representants.service.ts:497,546,857`, `client-requests.service.ts:208`, `users.service.ts:102,185,309,342,381`, `visite-referentiels.service.ts:202`, `rep-campaigns.service.ts:78`, `sync.service.ts:464`, `parametres-chues.service.ts:57`, `ouvertures.service.ts:270`. Longues probables : imports de masse et purge.

Aucun `$use` ni `$extends`. `@updatedAt` applicatif (pas de trigger). `uuid(7)` Prisma à remplacer par une génération applicative. Aucune injection SQL identifiée.
