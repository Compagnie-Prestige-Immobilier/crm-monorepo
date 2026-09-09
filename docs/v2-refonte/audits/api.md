# Audit v2 : inventaire exhaustif de l'API (7 septembre 2026)

Références relatives à la racine du dépôt. 36 contrôleurs, ~231 routes, plus le WebSocket de présence câblé hors routeur.

## 0. Socle transverse

- Bootstrap `apps/api/src/main.ts:1-11`, `bootstrap.ts:1-174` : Fastify + Nest, préfixe `api`, version URI `v1` (`bootstrap.ts:118-119`), `ValidationPipe` `whitelist/forbidNonWhitelisted/transform` (`VALIDATION_FAILED`, `:121-132`), filtre Prisma → HTTP (`:133`, `common/filters/prisma-exception.filter.ts`), `setErrorHandler` de secours (`:135-164`), `enableShutdownHooks` (`:165`).
- CORS `@fastify/cors`, `API_CORS_ORIGINS`, `credentials: true`, en-têtes exposés `Idempotency-Replayed`, `Retry-After`, `Content-Disposition`, `X-Demo-Mode` (`:107-116`, `modules/export/demo-marking.ts`).
- `@fastify/helmet` (`:102`). Aucune compression.
- Deux limiteurs superposés : `@fastify/rate-limit` 600/min (`:103`) et `ThrottlerModule` `API_GLOBAL_RATE_LIMIT` 300/60 s (`app.module.ts:107-109`), plus `@Throttle` par route (login 10/60 s, imports 5/60 s, APK `APK_DOWNLOAD_RATE_LIMIT`/h avec contournement `Range`, purge et dump 5/60 s).
- Multipart `@fastify/multipart`, limite `APK_MAX_SIZE_BYTES`, 1 fichier / 8 champs (`:104-106`).
- `genReqId` accepte `x-request-id` `^[\w-]{1,64}$` (`:57-60`).
- `nestjs-pino`, redaction `authorization`, `cookie`, `idempotency-key`, mots de passe, jetons, `phoneE164` (`app.module.ts:82-104`) ; en dev `pino-pretty` + fichier journalier (`:58-81`).
- OpenAPI si `API_DOCS_ENABLED` (`bootstrap.ts:167-171`) ; `openapi.ts` avec `OPENAPI_GENERATION=1`, crons et Prisma auto-désactivés (`prisma.service.ts:41-43`, `imports.cron.ts:47`).
- Guards globaux : `ThrottlerGuard` → `JwtAuthGuard` (`typ:'access'`, repli `demo` → `public`) → `FreshSessionGuard` (relit `role/isActive/deletedAt` à chaque requête, cache Redis 30 s, `SESSION_REVOKED`/`ACCOUNT_DISABLED`) → `RolesGuard` (`@Roles` de méthode remplace celui de classe, piège documenté `client-requests.controller.ts:34-35`) (`app.module.ts:144-148`).
- Cache `@Cached(ttl, group?)` (`redis/cache.interceptor.ts`) : `scope` = rôle si `readsEveryone` sinon `userId`, + URL ; écriture de la classe avec `group` → `bump` + `LiveService.emit`. Sans `REDIS_URL` : no-op (`redis.service.ts:54-71`).
- SSE `GET /api/v1/live` (`live.controller.ts`, `@ApiExcludeController`), ping 25 s, renouvellement à 14 min, topics `notifications|imports|db-dump|referentiels|app-updates`, `EventEmitter` mono-processus (`live.service.ts:10-15`).
- WebSocket présence `GET /api/v1/presence/live` (`heartbeat/presence-socket.service.ts`, `bootstrap.ts:78-80`) : jeton en en-tête, `beat` throttlé 10 s, fermeture à 15 min.

## 1. Variables d'environnement

