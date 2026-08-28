# Plan API : retrait des listes d'appel, campagne réduite à un lot d'export

Ce document s'adresse à quelqu'un qui n'a aucun contexte préalable. Chaque
affirmation porte un chemin absolu et un numéro de ligne, vérifiés sur l'arbre de
travail de la branche `feat/cpi-go-forui-organisateur` au 28 août 2026. Les
numéros de ligne peuvent avoir bougé si d'autres agents ont écrit entre-temps :
relire le voisinage avant d'éditer, ne jamais éditer à l'aveugle sur un numéro.

## 0. Règles du dépôt à respecter pendant tout le chantier

- Modifier un fichier existant avec `Edit`, en créer un avec `Write`. Jamais de
  `sed`, `cat`, heredoc, redirection shell ou script Python pour écrire du code.
- Commentaires rares. Un commentaire ne se justifie que si le code ne PEUT pas
  porter l'information (contrainte externe, choix contre-intuitif, piège).
  Interdits : bandeaux, séparateurs graphiques, paragraphes, redite de la ligne.
  Au-delà de 15 % de lignes de commentaire, le fichier est à réécrire.
  Référence : `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/AGENTS.md:67`.
- Copie française sobre et directe, sans jargon ni tiret cadratin
  (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/AGENTS.md:31`).
  Le vocabulaire d'interface est figé et gardé par
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/vocabulaire.test.ts`
  (`teleconseiller`, `Banque & Finance`, `campagne d'appels prospects`, `campagne
  d'appels representants`). Ce chantier supprime la notion de campagne d'appels :
  la mise à jour de ce test appartient au plan web, mais les descriptions
  OpenAPI côté API doivent cesser de parler de « campagne d'appels », de
  « tâche », de « file » et de « programme ».
- Après TOUT changement de contrat (DTO, route, enum exposé) :
  `pnpm codegen` puis `pnpm codegen:check`. Le second échoue si le contrat
  engendré n'a pas été recommité
  (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/package.json:38`).
- Aucun commit, aucun `git stash`, aucun `git checkout` sans demande explicite.
  L'arbre de travail contient déjà beaucoup de travail non commité d'autres
  agents (tableaux de bord, rappels mobile) : ne rien annuler.
- Ne pas tuer les serveurs de développement des ports 3000 et 3001.
- Priorité package : réutiliser ce qui existe dans le dépôt (helpers de portée,
  `ExcelJS` déjà en place pour les classeurs, `JSZip` déjà en place pour les
  archives, `pdfkit` déjà en place pour les PDF) avant d'écrire du code neuf.
  Aucune dépendance nouvelle n'est nécessaire pour ce chantier.
- Avant de garder un test, le casser : modifier le code qu'il couvre, vérifier
  qu'il rougit, remettre
  (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/AGENTS.md:54`).

## 1. Décision et périmètre

### 1.1 Ce qui existe aujourd'hui

Le CRM CPI est un monorepo pnpm à la racine
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo` :

| Application | Emplacement | Pile |
| --- | --- | --- |
| API | `apps/api` | NestJS 11 sur Fastify, Prisma 7, PostgreSQL, Node 24 |
| Web | `apps/web` | Next.js |
| Mobile | `apps/mobile` | Flutter (CPI GO) |
| Schéma | `packages/database/prisma/schema.prisma` | Prisma, 2315 lignes |
| Contrat | `apps/api/openapi.json` | engendré par `pnpm codegen` |
| Client TS | `packages/api-client/src/generated` | engendré |
| Client Dart | `packages/api-client-dart/lib` | engendré |

Deux modules de « campagne d'appels » distribuent aujourd'hui du travail nominatif :

1. **Campagnes prospects** (`apps/api/src/modules/phase2`) : un administrateur
   crée une campagne, le serveur tire l'ensemble éligible, mélange par
   PostgreSQL à partir d'une graine persistée, distribue en tourniquet entre des
   téléconseillers nommés, et matérialise une ligne `CallTask` par prospect avec
   `assignedToId`, `position` et `dayIndex`. Voir
   `apps/api/src/modules/phase2/campaigns.service.ts:113`.
2. **Campagnes représentants** (`apps/api/src/modules/rep-campaigns`) : même
   mécanique sur `RepCallTask`. Voir
   `apps/api/src/modules/rep-campaigns/rep-campaigns.service.ts:145`.

Ces tâches irriguent tout le produit : la portée de lecture des prospects
(`apps/api/src/common/scope.ts:38`), la portée de synchronisation mobile
(`apps/api/src/modules/sync/sync.service.ts:186`), les statistiques de pilotage
(`apps/api/src/modules/analytics/pilotage.service.ts:43`), la supervision
(`apps/api/src/modules/analytics/supervision.service.ts:166`), les rappels
poussés (`apps/api/src/modules/notifications/reminders.service.ts:141`), et
l'éligibilité au tirage
(`packages/database/src/segment.ts:124`).

### 1.2 La décision produit (donnée, non rediscutable)

**On ne consigne plus qui doit appeler qui.** Il n'y a plus d'assignation, plus
de tâche, plus de file « à appeler », plus de « prochain contact », plus de
« reste à appeler », plus de programme papier par téléconseiller.

- Les téléconseillers **cherchent librement** dans l'annuaire des représentants
  et dans la base des prospects, sur le web comme sur le mobile.
- Ils **consignent leurs appels** (`CallAttempt`, `RepCallAttempt`) et
  **promettent des rappels** (`ScheduledCallback`). Ces trois objets restent.
- Une **campagne** ne subsiste que côté web comme un **lot d'export** : on
  choisit une cible par filtres (projet, département, statut de relation des
  représentants, segment…), on télécharge les fiches en Excel, et
  l'administration suit ce lot : qui l'a créé, quand, combien de fiches, et
  combien d'appels ont eu lieu sur ces fiches depuis sa création.
- **Le mobile ne voit plus du tout les campagnes ni les tâches.**

### 1.3 Périmètre de ce plan

Ce plan couvre uniquement `apps/api` et `packages/database`. Le web
(`apps/web`) et le mobile (`apps/mobile`) font l'objet de deux plans séparés
qui seront fusionnés avec celui-ci. Les clients engendrés
(`packages/api-client`, `packages/api-client-dart`) ne se modifient pas à la
main : ils sortent de `pnpm codegen`.

## 2. Inventaire

### 2.1 Modèle de données

Fichier unique : `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/database/prisma/schema.prisma`.

#### Enums

| Ligne | Enum | Verdict |
| --- | --- | --- |
| `:153` | `CampaignScope` (BDD1..BDD4, GP1..GP4, ALL) | **Supprimer.** Le périmètre d'un lot se dit désormais avec les filtres partagés (`ProspectFilterDto`, `RepresentantQueryDto`). Seuls consommateurs : `apps/api/src/modules/phase2/campaigns.service.ts:54`, `:70`, `:292`, `apps/api/src/modules/phase2/dto.ts:51`, et `packages/database/src/segment.ts:82`, `:89`, `:116`. |
| `:165` | `CampaignStatus` (DRAFT, ACTIVE, PAUSED, CLOSED) | **Supprimer.** Un lot d'export n'a pas d'état : il est produit une fois. |
| `:172` | `CallTaskStatus` (OPEN, DONE, CANCELLED) | **Supprimer.** |
| `:178` | `CallOutcome` | **Garder tel quel.** Décrit l'issue d'un appel, pas une tâche. |
| `:195` | `RepCallOutcome` | **Garder tel quel.** |
| `:1139` | `ScheduledCallbackStatus` | **Garder tel quel.** |

#### Modèles

| Ligne | Modèle / table | Verdict | Détail |
| --- | --- | --- | --- |
| `:928` | `CallCampaign` / `call_campaigns` | **Supprimer** | Porte `scope`, `seed`, `status`, `spreadDays`, `audienceFilters`, relations `commerciaux`, `tasks`, `attempts`, `callbacks`. Tout est de l'assignation. |
| `:966` | `CallCampaignCommercial` / `call_campaign_commerciaux` | **Supprimer** | Table de tourniquet, sans objet. |
| `:987` | `CallTask` / `call_tasks` | **Supprimer** | `assignedToId:994`, `position:999`, `dayIndex:1006`, `status:1008`, `isActive:1009`, index uniques `:1018`, `:1019`, index `:1020`, `:1021`, `:1024`, index de curseur de synchronisation `:1027`. |
| `:1037` | `CallAttempt` / `call_attempts` | **Garder en le vidant** | Supprimer `taskId:1042`, `task:1043`, `campaignId:1044`, `campaign:1045` et l'index `@@index([campaignId])` `:1085`. Tout le reste (issue, méthode, motif, renseignements de conversion, `performedById`, `clientCreatedAt`) reste : c'est le journal des appels, seule source des chiffres après le chantier. |
| `:1103` | `ScheduledCallback` / `scheduled_callbacks` | **Garder en le vidant** | Supprimer `taskId:1107`, `task:1108`, `campaignId:1109`, `campaign:1110`. Garder `assignedToId:1114` (celui qui a PROMIS le rappel, pas un assigné de tâche : le commentaire `:1112` le dit déjà) et `sourceAttemptId:1123` (clé d'idempotence du rappel). Garder les trois index `:1132`, `:1133`, `:1135`. |
| `:1159` | `RepCallCampaign` / `rep_call_campaigns` | **Supprimer** | `departementId:1170`, `iefId:1172`, `onlyWithoutProspects:1177`, `relationStatuses:1181` décrivent une CIBLE : cette information se reporte dans le lot d'export (voir §3.1). |
| `:1198` | `RepCallCampaignCommercial` / `rep_call_campaign_commerciaux` | **Supprimer** | |
| `:1218` | `RepCallTask` / `rep_call_tasks` | **Supprimer** | |
| `:1251` | `RepCallAttempt` / `rep_call_attempts` | **Garder en le vidant** | Supprimer `taskId:1256`, `task:1257`, `campaignId:1258`, `campaign:1259` et `@@index([campaignId])` `:1280`. Garder `outcome`, `promisedProspects`, `callbackAt`, `suggestion`. |

#### Champs de relation à retirer sur les modèles conservés

| Ligne | Champ | Modèle |
| --- | --- | --- |
| `:255` | `campaignsCreated CallCampaign[]` | `User` |
| `:256` | `campaignMemberships CallCampaignCommercial[]` | `User` |
| `:257` | `callTasksAssigned CallTask[]` | `User` |
| `:266` | `repCampaignsCreated RepCallCampaign[]` | `User` |
| `:267` | `repCampaignMemberships RepCallCampaignCommercial[]` | `User` |
| `:268` | `repCallTasksAssigned RepCallTask[]` | `User` |
| `:492` | `repCallTasks RepCallTask[]` | `Representant` |
| `:693` | `callTasks CallTask[]` | `Prospect` |
| `:1171` | `departement` (relation `RepCallCampaignDepartement`) | à retirer aussi côté `Departement` |
| `:1173` | `ief` (relation `RepCallCampaignIef`) | à retirer aussi côté `Ief` |

`User.scheduledCallbacks:293`, `User.callAttempts:258`, `User.repCallAttempts:269`,
`Representant.repCallAttempts:493`, `Prospect.callAttempts:694`,
`Prospect.scheduledCallbacks:695` **restent**.

#### Index SQL bruts posés hors Prisma

| Fichier | Ligne | Index | Verdict |
| --- | --- | --- | --- |
| `packages/database/prisma/migrations/20260812141010_phase2_and_bank_finance/migration.sql` | `:344` | `call_tasks_one_active_per_prospect` | Disparaît avec la table. |
| `packages/database/prisma/migrations/20260814090000_campagnes_representants_et_demandes_clients/migration.sql` | `:261` | `rep_call_tasks_one_active_per_representant` | Disparaît avec la table. |

#### Helper d'éligibilité partagé

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/database/src/segment.ts`

| Ligne | Élément | Verdict |
| --- | --- | --- |
| `:82` | `GP_TYPES` | Supprimer (dépend de `CampaignScope`). |
| `:89` | `scopeWhere(scope, projet)` | Supprimer. |
| `:116` | `eligibleForCampaignWhere(scope, projet)` | Supprimer. La ligne `:124` `callTasks: { none: { isActive: true } }` est le cœur de l'éligibilité par assignation. |
| ailleurs | `segmentWhere`, `segmentAxes`, `ALL_SEGMENTS`, `CHUES_SIGLE`, `CBAO_SHORT_NAME` | **Garder** : servent aux statistiques, aux listes et aux exports. |

### 2.2 Endpoints

Inventaire complet extrait de
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/openapi.json`.
Toutes les routes sont préfixées `/api/v1`.

#### Campagnes prospects — `apps/api/src/modules/phase2/phase2.controller.ts`

| Route | Ligne | operationId | Rôles actuels | Verdict |
| --- | --- | --- | --- | --- |
| `GET /phase2/campaigns` | `:134` | `listCallCampaigns` | ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION | **Supprimer** |
| `POST /phase2/campaigns` | `:148` | `createCallCampaign` | ADMIN | **Supprimer** (remplacée par `POST /v1/lots-export`, §3.2) |
| `GET /phase2/campaigns/{id}` | `:178` | `getCallCampaign` | ADMIN, SUPERVISEUR, DIRECTION | **Supprimer** |
| `POST /phase2/campaigns/{id}/close` | `:191` | `closeCallCampaign` | ADMIN | **Supprimer** |
| `POST /phase2/campaigns/{id}/pause` | `:207` | `pauseCallCampaign` | ADMIN | **Supprimer** |
| `POST /phase2/campaigns/{id}/resume` | `:216` | `resumeCallCampaign` | ADMIN | **Supprimer** |
| `GET /phase2/campaigns/{id}/commerciaux/{userId}/programme.pdf` | `:225` | `downloadCallProgrammePdf` | ADMIN, SUPERVISEUR, DIRECTION | **Supprimer** : le PDF est un programme d'appels nominatif. |
| `GET /phase2/directory` | `:120` | `pullPhase2Directory` | PARCOURS_ROLES | **Garder tel quel** : annuaire hors ligne, ne touche aucune tâche (vérifié, `apps/api/src/modules/phase2/directory.service.ts` ne mentionne ni tâche ni campagne). |
| `POST /phase2/call-attempts/{id}/recording` | `:66` | `uploadCallRecording` | PARCOURS_ROLES | **Garder tel quel** |
| `GET /phase2/call-attempts/{id}/recording` | `:96` | `downloadCallRecording` | ADMIN, SUPERVISEUR, DIRECTION, COMMERCIAL | **Garder tel quel** |

Le contrôleur perd donc sept routes sur dix. `Phase2CampaignsService`
(`apps/api/src/modules/phase2/campaigns.service.ts`, 27,6 Ko) disparaît en
entier, avec ses tests
(`apps/api/src/modules/phase2/campaigns.service.test.ts`, 16,9 Ko).

#### Campagnes représentants — `apps/api/src/modules/rep-campaigns/rep-campaigns.controller.ts`

| Route | Ligne | operationId | Rôles | Verdict |
| --- | --- | --- | --- | --- |
| `GET /rep-campaigns/preview` | `:71` | `previewRepCampaign` | ADMIN | **Transformer** en aperçu de lot : `GET /v1/lots-export/apercu` rend le nombre de fiches ciblées, sans « charge par commercial » ni « par jour ». |
| `POST /rep-campaigns/attempts` | `:83` | `recordRepCallAttempt` | PARCOURS_ROLES | **Transformer** : le corps ne change pas, la RÉPONSE perd `taskId` et `taskClosed` (`apps/api/src/modules/rep-campaigns/dto.ts:499` et `:505`). Le service cesse de chercher une tâche active (`rep-campaigns.service.ts:641`) et de la clore (`:708`). |
| `GET /rep-campaigns` | `:112` | `listRepCampaigns` | ADMIN, SUPERVISEUR, DIRECTION | **Supprimer** (remplacée par `GET /v1/lots-export`) |
| `POST /rep-campaigns` | `:123` | `createRepCampaign` | ADMIN | **Supprimer** (remplacée par `POST /v1/lots-export`) |
| `GET /rep-campaigns/{id}` | `:151` | `getRepCampaign` | ADMIN, SUPERVISEUR, DIRECTION | **Supprimer** |
| `POST /rep-campaigns/{id}/close` | `:164` | `closeRepCampaign` | ADMIN | **Supprimer** |
| `GET /rep-campaigns/{id}/commerciaux/{userId}/programme.pdf` | `:179` | `downloadRepProgrammePdf` | ADMIN, SUPERVISEUR, DIRECTION | **Supprimer** |
| `GET /rep-campaigns/{id}/programmes.zip` | `:231` | `downloadRepProgrammesZip` | ADMIN, SUPERVISEUR, DIRECTION | **Supprimer** |

Le module entier est à reconstruire autour de la seule tentative d'appel. Le
service `apps/api/src/modules/rep-campaigns/rep-campaigns.service.ts` (28,8 Ko)
se réduit à `recordAttempt` (`:600`), `resolveSuggested`, `validatedComment` et
`resolveWhatsappPatch` ; les 550 premières lignes (tirage, tourniquet,
répartition, détail, programme, ZIP) disparaissent.

Nommage : le contrôleur restant ne s'appelle plus « rep-campaigns ». Le renommer
en `apps/api/src/modules/representants/rep-call-attempts.controller.ts` avec le
chemin `POST /v1/representants/appels` serait plus juste, mais casse la route que
le web appelle. **Décision proposée : garder le chemin `POST /v1/rep-campaigns/attempts`
inchangé au premier jet** pour ne pas casser le web et le mobile en même temps
que le reste, et poser le renommage en tâche de suite. Voir question ouverte
Q3 (§7).

#### Rappels — `apps/api/src/modules/callbacks/callbacks.controller.ts`

| Route | Ligne | operationId | Rôles | Verdict |
| --- | --- | --- | --- | --- |
| `GET /phase2/callbacks` | `:31` | `listScheduledCallbacks` | ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION | **Transformer** : le `CallbackDto` perd `campaignId` (`apps/api/src/modules/callbacks/dto.ts:53`) et `taskId` (`:54`). Le reste de la file est inchangé. |
| `POST /phase2/callbacks/{id}/cancel` | `:48` | `cancelScheduledCallback` | ADMIN, COMMERCIAL | **Transformer** : même retrait de champs dans la réponse. |

Le `CALLBACK_SELECT` de `apps/api/src/modules/callbacks/callbacks.service.ts:26`
sélectionne `campaignId:32` et `taskId:33`, recopiés dans `toDto` `:49` et
`:50`. Ces quatre lignes tombent.

Note de vocabulaire : ces deux routes vivent sous le préfixe `phase2/callbacks`
alors qu'elles n'ont rien de campagne. Elles peuvent rester là (aucun coût), ou
migrer vers `/v1/rappels`. Voir Q3.

#### Statistiques — `apps/api/src/modules/analytics/analytics.controller.ts`

| Route | Ligne | operationId | Verdict |
| --- | --- | --- | --- |
| `GET /analytics/campaign-pilotage` | `:198` | `getCampaignPilotage` | **Supprimer.** Tout son contenu compte des tâches : `tasks`, `tasksContacted`, `contactRate`, `closedPerDay`, `remaining`, `observedPace`, `estimatedEndDate` (`apps/api/src/modules/analytics/pilotage.dto.ts:17` à `:96`). Les deux mesures qui survivent (`attempts`, `reachableAttempts`, `reachRate`, `methodsObtained`, `attemptsPerMethodObtained`) sont déjà rendues par `GET /supervision/activite`. |
| `GET /analytics/delays` | `:216` | `getAnalyticsDelays` | **Garder tel quel** : `PilotageService.delays` (`pilotage.service.ts:138`) ne lit ni tâche ni campagne. |
| Les 24 autres routes `analytics/*` | — | — | **Garder**, sous réserve du changement de portée (§2.4) : aucune ne joint `call_tasks` en dehors de `porteeProspect` et `campaignCondition`. |

#### Supervision — `apps/api/src/modules/analytics/supervision.controller.ts`

| Route | operationId | Verdict |
| --- | --- | --- |
| `GET /supervision/activite` | `getSupervisionActivite` | **Transformer** (détail §2.5). |

#### Administration — `apps/api/src/modules/admin/admin.controller.ts`

| Route | operationId | Verdict |
| --- | --- | --- |
| `GET /admin/supervision` | `getSupervision` | **Garder tel quel.** Vérifié ligne à ligne : `apps/api/src/modules/admin/supervision.service.ts` ne lit ni `callTask` ni `callCampaign` ; sa présence se calcule sur `refreshToken`, `syncBatch`, `callAttempt`, `bankCaseTransition` et `agentHeartbeat` (`:95` à `:129`). |
| `GET /admin/purge`, `POST /admin/purge` | `getPurgeCatalog`, `purgeDatabase` | **Transformer** : le catalogue de purge nomme les tables supprimées (§2.7). |

#### Prospects et représentants

Aucune route à supprimer. Deux filtres de requête disparaissent du contrat
(`campaignId`, `assignedToId`) : voir §2.4.

### 2.3 Synchronisation mobile

Fichiers :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/sync/sync.service.ts`,
`.../sync/dto.ts`, `.../sync/cursor.ts`, `.../sync/sync.controller.ts`.

#### Flux du `GET /v1/sync/pull`

| Ligne | Élément | Verdict |
| --- | --- | --- |
| `cursor.ts:22` | flux `callCampaigns` dans `SYNC_STREAMS` | **Supprimer** |
| `cursor.ts:23` | flux `callTasks` | **Supprimer** |
| `cursor.ts:24` | flux `repCallCampaigns` | **Supprimer** |
| `cursor.ts:25` | flux `repCallTasks` | **Supprimer** |
| `sync.service.ts:1140` | lecture `callCampaign.findMany`, bornée par `tasks: { some: { assignedToId } }` `:1143` | **Supprimer** |
| `sync.service.ts:1155` | lecture `callTask.findMany`, bornée par `assignedToId` `:1158` | **Supprimer** |
| `sync.service.ts:1166` | lecture `repCallCampaign.findMany`, bornée par `commerciaux: { some: { userId } }` `:1169` | **Supprimer** |
| `sync.service.ts:1177` | lecture `repCallTask.findMany` `:1180` | **Supprimer** |
| `sync.service.ts:1282` à `:1317` | les quatre tableaux de la réponse | **Supprimer** |
| `dto.ts:674` | `SyncCallCampaignDto` | **Supprimer** |
| `dto.ts:686` | `SyncCallTaskDto` | **Supprimer** |
| `dto.ts:707` | `SyncRepCallCampaignDto` | **Supprimer** |
| `dto.ts:709` | `SyncRepCallTaskDto` | **Supprimer** |
| `dto.ts:778` à `:782` | les quatre champs de `SyncChangesDto` | **Supprimer** |

Le mobile continue de recevoir : référentiels, annuaire des représentants,
prospects de sa portée, registre des visites. Les rappels (`ScheduledCallback`)
ne descendent PAS par le pull aujourd'hui — ils sont servis par
`GET /v1/phase2/callbacks` en ligne ; ce plan ne change pas ce choix.

#### Tombstones

Il n'existe pas de tombstone pour les tâches. Le mécanisme actuel est décrit à
`sync.service.ts:1151` : la tâche retirée descendait une dernière fois avec
`isActive = false` et le client l'effaçait lui-même. Les seules suppressions
transportées sont celles des représentants et des prospects
(`sync.service.ts:1212` à `:1229`, `SyncDeletionDto` à `dto.ts:786`). Elles
restent inchangées.

**Conséquence pour le mobile** : après ce chantier, le téléphone garde en base
locale des campagnes et des tâches qu'aucun flux ne viendra plus contredire.
Le nettoyage est un `DELETE FROM` local à la migration Drift, donc du ressort du
plan mobile. L'API n'a rien à émettre pour cela.

#### Compatibilité du contrat de pull

`SyncChangesDto.callCampaigns` et les trois autres champs sont engendrés en Dart
avec `required: true` :
`packages/api-client-dart/lib/src/model/sync_changes_dto.dart:87`. Retirer les
champs fait **échouer le décodage JSON** sur tout APK déjà déployé.

Le garde-fou existe déjà : `apps/api/src/modules/sync/sync.controller.ts:29`
déclare `MIN_PULL_PAYLOAD_VERSION = 4`, et `:154` refuse en `426 APP_UPDATE_REQUIRED`
tout client qui annonce moins. La poussée reste ouverte pendant ce refus
(`:143`), donc rien de ce qui est saisi hors ligne n'est perdu.

**Décision : passer `MIN_PULL_PAYLOAD_VERSION` à 5** dans le même changement que
le retrait des quatre flux. Un APK ancien reçoit alors un message clair et
continue de remonter ses saisies. L'alternative — garder les quatre champs
toujours vides — laisserait quatre tableaux morts dans le contrat et dans les
deux clients engendrés, pour un bénéfice nul une fois l'APK poussé.

#### Poussée (`POST /v1/sync/push`)

La tentative d'appel poussée par le mobile **ne porte pas de `taskId`** : le
`SyncEntityDataDto` (`sync/dto.ts:103`) n'en a pas, et le serveur résout
lui-même la tâche active. Le corps de la requête ne change donc PAS.

Ce qui change dans le traitement :

| Fichier:ligne | Élément | Verdict |
| --- | --- | --- |
| `sync.service.ts:803` à `:818` | Garde d'autorisation de la tentative : le prospect doit être à soi OU porter une tâche à soi (`:807`) | **Transformer** : la garde devient la nouvelle portée (§2.4). |
| `sync.service.ts:1006` à `:1022` | `assertProspectWritable`, se rabat sur `callTask.findFirst` `:1012` | **Transformer** |
| `sync.service.ts:720` à `:740` | `assertRepresentantWritable`, se rabat sur `callTask.findFirst` `:726` | **Transformer** |
| `sync.service.ts:186` | `assignedTo(userId)` filtre `CallTaskListRelationFilter` | **Supprimer** |
| `sync.service.ts:202` à `:213` | `mineOrAssignedRepresentant` : `ANNUAIRE_ROLES` reçoit déjà tout l'annuaire (`:205`), la branche `else` cite deux fois les tâches (`:210`, `:211`) | **Simplifier** : l'annuaire est commun, la branche restrictive ne concerne plus que `BANQUE_FINANCE` et `ACCUEIL`. |
| `phase2-sync.service.ts:104` à `:119` | Lecture de la tentative connue avec `taskId`, puis `callTask.findFirst` de la tâche active | **Transformer** |
| `phase2-sync.service.ts:128` | `const projet = activeTask?.campaign.projet ?? prospect.projet` | **Transformer** : sans campagne, le projet vient de la fiche seule. Voir Q1 (§7), qui bloque. |
| `phase2-sync.service.ts:139`, `:140` | Écriture de `taskId` et `campaignId` sur la tentative | **Supprimer** |
| `phase2-sync.service.ts:246`, `:247` | Écriture de `taskId` et `campaignId` sur le rappel | **Supprimer** |
| `phase2-sync.service.ts:295` à `:298` | Clôture des tâches actives du prospect à l'issue terminale | **Supprimer** |
| `phase2/dto.ts:596`, `:604` | `CallAttemptResultDto.taskId`, `.taskStatus` | **Supprimer**. Ce DTO n'apparaît PAS dans `openapi.json` (vérifié : seul `RepCallAttemptResultDto` y figure, à la ligne 23947) : le retrait n'a pas d'impact contractuel. |

### 2.4 Règles de portée

#### Ce qui existe

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/common/scope.ts`

| Ligne | Fonction | Règle actuelle |
| --- | --- | --- |
| `:38` | `mineOrAssignedProspect(userId)` | `createdById = userId` OU `callTasks.some(assignedToId = userId, isActive)` |
| `:46` | `prospectReadScope(user)` | Supervision et direction : tout. Autres : `mineOrAssignedProspect`. |
| `:55` | `prospectSyncScope(user)` | Admin : tout. Autres : `mineOrAssignedProspect`. |
| `:20` | `ownerScope`, `:25` `readScope`, `:80` `manageScope` | `createdById` seul, aucune tâche. **Inchangés.** |

Chaque endroit où `call_tasks` ou `assignedToId` entre dans un `WHERE` :

| Fichier:ligne | Contexte |
| --- | --- |
| `apps/api/src/common/scope.ts:41` | `mineOrAssignedProspect` |
| `apps/api/src/common/prospect-where.ts:21` | Injection de `prospectReadScope` dans le `AND` |
| `apps/api/src/common/prospect-where.ts:78` à `:87` | Filtres publics `campaignId` et `assignedToId` |
| `apps/api/src/modules/analytics/analytics.sql.ts:17` | Appel de `porteeProspect` |
| `apps/api/src/modules/analytics/analytics.sql.ts:44` à `:49` | `porteeProspect` : `EXISTS (SELECT 1 FROM "call_tasks" ...)` |
| `apps/api/src/modules/analytics/analytics.sql.ts:107` à `:120` | `campaignCondition` |
| `apps/api/src/modules/analytics/pilotage.service.ts:52`, `:89` | `INNER JOIN "call_tasks"` |
| `apps/api/src/modules/analytics/supervision.service.ts:107`, `:170`, `:301` | `taskScope`, `FROM "call_tasks"`, `LEFT JOIN "call_tasks"` |
| `apps/api/src/modules/sync/sync.service.ts:187`, `:210`, `:211`, `:726`, `:807`, `:1013`, `:1143`, `:1158`, `:1180` | Portées et gardes de synchronisation |
| `packages/database/src/segment.ts:124` | `callTasks: { none: { isActive: true } }` |
| `apps/api/src/modules/notifications/reminders.service.ts:175` à `:181` | `groupBy assignedToId` sur les tâches ouvertes |
| `apps/api/src/modules/users/users.service.ts:314` à `:321` | Reprise du portefeuille : réassignation des tâches |
| `apps/api/src/modules/prospects/prospects.service.ts:103`, `:663` | Fermeture et fusion de fiches |

#### Portée cible

**Lecture des prospects, tous rôles terrain : toute la base.** Un téléconseiller
cherche librement, il n'a plus de file. Concrètement :

- `mineOrAssignedProspect` disparaît.
- `prospectReadScope(user)` rend `{}` pour tous les rôles qui atteignent la
  liste des prospects (ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION). La fonction
  devient inutile : les appelants passent à `{}` et la fonction est retirée si
  plus personne ne l'appelle (vérifier avec `pnpm dead-code`).
- `porteeProspect` (`analytics.sql.ts:44`) disparaît, et la condition `:16` à
  `:18` de `prospectConditions` tombe : plus aucune borne par appelant sur les
  agrégats prospects.
- **Écriture** : inchangée. `assertOwnership` (`scope.ts:96`) et
  `assertManageable` (`scope.ts:85`) restent tels quels. Un téléconseiller
  modifie ses fiches ; il consigne des appels et des rappels sur n'importe
  quelle fiche (c'est le geste métier voulu), ce que porte déjà la table
  `call_attempts` en ajout seul avec `performedById`.

**Portée de synchronisation mobile** : voir Q2 (§7), qui bloque. Deux issues
possibles, aux conséquences très différentes en volume de données sur
l'appareil.

**Le test de balayage d'autorisation change de sens.**
`apps/api/src/modules/analytics/authorization.sweep.test.ts:114` exige
aujourd'hui que CHAQUE trace SQL d'une route d'analytics contienne l'identifiant
du téléconseiller appelant. Avec la nouvelle portée, l'assertion s'inverse
exactement : plus aucune route ne doit borner sur l'appelant. Le test à
`:142` (« un SUPERVISEUR n'est borné sur personne ») devient la règle générale.
**Ne pas supprimer ce fichier : le retourner.** Un balayage qui ne vérifie plus
rien est pire que pas de balayage.

### 2.5 Statistiques et supervision

#### `PilotageService.campaignPilotage`

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/analytics/pilotage.service.ts:16`
à `:136`. **Supprimer la méthode**, la route `:198` de `analytics.controller.ts`,
et les DTO `CampaignClosedDayDto` / `CampaignPilotageDto`
(`apps/api/src/modules/analytics/pilotage.dto.ts:3` et `:17`).

Motif : `taches` (`:66`), `restantes` (`:68`), `closes7` (`:70`), `closedPerDay`
(`:82` à `:96`), `remaining`, `observedPace`, `estimatedEndDate` (`:250`)
comptent tous des lignes de `call_tasks`. Sans tâches, la « fin projetée » n'a
plus de dénominateur : un lot d'export n'est pas un travail à solder.

Ce qui doit rester lisible et l'est déjà ailleurs : le nombre d'appels, la part
d'appels joignables et le nombre de méthodes obtenues sont rendus par
`GET /supervision/activite` (`supervision.service.ts:131` à `:148`, champs
`calls`, `reachRate`, `methodObtained`). **Ne pas recréer un endpoint pour
cela.**

#### `SupervisionActivityService.activite`

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/analytics/supervision.service.ts`

| Ligne | Élément | Verdict |
| --- | --- | --- |
| `:103` à `:107` | `campaign(column)` et `taskScope` | **Supprimer** |
| `:112` à `:115` | `repScope` bâti sur `rca."campaignId"` | **Transformer** : ne garder que la borne projet (`Projet.GRAND_PUBLIC` → `FALSE`). |
| `:106` | `attemptScope` sur `ca."campaignId"` | **Supprimer**, remplacer par `TRUE` (`ALL_ROWS`). |
| `:166` à `:173` | Quatrième branche du `UNION ALL`, qui compte les tâches closes | **Supprimer** |
| `:145`, `:169`, `:228`, `:270` | Colonne `tache` / agrégat `taches` | **Supprimer** |
| `:294` à `:306` | Requête `roster` avec `LEFT JOIN "call_tasks"` et `COUNT(ct."id") AS ouvertes` | **Transformer** : la liste des téléconseillers reste (elle sert à repérer les agents muets, cf. `reminders.service.ts:265`), mais le compte de tâches ouvertes tombe ; la requête devient un simple `SELECT id, fullName, isActive FROM users WHERE <teleconseiller>`. |
| `:357` | `openTasks: row.ouvertes` | **Supprimer** |
| `:377` | `tasksClosed: base.taches` | **Supprimer** |

DTO correspondants,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/analytics/supervision.dto.ts` :

| Ligne | Champ | Verdict |
| --- | --- | --- |
| `:58` à `:66` | `SupervisionQueryDto.campaignId` | **Supprimer** |
| `:101` à `:102` | `SupervisionActivityCountsDto.tasksClosed` | **Supprimer** |
| `:190` à `:194` | `SupervisionTeleconseillerDto.openTasks` | **Supprimer** |

Remplacement : **compter des appels et des fiches, pas des tâches.** Les colonnes
qui restent (`calls`, `unreachable`, `wrongNumber`, `refused`, `other`,
`methodObtained`, `callback`, `reachRate`, `prospectsCreated`,
`representantsContacted`, plus le bloc `rep*`) suffisent et couvrent déjà le
besoin. **Ne pas ajouter de colonne neuve dans ce chantier.**

Attention : ce fichier est en cours de modification par un autre agent
(`git status` le marque `M`, et
`apps/api/src/modules/analytics/supervision-qualification.integration.test.ts`
est un ajout non commité). Relire l'état réel avant d'éditer et préserver son
travail.

#### Autres services d'analytics

Vérifié par lecture : `quality.service.ts`, `funnel.service.ts`,
`portfolio.service.ts`, `segment-conversions.service.ts` et
`analytics.service.ts` ne référencent ni `callTask`, ni `campaignId`, ni
`assignedToId`. **Ils ne changent que par ricochet**, via `prospectConditions`
(`analytics.sql.ts:10`) qui perd `porteeProspect` et `campaignCondition`.

### 2.6 Rappels et notifications

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/notifications/reminders.service.ts`

| Ligne | Élément | Verdict |
| --- | --- | --- |
| `:41` | Clé `OPEN_CALL_TASKS: 'open-call-tasks'` | **Supprimer** |
| `:42` | Clé `OPEN_REP_CALL_TASKS: 'open-rep-call-tasks'` | **Supprimer** |
| `:59` à `:65` | Interface `OpenTaskDelegate` | **Supprimer** |
| `:128`, `:129` | Appels dans `runAll` | **Supprimer** ; `runs` (`:134`) passe de cinq à trois éléments. |
| `:141` à `:161` | `remindOpenCallTasks`, `remindOpenRepCallTasks` | **Supprimer** |
| `:163` à `:198` | `remindOpenTasks` | **Supprimer** |
| `:205` à `:225` | `remindDueCallbacks` | **Garder tel quel** : groupe sur `scheduledCallback.assignedToId`, sans tâche ni campagne. |
| `:239` à `:280` | `sendDailyReport` | **Transformer** : il lit `activity.teleconseillers` (`:265`), qui reste, mais ne doit plus lire de compteur de tâches. Vérifier ligne à ligne après le retrait de `openTasks`. |
| `:196` | `category: NotificationCategory.CAMPAGNE` | Utilisée seulement par les rappels de tâches supprimés. L'enum `NotificationCategory` est exposé au contrat (`schema.prisma:1516`) : **le laisser en place**, le vider de son seul usage ne justifie pas une migration d'enum PostgreSQL. |

Variables d'environnement devenues mortes :
`NOTIFICATIONS_OPEN_TASKS_ENABLED` et `NOTIFICATIONS_OPEN_TASKS_MIN`
(lues à `reminders.service.ts:172` et `:185`). Les retirer de
`apps/api/src/modules/notifications/notifications.env.ts` et de
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/.env.example`
(fichier déjà modifié par un autre agent : relire avant d'éditer).

Aucune autre notification, aucun gabarit et aucun envoi d'e-mail ne parle de
campagne ou de tâche : vérifié sur `notifications.service.ts`, `audience.ts`,
`templates.service.ts` et `dto.ts` du module.

### 2.7 Exports et lot d'export

#### Ce qui existe déjà et qui est réutilisable

| Fichier | Ligne | Élément |
| --- | --- | --- |
| `apps/api/src/modules/export/export.controller.ts` | `:42` | `GET /export/prospects.xlsx`, filtres = `ProspectFilterDto` étendu (`export/dto.ts:13`), deux modes (`filtered`, `consolidated`) |
| `apps/api/src/modules/export/export.controller.ts` | `:197` | `GET /export/representants.xlsx`, filtres = `RepresentantExportQueryDto` |
| `apps/api/src/modules/export/representants-export.service.ts` | `:112` | Écriture en flux avec `ExcelJS.stream.xlsx.WorkbookWriter`, pagination keyset par `id asc`, jamais plus de 500 lignes en mémoire |
| `apps/api/src/modules/export/representants-export.service.ts` | `:52` | `EXPORT_COLUMNS` : nom, téléphone, département, IEF, commercial, prospects, notes, dates |
| `apps/api/src/modules/phase2/programme-pdf.ts` | `:360` | `RepProgrammeData` et `writeRepProgrammePdf`, A4, 25 lignes par page |

**Toute la mécanique de classeur existe.** Le lot d'export ne réécrit pas
d'export : il fige une liste d'identifiants, puis rejoue l'écriture existante
bornée à cette liste.

#### Écart à combler sur les filtres d'export

`RepresentantExportQueryDto`
(`apps/api/src/modules/representants/dto.ts:190`) porte `search`,
`departementId`, `iefId`, `commercialId`, `dateFrom`, `dateTo`, `hasProspects`.
Il **ne porte pas** `relationStatus` ni `whatsappStatus`, alors que
`RepresentantQueryDto` (`:238`) les porte pour la liste (`:246`, `:255`,
`:265`).

Or la cible d'un lot est décrite par le propriétaire comme incluant « statut de
relation des représentants ». **Ajouter `relationStatus`, `whatsappStatus` et
`hasWhatsapp` à `RepresentantExportQueryDto`**, ce qui aligne l'export sur
l'écran — invariant que le dépôt tient déjà pour les visites et les prospects
(`export.controller.ts:194` le dit : « Plus étroit que `GET /representants`,
jamais plus large »). Le test de contrat
`apps/api/src/modules/export/openapi-contract.test.ts:60` liste les filtres
attendus : y ajouter les trois nouveaux.

#### Catalogue de purge

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/admin/purge-plan.ts`

| Ligne | Élément | Verdict |
| --- | --- | --- |
| `:10` | Étape `callTasks` | **Supprimer**, remplacer par les nouvelles étapes de lot |
| `:17` | Étape `repCallTasks` | **Supprimer** |
| `:108` | `steps: ['scheduledCallbacks', 'callTasks']` | **Transformer** |
| `:125` | Bloc citant `repCallTasks` | **Transformer** |
| `purge-steps.ts:52` à `:90` | Six étapes : `callTasks`, `callCampaignCommerciaux`, `callCampaigns`, `repCallTasks`, `repCallCampaignCommerciaux`, `repCallCampaigns` | **Supprimer les six**, ajouter deux étapes `lotExportItems` et `lotsExport` |

#### Espace de démonstration

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/database/src/demo-workspace-factory.ts:121`
à `:160` crée deux campagnes de démonstration avec leurs commerciaux et leurs
tâches. **Supprimer ce bloc.** L'espace démo garde ses prospects, ses
représentants et ses tentatives d'appel.
`apps/api/src/modules/demo/demo.service.ts:32` compte les campagnes dans l'état
de l'espace : retirer cette ligne du décompte.

### 2.8 Tests touchés

| Fichier | Verdict |
| --- | --- |
| `apps/api/src/modules/phase2/campaigns.service.test.ts` | **Supprimer** avec le service. |
| `apps/api/src/modules/phase2/phase2-sync.service.test.ts` | **Transformer** : retirer les cas de clôture de tâche, garder ceux d'idempotence, de conflit `PHASE2_ALREADY_COMPLETED`, de rappel promis et de correction de fiche. |
| `apps/api/src/modules/phase2/distribution.test.ts`, `.../programme-pdf.test.ts`, `.../directory-cursor.test.ts` | Les deux premiers **disparaissent avec leur code** ; le troisième reste (l'annuaire hors ligne reste). |
| `apps/api/src/modules/rep-campaigns/rep-campaigns.service.test.ts` (45,9 Ko) | **Transformer** : ne garder que les cas de `recordAttempt` (idempotence, commentaire obligatoire, `callbackAt`, suggestion de numéro, bascule de relation, WhatsApp). |
| `apps/api/src/modules/rep-campaigns/rep-campaigns.integration.test.ts` | **Transformer** de même. |
| `apps/api/src/modules/sync/sync.service.test.ts`, `.../sync.integration.test.ts`, `.../fake-prisma.ts`, `.../cursor.test.ts`, `.../dto.test.ts` | **Transformer** : retirer les quatre flux, les délégués `callTask`/`callCampaign`/`repCallTask`/`repCallCampaign` du faux Prisma (`fake-prisma.ts:43`, `:44`), et les positions de curseur correspondantes. Ajouter un cas : un client qui annonce `X-CPI-Payload-Version: 4` reçoit 426. |
| `apps/api/src/modules/prospects/portee-lecture.integration.test.ts` | **Réécrire** : ce test prouve aujourd'hui qu'une fiche confiée par tâche est lisible (`:80` à `:94`, `:132`). Il doit prouver la nouvelle règle : toute fiche est lisible par un téléconseiller, et l'écriture reste bornée au propriétaire. |
| `apps/api/src/modules/prospects/phase2-surface.integration.test.ts` | **Transformer** : retirer les 4 blocs de campagne (`:134`, `:171`, `:367`, `:392`, `:415`). |
| `apps/api/src/modules/prospects/filter-consistency.test.ts` | **Transformer** : retirer `campaignId` (`:47`) et `assignedToId` (`:48`) de la matrice, ainsi que les attentes SQL `:105` et `:113`. |
| `apps/api/src/common/prospect-where.test.ts` | **Transformer** : mêmes retraits. |
| `apps/api/src/modules/analytics/authorization.sweep.test.ts` | **Retourner** (voir §2.4), pas supprimer. |
| `apps/api/src/modules/analytics/pilotage.service.test.ts` | **Transformer** : ne garder que `delays`. |
| `apps/api/src/modules/analytics/supervision.service.test.ts` | **Transformer** : retirer `tasksClosed`, `openTasks`, `campaignId`. |
| `apps/api/src/modules/analytics/lot-j.integration.test.ts:35`, `.../lot-j-chiffres.integration.test.ts` | **Transformer** : retirer les assertions sur `campaignPilotage`. |
| `apps/api/src/modules/notifications/reminders.service.test.ts` (31,4 Ko) | **Transformer** : retirer les cas de rappel de tâches ouvertes, garder ceux de rappels dus et de dossiers bancaires. |
| `apps/api/src/modules/notifications/fake-prisma.ts` | **Transformer** : retirer les délégués de tâches. |
| `apps/api/src/modules/users/users.service.test.ts` | **Transformer** : la reprise de portefeuille ne réassigne plus de tâche. |
| `apps/api/src/modules/admin/purge-plan.test.ts`, `.../purge.service.test.ts`, `.../purge.integration.test.ts` | **Transformer** : nouveau catalogue d'étapes. |
| `apps/api/src/common/guards/role-routes.test.ts` | **Transformer** : retirer `Phase2Controller.getCampaign` (`:161`), `.listCampaigns` (`:162`), `.downloadProgramme` (`:163`), `RepCampaignsController.get` (`:182`), `.list` (`:183`), `.downloadProgramme` (`:184`), `.downloadProgrammes` (`:185`), `AnalyticsController.campaignPilotage` (`:131`) ; ajouter les nouvelles routes de lot. Ce test est un inventaire exhaustif : il rougira tant qu'il ne sera pas exact. |
| `apps/api/src/modules/export/openapi-contract.test.ts` | **Transformer** : ajouter les trois filtres de relation, ajouter les routes de lot. |
| `packages/database/src/segment.test.ts` | **Transformer** : retirer les cas de `scopeWhere` et `eligibleForCampaignWhere`. |

Tests **à écrire** : voir §6.

## 3. État cible

### 3.1 Modèle de données cible

Ajouter à la fin de
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/database/prisma/schema.prisma`,
après le bloc du registre des visites :

```prisma
enum LotExportCible {
  REPRESENTANTS
  PROSPECTS
}

/// Un lot d'export fige la liste des fiches téléchargées un jour donné.
///
/// La liste est PERSISTÉE et non recalculée : rejouer les filtres un mois plus
/// tard rendrait un autre ensemble, et le suivi porterait alors sur des fiches
/// que personne n'a jamais reçues.
model LotExport {
  id     String         @id @default(uuid(7))
  name   String
  cible  LotExportCible
  projet Projet?

  /// Les filtres tels qu'ils ont été saisis, pour relire la cible d'un lot.
  filters   Json
  itemCount Int

  createdById String
  createdBy   User   @relation("LotExportCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())

  items LotExportItem[]

  @@index([cible, createdAt])
  @@index([createdById, createdAt])
  @@map("lots_export")
}

model LotExportItem {
  lotId String
  lot   LotExport @relation(fields: [lotId], references: [id], onDelete: Cascade)

  representantId String?
  representant   Representant? @relation(fields: [representantId], references: [id], onDelete: Cascade)
  prospectId     String?
  prospect       Prospect?     @relation(fields: [prospectId], references: [id], onDelete: Cascade)

  position Int

  @@id([lotId, position])
  @@index([representantId])
  @@index([prospectId])
  @@map("lot_export_items")
}
```

Contrainte à poser en SQL brut dans la migration, Prisma ne sachant pas
l'exprimer, sur le modèle de ce que le dépôt fait déjà pour les index partiels
(`schema.prisma:16`) :

```sql
ALTER TABLE "lot_export_items"
  ADD CONSTRAINT "lot_export_items_une_seule_cible"
  CHECK (num_nonnulls("representantId", "prospectId") = 1) NOT VALID;
```

Relations inverses à ajouter : `User.lotsExport LotExport[] @relation("LotExportCreatedBy")`,
`Representant.lotItems LotExportItem[]`, `Prospect.lotItems LotExportItem[]`.

Une seule paire de tables pour les deux cibles, et non deux paires : le
commentaire de `schema.prisma:1146` justifiait la séparation des deux familles de
campagne par l'invariant « une seule tâche active par prospect », qui disparaît.
Un lot ne porte aucun invariant métier : il n'y a plus rien à séparer.

### 3.2 Contrats OpenAPI cibles

Nouveau module `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/lots-export/`
avec `lots-export.module.ts`, `lots-export.controller.ts`,
`lots-export.service.ts`, `dto.ts`.

#### `POST /api/v1/lots-export` — `createLotExport`

Rôles : `ADMIN`. Réponse `201`.

```ts
export class CreateLotExportDto {
  name: string;                          // 3..120
  cible: LotExportCible;                 // REPRESENTANTS | PROSPECTS
  representants?: RepresentantExportQueryDto;  // requis si cible = REPRESENTANTS
  prospects?: ProspectFilterDto;               // requis si cible = PROSPECTS
}
```

Comportement : une transaction unique. Elle lit les identifiants ciblés en
`orderBy: { id: 'asc' }`, écrit `LotExport` puis les `LotExportItem` par paquets
de 5 000 (`createMany`, valeur reprise de `campaigns.service.ts:48`), et
renseigne `itemCount`. `filters` reçoit le DTO de filtre tel quel, sérialisé.
Erreur `422 LOT_EXPORT_CIBLE_VIDE` quand aucun identifiant ne sort.

Bornes : la transaction porte `timeout: 120_000` et `maxWait: 15_000`, valeurs
déjà éprouvées sur ce volume (`campaigns.service.ts:44`, `:45`).

#### `GET /api/v1/lots-export/apercu` — `previewLotExport`

Rôles : `ADMIN`. Mêmes paramètres de requête que la création, aplatis en query.
Rend `{ eligible: number, scopeLabel: string }`. Remplace
`GET /rep-campaigns/preview` (`rep-campaigns.controller.ts:71`) en lui retirant
`perCommercial` et `perDay`.

#### `GET /api/v1/lots-export` — `listLotsExport`

Rôles : `ADMIN`, `SUPERVISEUR`, `DIRECTION`. Filtres : `cible`, `createdById`,
`dateFrom`, `dateTo`, `search`, `page`, `pageSize` (repris de
`RepCampaignQueryDto`, `apps/api/src/modules/rep-campaigns/dto.ts:232`).

```ts
export class LotExportSummaryDto {
  id: string;
  name: string;
  cible: LotExportCible;
  projet: Projet | null;
  scopeLabel: string;          // libellé lisible de la cible
  itemCount: number;
  createdById: string;
  createdByName: string;
  createdAt: string;
  callsSince: number;          // appels consignés sur les fiches du lot depuis createdAt
  fichesAppelees: number;      // fiches distinctes du lot ayant reçu au moins un appel
}
```

`callsSince` se calcule en une requête, sans stockage :

```sql
SELECT COUNT(*)::int                       AS appels,
       COUNT(DISTINCT a."representantId")::int AS fiches
FROM "lot_export_items" i
INNER JOIN "rep_call_attempts" a
  ON a."representantId" = i."representantId"
 AND a."clientCreatedAt" >= l."createdAt"
WHERE i."lotId" = l."id"
```

et son pendant sur `call_attempts` / `prospectId` pour la cible `PROSPECTS`.

#### `GET /api/v1/lots-export/{id}` — `getLotExport`

Rôles : `ADMIN`, `SUPERVISEUR`, `DIRECTION`. Rend `LotExportSummaryDto` plus la
ventilation des appels par téléconseiller depuis la création du lot.
`404 LOT_EXPORT_NOT_FOUND`.

#### `GET /api/v1/lots-export/{id}/export.xlsx` — `downloadLotExportXlsx`

Rôles : `ADMIN`, `SUPERVISEUR`, `DIRECTION`. Produit `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
déclaré en binaire dans le contrat (`{ type: 'string', format: 'binary' }`),
sans quoi le générateur Dart désérialise le classeur en JSON — piège déjà
documenté à `export.controller.ts:62`.

Implémentation : réutiliser `RepresentantsExportService.writeRepresentants`
(`representants-export.service.ts:112`) et `ExportService.writeProspects` en
leur passant, au lieu du `where` de filtre, un `where` borné aux identifiants du
lot. Poser l'en-tête `X-CPI-Demo-Mode` par `setDemoHeader`
(`apps/api/src/modules/export/demo-marking.ts`) comme les autres exports.

#### `GET /api/v1/lots-export/{id}/liste.pdf` — `downloadLotExportPdf` (facultatif)

Rôles : `ADMIN`, `SUPERVISEUR`, `DIRECTION`, cible `REPRESENTANTS` seulement.
Réutilise `writeRepProgrammePdf` (`apps/api/src/modules/phase2/programme-pdf.ts:360`)
avec `campaignName` = nom du lot, `commercialName` = nom du créateur, sans
découpage par journée. **À ne faire qu'après le reste** : le classeur est le
livrable demandé, le PDF est un confort.

#### Routes et champs retirés du contrat

Quatorze routes disparaissent : `listCallCampaigns`, `createCallCampaign`,
`getCallCampaign`, `closeCallCampaign`, `pauseCallCampaign`,
`resumeCallCampaign`, `downloadCallProgrammePdf`, `listRepCampaigns`,
`createRepCampaign`, `getRepCampaign`, `closeRepCampaign`,
`downloadRepProgrammePdf`, `downloadRepProgrammesZip`, `getCampaignPilotage`.
Une quinzième, `previewRepCampaign`, est remplacée par `previewLotExport`.
Cinq routes apparaissent : `createLotExport`, `previewLotExport`,
`listLotsExport`, `getLotExport`, `downloadLotExportXlsx`, plus
`downloadLotExportPdf` si l'étape facultative est faite.

Champs retirés de DTO conservés : `CallbackDto.campaignId`, `.taskId` ;
`RepCallAttemptResultDto.taskId`, `.taskClosed` ;
`SupervisionActivityCountsDto.tasksClosed` ;
`SupervisionTeleconseillerDto.openTasks` ;
`SupervisionQueryDto.campaignId` ;
`ProspectFilterDto.campaignId`, `.assignedToId` ;
`SyncChangesDto.callCampaigns`, `.callTasks`, `.repCallCampaigns`, `.repCallTasks`.

Enums retirés du contrat : `CampaignScope`, `CampaignStatus`, `CallTaskStatus`.
Enum ajouté : `LotExportCible`.

### 3.3 Portée cible, résumée

| Objet | Lecture | Écriture |
| --- | --- | --- |
| Représentants (annuaire) | Tous rôles terrain : tout | Propriétaire, ou encadrement (`assertManageable`) |
| Prospects (web) | Tous rôles terrain : tout | Propriétaire, ou encadrement |
| Prospects (mobile, pull) | Voir Q2 | Propriétaire |
| Tentatives d'appel | Selon la fiche | Ajout seul, `performedById` = l'appelant, sur n'importe quelle fiche vivante |
| Rappels | Le sien, ou tout pour supervision et direction (`callbacks.service.ts:66`) | Celui qui l'a promis, ou ADMIN (`callbacks.service.ts:103`) |
| Lots d'export | ADMIN, SUPERVISEUR, DIRECTION | ADMIN |

## 4. Étapes ordonnées et exécutables

Chaque étape est autonome et vérifiable. Ne pas passer à la suivante tant que la
commande de vérification n'est pas verte. La règle « ce qui doit être rouge
avant vert » indique le signal qui prouve que l'étape mord réellement.

### Étape 0 — Point de départ vérifié

```bash
cd /Users/cheikh/Workspace/CPI/Projects/crm-monorepo
git status --porcelain
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test
```

Attendu : l'arbre porte des modifications non commitées d'autres agents ; les
tests passent. Si un test échoue déjà avant toute modification, le noter et ne
pas l'imputer à ce chantier.

### Étape 1 — Migration additive : les tables de lot

Fichiers :
- `packages/database/prisma/schema.prisma` : ajouter `LotExportCible`,
  `LotExport`, `LotExportItem` (§3.1) et les trois relations inverses.
- Nouvelle migration engendrée par Prisma, puis complétée à la main pour le
  `CHECK` (§3.1).

```bash
cd /Users/cheikh/Workspace/CPI/Projects/crm-monorepo
pnpm db:migrate     # prisma migrate dev, nommer : lots_export
pnpm db:generate
pnpm --filter @crm/database typecheck
```

Rouge avant vert : sans le `CHECK`, insérer un `LotExportItem` avec les deux
identifiants nuls doit être accepté par la base — c'est ce que la contrainte
doit refuser. Le vérifier à la main sur la base de développement.

**Aucune suppression à cette étape.** Rien ne casse : l'API ne connaît pas
encore ces tables.

### Étape 2 — Le module de lot d'export

Fichiers à créer sous
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/lots-export/` :
`dto.ts`, `lots-export.service.ts`, `lots-export.controller.ts`,
`lots-export.module.ts`, `lots-export.service.test.ts`.

Fichiers à modifier :
- `apps/api/src/app.module.ts` : déclarer `LotsExportModule` dans `imports`, à
  côté de `RepCampaignsModule` (`:86`).
- `apps/api/src/modules/representants/dto.ts:190` : ajouter `relationStatus`,
  `whatsappStatus`, `hasWhatsapp` à `RepresentantExportQueryDto` (les décorateurs
  se recopient depuis `RepresentantQueryDto`, `:246`, `:255`, `:265`).
- `apps/api/src/modules/export/representants-export.service.ts:186` : porter les
  trois nouveaux filtres dans `buildWhere`, et accepter un mode « borné à une
  liste d'identifiants ».
- `apps/api/src/common/guards/role-routes.test.ts` : inscrire les routes de lot
  ouvertes au SUPERVISEUR et à la DIRECTION dans `ADMISES` (`:118`) et
  `ADMISES_DIRECTION` (`:264`), et déclarer le nouveau contrôleur dans
  `CONTROLLERS` (`:40`).

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test -- lots-export
pnpm --filter @crm/api test -- role-routes
pnpm codegen && pnpm codegen:check
```

Rouge avant vert : `role-routes.test.ts` doit rougir dès l'ajout du contrôleur,
avant l'inscription des routes dans les inventaires. C'est la preuve que le test
d'autorisation voit bien la nouvelle surface.

### Étape 3 — La portée : plus d'assignation dans aucun `WHERE`

Fichiers :
- `apps/api/src/common/scope.ts` : supprimer `mineOrAssignedProspect` (`:38`),
  faire rendre `{}` à `prospectReadScope` (`:46`) pour tous les rôles, statuer
  sur `prospectSyncScope` (`:55`) selon Q2.
- `apps/api/src/common/prospect-where.ts` : retirer les lignes `:78` à `:87`
  (`campaignId` / `assignedToId`) et adapter `:19` à `:22`.
- `apps/api/src/common/dto/prospect-filter.dto.ts` : supprimer `campaignId`
  (`:137` à `:144`) et `assignedToId` (`:146` à `:155`).
- `apps/api/src/modules/analytics/analytics.sql.ts` : supprimer `porteeProspect`
  (`:44` à `:49`), l'appel `:16` à `:18`, `campaignCondition` (`:107` à `:120`)
  et son appel `:93` à `:94`.
- `apps/api/src/modules/analytics/authorization.sweep.test.ts` : retourner
  l'assertion `:122` à `:127` (§2.4).
- `apps/api/src/modules/prospects/filter-consistency.test.ts`,
  `apps/api/src/common/prospect-where.test.ts` : retirer les cas correspondants.

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test -- prospect-where filter-consistency authorization.sweep
```

Rouge avant vert : avant de retourner `authorization.sweep.test.ts`, il doit
rougir sur chaque route d'analytics — la portée ne borne plus, l'ancienne
assertion ne peut plus tenir. Un balayage qui reste vert après le changement de
portée ne prouve rien et doit être considéré comme cassé.

### Étape 4 — La synchronisation

Fichiers :
- `apps/api/src/modules/sync/cursor.ts:22` à `:25` : retirer les quatre flux.
- `apps/api/src/modules/sync/sync.service.ts` : retirer `assignedTo` (`:186`),
  simplifier `mineOrAssignedRepresentant` (`:202`), retirer les quatre lectures
  (`:1140`, `:1155`, `:1166`, `:1177`) et les quatre tableaux de réponse
  (`:1282` à `:1317`), remplacer les gardes `:726`, `:807`, `:1012`.
- `apps/api/src/modules/sync/dto.ts` : retirer `SyncCallCampaignDto` (`:674`),
  `SyncCallTaskDto` (`:686`), `SyncRepCallCampaignDto` (`:707`),
  `SyncRepCallTaskDto` (`:709`) et les quatre champs `:778` à `:782`.
- `apps/api/src/modules/sync/sync.controller.ts:29` : `MIN_PULL_PAYLOAD_VERSION`
  passe de 4 à 5, et la description `:124` explique le nouveau palier en une
  phrase (pas de paragraphe).
- `apps/api/src/modules/phase2/phase2-sync.service.ts` : retirer la lecture de
  tâche `:115`, le calcul de projet par campagne `:128`, les écritures `:139`,
  `:140`, `:246`, `:247`, la clôture `:295` à `:298`, et les champs `taskId` /
  `taskStatus` des résultats `:168`, `:169`, `:190`, `:191`, `:306`, `:307`.
- `apps/api/src/modules/phase2/dto.ts:596`, `:604` : retirer les deux champs.
- `apps/api/src/modules/sync/fake-prisma.ts` : retirer les délégués de tâche
  (`:43`, `:44` et leurs usages).

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test -- sync phase2-sync
pnpm codegen && pnpm codegen:check
```

Rouge avant vert : `sync.integration.test.ts` doit rougir sur l'absence des
quatre flux avant d'être mis à jour ; et un test neuf doit prouver qu'un client
annonçant `X-CPI-Payload-Version: 4` reçoit bien `426 APP_UPDATE_REQUIRED`.

### Étape 5 — Les statistiques

Fichiers :
- `apps/api/src/modules/analytics/pilotage.service.ts` : supprimer
  `campaignPilotage` (`:16` à `:136`) et `projectEnd` (`:250`).
- `apps/api/src/modules/analytics/pilotage.dto.ts` : supprimer
  `CampaignClosedDayDto` (`:3`) et `CampaignPilotageDto` (`:17`).
- `apps/api/src/modules/analytics/analytics.controller.ts:198` à `:214` :
  supprimer la route.
- `apps/api/src/modules/analytics/supervision.service.ts` : appliquer les huit
  retraits du tableau §2.5.
- `apps/api/src/modules/analytics/supervision.dto.ts` : retirer `campaignId`
  (`:58`), `tasksClosed` (`:101`), `openTasks` (`:190`).
- Tests : `pilotage.service.test.ts`, `supervision.service.test.ts`,
  `lot-j.integration.test.ts`, `lot-j-chiffres.integration.test.ts`.

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test -- analytics supervision
pnpm codegen && pnpm codegen:check
```

Rouge avant vert : `role-routes.test.ts` rougit sur
`AnalyticsController.campaignPilotage` (`:131`) tant que la ligne n'est pas
retirée de l'inventaire. C'est le signal que la route a bien disparu.

Précaution : ce fichier est en cours d'édition par un autre agent. Relire
`git diff -- apps/api/src/modules/analytics/supervision.service.ts` avant
d'écrire, et préserver son travail.

### Étape 6 — Les rappels et notifications

Fichiers :
- `apps/api/src/modules/notifications/reminders.service.ts` : retraits du
  tableau §2.6.
- `apps/api/src/modules/notifications/notifications.env.ts` : retirer
  `NOTIFICATIONS_OPEN_TASKS_ENABLED` et `NOTIFICATIONS_OPEN_TASKS_MIN`.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/.env.example` : mêmes
  retraits (fichier déjà modifié par un autre agent, relire d'abord).
- `apps/api/src/modules/notifications/reminders.service.test.ts`,
  `.../fake-prisma.ts`.
- `apps/api/src/modules/callbacks/callbacks.service.ts:32`, `:33`, `:49`, `:50`
  et `apps/api/src/modules/callbacks/dto.ts:53`, `:54`.

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test -- reminders callbacks
pnpm codegen && pnpm codegen:check
```

### Étape 7 — Les deux modules de campagne

Fichiers :
- **Supprimer** : `apps/api/src/modules/phase2/campaigns.service.ts`,
  `campaigns.service.test.ts`, `distribution.ts`, `distribution.test.ts`,
  `programme-pdf.ts`, `programme-pdf.test.ts`, `pdf-text.ts`.
- **Réduire** : `apps/api/src/modules/phase2/phase2.controller.ts` aux trois
  routes conservées (`:66`, `:96`, `:120`) ; `phase2.module.ts` perd
  `Phase2CampaignsService` (`:6`, `:15`, `:20`) ;
  `apps/api/src/modules/phase2/dto.ts` perd `CreateCampaignDto` (`:38`),
  `CampaignProgressDto` (`:109`), `CampaignCommercialDto` (`:123`),
  `CampaignAttemptDto` (`:137`), `CampaignSummaryDto` (`:189`),
  `CampaignDetailDto` (`:217`), `CampaignListDto` (`:253`),
  `CampaignQueryDto` (`:258`), `ProgrammeQueryDto` (`:323`).
- **Réduire** : `apps/api/src/modules/rep-campaigns/rep-campaigns.service.ts` à
  `recordAttempt` (`:600`) et ses aides ; supprimer la recherche de tâche
  (`:641` à `:645`), les écritures `taskId`/`campaignId` (`:655`, `:656`) et la
  clôture (`:708` à `:716`) ; `rep-campaigns.controller.ts` ne garde que
  `recordAttempt` (`:83`) ; `dto.ts` perd `CreateRepCampaignDto` (`:36`),
  `RepCampaignProgressDto` (`:111`), `RepCampaignCommercialDto` (`:125`),
  `RepCampaignAttemptDto` (`:139`), `RepCampaignSummaryDto` (`:172`),
  `RepCampaignDetailDto` (`:210`), `RepCampaignListDto` (`:227`),
  `RepCampaignQueryDto` (`:232`), `RepCampaignPreviewQueryDto` (`:278`),
  `RepCampaignPreviewDto` (`:331`), `RepProgrammeQueryDto` (`:516`), et les
  champs `taskId` (`:499`) et `taskClosed` (`:505`).
- `apps/api/src/modules/users/users.service.ts:312` à `:321` : retirer les deux
  `updateMany` de tâches ; le commentaire `:312` disparaît avec.
- `apps/api/src/modules/prospects/prospects.service.ts:103` à `:106` : retirer
  la clôture de tâche dans `closeProspectWork` ; garder l'annulation du rappel
  (`:107`). `:663` : retirer `tx.callTask.updateMany` de la fusion.
- `packages/database/src/segment.ts` : retirer `GP_TYPES` (`:82`),
  `scopeWhere` (`:89`), `eligibleForCampaignWhere` (`:116`).
- `packages/database/src/demo-workspace-factory.ts:121` à `:160` : retirer.
- `apps/api/src/modules/demo/demo.service.ts:32` : retirer le décompte.
- `apps/api/src/modules/admin/purge-plan.ts` et `purge-steps.ts` : §2.7.

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api lint
pnpm --filter @crm/api test
pnpm dead-code
pnpm codegen && pnpm codegen:check
```

Rouge avant vert : `pnpm dead-code` (knip) doit signaler tout fichier ou export
orphelin resté derrière. `role-routes.test.ts` doit être exactement à jour :
son assertion `:325` compare l'inventaire à la surface réelle, il n'y a pas de
demi-mesure.

### Étape 8 — Migration de contraction : supprimer les tables

À faire **après** que l'étape 7 est verte et déployée, pas dans le même envoi
(voir §5).

Fichiers :
- `packages/database/prisma/schema.prisma` : retirer les six modèles, les trois
  enums, les colonnes `taskId`/`campaignId` de `CallAttempt`, `RepCallAttempt`
  et `ScheduledCallback`, les index `@@index([campaignId])` (`:1085`, `:1280`),
  et les dix champs de relation du tableau §2.1.
- Migration engendrée par `pnpm db:migrate`.

```bash
pnpm db:migrate     # nommer : retrait_des_listes_d_appel
pnpm db:generate
pnpm --filter @crm/database typecheck
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test
pnpm --filter @crm/api test:integration   # exige une base PostgreSQL
```

### Étape 9 — Vérification d'ensemble

```bash
cd /Users/cheikh/Workspace/CPI/Projects/crm-monorepo
pnpm format:check
pnpm lint
pnpm dead-code
pnpm typecheck
pnpm test
pnpm codegen:check
```

Soit exactement `pnpm verify:local`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/package.json:39`).
Puis, avec une base disponible :

```bash
pnpm test:integration
```

Ne pas commiter. Rendre la main.

## 5. Migrations et données existantes

### 5.1 Ordre imposé

Deux migrations, deux envois distincts, jamais fusionnés :

1. **Expansion** (étape 1) : `lots_export`. Purement additive. Une instance
   d'API de l'ancienne version tourne sans s'en apercevoir.
2. **Contraction** (étape 8) : suppression des six tables, des trois enums et
   des six colonnes. À n'appliquer qu'une fois que **plus aucune** instance
   d'API ne lit ces colonnes.

Entre les deux, l'application ne lit ni n'écrit plus rien de `call_tasks`,
`call_campaigns`, `rep_call_tasks`, `rep_call_campaigns`, ni des colonnes
`taskId` / `campaignId` : les colonnes restent en base, vides d'usage. C'est la
séquence expand → switch → contract, et elle est ce qui permet un retour arrière
sans perte pendant la fenêtre de bascule.

### 5.2 Sort des lignes existantes

| Table | Volume attendu | Que faire |
| --- | --- | --- |
| `call_tasks` | Une ligne par prospect distribué, jusqu'à ~120 000 par campagne d'après le commentaire `schema.prisma:944` | **Supprimer.** Une tâche n'est pas un fait métier : c'est une intention d'appel. Le fait, c'est la tentative, conservée dans `call_attempts`. |
| `call_campaigns`, `call_campaign_commerciaux` | Quelques dizaines de lignes | **Supprimer.** |
| `rep_call_tasks`, `rep_call_campaigns`, `rep_call_campaign_commerciaux` | Idem | **Supprimer.** |
| `call_attempts.taskId` / `.campaignId` | Une valeur sur les tentatives issues d'une campagne | **Perdue volontairement.** Le lien « quel appel appartient à quelle opération » est repris, pour l'avenir, par `lots_export` + la date. Pour le passé, il n'est pas reconstruit. C'est une perte assumée à valider par le propriétaire (Q4). |
| `rep_call_attempts.taskId` / `.campaignId` | Idem | Idem. |
| `scheduled_callbacks.taskId` / `.campaignId` | Renseignées quand le rappel vient d'une campagne | **Perdues.** `assignedToId` et `sourceAttemptId` suffisent à la file et à son idempotence. |

**Aucune reprise de données n'est nécessaire pour les lots** : un lot décrit un
téléchargement, et aucun téléchargement passé n'a été enregistré. La table
démarre vide.

### 5.3 Précautions d'exécution

- La suppression de `call_tasks` peut porter sur des centaines de milliers de
  lignes. `DROP TABLE` est instantané et ne journalise pas ligne à ligne :
  préférer `DROP TABLE` à `DELETE FROM` puis `DROP`.
- Les index partiels bruts `call_tasks_one_active_per_prospect` et
  `rep_call_tasks_one_active_per_representant` tombent avec leurs tables : aucune
  instruction séparée.
- La suppression d'un type enum PostgreSQL échoue tant qu'une colonne l'utilise.
  Ordre dans la migration : colonnes, puis tables, puis
  `DROP TYPE "CallTaskStatus"`, `DROP TYPE "CampaignStatus"`,
  `DROP TYPE "CampaignScope"`.
- **Ne jamais exécuter ces migrations sur la production sans autorisation
  explicite.** `pnpm db:migrate` vise la base de développement ; le déploiement
  passe par `pnpm db:deploy`
  (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/package.json:28`), qui
  n'est pas du ressort de ce plan.
- La contrainte `CHECK` du lot est posée `NOT VALID` puis validée dans une
  seconde migration, sur le modèle de
  `packages/database/prisma/migrations/20260814090100_valider_contraintes/`.
  Sur une table neuve et vide, la validation est immédiate ; la forme reste
  celle du dépôt.

## 6. Tests

### 6.1 Tests à écrire

| Fichier | Ce qu'il doit prouver |
| --- | --- |
| `apps/api/src/modules/lots-export/lots-export.service.test.ts` | La création fige la liste : deux fiches ajoutées après coup ne rentrent pas dans le lot. `itemCount` égale le nombre de lignes écrites. Une cible vide rend `422 LOT_EXPORT_CIBLE_VIDE`. Un lot `REPRESENTANTS` ne peut pas porter d'item `prospectId`. |
| `apps/api/src/modules/lots-export/lots-export.integration.test.ts` | Sur une vraie base : `callsSince` ne compte que les appels postérieurs à `createdAt` et portant sur une fiche du lot. Un appel sur une fiche hors lot ne compte pas. Un appel antérieur à la création ne compte pas. |
| `apps/api/src/modules/sync/sync.controller.test.ts` (existant, à compléter) | Un client annonçant `X-CPI-Payload-Version: 4` reçoit `426 APP_UPDATE_REQUIRED` ; `5` passe. La poussée reste ouverte à 4. |
| `apps/api/src/modules/prospects/portee-lecture.integration.test.ts` (réécrit) | Un COMMERCIAL lit une fiche créée par un autre. Il ne peut PAS la modifier (`assertOwnership` rend `403 NOT_OWNER`). Il PEUT y consigner une tentative d'appel. |
| `apps/api/src/modules/export/openapi-contract.test.ts` (complété) | `GET /lots-export/{id}/export.xlsx` déclare le classeur en binaire. `GET /export/representants.xlsx` annonce `relationStatus`, `whatsappStatus`, `hasWhatsapp`. |
| `apps/api/src/common/guards/role-routes.test.ts` (complété) | Un COMMERCIAL n'atteint aucune route de lot. Un SUPERVISEUR lit les lots sans en créer. |

### 6.2 Commandes

```bash
# unitaire, ciblé
pnpm --filter @crm/api test -- <motif>

# unitaire, tout le module API
pnpm --filter @crm/api test

# intégration (exige PostgreSQL sur DATABASE_URL,
# par défaut postgresql://crm:crm@localhost:5434/crm)
pnpm --filter @crm/api test:integration

# tout le dépôt
pnpm test
pnpm verify:local
```

### 6.3 Ce qui ne se prouve pas ici

- Le comportement du mobile après la disparition des flux : c'est le plan
  mobile. L'API ne peut prouver que le `426` et l'absence des champs.
- La migration de la base locale Drift du téléphone : plan mobile.
- L'affichage du lot d'export : plan web.

## 7. Risques et questions ouvertes

### Q1 — BLOQUANT : d'où vient le projet d'une tentative d'appel sans campagne ?

`apps/api/src/modules/phase2/phase2-sync.service.ts:128` :

```ts
const projet = activeTask?.campaign.projet ?? prospect.projet;
```

Le commentaire `:121` à `:127` explique pourquoi : la phase 2 est un état du
PARCOURS, pas de la fiche. Un prospect refusé en CHUES doit rester appelable en
Grand Public, et c'est la campagne qui disait lequel des deux parcours l'appel
faisait avancer.

Sans campagne, il ne reste que `prospect.projet`, c'est-à-dire le projet
d'ENTRÉE de la fiche. Conséquence : un appel passé sur une fiche entrée en CHUES
fera toujours avancer le parcours CHUES, même si le téléconseiller appelle au
titre du Grand Public. Le parcours Grand Public d'une fiche à deux parcours
deviendrait inatteignable par téléphone.

Options :

1. **Le mobile et le web déclarent le projet** dans la tentative :
   `CallAttemptOpDto.projet?: Projet`, avec repli sur `prospect.projet`.
   Coût : un champ de plus dans le contrat de poussée, une saisie de plus à
   l'écran de la console d'appel, et un plan mobile qui doit l'émettre.
   Fichiers : `apps/api/src/modules/phase2/dto.ts:392`,
   `apps/api/src/modules/sync/dto.ts:103`,
   `apps/api/src/modules/phase2/phase2-sync.service.ts:129`.
2. **Le projet reste celui de la fiche.** Coût : les fiches à deux parcours ne
   progressent plus que sur leur parcours d'entrée. Combien de fiches sont
   concernées est mesurable :
   `SELECT COUNT(*) FROM (SELECT "prospectId" FROM prospect_journeys GROUP BY 1 HAVING COUNT(*) > 1) t;`
3. **Le serveur choisit le parcours encore `PENDING`**, et lève un conflit s'il
   y en a deux. Coût : une règle implicite de plus, et un `409` que l'écran doit
   savoir expliquer.

**Cette question bloque l'étape 4.** Elle change le contrat de poussée, donc le
plan mobile, donc l'ordre des trois plans fusionnés.

### Q2 — BLOQUANT : que reçoit le téléphone comme prospects ?

`apps/api/src/common/scope.ts:50` à `:57` dit explicitement pourquoi la portée
de synchronisation est plus étroite que celle de l'écran : « lire le travail de
tous à l'écran est une chose, en tirer le portefeuille national sur un appareil
en est une autre ».

La décision produit dit que le téléconseiller cherche librement dans la base des
prospects, sur le web ET sur le mobile. Deux façons de tenir cela :

1. **Le pull descend tous les prospects** (comme il descend déjà tout l'annuaire
   des représentants, `sync.service.ts:195` à `:200`). Simple, cohérent avec
   l'annuaire, fonctionne hors ligne. Risque : volume. Le commentaire de
   `schema.prisma:944` évoque une base de 120 000 fiches ; à ce volume, le
   premier pull complet et la base locale Drift deviennent un vrai sujet, et la
   surface de données personnelles sur un téléphone perdu change d'échelle.
2. **Le pull reste borné aux fiches de l'appelant**, et la recherche libre passe
   par une route EN LIGNE, sur le modèle de `GET /v1/phase2/directory`
   (`apps/api/src/modules/phase2/directory.controller`… en réalité
   `phase2.controller.ts:120`), qui sert déjà un annuaire paginé en keyset avec
   six champs et rien d'autre. Coût : la recherche de prospect ne marche plus
   hors ligne.

Chiffre à obtenir avant de trancher, sur la base réelle :
`SELECT COUNT(*) FROM prospects WHERE "deletedAt" IS NULL;`
Je n'ai pas accès à la base de production et ne peux pas le mesurer.

**Cette question bloque l'étape 3 et l'étape 4** et détermine directement le
plan mobile.

### Q3 — Non bloquant : renommage des chemins

Trois chemins gardent un nom qui ne décrit plus ce qu'ils font :
`POST /v1/rep-campaigns/attempts`, `GET /v1/phase2/callbacks`,
`GET /v1/phase2/directory`. Les renommer casse le web et le mobile en même temps
que le reste ; les garder laisse un vocabulaire faux dans le contrat, alors même
que `apps/web/src/lib/vocabulaire.test.ts` fige les mots d'interface.

Proposition retenue par défaut : **ne rien renommer dans ce chantier**, ouvrir un
chantier de renommage ensuite, quand le web et le mobile seront stabilisés.

### Q4 — Non bloquant, à confirmer : perte du lien appel ↔ campagne passée

Supprimer `call_attempts.campaignId` et `rep_call_attempts.campaignId` rend
définitivement impossible de répondre à « quels appels appartenaient à la
campagne d'avril ». Les tentatives elles-mêmes restent, avec leur auteur et leur
date.

Alternative si le propriétaire tient à l'historique : conserver les deux colonnes
en `String?` sans clé étrangère, comme trace morte. Coût : deux colonnes qui ne
veulent plus rien dire et que le prochain lecteur croira vivantes.

### R1 — Risque : trois plans, un seul contrat

Le retrait des flux de synchronisation et des routes de campagne casse le web et
le mobile au moment même où il est appliqué. L'ordre de fusion des trois plans
doit être : mobile (cesser de lire les flux, migrer la base locale) → API
(retirer) → web (basculer sur les lots). Un déploiement d'API en avance sur le
mobile est couvert par le `426`, mais un web en retard sur l'API rend des `404`
bruts à l'utilisateur.

### R2 — Risque : arbre de travail partagé

Au moment de cet audit, sont déjà modifiés et non commités par d'autres agents :
`apps/api/src/modules/analytics/supervision.service.ts`,
`.../supervision.dto.ts`, `.../analytics.controller.ts`, `.../analytics.module.ts`,
`.../dto.ts`, `.../pilotage.sql.ts`, `.../authorization.sweep.test.ts`,
`apps/api/src/common/guards/role-routes.test.ts`,
`apps/api/src/modules/notifications/fake-prisma.ts`,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/.env.example`,
plus un module `apps/api/src/modules/dashboards/` entièrement neuf.
Relire chaque fichier avant de l'éditer et ne jamais réécrire un fichier en
entier avec `Write` s'il porte déjà des modifications non commitées.

### R3 — Risque : volume de `lot_export_items`

Un lot de 120 000 représentants écrit 120 000 lignes. Dix lots par mois font
14 millions de lignes par an. La table n'a pas de purge automatique. Le
catalogue de purge (§2.7) doit exposer les deux nouvelles étapes, et un
propriétaire doit décider d'une rétention. Ce n'est pas bloquant pour la
première livraison.

### R4 — Risque : `reachRate` et `methodObtained` deviennent les seuls chiffres

Après le retrait de `campaign-pilotage`, plus aucun écran ne dit « il reste tant
de fiches à traiter ». C'est voulu par la décision produit. Si un tableau de bord
web s'appuyait sur `remaining` ou `estimatedEndDate`, il rendra un écran vide et
non une erreur — le cas le plus difficile à repérer. Le plan web doit lister ces
usages : `apps/web/src/components/stats/campaigns-panel.tsx` et
`apps/web/src/lib/data/advanced-stats.ts` en sont les deux points d'entrée
repérés.

Auteur : backend-engineer (audit API)
