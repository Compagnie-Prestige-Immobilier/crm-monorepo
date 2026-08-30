# QA mobile : authentification, session, mise à jour, stockage local

Date : 30 août 2026
Commit : `e8baacd` (arbre modifié, 1298 entrées non commitées)
Périmètre : `apps/mobile` (auth, réseau, mises à jour, Android, stockage local, cloisonnement des rôles) et `apps/api/src/modules/auth`, `apps/api/src/modules/app-updates`.
Méthode : lecture de code, appels HTTP réels contre `http://localhost:3001`. Aucun émulateur.

## Synthèse

| Id | Sévérité | Composant | Titre |
|---|---|---|---|
| SEC-01 | bloquant | `features/auth` + base locale | La déconnexion ne purge pas la base : les fiches d'un commercial restent lisibles et sa file part sous l'identité du suivant |
| SEC-02 | majeur | `features/auth` + `core/router` | Le rôle n'est jamais réévalué après la connexion : la surveillance de rétrogradation est morte |
| SEC-03 | majeur | `android/app/build.gradle.kts` | Une release se signe avec la clé de debug publique quand `key.properties` manque |
| SEC-04 | majeur | `core/network/auth_interceptor.dart` | Une réponse de renouvellement perdue après rotation révoque toute la famille : déconnexion en plein terrain |
| SEC-05 | majeur | `api/modules/auth` | `POST /auth/workspace` laisse la famille précédente vivante : « Se déconnecter » ne ferme pas tout |
| SEC-06 | mineur | `core/updates` | L'empreinte de signataire attendue vient du même canal que l'APK : ce n'est pas un épinglage |
| SEC-07 | mineur | `api/modules/auth` | Le jeton d'accès survit à la déconnexion pendant tout son TTL (4 h ici) |
| SEC-08 | mineur | `core/updates` + API | Le plancher de version n'est appliqué que par le client ; aucun contrôle serveur |
| SEC-09 | mineur | `features/shell/projects.dart` | Le garde de projet est défaillant-ouvert : un rôle inconnu entre dans le CHUES |
| SEC-10 | mineur | `features/phase2` | Notes vocales orphelines jamais purgées, ni à l'échec définitif ni à la déconnexion |
| SEC-11 | mineur | Android | Aucun `FLAG_SECURE` : capture d'écran et vignette « Récents » sur des écrans nominatifs |

## SEC-01 (bloquant) : la déconnexion ne purge pas la base locale

**Scénario.** Awa (COMMERCIAL) travaille sur un téléphone, saisit des représentants, des prospects et des visites, dont certaines restent en file. Elle se déconnecte depuis Réglages. Fatou se connecte sur le même appareil.

**Attendu.** Aucune donnée personnelle de la session précédente ne survit à la déconnexion ; aucune saisie en file ne peut être imputée au compte suivant.

**Observé.**
1. Fatou voit dans « Historique », « Registre », « Rappels » et « À corriger » les fiches d'Awa : noms, prénoms, téléphones E.164, commentaires.
2. Les lignes d'outbox d'Awa restent `pending` et repartent avec le jeton de Fatou. Les créations sont enregistrées côté serveur au nom de Fatou ; les mises à jour sont refusées et retombent dans « À corriger » de Fatou, en lui montrant les données d'Awa.

**Preuve.** `apps/mobile/lib/features/auth/auth_controller.dart:118-132`

```dart
Future<void> signOut() async {
  await ref.read(pushInboxStoreProvider).purge();
  await ref.read(phase2DirectoryProvider).purge();
  final String? refresh = await _tokens.readRefreshToken();
  ...
  await _tokens.clear();
  state = const AuthState.signedOut();
}
```

Seules les notifications et l'annuaire de phase 2 sont purgés. Aucune purge de `representants`, `prospects`, `prospect_journeys`, `representant_comments`, `visites`, `call_attempts`, `rep_callback_reminders`, `form_drafts`, `outbox` ni `sync_state`. Aucun `deleteAll`, `wipe`, `clearAll`, `deleteDatabase` ni `DELETE FROM representants|prospects|visites` dans `apps/mobile/lib`.

Aucune lecture n'est filtrée par propriétaire (`apps/mobile/lib/data/repositories/reference_repository.dart:158-163`) alors que `created_by_id` existe sur les tables (`schema.drift:194`, `:232`, `:529`, `:854`). La table `outbox` (`schema.drift:325-386`) ne porte aucune colonne de propriétaire.

Côté serveur, l'auteur est pris sur le jeton, jamais sur la charge utile : `prospects.service.ts:339`, `representants.service.ts:261`, `visites.service.ts:160-177` ; `sync.service.ts:543` (`if (existing.createdById !== user.id)`) refuse la mise à jour, ce qui explique la seconde moitié du symptôme. La déconnexion est proposée alors que la file n'est pas vide (`reglages_screen.dart:368-378`).