`env.ts` : `NODE_ENV`, `LOG_LEVEL`, `PORT`, `PUBLIC_WEB_URL`, `API_CORS_ORIGINS`, `API_DOCS_ENABLED`, `API_TRUST_PROXY_HEADERS`, `DATABASE_URL`, `DATABASE_POOL_SIZE`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`, `AUTH_LOGIN_RATE_LIMIT`, `API_GLOBAL_RATE_LIMIT`, `BUSINESS_TIME_ZONE`, `PHONE_DEFAULT_REGION`, `SYNC_MAX_BATCH_SIZE`, `IDEMPOTENCY_TTL_DAYS`, `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`, `APK_RELEASE_DIR`, `APK_MAX_SIZE_BYTES`, `APK_SIGNER_SHA256`, `APK_DOWNLOAD_RATE_LIMIT`, `CALL_RECORDING_DIR`, `CALL_RECORDING_MAX_SIZE_BYTES`, `CALL_RECORDING_RETENTION_HOURS`, `DB_DUMP_DIR`, `DB_DUMP_ENABLED`, `DEMO_WORKSPACE_ENABLED`, `PLATEFORME_CHUES_URL/TOKEN`, `PLATEFORME_GRAND_PUBLIC_URL/TOKEN`.

`imports/imports.env.ts` : `IMPORTS_DIR`, `IMPORTS_MAX_BYTES` (≤256 Mio), `IMPORTS_CHUNK_SIZE` (≤5000), `IMPORTS_TTL_HOURS` (≤168), `IMPORTS_SWEEP_ENABLED`.

`notifications/notifications.env.ts` : `NOTIFICATIONS_REMINDERS_ENABLED/_AT`, `NOTIFICATIONS_DAILY_REPORT_ENABLED/_AT`, `NOTIFICATIONS_BANK_PENDING_ENABLED/_DAYS`, `NOTIFICATIONS_BANK_STALE_ENABLED/_DAYS`, `BREVO_API_KEY/_SENDER_EMAIL/_SENDER_NAME`, `BUSINESS_TIME_ZONE` (lu deux fois).

`formulaire-public/turnstile.env.ts` : `TURNSTILE_SECRET_KEY`, `TURNSTILE_ALLOW_DEGRADED` (défaut `false` : sans clé, route fermée).

Hors schéma : `process.env.PATH` (`db-dump.runner.ts:35`), `OPENAPI_GENERATION`, `ENV_FILE`.

## 2. Comportements hors requête

| Cron                                   | Fichier:ligne                           | Rôle                                                 |
| -------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| `EVERY_MINUTE` `cpi.imports.sweep`     | `imports/imports.cron.ts:44`            | reprend 3 imports max, expire les jobs échus         |
| `EVERY_MINUTE` `cpi.enrolement.tirage` | `enrolement/enrolement.service.ts:188`  | tire CHUES et Grand Public                           |
| `EVERY_MINUTE` `cpi.notifications.due` | `notifications/reminders.service.ts:96` | expédie `SCHEDULED` échues, `SENDING` au bail expiré |
| `REMINDERS_CRON` (`Africa/Dakar`)      | `reminders.service.ts:137`              | rappels dus, dossiers en attente/sans mouvement      |
| `DAILY_REPORT_CRON`                    | `reminders.service.ts:191`              | compte rendu de fin de journée                       |
| `EVERY_HOUR` `cpi.recordings.sweep`    | `phase2/recordings.service.ts:35`       | purge des notes audio (48 h)                         |
| `EVERY_10_MINUTES` `cpi.db-dump.sweep` | `db-dump/db-dump.service.ts:110`        | réconcilie l'export intégral                         |

`OnModuleInit` : `PrismaClients` (`prisma.service.ts:40-47`, parité des migrations), `AppUpdatesModule` (`app-updates.module.ts:18-26`, `@fastify/static`), `DbDumpService` (`db-dump.service.ts:97-107`).

Asynchrone : imports (`import-runner.service.ts`, bail, tranches `IMPORTS_CHUNK_SIZE`, transaction 60 s, reprise `processedRows` `imports.service.ts:281-320`) ; notifications (bail `DispatchClaim`, boîte interne + Brevo réservé aux COMMERCIAL, abandon à 24 h, `notifications.service.ts:47-1093`) ; `pg_dump --format=plain --schema=public` gzip 9 (`db-dump.runner.ts:18-71`).

Appels sortants : plateformes d'enrôlement CHUES et Grand Public (`enrolement/plateformes.ts:107-243`, 400 pages max, pause 600 ms) ; Turnstile `siteverify` 10 s (`formulaire-public/turnstile.ts:49-67`) ; Brevo `POST /v3/smtp/email` 99 destinataires, 8 concurrents (`brevo.transport.ts:5-9,193-221`). Aucun appel Dokploy, WhatsApp, Firebase (retiré, `notifications.service.ts:65-68`).

## 3. Endpoints par module

Rôles : `PARCOURS_ROLES` = ADMIN, COMMERCIAL, CHARGE_CLIENTELE, SUPERVISEUR, DIRECTION ; `ENCADREMENT` = ADMIN, SUPERVISEUR, DIRECTION ; `VISITE_REGISTRE_ROLES` = ADMIN, DIRECTION, ACCUEIL ; `SYNC_ROLES` = tous (`roles.decorator.ts:58-63`).

### auth (`auth.controller.ts`)

`POST login` (public, `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `@Throttle` 10/60 s) ; `POST refresh` (`INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_EXPIRED`, `REFRESH_TOKEN_REPLAYED`, rotation avec révocation de famille) ; `POST logout` (idempotent) ; `GET me` ; `PUT me/password` (`INVALID_CURRENT_PASSWORD`) ; `POST workspace` (`DEMO_WORKSPACE_DISABLED`). Argon2id `memoryCost 19456, timeCost 2, parallelism 1`, refresh SHA-256, digest factice anti-énumération (`auth.service.ts:23-27`). Identifiant = e-mail ou nom d'utilisateur (`auth.controller.ts:48`, `auth.service.ts:48`).

