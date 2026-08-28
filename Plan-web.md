# Plan web : sortir les campagnes d'appels du panel, garder la campagne comme lot d'export

Audit en lecture seule de `apps/web` réalisé le 28 août 2026 sur l'arbre de
travail (branche courante, beaucoup de modifications non commitées). Aucun
fichier de code n'a été modifié.

Ce document est autonome : il s'exécute sans relire la conversation qui l'a
produit. Chaque affirmation porte un chemin absolu et, quand elle vise une
ligne précise, son numéro.

---

## 1. Décision et périmètre

### 1.1 Ce qu'est le produit

`apps/web` est le panel web du CRM de la Compagnie Prestige Immobilier. Il sert
six rôles (`ADMIN`, `DIRECTION`, `SUPERVISEUR`, `COMMERCIAL` alias
téléconseiller, `BANQUE_FINANCE`, `ACCUEIL`) répartis en quatre « coques » :
Accueil (registre des visites), Projet CHUES (enrôlement d'enseignants
syndiqués), Projet Grand Public, Admin. La liste des coques et de leurs entrées
de menu est dans
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/layout/nav-items.ts`.

Le projet CHUES se fait en trois étapes, nommées partout de la même façon
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chues/etapes.tsx:14-18`) :

1. Qualifier un représentant (`/chues/appels-representants`) : on appelle un
   enseignant relais pour qu'il accepte de transmettre les contacts de ses
   collègues.
2. Ajouter un prospect (`/chues/prospects/nouveau`) : on note un par un les
   contacts qu'il a donnés.
3. Convertir un prospect (`/chues/console`) : on rappelle chaque prospect
   jusqu'à son adhésion.

### 1.2 Ce que le propriétaire arrête

Le panel gère aujourd'hui des **campagnes d'appels** : un administrateur tire un
lot de fiches, les répartit en tourniquet entre des téléconseillers nommés, et
chacun reçoit une **liste d'appel** (une « tâche » par fiche). Tout l'écran
« Convertir un prospect » et une partie de l'écran « Qualifier un représentant »
sont construits autour de cette file.

**On ne consigne plus qui doit appeler qui.** Il n'y a plus, nulle part dans
l'interface :

- d'assignation d'une fiche à un téléconseiller ;
- de tâche, de file d'appel, de liste d'appel, de programme imprimé par
  personne ;
- de compteur « pas encore appelés », « reste à faire », « tâches closes »,
  « prochain contact », « progression par tâche » ;
- de clôture, de pause ou de reprise de campagne ;
- de pilotage par campagne.

Les téléconseillers, les superviseurs et la direction **cherchent librement**
dans l'annuaire des représentants et dans la base des prospects, consignent
leurs appels, et **promettent des rappels**. Les rappels restent : c'est une
promesse que l'appelant s'est faite à lui-même, pas un travail qu'on lui
attribue.

### 1.3 Ce que devient « campagne »

Une campagne subsiste uniquement comme **lot d'export** :

- on choisit une cible (projet, département ou IEF, statut de relation des
  représentants « qualifié » ou « non qualifié », segment de prospects) ;
- on télécharge les fiches en Excel ;
- l'administration suit le lot : qui l'a créé, quand, combien de fiches, et
  combien d'appels ont été passés sur ces fiches depuis.

Aucune assignation, aucun tourniquet, aucun aperçu de répartition, aucun PDF par
téléconseiller.

### 1.4 Périmètre de ce plan

Ce plan couvre `apps/web` seulement. Deux plans jumeaux existent pour `apps/api`
et `apps/mobile` ; la section 5 énonce précisément ce que le web attend du
contrat pour que les trois se rejoignent.

### 1.5 Stack détectée

Relevée dans
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/package.json` et
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/package.json` :

- monorepo pnpm 11.15.1, Node >= 24.18.0, Turborepo ;
- Next.js App Router (`next dev --port 3000`), React 19, TypeScript strict,
  Tailwind v4 (`@tailwindcss/postcss`) ;
- primitives `@base-ui/react`, kit maison dans
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/ui/` ;
- TanStack Query et TanStack Table, react-hook-form + zod, `cmdk`, `sonner`,
  `lucide-react`, `chart.js` ;
- client HTTP engendré depuis l'OpenAPI : `@crm/api-client` (workspace), tous
  les types de l'interface en dérivent
  (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/types.ts:1-3`) ;