**Cause.** `signOut` traite le coffre à jetons comme la seule mémoire de session ; la base Drift est un cache partagé sans notion de titulaire.

**Correctif minimal proposé.** Faire de `signOut` un point de purge unique et transactionnel : vider dans une seule transaction Drift toutes les tables métier et `sync_state`, ainsi que le répertoire `call-recordings/` (SEC-10), avant d'effacer le coffre. Si l'on veut préserver la file, refuser la déconnexion tant que `countSchedulableOutbox() > 0`. Vérification : base semée par un compte, déconnexion, reconnexion avec un autre compte, tables `representants`, `prospects`, `visites`, `outbox` à zéro.

## SEC-02 (majeur) : le rôle n'est jamais réévalué après la connexion

**Scénario.** Un COMMERCIAL est rétrogradé en ACCUEIL côté serveur. Le téléphone reste connecté (jeton de renouvellement valide 30 jours).

**Observé.** `AuthState.role` ne change jamais après la connexion. Le compte garde les coques CHUES et Grand Public, et lit hors ligne tout ce que la base locale contient déjà.

**Preuve.** Le rôle n'est écrit qu'à la connexion ou à la restauration du coffre (`auth_controller.dart:43-49`, `:87-93`). Le renouvellement (`auth_interceptor.dart:141-164`) ne touche ni `saveIdentity` ni `AuthController`. `/auth/me` n'est appelé nulle part. Le garde-fou de `app_router.dart:483-490` (`ref.listen<AuthState>` sur `previous?.role != next.role`) attend un évènement qui ne peut pas se produire.

**Limite.** Le serveur relit rôle et activation à chaque requête (`fresh-session.guard.ts:18-45`) : pas de contournement serveur, mais exposition du cache local répliqué et de la surface de navigation pendant toute la vie du jeton de renouvellement.

**Correctif minimal proposé.** `AuthTokensDto` contient déjà `user` : `refreshCall` (`dio_factory.dart:46-61`) remonte `body.user`, `AuthController` réécrit `saveIdentity` et `state`.

## SEC-03 (majeur) : repli sur la clé de debug pour les builds release

**Preuve.** `apps/mobile/android/app/build.gradle.kts:53-71` :

```kotlin
release { signingConfig = signingConfigs.findByName("cpi") ?: signingConfigs.getByName("debug") ... }
```

`key.properties` est absent du clone et ignoré (`.gitignore:119`). Aucun `error()` ne fait échouer `release`. La CI ne construit que du debug (`quality-extended.yml:124`) : le risque porte sur les builds manuels de distribution. Un APK release signé par la clé de debug publique laisse n'importe qui produire une « mise à jour » acceptée par Android pour `sn.cpi.go`, l'application déclarant `REQUEST_INSTALL_PACKAGES` et `UPDATE_PACKAGES_WITHOUT_USER_ACTION`.

**Correctif minimal proposé.** `release { signingConfig = signingConfigs.findByName("cpi") ?: error("key.properties requis pour un build release") }`. Vérification : `flutter build apk --release` sans clé doit échouer ; avec la clé, `apksigner verify --print-certs` rend l'empreinte du parc.

## SEC-04 (majeur) : une réponse de renouvellement perdue après rotation révoque la famille

**Scénario.** Sur un lien 2G, `POST /auth/refresh` parvient au serveur qui tourne le jeton, mais la réponse n'arrive pas dans les 10 s. Le client réessaie avec le même jeton.

**Observé.** Le serveur lit un rejeu, révoque la famille entière. Le client passe en `SessionExpired`, vide le coffre et exige une reconnexion, derrière laquelle la file de saisies reste bloquée.

**Preuve.** `auth_interceptor.dart:175-191` réessaie sur `receiveTimeout`, `transformTimeout`, `connectionError` ; `_performRefresh` (`:141-164`) représente le même jeton jusqu'à 3 fois. Budget de réception 10 s (`timeout_profile.dart:14-18`). Serveur : `auth.service.ts:117-126` révoque dès `revokedAt` non nul. Vérifié en direct : premier renouvellement `200`, rejeu `401 REFRESH_TOKEN_REPLAYED`, jeton fils légitime `401 REFRESH_TOKEN_REPLAYED`. Le test `auth_refresh_test.dart:94-117` ne couvre que `connectionError` (requête non parvenue).