### users (classe ADMIN)

`GET` (ADMIN, SUPERVISEUR, DIRECTION ; tri `isActive desc, fullName asc`) ; `GET :id` ; `POST` (`USER_IDENTIFIER_TAKEN`) ; `PATCH :id` (`CANNOT_DEMOTE_SELF`, `LAST_ADMIN`) ; `PUT :id/active` (`CANNOT_DEACTIVATE_SELF`, `HANDOVER_REQUIRED`, `HANDOVER_TO_SELF`, `HANDOVER_TARGET_INVALID`, `LAST_ADMIN`) ; `PUT :id/password` ; `DELETE :id` (`CANNOT_DELETE_SELF`, `LAST_ADMIN`, `HANDOVER_REQUIRED`). Révocation des refresh + purge du cache de fraîcheur (`users.service.ts:214-227`).

### prospects

`GET` (`prospectReadScope`) ; `GET :id` (`NOT_OWNER` 403) ; `GET :id/call-attempts` ; `GET :id/device-calls` ; `POST` (PARCOURS_ROLES, 409 `PROSPECT_PHONE_CONFLICT`/`PROSPECT_ALREADY_EXISTS`, 403 `ENTITY_ID_OWNED_BY_ANOTHER_USER`, `id` client, attache le parcours si numéro connu du même auteur) ; `PATCH :id` (`assertOwnership`, `PROSPECT_PAYMENT_DURATION_INVALID`, `PROSPECT_STATUT_TRANSITION_REFUSED`, `PROSPECT_CONVERSION_REQUIRES_CONFIRMATION`) ; `PATCH :id/parcours/grand-public/consentement` ; `POST :id/parcours/grand-public/conversion` (`GRAND_PUBLIC_CONSENT_REQUIRED`) ; `POST :id/revue` (CHARGE_CLIENTELE, SUPERVISEUR, ADMIN, `PROSPECT_REVUE_REQUIRES_CONVERSION`, idempotent) ; `DELETE :id` ; `POST merge` (`MERGE_SAME_PROSPECT`, `MERGE_TWO_CONVERSIONS`, `MERGE_TWO_OPEN_BANK_CASES`) ; `PATCH :id/segment` (COMMERCIAL, CHARGE_CLIENTELE, ADMIN, `PROSPECT_SEGMENT_UNAVAILABLE`, `PROSPECT_SEGMENT_UNCHANGED`, `PROSPECT_REV_CONFLICT` 409, `expectedRev`) ; `GET :id/segment-history` ; `POST reassign` (`REASSIGN_NO_TARGET`, `REASSIGN_OWNER_FORBIDDEN`).

