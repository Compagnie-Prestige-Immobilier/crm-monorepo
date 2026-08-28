# Plan mobile — retirer campagnes et tâches de CPI GO

Ce document s'adresse à quelqu'un qui n'a **aucun** contexte. Tout ce qu'il
faut savoir est ici. Chaque affirmation porte un chemin absolu et un numéro de
ligne, relevés sur la branche `feat/cpi-go-forui-organisateur` au 28 août 2026,
arbre de travail non commité inclus.

**Avertissement sur les numéros de ligne.** Ils sont exacts avant toute
modification. Dès qu'une étape supprime des lignes, les suivantes se décalent
dans le même fichier. Appliquer les étapes **dans l'ordre donné** et, en cas de
doute, retrouver la ligne par son texte cité plutôt que par son numéro.

---

## 1. Décision et périmètre

### Ce qu'est l'application

`apps/mobile` est **CPI GO**, une application Flutter Android hors ligne
utilisée par des téléconseillers au Sénégal. Elle sert trois « projets »
cloisonnés (Accueil, CHUES, Grand Public) derrière un écran-hub.

Pile exacte, relevée dans
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/pubspec.yaml` :

| Élément | Version épinglée | Ligne |
| --- | --- | --- |
| Flutter | 3.41.7 (`.fvmrc`, CI `.github/workflows/ci.yml:540`) | — |
| Dart SDK | `^3.11.5` | `pubspec.yaml:8` |
| flutter_riverpod | `^3.0.0` | `pubspec.yaml:17` |
| go_router | `^17.0.0` | `pubspec.yaml:21` |
| drift | `>=2.33.0 <2.34.0` | `pubspec.yaml:31` |
| drift_dev | `>=2.33.0 <2.34.0` | `pubspec.yaml:109` |
| forui | `^0.21.3` | `pubspec.yaml:103` |
| phosphor_flutter | `^2.1.0` | `pubspec.yaml:64` |
| flutter_local_notifications | `^19.4.2` | `pubspec.yaml:91` |
| crm_api_client | dépendance de **chemin** vers `packages/api-client-dart` | `pubspec.yaml:49` |

Plateforme : **Android uniquement** (`ios: false` dans
`pubspec.yaml:150` et `pubspec.yaml:171`). Il n'y a pas de dossier `ios/`.

Architecture en place, à **préserver** :

- État : Riverpod 3, providers déclarés à la main (pas de `riverpod_generator`
  dans le dépôt). Point central :
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/providers/app_providers.dart`.
- Navigation : `go_router` 17, routeur unique dans
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/app_router.dart`,
  chemins constants dans
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/route_paths.dart`.
- Base locale : drift, schéma écrit **en SQL** dans
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/local/schema.drift`
  (963 lignes), migrations dans
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/local/database.dart`.
- Synchronisation delta : `GET /v1/sync/pull` + `POST /v1/sync/push`, moteur
  dans
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/sync/sync_engine.dart`
  (2214 lignes), file d'écriture `outbox`.
- Kit d'interface : ForUI + widgets maison préfixés `Cpi*` dans
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/ui/widgets/cpi_kit.dart`.

### La décision du propriétaire (donnée, non négociable)

**On arrête de consigner qui doit appeler qui.** Le mobile ne voit plus du tout
les campagnes d'appels ni les tâches d'appel. Disparaissent : les files
« À appeler », les compteurs « pas encore appelés », « prochain contact », la
progression de campagne, l'écran de liste des campagnes et l'écran de file.

**Ce que le téléconseiller fait désormais, librement, en trois gestes :**

1. Chercher un représentant dans l'annuaire commun et **consigner l'appel**
   (joignable / à rappeler / injoignable, oui-non représentant CHUES, personne
   proposée).
2. **Ajouter un prospect.**
3. Chercher un prospect et **consigner l'appel de conversion**.

**Plus, et rien d'autre :**

- Les **rappels** qu'il a promis (avec les alarmes système, en cours de
  renforcement par un autre agent — ne pas y toucher).
- **L'historique** de ce qu'il a consigné.
- **« À corriger »** pour les envois refusés.

### Périmètre de ce plan

Dans le périmètre : `apps/mobile` en entier, plus la régénération du client Dart
`packages/api-client-dart` (engendrée, jamais éditée à la main).

Hors périmètre : `apps/api` (voir le plan API), `apps/web` (voir le plan web),
`references/` (ne pas toucher).

À **préserver absolument** (travail non commité d'autres agents sur cette
branche) :

- `apps/mobile/lib/core/notifications/rep_callback_notifications.dart`
- `apps/mobile/lib/features/notifications/rep_callback_due_listener.dart`
- `apps/mobile/lib/features/rappels/presentation/rappels_screen.dart`
- `apps/mobile/lib/features/rappels/presentation/rappels_en_retard_banner.dart`
- `apps/mobile/lib/features/permissions/alarme_permission.dart`
- `apps/mobile/lib/features/permissions/presentation/battery_help_screen.dart`
- `apps/mobile/lib/features/representant/presentation/representant_qualification_screen.dart`
- `apps/mobile/android/app/src/main/AndroidManifest.xml`
- `apps/mobile/test/features/rappel_alarme_test.dart`
- Tout `apps/web/**` et `apps/api/**`

### Règles du dépôt à respecter

Relevées dans
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/AGENTS.md` :

- Modifier les fichiers avec `Edit`, en créer avec `Write`. **Jamais** `sed`,
  `python`, un heredoc, `cat >` ou une redirection shell.
- **Commentaires rares.** Un commentaire ne se justifie que si le code ne PEUT
  pas porter l'information (contrainte externe, choix contre-intuitif, piège).
  Une à deux lignes. Interdits : les bandeaux, les séparateurs graphiques, les
  paragraphes, la narration. Au-delà de 15 % de lignes de commentaire, le
  fichier est à réécrire.
- **Français d'interface sobre.** Pas de tiret cadratin. Pas de remplissage, pas
  de réassurance non demandée, pas d'explication du fonctionnement interne.
  Un état vide dit quoi faire ensuite. Une erreur dit ce qui s'est passé et ce
  que le lecteur peut faire.
- **Vocabulaire figé** (gardé par `apps/web/src/lib/vocabulaire.test.ts`) :
  `teleconseiller`. Les mots `commercial` et ses déclinaisons sont **interdits**
  dans une chaîne affichée.
- **Kit `Cpi*` et ForUI avant tout widget maison.** Icônes **Phosphor**
  uniquement, taille via les constantes `CpiIconSize` (un test le garde, voir
  §7). Espacements via `CpiSpacing`.
- **Aucune mention d'un assistant dans un commit ni une PR.** Format
  Conventional Commits avec portée : `feat(mobile): …`.
- **Ne pas commiter sans demande explicite.** Ne pas lancer `git stash`,
  `git checkout`, ni de build Android, ni l'émulateur.
- Un test qu'on n'a pas vu **rougir** n'a rien prouvé : casser le code qu'il
  couvre, vérifier l'échec, remettre.

---

## 2. Inventaire

Verdicts : **SUPPRIMER** (le code disparaît), **RÉÉCRIRE** (le fichier reste,
le passage change), **GARDER** (aucune modification).

### 2.1 Base locale

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/local/schema.drift`

| Ligne(s) | Objet | Verdict |
| --- | --- | --- |
| 803-808 | Bandeau de commentaire « Campagnes d'appels » | SUPPRIMER |
| 810-818 | `CREATE TABLE call_campaigns` (id, name, status, spread_days, closed_at, updated_at) | SUPPRIMER |
| 820-834 | `CREATE TABLE call_tasks` (id, campaign_id, prospect_id, position, day_index, status, updated_at) | SUPPRIMER |
| 836 | `CREATE INDEX call_tasks_campaign_idx` | SUPPRIMER |
| 837-841 | `CREATE INDEX call_tasks_prospect_idx` + son commentaire | SUPPRIMER |
| 843-851 | Requête nommée `campaignQueue` | SUPPRIMER |
| 853-860 | Requête nommée `campaignsWithOpenWork` | SUPPRIMER |
| 862-869 | `CREATE TABLE rep_call_campaigns` | SUPPRIMER |
| 871-879 | `CREATE TABLE rep_call_tasks` | SUPPRIMER |
| 881-882 | `rep_call_tasks_campaign_idx`, `rep_call_tasks_representant_idx` | SUPPRIMER |
| 884-891 | Requête nommée `repCampaignQueue` | SUPPRIMER |
| 893-899 | Requête nommée `repCampaignsWithOpenWork` | SUPPRIMER |
| 901-917 | `CREATE TABLE rep_callback_reminders` + index | **GARDER** (les rappels restent) |
| 919-922 | Requête nommée `pendingRepCallbackReminders` | **GARDER** |
| 492-547 | `CREATE TABLE call_attempts` | **GARDER intégralement** |
| 437-470 | `CREATE TABLE phase2_directory` (annuaire des numéros à convertir) | **GARDER** |
| 774-795 | `countMyAttempts`, `countMyMethods`, `attemptsForProspect` | **GARDER** |

**Constat important : `call_attempts` ne porte NI `task_id` NI `campaign_id`.**
Vérifié par `grep -rn "taskId\|task_id" lib/ --include="*.dart"` : aucune
occurrence hors code engendré. Il n'y a donc **aucune colonne à retirer** de la
table des tentatives, ni de `call_attempts`, ni de `outbox`. La charge utile
poussée pour une tentative de conversion
(`write_repository.dart:817-838`) et pour une qualification représentant
(`write_repository.dart:951-964`) ne contient **aucun** `taskId`. Le contrat de
poussée est donc **inchangé**.

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/local/database.dart`

| Ligne(s) | Objet | Verdict |
| --- | --- | --- |
| 17 | `int get schemaVersion => 19;` | RÉÉCRIRE → `20` |
| 170-177 | Palier `if (from < 12 && to >= 12)` : `createTable(callCampaigns)`, `createTable(callTasks)`, deux `createIndex` | SUPPRIMER |
| 215-220 | Palier `if (from < 17 && to >= 17)` : `createTable(repCallCampaigns)`, `createTable(repCallTasks)`, deux `createIndex` | SUPPRIMER |
| 221-224 | Palier v18 (`rep_callback_reminders`) | **GARDER** |
| 225-237 | Palier v19 (colonnes de renseignements sur `call_attempts`) | **GARDER** |
| après 237 | Nouveau palier v20 : `DROP TABLE IF EXISTS` des quatre tables | **AJOUTER** |

Pourquoi supprimer les paliers v12 et v17 au lieu de les laisser : `m.createTable`
prend en argument le getter drift de la table (`callCampaigns`). Une fois la
table retirée de `schema.drift`, ce getter **n'existe plus** et le fichier ne
compile pas. Il n'y a pas de perte : un appareil parti d'une version ≤ v11
n'aura jamais ces tables, et un appareil parti d'une version ≥ v12 les fera
supprimer par le palier v20.

`DROP TABLE` supprime automatiquement les index qui portent dessus : aucun
`DROP INDEX` n'est nécessaire. Aucune ligne d'une autre table ne référence ces
quatre tables (le schéma dit explicitement, `schema.drift:820-824`, qu'il n'y a
**aucune clé étrangère** dessus) : il n'y a donc **aucun nettoyage de lignes**
à faire ailleurs.

Dumps de schéma dorés :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/drift_schemas/`
contient `drift_schema_v1.json` … `drift_schema_v19.json`. Il faudra produire
`drift_schema_v20.json` (§4, étape 4).