**Correctif minimal proposé.** (a) Client : ne réessayer que sur `connectionTimeout`, `connectionError`, `sendTimeout`. (b) Serveur : tolérer la représentation du dernier jeton consommé d'une famille pendant 30 à 60 s en renvoyant le couple déjà émis.

## SEC-05 (majeur) : le changement d'espace laisse une famille de jetons vivante

**Preuve.** `auth.service.ts:151-168` : `switchWorkspace` émet une famille neuve sans `revokeFamily` ; `:170-177` : `logout` ne révoque que la famille présentée. Vérifié en direct : connexion, `POST /auth/workspace {"workspace":"demo"}` 200, `POST /auth/logout` (jeton demo) `{"revoked":true}`, `POST /auth/refresh` avec le jeton d'avant la bascule : 200.

**Portée.** Le mobile n'appelle jamais `switchWorkspace` ; le déclencheur est `apps/web/src/components/layout/user-menu.tsx:28`.

**Correctif minimal proposé.** Révoquer la famille présentée avant d'en émettre une neuve, ou conserver le `familyId` en changeant la revendication `workspace`.

## SEC-06 (mineur) : empreinte de signataire dictée par le même canal que l'APK

**Preuve.** `app_update_controller.dart:79` (`signerSha256: json['signerSha256'] as String?`, `null` = contrôle sauté, `:66-68`), passage au natif `:523-526`, `UpdatesChannel.kt:126-130` (`if (expected != null && expected != archiveSigner(apk))`). Ce qui compense : Android refuse un APK signé d'une autre clé que le paquet installé (dépend de SEC-03).

**Correctif minimal proposé.** Compiler l'empreinte du parc (`String.fromEnvironment('CPI_APK_SIGNER_SHA256')`) et refuser l'installation si elle est vide.

## SEC-07 (mineur) : le jeton d'accès survit à la déconnexion

**Preuve.** Vérifié en direct : `GET /auth/me` 200, `POST /auth/logout` `{"revoked":true}`, `GET /auth/me` avec le même jeton 200, `POST /auth/refresh` 401. `exp - iat` = 14400 s (`JWT_ACCESS_TTL=4h`, défaut `15m`, `env.ts:54`). Compense : le jeton d'accès ne vit qu'en mémoire côté mobile (`secure_token_store.dart:28`).

**Correctif minimal proposé.** `JWT_ACCESS_TTL` à 15 min en production.

## SEC-08 (mineur) : le plancher de version n'existe que dans le client

**Preuve.** Aucune route serveur ne lit une version de client (`versionCode`, `X-App-Version` absents de `apps/api/src`). Le `versionCode` qui décide de `forceUpdate` est fourni par le client (`app-updates.controller.ts:49`, `app_update_controller.dart:311-315`). Les commentaires `app_update_controller.dart:31-33` et `:60-62` annoncent un refus serveur qui n'existe pas.

**Correctif minimal proposé.** En-tête de version sur les routes d'écriture comparé au plancher, ou corriger les commentaires.

## SEC-09 (mineur) : garde de projet défaillant-ouvert sur un rôle inconnu

**Preuve.** `projects.dart:111-133` : `orElse: () => Role.unknownDefaultOpenApi`, puis `CpiProject.chues => parsed == Role.COMMERCIAL || ... || parsed == Role.unknownDefaultOpenApi || ...`. `role == null` suit le même chemin. `route_guard.dart:95-98` et `route_memory.dart:80-83` s'appuient sur ce verdict ; `saveIdentity` n'écrit `user_role` que s'il est non nul (`secure_token_store.dart:83`).

**Correctif minimal proposé.** `role == null` ferme tout et renvoie à la connexion ; un rôle non reconnu garde, si on y tient, la coque historique. Test : `isOpenTo(null)` faux sur les trois projets.

## SEC-10 (mineur) : notes vocales orphelines jamais purgées

**Preuve.** Effacement seulement après envoi réussi (`sync_engine.dart:780-782`) et à l'abandon explicite (`write_repository.dart:1293-1297`). `_markFailed` ne supprime rien ; `_discardRecording` (`phase2_screen.dart:156-167`) dépend de `dispose()`, absent sur une mort de processus. `call-recordings` n'apparaît qu'une fois (`call_audio_recorder.dart:92`) : aucune routine de ménage.

**Correctif minimal proposé.** Supprimer dans `_markFailed` ; au démarrage, balayer `call-recordings/` sur le modèle de `_purgeStaleApks` (`app_update_controller.dart:586-597`) ; inclure dans la purge de SEC-01.

## SEC-11 (mineur) : aucun `FLAG_SECURE`

**Preuve.** Aucune occurrence de `FLAG_SECURE`, `secureScreen`, `no_screenshot`, `flutter_windowmanager` dans `apps/mobile`. Capture d'écran et vignette « Récents » possibles sur registre, historique, fiche prospect, annuaire.