### representants

`GET` ; `GET lookup` ; `POST import` (ADMIN, `REPRESENTANT_IMPORT_FILE_MISSING/UNREADABLE/SHEET_MISSING/TOO_MANY_ROWS`, 413) ; `GET :id` ; `POST` ; `PATCH :id` ; `GET :id/relation-history` ; `GET :id/call-attempts` ; `GET :id/fiche-history` ; `GET :id/device-calls` ; `GET :id/comments` ; `POST :id/comments` (idempotent par `id`) ; `DELETE :id/comments/:commentId` (ADMIN) ; `DELETE :id` (`REPRESENTANT_HAS_PROSPECTS` sauf `cascade=true`).

### phase2

`POST call-attempts/:id/recording` (multipart, `CALL_RECORDING_INVALID/TOO_LARGE/EMPTY`, idempotent) ; `GET call-attempts/:id/recording` (`CALL_RECORDING_FORBIDDEN`) ; `GET directory` (6 champs, keyset, page 2000, retard 2 s, `PHASE2_DIRECTORY_CURSOR_INVALID`). `phase2/callbacks` : `GET`, `POST :id/cancel` (`CALLBACK_NOT_FOUND`, `NOT_OWNER`).

### rep-campaigns

`POST attempts` (`REP_CAMPAIGN_NOT_ASSIGNED`, `REPRESENTANT_PHONE_CONFLICT`, `REP_CAMPAIGN_COMMENT_REQUIRED`, `REP_CAMPAIGN_PROMISED_NOT_ALLOWED`, `REP_CAMPAIGN_CALLBACK_AT_REQUIRED`, `REP_STATUT_QUALIFICATION_UNKNOWN/INACTIVE`, `REP_OUTCOME_STATUT_MISMATCH`, `REP_RELATION_STATUT_MISMATCH`, `REP_STATUT_MOTIF_REQUIRED` ; idempotent).

### suggestions

`GET` (portée `suggestedById` sauf `readsEveryone`) ; `PATCH :id` (`SUGGESTION_NOT_FOUND`, `SUGGESTION_TRANSITION_REFUSED`).

### bank-cases (classe BANQUE_FINANCE, ADMIN)

`GET` ; `POST` (`BANK_CASE_PROSPECT_NOT_ENROLLED`, `BANK_CASE_BANK_REQUIRED/NOT_FOUND`, `BANK_WORKFLOW_NO_INITIAL_STAGE`, `BANK_CASE_REFERENCE_CONFLICT`) ; `GET analytics` (`@Cached(60)`) ; `GET prospect-search` ; `GET rejection-reasons` ; `GET :id` ; `PATCH :id` (`BANK_CASE_REV_CONFLICT`, `BANK_CASE_TERMINAL`) ; `POST :id/transitions` (`BANK_STAGE_NOT_FOUND/INACTIVE/NOT_NEXT`, `BANK_STAGE_CASHED_NOT_LAST`, `BANK_CASE_AMOUNT_REQUIRED/NOT_ALLOWED`, `BANK_CASE_REJECTION_REASON_REQUIRED/NOT_ALLOWED/NOT_FOUND`, `BANK_CASE_REJECTION_DETAIL_REQUIRED`) ; `POST :id/corrections` (ADMIN). `bank-case-stages` : liste, création, `reorder`, modification, activation (`BANK_STAGE_SYSTEM_IMMUTABLE`, `BANK_STAGE_HAS_OPEN_CASES`). `export/bank-cases.xlsx`.