Copies Dart engendrées des schémas :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/data/generated_migrations/schema_v1.dart`
… `schema_v19.dart` plus `schema.dart`. **Ne pas éditer à la main** (bandeau
`GENERATED BY drift_dev, DO NOT MODIFY.`). Il faudra engendrer `schema_v20.dart`
et régénérer `schema.dart`.

### 2.2 Synchronisation

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/sync/sync_engine.dart`

| Ligne(s) | Objet | Verdict |
| --- | --- | --- |
| 59 | `static const int payloadVersion = 4;` | **GARDER à 4** — voir §5 et §6 |
| 1975-1992 | Boucle `for (final SyncCallCampaignDto c in page.changes.callCampaigns)` | SUPPRIMER |
| 1993-2019 | Boucle `for (final SyncCallTaskDto t in page.changes.callTasks)` (avec la suppression sur `!t.isActive`) | SUPPRIMER |
| 2020-2034 | Boucle `repCallCampaigns` | SUPPRIMER |
| 2035-2057 | Boucle `repCallTasks` | SUPPRIMER |
| 2059-2088 | Boucle `visites` | **GARDER** |
| 2090-2107 | Boucle `page.deletions` | **GARDER** |
| 24 | `const String repCallAttemptEntity = 'rep_call_attempt';` | **GARDER** |
| 150-155 | Aiguillage de `drain()` vers `_sendRepCallAttempts` | **GARDER** |

Le **curseur** est un objet unique et opaque, stocké sous une seule clé dans
`sync_state` (`sync_engine.dart:2112-2151`, colonne `cursorKey`). Il n'est
**jamais** décomposé par flux côté mobile : le client le renvoie tel quel dans
`since`. Retirer des flux ne demande donc **aucune remise à zéro du curseur**
côté mobile. Confirmé côté serveur : `apps/api/src/modules/sync/cursor.ts:73-86`
boucle sur la liste **connue** des flux et **ignore** silencieusement toute clé
inconnue d'un curseur reçu.

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/sync/stub_api.dart`

| Ligne(s) | Objet | Verdict |
| --- | --- | --- |
| 64-67 | Les quatre arguments `callCampaigns:`, `callTasks:`, `repCallCampaigns:`, `repCallTasks:` passés à `SyncChangesDto(...)` | SUPPRIMER **après** régénération du client Dart |

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/sync/dio_api.dart`

| Ligne(s) | Objet | Verdict |
| --- | --- | --- |
| 58 | `RepCampaignsApi get _repCampaigns => _client.getRepCampaignsApi();` | **GARDER** |
| 171-183 | `recordRepCallAttempt` — poste une qualification représentant | **GARDER** |