**Correctif minimal proposé.** `FLAG_SECURE` sur `MainActivity` dans `onCreate`.

## Vérifié sans défaut

- Sauvegarde et transfert : `allowBackup="false"` (`AndroidManifest.xml:68`), `data_extraction_rules.xml` et `backup_rules.xml` excluent tout.
- Trafic en clair : aucun `networkSecurityConfig` en release ; l'exception vit dans `src/debug/`, nominative sur `10.0.2.2` et `localhost`.
- Surface exportée : seule `MainActivity` est exportée, filtre `MAIN`/`LAUNCHER` seul ; récepteurs `exported="false"`, `RECEIVER_NOT_EXPORTED` (`UpdatesChannel.kt:66-71`).
- Journaux : `verboseLogs` jamais activé (`dio_factory.dart:19`, `:64`), corps de `/auth/login` et `/auth/refresh` masqués (`logging_interceptor.dart:51-52`), pino expurge `tokenHash` et `phoneE164` (`app.module.ts:80-90`).
- Secrets : aucune clé ni trousseau dans `apps/mobile` ; `key.properties` ignoré.
- Coffre chiffré : `flutter_secure_storage 10.3.1`, AES/GCM, `resetOnError: true`, jeton d'accès jamais persisté, « Rester connecté » décoché efface la clé du coffre (`secure_token_store.dart:42-48`).
- Limitation de connexion : 10/min mesurés (9 × 401 puis 429 sur 13), non contournable par `X-Forwarded-For` (`API_TRUST_PROXY_HEADERS` faux par défaut).
- Mots de passe : argon2id 19 456 Kio, condensat leurre, message identique (`auth.service.ts:19-25`, `:58-65`).
- Rotation et rejeu : révocation de famille au rejeu constatée en direct.
- Autorité relue à chaque requête : `FreshSessionGuard`.
- Renouvellement concurrent entre isolats : `DatabaseRefreshMutex`, bail 90 s, jeton relu dans le verrou (`auth_interceptor.dart:131`, `:142`).
- Écran de mise à jour bloquant : remplace `MaterialApp.router` (`app.dart:76-88`) ; « Plus tard » seulement si `!force` (`app_update_screen.dart:120-127`), `postpone()` sort si `belowFloor` (`app_update_controller.dart:486-489`).
- Intégrité de l'APK : SHA-256 vérifié après téléchargement et à la reprise (`app_update_controller.dart:563-582`, `:658-661`).
- Mémoire de route : liste blanche, expiration 24 h, invalidation au `buildNumber`, effacée aux deux déconnexions (`route_memory.dart:44-85`, `hub_screen.dart:143`, `reglages_screen.dart:361`).
- Permissions Android : chacune rattachée à un usage réel ; pas de `showWhenLocked` ni `turnScreenOn`.
- Secrets de jetons : 32 caractères minimum et distincts (`env.ts:52-53`, `:104-108`).
- TLS : aucun `badCertificateCallback`, aucun `HttpOverrides`.

## Non vérifié

- Tout comportement d'exécution sur appareil (pose de l'APK, vignette « Récents », coffre sur parc réel, restauration Android).
- Shorebird : `shorebird.yaml` embarqué, `auto_update` actif par défaut, `shorebird_code_push` absent, CI sans release. Un `shorebird patch` ouvre un second canal de livraison de code Dart hors du chemin d'APK signé et du SHA-256 maison : à trancher explicitement.
- TLS de `go.cpi-chues.com` : non sondé.
- Signature réelle des APK distribués : `apksigner verify --print-certs` sur l'artefact de production.
- Fenêtre de course de SEC-04 : mécanisme prouvé des deux côtés, non reproduit en conditions réelles.

## Prochains propriétaires

SEC-01, 02, 06, 09, 10, 11 : mobile Flutter. SEC-03 : devops. SEC-04 : mobile et backend. SEC-05, 07, 08 : backend NestJS.

## Commandes exécutées

```
git rev-parse --short HEAD                                   -> e8baacd
git status --porcelain | wc -l                               -> 1298
curl -s ".../api/v1/app-updates/android/current?versionCode=1"
13 × POST /api/v1/auth/login (mot de passe faux)             -> 9 × 401 puis 429
POST /api/v1/auth/login avec X-Forwarded-For (deux adresses)  -> 429, 429
qa2.py : connexion, rotation, rejeu, jeton fils
qa3.py : me / logout / me / refresh
qa4.py : workspace demo, logout, ancien refresh
```

Aucune écriture dans le dépôt par l'auditeur ; `.env` non ouvert ; aucun secret reproduit.