### client-requests (classe ADMIN, routes BANQUE_FINANCE + ADMIN)

`POST` (`CLIENT_REQUEST_PROSPECT_EXISTS`, `ALREADY_PENDING`, `CLIENT_REQUEST_BANQUE_NOT_FOUND`) ; `GET` (agent sauf ADMIN) ; `GET :id` ; `POST :id/approve` (écriture conditionnelle `PENDING`, prospect `origin=BANQUE`) ; `POST :id/reject`.

### demo (ADMIN) : `GET`, `POST reset`. admin (ADMIN) : `GET purge`, `POST purge` (`PURGE_CONFIRMATION_MISMATCH`, `PURGE_NOT_FIRST_ADMIN`, transaction 300 s), `GET supervision` (`@Cached(30)`, ENCADREMENT).

### notifications (ADMIN sauf mention)

`POST` ; `GET` ; `GET mine` (tous) ; `GET audience-preview` ; `GET :id` ; `POST :id/cancel` (`NOTIFICATION_NOT_SCHEDULED`) ; `POST :id/read` (tous). `notification-templates` : CRUD + `POST :id/render` (`NOTIFICATION_TEMPLATE_VARIABLES_MISSING`).

### analytics (classe PARCOURS_ROLES, `@Cached(60)`)

19 GET : `funnel`, `totals`, `prospects-over-time`, `top-commercials`, `by-departement`, `by-banque`, `by-syndicat`, `by-phase2-status`, `by-enrollment-method`, `by-segment`, `top-representants`, `delays`, `bank-aging` (DIRECTION exclue), `weekly-cohorts`, `departement-yield`, `representant-productivity`, `ambassador-conversion`, `data-quality`, `segment-conversions`, `origin-breakdown`. SQL dans `analytics.sql.ts`, `pilotage.sql.ts`, `bank-cases.sql.ts`. `supervision` (ENCADREMENT) : `GET representants` (60), `GET campagnes` (30), `GET activite` (30), `GET/PUT creneaux` (`INVALID_WORK_SHIFTS`).

### export (sans `@Roles` de classe, `export.controller.ts:27-28`)

`prospects.xlsx` (SUPERVISEUR exclu), `prospects-modele.xlsx`, `prospects-grand-public-modele.xlsx`, `representants-modele.xlsx` (ADMIN), `representants.xlsx`, `visites.xlsx` (VISITE_REGISTRE_ROLES).

### app-updates (`@Cached(60,'app-updates')`)

`GET android/current` (public) ; `GET android/download` (public, `Range`) ; `GET android/releases` (ADMIN) ; `POST android` (ADMIN, manifeste + signature) ; `POST android/:versionCode/mandatory` ; `POST android/:versionCode/withdraw` (`APK_LAST_RELEASE`).

### db-dump (ADMIN, `DbDumpEnabledGuard`)

`GET`, `POST` (202, `DEMO_WORKSPACE_EXTERNAL_OPERATION_FORBIDDEN`, `DATABASE_DUMP_IN_PROGRESS`, `DATABASE_DUMP_ALREADY_READY`), `GET download` (`DATABASE_DUMP_NOT_READY`).

### imports (ADMIN)

`GET` ; `POST representants|prospects|prospects-grand-public|visites` (201, `@Throttle` 5/60 s, `DRY_RUN`) ; `GET :id` (`IMPORT_JOB_NOT_FOUND`) ; `POST :id/apply` (`IMPORT_NOT_APPLICABLE`).

### visites

Référentiels (lecture tous, CRUD ADMIN + DIRECTION), `statistiques`, `GET`, `GET :id`, `POST`, `PATCH` (VISITE_REGISTRE_ROLES). `visites/import` (ADMIN, DIRECTION) : create, get, revue, selection, apply.

### referentiels