Le nom `RepCampaignsApi` est celui de l'étiquette OpenAPI du serveur, pas une
campagne au sens mobile : c'est par cette API que part la **qualification d'un
représentant**, geste n° 1 qui reste. Si le plan API renomme cette étiquette,
`dio_api.dart:58` et `dio_api.dart:176` suivront mécaniquement à la
régénération.

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/repositories/write_repository.dart`

| Ligne(s) | Objet | Verdict |
| --- | --- | --- |
| 891-896 | `const Set<String> terminal = {'REACHED', 'PROSPECTS_PROMISED', 'REFUSED', 'WRONG_NUMBER'};` | SUPPRIMER (devient inutilisé) |
| 919-931 | Bloc `if (terminal.contains(outcome)) { update repCallTasks … status DONE }` | SUPPRIMER |
| 932-945 | Insertion dans `rep_callback_reminders` | **GARDER** |
| 946-966 | `_enqueue` de la qualification | **GARDER** |
| 741-858 | `recordCallAttempt` (conversion) | **GARDER** — aucune référence à une tâche |
| 977-996 | `honourRepCallbacks` | **GARDER** |
| 1004-1019 | `snoozeRepCallback` | **GARDER** |

### 2.3 Écrans et routes

| Fichier | Verdict | Remplacement |
| --- | --- | --- |
| `apps/mobile/lib/features/campagnes/campagnes.dart` (175 l.) | **SUPPRIMER le fichier** | Les trois constantes encore utiles (`grandPublicConsole`, `appelPour`, `appelGrandPublicPour`, lignes 12 et 33-42) migrent dans `route_paths.dart` |
| `apps/mobile/lib/features/campagnes/presentation/campagnes_screen.dart` (369 l.) | **SUPPRIMER le fichier** | Aucun |
| `apps/mobile/lib/features/campagnes/presentation/campagne_file_screen.dart` (432 l.) | **SUPPRIMER le fichier** | Aucun |
| `apps/mobile/lib/features/campagnes/` | **SUPPRIMER le dossier** | — |
| `apps/mobile/lib/features/phase2/presentation/phase2_screen.dart` (2073 l.) | **GARDER**, une seule retouche de commentaire (l. 37-39 : « quand on vient d'une file de campagne ») | — |
| `apps/mobile/lib/features/phase2/phase2_controller.dart` (337 l.) | **GARDER** intégralement | — |
| `apps/mobile/lib/features/phase2/presentation/callback_picker.dart` (394 l.) | **GARDER** | — |
| `apps/mobile/lib/features/phase2/presentation/call_audio_recorder.dart` (447 l.) | **GARDER** | — |
| `apps/mobile/lib/features/representant/presentation/representant_picker_screen.dart` (216 l.) | **GARDER tel quel** | C'est déjà l'annuaire cherchable, avec le mode `pourQualifier` (l. 24-26, 185-189) |
| `apps/mobile/lib/features/representant/presentation/representant_qualification_screen.dart` (631 l.) | **GARDER**, ne pas toucher (autre agent) | — |
| `apps/mobile/lib/features/representant/presentation/representant_detail_screen.dart` | **GARDER** | — |
| `apps/mobile/lib/features/representant/presentation/representant_form_screen.dart` | **GARDER** | — |
| `apps/mobile/lib/features/prospect/presentation/prospect_entry_screen.dart` (964 l.) | **GARDER** | Geste n° 2 |
| `apps/mobile/lib/features/prospect/presentation/prospect_detail_screen.dart` | **RÉÉCRIRE** l. 26 (import `campagnes.dart`) et l. 130 (`CampagnesRoutes.grandPublicConsole`) | `Routes.grandPublicConsole` |
| `apps/mobile/lib/features/prospect/presentation/prospect_picker_screen.dart` | **CRÉER** | Liste de prospects cherchable, geste n° 3 |
| `apps/mobile/lib/features/home/presentation/home_screen.dart` (423 l.) | **RÉÉCRIRE** l. 12, 56-105, 107-157 | Trois cartes de gestes, sans compteur de file |
| `apps/mobile/lib/features/shell/grand_public_screen.dart` (276 l.) | **RÉÉCRIRE** l. 12, 28-60, 90-97, et supprimer `_GrandeCarte` l. 134-208 | Trois cartes `_Carte` |
| `apps/mobile/lib/features/shell/hub_screen.dart` (275 l.) | **GARDER** | Ne connaît pas les campagnes |
| `apps/mobile/lib/features/shell/app_shell.dart` (289 l.) | **GARDER** | Badge « À corriger » (l. 106-113) déjà branché sur `needsAttentionCountProvider`, pas sur les tâches |
| `apps/mobile/lib/features/shell/grand_public_fiches_screen.dart` (203 l.) | **RÉÉCRIRE** l. 200-201 (copie périmée) ; **réutiliser** `ProspectTile` (l. 113-185) | — |
| `apps/mobile/lib/features/shell/projects.dart` | **RÉÉCRIRE** le commentaire l. 89 qui cite « campagnes » | — |
| `apps/mobile/lib/features/historique/presentation/historique_screen.dart` (258 l.) | **GARDER** | Voir §8, question ouverte 1 |
| `apps/mobile/lib/features/corrections/presentation/corrections_screen.dart` (545 l.) | **GARDER** | Aucune référence à une campagne |
| `apps/mobile/lib/features/rappels/**` | **GARDER**, ne pas toucher (autre agent) | — |
| `apps/mobile/lib/features/notifications/**` | **GARDER** | Voir §2.5 |
| `apps/mobile/lib/features/accueil/**` | **GARDER** | Le projet Accueil ignore les campagnes |

Routeur :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/app_router.dart`

| Ligne(s) | Objet | Verdict |
| --- | --- | --- |
| 19-21 | Trois `import` de `features/campagnes/` | SUPPRIMER |
| 226-235 | `GoRoute` `grandPublicCampagnes` (`/grand-public/campagnes`) | SUPPRIMER |
| 236-247 | `GoRoute` `grandPublicCampagneFile` (`/grand-public/campagnes/:id`) | SUPPRIMER |
| 264-274 | `GoRoute` `grandPublicConsole` (`/grand-public/console`) | **GARDER**, remplacer `CampagnesRoutes.grandPublicConsole` par `Routes.grandPublicConsole` |
| 406-417 | `GoRoute` `campagnes` (`/campagnes`) | SUPPRIMER |
| 418-428 | `GoRoute` `repCampagneFile` (`/campagnes/representants/:id`) | SUPPRIMER |
| 429-438 | `GoRoute` `campagneFile` (`/campagnes/:id`) | SUPPRIMER |
| après 386 | Nouvelle `GoRoute` `prospects` (`/prospects`) | **AJOUTER** — voir §3.4 pour l'ordre |
| 329-340 | `GoRoute` `representants` avec `?but=qualifier` | **GARDER** |
| 376-386 | `GoRoute` `newProspect` (`/prospects/nouveau`) | **GARDER** |
| 389-395 | `GoRoute` `prospectDetail` (`/prospects/:id`) | **GARDER** |

Chemins :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/route_paths.dart`

| Ligne(s) | Objet | Verdict |
| --- | --- | --- |
| 40 | `static const String prospects = '/prospects';` | **GARDER** — la constante existe mais **aucune `GoRoute` ne la sert aujourd'hui** ; elle n'est citée que par `route_memory.dart:28` |
| 46 | `static const String phase2 = '/phase2';` | **GARDER** |
| 63-72 | `butParam`, `butQualifier`, `representantsPourQualifier()` | **GARDER** |
| après 32 | `grandPublicConsole` | **AJOUTER** (valeur `'/grand-public/console'`, reprise de `campagnes.dart:14`) |
| après 111 | `appelPour(String phoneE164)` et `appelGrandPublicPour(String phoneE164)` | **AJOUTER** (repris de `campagnes.dart:33-42`) |

Mémoire de route :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/route_memory.dart`

| Ligne(s) | Objet | Verdict |
| --- | --- | --- |
| 6 | `import '../../features/campagnes/campagnes.dart';` | SUPPRIMER |
| 32 | `CampagnesRoutes.liste,` dans `allowList` | SUPPRIMER |
| 28 | `Routes.prospects,` dans `allowList` | **GARDER** — devient enfin une vraie route |
| 18-34 | Reste de `allowList` | **GARDER** |

Une adresse `/campagnes...` mémorisée par une session précédente **ne casse
pas** : `RouteMemory.isRestorable` (l. 151-160) la rejette dès qu'elle quitte
`allowList`, et `write` (l. 95-98) efface alors la mémoire. Aucune migration de
`SharedPreferences` n'est nécessaire.

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/route_guard.dart`
: **GARDER**. Il raisonne sur `CpiProject.duChemin` (`projects.dart:91-101`) qui
range tout ce qui n'est ni `/accueil` ni `/grand-public` dans le CHUES — la
suppression de `/campagnes` ne change rien.

### 2.4 Providers et état

| Emplacement | Objet | Verdict |
| --- | --- | --- |
| `campagnes.dart:45-50` | `repCampagnesProvider` | SUPPRIMER (avec le fichier) |
| `campagnes.dart:52-53` | `grandPublicCampagnesProvider` | SUPPRIMER |
| `campagnes.dart:57-58` | `chuesCampagnesProvider` | SUPPRIMER |
| `campagnes.dart:63-94` | `_campagnesDuProjet` (SQL `call_campaigns` JOIN `call_tasks`) | SUPPRIMER |
| `campagnes.dart:98-106` | `campagneProvider` | SUPPRIMER |
| `campagnes.dart:108-116` | `repCampagneProvider` | SUPPRIMER |
| `campagnes.dart:118-127` | `fileDeCampagneProvider` | SUPPRIMER |
| `campagnes.dart:129-138` | `repFileDeCampagneProvider` | SUPPRIMER |
| `campagnes.dart:140-174` | `grandPublicFileDeCampagneProvider` | SUPPRIMER |
| `app_providers.dart` (615 l., entier) | **aucun** provider de campagne ou de tâche | **GARDER intégralement** |
| `app_providers.dart:29-45` (dans `home_screen.dart`) — `representantsSansProspectProvider` | Compte les représentants AMBASSADEUR sans prospect. **Ne dépend d'aucune tâche.** | **GARDER** |
| `app_providers.dart:132-136` `representantCountProvider` | | **GARDER**, réemployé §3.4 |
| `app_providers.dart:138-142` `prospectCountProvider` | | **GARDER**, réemployé §3.4 |
| `app_providers.dart:144-149` `grandPublicProspectCountProvider` | | **GARDER** |
| `app_providers.dart:223-235` `needsAttentionCountProvider` / `needsAttentionProvider` | Badge « À corriger » | **GARDER** |
| `app_providers.dart:408-453` `grandPublicRappelsProvider` | Rappels de conversion, lus sur `call_attempts.callback_at` | **GARDER** |
| `app_providers.dart:459-485` `representantRappelsProvider` | Rappels de qualification, lus sur `rep_callback_reminders` | **GARDER** |
| `app_providers.dart:516-544` `phase2DirectoryCountProvider`, `phase2ProgressProvider`, `phase2PendingCountProvider` | Annuaire de conversion et progression **personnelle** (jamais une campagne) | **GARDER** |
| `app_providers.dart:304-326` `representantPickerSearchProvider` / `representantPickerListProvider` | Recherche de l'annuaire | **GARDER**, c'est la brique du geste n° 1 |
| `app_providers.dart:292-302` `grandPublicProspectListProvider` | Prospects Grand Public cherchables | **GARDER** |
| `app_providers.dart:275-283` `historiqueSearchProvider` | | **GARDER** |
| `core/providers/sync_coordinator.dart` (entier) | Aucune référence à une campagne ou une tâche | **GARDER** |
| `features/shell/app_shell.dart:61-62` badge du pied | Lit `needsAttentionCountProvider` | **GARDER** |

**À créer** : un provider de recherche + une liste de prospects CHUES, jumeaux
exacts de `representantPickerSearchProvider` / `representantPickerListProvider`
(`app_providers.dart:304-326`) — voir §3.4.

### 2.5 Notifications

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/notifications/rep_callback_notifications.dart`
(254 l.)

Vérifié par `grep -rn "campagne\|campaign\|task\|TASK" lib/features/notifications/ lib/core/push/`
: **aucune** occurrence en dehors d'une variable locale nommée `task` dans
`lib/features/notifications/notification_inbox.dart:69-74` (un `Future`, sans
rapport).

Les alarmes sont donc **entièrement** rattachées à une **tentative d'appel** :
`RepCallbackNotifications.schedule` (l. 112-147) prend un `id` de rappel et un
`representantId`, et sa charge utile est `'$id|$representantId'` (l. 123). La
source est la table `rep_callback_reminders`, écrite par
`write_repository.dart:932-945` au moment où le téléconseiller promet un rappel
pendant l'appel.

**Verdict : GARDER intégralement.** Aucun rappel n'est lié à une tâche ni à une
campagne. Ne modifier aucun fichier de `lib/core/notifications/` ni
`lib/features/notifications/` : un autre agent y travaille en ce moment.

### 2.6 Client API engendré

Dossier : `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/api-client-dart`

**Jamais édité à la main** : chaque fichier porte
`// AUTO-GENERATED FILE, DO NOT MODIFY!`. Il est produit depuis
`apps/api/openapi.json` par `pnpm codegen` (voir `package.json:33`), lui-même
appuyé sur `tools/dev/generate-dart-client.mjs` (`package.json:32`).

DTO qui disparaîtront **si et seulement si** le plan API les retire du contrat :

| Fichier | Rôle |
| --- | --- |
| `lib/src/model/sync_call_campaign_dto.dart` | campagne de prospects, flux `callCampaigns` |
| `lib/src/model/sync_call_task_dto.dart` | tâche de prospect, flux `callTasks` |
| `lib/src/model/sync_rep_call_campaign_dto.dart` | campagne de représentants |
| `lib/src/model/sync_rep_call_task_dto.dart` | tâche de représentant |
| `lib/src/model/call_task_status.dart` | énumération `OPEN`/`DONE` |
| `lib/src/model/campaign_status.dart` | énumération `ACTIVE`/… |

Champs concernés de `lib/src/model/sync_changes_dto.dart` : `callCampaigns`
(l. 87-88), `callTasks` (l. 90-91), `repCallCampaigns` (l. 93-94), `repCallTasks`
(l. 96-97). Ils sont déclarés `required: true`, et le désérialiseur engendré
(`lib/src/model/sync_changes_dto.g.dart:212-229`) les inscrit dans
`$checkKeys(requiredKeys: [...])`. **Voir §6 : c'est le point de rupture.**

Ne **pas** supprimer les DTO purement web (`campaign_detail_dto.dart`,
`campaign_pilotage_dto.dart`, `rep_campaign_summary_dto.dart`, …) sans le plan
API : le mobile ne les importe pas, mais `apps/web` peut en dépendre par le
client TypeScript.

Ce que le mobile **importe** de ce paquet et qui doit rester :
`CreateRepCallAttemptDto` (`lib/src/model/create_rep_call_attempt_dto.dart`,
14 champs, aucun `taskId`), `RepCallAttemptResultDto`, `RepCallOutcome`,
`SyncOperationDto`, `SyncPullResponseDto`, `SyncPushDto`, `DirectoryEntryDto`,
`CallOutcomeReasonDto`.

### 2.7 Tests

| Fichier | Ligne(s) | Verdict |
| --- | --- | --- |
| `apps/mobile/test/features/campagnes_test.dart` (676 l.) | tout | **SUPPRIMER le fichier** |
| `apps/mobile/test/support/db_fixture.dart` | 172-193 `insertCampagne` | SUPPRIMER |
| `apps/mobile/test/support/db_fixture.dart` | 195-217 `insertTache` | SUPPRIMER |
| `apps/mobile/test/support/fake_api.dart` | 486-489 (les quatre listes vides) | SUPPRIMER après régénération |
| `apps/mobile/test/core/sync_engine_test.dart` | 1782-1785, 1825-1828, 1882-1885, 1924-1927, 1961-1964 (arguments `SyncChangesDto`) | SUPPRIMER après régénération |
| `apps/mobile/test/core/sync_engine_test.dart` | **1978-2036** test « la file d'une campagne atterrit telle que le serveur l'a répartie » | **SUPPRIMER le test** |
| `apps/mobile/test/core/sync_generations_test.dart` | **301-385** : le bandeau de commentaire (301-303) puis le groupe « files d'appels : ce qui n'est plus confié quitte le programme » (305-385, deux tests l. 306 et 343) | **SUPPRIMER le groupe** |
| `apps/mobile/test/core/sync_generations_test.dart` | 459-473 aide `tacheDto`, 475-489 aide `tacheRepDto` (leurs seuls appels sont dans le groupe supprimé) | SUPPRIMER |
| `apps/mobile/test/core/sync_generations_test.dart` | 514-517 | SUPPRIMER après régénération |
| `apps/mobile/test/core/sync_ownership_test.dart` | 891-894, 1498-1501, 1522-1525 | SUPPRIMER après régénération |
| `apps/mobile/test/core/sync_reconciliation_test.dart` | 974-977 | SUPPRIMER après régénération |
| `apps/mobile/test/core/sync_visite_referentiels_test.dart` | 229-232 | SUPPRIMER après régénération |
| `apps/mobile/test/data/database_test.dart` | **524-572** : test « la file représentants garde seulement les tâches ouvertes dans l'ordre » | **SUPPRIMER le test** |
| `apps/mobile/test/data/write_repository_test.dart` | 709 titre « …et ferme sa tâche » ; 712-731 insertion campagne + tâche ; 746 `expect(… repCallTasks …, 'DONE')` | **RÉÉCRIRE** : nouveau titre `'qualifier un représentant met à jour la fiche'`, supprimer 712-731 et 746, **garder** 741-745 et 747-749 |
| `apps/mobile/test/data/write_repository_test.dart` | 771, 811, 828 (`repCallbackReminders`) | **GARDER** |
| `apps/mobile/test/data/migration_test.dart` | **1398-1480** « v11 -> v12 ajoute les campagnes sans toucher à la saisie du terrain » (bandeau de commentaire 1398-1404 compris) | **SUPPRIMER le bloc** |
| `apps/mobile/test/data/migration_test.dart` | **1776-1815** « v16 -> v17 ajoute les campagnes représentants sans toucher à la file » | **SUPPRIMER le bloc** |
| `apps/mobile/test/data/migration_test.dart` | 22 `import 'generated_migrations/schema_v16.dart' as v16;` — son seul usage est l. 1780, dans le test v16 → v17 supprimé | SUPPRIMER. L'alias `v11` (l. 18, usage unique l. 1409) est **réutilisé** par le nouveau test v11 → courant : le garder. Il n'y a **pas** d'import `schema_v12` ni `schema_v17` dans ce fichier. Ajouter `import 'generated_migrations/schema_v19.dart' as v19;` |
| `apps/mobile/test/data/migration_test.dart` | 63-73 « le golden couvre toutes les versions déclarées » | **GARDER**, il rougira tant que le dump v20 n'existe pas |
| `apps/mobile/test/data/migration_test.dart` | fin de fichier | **AJOUTER** un test v19 → v20 |
| `apps/mobile/test/features/home_test.dart` (424 l.) | import l. 10 ; aide `seedFileRepresentants` l. 43-69 ; routes factices `/campagnes*` l. 89-110 ; les cinq tests l. 154, 221, 239, 264, 331 | **RÉÉCRIRE**. Restent réemployables : l'aide `mount` (l. 71-152), les tests l. 317 (« l'étape 2 mène au choix du représentant »), 344 (« un chiffre illisible affiche « – » ») et 365/387 (le pied) |
| `apps/mobile/test/features/text_scale_overflow_test.dart` (1028 l.) | 13-14 imports campagnes | SUPPRIMER |
| `apps/mobile/test/features/text_scale_overflow_test.dart` | **187-211** : commentaire 187-189, `insertCampagne('campFiche')` 190-195, `insertProspect('proCampagne')` 196-203, `insertTache('tacheCampagne')` 204-211. Les trois identifiants ne servent qu'ici et l. 506 | SUPPRIMER |
| `apps/mobile/test/features/text_scale_overflow_test.dart` | 502-506 entrées « Campagnes » et « File de campagne » du balayage | SUPPRIMER |
| `apps/mobile/test/features/text_scale_overflow_test.dart` | après 435 | **AJOUTER** l'entrée « Choisir un prospect » |
| `apps/mobile/test/features/text_scale_overflow_test.dart` | 174-185 fixture `repCallbackReminders` | **GARDER** |
| `apps/mobile/test/features/phase2_screen_test.dart` (1293 l.) | — | **GARDER** : aucune occurrence de campagne (`grep` vide) |
| `apps/mobile/test/features/accessibilite_ecrans_test.dart` (691 l.) | — | **GARDER** : aucune occurrence de campagne |
| `apps/mobile/test/core/theme_tokens_test.dart` (264 l.) | 226 « aucune taille d'icône n'est écrite en dur dans `lib/` » | **GARDER** — il balaye `lib/`, tout nouvel écran doit passer par `CpiIconSize` |
| `apps/mobile/test/core/router_test.dart`, `router_landing_test.dart`, `features/hub_test.dart`, `features/shells_test.dart` | — | **GARDER** : aucune occurrence de campagne |
| `apps/mobile/test/data/generated_migrations/schema_v12.dart` … `schema_v19.dart` | — | **GARDER intacts** : ce sont des photographies de formes passées |

### 2.8 Copie (libellés affichés)

Chaque libellé qui parle de liste, de file, de tâche, de campagne, de
« à appeler » ou de « prochain », avec son remplacement en français simple.

| Emplacement | Texte actuel | Remplacement |
| --- | --- | --- |
| `home_screen.dart:126` | `Appelez chaque représentant et notez sa réponse.` | `Cherchez la personne, appelez, notez sa réponse.` |
| `home_screen.dart:128-129` | `représentant à appeler` / `représentants à appeler` | Retirer le compteur. Sous-titre : `N dans l'annuaire` (via `representantCountProvider`) |
| `home_screen.dart:135` | `Notez les collègues que vos représentants vous donnent.` | Inchangé |
| `home_screen.dart:137-139` | `représentant sans prospect` / `représentants sans prospect` | Inchangé (`representantsSansProspectProvider` survit) |
| `home_screen.dart:145` | `Appelez les prospects pour obtenir leur adhésion.` | `Cherchez le prospect, appelez, notez ce qu'il a dit.` |
| `home_screen.dart:147-148` | `prospect à appeler` / `prospects à appeler` | Retirer le compteur. Sous-titre : `N fiches` (via `prospectCountProvider`) |
| `home_screen.dart:113` | `Les chiffres n'ont pas pu être lus.` | Inchangé |
| `home_screen.dart:124` | Titre `Qualifier les représentants` | `Consigner un appel représentant` |
| `home_screen.dart:144` | Titre `Convertir les prospects` | `Consigner un appel de conversion` |
| `home_screen.dart:315` | `Après l'appel, notez ce qui a été dit.` | Ligne « Consigner un appel » du bloc `_Raccourcis` : à **retirer**, elle fait doublon avec la carte 3 |
| `home_screen.dart:394` | `Que voulez-vous faire ?` | Inchangé, mais la feuille reçoit une **troisième** entrée (« Consigner un appel de conversion ») |
| `grand_public_screen.dart:93` | `Appels du jour` | `Consigner un appel` |
| `grand_public_screen.dart:95` | `Rien à appeler aujourd'hui.` | Supprimé avec `_GrandeCarte` |
| `grand_public_screen.dart:197` | `À appeler` | Supprimé avec `_GrandeCarte` |
| `grand_public_screen.dart:21-22` (doc) | `appeler la file du jour, tenir les rappels promis` | `consigner les appels, tenir les rappels promis` |
| `grand_public_screen.dart:111` | `Aucun rappel prévu` | Inchangé |
| `grand_public_screen.dart:112` | `Prochain ${_quand(...)}` | **Garder** : « prochain rappel », pas « prochain contact ». Le mot vise une promesse tenue par le téléconseiller, pas une file assignée |
| `grand_public_fiches_screen.dart:200-201` | `Les prospects arrivent du bureau. Touchez « Recevoir les listes » dans Réglages.` | `Les prospects arrivent du bureau. Touchez « Envoyer maintenant » dans Réglages.` — le contrôle réel s'appelle ainsi (`reglages_screen.dart:170`) |
| `campagne_file_screen.dart:107` | `Appeler le suivant` | Supprimé avec le fichier |
| `campagne_file_screen.dart:156` | `La file de cette campagne n'a pas pu être lue.` | Supprimé |
| `campagnes_screen.dart:84` | Titre `Appels` | Supprimé |
| `campagnes_screen.dart:88` | `Hors ligne. Liste du dernier téléchargement.` | Supprimé |
| `campagnes_screen.dart:188` | `Lecture des campagnes impossible.` | Supprimé |
| `phase2_screen.dart:37-39` (doc) | `quand on vient d'une file de campagne` | `quand on arrive depuis une fiche déjà ouverte` |
| `projects.dart:89` (doc) | `(représentants, prospects, campagnes, phase 2)` | `(représentants, prospects, appels)` |
| `sync_engine.dart:1975-1977` (doc) | `Les campagnes puis les files.` | Supprimé avec le bloc |
| `schema.drift:803-808` (doc) | `Le tirage se fait sur le serveur…` | Supprimé |
| `schema.drift:924-926` (doc) | `Le tirage descend le registre comme call_campaigns/call_tasks` | **RÉÉCRIRE** : la comparaison désigne des tables qui n'existent plus. Nouveau texte : `Le serveur est seul à écrire cette table : un pull rejoué recopie la même ligne, updated_at seul arbitre.` |
| `campagne_file_screen.dart:24-26` (doc) | `dans l'ordre EXACT du programme papier` | Supprimé |

Mots à **ne plus jamais** écrire dans une chaîne affichée par le mobile :
« campagne », « file », « tâche », « à appeler », « programme », « tirage ».

---

## 3. État cible

### 3.1 Base locale

`schema.drift` perd quatre tables, six index et quatre requêtes nommées. Il
garde `call_attempts`, `phase2_directory`, `rep_callback_reminders`,
`representants`, `prospects`, `prospect_journeys`, `representant_comments`,
`visites`, `outbox`, `form_drafts`, `sync_state`, les référentiels et les deux
vues `representant_sync_view` / `prospect_sync_view`.

`schemaVersion` passe de 19 à **20**. Le palier 20 est un `DROP TABLE IF
EXISTS` des quatre tables, plus aucun. Les paliers 12 et 17 disparaissent parce
que leur code ne compile plus.

### 3.2 Synchronisation

Le mobile **cesse de lire** `changes.callCampaigns`, `changes.callTasks`,
`changes.repCallCampaigns`, `changes.repCallTasks`. Il continue de lire
`departements`, `iefs`, `banques`, `syndicats`, `canauxProvenance`,
`visiteReferentiels`, `representants`, `prospects`, `visites`, et `deletions`.

La poussée est **inchangée** : `call_attempt` (conversion) et
`rep_call_attempt` (qualification) partent comme aujourd'hui, sans `taskId`.

`payloadVersion` reste à **4** côté mobile
(`sync_engine.dart:59`) tant que le plan API n'exige pas le contraire, parce
que le serveur refuse en `426 APP_UPDATE_REQUIRED` toute valeur inférieure à
`MIN_PULL_PAYLOAD_VERSION` (`apps/api/src/modules/sync/sync.controller.ts:29`,
valeur `4`). Le passage éventuel à 5 est traité en §5 et §6.

### 3.3 Navigation cible

Routes **supprimées** : `/campagnes`, `/campagnes/:id`,
`/campagnes/representants/:id`, `/grand-public/campagnes`,
`/grand-public/campagnes/:id`.

Routes **conservées** : `/`, `/login`, `/chues`, `/historique`, `/a-corriger`,
`/reglages`, `/reglages/autorisations`, `/reglages/a-propos`, `/notifications`,
`/rappels`, `/representants`, `/representants/nouveau`, `/representants/:id`,
`/representants/:id/qualifier`, `/prospects/nouveau`, `/prospects/:id`,
`/phase2`, `/grand-public`, `/grand-public/nouveau`, `/grand-public/fiches`,
`/grand-public/rappels`, `/grand-public/console`, `/grand-public/a-corriger`,
`/grand-public/reglages`, `/accueil`, `/accueil/chiffres`,
`/accueil/nouvelle-visite`, `/accueil/a-corriger`, `/accueil/reglages`.

Route **ajoutée** : `/prospects` — le sélecteur de prospects cherchable.

### 3.4 Écrans cibles

**Accueil CHUES (`HomeScreen`, `/chues`).** Trois cartes de gestes, plus les
raccourcis et le graphique d'activité. Aucun compteur de file.

| Rang | Titre | Phrase | Chiffre | Destination |
| --- | --- | --- | --- | --- |
| 1 | `Consigner un appel représentant` | `Cherchez la personne, appelez, notez sa réponse.` | `representantCountProvider`, libellé `dans l'annuaire` | `Routes.representantsPourQualifier()` = `/representants?but=qualifier` |
| 2 | `Ajouter un prospect` | `Notez les collègues que vos représentants vous donnent.` | `representantsSansProspectProvider`, libellé `représentant(s) sans prospect` | `Routes.representants` |
| 3 | `Consigner un appel de conversion` | `Cherchez le prospect, appelez, notez ce qu'il a dit.` | `prospectCountProvider`, libellé `fiche(s)` | `Routes.prospects` (nouveau sélecteur) |

Le widget `_EtapeCard` (`home_screen.dart:204-300`) se réemploie **tel quel** :
il prend déjà un `AsyncValue<int>` et affiche `…` / `–` / le nombre. Le
paramètre `rang` n'est plus une phase mais un ordre de lecture : garder
`CpiTag('$rang')` (l. 247).

La feuille « Que voulez-vous faire ? » (`home_screen.dart:389-423`) reçoit une
**troisième** ligne, « Consigner un appel de conversion » →
`Routes.prospects`. Le bloc `_Raccourcis` (l. 304-345) perd sa ligne
« Consigner un appel » (l. 313-320) devenue doublon et garde « Rappels » et
« Annonces ».

**Accueil Grand Public (`GrandPublicScreen`, `/grand-public`).** Trois cartes
`_Carte` de même forme (`grand_public_screen.dart:211-276`, réemployé) :

| Titre | Détail | Chiffre | Destination |
| --- | --- | --- | --- |
| `Consigner un appel` | `Après l'appel, notez ce qui a été dit.` | aucun (`nombre: null`) | `Routes.grandPublicConsole` |
| `Prospects` | `Retrouver une fiche` | `grandPublicProspectCountProvider` | `Routes.grandPublicFiches` |
| `Rappels` | `Aucun rappel prévu` ou `Prochain <date> à <heure>` | `grandPublicRappelsProvider.length` | `Routes.grandPublicRappels` |

La classe `_GrandeCarte` (`grand_public_screen.dart:134-208`) devient
inutilisée : **supprimer la classe entière**.

**Nouveau : sélecteur de prospects** —
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/prospect/presentation/prospect_picker_screen.dart`

Copie structurelle de `representant_picker_screen.dart` (216 l.), qui est le
patron validé du dépôt :

- `CpiScaffold(title: 'Quel prospect ?', subtitle: 'Cherchez son nom ou son numéro.', leading: CpiBackButton())`
- `CpiSearchField` branché sur un nouveau `prospectPickerSearchProvider`
- `ListView.builder` de `CpiListEntrance` enveloppant **`ProspectTile`**, déjà
  écrit et exporté par
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/shell/grand_public_fiches_screen.dart:113-185`.
  **Ne pas réécrire une tuile.** Il faut seulement lui passer une destination :
  aujourd'hui elle pousse en dur `Routes.prospectDetailFor` (l. 129) ; ajouter
  un paramètre optionnel `onTap` (défaut : le comportement actuel) est la
  modification minimale.
- Tap d'une ligne → `context.pushOnce(Routes.appelPour(prospect.phoneE164))`,
  c'est-à-dire `/phase2?tel=+221…`. `Phase2Screen.prefillPhone`
  (`phase2_screen.dart:35-40, 88-93`) sait déjà recevoir un E.164 et le
  convertir pour le champ.
- États : chargement (`FCircularProgress`), erreur (`CpiErrorState` +
  `messageErreur`), vide sans recherche (`CpiEmptyState`, titre
  `Aucun prospect`, message `Ils arrivent du bureau.`), vide en recherche
  (titre `Aucun résultat`, message `Vérifiez le nom ou le numéro.`).
- Compteur en tête, comme `_Compteur` de `representant_picker_screen.dart:129-149`.

Nouveaux providers, à poser dans
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/providers/app_providers.dart`,
juste après `representantPickerListProvider` (l. 326), calqués sur
`app_providers.dart:304-326` :

```
prospectPickerSearchProvider  : NotifierProvider<ProspectPickerSearch, String>
prospectPickerListProvider    : StreamProvider<List<ProspectSyncViewData>>
    → referenceRepositoryProvider.watchAllProspects(
          search: ref.watch(prospectPickerSearchProvider), projet: 'CHUES')
```

`watchAllProspects` existe déjà
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/repositories/reference_repository.dart:236-264`),
filtre par parcours (`prospect_journeys`), cherche sur nom, prénom et téléphone,
et borne à 500 lignes. **Aucune requête SQL nouvelle à écrire.**

Un provider **distinct** de `historiqueSearchProvider` est nécessaire : ce
dernier est partagé par `HistoriqueScreen` et `GrandPublicFichesScreen`, et le
réutiliser ferait sauter la recherche d'un écran à l'autre.

**Ordre des routes.** `go_router` essaie les routes dans l'ordre de
déclaration. `/prospects` (exact) ne peut pas être avalé par `/prospects/:id`,
mais l'ordre du fichier veut que les chemins exacts précèdent les paramétrés
(commentaires `app_router.dart:354-355` et `387-388`). Poser la nouvelle
`GoRoute` **avant** `Routes.newProspect` (l. 376), donc autour de la ligne 375,
enveloppée dans `_chues(...)` comme ses voisines.

### 3.5 Hub

`HubScreen`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/shell/hub_screen.dart`)
reste **strictement identique** : trois tuiles de projet filtrées par rôle
(l. 25-27), un en-tête de marque, un bouton de déconnexion. Il ne lit aucun
compteur.

Les libellés de `_marqueDe` (l. 150-166) : `CHUES → 'Appeler, qualifier,
enrôler'` reste juste. `Grand Public → 'Prospects et appels du jour'` cite
« du jour », vestige de la file : le remplacer par `'Prospects et appels'`.

La barre du bas (`AppShell`, `app_shell.dart:99-120`) garde ses quatre
destinations et son unique badge, celui de « À corriger », alimenté par
`needsAttentionCountProvider`. Aucun badge n'était alimenté par une tâche.

---

## 4. Étapes ordonnées et exécutables

Toutes les commandes s'exécutent depuis
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile`, sauf mention
contraire. Sur cette machine, Flutter est piloté par FVM
(`apps/mobile/.fvmrc`) : si `flutter` n'est pas la 3.41.7, préfixer par
`fvm `.

**Rouge avant vert.** À chaque étape, la commande de vérification est donnée
avec l'échec attendu **avant** la correction. Une étape dont la vérification
passe du premier coup sans être passée par le rouge n'a rien prouvé.

---

### Étape 0 — Point de départ vert

```
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test
```

Attendu : `flutter analyze` → `No issues found.` ; `flutter test` → tout vert.
Si ce n'est pas le cas **avant** toute modification, s'arrêter et le signaler :
la branche porte du travail non commité d'autres agents.

---

### Étape 1 — Retirer les écrans et les providers de campagne

1. Supprimer le dossier
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/campagnes/`
   en entier (trois fichiers : `campagnes.dart`,
   `presentation/campagnes_screen.dart`,
   `presentation/campagne_file_screen.dart`).

2. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/route_paths.dart` :
   - Après la ligne 32 (`grandPublicReglages`), ajouter :
     `static const String grandPublicConsole = '/grand-public/console';`
   - Après la ligne 111 (`prefillPhoneParam`), ajouter les deux constructeurs
     d'URL repris de l'ancien `campagnes.dart:33-42` :
     `appelPour(String phoneE164)` → `Uri(path: phase2, queryParameters: {prefillPhoneParam: phoneE164}).toString()`
     et `appelGrandPublicPour(String phoneE164)` → même chose avec
     `grandPublicConsole`.

3. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/app_router.dart` :
   - supprimer les imports l. 19-21 ;
   - supprimer les `GoRoute` l. 226-247 et l. 406-438 ;
   - remplacer `CampagnesRoutes.grandPublicConsole` (l. 265) par
     `Routes.grandPublicConsole` ;
   - ajouter la `GoRoute` `/prospects` avant `Routes.newProspect` (voir §3.4) —
     elle échouera à compiler jusqu'à l'étape 3, c'est normal.

4. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/route_memory.dart` :
   supprimer l'import l. 6 et l'entrée `CampagnesRoutes.liste` l. 32.

5. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/prospect/presentation/prospect_detail_screen.dart` :
   supprimer l'import l. 26, remplacer `CampagnesRoutes.grandPublicConsole`
   l. 130 par `Routes.grandPublicConsole`.

**Vérification (rouge attendu, puis vert après l'étape 3)**

```
flutter analyze
```

Rouge attendu : erreurs `Target of URI doesn't exist` et
`Undefined name 'CampagnesRoutes'` dans `home_screen.dart` et
`grand_public_screen.dart`, plus `Undefined name 'ProspectPickerScreen'` dans
`app_router.dart`. Ce sont exactement les points des étapes 2 et 3.

---

### Étape 2 — Réécrire les deux accueils

1.
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/home/presentation/home_screen.dart` :
   - supprimer l'import l. 12 ;
   - supprimer les lectures de providers l. 56-61 et les dérivations l. 70-86 ;
   - remplacer le calcul `chiffresIllisibles` (l. 67-68) par la seule erreur
     encore possible : `sansProspect.hasError` ;
   - remplacer `ouvrirQualification` / `ouvrirConversion` (l. 91-105) par deux
     `context.pushOnce(...)` directs vers
     `Routes.representantsPourQualifier()` et `Routes.prospects` ;
   - réécrire les trois `_EtapeCard` (l. 123-150) selon le tableau §3.4 ;
   - corriger les `ref.invalidate` l. 117-119 ;
   - retirer la ligne « Consigner un appel » de `_Raccourcis` (l. 313-320) ;
   - ajouter la troisième entrée à `_choisirLeGeste` (l. 393-416) et adapter sa
     signature (elle prend aujourd'hui un seul `onQualifier`, l. 389-392) ;
   - garder `_EtapeCard`, `_ActivityCard`, `_PrimaryAction`,
     `representantsSansProspectProvider`, `_bonjour`.

2.
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/shell/grand_public_screen.dart` :
   - supprimer l'import l. 12 ;
   - supprimer la lecture `grandPublicCampagnesProvider` (l. 28-30) et les
     dérivations l. 37-43 ;
   - supprimer la fonction `appeler` (l. 45-60) ;
   - remplacer la `_GrandeCarte` (l. 90-97) par une `_Carte` « Consigner un
     appel » (`nombre: null`, destination `Routes.grandPublicConsole`) ;
   - supprimer la classe `_GrandeCarte` (l. 134-208) ;
   - corriger la doc l. 21-22.

3.
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/shell/hub_screen.dart:159` :
   `'Prospects et appels du jour'` → `'Prospects et appels'`.

4.
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/shell/grand_public_fiches_screen.dart:200-201` :
   corriger la copie (§2.8).

5.
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/shell/projects.dart:89` et
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/phase2/presentation/phase2_screen.dart:37-39` :
   corriger les commentaires (§2.8).

**Vérification**

```
flutter analyze
```

Rouge résiduel attendu : uniquement `ProspectPickerScreen` et
`prospectPickerListProvider`, traités à l'étape 3.

---

### Étape 3 — Le sélecteur de prospects

1. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/providers/app_providers.dart`,
   après la ligne 326, ajouter `ProspectPickerSearch`,
   `prospectPickerSearchProvider` et `prospectPickerListProvider` (§3.4).

2. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/shell/grand_public_fiches_screen.dart`,
   ajouter à `ProspectTile` (l. 113-118) un paramètre nommé optionnel
   `VoidCallback? onTap`, et faire que `ouvrir()` (l. 127-130) l'appelle quand
   il est fourni. **Ne pas dupliquer la tuile.**

3. Créer
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/prospect/presentation/prospect_picker_screen.dart`
   selon §3.4. Contraintes : widgets `Cpi*` et ForUI uniquement, icônes
   Phosphor, tailles via `CpiIconSize`, espacements via `CpiSpacing`,
   commentaires rares.

4. Compléter l'import et la `GoRoute` `/prospects` ajoutée à l'étape 1 dans
   `app_router.dart`.

**Vérification (verte attendue)**

```
flutter analyze
dart format --output=none --set-exit-if-changed lib/
```

Attendu : `No issues found.` et aucun fichier reformaté.

**Preuve du rouge :** avant d'écrire l'écran, exécuter `flutter analyze` et
vérifier que l'erreur porte bien sur `ProspectPickerScreen`. Après, elle
disparaît.

---

### Étape 4 — La base locale et sa migration

1. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/local/schema.drift`,
   supprimer les lignes **803 à 899** incluses (du bandeau « Campagnes
   d'appels » jusqu'à la fin de `repCampaignsWithOpenWork`). Vérifier que la
   ligne suivante conservée est le commentaire de `rep_callback_reminders`
   (« Rappels promis pendant un appel représentant… », l. 901 avant coupe).

2. Dans le même fichier, réécrire le commentaire des visites (l. 924-926 avant
   coupe) qui cite `call_campaigns/call_tasks` (§2.8).

3. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/local/database.dart` :
   - l. 17 : `schemaVersion` → `20` ;
   - supprimer le bloc `if (from < 12 && to >= 12)` (l. 170-177) ;
   - supprimer le bloc `if (from < 17 && to >= 17)` (l. 215-220) ;
   - après le bloc v19 (l. 237), ajouter :

```
      if (from < 20 && to >= 20) {
        // Les quatre tables sont mortes avec l'assignation d'appels. Aucune
        // clé étrangère ne pointait dessus : rien d'autre à nettoyer.
        for (final String table in const <String>[
          'call_tasks',
          'call_campaigns',
          'rep_call_tasks',
          'rep_call_campaigns',
        ]) {
          await customStatement('DROP TABLE IF EXISTS $table');
        }
      }
```

**Vérification 1 — le code compile et le golden rougit**

```
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test test/data/migration_test.dart
```

Rouge **attendu** sur le test « le golden couvre toutes les versions
déclarées » (`test/data/migration_test.dart:63-73`), avec le motif
`schemaVersion a bougé sans nouveau dump`. C'est la preuve que le test fait son
travail.

**Vérification 2 — produire le dump v20 et sa copie Dart**

```
dart run drift_dev schema dump lib/data/local/database.dart drift_schemas/
dart run drift_dev schema generate drift_schemas/ test/data/generated_migrations/
```

Attendu : création de `drift_schemas/drift_schema_v20.json` et de
`test/data/generated_migrations/schema_v20.dart`, plus réécriture de
`test/data/generated_migrations/schema.dart` (l. 7-24 gagnent
`import 'schema_v20.dart' as v20;`). **Relire le diff engendré** : aucun
`schema_v1..v19.dart` ne doit changer. S'il en change un, l'outillage n'est pas
à la bonne version (drift/drift_dev doivent être ensemble dans
`>=2.33.0 <2.34.0`, `pubspec.yaml:31` et `pubspec.yaml:109`).

**Vérification 3 — la migration réelle**

Ajouter à la fin de
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/data/migration_test.dart`
un test v19 → v20 sur le patron des voisins. Point d'insertion exact : après
`});` ligne 1913, qui ferme le test « v18 -> v19 refuse un rendez-vous sans
prise de rendez-vous », et **avant** le `}` ligne 1914 qui ferme `main()`.
Contenu :

- `final schema = await verifier.schemaAt(19);`
- ouvrir `v19.DatabaseAtV19(schema.newConnection())`, insérer en **SQL brut**
  (les schémas engendrés n'ont pas de companions typés — voir le commentaire
  `migration_test.dart:41-47`) : une campagne dans `call_campaigns`, une tâche
  dans `call_tasks`, une tentative dans `call_attempts`, un rappel dans
  `rep_callback_reminders`, et une opération non partie dans `outbox` ;
- `await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);`
- attendre :
  - `SELECT name FROM sqlite_master WHERE name IN ('call_campaigns','call_tasks','rep_call_campaigns','rep_call_tasks')` → vide ;
  - `db.countMyAttempts().getSingle()` → 1 (la tentative a survécu) ;
  - `db.select(db.repCallbackReminders).get()` → 1 ligne (le rappel a survécu) ;
  - `SELECT id FROM outbox` → l'opération non partie est toujours là.

C'est la seule assertion qui compte : **une migration ratée sur un appareil de
terrain, c'est une journée de prospection perdue** (`migration_test.dart:26-31`).

Ajouter aussi un test partant de **v11** (avant l'existence des tables) jusqu'à
la version courante, pour prouver que la disparition des paliers 12 et 17 ne
casse pas le chemin long. Le fichier importe déjà `schema_v11.dart` (l. 18).

```
flutter test test/data/migration_test.dart
```

**Preuve du rouge :** avant d'écrire le palier v20, faire tourner le test v19 →
v20 et vérifier qu'il échoue parce que `call_campaigns` existe encore.

---

### Étape 5 — Le moteur de synchronisation et le dépôt d'écriture

1. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/sync/sync_engine.dart`,
   supprimer les lignes **1975 à 2057** incluses (les quatre boucles et leurs
   commentaires). La ligne suivante conservée est le commentaire
   « Le registre : aucune revision… » (l. 2059 avant coupe).

2. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/repositories/write_repository.dart`,
   supprimer le bloc `if (terminal.contains(outcome)) { … }` (l. 919-931) puis
   la déclaration `const Set<String> terminal` (l. 891-896). Vérifier par
   `grep -n "terminal" lib/data/repositories/write_repository.dart` qu'aucune
   autre référence ne subsiste.

**Vérification**

```
flutter analyze
flutter test test/core/sync_engine_test.dart test/data/write_repository_test.dart
```

Rouge attendu : le test « la file d'une campagne atterrit telle que le serveur
l'a répartie » (`test/core/sync_engine_test.dart:1978-2036`) et l'assertion
`expect((await db.select(db.repCallTasks).getSingle()).status, 'DONE')`
(`test/data/write_repository_test.dart:746`) échouent, ainsi que les
compilations qui citent `db.callTasks`. Traité à l'étape 6.

---

### Étape 6 — Les tests

1. Supprimer
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/features/campagnes_test.dart`.

2. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/support/db_fixture.dart` :
   supprimer `insertCampagne` (l. 172-193) et `insertTache` (l. 195-217).

3. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/core/sync_generations_test.dart` :
   supprimer les l. 301-385 (bandeau de commentaire compris) puis les deux
   aides devenues sans appel,
   `tacheDto` (l. 459-473) et `tacheRepDto` (l. 475-489).

4. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/core/sync_engine_test.dart` :
   supprimer le test l. 1978-2036.

5. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/data/database_test.dart` :
   supprimer le test l. 524-572, « la file représentants garde seulement les
   tâches ouvertes dans l'ordre ». Le groupe `compteurs` qui suit (l. 574)
   reste.

6. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/data/write_repository_test.dart` :
   renommer le test l. 709 en `'qualifier un représentant met à jour la fiche'`,
   supprimer l'insertion de campagne et de tâche (l. 712-731) et l'assertion
   l. 746 ; **garder** les assertions sur la fiche (l. 741-745), sur
   `op.entityType` (l. 747-748) et sur la charge utile (l. 749), ainsi que tout
   le bloc `repCallbackReminders` (l. 771, 811, 828).

7. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/data/migration_test.dart` :
   supprimer les blocs v11 → v12 (l. **1398-1480**, du bandeau de commentaire au `});` de fin) et
   v16 → v17 (l. **1776-1815**) ;
   supprimer l'import `schema_v16.dart` (l. 22), devenu sans usage ; garder
   l'import `schema_v11.dart` (l. 18), réutilisé par le nouveau test v11 →
   courant ; ajouter `import 'generated_migrations/schema_v19.dart' as v19;`.

8. Dans
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/features/text_scale_overflow_test.dart` :
   supprimer les imports l. 13-14, la fixture l. 187-211 et les entrées
   l. 502-506 ; ajouter après l. 435 l'entrée
   `'Choisir un prospect': ProspectPickerScreen.new,`.

9. Réécrire
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/features/home_test.dart`
   (424 l.). À supprimer : l'import l. 10, l'aide `seedFileRepresentants`
   (l. 43-69), les trois routes factices `/campagnes*` du routeur de test
   (l. 89-110, les trois `GoRoute` `repFile`, `file` et `liste`) et les cinq
   tests l. 154, 221, 239, 264, 331. La `GoRoute` `/representants` (l. 111-115,
   rend `PICKER`) reste et sert le nouveau test de la carte 2. À **garder** :
   l'aide `mount` (l. 71-152), et les tests l. 317, 344, 365 et 387, qui ne
   portent pas sur les files. Les nouveaux tests valent la peine d'exister
   s'ils prouvent :
   - les trois cartes portent les trois titres cibles ;
   - un tap sur la carte 1 pousse `/representants?but=qualifier` ;
   - un tap sur la carte 2 pousse `/representants` ;
   - un tap sur la carte 3 pousse `/prospects` ;
   - la carte 2 rend le nombre de représentants sans prospect
     (`representantsSansProspectProvider`), et `–` quand la lecture échoue.

   Le patron de montage (routeur factice, `ProviderScope` avec
   `appDatabaseProvider` surchargé, `_IdleSyncCoordinator`) est déjà dans le
   fichier, aide `mount` l. 71-152 : le réemployer, en remplaçant seulement ses
   routes factices `/campagnes*` par `/prospects` et `/representants`.

10. Écrire un test du nouveau sélecteur, par exemple
    `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/features/prospect_picker_test.dart` :
    - trois prospects en base (via `insertProspect` de `db_fixture.dart`) plus
      leurs parcours `CHUES` ;
    - taper un morceau de nom dans `CpiSearchField` réduit la liste ;
    - taper un morceau de numéro avec des espaces la réduit aussi ;
    - un tap sur une ligne pousse `/phase2?tel=<E164>` ;
    - liste vide en recherche → `Aucun résultat`.

**Vérification**

```
flutter analyze
dart format --output=none --set-exit-if-changed lib/ test/
flutter test
```

Attendu : tout vert. Sur chaque test **neuf**, appliquer la règle du dépôt :
casser volontairement le code couvert (par exemple, faire pointer la carte 3
vers `/representants`), vérifier que le test rougit, remettre.

---

### Étape 7 — Le contrat API (à faire **après** le plan API)

Cette étape n'a de sens qu'une fois le serveur modifié. Tant que le contrat
n'a pas bougé, le mobile compile et fonctionne : il reçoit les quatre listes et
les ignore.

1. Depuis la racine du dépôt :

```
pnpm codegen
```

   Cela régénère `apps/api/openapi.json`, `packages/api-client/src/generated`
   et `packages/api-client-dart/lib`.

2. Inspecter le diff engendré :

```
git diff --stat packages/api-client-dart/lib
```

   Attendu : disparition de `sync_call_campaign_dto.dart`,
   `sync_call_task_dto.dart`, `sync_rep_call_campaign_dto.dart`,
   `sync_rep_call_task_dto.dart`, `call_task_status.dart` et de leurs `.g.dart`,
   plus la perte des quatre champs de `sync_changes_dto.dart`.

3. Corriger les sites d'appel devenus faux, tous des **constructions** de
   `SyncChangesDto` dans les tests et le stub :

| Fichier | Ligne(s) |
| --- | --- |
| `apps/mobile/lib/core/sync/stub_api.dart` | 64-67 |
| `apps/mobile/test/support/fake_api.dart` | 486-489 |
| `apps/mobile/test/core/sync_engine_test.dart` | 1782-1785, 1825-1828, 1882-1885, 1924-1927, 1961-1964 |
| `apps/mobile/test/core/sync_generations_test.dart` | 514-517 |
| `apps/mobile/test/core/sync_ownership_test.dart` | 891-894, 1498-1501, 1522-1525 |
| `apps/mobile/test/core/sync_reconciliation_test.dart` | 974-977 |
| `apps/mobile/test/core/sync_visite_referentiels_test.dart` | 229-232 |

**Vérification**

```
cd /Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/api-client-dart
dart pub get && dart analyze && dart format --output=none --set-exit-if-changed .
cd /Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter analyze
dart format --output=none --set-exit-if-changed lib/ test/
flutter test
```

---

### Étape 8 — Vérification finale, telle que la CI l'exécute

Extrait exact de
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/.github/workflows/ci.yml:563-574` :

```
cd /Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter analyze
dart format --output=none --set-exit-if-changed lib/ test/
flutter test
```

Exigence : `flutter analyze` → **0 issue**, `flutter test` → **vert**.

Depuis la racine, si le contrat a bougé :

```
pnpm codegen:check
```

Ne **pas** commiter. Ne **pas** lancer de build Android ni l'émulateur.

---

## 5. Dépendances envers le contrat API

Ce que le mobile **suppose** du serveur après ce chantier.

### 5.1 Flux de `GET /v1/sync/pull` encore lus par le mobile

`departements`, `iefs`, `banques`, `syndicats`, `canauxProvenance`,
`visiteReferentiels`, `representants`, `prospects`, `visites`, et le tableau
`deletions`. Rien d'autre.

Le mobile **cesse de lire** `callCampaigns`, `callTasks`, `repCallCampaigns`,
`repCallTasks`. Il tolère leur présence : il ne les touche plus, un point c'est
tout.

### 5.2 Ce que le plan API doit trancher

**Le mobile est indifférent** à ce que le serveur fasse de ces quatre flux,
**sauf** pour les APK déjà installés. Trois options, par ordre de risque :

| Option | Effet sur une app **neuve** | Effet sur une app **déjà installée** |
| --- | --- | --- |
| A. Le serveur garde les quatre clés et renvoie toujours `[]` | aucun | aucun |
| B. Le serveur retire les quatre clés **et** porte `MIN_PULL_PAYLOAD_VERSION` de 4 à 5 (`apps/api/src/modules/sync/sync.controller.ts:29`) ; le mobile porte `payloadVersion` de 4 à 5 (`sync_engine.dart:59`) | aucun | `426 APP_UPDATE_REQUIRED`, message honnête, poussée toujours ouverte |
| C. Le serveur retire les quatre clés **sans** toucher au numéro de format | aucun | **pull cassé en silence** — voir §6 |

**Recommandation : option B.** Elle est la seule qui retire vraiment le contrat
tout en disant la vérité aux appareils anciens. Elle exige que les deux
changements partent dans le **même** déploiement.

### 5.3 Le reste du contrat est inchangé

- `POST /v1/sync/push` : le mobile n'a jamais envoyé de `taskId`. Charge utile
  d'une tentative de conversion : `write_repository.dart:817-838`. Charge utile
  d'une qualification : `write_repository.dart:951-964`.
- `POST` de qualification représentant, via
  `RepCampaignsApi.recordRepCallAttempt` (`dio_api.dart:171-183`), corps
  `CreateRepCallAttemptDto`
  (`packages/api-client-dart/lib/src/model/create_rep_call_attempt_dto.dart`,
  14 champs, **aucun** `taskId`). **Cet endpoint doit rester.** C'est le geste
  n° 1. Si le plan API renomme le module (`RepCampaigns` → autre chose parce
  que « campagne » disparaît du vocabulaire), c'est une régénération pure :
  `dio_api.dart:58` et `dio_api.dart:176` suivent.
- `GET /v1/phase2/directory` (annuaire des numéros à convertir,
  `dio_api.dart:203-226`) : **doit rester**. C'est ce qui rend le geste n° 3
  possible hors ligne. Son périmètre serveur ne doit **pas** être restreint aux
  fiches d'une campagne assignée, sans quoi le téléconseiller ne trouvera plus
  personne.
- `GET` des motifs d'issue (`dio_api.dart:239-251`) et des référentiels
  (`dio_api.dart:257-283`) : inchangés.

### 5.4 Question à poser au plan API

Le périmètre du **pull** dépend aujourd'hui des tâches. Vu dans
`apps/api/src/modules/sync/sync.service.ts:210-211` :

```
{ prospects: { some: { callTasks: assignedTo(user.id) } } },
{ repCallTasks: { some: { assignedToId: user.id } } },
```

et `sync.service.ts:807` :

```
OR: [{ createdById: user.id }, { callTasks: { some: { assignedToId: user.id } } }],
```

Autrement dit, **un téléconseiller reçoit aujourd'hui les fiches qu'une
campagne lui a confiées.** Si les tâches disparaissent, ce chemin d'accès
disparaît avec elles : le mobile ne recevrait plus que ce que
`createdById = moi` lui donne. Le plan API **doit** définir la nouvelle règle de
périmètre (tout le portefeuille ? le département ? l'IEF ?), sinon les gestes
n° 1 et n° 3 n'auront plus rien à chercher.

**C'est la seule dépendance bloquante de ce plan.**

---

## 6. Migration des installations existantes et compatibilité

### 6.1 Base locale d'un appareil déjà déployé

Un téléphone de terrain porte des saisies **non encore synchronisées**. La
migration doit les préserver.

| Version installée | Chemin | Résultat |
| --- | --- | --- |
| ≤ v11 | les paliers 12 et 17 n'existent plus, le palier 20 fait `DROP TABLE IF EXISTS` sur des tables absentes (sans effet) | base à jour, saisies intactes |
| v12 à v16 | `call_campaigns` et `call_tasks` existent, le palier 20 les supprime ; `rep_call_*` n'existent pas | base à jour, saisies intactes |
| v17 à v19 | les quatre tables existent, le palier 20 les supprime toutes | base à jour, saisies intactes |

Ce qui **survit dans tous les cas** : `outbox` (les envois en attente),
`call_attempts` (le journal des appels consignés), `rep_callback_reminders`
(les rappels promis, donc les alarmes déjà armées), `representants`,
`prospects`, `prospect_journeys`, `representant_comments`, `visites`,
`form_drafts`, `sync_state` (le curseur).

Ce qui est **perdu, volontairement** : la liste des fiches qu'une campagne
avait confiées. C'est exactement la décision du propriétaire.

**Aucun curseur n'est réinitialisé.** Contrairement au palier v8
(`database.dart:131-133`, `DELETE FROM sync_state WHERE collection = 'all'`),
il n'y a rien à re-télécharger : on retire des données, on n'en ajoute pas.

**Aucune migration de `SharedPreferences`.** Une adresse `/campagnes` mémorisée
est rejetée par `RouteMemory.isRestorable` (`route_memory.dart:151-160`) et la
mémoire s'efface d'elle-même (`route_memory.dart:95-98`). Idem pour la mémoire
d'une adresse déjà expirée : `RouteMemory` la borne à 24 h et au numéro de build
(`route_memory.dart:16, 67`).

**Alarmes système déjà posées.** Elles sont dérivées de l'identifiant d'un
rappel (`rep_callback_notifications.dart:60-63`) et la table
`rep_callback_reminders` survit : aucune alarme n'est orpheline, aucune
n'est à reprogrammer.

### 6.2 Ancienne app face au nouveau serveur — le point de rupture

**C'est le risque le plus sérieux de tout ce chantier.**

Le DTO engendré `SyncChangesDto`
(`packages/api-client-dart/lib/src/model/sync_changes_dto.dart:87-97`) déclare
les quatre champs `required: true`. Le désérialiseur engendré
(`sync_changes_dto.g.dart:212-229`) exécute :

```
$checkKeys(json, requiredKeys: const [
  'departements', 'iefs', 'banques', 'syndicats', 'canauxProvenance',
  'visiteReferentiels', 'representants', 'prospects',
  'callCampaigns', 'callTasks', 'repCallCampaigns', 'repCallTasks', 'visites',
]);
```

Si le serveur **cesse d'émettre** ces clés et qu'un APK déjà installé appelle le
pull, la chaîne est la suivante :

1. `$checkKeys` lève une `MissingRequiredKeysException` ;
2. l'API engendrée l'enveloppe en `DioException(type: unknown, ...)`, en
   conservant la `Response` **200**
   (`packages/api-client-dart/lib/src/api/sync_api.dart:96-104`) ;
3. `DioApi._guard` (`apps/mobile/lib/core/sync/dio_api.dart:359-365`) voit
   `type == unknown` **et** un statut 2xx, et rend
   `_undecodableBody(...)` ;
4. `_undecodableBody` (`dio_api.dart:376-396`) : le `content-type` est bien du
   JSON, donc l'exception est
   `ApiException('RESPONSE_SCHEMA_MISMATCH', kind: FailureKind.terminal)` ;
5. `SyncOutcome.shouldRetry` (`sync_engine.dart:2205-2209`) rend **faux** sur
   `FailureKind.terminal` : le pull ne réessaiera jamais tout seul ;
6. la bande d'état affiche « Le serveur a refusé cet envoi
   (RESPONSE_SCHEMA_MISMATCH). Ouvrez « À corriger ». »
   (`sync_coordinator.dart:47-48`) — un message **faux**, puisque rien n'est à
   corriger et que ce n'est pas un envoi qui a échoué.

Conséquence pratique : l'appareil **continue de pousser** ses saisies (`drain()`
tourne avant `pullChanges()` dans `runOnce`, `sync_engine.dart:110-135`) mais
**ne reçoit plus rien**, indéfiniment, en affichant un message qui envoie
l'utilisateur au mauvais endroit.

**Parade : l'option B de §5.2.** Le serveur porte
`MIN_PULL_PAYLOAD_VERSION` à 5 dans le **même** déploiement que le retrait des
clés. L'ancien APK annonce `x-cpi-payload-version: 4`, reçoit un `426`
(`apps/api/src/modules/sync/sync.controller.ts:154-164`), et `DioApi.classify`
(`dio_api.dart:475-487`) le traduit en
`FailureKind.appUpdateRequired`. La bande dit alors la vérité :
« Cette version ne reçoit plus les fiches. Vos saisies partent toujours :
installez la mise à jour. » (`sync_coordinator.dart:49-51`).

Le mobile porte alors `sync_engine.dart:59` de 4 à 5. **Les deux changements
sont indissociables** : porter le numéro côté mobile sans le serveur ne fait
rien de mal (le serveur accepte `>= 4`), mais porter le minimum serveur sans
livrer l'APK coupe le pull de tout le parc.

**Nuance à ne pas oublier** : le `426` n'ouvre **pas** l'écran de mise à jour.
Celui-ci est piloté par un endpoint distinct
(`appUpdateControllerProvider`, montage dans
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/app.dart:37-63`).
Le `426` ne produit qu'une bande d'état. Si l'on veut que le parc soit
réellement poussé à se mettre à jour, il faut **aussi** publier la nouvelle
version dans le service de mises à jour (`apps/api/src/modules/app-updates/`).

### 6.3 Nouvelle app face à l'ancien serveur

Sans risque. Le mobile lit moins de champs qu'il n'en reçoit ; les quatre listes
sont simplement ignorées. Le passage à `payloadVersion: 5` est accepté par un
serveur qui exige `>= 4`.

### 6.4 Nature du livrable

Ce chantier modifie le **schéma SQLite** (v19 → v20) et, en option B, le contrat
réseau. Une mise à jour **OTA Shorebird** (`apps/mobile/shorebird.yaml`) porte du
code Dart et **peut** donc porter cette migration, tant qu'aucune dépendance
native ne bouge — et aucune ne bouge ici. Mais un **retour arrière** OTA après
que la v20 a tourné rendrait la main à un code v19 sur une base v20 : drift
refuserait d'ouvrir. **Traiter ce lot comme une livraison APK, pas comme un
correctif OTA.**

---

## 7. Tests

### 7.1 Ce qui disparaît

- `apps/mobile/test/features/campagnes_test.dart` (676 l.), en entier.
- Le groupe « files d'appels : ce qui n'est plus confié quitte le programme »
  (`test/core/sync_generations_test.dart:301-385`).
- Le test « la file d'une campagne atterrit telle que le serveur l'a répartie »
  (`test/core/sync_engine_test.dart:1978-2036`).
- Le test de `repCampaignQueue` dans `test/data/database_test.dart` (≈ 525-575).
- Les deux paliers de `test/data/migration_test.dart` (1398-1480, 1776-1815).
- Les fixtures `insertCampagne` / `insertTache`
  (`test/support/db_fixture.dart:172-217`).

### 7.2 Ce qui s'adapte

- `test/data/write_repository_test.dart:713-748` : ne prouve plus la fermeture
  d'une tâche, prouve toujours que la qualification entre dans l'outbox sous
  `repCallAttemptEntity` et que le rappel promis est écrit.
- `test/features/home_test.dart` : réécrit (§4, étape 6.9).
- `test/features/text_scale_overflow_test.dart` : perd deux écrans de campagne,
  gagne le sélecteur de prospects. **Ce test est le garde-fou le plus utile du
  dépôt** : il peint ~25 écrans à des tailles de texte allant jusqu'à 1,8× sur
  des largeurs de 320 dp et échoue au moindre `RenderFlex overflowed`. Tout
  écran neuf doit y entrer.
- Les sept fichiers qui **construisent** un `SyncChangesDto` (§4, étape 7.3) :
  simple retrait d'arguments, à faire **après** `pnpm codegen`.

### 7.3 Ce qui reste intact et doit continuer de passer

- `test/features/phase2_screen_test.dart` (1293 l.) — le parcours de conversion
  en cinq étapes. Aucune référence à une campagne.
- `test/features/accessibilite_ecrans_test.dart` (691 l.) — chaque commande doit
  porter une action `tap` dans l'arbre sémantique (WCAG 4.1.2). Le nouveau
  sélecteur de prospects devrait y entrer.
- `test/core/theme_tokens_test.dart:226` — « aucune taille d'icône n'est écrite
  en dur dans `lib/` ». Il balaye les sources : le nouvel écran **doit** passer
  par `CpiIconSize`.
- `test/core/theme_tokens_test.dart:245-251` — l'échelle `CpiSpacing` ne se
  recalcule pas à la main.
- `test/features/rappel_alarme_test.dart` — écrit par un autre agent, ne pas y
  toucher.
- `test/core/router_test.dart`, `test/core/router_landing_test.dart`,
  `test/features/hub_test.dart`, `test/features/shells_test.dart` — aucune
  référence à une campagne, mais ils montent le routeur : les faire tourner
  après l'étape 1.

### 7.4 Ce qu'il faut écrire

1. **Migration v19 → v20** (`test/data/migration_test.dart`) : les quatre tables
   disparaissent, les saisies non parties survivent. §4, étape 4.
2. **Migration v11 → courant** : le chemin long ne casse pas sans les paliers 12
   et 17.
3. **Accueil CHUES** (`test/features/home_test.dart`) : trois titres, trois
   destinations, le chiffre honnête. §4, étape 6.9.
4. **Sélecteur de prospects**
   (`test/features/prospect_picker_test.dart`) : recherche par nom, recherche
   par numéro espacé, tap → `/phase2?tel=…`, état vide. §4, étape 6.10.
5. **Débordement de texte** : entrée « Choisir un prospect » dans le balayage.

Pour chacun : **le voir rougir avant de le voir vert.** Un test qui passe sur du
code cassé est pire que pas de test (`AGENTS.md:54-65`).

### 7.5 Commandes

```
cd /Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile

# Ciblé, pendant le travail
flutter test test/data/migration_test.dart
flutter test test/features/home_test.dart
flutter test test/features/prospect_picker_test.dart
flutter test test/features/text_scale_overflow_test.dart
flutter test test/core/sync_engine_test.dart

# Complet, avant de rendre
flutter analyze
dart format --output=none --set-exit-if-changed lib/ test/
flutter test
```

---

## 8. Risques et questions ouvertes

### Bloquants

**1. Le périmètre du pull dépend des tâches.**
`apps/api/src/modules/sync/sync.service.ts:210-211` et `:807` accordent
aujourd'hui à un téléconseiller les fiches qu'une campagne lui a confiées. Sans
tâches, il ne reste que `createdById = moi`. Les gestes n° 1 (chercher un
représentant) et n° 3 (chercher un prospect) n'auraient alors quasiment rien à
chercher sur un appareil neuf. **Le plan API doit définir la nouvelle règle
avant que ce plan ne soit exécutable de bout en bout.** Les étapes 1 à 6 de §4
sont applicables sans cette réponse ; l'étape 7 ne l'est pas.

**2. Le retrait des quatre clés casse silencieusement les APK déjà installés**
si `MIN_PULL_PAYLOAD_VERSION` ne bouge pas dans le même déploiement. Chaîne
complète en §6.2. Décision à prendre avec le plan API (option A, B ou C de
§5.2 ; recommandation : B).

### Non bloquants

**3. « L'historique de ce qu'il a consigné » n'existe pas sous cette forme.**
L'onglet « Fiches » du CHUES
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/historique/presentation/historique_screen.dart`)
liste des **représentants** (`representantListProvider`,
`app_providers.dart:285-290`), pas des appels consignés. Aucun écran ne montre
aujourd'hui la liste des `call_attempts` et des qualifications que le
téléconseiller a saisies. La table existe et la requête aussi
(`attemptsForProspect`, `schema.drift:792-795`), mais elle est **par prospect**.
Ce plan **garde l'écran tel quel**. Si le propriétaire veut un vrai journal des
appels consignés, c'est un chantier distinct, à cadrer séparément.

**4. `phase2_directory` est le seul chemin de recherche par numéro dans la
conversion.** Le sélecteur de prospects proposé (§3.4) cherche dans
`prospects`, pas dans `phase2_directory`. Les deux sources ne se recouvrent pas :
l'annuaire couvre 50 000 à 500 000 numéros **sans nom**
(`schema.drift:420-436`, c'est une frontière de confidentialité délibérée),
alors que `prospects` ne contient que les fiches réellement descendues sur
l'appareil. Un téléconseiller qui cherche « Fatou » ne trouvera que les fiches
présentes ; un qui tape un numéro complet dans `/phase2` retrouvera n'importe
quel dossier de l'annuaire. Les deux chemins restent donc nécessaires, et
c'est bien ce que prévoit ce plan (carte 3 → sélecteur, et `/phase2` reste
accessible depuis une fiche prospect). **Ne pas fusionner les deux.**

**5. `historiqueSearchProvider` est partagé** entre `HistoriqueScreen` et
`GrandPublicFichesScreen` (`app_providers.dart:275-283, 292-302`). Ce défaut
préexiste. Le nouveau sélecteur reçoit son propre provider pour ne pas
l'aggraver ; corriger le partage existant est hors périmètre.

**6. `spread_days`, `position` et `day_index` disparaissent du produit.**
Ils venaient du « programme papier » (PDF distribué aux téléconseillers). Si ce
document existe encore, les deux supports divergeront. Question métier, pas
technique.

**7. `RepCampaignsApi` garde un nom qui parle de campagne** alors que le mot
disparaît du produit. C'est un nom d'étiquette OpenAPI, invisible de
l'utilisateur. Le renommer est un choix du plan API ; côté mobile c'est une
régénération pure, deux lignes touchées (`dio_api.dart:58` et `:176`).

**8. Rien n'a été exécuté.** Ce document est un audit en lecture seule. Aucun
`flutter analyze`, aucun `flutter test`, aucun `build_runner`, aucun build
Android n'a été lancé. Toutes les commandes de §4 restent à exécuter par
l'agent qui appliquera le plan. Les numéros de ligne ont été relevés à la
lecture des fichiers, sur un arbre de travail qui contient du travail non
commité d'autres agents et qui **bougera** d'ici l'exécution.

**9. Émulateur et appareil réel.** Aucun émulateur n'a tourné, et un émulateur
ne prouverait de toute façon rien sur les alarmes exactes, la survie en
arrière-plan sur ROM Transsion ou Xiaomi
(`pubspec.yaml:58-60`), ni sur le comportement réel de la migration SQLite sur
un appareil chargé de 500 000 lignes d'annuaire. La migration v19 → v20 est un
`DROP TABLE` : elle est rapide, mais elle n'aura été prouvée que par
`migrateAndValidate` en mémoire. **Un essai sur un appareil réel portant une
base de production reste à faire avant diffusion.**

---

Auteur : mobile-engineer (audit mobile)