- tests unitaires vitest + Testing Library, bout en bout Playwright dans
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/e2e/`, lint
  `oxlint`.

### 1.6 Règles du dépôt à respecter pendant l'exécution

- **Modifier les fichiers avec `Edit`, en créer avec `Write`.** Jamais de `sed`,
  de redirection shell, de heredoc, de `cat` ni de script Python pour écrire du
  code.
- **Commentaires rares.** Un commentaire ne se justifie que si le code ne peut
  pas porter l'information (contrainte externe, choix contre-intuitif, piège).
  Une à deux lignes. Avant d'écrire un commentaire : renommer, ou découper.
- **Copie française simple**, sans jargon et **sans tiret cadratin**. Le mot
  « commercial » est interdit dans tout texte affiché (le test
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/vocabulaire.test.ts`
  le vérifie sur tout `src`). Les mots « phase », « pilotage », « console » sont
  interdits dans les intitulés de la barre latérale
  (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/layout/nav-items.test.ts:989`).
- **Composants existants d'abord** : `components/ui/*` puis les primitives Base
  UI, avant tout code maison. Ne pas ajouter de dépendance sans nécessité
  démontrée ; aucune n'est nécessaire pour ce chantier.
- **Un lien n'est jamais un bouton** : `Link` habillé par `buttonVariants(...)`,
  jamais `<Button render={<a/>}>` (raison écrite dans
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chues/hub-view.tsx:221-225`).
- **Aucune constante lue par une page serveur ne vit dans un module
  `'use client'`.** Une page serveur qui importe une valeur d'un module client
  reçoit une référence client, pas la valeur : c'est ce qui a fait planter
  `/chues`, d'où l'existence de
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chues/hub-filters.ts:1-5`.
- **Verts obligatoires avant de rendre la main** :
  `pnpm --filter @crm/web typecheck && pnpm --filter @crm/web lint && pnpm --filter @crm/web test`.
- **Aucun commit sans demande explicite de l'utilisateur.**

---

## 2. Inventaire

Verdicts : **GARDER** (inchangé), **CHANGER** (réécriture partielle),
**REMPLACER** (l'écran survit sous une autre forme), **SUPPRIMER**.

### 2.1 Routes du projet CHUES

Racine : `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/(panel)/`

| Fichier | Verdict | Détail |
| --- | --- | --- |
| `chues/page.tsx` (écran « Mon travail ») | CHANGER | Précharge quatre compteurs (`chues/page.tsx:41-58`) dont deux décrivent une file. |
| `chues/layout.tsx` | GARDER | Monte le sélecteur des trois étapes (`chues/layout.tsx:21`). |
| `chues/appels-representants/page.tsx` | CHANGER | Précharge `fetchRepScriptQueue` (lignes 8, 24-26), qui est la liste confiée. |
| `chues/appels-representants/loading.tsx` | GARDER | |
| `chues/appels-representants/page.test.tsx` | CHANGER | Vérifie le préchargement de la file. |
| `chues/console/page.tsx` | CHANGER | Précharge la file (`console/page.tsx:23-26`) ; le refus dit « La file d'appel des prospects » (ligne 19). |
| `chues/console/loading.tsx` | GARDER | |
| `chues/rappels/page.tsx` | CHANGER | Copie « La file des rappels » (ligne 14). |
| `chues/supervision/page.tsx` | GARDER | |
| `chues/suggestions/page.tsx` | GARDER | Les numéros recommandés par les représentants ne sont pas une file assignée. |
| `chues/prospects/page.tsx` | CHANGER | Ajouter un geste par ligne vers la consignation (voir 3.5). |
| `chues/prospects/nouveau/page.tsx` | GARDER | |
| `chues/representants/page.tsx` | GARDER | |
| `chues/representants/[id]/page.tsx` | GARDER | |
| `chues/statistiques/page.tsx` | GARDER | Déjà refondu par un chantier parallèle (rend `ChiffresView`). |
| `chues/tableau-de-bord/page.tsx` | GARDER | Devenu une redirection permanente vers `/chues/statistiques`. |
| `chues/campagnes/page.tsx` | REMPLACER | Devient la liste des lots d'export. Garde ADMIN + SUPERVISEUR + DIRECTION (ligne 21). |
| `chues/campagnes/[id]/page.tsx` | REMPLACER | Devient le détail d'un lot. |
| `chues/campagnes/representants/page.tsx` | SUPPRIMER | Fusionnée dans la liste unique des lots. |
| `chues/campagnes/representants/[id]/page.tsx` | SUPPRIMER | |
| `chues/campagnes/access.test.tsx` | CHANGER | Importe les quatre pages (lignes 13-17) ; n'en garder que deux. |
| `chues/banque/**`, `chues/dossiers/**`, `chues/demandes-clients/**` | GARDER | Hors périmètre. |

### 2.2 Routes du projet Grand Public

| Fichier | Verdict | Détail |
| --- | --- | --- |
| `grand-public/page.tsx` | GARDER | |
| `grand-public/[id]/page.tsx`, `grand-public/nouveau/page.tsx` | GARDER | |
| `grand-public/console/page.tsx` | CHANGER | Même refonte que la console CHUES ; refus « La file d'appel Grand Public » (ligne 23). |
| `grand-public/rappels/page.tsx` | GARDER | Réexporte la page CHUES (ligne 1). |
| `grand-public/statistiques/page.tsx` | GARDER | |
| `grand-public/tableau-de-bord/page.tsx` | GARDER | Redirection permanente vers `/grand-public/statistiques`. |
| `grand-public/campagnes/page.tsx` | REMPLACER | Liste des lots Grand Public. |
| `grand-public/campagnes/[id]/page.tsx` | REMPLACER | Réexporte la page CHUES (ligne 3) ; garder ce montage. |

### 2.3 Composants « campagne » (à supprimer ou à réécrire)

Racine : `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/phase2/`

| Fichier | Verdict | Ce qui le condamne |
| --- | --- | --- |
| `campaigns-view.tsx` | REMPLACER | « Distribuer les appels aux téléconseillers. Tirage définitif. » (ligne 56) ; `CampaignProgressBar` (131) ; compteur de téléconseillers (134-135) ; date de clôture (140-148). |
| `campaign-detail-view.tsx` | REMPLACER | Clôture (84-99, 158-169, 298-348), pause et reprise (101-110, 147-157), « Répartition par téléconseiller » (212-229), `CommercialCard` avec programme PDF par journée (392-489), « Tâche d'un autre téléconseiller » (282-285). La section « Tentatives récentes » (231-296) et `AttemptRenseignements` (358-390) sont à **reprendre** dans le détail du lot. |
| `campaign-create-dialog.tsx` | REMPLACER | Sélection nominative de téléconseillers (209-268), aperçu du tourniquet (345-464), « Le tirage est définitif » (175), « Lancer la campagne » (334). |
| `rep-campaign-create-dialog.tsx` | REMPLACER | Mêmes motifs (310-364 pour l'équipe, 486-542 pour l'aperçu). **À conserver** : la cascade Région → Département → IEF (223-269) et le choix de qualification (48-64, 271-276), qui sont exactement les critères de cible d'un lot. |
| `rep-campaign-detail-view.tsx` | SUPPRIMER | Jumeau du détail campagne, même structure d'assignation. |
| `campaign-target-field.tsx` | REMPLACER | À déplacer tel quel vers `components/lots/`. `RadioCardGroup` (17-68) et `CampaignTargetField` (70-105) sont réutilisables sans modification autre que la légende « Qui appelle-t-on ? » (ligne 99), qui devient « Que veut-on exporter ? ». |
| `campaign-progress-bar.tsx` | SUPPRIMER | Ne mesure que l'avancement de tâches. |
| `campaigns-tabs.tsx` | SUPPRIMER | Deux onglets « Appels prospects » / « Appels représentants » (9-12) ; une seule liste de lots les remplace. |
| `campaigns-filters-bar.tsx` | REMPLACER | Réécrire en `lots-filters-bar.tsx` sans le filtre de statut de campagne. |
| `rep-campaigns-filters-bar.tsx` | SUPPRIMER | |
| `rep-campaigns-view.tsx` | SUPPRIMER | |
| `spread-days-field.tsx` | SUPPRIMER | L'étalement sur plusieurs journées n'existe que pour distribuer des tâches. |
| `use-campaign-filters.ts` | REMPLACER | Devient `use-lot-filters.ts`. |
| `use-rep-campaign-filters.ts` | SUPPRIMER | |
| `call-recording-player.tsx` | GARDER | Déplacer sous `components/lots/` avec son test : c'est le seul lecteur des notes vocales enregistrées depuis le mobile, et il reste utile dans la liste des appels d'un lot. |
| `campaign-create-dialog.test.tsx`, `campaign-detail-view.test.tsx`, `rep-campaign-create-dialog.test.tsx` | REMPLACER | Voir section 6. |

### 2.4 Console et script représentant

| Emplacement | Verdict | Ce qui le condamne |
| --- | --- | --- |
| `apps/web/src/components/console/console-view.tsx:120` | SUPPRIMER | État `campaignId` : filtre de campagne dans la file. |
| `…/console-view.tsx:135, 169-170, 752-762, 870-933` | SUPPRIMER | `rawOrder` et `SortExplainer` : l'explication de l'ordre d'une file. |
| `…/console-view.tsx:140-151` | CHANGER | `fetchConsoleCampaigns` et `fetchConsoleQueue(campaignId, …)`. |
| `…/console-view.tsx:130-133, 186-219, 272-293, 344-348` | CHANGER | `done`, `enchaine`, `nextAfter`, `move`, `skip` : l'enchaînement automatique d'une file. |
| `…/console-view.tsx:433` | CHANGER | « La file d'appel n'a pas pu être chargée. » |
| `…/console-view.tsx:441-497` | CHANGER | Écran vide « Aucun prospect à appeler … dans cette campagne » et bouton « Voir toutes mes fiches ». |
| `…/console-view.tsx:729-799` | SUPPRIMER | Le tiroir « Suivants à appeler », son sélecteur de campagne (738-750) et sa note « fiches affichées sur … Choisissez une campagne » (791-795). |
| `…/console-view.tsx:84-102, 95-96` | CHANGER | Carte clavier : retirer « ↑ ↓ Parcourir la file » et « Espace Ouvrir la fiche sélectionnée ». |
| `…/console-view.tsx:822-861` | CHANGER | La palette `Ctrl/Cmd K` cherche dans la file chargée (`items`) ; elle doit chercher au serveur, ou disparaître au profit du champ de recherche. |
| `apps/web/src/components/console/rep-script.tsx:100-104` | SUPPRIMER | Requête `repScriptKeys.queue` / `fetchRepScriptQueue`. |
| `…/rep-script.tsx:113-117` | CHANGER | `file`, `liste`, `listeEstFile` : la liste confiée passe devant l'annuaire. |
| `…/rep-script.tsx:128-140` | CHANGER | Squelette et erreur de « la file des représentants ». |
| `…/rep-script.tsx:167-171` | CHANGER | « Votre liste d'appel. Choisissez qui vous venez d'appeler. » |
| `…/rep-script.tsx:75-81` | CHANGER | `annuaireFilters` doit sortir de ce module `'use client'` pour que la page serveur puisse précharger la même clé (voir 1.6). |
| `…/rep-script.tsx:142-155, 220-247, 249-682` | GARDER | La recherche, la fiche, les deux étapes de questions, l'échéance de rappel et l'envoi unique sont exactement l'état cible. |
| `apps/web/src/components/console/console-ui.tsx`, `use-shortcuts.ts`, `conversion-fields.tsx` | GARDER | |

### 2.5 Écran d'ouverture CHUES

| Emplacement | Verdict | Détail |
| --- | --- | --- |
| `apps/web/src/components/chues/hub-filters.ts:7-12` | CHANGER | `A_APPELER` : « Les représentants qu'on n'a pas encore appelés ». Le filtre reste valable (`relationStatus: 'INCONNU'`), le nom et le commentaire décrivent une file. Renommer en `NON_QUALIFIES`. |
| `…/hub-filters.ts:14-20` | GARDER | `SANS_PROSPECT` est une observation sur la base. |
| `apps/web/src/components/chues/hub-view.tsx:48-57` | SUPPRIMER | Calcul `prioritaire` : « Là où le travail attend … la première étape qui a de quoi faire porte seule le geste plein ». |
| `…/hub-view.tsx:82, 103, 124, 97, 118, 148, 177-181` | SUPPRIMER | Propagation de `prioritaire` et pastille « À faire maintenant ». |
| `…/hub-view.tsx:90` | CHANGER | Légende « pas encore appelés » → « pas encore qualifiés ». |
| `…/hub-view.tsx:132` | CHANGER | Légende « en attente d'appel » : décrit une file de conversion. |
| `…/hub-view.tsx:133-141` | GARDER | Le compte des rappels dus reste. |
| `apps/web/src/components/chues/etapes.tsx:14-18` | GARDER | Les trois étapes et leurs intitulés ne bougent pas. |

### 2.6 Supervision et chiffres

| Emplacement | Verdict | Détail |
| --- | --- | --- |
| `apps/web/src/components/supervision/activity-view.tsx:68-69` | SUPPRIMER | Colonnes « Tâches closes » (`tasksClosed`) et « Reste à faire » (`openTasks`). |
| `…/activity-view.tsx:385-386, 415-416` | SUPPRIMER | Cellules correspondantes. |
| `…/activity-view.tsx:309-312` | SUPPRIMER | Note « "Reste à faire" compte les tâches d'appel encore ouvertes à l'instant ». |
| `apps/web/src/lib/data/admin.ts:197, 207, 233, 243, 255, 265, 279, 299-300, 315-316, 328-329, 349-350, 457-458, 475-476, 489-490` | SUPPRIMER | `openTasks` et `tasksClosed` dans `ActivityLine`, `ActivityTotals`, les moyennes et l'export CSV. |
| `apps/web/src/components/supervision/supervision-view.tsx` | GARDER | Présence et sessions, aucune notion de tâche. |
| `apps/web/src/components/chiffres/sources.ts:58-64` | CHANGER | Colonne « Reste à appeler » de la table `par-teleconseiller`. |
| `…/chiffres/sources.ts:140-153` | SUPPRIMER | Carte `reste-a-appeler` : « fiches en attente, à l'instant », somme des `openTasks`. |
| `…/chiffres/sources.ts:154-196` | CHANGER | `par-teleconseiller` : retirer `restes` (160) et la cellule `reste` (189). |
| `apps/web/src/components/stats/campaigns-panel.tsx` | SUPPRIMER | « Pilotage de campagne » (69), tuile « Reste à faire » (136-148), « Fiches clôturées par jour / par téléconseiller » (152-167). Déjà orpheline depuis la refonte « Chiffres » en cours : plus aucun module ne l'importe. |
| `apps/web/src/components/stats/banks-panel.tsx`, `apps/web/src/components/dashboard/funnel-panel.tsx` | À VÉRIFIER | Orphelines elles aussi depuis la suppression de `statistics-view.tsx` et `dashboard-view.tsx` par le chantier « Chiffres ». Ne pas les supprimer dans ce chantier ; les signaler s'il reste rouge sur `pnpm dead-code`. |
| `apps/web/src/lib/stat-explanations.ts:27-33, 95-106` | SUPPRIMER | Clés `campaignContactRate`, `campaignReachRate`, `campaignAttemptsPerMethod`, `campaignRemaining`, `campaignClosedPerDay`, `campaignClosedPerCommercial` et leurs textes. |
| `apps/web/src/lib/data/advanced-stats.ts:25` | SUPPRIMER | `fetchCampaignPilotage` sur `/api/v1/analytics/campaign-pilotage`, ainsi que `closedPerDayTotals`, `closedPerCommercial`, `estimatedEndLabel` s'ils n'ont plus d'appelant. |

### 2.7 Données, clés de cache, filtres

| Emplacement | Verdict | Détail |
| --- | --- | --- |
| `apps/web/src/lib/data/phase2.ts:16-54` | REMPLACER | `toCampaignQuery`, `fetchCampaigns` → équivalents « lots ». |
| `…/phase2.ts:79-111` | SUPPRIMER | `createCampaign`, `closeCampaign`, `pauseCampaign`, `resumeCampaign` (`createCampaign` est remplacé par `createLot`). |
| `…/phase2.ts:113-165, 198-210` | SUPPRIMER | `CampaignPreview`, `spreadIntoDays`, `roundRobinSplit`, `buildCampaignPreview`, `fetchCampaignPreview`. |
| `…/phase2.ts:189-196` | SUPPRIMER | `countOpenTasks` : somme des `progress.open`. |
| `…/phase2.ts:212-234` | SUPPRIMER | `programmePdfUrl`, `programmePdfFileName`. |
| `…/phase2.ts:63-77` | GARDER | `fetchCallRecording` (note vocale d'un appel). |
| `…/phase2.ts:167-187` | GARDER | `countPendingProspects`, utilisé par l'écran d'ouverture. |
| `…/phase2.ts:217-225` | GARDER | `slugForFileName`, utilisé pour nommer les fichiers téléchargés. |
| `apps/web/src/lib/data/rep-campaigns.ts` (fichier entier) | SUPPRIMER | Sauf `REP_QUALIFICATION_STATUSES` (76-81) et `RepQualification` (73), à déplacer dans le module « lots ». `pushRepCallAttempt` (774-779) et `buildRepAttempt` (761-772) vivent déjà dans `lib/data/console.ts`, pas ici. |
| `apps/web/src/lib/data/console.ts:23-27` | CHANGER | `consoleKeys.queue(campaignId)` et `consoleKeys.campaigns`. |
| `…/console.ts:43-67` | CHANGER | `fetchConsoleQueue` : paramètre `campaignId`, tri figé, `pageSize: 200`. Devient une recherche paginée. |
| `…/console.ts:69-84` | SUPPRIMER | `fetchConsoleCampaigns` et son indice « X ouvertes ». |
| `…/console.ts:232-342` | SUPPRIMER | `QueueBucket`, `QUEUE_BUCKET_LABELS`, `BUCKET_RANK`, `bucketOf`, `orderKey`, `sortQueue`, `buildQueue`, `undatedCallbacks` : toute la machinerie de tri d'une file. |
| `…/console.ts:344-348, 357-382` | SUPPRIMER | `nextAfter` et `queueLabel`. |
| `…/console.ts:692-712` | SUPPRIMER | `REP_QUEUE_SIZE`, `repScriptKeys.queue`, `RepScriptPage`, `fetchRepScriptQueue`. |
| `…/console.ts:29-34, 86-143, 145-230, 384-690, 714-779` | GARDER | Rappels, créneaux, validation d'appel, conversion, envoi par `sync/push`, appel représentant. |
| `apps/web/src/lib/query-keys.ts:56-88` | REMPLACER | Bloc « Phase 2 » : `campaignsRoot`, `campaigns`, `campaign`, `campaignPreview`, `repCampaignsRoot`, `repCampaigns`, `repCampaign`, `repCampaignPreview` → `lotsRoot`, `lots(filters)`, `lot(id)`, `lotApercu(criteres)`. |
| `apps/web/src/lib/campaign-filters.ts` (93 lignes) | REMPLACER | Devient `lot-filters.ts` sans `status` (12, 18, 41, 58, 88). |
| `apps/web/src/lib/rep-campaign-filters.ts` et son test | SUPPRIMER | |
| `apps/web/src/lib/filters.ts:41, 80, 110, 133, 189` | GARDER | `campaignId` reste un filtre légitime : il désigne désormais le lot d'où sort la fiche. Seule la copie change (2.9). |
| `apps/web/src/lib/types.ts:125-133` | CHANGER | `CampaignSummary`, `CampaignDetail`, `CampaignCommercial`, `CampaignProgress`, `CreateCampaignInput` suivent le contrat API. `CampaignAttempt` (131) survit pour la liste des appels d'un lot. `CampaignScope` (125) et `CAMPAIGN_SCOPES` (149-159) restent : ils nomment les cibles. |
| `…/types.ts:232-237` | SUPPRIMER | `CAMPAIGN_STATUS_LABELS` (« Brouillon », « En cours », « Suspendue », « Clôturée »). |
| `…/types.ts:244` | CHANGER | `FilterListCoverage.CAMPAIGN_SCOPES` reste, `CampaignStatus` (126) part avec les libellés. |
| `apps/web/src/lib/data/reference.ts:43-49, 72-76` | CHANGER | `ReferenceData.campagnes` alimenté par `GET /api/v1/phase2/campaigns` ; à rebrancher sur la route des lots. Le champ est déclaré dans `apps/web/src/lib/types.ts:348`. |
| `apps/web/src/app/moved-routes.ts:29-30` | CHANGER | `phase2` → `/chues/campagnes` (garder), `rep-campaigns` → `/chues/campagnes/representants` (route supprimée : rediriger vers `/chues/campagnes`). |
| `apps/web/src/app/moved-routes.ts:40-42` | GARDER | `/phase2/callbacks` → `/chues/rappels`. |
| `apps/web/src/lib/data/inbox.ts:85-124` | GARDER | La liste blanche doit continuer d'accepter `/campagnes`, `/chues/campagnes`, `/phase2` et `/rep-campaigns` : des notifications déjà en base portent ces adresses, et `moved-routes.ts` les rattrape. |

### 2.8 Navigation

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/layout/nav-items.ts`
(719 lignes au moment de l'audit ; ce fichier est modifié en parallèle par un
autre chantier, **relire les numéros avant d'éditer**).

| Ligne | Contenu | Verdict |
| --- | --- | --- |
| 274-281 | Entrée « Campagnes », `/chues/campagnes`, description « Distribuer les appels aux téléconseillers », rôles `ENCADREMENT`, repliée | CHANGER : label « Lots d'export », description « Fiches téléchargées et appels qui ont suivi ». |
| 313-319 | Même entrée pour `ADMIN`, en pleine barre | CHANGER : même libellé. |
| 534-540 | « Campagnes » `/grand-public/campagnes` | CHANGER : même libellé. |
| 490-493 et 557-560 | `/grand-public/console`, description « File d'appels et qualification » | CHANGER : « Chercher un prospect et consigner l'appel ». |
| 226-231 et 404-411 | `/chues/console`, « Convertir un prospect », « Dernière étape » | GARDER. |
| 212-217 et 396-403 | `/chues/appels-representants` | GARDER. |
| 234-238 et 344-349 | Rappels | GARDER. |

Aucune entrée `/chues/campagnes/representants` n'existe dans la barre : cette
route est atteinte par l'onglet, ce que déclare
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/layout/nav-items.test.ts:107`
(`ATTEINT_AUTREMENT`) et les listes `MASQUEES` (lignes 118, 132, 136).

### 2.9 Copie à remplacer

| Où | Aujourd'hui | Demain |
| --- | --- | --- |
| `nav-items.ts:278, 317, 538` | « Distribuer les appels aux téléconseillers » | « Fiches téléchargées et appels qui ont suivi » |
| `nav-items.ts:493, 560` | « File d'appels et qualification » | « Chercher un prospect et consigner l'appel » |
| `campaigns-view.tsx:56` | « Distribuer les appels aux téléconseillers. Tirage définitif. » | « Choisir une cible, télécharger les fiches, suivre les appels qui ont suivi. » |
| `campaigns-view.tsx:40` | « Utilisez "Nouvelle campagne", en haut, pour répartir les prospects en attente. » | « Utilisez "Nouveau lot", en haut, pour choisir une cible et télécharger ses fiches. » |
| `campaign-create-dialog.tsx:171, 175-176` | « Nouvelle campagne d'appels » / « Le tirage est définitif. » / « Les prospects tirés sont retirés des campagnes suivantes. » | « Nouveau lot d'export » / « Choisissez qui vous exportez. » |
| `campaign-create-dialog.tsx:334, 218` | « Lancer la campagne » / « L'ordre de sélection fixe l'ordre du tourniquet. » | « Créer le lot » / (supprimé) |
| `campaign-target-field.tsx:99` | « Qui appelle-t-on ? » | « Que veut-on exporter ? » |
| `campaign-detail-view.tsx:216` | « Répartition par téléconseiller » | (supprimé) |
| `campaign-detail-view.tsx:234` | « Tentatives récentes » | « Appels passés sur ces fiches » |
| `console-view.tsx:433` | « La file d'appel n'a pas pu être chargée. » | « Les prospects n'ont pas pu être lus. » |
| `console-view.tsx:461-462` | « Aucun prospect à appeler pour l'instant / dans cette campagne. » | « Cherchez le prospect que vous venez d'appeler. » |
| `console-view.tsx:455-456` | « Retirez le filtre de campagne, ou ouvrez-la depuis les prospects. » | « Ouvrez-la depuis la liste des prospects. » |
| `console-view.tsx:734` | « Suivants à appeler » | (supprimé) |
| `console-view.tsx:95-96` | « Parcourir la file » / « Ouvrir la fiche sélectionnée » | (supprimé de la carte clavier) |
| `rep-script.tsx:169` | « Votre liste d'appel. Choisissez qui vous venez d'appeler. » | « Choisissez qui vous venez d'appeler. » (déjà la variante sans file, ligne 170) |
| `rep-script.tsx:135` | « La file des représentants n'a pas pu être chargée. » | « L'annuaire n'a pas pu être lu. » (déjà présent ligne 176) |
| `rappels/rappels-view.tsx:53-58` | « Une échéance se promet depuis la console d'appel : touche 5, puis le chiffre de l'heure. » | « Une échéance se promet en consignant un appel. » |
| `rappels/rappels-view.tsx:174` | « Ouvrir dans la console » | « Ouvrir la fiche » |
| `chues/console/page.tsx:19` | « La file d'appel des prospects » | « La consignation des appels aux prospects » |
| `grand-public/console/page.tsx:23` | « La file d'appel Grand Public » | « La consignation des appels Grand Public » |
| `chues/rappels/page.tsx:14` | « La file des rappels » | « Les rappels promis » |
| `activity-view.tsx:68-69` | « Tâches closes » / « Reste à faire » | (colonnes supprimées) |
| `chiffres/sources.ts:63, 141` | « Reste à appeler » | (carte et colonne supprimées) |
| `hub-view.tsx:90` | « pas encore appelés » | « pas encore qualifiés » |
| `hub-view.tsx:132` | « en attente d'appel » | « pas encore convertis » |
| `hub-view.tsx:179` | « À faire maintenant » | (pastille supprimée) |
| `representants/representant-detail-view.tsx:251` | « Le statut se pose depuis la console d'appel » | « Le statut se pose en consignant un appel » |

---

## 3. État cible, écran par écran

### 3.1 Navigation

Une seule modification structurelle : l'entrée « Campagnes » devient « Lots
d'export », au même endroit et pour les mêmes rôles (`ADMIN`, `SUPERVISEUR`,
`DIRECTION` côté CHUES ; `ADMIN`, `DIRECTION`, `SUPERVISEUR` côté Grand Public).
Le téléconseiller ne la voit pas, aujourd'hui comme demain.

**La route `/chues/campagnes` est conservée**, malgré le changement de nom.
Raison : des notifications déjà envoyées portent `/campagnes`, `/chues/campagnes`
et `/phase2` en base ; la liste blanche
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/inbox.ts:85-124`
et la table de renvois
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/moved-routes.ts:8-31`
les rattrapent. Renommer la route en `/chues/lots` obligerait à ajouter une
troisième forme partout, pour un gain de lisibilité nul (l'utilisateur lit
l'intitulé, pas l'URL). Si le propriétaire veut malgré tout l'URL `/chues/lots`,
c'est une ligne à ajouter dans `MOVED_ROUTES` et deux dans `WEB_ROUTES` ; le
reste du plan ne change pas.

La sous-route `/chues/campagnes/representants` disparaît : les deux familles de
lots vivent dans une seule liste avec une colonne « Cible ».

### 3.2 Écran d'ouverture CHUES, `/chues`

Trois cartes, dans l'ordre du travail, un geste par carte. Ce qui change :

- plus de pastille « À faire maintenant », plus de bouton « plein » désigné :
  les trois gestes ont le même poids, parce qu'aucun ordre ne s'impose plus ;
- carte 1 : « X pas encore qualifiés » (chiffre de la base, pas une liste) ;
- carte 2 : « X ont accepté, sans contacts notés » (inchangé) ;
- carte 3 : « X pas encore convertis » et, à sa suite, « Y rappels dus » comme
  aujourd'hui.

Le squelette qui empêche d'afficher un zéro provisoire
(`hub-view.tsx:190-219`) reste tel quel.

### 3.3 Étape 1, `/chues/appels-representants`

L'écran ouvre **sur le champ de recherche et l'annuaire**, sans aucune liste
confiée. C'est déjà presque le cas : `rep-script.tsx:157-217` rend la recherche
puis la liste, et `rep-script.tsx:116` ne fait passer la file devant l'annuaire
que quand la recherche est vide. Il reste à retirer cette file.

Parcours cible, inchangé pour le reste :

1. « Qui avez-vous appelé ? », champ de recherche autofocalisé
   (`rep-script.tsx:220-247`). Sans saisie, les vingt premiers représentants par
   ordre alphabétique.
2. Choix d'une fiche dans la liste (nom, numéro, département, pastille de
   relation).
3. Garde : si la relation est déjà tranchée (a accepté ou a refusé), une boîte
   demande confirmation avant de montrer quoi que ce soit
   (`rep-script.tsx:385-415`).
4. Deux étapes de questions : résultat de l'appel, représentant CPI CHUES,
   WhatsApp, personne proposée, échéance de rappel ; puis commentaire et
   récapitulatif (`rep-script.tsx:452-640`).
5. « Enregistrer » envoie **une seule** tentative, puis retour à la liste avec
   « Appel enregistré pour X ».

### 3.4 Étape 3, `/chues/console` et `/grand-public/console`

C'est la refonte la plus lourde : l'écran est aujourd'hui construit autour d'une
file de 200 fiches préchargées, triée par groupes, avec passage automatique à la
suivante.

État cible, **calqué sur l'étape 1** pour que les deux écrans s'expliquent avec
les mêmes mots :

1. Champ de recherche « Quel prospect avez-vous appelé ? », autofocalisé,
   débounce (réutiliser
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/use-debounced-value.ts`,
   comme `rep-script.tsx:98`).
2. Liste de résultats : nom, numéro, dernier appel, statut. Sans saisie, les
   vingt fiches les plus récemment saisies du projet courant. La requête est
   `GET /api/v1/prospects` avec `search`, `projet`, `pageSize: 20`, sans
   `campaignId` et sans `assignedToId`.
3. Fiche ouverte : nom, numéro en grand avec « Copier », deux lignes de
   contexte, dernier appel (`console-view.tsx:504-549`, à conserver).
4. Les issues au clavier et au bouton restent telles quelles
   (`console-view.tsx:559-626`) : méthode obtenue (1, 2, 3, 9), à rappeler (5),
   injoignable (4), refus (6), mauvais numéro (7), autre (8).
5. Le formulaire de conversion (`ConversionFields`) et le choix d'échéance
   restent inchangés (`console-view.tsx:561-571, 628-683`).
6. Après enregistrement : retour à la liste de recherche avec « Appel enregistré
   pour X », comme l'étape 1. Plus de « Personne suivante ».
7. Le paramètre `?fiche=<id>` continue d'ouvrir directement une fiche, puisque
   les rappels s'en servent. Il devient une lecture par identifiant
   (`GET /api/v1/prospects/{id}`) au lieu d'une recherche dans la file chargée,
   ce qui supprime au passage l'avertissement « la fiche ouverte depuis les
   rappels n'est pas dans cette file » (`console-view.tsx:449-457, 505-513`).
8. La carte clavier perd « ↑ ↓ » et « Espace ». La palette `Ctrl/Cmd K` est
   redondante avec le champ de recherche : la retirer.

Une fiche déjà close reste consultable en lecture seule
(`console-view.tsx:551-558`) : la garde vaut toujours.

### 3.5 Chercher puis consigner depuis les listes

Pour que « chercher librement » ne se limite pas aux deux écrans d'étape :

- `/chues/prospects` : ajouter une colonne d'action avec un lien
  « Consigner un appel » vers `/chues/console?fiche=<id>`, dans
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/prospects/columns.tsx`.
  Le lien est habillé en bouton, jamais un `Button`.
- `/chues/representants/[id]` : ajouter le même geste vers
  `/chues/appels-representants?rep=<id>` et faire lire ce paramètre par l'étape 1
  pour ouvrir directement la fiche.

Ces deux gestes sont facultatifs au sens strict, mais ils sont ce qui remplace la
file : sans eux, une fiche trouvée dans une liste ne mène à aucune consignation.

### 3.6 Rappels, `/chues/rappels` et `/grand-public/rappels`

Écran conservé. Trois corrections :

- le lien de chaque ligne pointe en dur sur `/chues/console`
  (`rappels-view.tsx:170`) alors que l'écran sert aussi le Grand Public : il doit
  dériver du `pathname`, comme le fait déjà `projet` à la ligne 64 ;
- la copie ne parle plus de « console d'appel » ni de « touche 5 »
  (`rappels-view.tsx:53-58`, 174) ;
- le titre de colonne « Téléconseiller » (132, 166) reste : c'est **qui a promis
  le rappel**, pas à qui on l'a assigné.

Manque connu, à arbitrer avec le plan API : les rappels promis sur un
**représentant** ne sont visibles nulle part sur le web. `GET /api/v1/phase2/callbacks`
ne rend que des rappels de prospects (`CallbackDto`), alors que l'étape 1 permet
de promettre un rappel à un représentant
(`rep-script.tsx:565-569`, envoyé en `callbackAt`). Voir 5.4.

### 3.7 Lots d'export, `/chues/campagnes` et `/grand-public/campagnes`

**Liste** (`ADMIN`, `SUPERVISEUR`, `DIRECTION`) :

- en tête, une phrase et, pour qui peut créer, un bouton « Nouveau lot » ;
- barre de filtres : recherche par nom, cible, auteur, période (reprendre
  `campaigns-filters-bar.tsx` sans le filtre de statut) ;
- une carte ou une ligne par lot : nom (lien vers le détail), cible en clair
  (« Représentants qualifiés, département de Thiès », « BDD2 : CHUES / autre
  banque »), nombre de fiches, date de création, auteur, et **appels passés sur
  ces fiches depuis** (« 128 appels sur 340 fiches ») ;
- pas de barre de progression, pas de statut, pas de nombre de téléconseillers,
  pas de date de clôture ;
- pagination identique à celle de `campaigns-view.tsx:156-188`.

**Création** (`ADMIN` seulement, comme aujourd'hui via `canManage`) : un
dialogue en une seule étape, sans aperçu de tourniquet.

1. « Que veut-on exporter ? » : `RadioCardGroup` repris de
   `campaign-target-field.tsx`, avec les cibles `ALL`, `BDD1` à `BDD4` (CHUES),
   `GP1` à `GP4` (Grand Public), et `REPRESENTANTS` (CHUES seulement).
2. Nom du lot, trois caractères minimum.
3. Si la cible est `REPRESENTANTS` : cascade Région → Département → IEF
   (reprendre `rep-campaign-create-dialog.tsx:223-269`), choix de qualification
   « Tous / Non qualifiés / Qualifiés » (48-64) et l'interrupteur « seulement
   les représentants dormants » (281-306).
4. Un compte annoncé avant validation : « 340 fiches seront exportées ». Ce
   chiffre est celui du serveur, pas une estimation locale.
5. « Créer le lot » puis, dans la foulée, le téléchargement du classeur.

**Détail d'un lot** :

- en-tête : nom, cible en clair, date, auteur, nombre de fiches ;
- un bouton « Télécharger les fiches » (Excel), qui réutilise
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/exports/download-button.tsx`
  (`useFileDownload`) comme le font déjà
  `campaign-detail-view.tsx:403-416` et
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/representants/representants-view.tsx:57` ;
- section « Appels passés sur ces fiches » : reprise telle quelle de
  `campaign-detail-view.tsx:231-296`, avec `AttemptRenseignements` (358-390) et
  `CallRecordingPlayer` (288) ;
- aucun bouton de clôture, de pause ni de reprise.

### 3.8 Supervision, `/chues/supervision`

Onglet « Activité » : les onze colonnes passent à neuf, « Tâches closes » et
« Reste à faire » disparaissent, ainsi que la note qui les expliquait. L'export
CSV perd les deux colonnes correspondantes
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/admin.ts:457-458, 475-476, 489-490`).
Onglet « Comptes » : inchangé.

### 3.9 Chiffres, `/chues/statistiques` et `/grand-public/statistiques`

Écran refondu en parallèle par un autre chantier. Deux retraits seulement :

- la carte « Reste à appeler »
  (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chiffres/sources.ts:140-153`) ;
- la colonne « Reste à appeler » de la table « Par téléconseiller » (58-64, 160,
  189).

Les deux dépendent de l'énumération serveur `DashboardSource` : voir 5.5.

---

## 4. Étapes ordonnées et exécutables

Chaque étape est autonome et se termine en vert. Le principe rouge avant vert :
on écrit ou on modifie d'abord le test qui décrit le comportement voulu, on le
voit échouer, puis on change le code.

Commandes utilisées ci-dessous, toutes depuis
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo` :

```
pnpm --filter @crm/web test <chemin/du/fichier.test.tsx>
pnpm --filter @crm/web typecheck
pnpm --filter @crm/web lint
pnpm --filter @crm/web test
pnpm --filter @crm/web build
pnpm dead-code
```

### E0. Relire l'arbre avant de commencer

L'arbre de travail bouge : au moment de l'audit,
`components/stats/statistics-view.tsx`, `components/stats/teleconseil-panel.tsx`
et `components/dashboard/dashboard-view.tsx` ont été supprimés pendant la lecture
par un chantier « Chiffres » concurrent, et `components/layout/nav-items.ts` a
perdu vingt-sept lignes. **Relire chaque fichier avant de l'éditer** et vérifier
les numéros de ligne cités ici. Ne jamais lancer `git stash`, `git checkout` ni
`git restore` : le travail non commité d'autrui serait perdu. Les serveurs de
développement sur les ports 3000 et 3001 tournent : ne pas les arrêter.

### E1. Copie de la navigation

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/layout/nav-items.ts`.

1. Dans `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/layout/nav-items.test.ts`,
   ajouter un test qui exige `navItems('ADMIN', 'chues')` contenant une entrée
   `/chues/campagnes` dont le `label` vaut `Lots d'export` et dont la
   `description` ne contient ni « distribuer » ni « appels aux ».
2. Voir le test échouer.
3. Modifier les trois entrées (lignes 274-281, 313-319, 534-540) et les deux
   descriptions de console (493, 560).
4. Ajuster les listes attendues dans les tests existants : `nav-items.test.ts:713-725`
   (`SUPERVISEUR`), 855-868 (`DIRECTION`), 872-879 et 937-949 et 953-962
   (Grand Public), 309-326 (`ADMIN`, ordre des entrées).

Vérification : `pnpm --filter @crm/web test src/components/layout/nav-items.test.ts`.

### E2. L'écran d'ouverture cesse de désigner une file

Fichiers :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chues/hub-view.tsx`,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chues/hub-filters.ts`,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/(panel)/chues/page.tsx`.

1. Dans `hub-view.test.tsx`, remplacer l'attente « pas encore appelés » (ligne 62)
   par « pas encore qualifiés », et ajouter un test qui exige
   `screen.queryByText('À faire maintenant')` nul quels que soient les chiffres.
2. Voir échouer.
3. Renommer `A_APPELER` en `NON_QUALIFIES` dans `hub-filters.ts:7-12` (et son
   commentaire), répercuter dans `hub-view.tsx:16, 28-29` et
   `chues/page.tsx:5, 43-44`. Supprimer `prioritaire` (`hub-view.tsx:48-57`) et
   toutes ses propagations (82, 97, 103, 118, 124, 148, 162, 168, 177-181,
   229-239 pour la variante de bouton). Changer les deux légendes (90, 132).

Vérification :
`pnpm --filter @crm/web test src/components/chues/hub-view.test.tsx`.

### E3. L'étape 1 perd sa liste confiée

Fichiers :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/console/rep-script.tsx`,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/console.ts`,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/(panel)/chues/appels-representants/page.tsx`
et son test.

1. Créer
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/console/rep-annuaire.ts`
   (module **sans** `'use client'`) qui exporte `annuaireFilters(search: string)`,
   déplacé depuis `rep-script.tsx:75-81`. C'est la même précaution que
   `hub-filters.ts` : la page serveur doit lire la valeur, pas une référence
   client.
2. Dans `rep-script.test.tsx`, supprimer le test « montre la liste confiée
   d'abord, l'annuaire dès qu'on cherche » (ligne 146) et le remplacer par
   « ouvre sur l'annuaire, sans liste confiée » : la première requête faite est
   `fetchRepresentants` avec `search: ''`, et aucun appel à `fetchRepScriptQueue`.
3. Voir échouer.
4. Supprimer dans `rep-script.tsx` : l'import `fetchRepScriptQueue` et
   `repScriptKeys` (31, 35) au profit d'une clé locale, la requête `queue`
   (100-104), `file`, `liste`, `listeEstFile` (113-117), les branches d'attente et
   d'erreur de la file (128-140), et la phrase conditionnelle (167-171). La
   liste rendue devient toujours `annuaire.data?.items ?? []`.
5. Supprimer dans `console.ts` : `REP_QUEUE_SIZE` (692), `repScriptKeys.queue`
   (696), `RepScriptPage` (699-702) et `fetchRepScriptQueue` (704-712). Garder
   `repScriptKeys.root`, utilisé pour l'invalidation (`rep-script.tsx:151`).
6. Dans `appels-representants/page.tsx`, précharger
   `fetchRepresentants(annuaireFilters(''), getServerApiClient())` sous la clé
   `queryKeys.representants(annuaireFilters(''))`.

Vérification :
`pnpm --filter @crm/web test src/components/console/rep-script.test.tsx src/app/\(panel\)/chues/appels-representants/page.test.tsx`.

### E4. L'étape 3 devient un écran de recherche

Fichiers :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/console/console-view.tsx`,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/console.ts`,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/(panel)/chues/console/page.tsx`,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/(panel)/grand-public/console/page.tsx`.

C'est l'étape la plus lourde. La conduire en deux temps.

**E4a, les données.**

1. Dans `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/console.test.ts`,
   supprimer les blocs `sortQueue` (95), `bucketOf` (142), `buildQueue` (154),
   `nextAfter` (169), `queueLabel` (185). Ajouter un test de la nouvelle
   `fetchProspectsAChercher(search, projet)` : elle envoie `search`, `projet`,
   `pageSize: 20`, et n'envoie ni `campaignId` ni `assignedToId`.
2. Voir échouer.
3. Réécrire `fetchConsoleQueue` (`console.ts:43-67`) en
   `fetchProspectsAChercher`. Supprimer `fetchConsoleCampaigns` (69-84),
   `consoleKeys.campaigns` (26), le paramètre de `consoleKeys.queue` (25) et tout
   le bloc 232-382 sauf `daysSince` s'il sert ailleurs.
4. Créer un module de recherche non client si la page serveur doit précharger la
   même clé (même règle qu'en E3).

**E4b, l'écran.**

1. Dans `console-view.test.tsx`, supprimer le bloc « ConsoleView : file »
   (ligne 191) et ses six tests d'ordre. Écrire à la place :
   « ouvre sur la recherche, sans fiche », « ouvre la fiche choisie dans les
   résultats », « revient à la liste après enregistrement, sans sauter sur
   quelqu'un ». Les blocs « une touche, une issue » (248), « échéance du rappel »
   (314) et « phase 3 · Conversion » (397) restent : ils décrivent la
   consignation, pas la file. Adapter leur montage à la nouvelle ouverture par
   recherche.
2. Voir échouer.
3. Réécrire `console-view.tsx` sur le patron de `rep-script.tsx` : un composant
   de recherche et de liste, un composant de fiche. Supprimer `campaignId` (120),
   `done` (130), `enchaine` (133), `rawOrder` (135), `palette` (136-137), la
   requête `campaigns` (140-145), `sorted`/`items` (166-171), `nextAfter`,
   `move` (272-280), `skip` (282-293), le tiroir « Suivants » (731-799),
   `SortExplainer` (870-933) et la palette (822-861). Conserver `record`,
   `startConversion`, `submitConversion`, `validate`, `useShortcuts` et tout le
   rendu de la fiche.
4. Adapter les deux pages serveur : préchargement de la recherche vide, copie du
   refus de permission.

Vérification :
`pnpm --filter @crm/web test src/components/console src/lib/data/console.test.ts`
puis `pnpm --filter @crm/web typecheck`.

### E5. Les rappels parlent le nouveau vocabulaire

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/rappels/rappels-view.tsx`.

1. Dans `rappels-view.test.tsx`, renommer le test « ouvre la fiche dans la console
   d'appel » (ligne 103) en « ouvre la fiche du prospect » et exiger le libellé
   « Ouvrir la fiche ». Ajouter un test : sur un `pathname`
   `/grand-public/rappels`, le lien vise `/grand-public/console?fiche=…`.
2. Voir échouer.
3. Dériver la racine du lien du `pathname` (ligne 64 le fait déjà pour `projet`),
   changer les deux textes vides (53-58) et le libellé du lien (174).

Vérification :
`pnpm --filter @crm/web test src/components/rappels/rappels-view.test.tsx`.

### E6. La supervision perd les tâches

Fichiers :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/admin.ts`,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/supervision/activity-view.tsx`.

Cette étape **dépend du contrat API** (5.3) : tant que
`SupervisionActivityRowDto` porte `tasksClosed` et que `teleconseillers[]` porte
`openTasks`, le web peut cesser de les lire sans casser la compilation, mais
l'inverse n'est pas vrai. Faire l'étape web en premier.

1. Dans `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/admin.test.ts`,
   supprimer les attentes sur `openTasks` (223-224, 260, 332) et `tasksClosed`
   (247). Dans `activity-view.test.tsx`, retirer les mêmes champs des jeux
   d'essai (39, 43-44) et ajouter un test : les en-têtes de colonnes ne
   contiennent ni « Tâches closes » ni « Reste à faire ».
2. Voir échouer.
3. Retirer les champs de `ActivityLine` et `ActivityTotals`, des deux
   constructeurs, du cumul, des moyennes et des trois lignes de CSV. Retirer les
   deux colonnes et la note de `activity-view.tsx`.

Vérification :
`pnpm --filter @crm/web test src/lib/data/admin.test.ts src/components/supervision/activity-view.test.tsx`.

### E7. L'écran Chiffres perd le reste à appeler

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chiffres/sources.ts`.

Dépend de 5.5 : la clé `reste-a-appeler` est une valeur de l'énumération
serveur `DashboardSource`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/dashboards/dto.ts:66`)
et figure dans les dispositions d'usine
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/dashboards/dashboard-layout.ts:133, 272-275`).
`SOURCES_CHIFFRES` est typé `Record<ChiffreSource, SourceChiffre>` : retirer
l'entrée côté web **avant** que l'API retire la valeur casse le typecheck.
**Faire cette étape après la modification API**, ou la faire dans le même
passage que la régénération du client.

1. Retirer l'entrée `reste-a-appeler` (140-153).
2. Retirer `'Reste à appeler'` de `COLONNES_EQUIPE` (63), la carte `restes`
   (160) et la cellule `reste` (189).

Vérification : `pnpm --filter @crm/web typecheck` puis
`pnpm --filter @crm/web test src/components/chiffres`.

### E8. Créer l'écran des lots d'export

Nouveaux fichiers, sous
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/lots/` :

- `cible.tsx` : `RadioCardGroup` et `CibleField`, déplacés depuis
  `components/phase2/campaign-target-field.tsx` avec la légende changée ;
- `lots-view.tsx` : la liste et son bouton « Nouveau lot » ;
- `lots-filters-bar.tsx` : recherche, cible, auteur, période ;
- `lot-create-dialog.tsx` : le dialogue en une étape ;
- `lot-detail-view.tsx` : en-tête, téléchargement, appels passés sur les fiches ;
- `call-recording-player.tsx` et `call-recording-player.test.tsx` : déplacés
  depuis `components/phase2/` sans modification.

Nouveaux fichiers de données :

- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/lot-filters.ts`
  (copie de `campaign-filters.ts` sans `status`) ;
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/lots.ts`
  (`fetchLots`, `fetchLot`, `createLot`, `apercuLot`, `lotExportUrl`,
  `lotExportFileName`, plus `REP_QUALIFICATION_STATUSES` repris de
  `lib/data/rep-campaigns.ts:76-81`).

Clés de cache : remplacer le bloc `query-keys.ts:56-88` par `lotsRoot`,
`lots(filters)`, `lot(id)`, `lotApercu(criteres)`.

Rebrancher les quatre pages (`chues/campagnes/page.tsx`,
`chues/campagnes/[id]/page.tsx`, `grand-public/campagnes/page.tsx`,
`grand-public/campagnes/[id]/page.tsx`) sur ces vues, en conservant les gardes
de rôles existantes (`ADMIN`, `SUPERVISEUR`, `DIRECTION`) et le `canManage`
réservé à l'`ADMIN`.

Écrire d'abord :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/lots/lots-view.test.tsx`
(la liste montre nom, cible, nombre de fiches, auteur, date et appels passés ; et
ne montre ni barre de progression ni statut) et
`lot-create-dialog.test.tsx` (le choix « Représentants » fait apparaître la
cascade et la qualification ; le dialogue ne propose aucun téléconseiller).

Vérification :
`pnpm --filter @crm/web test src/components/lots`.

### E9. Supprimer l'ancien monde

Supprimer les fichiers listés en 2.3 (verdicts SUPPRIMER et REMPLACER une fois
leur remplaçant écrit), `lib/data/rep-campaigns.ts`, `lib/rep-campaign-filters.ts`
et son test, `lib/campaign-filters.ts`, `components/stats/campaigns-panel.tsx`,
et les deux routes `chues/campagnes/representants/**`.

Nettoyer ensuite :

- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/phase2.ts` :
  ne garder que `fetchCallRecording`, `countPendingProspects`, `slugForFileName`.
  Le fichier peut alors être renommé, mais ce n'est pas nécessaire.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/phase2.test.ts` :
  supprimer les blocs `roundRobinSplit` (28), `buildCampaignPreview` (55),
  `spreadIntoDays` (104), « aperçu et étalement » (133) ; garder « note vocale »
  (15).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/types.ts` :
  retirer `CAMPAIGN_STATUS_LABELS` (232-237) et `CampaignStatus` (126).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/stat-explanations.ts` :
  retirer les six clés `campaign*` (27-32) et leurs textes (95-106).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/advanced-stats.ts` :
  retirer `fetchCampaignPilotage` et ses dérivés devenus sans appelant.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/moved-routes.ts:30` :
  `'rep-campaigns': '/chues/campagnes'`.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/reference.ts:48, 72-76` :
  brancher `campagnes` sur la route des lots, ou retirer le champ si le filtre
  disparaît (voir 5.2). Le champ est déclaré dans `lib/types.ts:348`.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/filters/filters-bar.tsx:287-288` :
  « Campagne d'appels » → « Lot d'export », « Toutes les campagnes » → « Tous les
  lots ». Et
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/filters/advanced-chips.ts:29`,
  même libellé (son test `advanced-chips.test.ts` porte l'attente).

Vérification : `pnpm --filter @crm/web typecheck && pnpm --filter @crm/web lint`
puis `pnpm dead-code` depuis la racine, pour attraper les exports devenus sans
appelant.

### E10. Gestes de consignation depuis les listes

Voir 3.5. Fichiers :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/prospects/columns.tsx`
et
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/representants/representant-detail-view.tsx`.

Écrire d'abord le test dans `columns.test.tsx` : chaque ligne porte un lien
« Consigner un appel » vers `/chues/console?fiche=<id>`.

Vérification :
`pnpm --filter @crm/web test src/components/prospects/columns.test.tsx`.

### E11. Tests de frontières et bout en bout

Voir section 6. Vérification finale, dans cet ordre :

```
pnpm --filter @crm/web typecheck
pnpm --filter @crm/web lint
pnpm --filter @crm/web test
pnpm --filter @crm/web build
```

Puis, avec l'API et la base de démonstration démarrées :
`pnpm --filter @crm/web test:e2e`.

---

## 5. Dépendances envers le contrat API

Le client `@crm/api-client` est **engendré** depuis
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/openapi.json`
(`pnpm codegen` à la racine, vérifié par `pnpm codegen:check`). Tous les types
de l'interface en dérivent : aucun DTO ne se retape à la main côté web.

### 5.1 Ressource « lot d'export » (bloquante pour E8)

Le web attend une ressource unique remplaçant `/api/v1/phase2/campaigns` et
`/api/v1/rep-campaigns`. Noms proposés, à confirmer avec le plan API :

- `GET /api/v1/lots` — paramètres `projet`, `cible`, `createdById`, `search`,
  `dateFrom`, `dateTo`, `page`, `pageSize`. Rend `LotSummaryDto` :
  `{ id, name, projet, cible: 'PROSPECTS' | 'REPRESENTANTS', scope, scopeLabel,
  fiches: number, createdAt, createdById, createdByName, appels: number,
  fichesAppelees: number, dernierAppelAt: string | null }`.
  `appels` et `fichesAppelees` sont ce que l'énoncé appelle « appels réalisés sur
  ces fiches depuis » : ils supposent que le serveur garde la liste figée des
  identifiants du lot.
- `GET /api/v1/lots/{id}` — `LotDetailDto` = `LotSummaryDto` plus les critères
  du tirage et `recentAttempts: CampaignAttemptDto[]` (le DTO existant, qui
  convient tel quel : il porte `phoneE164`, `shortCode`, `outcome`, `method`,
  `comment`, `performedByName`, `createdAt` et les renseignements de conversion).
- `POST /api/v1/lots` — `CreateLotDto`
  `{ name, projet, cible, scope?, departementId?, iefId?, relationStatuses?,
  onlyWithoutProspects? }`. Réservé à l'`ADMIN`, comme aujourd'hui.
- `GET /api/v1/lots/apercu` — même corps que la création, rend
  `{ fiches: number, scopeLabel: string }`, pour annoncer le compte avant
  validation.
- `GET /api/v1/lots/{id}/fiches.xlsx` — le classeur du lot.

Ce qui doit **disparaître** du contrat, parce que plus aucun écran web ne
l'appelle : `POST /api/v1/phase2/campaigns`,
`POST /api/v1/phase2/campaigns/{id}/close|pause|resume`,
`GET /api/v1/phase2/campaigns/{id}/commerciaux/{userId}/programme.pdf`,
`POST /api/v1/rep-campaigns`, `POST /api/v1/rep-campaigns/{id}/close`,
`GET /api/v1/rep-campaigns/preview`,
`GET /api/v1/rep-campaigns/{id}/commerciaux/{userId}/programme.pdf`,
`GET /api/v1/rep-campaigns/{id}/programmes.zip`,
`GET /api/v1/analytics/campaign-pilotage`.

**Attention, point de rupture** :
`POST /api/v1/rep-campaigns/attempts` est **le seul chemin d'écriture d'un appel
à un représentant** (`apps/web/src/lib/data/console.ts:774-779`, appelé par
`rep-script.tsx:281`). Il vit sous le préfixe `rep-campaigns` mais n'a rien d'une
campagne. Il doit **survivre**, sous ce nom ou sous un autre. S'il est renommé,
le web suit ; s'il disparaît, l'étape 1 ne peut plus rien consigner.

### 5.2 Filtre « lot » sur les prospects (non bloquante)

`GET /api/v1/prospects` accepte `campaignId` et `assignedToId`. Le web n'utilise
que `campaignId`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/filters.ts:80, 110`).
Deux issues acceptables :

- l'API garde `campaignId` et le documente comme « lot d'export » : le web ne
  change que la copie ;
- l'API le renomme `lotId` : le web renomme la clé d'URL, le chip et le libellé.

`assignedToId` n'est plus utilisé nulle part sur le web ; il peut disparaître du
contrat sans effet ici. À vérifier côté mobile.

### 5.3 Supervision (bloquante pour E6, dans ce sens)

`GET /api/v1/supervision/activite` doit cesser de rendre `tasksClosed` (par
ligne) et `openTasks` (par téléconseiller). Le web arrête de les lire en E6 ;
l'API peut ensuite les retirer sans casser le typecheck. L'ordre inverse
casserait `apps/web/src/lib/data/admin.ts`.

Le paramètre `campaignId` de cette route
(`apps/api/src/modules/analytics/supervision.dto.ts`, ajouté par le chantier
API en cours) n'est utilisé par aucun écran web : `fetchSupervisionActivite`
(`apps/web/src/lib/data/admin.ts:176-191`) n'envoie que `actFrom`, `actTo` et
`granularity`.

### 5.4 Rappels promis aux représentants (non bloquante, décision produit)

`GET /api/v1/phase2/callbacks` ne rend que des rappels de **prospects**
(`CallbackDto` porte `prospectId`). L'étape 1 permet pourtant de promettre un
rappel à un **représentant** (`rep-script.tsx:565-569`, champ `callbackAt` de
`POST /api/v1/rep-campaigns/attempts`), et l'application mobile affiche ces
rappels. Sur le web, ils sont invisibles.

Si le propriétaire veut que l'écran « Rappels promis » couvre les deux, l'API
doit soit étendre `/api/v1/phase2/callbacks` avec une `cible`, soit ouvrir
`GET /api/v1/rep-callbacks`. Sans cela, le web garde l'écran actuel, et il faut
le dire dans la copie (« rappels promis à des prospects »).

### 5.5 Cartes de l'écran Chiffres (bloquante pour E7)

`DashboardSource` est une énumération serveur
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/dashboards/dto.ts:66`)
et `SOURCES_CHIFFRES` est un `Record<ChiffreSource, …>` exhaustif. Retirer
`reste-a-appeler` doit se faire des deux côtés dans le même passage, avec
`pnpm codegen` entre les deux. Les dispositions d'usine
(`apps/api/src/modules/dashboards/dashboard-layout.ts:272-275`) et les
dispositions déjà enregistrées en base par les utilisateurs citent la clé : le
serveur doit ignorer une clé inconnue plutôt que refuser la disposition entière.

### 5.6 Export des représentants par statut de relation (bloquante pour E8, défaut existant)

`GET /api/v1/export/representants.xlsx` accepte `search`, `departementId`,
`iefId`, `commercialId`, `dateFrom`, `dateTo`, `hasProspects`. Il **n'accepte
pas** `relationStatus` : le DTO
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/representants/dto.ts:190`
ne le déclare pas, alors que `RepresentantQueryDto` (ligne 238) l'ajoute pour la
liste.

Conséquence immédiate, **indépendante de ce chantier** : la validation globale
est en `forbidNonWhitelisted: true`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/bootstrap.ts:87-98`),
et `buildRepresentantsExportUrl`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/representants-import.ts:35-46`)
recopie **tous** les critères de la liste, `relationStatus` compris
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/representants.ts:93`).
Exporter la liste des représentants avec le filtre « A accepté » actif renvoie
donc aujourd'hui un 400 `VALIDATION_FAILED`. C'est un défaut à signaler tel quel.

Or « qualifié / non qualifié » est exactement le critère de cible d'un lot de
représentants. L'API doit donc ajouter `relationStatus` (ou `relationStatuses`)
au DTO d'export.

Second point : la route est ouverte à `COMMERCIAL`, `ADMIN`, `DIRECTION`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/export/export.controller.ts:198`).
Le `SUPERVISEUR` en est exclu, alors que l'écran des lots lui est ouvert : il
verrait la liste et recevrait un 403 au téléchargement. À trancher : soit
l'export du lot passe par `GET /api/v1/lots/{id}/fiches.xlsx` avec ses propres
rôles, soit le `SUPERVISEUR` est ajouté ici.

### 5.7 Notifications et rappels quotidiens (non bloquante)

`reminders.service.ts` côté API émet encore des notifications dont la route est
`/phase2` et `/rep-campaigns`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/moved-routes.ts:27-30`,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/inbox.ts:117-124`).
Si ces rappels parlent de tâches en retard, ils disparaissent avec les tâches.
Le web garde les deux entrées de la liste blanche et des renvois quoi qu'il
arrive : les notifications déjà en base doivent continuer d'ouvrir un écran
plutôt qu'un 404.

---

## 6. Tests

### 6.1 Tests unitaires à supprimer

- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/phase2/campaign-create-dialog.test.tsx`
  (remplacé par `lot-create-dialog.test.tsx`).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/phase2/rep-campaign-create-dialog.test.tsx`
  — sauf ses deux tests de cascade région → département (93, 103) et ses trois
  tests de qualification (116, 125, 140), à **reprendre** dans
  `lot-create-dialog.test.tsx` : ce sont les critères de cible d'un lot.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/phase2/campaign-detail-view.test.tsx`
  — ses trois tests sur les renseignements de conversion (78, 86, 102) sont à
  reprendre dans `lot-detail-view.test.tsx`.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/rep-campaign-filters.test.ts`.
- Dans `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/console.test.ts` :
  blocs `sortQueue` (95), `bucketOf` (142), `buildQueue` (154), `nextAfter`
  (169), `queueLabel` (185).
- Dans `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/phase2.test.ts` :
  blocs `roundRobinSplit` (28), `buildCampaignPreview` (55), `spreadIntoDays`
  (104), « aperçu et étalement » (133).
- Dans `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/console/console-view.test.tsx` :
  bloc « ConsoleView : file » (191).
- Dans `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/console/rep-script.test.tsx` :
  test « montre la liste confiée d'abord » (146).

### 6.2 Tests à adapter

- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/layout/nav-items.test.ts` :
  intitulés attendus (309-326, 713-725, 855-868, 872-879, 937-949, 953-962) ;
  `ATTEINT_AUTREMENT` (97-111) perd `/chues/campagnes/representants` (107) ;
  `MASQUEES` (114-140) perd la même route pour `ADMIN` (118), `DIRECTION` (132)
  et `SUPERVISEUR` (136). Le test « ne garde aucun renvoi vers un écran
  disparu » (1039) rougira tant que la ligne 107 subsiste : c'est le filet de
  sécurité attendu.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/frontieres.test.ts` :
  aucune modification nécessaire, mais il **doit rester vert**. Il exige que
  chaque page du panel déclare `metadata` (58-66), qu'aucun module ne soit
  réexporté par deux pages (70-82) et que chaque page dynamique ait un
  `loading.tsx` au-dessus d'elle (86-92). Les nouvelles pages de lots doivent
  donc porter leur `metadata` ; `grand-public/campagnes/[id]/page.tsx` continue
  de réexporter la page CHUES et reste le seul à le faire.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/(panel)/chues/campagnes/access.test.tsx` :
  n'importer que deux pages au lieu de quatre (13-17), et attendre deux appels à
  `guardRoles` (31).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/moved-routes.test.ts` :
  le test « ramène chaque écran de CHUES et d'Admin à son adresse d'avant » (17)
  et « range chaque destination dans une coque » (36) rougiront si
  `rep-campaigns` pointe vers une route supprimée.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/inbox.test.ts` :
  vérifier qu'aucune attente ne dépend d'une route supprimée.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/filters/advanced-chips.test.ts` :
  libellé du chip `campaignId`.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chues/etapes.test.tsx:107` :
  le test « disparaît sur les écrans qui ne sont pas une étape » utilise le
  segment `campagnes` ; il reste valable.

### 6.3 Tests à écrire

- `apps/web/src/components/lots/lots-view.test.tsx` : la liste nomme la cible en
  clair, chiffre les fiches et les appels passés, et ne montre ni statut, ni
  barre de progression, ni nombre de téléconseillers.
- `apps/web/src/components/lots/lot-create-dialog.test.tsx` : le dialogue ne
  propose aucun téléconseiller ; choisir « Représentants » fait apparaître la
  cascade et la qualification ; le compte de fiches vient du serveur et
  s'affiche avant la validation.
- `apps/web/src/components/lots/lot-detail-view.test.tsx` : en-tête, bouton de
  téléchargement, liste des appels avec leurs renseignements ; aucun bouton de
  clôture, de pause ni de reprise.
- `apps/web/src/components/console/console-view.test.tsx` : ouverture sur la
  recherche, ouverture d'une fiche choisie, retour à la liste après
  enregistrement.
- Un test de garde, dans le style de
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/vocabulaire.test.ts`,
  qui balaie `src` et refuse dans un texte affiché les expressions « file
  d'appel », « liste d'appel », « tâche d'appel », « distribuer les appels »,
  « reste à faire ». C'est le seul moyen d'empêcher le vocabulaire de revenir
  par un écran non couvert. À faire au moment où le reste est vert, sinon il
  rougit partout à la fois.

### 6.4 Playwright

Racine : `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/e2e/`.

- `workspaces.spec.ts` : supprimer `closeLeftoverCampaigns` (28-46) et les cinq
  tests de campagne (170-354). Écrire à la place un parcours de lot : création,
  compte annoncé, téléchargement du classeur, présence dans la liste. La
  vérification de la signature ZIP `PK\x03\x04` (`readMagic`, 49-56) se
  réutilise telle quelle.
- `accessibility.spec.ts:32-34` et `prospects.spec.ts:122-127` : les entrées
  `/campagnes/representants` disparaissent ; `/campagnes` change de titre
  attendu ; `/console` perd « Carte clavier » si la carte change.
- `redirections.spec.ts:37-38` : `/campagnes/representants` doit désormais
  aboutir sur `/chues/campagnes`.
- `roles.anon.spec.ts:240-241` : la route supprimée ne peut plus être testée en
  refus de permission ; retirer ce bloc. Lignes 342-343 : ne garder que
  `/chues/campagnes`.
- `roles.anon.spec.ts:296-303` : ce test attend encore les intitulés numérotés
  « 1 · Appeler les représentants », « 2 · Noter un prospect », « 3 · Appeler les
  prospects » et « Mes prospects », qui n'existent plus dans `nav-items.ts`
  (labels actuels : « Qualifier un représentant », « Ajouter un prospect »,
  « Convertir un prospect », « Prospects »). **Ce test est déjà rouge avant ce
  chantier** ; le corriger au passage ou le signaler au propriétaire.
- `fixtures.ts:11` : le commentaire sur le segment tiré par la création de
  campagne perd son objet.

---

## 7. Risques et questions ouvertes

### 7.1 Bloquantes

1. **Nom et forme de la ressource « lot ».** E8 ne peut pas commencer avant que
   le plan API tranche entre une nouvelle ressource `/api/v1/lots` et la
   réutilisation de `/api/v1/phase2/campaigns` allégée. Le web s'adapte aux
   deux ; il lui faut un contrat, pas une préférence.
2. **`POST /api/v1/rep-campaigns/attempts` doit survivre.** C'est le seul chemin
   d'écriture d'un appel à un représentant, sur le web comme sur le mobile. Le
   supprimer avec les campagnes casserait l'étape 1 en silence, puisqu'aucun
   test unitaire ne touche le réseau.
3. **`relationStatus` absent du DTO d'export des représentants** (5.6). Sans
   lui, un lot « représentants non qualifiés » ne peut pas être téléchargé, et
   l'export existant de la liste des représentants renvoie déjà un 400 quand le
   filtre de relation est actif.
4. **Rôle `SUPERVISEUR` et téléchargement** (5.6). L'écran des lots lui est
   ouvert, l'export des représentants ne l'est pas. À trancher avant E8.
5. **Retrait de `reste-a-appeler` de `DashboardSource`** (5.5) : les deux côtés
   dans le même passage, avec `pnpm codegen` entre.

### 7.2 Non bloquantes, à décider

6. **Route `/chues/campagnes` ou `/chues/lots` ?** Ce plan garde l'URL actuelle
   et ne change que l'intitulé, pour ne pas ajouter une troisième forme aux
   renvois de notifications. Un mot du propriétaire suffit à basculer.
7. **Rappels promis à des représentants** (5.4) : invisibles sur le web
   aujourd'hui. Soit on étend le contrat, soit on le dit dans la copie.
8. **Compteurs de l'écran d'ouverture** : faut-il garder « X pas encore
   qualifiés » et « X ont accepté, sans contacts notés » ? Ce plan les garde
   comme chiffres de la base, sans pastille de priorité. Ils restent malgré tout
   lisibles comme « ce qu'il reste à faire ». Si le propriétaire veut les
   supprimer, l'écran d'ouverture devient trois cartes sans chiffre, sauf les
   rappels dus.
9. **Palette `Ctrl/Cmd K` de la console** : ce plan la supprime au profit du
   champ de recherche. Un utilisateur habitué au raccourci le perdra.
10. **Enchaînement automatique** : « Enregistré. Personne suivante. » disparaît.
    Sur une session de plusieurs dizaines d'appels, le retour à la recherche
    coûte une saisie de plus par appel. C'est le prix de la décision ; à
    confirmer avec ceux qui passent les appels.

### 7.3 Risques d'exécution

11. **L'arbre de travail bouge.** Pendant l'audit, un chantier « Chiffres »
    concurrent a supprimé `components/stats/statistics-view.tsx`,
    `components/stats/teleconseil-panel.tsx`,
    `components/dashboard/dashboard-view.tsx` et `lib/data/stats-layout.ts`, et
    réécrit `components/layout/nav-items.ts`. Les numéros de ligne de ce document
    étaient exacts au moment de la lecture ; **relire chaque fichier avant de
    l'éditer**.
12. **Orphelines déjà présentes.** `components/stats/campaigns-panel.tsx`,
    `components/stats/banks-panel.tsx` et `components/dashboard/funnel-panel.tsx`
    n'ont plus d'importateur depuis la refonte « Chiffres ». Seule la première
    relève de ce chantier ; ne pas supprimer les deux autres sans en parler au
    chantier concerné, et se fier à `pnpm dead-code` pour l'inventaire réel.
13. **Ampleur de E4.** `console-view.tsx` fait 944 lignes, dont environ la
    moitié disparaît. La réécriture est l'étape la plus risquée du chantier :
    la mener seule, tests d'abord, sans y mêler d'autre changement.
14. **Aucune vérification exécutée.** Ce document est un audit statique : ni
    `typecheck`, ni `lint`, ni `test`, ni `build` n'ont été lancés, et
    l'extension navigateur n'était pas disponible. Toutes les commandes citées
    en section 4 restent à exécuter par celui qui applique le plan.
15. **Cloisonnement serveur.** Retirer une file de l'interface ne retire aucun
    droit : `scope.ts` côté API borne déjà chaque liste au périmètre du
    demandeur. Vérifier néanmoins qu'un `COMMERCIAL` qui cherche librement dans
    l'annuaire et dans les prospects voit bien ce que le propriétaire veut qu'il
    voie, et pas la base nationale entière. C'est une question de contrat, pas
    d'interface.

---

Auteur : frontend-engineer (audit web)