`referentiels.controller.ts` (`@Cached(60,'referentiels')`) : bundle + 18 routes CRUD (banques, syndicats, canaux-provenance, professions, tranches-revenu, employeurs, pays, offres, départements/IEF/régions), lecture tous, écriture ENCADREMENT. `call-outcome-reasons`, `statuts-qualification` : `list`, `listAll`, `create`, `update`, `setActive` ; erreurs `STATUT_QUALIFICATION_NOT_FOUND/CODE_CONFLICT/LABEL_CONFLICT/LABEL_UNUSABLE/SYSTEM_IMMUTABLE/CALLBACK_NOT_ALLOWED/LAST_OF_BRANCH`, `PHASE2_REASON_UNKNOWN/INACTIVE/OUTCOME_MISMATCH`.

### enrolement (`:projet`, ADMIN)

`GET inscriptions`, `GET inscriptions/:id`, `GET indicateurs`, `GET/PUT reglages`, `POST tirage`, `DELETE inscriptions`, `DELETE inscriptions/:id`.

### champs-conversion (`:projet`) : `GET` (tous), `PUT` (ADMIN, `CHAMP_IMPOSE_MASQUE`, `CHAMP_LIBRE_SANS_LIBELLE`, `CHAMP_LIBRE_SANS_VALEUR`).

### parametres-chues : `GET` (PARCOURS_ROLES), `PATCH` (ENCADREMENT, `PARAMETRE_RESERVE_ADMIN`), `GET journal`.

### dashboards (`tableaux-de-bord/:ecran/disposition`, ADMIN, DIRECTION, SUPERVISEUR, ACCUEIL) : `GET/PUT/DELETE`, `PUT par-defaut` (ADMIN).

### formulaire-public : `GET formulaire` (public), `POST :jeton` (public, champ piège `site`, Turnstile, `LIEN_INVALIDE`, `CHAMPS_OBLIGATOIRES`).

### ouvertures : `POST` (`OUVERTURE_CIBLE_INVALIDE`, `OUVERTURE_FICHE_INTROUVABLE`, `OUVERTURE_FICHE_DEJA_OUVERTE`, `OUVERTURE_ID_PRIS`), `GET courante`, `PUT :id/brouillon` (`OUVERTURE_DEJA_FERMEE`), `GET ouvertes` (ADMIN, SUPERVISEUR), `POST :id/liberation`, `GET comptage`.

### lots-export : 14 routes dont `GET mes-attributions` (mobile), `GET :id/fiches-recues.pdf` (`downloadLotExportFichesRecues`), export xlsx/zip/pdf, réaffectation, retrait.

### health (`/health`, hors préfixe) : `GET live`, `GET ready`. live : `GET /api/v1/live` (SSE).

## 4. Sync mobile

`POST /sync/push` (`SYNC_ROLES`) : idempotence à deux niveaux. Lot : `sync_batches` `(userId, idempotency_key)`, l'en-tête doit égaler `clientBatchId` (`IDEMPOTENCY_KEY_MISMATCH`/`REQUIRED` 422), empreinte SHA-256 sur `{clientBatchId, payloadVersion, operations}`, rejeu identique → `Idempotency-Replayed: true`, rejeu différent → 422 `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`, bail 60 s → 409 `IDEMPOTENCY_IN_PROGRESS` + `Retry-After: 2`. Opération : `sync_operations` `ON CONFLICT DO NOTHING`, verdict mémorisé `resultJson`. Une transaction par groupe de dépendance, max 25 groupes, max `SYNC_MAX_BATCH_SIZE` opérations. Entités : `representant`, `representant_comment` (create), `prospect`, `call_attempt` (`Phase2SyncService`), `visite` (create, VISITE_REGISTRE_ROLES), `appel_detecte` (create, `fenetreTentative`). `clearedFields` : `iefId, notes, whatsappE164, profession, prenom, etablissement, syndicat, banqueId, syndicatId, representantId`. `baseRev` → `REV_CONFLICT` sans échec HTTP. Anti-squat `ENTITY_ID_OWNED_BY_ANOTHER_USER`. Doublon téléphone par lecture explicite. `nextCursor` toujours `null`. Alerte `alerterAppelsNonConsignes` après push. Statuts `applied | duplicate | conflict | invalid | skipped_dependency_failed`.

`GET /sync/pull` : `X-CPI-Payload-Version` ≥ 5 sinon 426 `APP_UPDATE_REQUIRED`. Curseur base64url `{v:1, streams:{[nom]:{t, id}}}` (`cursor.ts`). Keyset `(updatedAt, id)`, `PULL_SAFETY_LAG_MS = 2000`. Flux dans l'ordre : `departements`, `iefs`, `banques`, `canauxProvenance`, `professions`, `employeurs`, `pays`, `visiteReferentiels`, `syndicats`, `incomeBands`, `representants` (aucune portée), `prospects` (aucune portée, l'appareil filtre), `visites`. Suppressions dans le même flux, aiguillées vers `deletions[]`. `hasMore`. Limite 200 (2000 annuaire), max 1000.

À remplacer par PowerSync : keyset + retard ; `clearedFields` ; `baseRev`/`rev` ; idempotence lot + opération avec verdict ; groupement transactionnel par dépendance ; portée asymétrique lecture/écriture.

## 5. Règles métier non triviales

- Transitions (`common/transitions.ts:23-64`) : `ProspectStatut` (CONVERTI terminal, PERDU récupérable), `RepresentantRelation` (rang ne baisse jamais sauf AMBASSADEUR ↔ REFUS), `SuggestionStatus` ; bypass ADMIN.
- Portée (`common/scope.ts`) : `ownerScope`, `attributionScope` (encadrement + fiches confiées par campagne via `lotItems`), `prospectReadScope` (CHARGE_CLIENTELE voit toute demande CONVERTI), `prospectSyncScope` (aucune).
- Doublon téléphone par lecture explicite, 409 nommant fiche et propriétaire (`prospects.service.ts:995-1034`, `representants.service.ts:898-923`).
- Fusion (`prospects.service.ts:785-882`) : `MERGE_TWO_OPEN_BANK_CASES`, `MERGE_TWO_CONVERSIONS`, parcours porteur de la conversion l'emporte, `clientCreatedAt` la plus ancienne.
- Réaffectation (`:885-926`) : COMMERCIAL ne désigne que ses lignes ; `commercialId` réservé ADMIN.
- Segments BDD1..4 : jamais stockés, `classifySegment` ; `SegmentChange` dans la même transaction (`segment-change.service.ts:67-165`), `expectedRev`.
- Statuts de qualification (`statuts-qualification.service.ts`) : issue découle de l'effet ; branches JOINT/NON_JOINT ; `LAST_OF_BRANCH` ; filtrage `minPayloadVersion <= payloadVersion` (`:110-116`).
- Qualification (`rep-campaigns.service.ts`) : statut prime sur l'issue ; échéance + origine ensemble ; une tentative plus ancienne que le dernier appel ne réécrit pas la fiche.
- WhatsApp : représentant lève (`WHATSAPP_NUMBER_NOT_ALLOWED/REQUIRED`), prospect déduit sans lever.
- Rappels : `RappelOrigine` PROMIS/AUTOMATIQUE (`rep-campaigns.service.ts:436-453`, `ouvertures.service.ts:277-306`).
- Ouvertures (`ouvertures.service.ts`) : `firstInputAt` posé une fois, durée nulle si borne manquante, une fiche ouverte par téléconseiller, libération → file de rappel.
- Détection d'appels (`common/device-call.ts`) : ±120 s ou saisie dans les 2 h, alerte de supervision par tranche de 30 min.
- Suggestions : réservées au commercial receveur, issue irréversible sauf ADMIN.
- Commentaires : append-only, idempotents, suppression ADMIN (soft-delete). Journal de fiche (`fiche-change.ts`) : `representant.fiche.<WEB|MOBILE|APPEL|IMPORT>`. Audit (`common/audit.ts`) : point unique, dans la transaction.
- Imports : deux systèmes coexistent (§6). Import prospects ne crée aucun représentant ; Grand Public colonnes par en-tête. Registre des visites avec revue (`visites-registre.adapter.ts`, `visites-registre.revue.service.ts`).
- Exports : `prospects.xlsx` `filtered` (3 feuilles) / `consolidated` (5 feuilles), `WorkbookWriter` + keyset, marquage démo.
- Purge (`admin/purge-plan.ts`) : ordre topologique `PURGE_STEP_ORDER`, `requires`, premier ADMIN seulement, confirmation par identifiant, transaction 300 s.
- Dump : état dans `AppSetting` (CAS JSON), bail 10 min, destruction après envoi, jamais `demo`.
- Mises à jour : manifeste APK, paquet `sn.cpi.go`, `versionCode` croissant, signature du parc, `mandatory`, 3 releases en ligne.
- Démo : `AsyncLocalStorage`, ensemencement paresseux, e-mails coupés, dump/export interdits.
- Formulaire public : rapprochement après envoi, téléphone fait foi, complète les cases vides seulement.
- Client-requests : agent ne voit que ses demandes ; approbation = prospect `origin=BANQUE` + `PENDING → APPROVED` conditionnel.
- Bank-cases (`bank-cases/workflow.ts`) : montant > 0 sur CASHED seulement, motif sur REJECTED, atteignabilité par position, correction ADMIN.
- Visites : référence par séquence annuelle, `timeKnown`, retrait des référentiels seulement.
- Analytics : `bank-aging` exclut les terminales, `weekly-cohorts` sur la saisie terrain, `ambassador-conversion` sur la bascule, `segment-conversions`.
- Users : `PASSWORD_MIN/MAX_LENGTH`, `LAST_ADMIN`, `HANDOVER_REQUIRED`.

## 6. Dettes et pièges

- Deux systèmes d'import de représentants actifs et consommés par le web : `representants-import.service.ts` (5 000 lignes, tout-ou-rien) et `imports/representants.adapter.ts:20-64` (50 000, reprenable). À unifier.
- Deux limiteurs superposés non documentés ensemble.
- `@Roles` de méthode remplace celui de la classe (`getAllAndOverride`).
- `downloadLotExportFichesRecues` (`lots-export.controller.ts:134-153`) rate les greps simples : l'inventaire fiable exige la lecture fichier par fichier.
- `SyncPushResponseDto.nextCursor` mort (`sync/dto.ts:867-874`).
- `EnrollmentMethod.PHYSICAL` conservé en lecture (`phase2/attempt-rules.ts:182-195`).
- `mineOrAssignedRepresentant` (`sync.service.ts:258-267`) rend toujours `{}` : code mort.
- `BUSINESS_TIME_ZONE` validé deux fois (`env.ts:64`, `notifications.env.ts:36`).
- Consommateurs : le mobile n'utilise que auth, sync, phase2 directory + recording, ouvertures, representants (create/update/delete/lookup/comment), rep-campaigns/attempts, notifications (mine/read), référentiels, champs-conversion, parametres-chues (lecture), visites (update), `mes-attributions`. Toute la gestion admin, analytics, imports, exports, purge, dossiers, dashboards, dumps, upload APK est web seulement. À revérifier avec un grep fin (chemins dynamiques) avant toute suppression : `GET /lots-export/:id/fiches-recues.pdf`, `suggestions`.
- Aucune compression HTTP.
- Sans Redis, cache et fraîcheur dégradent silencieusement.
- SSE mono-processus (`live.service.ts:10-15`).
- Création/mise à jour de prospects et représentants en double implémentation (REST `class-validator` vs sync `require*`), règles partagées (`whatsappDuProspect`, `applyRelationChange`, `recordFicheChange`) mais deux contrats d'erreur.
- `IMPORTS_SWEEP_ENABLED` : variable d'environnement pure.
