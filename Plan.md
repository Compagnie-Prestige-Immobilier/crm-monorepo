# Retrait des listes d'appel : la campagne devient un lot d'export

Ce document est autonome. Il s'adresse à qui exécutera le chantier sans autre
source. Tout ce qu'il faut savoir est ici : la décision produit, les décisions
qui restent à prendre, le contrat cible, l'ordre des travaux, les inventaires
fichier par fichier, les tests, les limites du périmètre.

Racine du dépôt : `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo`.
Les tableaux d'inventaire déclarent un chemin absolu en en-tête, puis citent des
numéros de ligne dans ce fichier.

---

## 0. Préambule

### 0.1 La décision du propriétaire

Le CRM gère aujourd'hui des **campagnes d'appels**. Un administrateur tire un
lot de fiches, le serveur les répartit en tourniquet entre des téléconseillers
nommés, et chacun reçoit une **liste d'appel** : une tâche par fiche
(`CallTask` pour les prospects, `RepCallTask` pour les représentants), avec
assignation, position, jour, statut. De là découlent les files « À appeler »,
les compteurs « pas encore contacté », « prochain contact », « reste à faire »,
la progression de campagne, le pilotage, et les programmes PDF imprimés par
personne.

**Le propriétaire arrête cela. On ne consigne plus qui doit appeler qui.**

- Téléconseillers, superviseurs et direction **cherchent librement** dans
  l'annuaire des représentants et dans la base des prospects, sur le web comme
  sur le mobile.
- Ils **consignent leurs appels** (`CallAttempt`, `RepCallAttempt`) et
  **promettent des rappels** (`ScheduledCallback`). Ces trois objets restent :
  ce sont des faits, pas des intentions distribuées.
- Une **campagne** ne subsiste que côté web, comme un **lot d'export** : on
  choisit une cible (projet, département ou IEF, statut de relation qualifié ou
  non qualifié, segment), on télécharge les fiches **en Excel, en PDF fiche par
  fiche, et en ZIP de tous les PDF du lot**, pour les **représentants comme pour
  les prospects** (le PDF imprimé reste utilisé sur le terrain), et
  l'administration suit le lot : qui l'a créé, quand, combien de fiches, et
  combien d'appels ont eu lieu sur ces fiches depuis.
- **Aucune assignation, aucune tâche, aucune file, nulle part.**
- **Le mobile ne voit plus ni campagne ni tâche.**

Cette décision n'est pas rediscutable. Ce qui reste à trancher est en §1.

### 0.2 Le dépôt

Monorepo pnpm 11.15.1, Node >= 24.18.0, Turborepo.

| Élément     | Emplacement                                                                                | Pile                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| API         | `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api`                               | NestJS 11 sur Fastify, Prisma 7, PostgreSQL                                                                                       |
| Web         | `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web`                               | Next.js 16 App Router, React 19, Tailwind v4, Base UI, TanStack Query et Table, react-hook-form + zod, vitest, Playwright, oxlint |
| Mobile      | `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile`                            | Flutter 3.41.7 (FVM), Riverpod 3, go_router 17, drift 2.33, ForUI 0.21, icônes Phosphor, Android seul                             |
| Schéma      | `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/database/prisma/schema.prisma` | Prisma                                                                                                                            |
| Contrat     | `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/openapi.json`                  | engendré                                                                                                                          |
| Client TS   | `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/api-client`                    | engendré                                                                                                                          |
| Client Dart | `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/api-client-dart`               | engendré                                                                                                                          |

Les deux clients ne se modifient **jamais** à la main : ils sortent de
`pnpm codegen`.

### 0.3 Commandes de vérification

Depuis la racine, sauf mention contraire.

```bash
# API
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api lint
pnpm --filter @crm/api test
pnpm --filter @crm/api test -- <motif>
pnpm --filter @crm/api test:integration    # exige PostgreSQL sur DATABASE_URL
                                           # (défaut postgresql://crm:crm@localhost:5434/crm)

# Base
pnpm db:migrate     # prisma migrate dev, base de développement
pnpm db:generate
pnpm --filter @crm/database typecheck

# Web
pnpm --filter @crm/web typecheck
pnpm --filter @crm/web lint
pnpm --filter @crm/web test
pnpm --filter @crm/web test <chemin/du/fichier.test.tsx>
pnpm --filter @crm/web build
pnpm --filter @crm/web test:e2e            # exige l'API et la base de démonstration démarrées

# Mobile, depuis /Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter analyze
dart format --output=none --set-exit-if-changed lib/ test/
flutter test
flutter test test/<chemin>_test.dart
# Flutter est piloté par FVM (apps/mobile/.fvmrc). Si `flutter` n'est pas la
# 3.41.7, préfixer chaque commande par `fvm `.

# Contrat, après TOUT changement de DTO, de route ou d'enum exposé
pnpm codegen && pnpm codegen:check

# Dépôt entier
pnpm verify:local     # format:check, lint, dead-code, typecheck, test, codegen:check
pnpm test:integration
pnpm dead-code
```

`pnpm codegen:check` échoue si le contrat engendré n'a pas été réécrit après un
changement (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/package.json:38`).

### 0.4 Règles d'écriture du dépôt

- Modifier un fichier existant avec `Edit`, en créer un avec `Write`. **Jamais**
  `sed`, `cat`, un heredoc, une redirection shell ni un script Python pour
  écrire du code.
- **Commentaires rares.** Un commentaire ne se justifie que si le code ne PEUT
  pas porter l'information : contrainte externe, choix contre-intuitif, piège
  que le prochain lecteur reproduirait. Une à deux lignes. Interdits : bandeaux,
  séparateurs graphiques, paragraphes, narration, redite de la ligne. Au-delà de
  15 % de lignes de commentaire, le fichier est à réécrire
  (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/AGENTS.md:67`).
- **Copie française sobre**, sans jargon et **sans tiret cadratin**
  (`AGENTS.md:31`). Un état vide dit quoi faire ensuite. Une erreur dit ce qui
  s'est passé et ce que le lecteur peut faire.
- **Vocabulaire figé**, gardé par
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/vocabulaire.test.ts` :
  on écrit `teleconseiller`, jamais « commercial » dans un texte affiché. Les
  mots « phase », « pilotage », « console » sont interdits dans les intitulés de
  la barre latérale
  (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/layout/nav-items.test.ts:989`).
- **Composants existants d'abord.** Web : `apps/web/src/components/ui/*` puis
  les primitives Base UI. Mobile : widgets `Cpi*`
  (`apps/mobile/lib/ui/widgets/cpi_kit.dart`) et ForUI, icônes Phosphor, tailles
  par `CpiIconSize`, espacements par `CpiSpacing`. API : `ExcelJS`, `JSZip`,
  `pdfkit` sont déjà en place. **Aucune dépendance nouvelle n'est nécessaire
  pour ce chantier.**
- Un lien n'est jamais un bouton : `Link` habillé par `buttonVariants(...)`,
  jamais `<Button render={<a/>}>`
  (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chues/hub-view.tsx:221`).
- Aucune constante lue par une page serveur ne vit dans un module `'use client'` :
  la page reçoit une référence client, pas la valeur. C'est ce qui a fait
  planter `/chues`, d'où
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chues/hub-filters.ts:1`.
- **Rouge avant vert.** Un test qu'on n'a pas vu rougir n'a rien prouvé : casser
  le code qu'il couvre, vérifier l'échec, remettre (`AGENTS.md:54`).
- **Aucun commit sans demande explicite.** Jamais `git stash`, `git checkout`,
  `git restore`. Pas de build Android, pas d'émulateur. Ne pas arrêter les
  serveurs de développement des ports 3000 et 3001.
- Ne pas toucher `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/references/`.

### 0.5 L'arbre de travail bouge

**L'arbre porte du travail non commité d'autres chantiers** : écran Chiffres
(qui a supprimé `apps/web/src/components/stats/statistics-view.tsx`,
`stats/teleconseil-panel.tsx`, `dashboard/dashboard-view.tsx`,
`lib/data/stats-layout.ts`, réécrit `apps/web/src/components/layout/nav-items.ts`
et ajouté `apps/api/src/modules/dashboards/`), rappels mobile (alarmes,
`rep_callback_notifications.dart`, `rappels_screen.dart`,
`representant_qualification_screen.dart`, `test/features/rappel_alarme_test.dart`),
correctif de l'espace démo, plus des modifications en cours sur
`apps/api/src/modules/analytics/supervision.service.ts`, `supervision.dto.ts`,
`analytics.controller.ts`, `analytics.module.ts`,
`apps/api/src/common/guards/role-routes.test.ts` et
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/.env.example`.

**Conséquence : relire chaque fichier avant de l'éditer. Les numéros de ligne de
ce document sont indicatifs.** En cas de doute, retrouver la ligne par le texte
cité, jamais par son numéro. Ne jamais réécrire avec `Write` un fichier qui
porte déjà des modifications non commitées. Ne rien annuler.

Fichiers à préserver absolument, écrits par d'autres et hors périmètre :
`apps/mobile/lib/core/notifications/**`, `apps/mobile/lib/features/notifications/**`,
`apps/mobile/lib/features/rappels/**`,
`apps/mobile/lib/features/permissions/**`,
`apps/mobile/lib/features/representant/presentation/representant_qualification_screen.dart`,
`apps/mobile/android/app/src/main/AndroidManifest.xml`,
`apps/mobile/test/features/rappel_alarme_test.dart`.

---

## 1. Décisions à prendre par le propriétaire avant de commencer

Les quatre décisions bloquantes D1 à D4 sont **prises** (voir « Décision
prise » sous chacune) : l'exécutant les applique telles quelles. Dix autres se
prennent en chemin ; leur valeur par défaut est indiquée.

### Bloquantes

#### D1. D'où vient le projet d'un appel de prospect ?

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/phase2/phase2-sync.service.ts:128`
écrit aujourd'hui :

```ts
const projet = activeTask?.campaign.projet ?? prospect.projet;
```

La phase 2 est un état du **parcours**, pas de la fiche : un prospect refusé en
CHUES reste appelable en Grand Public, et c'est la campagne qui disait lequel
des deux parcours l'appel faisait avancer (commentaire `:121` à `:127`). Sans
campagne, il ne reste que le projet d'**entrée** de la fiche : un appel passé au
titre du Grand Public sur une fiche entrée en CHUES ferait avancer le parcours
CHUES, et le parcours Grand Public d'une fiche à deux parcours deviendrait
inatteignable par téléphone.

| Option                                                                                                             | Coût                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Le client déclare le projet dans la tentative (`CallAttemptOpDto.projet?: Projet`, repli sur `prospect.projet`) | Un champ de plus au contrat de poussée (`apps/api/src/modules/phase2/dto.ts:392`, `apps/api/src/modules/sync/dto.ts:103`), une valeur de plus à émettre côté web et mobile                              |
| 2. Le projet reste celui de la fiche                                                                               | Les fiches à deux parcours ne progressent plus que sur leur parcours d'entrée. Volume mesurable : `SELECT COUNT(*) FROM (SELECT "prospectId" FROM prospect_journeys GROUP BY 1 HAVING COUNT(*) > 1) t;` |
| 3. Le serveur choisit le parcours encore `PENDING`, et lève un `409` s'il y en a deux                              | Une règle implicite de plus, et un conflit que l'écran doit savoir expliquer                                                                                                                            |

**Décision prise : option 1.** Le client déclare le projet dans la tentative :
le web le connaît par le chemin (`/chues/…` ou `/grand-public/…`), le mobile par
l'écran d'où part l'appel. Repli serveur sur `prospect.projet` si le champ est
absent (anciens clients).

#### D2. Que voit un téléconseiller, sur le web et sur le téléphone ?

Sans tâche, la portée par assignation disparaît. Deux endroits en dépendent.

**Lecture web.** `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/common/scope.ts:38`
borne aujourd'hui un téléconseiller à ses fiches et à celles qu'une campagne lui
a confiées. La décision produit dit « cherche librement », donc toute la base.
Confirmer que c'est bien voulu : un téléconseiller lira le portefeuille national.

**Pull mobile.** `scope.ts:50` explique pourquoi la portée de synchronisation
est plus étroite que celle de l'écran : « lire le travail de tous à l'écran est
une chose, en tirer le portefeuille national sur un appareil en est une autre ».
Le pull est borné par les tâches à
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/sync/sync.service.ts:210`
et la garde d'écriture à `:807`. Sans elles, il ne reste que
`createdById = moi` : sur un appareil neuf, le téléconseiller n'aurait presque
rien à chercher.

| Option                                                                                                                                                                                                             | Effet                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Le pull descend **tous** les prospects, comme il descend déjà tout l'annuaire des représentants (`sync.service.ts:195`)                                                                                         | Cohérent, marche hors ligne. Risque : volume (le commentaire `schema.prisma:944` évoque 120 000 fiches) et surface de données personnelles sur un téléphone perdu |
| 2. Le pull reste borné aux fiches de l'appelant, la recherche libre passe par une route **en ligne** paginée, sur le modèle de `GET /v1/phase2/directory` (`apps/api/src/modules/phase2/phase2.controller.ts:120`) | La recherche de prospect ne marche plus hors ligne                                                                                                                |
| 3. Une borne géographique (département, IEF)                                                                                                                                                                       | À définir entièrement ; ni le web ni le mobile n'ont ce filtre aujourd'hui                                                                                        |

Chiffre à obtenir avant de trancher, sur la base réelle :
`SELECT COUNT(*) FROM prospects WHERE "deletedAt" IS NULL;`

**Décision prise : option 1, bornée au projet.** Sur le web, un téléconseiller
lit toute la base du projet de sa coque. Sur le téléphone, le pull descend tous
les prospects vivants du projet CHUES (comme il descend déjà tout l'annuaire des
représentants), et le téléconseiller les cherche hors ligne. Garde-fou : si
`SELECT COUNT(*) FROM prospects WHERE "deletedAt" IS NULL AND projet = 'CHUES'`
dépasse 30 000 en production, basculer sur l'option 2 (recherche en ligne
paginée) sans changer le web. `GET /v1/phase2/directory` reste dans tous les
cas.

#### D3. Le retrait de la carte « Reste à appeler » de l'écran Chiffres

`reste-a-appeler` est une valeur de l'énumération serveur `DashboardSource`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/dashboards/dto.ts:66`),
citée par les dispositions d'usine
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/dashboards/dashboard-layout.ts:133`, `:272`)
et **par les dispositions déjà enregistrées en base par les utilisateurs**.
Côté web, `SOURCES_CHIFFRES` est un `Record<ChiffreSource, SourceChiffre>`
exhaustif
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chiffres/sources.ts:140`) :
retirer l'entrée d'un seul côté casse le typecheck.

Options : retirer la clé des deux côtés dans le même passage, avec
`pnpm codegen` entre les deux, **et** faire que le serveur ignore une clé
inconnue au lieu de refuser la disposition entière ; ou garder la clé et rendre
zéro, ce qui laisse une carte menteuse à l'écran.

**Décision prise : la carte reste, redéfinie sur les statuts et non sur les
tâches.** « Reste à appeler » = nombre de représentants vivants du projet qui
n'ont encore **aucune réponse consignée** (aucune tentative `REACHED` ni
`REFUSED`, `relationStatus = INCONNU`). Le chiffre part du total de l'annuaire
et décroît à mesure que les gens sont joints ; il ne dépend d'aucune
assignation. Même définition côté prospects si la carte est servie hors CHUES :
prospects sans aucune tentative. La clé `reste-a-appeler` de `DashboardSource`
est conservée, seule sa source de données change ; les dispositions
enregistrées ne bougent pas. Le serveur tolère malgré tout une clé inconnue
(ignorée, pas refusée), pour les retraits futurs.

#### D4. Que devient le filtre « campagne » sur la liste des prospects ?

`ProspectFilterDto` porte `campaignId`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/common/dto/prospect-filter.dto.ts:144`)
et `assignedToId` (`:155`). Le web n'utilise que le premier
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/filters.ts:80`, `:110`),
sous le libellé « Campagne d'appels ». `assignedToId` n'est utilisé nulle part.

| Option                                                       | Coût                                                                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Les deux filtres disparaissent du contrat                 | Le web perd le chip, la barre de filtres et le champ `ReferenceData.campagnes` (`apps/web/src/lib/types.ts:348`). Personne ne peut plus lister « les prospects du lot X » |
| 2. `campaignId` devient `lotId` et pointe `lot_export_items` | Un `WHERE` de plus, un `LEFT JOIN` sur une table qui peut peser des millions de lignes (voir D12), et un filtre que seul l'encadrement sait lire                          |

**Décision prise : `campaignId` disparaît ; `assignedToId` est remplacé par
`appelePar` (identifiant de téléconseiller).** Le filtre « Appelé par » borne
la liste aux fiches sur lesquelles ce téléconseiller a consigné au moins une
tentative (`call_attempts.performedById` pour les prospects,
`rep_call_attempts.performedById` pour les représentants, même filtre sur
`GET /v1/representants`). C'est ce qui remplace « assigné à » : on ne sait plus
qui _devait_ appeler, on sait qui _a_ appelé. Le chip « Campagne d'appels » et
`ReferenceData.campagnes` partent ; le chip « Appelé par » prend leur place, avec
la liste des téléconseillers déjà servie à l'écran « Mon équipe ».

### À trancher, non bloquantes

#### D5. Renommer l'URL `/chues/campagnes` ?

L'intitulé de la barre latérale devient « Lots d'export » dans tous les cas.
L'URL est autre chose : `/campagnes`, `/chues/campagnes` et `/phase2` figurent
déjà dans des notifications enregistrées en base, que rattrapent la liste
blanche
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/inbox.ts:85`
et la table de renvois
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/moved-routes.ts:8`.
**Par défaut, l'URL `/chues/campagnes` est conservée** : renommer en
`/chues/lots` ajouterait une troisième forme partout pour un gain nul, puisque
l'utilisateur lit l'intitulé et non l'adresse. Basculer coûte une ligne dans
`MOVED_ROUTES` et deux dans `WEB_ROUTES`.

#### D6. Renommer les chemins API qui parlent encore de campagne ?

`POST /v1/rep-campaigns/attempts`, `GET /v1/phase2/callbacks`,
`GET /v1/phase2/directory` gardent un nom faux. Les renommer casse le web et le
mobile en même temps que le reste ; les garder laisse un vocabulaire mort dans
le contrat. **Par défaut : ne rien renommer dans ce chantier**, ouvrir un
chantier de renommage ensuite. Côté mobile le renommage serait une régénération
pure, deux lignes touchées
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/sync/dio_api.dart:58`
et `:176`) ; côté web, une constante d'URL.

#### D7. Perd-on le lien entre un appel passé et sa campagne ?

Supprimer `call_attempts.campaignId` et `rep_call_attempts.campaignId` rend
impossible de répondre à « quels appels appartenaient à la campagne d'avril ».
Les tentatives elles-mêmes restent, avec leur auteur et leur date. Alternative :
garder les deux colonnes en `String?` sans clé étrangère, comme trace morte, au
prix de deux colonnes que le prochain lecteur croira vivantes.
**Recommandation : perte assumée.**

#### D8. Les rappels promis à un représentant restent invisibles sur le web ?

`GET /v1/phase2/callbacks` ne rend que des rappels de **prospects**
(`CallbackDto` porte `prospectId`). L'étape 1 permet pourtant de promettre un
rappel à un **représentant**
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/console/rep-script.tsx:565`,
champ `callbackAt`), et le mobile les affiche. Soit on étend le contrat (une
`cible` sur `/v1/phase2/callbacks`, ou un `GET /v1/rep-callbacks`), soit on le
dit dans la copie : « rappels promis à des prospects ».
**Recommandation : le dire dans la copie maintenant, étendre plus tard.**

#### D9. Garde-t-on les compteurs de l'écran d'ouverture CHUES ?

Ce plan garde « X pas encore qualifiés » et « X ont accepté, sans contacts
notés » comme chiffres de la base, sans pastille de priorité. Ils restent
malgré tout lisibles comme « ce qu'il reste à faire ». Si le propriétaire les
veut supprimés, l'écran devient trois cartes sans chiffre, sauf les rappels dus.

#### D10. La palette `Ctrl/Cmd K` de l'écran de conversion

Ce plan la supprime, redondante avec le champ de recherche. Un utilisateur
habitué au raccourci le perdra.

#### D11. L'enchaînement automatique « Enregistré. Personne suivante. »

Il disparaît : après enregistrement, retour à la recherche. Sur une session de
plusieurs dizaines d'appels, cela coûte une saisie de plus par appel. C'est le
prix de la décision. À confirmer avec ceux qui passent les appels.

#### D12. Rétention des lignes de lot

Un lot de 120 000 représentants écrit 120 000 lignes dans `lot_export_items`.
Dix lots par mois font 14 millions de lignes par an, sans purge automatique. Le
catalogue de purge expose les deux nouvelles étapes (§4.1.7) ; il faut décider
d'une durée de conservation. Pas bloquant pour la première livraison.

#### D13. Le programme papier existe-t-il encore ?

`spread_days`, `position` et `day_index` venaient du PDF distribué aux
téléconseillers. Si ce document circule encore sur le terrain, les deux supports
divergeront le jour de la livraison. Question métier.

#### D14. Veut-on un journal des appels consignés sur le mobile ?

Il n'en existe aucun aujourd'hui (§6). Chantier distinct, à cadrer séparément.

---

## 2. Contrat partagé

Le plan API fait foi pour les noms. Les écarts avec ce que le web et le mobile
supposaient sont signalés par **écart** dans la dernière colonne.

### 2.1 Routes

Préfixe `/api/v1` partout.

| Route                                                           | Avant                                                       | Après                                                                                | Note                                                                                                                                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /phase2/campaigns`                                         | `listCallCampaigns`, ADMIN COMMERCIAL SUPERVISEUR DIRECTION | supprimée                                                                            |                                                                                                                                                                                    |
| `POST /phase2/campaigns`                                        | `createCallCampaign`, ADMIN                                 | supprimée                                                                            | remplacée par `POST /lots-export`                                                                                                                                                  |
| `GET /phase2/campaigns/{id}`                                    | `getCallCampaign`                                           | supprimée                                                                            |                                                                                                                                                                                    |
| `POST /phase2/campaigns/{id}/close                              | pause                                                       | resume`                                                                              | ADMIN                                                                                                                                                                              | supprimées                 | un lot n'a pas d'état |
| `GET /phase2/campaigns/{id}/commerciaux/{userId}/programme.pdf` | `downloadCallProgrammePdf`                                  | supprimée                                                                            | programme nominatif                                                                                                                                                                |
| `GET /phase2/directory`                                         | `pullPhase2Directory`, PARCOURS_ROLES                       | **inchangée**                                                                        | annuaire hors ligne, ne touche aucune tâche                                                                                                                                        |
| `POST /phase2/call-attempts/{id}/recording`                     | PARCOURS_ROLES                                              | **inchangée**                                                                        |                                                                                                                                                                                    |
| `GET /phase2/call-attempts/{id}/recording`                      | ADMIN SUPERVISEUR DIRECTION COMMERCIAL                      | **inchangée**                                                                        |                                                                                                                                                                                    |
| `GET /phase2/callbacks`                                         | `listScheduledCallbacks`                                    | **transformée**                                                                      | `CallbackDto` perd `campaignId` et `taskId`                                                                                                                                        |
| `POST /phase2/callbacks/{id}/cancel`                            | `cancelScheduledCallback`                                   | **transformée**                                                                      | même retrait                                                                                                                                                                       |
| `GET /rep-campaigns/preview`                                    | `previewRepCampaign`, ADMIN                                 | remplacée par `GET /lots-export/apercu`                                              | perd `perCommercial` et `perDay`                                                                                                                                                   |
| **`POST /rep-campaigns/attempts`**                              | `recordRepCallAttempt`, PARCOURS_ROLES                      | **conservée, chemin inchangé**                                                       | **seul chemin qui consigne un appel à un représentant, sur le web comme sur le mobile. Ne jamais la supprimer.** La réponse perd `taskId` et `taskClosed`. Renommage éventuel : D6 |
| `GET /rep-campaigns`                                            | `listRepCampaigns`                                          | supprimée                                                                            |                                                                                                                                                                                    |
| `POST /rep-campaigns`                                           | `createRepCampaign`                                         | supprimée                                                                            |                                                                                                                                                                                    |
| `GET /rep-campaigns/{id}`                                       | `getRepCampaign`                                            | supprimée                                                                            |                                                                                                                                                                                    |
| `POST /rep-campaigns/{id}/close`                                | `closeRepCampaign`                                          | supprimée                                                                            |                                                                                                                                                                                    |
| `GET /rep-campaigns/{id}/commerciaux/{userId}/programme.pdf`    | `downloadRepProgrammePdf`                                   | supprimée                                                                            |                                                                                                                                                                                    |
| `GET /rep-campaigns/{id}/programmes.zip`                        | `downloadRepProgrammesZip`                                  | supprimée                                                                            |                                                                                                                                                                                    |
| `GET /analytics/campaign-pilotage`                              | `getCampaignPilotage`                                       | supprimée                                                                            | tout son contenu compte des tâches ; `attempts`, `reachRate` et `methodsObtained` sont déjà rendus par `GET /supervision/activite`                                                 |
| `GET /analytics/delays`                                         | `getAnalyticsDelays`                                        | **inchangée**                                                                        | ne lit ni tâche ni campagne                                                                                                                                                        |
| `GET /supervision/activite`                                     | `getSupervisionActivite`                                    | **transformée**                                                                      | voir §2.3                                                                                                                                                                          |
| `GET /admin/supervision`                                        | `getSupervision`                                            | **inchangée**                                                                        | présence calculée sur `refreshToken`, `syncBatch`, `callAttempt`, `bankCaseTransition`, `agentHeartbeat`                                                                           |
| `GET                                                            | POST /admin/purge`                                          |                                                                                      | **transformées**                                                                                                                                                                   | nouveau catalogue d'étapes |
| `GET /export/representants.xlsx`                                | COMMERCIAL ADMIN DIRECTION                                  | **transformée**                                                                      | accepte `relationStatus`, `whatsappStatus`, `hasWhatsapp` ; **ouverte au SUPERVISEUR**                                                                                             |
| `GET /export/prospects.xlsx`                                    |                                                             | **inchangée**                                                                        |                                                                                                                                                                                    |
| `POST /lots-export`                                             | absente                                                     | `createLotExport`, **ADMIN**, `201`                                                  |                                                                                                                                                                                    |
| `GET /lots-export/apercu`                                       | absente                                                     | `previewLotExport`, ADMIN                                                            |                                                                                                                                                                                    |
| `GET /lots-export`                                              | absente                                                     | `listLotsExport`, ADMIN SUPERVISEUR DIRECTION                                        |                                                                                                                                                                                    |
| `GET /lots-export/{id}`                                         | absente                                                     | `getLotExport`, ADMIN SUPERVISEUR DIRECTION, `404 LOT_EXPORT_NOT_FOUND`              |                                                                                                                                                                                    |
| `GET /lots-export/{id}/export.xlsx`                             | absente                                                     | `downloadLotExportXlsx`, ADMIN SUPERVISEUR DIRECTION                                 | **écart** : le web attendait `GET /lots/{id}/fiches.xlsx`                                                                                                                          |
| `GET /lots-export/{id}/fiches/{itemId}.pdf`                     | absente                                                     | `downloadLotExportFichePdf`, **obligatoire**, cibles `REPRESENTANTS` et `PROSPECTS`  | une fiche imprimable (A4), réutilise `writeRepProgrammePdf` de `programme-pdf.ts:360` déplacé dans le module lots et généralisé aux prospects                                      |
| `GET /lots-export/{id}/fiches.zip`                              | absente                                                     | `downloadLotExportFichesZip`, **obligatoire**, cibles `REPRESENTANTS` et `PROSPECTS` | tous les PDF du lot, un fichier par fiche, en flux (`JSZip` déjà en place)                                                                                                         |

**Écart de nommage tranché** : le web supposait une ressource `/api/v1/lots`
avec `LotSummaryDto { fiches, appels, dernierAppelAt }`. Le nom retenu est
`lots-export`, le DTO `LotExportSummaryDto`, les champs `itemCount`,
`callsSince`, `fichesAppelees`. Le web s'aligne.

**Ouverture au SUPERVISEUR** : le commentaire
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/export/export.controller.ts:194`
dit aujourd'hui « Le SUPERVISEUR consulte, il n'emporte pas l'annuaire national
dans un classeur ». La décision produit l'ouvre. **Réécrire ce commentaire dans
le même geste**, sinon le code contredit sa propre justification.

**Défaut existant à corriger au passage** : la validation globale est en
`forbidNonWhitelisted: true`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/bootstrap.ts:87`)
et `buildRepresentantsExportUrl`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/representants-import.ts:35`)
recopie tous les critères de la liste, `relationStatus` compris. Exporter la
liste des représentants avec le filtre « A accepté » actif renvoie donc
**aujourd'hui** un `400 VALIDATION_FAILED`. L'ajout des trois filtres le règle.

### 2.2 DTO

| DTO                            | Champs retirés                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Champs ajoutés                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `CallbackDto`                  | `campaignId`, `taskId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |                                                                |
| `RepCallAttemptResultDto`      | `taskId`, `taskClosed`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |                                                                |
| `CallAttemptResultDto`         | `taskId`, `taskStatus`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | (n'apparaît pas dans `openapi.json`, aucun impact contractuel) |
| `SupervisionQueryDto`          | `campaignId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                                                                |
| `SupervisionActivityCountsDto` | `tasksClosed`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                |
| `SupervisionTeleconseillerDto` | `openTasks`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |                                                                |
| `ProspectFilterDto`            | `campaignId`, `assignedToId` (D4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |                                                                |
| `SyncChangesDto`               | `callCampaigns`, `callTasks`, `repCallCampaigns`, `repCallTasks`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |                                                                |
| `RepresentantExportQueryDto`   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `relationStatus`, `whatsappStatus`, `hasWhatsapp`              |
| Supprimés en entier            | `CreateCampaignDto`, `CampaignProgressDto`, `CampaignCommercialDto`, `CampaignAttemptDto`, `CampaignSummaryDto`, `CampaignDetailDto`, `CampaignListDto`, `CampaignQueryDto`, `ProgrammeQueryDto`, `CreateRepCampaignDto`, `RepCampaignProgressDto`, `RepCampaignCommercialDto`, `RepCampaignAttemptDto`, `RepCampaignSummaryDto`, `RepCampaignDetailDto`, `RepCampaignListDto`, `RepCampaignQueryDto`, `RepCampaignPreviewQueryDto`, `RepCampaignPreviewDto`, `RepProgrammeQueryDto`, `CampaignClosedDayDto`, `CampaignPilotageDto`, `SyncCallCampaignDto`, `SyncCallTaskDto`, `SyncRepCallCampaignDto`, `SyncRepCallTaskDto` |                                                                |
| Enums retirés du contrat       | `CampaignScope`, `CampaignStatus`, `CallTaskStatus`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `LotExportCible`                                               |

DTO du nouveau module, dans
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/lots-export/dto.ts` :

```ts
export class CreateLotExportDto {
  name: string; // 3..120
  cible: LotExportCible; // REPRESENTANTS | PROSPECTS
  representants?: RepresentantExportQueryDto; // requis si cible = REPRESENTANTS
  prospects?: ProspectFilterDto; // requis si cible = PROSPECTS
}

export class LotExportSummaryDto {
  id: string;
  name: string;
  cible: LotExportCible;
  projet: Projet | null;
  scopeLabel: string; // libellé lisible de la cible
  itemCount: number;
  createdById: string;
  createdByName: string;
  createdAt: string;
  callsSince: number; // appels consignés sur les fiches du lot depuis createdAt
  fichesAppelees: number; // fiches distinctes du lot ayant reçu au moins un appel
}
```

`GET /lots-export/{id}` rend `LotExportSummaryDto`, plus la ventilation des
appels par téléconseiller depuis la création, **plus** `recentAttempts:
LotExportAttemptDto[]`. **Écart tranché** : le plan API n'annonçait que la
ventilation, le plan web attendait une liste d'appels avec leurs renseignements.
Le détail d'un lot garde cette liste, sans quoi la section « Appels passés sur
ces fiches » de l'écran n'a pas de source. `LotExportAttemptDto` reprend
exactement les champs de l'ancien `CampaignAttemptDto`
(`apps/api/src/modules/phase2/dto.ts:137`) : `phoneE164`, `shortCode`,
`outcome`, `method`, `comment`, `performedByName`, `createdAt`, plus les
renseignements de conversion. Borner à 50 lignes.

`GET /lots-export/apercu` rend `{ eligible: number, scopeLabel: string }`.

`CampaignScope` disparaît sans remplaçant dédié : les trois dimensions qu'il
encodait existent déjà dans `ProspectFilterDto`, `projet` (`:88`), `type`
(`:97`, ce que `GP1..GP4` désignait : `FONCTIONNAIRE`, `SECTEUR_PRIVE`,
`INFORMEL`, `DIASPORA`) et `segment` (`:117`, `BDD1..BDD4`). **Écart tranché** :
le plan web voulait garder `CampaignScope` et `CAMPAIGN_SCOPES` « parce qu'ils
nomment les cibles ». Les cartes radio de l'écran restent, mais chaque carte
produit désormais `{ projet, segment }` ou `{ projet, type }` au lieu d'une
valeur d'enum.

### 2.3 Supervision

`GET /supervision/activite` cesse de rendre `tasksClosed` par ligne et
`openTasks` par téléconseiller, et cesse d'accepter `campaignId`. Les colonnes
qui restent (`calls`, `unreachable`, `wrongNumber`, `refused`, `other`,
`methodObtained`, `callback`, `reachRate`, `prospectsCreated`,
`representantsContacted`, et le bloc `rep*`) suffisent.
**Aucune colonne neuve dans ce chantier.**

### 2.4 Synchronisation

**Quatre flux retirés de `GET /v1/sync/pull`** : `callCampaigns`, `callTasks`,
`repCallCampaigns`, `repCallTasks`, dans `SYNC_STREAMS`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/sync/cursor.ts:22`
à `:25`), dans les lectures et dans la réponse.

Flux conservés, seuls lus par le mobile : `departements`, `iefs`, `banques`,
`syndicats`, `canauxProvenance`, `visiteReferentiels`, `representants`,
`prospects`, `visites`, et le tableau `deletions`.

Le curseur est un objet opaque, stocké sous une seule clé côté mobile
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/sync/sync_engine.dart:2112`),
et le serveur ignore silencieusement toute clé inconnue reçue
(`apps/api/src/modules/sync/cursor.ts:73`). **Aucune remise à zéro de curseur,
d'aucun côté.**

Il n'existe pas de tombstone pour les tâches : la tâche retirée descendait une
dernière fois avec `isActive = false` et le client l'effaçait
(`sync.service.ts:1151`). Après le chantier, le téléphone garde donc en base
locale des tables que plus rien ne contredira : c'est le `DROP TABLE` du palier
Drift v20 (§4.3.1) qui les efface, pas l'API.

**`POST /v1/sync/push` ne change pas de forme.** Le mobile n'a jamais envoyé de
`taskId` : ni `SyncEntityDataDto` (`apps/api/src/modules/sync/dto.ts:103`), ni
la charge utile de conversion
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/repositories/write_repository.dart:817`),
ni celle de qualification (`:951`) n'en portent. Seul D1 peut y ajouter un
champ `projet`.

#### Le palier de format, point de rupture

`SyncChangesDto.callCampaigns` et les trois autres sont engendrés en Dart avec
`required: true`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/api-client-dart/lib/src/model/sync_changes_dto.dart:87`),
et le désérialiseur les inscrit dans `$checkKeys`
(`sync_changes_dto.g.dart:212`). Si le serveur cesse d'émettre ces clés sans
autre précaution, un APK déjà installé enchaîne :
`MissingRequiredKeysException` → `DioException(type: unknown)` avec une réponse
**200** (`packages/api-client-dart/lib/src/api/sync_api.dart:96`) →
`DioApi._guard` (`apps/mobile/lib/core/sync/dio_api.dart:359`) →
`ApiException('RESPONSE_SCHEMA_MISMATCH', kind: FailureKind.terminal)` →
`SyncOutcome.shouldRetry` rend faux (`sync_engine.dart:2205`). **Le pull ne
réessaie jamais**, l'appareil continue de pousser ses saisies mais ne reçoit
plus rien, en affichant « Le serveur a refusé cet envoi » : un message faux qui
envoie l'utilisateur au mauvais endroit (`sync_coordinator.dart:47`).

**Décision : `MIN_PULL_PAYLOAD_VERSION` passe de 4 à 5**
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/sync/sync.controller.ts:29`)
**dans le même déploiement que le mobile qui porte `payloadVersion` de 4 à 5**
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/sync/sync_engine.dart:59`).
L'ancien APK reçoit alors un `426 APP_UPDATE_REQUIRED` honnête
(`sync.controller.ts:154`), traduit en `FailureKind.appUpdateRequired`
(`dio_api.dart:475`), et la bande d'état dit la vérité : « Cette version ne
reçoit plus les fiches. Vos saisies partent toujours : installez la mise à
jour. » (`sync_coordinator.dart:49`). **La poussée reste ouverte pendant le
refus** (`sync.controller.ts:143`) : rien de ce qui est saisi hors ligne n'est
perdu.

**Écart tranché** : le plan mobile écrivait « garder `payloadVersion` à 4 » dans
son inventaire, tout en recommandant le passage à 5 dans sa section
compatibilité. C'est 5.

Deux nuances :

- Porter le numéro côté mobile sans le serveur est inoffensif (le serveur
  accepte `>= 4`). Porter le minimum serveur sans livrer l'APK **coupe le pull
  de tout le parc**. L'ordre de déploiement n'est donc pas symétrique.
- Le `426` n'ouvre pas l'écran de mise à jour, piloté par un endpoint distinct
  (`appUpdateControllerProvider`,
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/app.dart:37`).
  Pour que le parc se mette réellement à jour, **publier aussi la nouvelle
  version dans le service de mises à jour**
  (`apps/api/src/modules/app-updates/`).

### 2.5 Portée cible

| Objet                    | Lecture                                                                                                   | Écriture                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Représentants (annuaire) | Tous rôles terrain : tout                                                                                 | Propriétaire, ou encadrement (`assertManageable`)                            |
| Prospects (web)          | Tous rôles terrain : tout (D2)                                                                            | Propriétaire, ou encadrement                                                 |
| Prospects (mobile, pull) | D2                                                                                                        | Propriétaire                                                                 |
| Tentatives d'appel       | Selon la fiche                                                                                            | Ajout seul, `performedById` = l'appelant, sur n'importe quelle fiche vivante |
| Rappels                  | Le sien, ou tout pour supervision et direction (`apps/api/src/modules/callbacks/callbacks.service.ts:66`) | Celui qui l'a promis, ou ADMIN (`:103`)                                      |
| Lots d'export            | ADMIN, SUPERVISEUR, DIRECTION                                                                             | ADMIN                                                                        |

L'écriture ne change pas : `assertOwnership`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/common/scope.ts:96`)
et `assertManageable` (`:85`) restent tels quels. Un téléconseiller modifie ses
fiches, et consigne des appels et des rappels sur n'importe quelle fiche : c'est
le geste métier voulu, déjà porté par `call_attempts` en ajout seul.

---

## 3. Ordre d'exécution

Trois lots, dans cet ordre : **A. API et base**, puis **B. Web**, puis
**C. Mobile**. Chaque étape se termine en vert avant la suivante. La colonne
« rouge attendu » donne le signal qui prouve que l'étape mord réellement ;
une étape qui passe au vert du premier coup sans être passée par le rouge n'a
rien prouvé.

Trois points de couture méritent d'être connus avant de commencer.

- **C1. Supervision et Chiffres.** Retirer `tasksClosed` et `openTasks` du
  contrat casse le typecheck du web tant que le web les lit encore. Faire A6
  (retrait serveur) et B5 (adaptation web) **dans le même passage**, avec
  `pnpm codegen` entre les deux, et ne lancer `pnpm --filter @crm/web typecheck`
  qu'après les deux. `reste-a-appeler` reste dans le contrat (D3) : seule sa
  requête change, côté serveur.
- **C2. Le mobile compile sans rien faire tant que le contrat n'a pas bougé.**
  Les étapes C1 à C6 sont applicables immédiatement : le mobile reçoit les
  quatre listes et les ignore. Seule C7 (régénération) dépend de A.
- **C3. Déploiement conjoint API + mobile.** Voir §3.4.

### 3.1 Lot A, API et base

#### A1. Migration d'expansion : les tables de lot

Fichiers :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/database/prisma/schema.prisma`
(modèle en §4.1.8), plus une migration engendrée puis complétée à la main pour
le `CHECK`.

```bash
pnpm db:migrate     # nommer : lots_export
pnpm db:generate
pnpm --filter @crm/database typecheck
```

Rouge avant vert : sans le `CHECK`, insérer un `LotExportItem` avec ses deux
identifiants nuls est accepté par la base. Le vérifier à la main sur la base de
développement, puis poser la contrainte.

**Aucune suppression à cette étape.** Purement additive : une instance d'API de
l'ancienne version tourne sans s'en apercevoir.

#### A2. Le module de lot d'export

À créer sous
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/lots-export/` :
`dto.ts`, `lots-export.service.ts`, `lots-export.controller.ts`,
`lots-export.module.ts`, `lots-export.service.test.ts`.

À modifier :

- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/app.module.ts:86` :
  déclarer `LotsExportModule` à côté de `RepCampaignsModule`.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/representants/dto.ts:190` :
  ajouter `relationStatus`, `whatsappStatus`, `hasWhatsapp` à
  `RepresentantExportQueryDto` ; les décorateurs se recopient depuis
  `RepresentantQueryDto` (`:246`, `:255`, `:265`).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/export/export.controller.ts:194`
  et `:198` : réécrire le commentaire, ajouter `Role.SUPERVISEUR`.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/export/representants-export.service.ts:186` :
  porter les trois filtres dans `buildWhere`, et accepter un mode « borné à une
  liste d'identifiants ».
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/common/guards/role-routes.test.ts` :
  déclarer le contrôleur dans `CONTROLLERS` (`:40`), inscrire les routes dans
  `ADMISES` (`:118`) et `ADMISES_DIRECTION` (`:264`).

Comportement de la création : **une seule transaction**, `timeout: 120_000`,
`maxWait: 15_000` (valeurs éprouvées, `campaigns.service.ts:44`). Elle lit les
identifiants ciblés en `orderBy: { id: 'asc' }`, écrit le `LotExport` puis les
`LotExportItem` par paquets de 5 000 (`createMany`, valeur reprise de
`campaigns.service.ts:48`), renseigne `itemCount` et sérialise les filtres tels
quels dans `filters`. `422 LOT_EXPORT_CIBLE_VIDE` si aucun identifiant ne sort.

`callsSince` se calcule sans stockage :

```sql
SELECT COUNT(*)::int                            AS appels,
       COUNT(DISTINCT a."representantId")::int  AS fiches
FROM "lot_export_items" i
INNER JOIN "rep_call_attempts" a
  ON a."representantId" = i."representantId"
 AND a."clientCreatedAt" >= l."createdAt"
WHERE i."lotId" = l."id"
```

et son pendant sur `call_attempts` / `prospectId` pour la cible `PROSPECTS`.

Le classeur réutilise `RepresentantsExportService.writeRepresentants`
(`representants-export.service.ts:112`, écriture en flux par
`ExcelJS.stream.xlsx.WorkbookWriter`, pagination keyset, jamais plus de 500
lignes en mémoire) et `ExportService.writeProspects`, en leur passant un `where`
borné aux identifiants du lot au lieu du `where` de filtre. Poser l'en-tête
`X-CPI-Demo-Mode` par `setDemoHeader`
(`apps/api/src/modules/export/demo-marking.ts`). **Déclarer le classeur en
binaire dans le contrat** (`{ type: 'string', format: 'binary' }`), sans quoi le
générateur Dart désérialise le fichier en JSON : piège déjà documenté à
`export.controller.ts:62`.

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test -- lots-export
pnpm --filter @crm/api test -- role-routes
pnpm codegen && pnpm codegen:check
```

Rouge attendu : `role-routes.test.ts` rougit dès l'ajout du contrôleur, avant
l'inscription des routes dans les inventaires. C'est la preuve que le test
d'autorisation voit la nouvelle surface.

#### A3. La portée : plus d'assignation dans aucun `WHERE`

**Dépend de D2 et D4.**

- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/common/scope.ts` :
  supprimer `mineOrAssignedProspect` (`:38`), faire rendre `{}` à
  `prospectReadScope` (`:46`), statuer sur `prospectSyncScope` (`:55`) selon D2.
  Si plus personne n'appelle ces fonctions, les retirer (`pnpm dead-code`).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/common/prospect-where.ts` :
  retirer `:78` à `:87`, adapter `:19` à `:22`.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/common/dto/prospect-filter.dto.ts` :
  supprimer `campaignId` (`:137` à `:144`) ; remplacer `assignedToId`
  (`:146` à `:155`) par `appelePar` (uuid, optionnel) qui borne aux fiches
  portant au moins une tentative `performedById = appelePar` (D4). Même filtre
  sur la liste des représentants (`rep_call_attempts`).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/analytics/analytics.sql.ts` :
  supprimer `porteeProspect` (`:44` à `:49`) et son appel (`:16` à `:18`),
  `campaignCondition` (`:107` à `:120`) et son appel (`:93`).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/analytics/authorization.sweep.test.ts` :
  **retourner** l'assertion `:122` à `:127` (§5.1).

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test -- prospect-where filter-consistency authorization.sweep
```

Rouge attendu : avant d'être retourné, `authorization.sweep.test.ts` doit rougir
sur chaque route d'analytics. Un balayage qui reste vert après un changement de
portée ne prouve rien et doit être considéré comme cassé.

#### A4. La synchronisation

**Dépend de D1 et D2.**

- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/sync/cursor.ts:22`
  à `:25` : retirer les quatre flux.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/sync/sync.service.ts` :
  retirer `assignedTo` (`:186`), simplifier `mineOrAssignedRepresentant`
  (`:202` à `:213` ; `ANNUAIRE_ROLES` reçoit déjà tout l'annuaire à `:205`, la
  branche restrictive ne concerne plus que `BANQUE_FINANCE` et `ACCUEIL`),
  retirer les quatre lectures (`:1140`, `:1155`, `:1166`, `:1177`) et les quatre
  tableaux de réponse (`:1282` à `:1317`), remplacer les gardes `:726`, `:807`,
  `:1012` par la nouvelle portée.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/sync/dto.ts` :
  retirer `SyncCallCampaignDto` (`:674`), `SyncCallTaskDto` (`:686`),
  `SyncRepCallCampaignDto` (`:707`), `SyncRepCallTaskDto` (`:709`), et les
  quatre champs de `SyncChangesDto` (`:778` à `:782`).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/sync/sync.controller.ts:29` :
  `MIN_PULL_PAYLOAD_VERSION` passe à 5 ; la description `:124` explique le
  nouveau palier en une phrase.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/phase2/phase2-sync.service.ts` :
  retirer la lecture de tâche (`:104` à `:119`), appliquer D1 sur le calcul du
  projet (`:128`), retirer les écritures `taskId` et `campaignId` (`:139`,
  `:140`, `:246`, `:247`), la clôture des tâches actives (`:295` à `:298`) et
  les champs `taskId` / `taskStatus` des résultats (`:168`, `:169`, `:190`,
  `:191`, `:306`, `:307`).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/phase2/dto.ts:596`
  et `:604` : retirer `taskId` et `taskStatus`.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/sync/fake-prisma.ts:43`,
  `:44` : retirer les délégués de tâche.

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test -- sync phase2-sync
pnpm codegen && pnpm codegen:check
```

Rouge attendu : `sync.integration.test.ts` rougit sur l'absence des quatre flux
avant d'être mis à jour, et un test neuf prouve qu'un client annonçant
`X-CPI-Payload-Version: 4` reçoit `426 APP_UPDATE_REQUIRED`.

#### A5. Les statistiques et la supervision

Voir C1 : cette étape et B5 vont ensemble.

- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/analytics/pilotage.service.ts` :
  supprimer `campaignPilotage` (`:16` à `:136`) et `projectEnd` (`:250`).
  Garder `delays` (`:138`).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/analytics/pilotage.dto.ts` :
  supprimer `CampaignClosedDayDto` (`:3`) et `CampaignPilotageDto` (`:17`).
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/analytics/analytics.controller.ts:198`
  à `:214` : supprimer la route.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/analytics/supervision.service.ts`
  et `supervision.dto.ts` : les retraits du tableau §4.1.5.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/dashboards/dto.ts:66`
  et `dashboard-layout.ts:133`, `:272` : `reste-a-appeler` est conservée (D3) ;
  sa source côté web (`apps/web/src/components/chiffres/sources.ts`) et sa
  requête serveur passent de « tâches ouvertes » à « représentants sans aucune
  réponse consignée » ; ajouter la tolérance aux clés inconnues dans les
  dispositions enregistrées.

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test -- analytics supervision
pnpm codegen && pnpm codegen:check
```

Rouge attendu : `role-routes.test.ts` rougit sur
`AnalyticsController.campaignPilotage` (`:131`) tant que la ligne reste dans
l'inventaire.

Précaution : `supervision.service.ts` est en cours d'édition par un autre
chantier. Relire
`git diff -- apps/api/src/modules/analytics/supervision.service.ts` avant
d'écrire.

#### A6. Les rappels et les notifications

- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/notifications/reminders.service.ts` :
  les retraits du tableau §4.1.6.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/notifications/notifications.env.ts`
  et `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/.env.example` : retirer
  `NOTIFICATIONS_OPEN_TASKS_ENABLED` et `NOTIFICATIONS_OPEN_TASKS_MIN`. Le
  second fichier est déjà modifié par un autre chantier : relire d'abord.
- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/callbacks/callbacks.service.ts:32`,
  `:33`, `:49`, `:50` et `.../callbacks/dto.ts:53`, `:54`.

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test -- reminders callbacks
pnpm codegen && pnpm codegen:check
```

#### A7. Les deux modules de campagne

Suppressions, réductions et retraits en cascade : détail complet en §4.1.2 et
§4.1.7. En résumé : `Phase2CampaignsService` et ses annexes disparaissent, le
contrôleur phase2 garde trois routes, le module rep-campaigns se réduit à
`recordAttempt` et ses aides, `users.service.ts`, `prospects.service.ts`,
`segment.ts`, `demo-workspace-factory.ts`, `demo.service.ts`, `purge-plan.ts` et
`purge-steps.ts` perdent leurs références.

```bash
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api lint
pnpm --filter @crm/api test
pnpm dead-code
pnpm codegen && pnpm codegen:check
```

Rouge attendu : `pnpm dead-code` (knip) signale tout fichier ou export orphelin
resté derrière. `role-routes.test.ts:325` compare l'inventaire à la surface
réelle : il n'y a pas de demi-mesure, il est exact ou rouge.

#### A8. Migration de contraction : supprimer les tables

**Après que A7 est verte et déployée, pas dans le même envoi.** Voir §3.4.

- `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/database/prisma/schema.prisma` :
  retirer les six modèles, les trois enums, les colonnes `taskId` et
  `campaignId` de `CallAttempt`, `RepCallAttempt` et `ScheduledCallback`, les
  index `@@index([campaignId])` (`:1085`, `:1280`), et les dix champs de
  relation de §4.1.1.

```bash
pnpm db:migrate     # nommer : retrait_des_listes_d_appel
pnpm db:generate
pnpm --filter @crm/database typecheck
pnpm --filter @crm/api typecheck
pnpm --filter @crm/api test
pnpm --filter @crm/api test:integration
```

Précautions d'exécution :

- `DROP TABLE` plutôt que `DELETE FROM` puis `DROP` : `call_tasks` peut porter
  des centaines de milliers de lignes, et `DROP TABLE` ne journalise pas ligne à
  ligne.
- Les index partiels bruts `call_tasks_one_active_per_prospect`
  (`packages/database/prisma/migrations/20260812141010_phase2_and_bank_finance/migration.sql:344`)
  et `rep_call_tasks_one_active_per_representant`
  (`.../20260814090000_campagnes_representants_et_demandes_clients/migration.sql:261`)
  tombent avec leurs tables : aucune instruction séparée.
- Un type enum PostgreSQL ne se supprime pas tant qu'une colonne l'utilise.
  Ordre : colonnes, puis tables, puis `DROP TYPE "CallTaskStatus"`,
  `DROP TYPE "CampaignStatus"`, `DROP TYPE "CampaignScope"`.
- **Ne jamais exécuter ces migrations sur la production sans autorisation
  explicite.** `pnpm db:migrate` vise la base de développement ; le déploiement
  passe par `pnpm db:deploy` (`package.json:28`), hors périmètre de ce plan.

### 3.2 Lot B, web

L'ordre interne est celui du risque croissant. B0 d'abord, toujours.

| Étape                                         | Fichiers                                                                                                                                                    | Ce qu'on écrit                                                                                         | Vérification                                                                                                                       | Rouge attendu                                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **B0. Relire l'arbre**                        | tous                                                                                                                                                        | rien                                                                                                   | `git status`, relecture                                                                                                            | l'arbre a bougé depuis la rédaction (§0.5)                                                                                              |
| **B1. Copie de la navigation**                | `apps/web/src/components/layout/nav-items.ts` (274-281, 313-319, 534-540, 493, 560) et son test                                                             | libellé « Lots d'export », descriptions de §4.2.6                                                      | `pnpm --filter @crm/web test src/components/layout/nav-items.test.ts`                                                              | le test neuf exige `label === "Lots d'export"` et une description sans « distribuer » ni « appels aux »                                 |
| **B2. Écran d'ouverture CHUES**               | `components/chues/hub-view.tsx`, `hub-filters.ts`, `app/(panel)/chues/page.tsx`                                                                             | renommer `A_APPELER` en `NON_QUALIFIES`, supprimer `prioritaire` et la pastille, changer deux légendes | `pnpm --filter @crm/web test src/components/chues/hub-view.test.tsx`                                                               | « pas encore qualifiés » attendu, `queryByText('À faire maintenant')` nul                                                               |
| **B3. Étape 1 perd sa liste confiée**         | `components/console/rep-script.tsx`, nouveau `components/console/rep-annuaire.ts`, `lib/data/console.ts`, `app/(panel)/chues/appels-representants/page.tsx` | sortir `annuaireFilters` du module client, supprimer la requête de file, précharger l'annuaire         | `pnpm --filter @crm/web test src/components/console/rep-script.test.tsx`                                                           | « ouvre sur l'annuaire, sans liste confiée » : première requête `fetchRepresentants({search: ''})`, aucun appel à `fetchRepScriptQueue` |
| **B4. Étape 3 devient un écran de recherche** | `components/console/console-view.tsx`, `lib/data/console.ts`, les deux pages `console/page.tsx`                                                             | **en deux temps** : B4a les données, B4b l'écran (§4.2.3)                                              | `pnpm --filter @crm/web test src/components/console src/lib/data/console.test.ts` puis `typecheck`                                 | les six tests d'ordre de file disparaissent, trois tests d'ouverture par recherche rougissent d'abord                                   |
| **B5. Supervision et Chiffres**               | `lib/data/admin.ts`, `components/supervision/activity-view.tsx`, `components/chiffres/sources.ts`                                                           | retirer `tasksClosed`, `openTasks`, la carte et la colonne « Reste à appeler »                         | `pnpm --filter @crm/web test src/lib/data/admin.test.ts src/components/supervision/activity-view.test.tsx src/components/chiffres` | en-têtes sans « Tâches closes » ni « Reste à faire ». **Voir C1**                                                                       |
| **B6. Rappels**                               | `components/rappels/rappels-view.tsx`                                                                                                                       | dériver la racine du lien du `pathname`, changer deux textes et un libellé                             | `pnpm --filter @crm/web test src/components/rappels/rappels-view.test.tsx`                                                         | sur `/grand-public/rappels`, le lien vise `/grand-public/console?fiche=…`                                                               |
| **B7. Créer l'écran des lots**                | nouveau dossier `components/lots/`, `lib/lot-filters.ts`, `lib/data/lots.ts`, `lib/query-keys.ts`                                                           | §4.2.4                                                                                                 | `pnpm --filter @crm/web test src/components/lots`                                                                                  | `lots-view.test.tsx` et `lot-create-dialog.test.tsx` écrits d'abord                                                                     |
| **B8. Supprimer l'ancien monde**              | §4.2.2 et §4.2.5                                                                                                                                            | suppressions et nettoyages                                                                             | `typecheck && lint` puis `pnpm dead-code`                                                                                          | knip signale les exports sans appelant                                                                                                  |
| **B9. Consigner depuis les listes**           | `components/prospects/columns.tsx`, `components/representants/representant-detail-view.tsx`                                                                 | un lien « Consigner un appel » par ligne                                                               | `pnpm --filter @crm/web test src/components/prospects/columns.test.tsx`                                                            | le test du lien vers `/chues/console?fiche=<id>`                                                                                        |
| **B10. Frontières et bout en bout**           | §5.2                                                                                                                                                        | tests                                                                                                  | `typecheck`, `lint`, `test`, `build`, puis `test:e2e`                                                                              | voir §5.2                                                                                                                               |

### 3.3 Lot C, mobile

Toutes les commandes depuis
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile`.

| Étape                                                   | Ce qu'on fait                                                                                                                                                                                           | Vérification                                                                                           | Rouge attendu                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C0. Point de départ vert**                            | `flutter pub get`, `build_runner`, `analyze`, `test`                                                                                                                                                    | `No issues found.` et tout vert                                                                        | si ce n'est pas le cas **avant** toute modification, s'arrêter et le signaler                                                                     |
| **C1. Retirer écrans, routes et providers de campagne** | supprimer `lib/features/campagnes/` en entier ; déplacer trois constantes dans `route_paths.dart` ; nettoyer `app_router.dart` et `route_memory.dart` ; corriger `prospect_detail_screen.dart` (§4.3.3) | `flutter analyze`                                                                                      | `Target of URI doesn't exist`, `Undefined name 'CampagnesRoutes'` dans les deux accueils, `Undefined name 'ProspectPickerScreen'` dans le routeur |
| **C2. Réécrire les deux accueils**                      | `home_screen.dart`, `grand_public_screen.dart`, `hub_screen.dart:159`, `grand_public_fiches_screen.dart:200`, `projects.dart:89`, `phase2_screen.dart:37` (§4.3.3 et §4.3.6)                            | `flutter analyze`                                                                                      | rouge résiduel limité à `ProspectPickerScreen` et `prospectPickerListProvider`                                                                    |
| **C3. Le sélecteur de prospects**                       | deux providers dans `app_providers.dart`, un `onTap` optionnel sur `ProspectTile`, l'écran neuf, la `GoRoute` (§4.3.4)                                                                                  | `flutter analyze` puis `dart format --output=none --set-exit-if-changed lib/`                          | avant d'écrire l'écran, l'erreur porte bien sur `ProspectPickerScreen`                                                                            |
| **C4. Base locale et migration**                        | `schema.drift` perd 803 à 899, `database.dart` passe en v20 (§4.3.1)                                                                                                                                    | `build_runner`, `analyze`, `flutter test test/data/migration_test.dart`                                | « le golden couvre toutes les versions déclarées » (`test/data/migration_test.dart:63`) rougit avec `schemaVersion a bougé sans nouveau dump`     |
| **C4bis. Dumps**                                        | `dart run drift_dev schema dump lib/data/local/database.dart drift_schemas/` puis `dart run drift_dev schema generate drift_schemas/ test/data/generated_migrations/`                                   | relire le diff : **aucun** `schema_v1..v19.dart` ne doit changer                                       | s'il en change un, drift et drift_dev ne sont pas ensemble dans `>=2.33.0 <2.34.0` (`pubspec.yaml:31`, `:109`)                                    |
| **C5. Moteur de sync et dépôt d'écriture**              | `sync_engine.dart` perd 1975 à 2057 ; `write_repository.dart` perd 919-931 puis 891-896 (§4.3.2)                                                                                                        | `flutter analyze`, `flutter test test/core/sync_engine_test.dart test/data/write_repository_test.dart` | le test de file de campagne et l'assertion `repCallTasks … 'DONE'` échouent, plus les compilations citant `db.callTasks`                          |
| **C6. Les tests**                                       | §5.3                                                                                                                                                                                                    | `flutter analyze`, `dart format`, `flutter test`                                                       | tout vert ; sur chaque test neuf, casser le code couvert et vérifier le rouge                                                                     |
| **C7. Le contrat** (après le lot A)                     | `pnpm codegen` à la racine, puis retirer les arguments morts des sept fichiers qui construisent un `SyncChangesDto`, et porter `sync_engine.dart:59` à 5                                                | la séquence complète de §0.3, plus `pnpm codegen:check`                                                | `git diff --stat packages/api-client-dart/lib` doit montrer la disparition des quatre DTO de flux et de `call_task_status.dart`                   |

### 3.4 Déploiement

Trois envois, dans cet ordre.

1. **Envoi 1, expansion.** Migration `lots_export` seule (A1). Additive, sans
   effet sur l'API en service.
2. **Envoi 2, bascule. API + web + APK partent ensemble.** C'est le point de
   synchronisation du chantier :
   - l'API retire les quatre flux et porte `MIN_PULL_PAYLOAD_VERSION` à 5 ;
   - l'APK porte `payloadVersion` à 5 et la base locale v20 ;
   - le web bascule sur les lots.
     Un web en retard sur l'API rend des `404` bruts à l'utilisateur ; un APK en
     retard reçoit un `426` honnête et continue de pousser ses saisies. **Publier
     aussi la nouvelle version dans le service de mises à jour**
     (`apps/api/src/modules/app-updates/`), sans quoi le `426` ne produit qu'une
     bande d'état et le parc ne se met pas à jour.
3. **Envoi 3, contraction.** Migration `retrait_des_listes_d_appel` (A8), une
   fois qu'aucune instance d'API ne lit plus les colonnes retirées.

Entre l'envoi 2 et l'envoi 3, les tables et colonnes restent en base, vides
d'usage : c'est la séquence expand puis switch puis contract, et c'est elle qui
permet un retour arrière sans perte pendant la fenêtre de bascule.

**Nature du livrable mobile.** Ce lot change le schéma SQLite (v19 vers v20).
Une mise à jour OTA Shorebird (`apps/mobile/shorebird.yaml`) peut techniquement
la porter, aucune dépendance native ne bougeant. Mais un **retour arrière OTA**
après que la v20 a tourné rendrait la main à un code v19 sur une base v20, et
drift refuserait d'ouvrir. **Traiter ce lot comme une livraison APK, pas comme
un correctif OTA.**

---

## 4. Inventaires détaillés

Verdicts : **SUPPRIMER** (le code disparaît), **TRANSFORMER** ou **RÉÉCRIRE**
(le fichier reste, le passage change), **REMPLACER** (l'objet survit sous une
autre forme), **GARDER** (aucune modification).

### 4.1 API et packages/database

#### 4.1.1 Modèle de données

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/database/prisma/schema.prisma`
(2315 lignes).

| Ligne   | Enum                                        | Verdict                                                                                                                                                                                                                                                           |
| ------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `:153`  | `CampaignScope` (BDD1..BDD4, GP1..GP4, ALL) | **SUPPRIMER.** Le périmètre d'un lot se dit avec les filtres partagés (§2.2). Consommateurs : `apps/api/src/modules/phase2/campaigns.service.ts:54`, `:70`, `:292`, `apps/api/src/modules/phase2/dto.ts:51`, `packages/database/src/segment.ts:82`, `:89`, `:116` |
| `:165`  | `CampaignStatus`                            | **SUPPRIMER.** Un lot d'export n'a pas d'état : il est produit une fois                                                                                                                                                                                           |
| `:172`  | `CallTaskStatus`                            | **SUPPRIMER**                                                                                                                                                                                                                                                     |
| `:178`  | `CallOutcome`                               | **GARDER.** Décrit l'issue d'un appel, pas une tâche                                                                                                                                                                                                              |
| `:195`  | `RepCallOutcome`                            | **GARDER**                                                                                                                                                                                                                                                        |
| `:1139` | `ScheduledCallbackStatus`                   | **GARDER**                                                                                                                                                                                                                                                        |
| `:1516` | `NotificationCategory`                      | **GARDER.** Sa valeur `CAMPAGNE` perd son seul usage, mais vider un enum PostgreSQL exposé au contrat ne vaut pas une migration                                                                                                                                   |

| Ligne   | Modèle                            | Verdict                 | Détail                                                                                                                                                                                                                                                                                          |
| ------- | --------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `:928`  | `CallCampaign` / `call_campaigns` | **SUPPRIMER**           | Porte `scope`, `seed`, `status`, `spreadDays`, `audienceFilters`, et les relations `commerciaux`, `tasks`, `attempts`, `callbacks`                                                                                                                                                              |
| `:966`  | `CallCampaignCommercial`          | **SUPPRIMER**           | Table de tourniquet                                                                                                                                                                                                                                                                             |
| `:987`  | `CallTask` / `call_tasks`         | **SUPPRIMER**           | `assignedToId:994`, `position:999`, `dayIndex:1006`, `status:1008`, `isActive:1009`, index `:1018` à `:1027`                                                                                                                                                                                    |
| `:1037` | `CallAttempt`                     | **GARDER en le vidant** | Retirer `taskId:1042`, `task:1043`, `campaignId:1044`, `campaign:1045` et `@@index([campaignId]):1085`. Tout le reste reste : issue, méthode, motif, renseignements de conversion, `performedById`, `clientCreatedAt`. C'est le journal des appels, seule source des chiffres après le chantier |
| `:1103` | `ScheduledCallback`               | **GARDER en le vidant** | Retirer `taskId:1107`, `task:1108`, `campaignId:1109`, `campaign:1110`. **Garder** `assignedToId:1114` (celui qui a promis le rappel, le commentaire `:1112` le dit déjà) et `sourceAttemptId:1123` (clé d'idempotence). Garder les trois index `:1132`, `:1133`, `:1135`                       |
| `:1159` | `RepCallCampaign`                 | **SUPPRIMER**           | `departementId:1170`, `iefId:1172`, `onlyWithoutProspects:1177`, `relationStatuses:1181` décrivent une cible : elle se reporte dans le lot                                                                                                                                                      |
| `:1198` | `RepCallCampaignCommercial`       | **SUPPRIMER**           |                                                                                                                                                                                                                                                                                                 |
| `:1218` | `RepCallTask`                     | **SUPPRIMER**           |                                                                                                                                                                                                                                                                                                 |
| `:1251` | `RepCallAttempt`                  | **GARDER en le vidant** | Retirer `taskId:1256`, `task:1257`, `campaignId:1258`, `campaign:1259`, `@@index([campaignId]):1280`. Garder `outcome`, `promisedProspects`, `callbackAt`, `suggestion`                                                                                                                         |

Champs de relation à retirer sur les modèles conservés : `User.campaignsCreated:255`,
`User.campaignMemberships:256`, `User.callTasksAssigned:257`,
`User.repCampaignsCreated:266`, `User.repCampaignMemberships:267`,
`User.repCallTasksAssigned:268`, `Representant.repCallTasks:492`,
`Prospect.callTasks:693`, la relation `RepCallCampaignDepartement` côté
`Departement` (`:1171`), la relation `RepCallCampaignIef` côté `Ief` (`:1173`).

**Restent** : `User.scheduledCallbacks:293`, `User.callAttempts:258`,
`User.repCallAttempts:269`, `Representant.repCallAttempts:493`,
`Prospect.callAttempts:694`, `Prospect.scheduledCallbacks:695`.

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/database/src/segment.ts`

| Ligne    | Élément                                                                         | Verdict                                                                                                                 |
| -------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `:82`    | `GP_TYPES`                                                                      | **SUPPRIMER** (dépend de `CampaignScope`)                                                                               |
| `:89`    | `scopeWhere(scope, projet)`                                                     | **SUPPRIMER**                                                                                                           |
| `:116`   | `eligibleForCampaignWhere(scope, projet)`                                       | **SUPPRIMER.** Sa ligne `:124`, `callTasks: { none: { isActive: true } }`, est le cœur de l'éligibilité par assignation |
| ailleurs | `segmentWhere`, `segmentAxes`, `ALL_SEGMENTS`, `CHUES_SIGLE`, `CBAO_SHORT_NAME` | **GARDER** : statistiques, listes, exports                                                                              |

#### 4.1.2 Modules de campagne

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/phase2/`

| Fichier                                                    | Verdict                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaigns.service.ts` (27,6 Ko, tirage à `:113`)          | **SUPPRIMER**                                                                                                                                                                                                                                                                                                                     |
| `campaigns.service.test.ts` (16,9 Ko)                      | **SUPPRIMER**                                                                                                                                                                                                                                                                                                                     |
| `distribution.ts`, `distribution.test.ts`                  | **SUPPRIMER**                                                                                                                                                                                                                                                                                                                     |
| `programme-pdf.ts`, `programme-pdf.test.ts`, `pdf-text.ts` | **DÉPLACER** dans le module lots (`fiche-pdf.ts`) : garder `writeRepProgrammeData` / `writeRepProgrammePdf` (`programme-pdf.ts:360`) comme base de la fiche imprimable, retirer tout ce qui parle d'assignation, de jour et de position, généraliser aux prospects. Les routes `fiches/{itemId}.pdf` et `fiches.zip` en dépendent |
| `phase2.controller.ts`                                     | **RÉDUIRE** aux trois routes conservées (`:66`, `:96`, `:120`)                                                                                                                                                                                                                                                                    |
| `phase2.module.ts`                                         | perd `Phase2CampaignsService` (`:6`, `:15`, `:20`)                                                                                                                                                                                                                                                                                |
| `dto.ts`                                                   | perd `CreateCampaignDto:38`, `CampaignProgressDto:109`, `CampaignCommercialDto:123`, `CampaignAttemptDto:137` (sa forme est reprise par `LotExportAttemptDto`), `CampaignSummaryDto:189`, `CampaignDetailDto:217`, `CampaignListDto:253`, `CampaignQueryDto:258`, `ProgrammeQueryDto:323`, plus `:596` et `:604`                  |
| `directory.service.ts`, `directory-cursor.test.ts`         | **GARDER** : l'annuaire hors ligne ne mentionne ni tâche ni campagne                                                                                                                                                                                                                                                              |

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/rep-campaigns/`

| Fichier                              | Verdict                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rep-campaigns.service.ts` (28,8 Ko) | **RÉDUIRE** à `recordAttempt` (`:600`), `resolveSuggested`, `validatedComment`, `resolveWhatsappPatch`. Les 550 premières lignes (tirage, tourniquet, répartition, détail, programme, ZIP) disparaissent. Retirer la recherche de tâche active (`:641`), les écritures `taskId` et `campaignId` (`:655`, `:656`) et la clôture (`:708`) |
| `rep-campaigns.controller.ts`        | ne garde que `recordAttempt` (`:83`)                                                                                                                                                                                                                                                                                                    |
| `dto.ts`                             | perd les onze DTO listés en §2.2, plus `taskId:499` et `taskClosed:505`                                                                                                                                                                                                                                                                 |

Retraits en cascade :

| Fichier:ligne                                                                                                        | Ce qu'on retire                                                                                            |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/users/users.service.ts:312` à `:321`         | Les deux `updateMany` de réassignation de tâches dans la reprise de portefeuille, et le commentaire `:312` |
| `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/prospects/prospects.service.ts:103` à `:106` | La clôture de tâche dans `closeProspectWork` ; **garder** l'annulation du rappel (`:107`)                  |
| `.../prospects.service.ts:663`                                                                                       | `tx.callTask.updateMany` dans la fusion de fiches                                                          |

#### 4.1.3 Synchronisation

Fichiers sous
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/sync/`.

| Ligne                                                                                          | Élément                                                                             | Verdict                                   |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- |
| `cursor.ts:22` à `:25`                                                                         | Les quatre flux de `SYNC_STREAMS`                                                   | **SUPPRIMER**                             |
| `sync.service.ts:1140`                                                                         | `callCampaign.findMany`, borné par `tasks: { some: { assignedToId } }` (`:1143`)    | **SUPPRIMER**                             |
| `sync.service.ts:1155`                                                                         | `callTask.findMany`, borné par `assignedToId` (`:1158`)                             | **SUPPRIMER**                             |
| `sync.service.ts:1166`                                                                         | `repCallCampaign.findMany`, borné par `commerciaux: { some: { userId } }` (`:1169`) | **SUPPRIMER**                             |
| `sync.service.ts:1177`                                                                         | `repCallTask.findMany` (`:1180`)                                                    | **SUPPRIMER**                             |
| `sync.service.ts:1282` à `:1317`                                                               | Les quatre tableaux de la réponse                                                   | **SUPPRIMER**                             |
| `sync.service.ts:1212` à `:1229`                                                               | `deletions` (représentants et prospects)                                            | **GARDER**                                |
| `dto.ts:674`, `:686`, `:707`, `:709`, `:778` à `:782`                                          | Les quatre DTO et les quatre champs                                                 | **SUPPRIMER**                             |
| `sync.service.ts:186`                                                                          | `assignedTo(userId)`                                                                | **SUPPRIMER**                             |
| `sync.service.ts:202` à `:213`                                                                 | `mineOrAssignedRepresentant`                                                        | **SIMPLIFIER** (voir A4)                  |
| `sync.service.ts:803` à `:818`                                                                 | Garde d'autorisation de la tentative (`:807`)                                       | **TRANSFORMER** vers la nouvelle portée   |
| `sync.service.ts:1006` à `:1022`                                                               | `assertProspectWritable`, repli sur `callTask.findFirst` (`:1012`)                  | **TRANSFORMER**                           |
| `sync.service.ts:720` à `:740`                                                                 | `assertRepresentantWritable`, repli sur `callTask.findFirst` (`:726`)               | **TRANSFORMER**                           |
| `sync.controller.ts:29`                                                                        | `MIN_PULL_PAYLOAD_VERSION = 4`                                                      | **4 vers 5**                              |
| `phase2-sync.service.ts:104` à `:119`, `:128`, `:139`, `:140`, `:246`, `:247`, `:295` à `:298` | Lecture de tâche, projet par campagne, écritures, clôture                           | **TRANSFORMER** ou **SUPPRIMER** (A4, D1) |

Les rappels ne descendent pas par le pull : ils sont servis en ligne par
`GET /v1/phase2/callbacks`. Ce plan ne change pas ce choix.

#### 4.1.4 Portée

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/common/scope.ts`

| Ligne               | Fonction                                 | Règle actuelle                                                              |
| ------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| `:38`               | `mineOrAssignedProspect(userId)`         | `createdById = userId` OU `callTasks.some(assignedToId = userId, isActive)` |
| `:46`               | `prospectReadScope(user)`                | Supervision et direction : tout. Autres : `mineOrAssignedProspect`          |
| `:55`               | `prospectSyncScope(user)`                | Admin : tout. Autres : `mineOrAssignedProspect`                             |
| `:20`, `:25`, `:80` | `ownerScope`, `readScope`, `manageScope` | `createdById` seul, aucune tâche. **Inchangés**                             |

Tous les endroits où `call_tasks` ou `assignedToId` entre dans un `WHERE`, à
traiter en A3, A4, A5, A6 et A7 :

| Fichier:ligne                                                                                                       | Contexte                                                     |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/api/src/common/scope.ts:41`                                                                                   | `mineOrAssignedProspect`                                     |
| `apps/api/src/common/prospect-where.ts:21`                                                                          | Injection de `prospectReadScope` dans le `AND`               |
| `apps/api/src/common/prospect-where.ts:78` à `:87`                                                                  | Filtres publics `campaignId` et `assignedToId`               |
| `apps/api/src/modules/analytics/analytics.sql.ts:17`, `:44` à `:49`                                                 | `porteeProspect` : `EXISTS (SELECT 1 FROM "call_tasks" ...)` |
| `apps/api/src/modules/analytics/analytics.sql.ts:107` à `:120`                                                      | `campaignCondition`                                          |
| `apps/api/src/modules/analytics/pilotage.service.ts:52`, `:89`                                                      | `INNER JOIN "call_tasks"`                                    |
| `apps/api/src/modules/analytics/supervision.service.ts:107`, `:170`, `:301`                                         | `taskScope`, `FROM "call_tasks"`, `LEFT JOIN "call_tasks"`   |
| `apps/api/src/modules/sync/sync.service.ts:187`, `:210`, `:211`, `:726`, `:807`, `:1013`, `:1143`, `:1158`, `:1180` | Portées et gardes de synchronisation                         |
| `packages/database/src/segment.ts:124`                                                                              | `callTasks: { none: { isActive: true } }`                    |
| `apps/api/src/modules/notifications/reminders.service.ts:175` à `:181`                                              | `groupBy assignedToId` sur les tâches ouvertes               |
| `apps/api/src/modules/users/users.service.ts:314` à `:321`                                                          | Reprise de portefeuille                                      |
| `apps/api/src/modules/prospects/prospects.service.ts:103`, `:663`                                                   | Fermeture et fusion de fiches                                |

#### 4.1.5 Statistiques et supervision

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/analytics/pilotage.service.ts` :
supprimer `campaignPilotage` (`:16` à `:136`) et `projectEnd` (`:250`). Motif :
`taches` (`:66`), `restantes` (`:68`), `closes7` (`:70`), `closedPerDay` (`:82`
à `:96`), `remaining`, `observedPace`, `estimatedEndDate` comptent tous des
lignes de `call_tasks`. Sans tâches, la « fin projetée » n'a plus de
dénominateur : un lot d'export n'est pas un travail à solder. **Ne pas recréer
d'endpoint** : le nombre d'appels, la part d'appels joignables et le nombre de
méthodes obtenues sont déjà rendus par `GET /supervision/activite`
(`supervision.service.ts:131` à `:148`).

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/analytics/supervision.service.ts`

| Ligne                          | Élément                                                                | Verdict                                                                                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `:103` à `:107`                | `campaign(column)` et `taskScope`                                      | **SUPPRIMER**                                                                                                                                                                                                                            |
| `:106`                         | `attemptScope` sur `ca."campaignId"`                                   | **SUPPRIMER**, remplacer par `TRUE` (`ALL_ROWS`)                                                                                                                                                                                         |
| `:112` à `:115`                | `repScope` bâti sur `rca."campaignId"`                                 | **TRANSFORMER** : ne garder que la borne projet (`Projet.GRAND_PUBLIC` vers `FALSE`)                                                                                                                                                     |
| `:166` à `:173`                | Quatrième branche du `UNION ALL`, qui compte les tâches closes         | **SUPPRIMER**                                                                                                                                                                                                                            |
| `:145`, `:169`, `:228`, `:270` | Colonne `tache`, agrégat `taches`                                      | **SUPPRIMER**                                                                                                                                                                                                                            |
| `:294` à `:306`                | `roster` avec `LEFT JOIN "call_tasks"` et `COUNT(ct."id") AS ouvertes` | **TRANSFORMER** : la liste des téléconseillers reste (elle sert à repérer les agents muets, `reminders.service.ts:265`), le compte de tâches tombe. La requête devient `SELECT id, fullName, isActive FROM users WHERE <teleconseiller>` |
| `:357`                         | `openTasks: row.ouvertes`                                              | **SUPPRIMER**                                                                                                                                                                                                                            |
| `:377`                         | `tasksClosed: base.taches`                                             | **SUPPRIMER**                                                                                                                                                                                                                            |

`.../analytics/supervision.dto.ts` : retirer `SupervisionQueryDto.campaignId`
(`:58` à `:66`), `SupervisionActivityCountsDto.tasksClosed` (`:101`),
`SupervisionTeleconseillerDto.openTasks` (`:190` à `:194`).

Autres services d'analytics : `quality.service.ts`, `funnel.service.ts`,
`portfolio.service.ts`, `segment-conversions.service.ts` et
`analytics.service.ts` ne référencent ni `callTask`, ni `campaignId`, ni
`assignedToId`. **Ils ne changent que par ricochet**, via `prospectConditions`
(`analytics.sql.ts:10`) qui perd `porteeProspect` et `campaignCondition`.

#### 4.1.6 Rappels et notifications

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/notifications/reminders.service.ts`

| Ligne           | Élément                                                      | Verdict                                                                                                               |
| --------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `:41`, `:42`    | Clés `OPEN_CALL_TASKS`, `OPEN_REP_CALL_TASKS`                | **SUPPRIMER**                                                                                                         |
| `:59` à `:65`   | Interface `OpenTaskDelegate`                                 | **SUPPRIMER**                                                                                                         |
| `:128`, `:129`  | Appels dans `runAll` ; `runs` (`:134`) passe de cinq à trois | **SUPPRIMER**                                                                                                         |
| `:141` à `:161` | `remindOpenCallTasks`, `remindOpenRepCallTasks`              | **SUPPRIMER**                                                                                                         |
| `:163` à `:198` | `remindOpenTasks`                                            | **SUPPRIMER**                                                                                                         |
| `:196`          | `category: NotificationCategory.CAMPAGNE`                    | disparaît avec son seul usage ; l'enum reste (§4.1.1)                                                                 |
| `:205` à `:225` | `remindDueCallbacks`                                         | **GARDER** : groupe sur `scheduledCallback.assignedToId`, sans tâche                                                  |
| `:239` à `:280` | `sendDailyReport`                                            | **TRANSFORMER** : il lit `activity.teleconseillers` (`:265`), qui reste, mais ne doit plus lire de compteur de tâches |

Variables d'environnement mortes : `NOTIFICATIONS_OPEN_TASKS_ENABLED` et
`NOTIFICATIONS_OPEN_TASKS_MIN` (lues à `:172` et `:185`), à retirer de
`apps/api/src/modules/notifications/notifications.env.ts` et de
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/.env.example`.

Aucune autre notification, aucun gabarit et aucun envoi d'e-mail ne parle de
campagne ou de tâche : vérifié sur `notifications.service.ts`, `audience.ts`,
`templates.service.ts` et `dto.ts` du module.

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/callbacks/callbacks.service.ts` :
`CALLBACK_SELECT` (`:26`) sélectionne `campaignId` (`:32`) et `taskId` (`:33`),
recopiés dans `toDto` (`:49`, `:50`). Ces quatre lignes tombent, avec
`dto.ts:53` et `:54`.

#### 4.1.7 Exports, purge, démonstration

Réutilisable tel quel, à ne pas réécrire :

| Fichier                                                       | Ligne  | Élément                                                                                                                   |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/modules/export/export.controller.ts`            | `:42`  | `GET /export/prospects.xlsx`, filtres `ProspectFilterDto` étendu (`export/dto.ts:13`), modes `filtered` et `consolidated` |
| `apps/api/src/modules/export/export.controller.ts`            | `:197` | `GET /export/representants.xlsx`                                                                                          |
| `apps/api/src/modules/export/representants-export.service.ts` | `:52`  | `EXPORT_COLUMNS` : nom, téléphone, département, IEF, commercial, prospects, notes, dates                                  |
| `apps/api/src/modules/export/representants-export.service.ts` | `:112` | Écriture en flux, pagination keyset par `id asc`                                                                          |
| `apps/api/src/modules/phase2/programme-pdf.ts`                | `:360` | `RepProgrammeData`, `writeRepProgrammePdf`, A4, 25 lignes par page                                                        |

Catalogue de purge :

| Fichier:ligne                                                                                   | Verdict                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/admin/purge-plan.ts:10` | Étape `callTasks` : **SUPPRIMER**                                                                                                                                                                            |
| `.../purge-plan.ts:17`                                                                          | Étape `repCallTasks` : **SUPPRIMER**                                                                                                                                                                         |
| `.../purge-plan.ts:108`                                                                         | `steps: ['scheduledCallbacks', 'callTasks']` : **TRANSFORMER**                                                                                                                                               |
| `.../purge-plan.ts:125`                                                                         | Bloc citant `repCallTasks` : **TRANSFORMER**                                                                                                                                                                 |
| `.../purge-steps.ts:52` à `:90`                                                                 | Six étapes (`callTasks`, `callCampaignCommerciaux`, `callCampaigns`, `repCallTasks`, `repCallCampaignCommerciaux`, `repCallCampaigns`) : **SUPPRIMER les six**, **ajouter** `lotExportItems` et `lotsExport` |

Espace de démonstration :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/database/src/demo-workspace-factory.ts:121`
à `:160` crée deux campagnes de démonstration avec leurs commerciaux et leurs
tâches : **supprimer ce bloc**. L'espace démo garde ses prospects, ses
représentants et ses tentatives d'appel.
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/api/src/modules/demo/demo.service.ts:32`
compte les campagnes dans l'état de l'espace : retirer cette ligne du décompte.
Ce fichier est touché par le correctif de l'espace démo en cours : relire avant
d'éditer.

#### 4.1.8 Modèle cible du lot

À ajouter à la fin de `schema.prisma`, après le bloc du registre des visites.

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
l'exprimer, sur le modèle des index partiels du dépôt (`schema.prisma:16`) :

```sql
ALTER TABLE "lot_export_items"
  ADD CONSTRAINT "lot_export_items_une_seule_cible"
  CHECK (num_nonnulls("representantId", "prospectId") = 1) NOT VALID;
```

Elle est posée `NOT VALID` puis validée dans une seconde migration, sur le
modèle de
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/database/prisma/migrations/20260814090100_valider_contraintes/`.
Sur une table neuve et vide la validation est immédiate ; la forme reste celle
du dépôt.

Relations inverses à ajouter : `User.lotsExport LotExport[] @relation("LotExportCreatedBy")`,
`Representant.lotItems LotExportItem[]`, `Prospect.lotItems LotExportItem[]`.

**Une seule paire de tables pour les deux cibles**, et non deux paires : le
commentaire `schema.prisma:1146` justifiait la séparation des deux familles de
campagne par l'invariant « une seule tâche active par prospect », qui disparaît.
Un lot ne porte aucun invariant métier.

#### 4.1.9 Sort des lignes existantes

| Table                                                                   | Volume attendu                                                                        | Que faire                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `call_tasks`                                                            | Une ligne par prospect distribué, jusqu'à ~120 000 par campagne (`schema.prisma:944`) | **Supprimer.** Une tâche n'est pas un fait métier, c'est une intention d'appel. Le fait est la tentative, conservée dans `call_attempts`                                              |
| `call_campaigns`, `call_campaign_commerciaux`                           | Quelques dizaines de lignes                                                           | **Supprimer**                                                                                                                                                                         |
| `rep_call_tasks`, `rep_call_campaigns`, `rep_call_campaign_commerciaux` | Idem                                                                                  | **Supprimer**                                                                                                                                                                         |
| `call_attempts.taskId` et `.campaignId`                                 | Sur les tentatives issues d'une campagne                                              | **Perdues volontairement** (D7). Le lien « quel appel appartient à quelle opération » est repris pour l'avenir par `lots_export` et la date ; pour le passé, il n'est pas reconstruit |
| `rep_call_attempts.taskId` et `.campaignId`                             | Idem                                                                                  | Idem                                                                                                                                                                                  |
| `scheduled_callbacks.taskId` et `.campaignId`                           | Renseignées quand le rappel venait d'une campagne                                     | **Perdues.** `assignedToId` et `sourceAttemptId` suffisent à la file et à son idempotence                                                                                             |

**Aucune reprise de données pour les lots** : un lot décrit un téléchargement, et
aucun téléchargement passé n'a été enregistré. La table démarre vide.

### 4.2 Web

Le panel sert six rôles (`ADMIN`, `DIRECTION`, `SUPERVISEUR`, `COMMERCIAL` alias
téléconseiller, `BANQUE_FINANCE`, `ACCUEIL`) répartis en quatre coques : Accueil
(registre des visites), Projet CHUES (enrôlement d'enseignants syndiqués),
Projet Grand Public, Admin. Le projet CHUES se fait en trois étapes, nommées
partout de la même façon
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/chues/etapes.tsx:14`) :
qualifier un représentant (`/chues/appels-representants`), ajouter un prospect
(`/chues/prospects/nouveau`), convertir un prospect (`/chues/console`).

#### 4.2.1 Routes

Racine :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/app/(panel)/`

| Fichier                                                                                                 | Verdict         | Détail                                                                                     |
| ------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| `chues/page.tsx`                                                                                        | **TRANSFORMER** | Précharge quatre compteurs (`:41` à `:58`), dont deux décrivent une file                   |
| `chues/layout.tsx`                                                                                      | GARDER          | Monte le sélecteur des trois étapes (`:21`)                                                |
| `chues/appels-representants/page.tsx`                                                                   | **TRANSFORMER** | Précharge `fetchRepScriptQueue` (`:8`, `:24` à `:26`), la liste confiée                    |
| `chues/appels-representants/loading.tsx`                                                                | GARDER          |                                                                                            |
| `chues/appels-representants/page.test.tsx`                                                              | **TRANSFORMER** | Vérifie le préchargement de la file                                                        |
| `chues/console/page.tsx`                                                                                | **TRANSFORMER** | Précharge la file (`:23` à `:26`) ; le refus dit « La file d'appel des prospects » (`:19`) |
| `chues/console/loading.tsx`                                                                             | GARDER          |                                                                                            |
| `chues/rappels/page.tsx`                                                                                | **TRANSFORMER** | Copie « La file des rappels » (`:14`)                                                      |
| `chues/supervision/page.tsx`                                                                            | GARDER          |                                                                                            |
| `chues/suggestions/page.tsx`                                                                            | GARDER          | Les numéros recommandés par les représentants ne sont pas une file assignée                |
| `chues/prospects/page.tsx`                                                                              | **TRANSFORMER** | Ajouter un geste par ligne vers la consignation (B9)                                       |
| `chues/prospects/nouveau/page.tsx`, `chues/representants/page.tsx`, `chues/representants/[id]/page.tsx` | GARDER          |                                                                                            |
| `chues/statistiques/page.tsx`                                                                           | GARDER          | Déjà refondu par le chantier Chiffres (rend `ChiffresView`)                                |
| `chues/tableau-de-bord/page.tsx`                                                                        | GARDER          | Redirection permanente vers `/chues/statistiques`                                          |
| `chues/campagnes/page.tsx`                                                                              | **REMPLACER**   | Devient la liste des lots. Garde ADMIN, SUPERVISEUR, DIRECTION (`:21`)                     |
| `chues/campagnes/[id]/page.tsx`                                                                         | **REMPLACER**   | Devient le détail d'un lot                                                                 |
| `chues/campagnes/representants/page.tsx` et `[id]/page.tsx`                                             | **SUPPRIMER**   | Fusionnées dans la liste unique                                                            |
| `chues/campagnes/access.test.tsx`                                                                       | **TRANSFORMER** | Importe quatre pages (`:13` à `:17`), n'en garder que deux                                 |
| `chues/banque/**`, `chues/dossiers/**`, `chues/demandes-clients/**`                                     | GARDER          | Hors périmètre                                                                             |
| `grand-public/page.tsx`, `[id]/page.tsx`, `nouveau/page.tsx`                                            | GARDER          |                                                                                            |
| `grand-public/console/page.tsx`                                                                         | **TRANSFORMER** | Même refonte ; refus « La file d'appel Grand Public » (`:23`)                              |
| `grand-public/rappels/page.tsx`                                                                         | GARDER          | Réexporte la page CHUES (`:1`)                                                             |
| `grand-public/statistiques/page.tsx`, `tableau-de-bord/page.tsx`                                        | GARDER          |                                                                                            |
| `grand-public/campagnes/page.tsx`                                                                       | **REMPLACER**   | Liste des lots Grand Public                                                                |
| `grand-public/campagnes/[id]/page.tsx`                                                                  | **REMPLACER**   | Réexporte la page CHUES (`:3`) ; garder ce montage                                         |

#### 4.2.2 Composants de campagne

Racine :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/phase2/`

| Fichier                                                   | Verdict                                      | Ce qui le condamne, ce qu'on récupère                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaigns-view.tsx`                                      | **REMPLACER**                                | « Distribuer les appels aux téléconseillers. Tirage définitif. » (`:56`), `CampaignProgressBar` (`:131`), compteur de téléconseillers (`:134`), date de clôture (`:140`). **Récupérer** la pagination (`:156` à `:188`)                                                                                                                                                   |
| `campaign-detail-view.tsx`                                | **REMPLACER**                                | Clôture (`:84`, `:158`, `:298`), pause et reprise (`:101`, `:147`), « Répartition par téléconseiller » (`:212`), `CommercialCard` avec programme PDF (`:392` à `:489`), « Tâche d'un autre téléconseiller » (`:282`). **Récupérer** « Tentatives récentes » (`:231` à `:296`), `AttemptRenseignements` (`:358` à `:390`) et le bouton de téléchargement (`:403` à `:416`) |
| `campaign-create-dialog.tsx`                              | **REMPLACER**                                | Sélection nominative de téléconseillers (`:209` à `:268`), aperçu du tourniquet (`:345` à `:464`), « Le tirage est définitif » (`:175`), « Lancer la campagne » (`:334`)                                                                                                                                                                                                  |
| `rep-campaign-create-dialog.tsx`                          | **REMPLACER**                                | Équipe (`:310` à `:364`), aperçu (`:486` à `:542`). **Récupérer** la cascade Région, Département, IEF (`:223` à `:269`), le choix de qualification (`:48` à `:64`, `:271` à `:276`) et l'interrupteur « seulement les représentants dormants » (`:281` à `:306`) : ce sont exactement les critères de cible d'un lot                                                      |
| `rep-campaign-detail-view.tsx`                            | **SUPPRIMER**                                | Jumeau du détail campagne                                                                                                                                                                                                                                                                                                                                                 |
| `campaign-target-field.tsx`                               | **REMPLACER**                                | À déplacer vers `components/lots/cible.tsx`. `RadioCardGroup` (`:17` à `:68`) et le champ (`:70` à `:105`) sont réutilisables ; la légende `:99` change, et chaque carte produit désormais `{ projet, segment }` ou `{ projet, type }` (§2.2)                                                                                                                             |
| `campaign-progress-bar.tsx`                               | **SUPPRIMER**                                | Ne mesure que l'avancement de tâches                                                                                                                                                                                                                                                                                                                                      |
| `campaigns-tabs.tsx`                                      | **SUPPRIMER**                                | Deux onglets prospects et représentants ; une seule liste les remplace                                                                                                                                                                                                                                                                                                    |
| `campaigns-filters-bar.tsx`                               | **REMPLACER**                                | Devient `lots-filters-bar.tsx`, sans le filtre de statut                                                                                                                                                                                                                                                                                                                  |
| `rep-campaigns-filters-bar.tsx`, `rep-campaigns-view.tsx` | **SUPPRIMER**                                |                                                                                                                                                                                                                                                                                                                                                                           |
| `spread-days-field.tsx`                                   | **SUPPRIMER**                                | L'étalement n'existe que pour distribuer des tâches                                                                                                                                                                                                                                                                                                                       |
| `use-campaign-filters.ts`                                 | **REMPLACER**                                | Devient `use-lot-filters.ts`                                                                                                                                                                                                                                                                                                                                              |
| `use-rep-campaign-filters.ts`                             | **SUPPRIMER**                                |                                                                                                                                                                                                                                                                                                                                                                           |
| `call-recording-player.tsx` et son test                   | **GARDER**, déplacer sous `components/lots/` | Seul lecteur des notes vocales enregistrées depuis le mobile, utile dans la liste des appels d'un lot                                                                                                                                                                                                                                                                     |

#### 4.2.3 Console et script représentant

| Emplacement                                                                                   | Verdict     | Ce qui le condamne                                                                                              |
| --------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/console/console-view.tsx:120`                                        | SUPPRIMER   | État `campaignId`                                                                                               |
| `…:135`, `:169`, `:752` à `:762`, `:870` à `:933`                                             | SUPPRIMER   | `rawOrder` et `SortExplainer` : l'explication de l'ordre d'une file                                             |
| `…:140` à `:151`                                                                              | TRANSFORMER | `fetchConsoleCampaigns` et `fetchConsoleQueue(campaignId, …)`                                                   |
| `…:130` à `:133`, `:186` à `:219`, `:272` à `:293`, `:344` à `:348`                           | TRANSFORMER | `done`, `enchaine`, `nextAfter`, `move`, `skip` : l'enchaînement automatique                                    |
| `…:433`                                                                                       | TRANSFORMER | « La file d'appel n'a pas pu être chargée. »                                                                    |
| `…:441` à `:497`                                                                              | TRANSFORMER | État vide « Aucun prospect à appeler … dans cette campagne »                                                    |
| `…:729` à `:799`                                                                              | SUPPRIMER   | Tiroir « Suivants à appeler », son sélecteur de campagne (`:738`) et sa note (`:791`)                           |
| `…:84` à `:102`                                                                               | TRANSFORMER | Carte clavier : retirer « ↑ ↓ Parcourir la file » et « Espace Ouvrir la fiche sélectionnée »                    |
| `…:822` à `:861`                                                                              | SUPPRIMER   | Palette `Ctrl/Cmd K` (D10)                                                                                      |
| `…:504` à `:549`, `:559` à `:626`, `:561` à `:571`, `:628` à `:683`, `:551` à `:558`          | GARDER      | Fiche, dernier appel, issues au clavier, `ConversionFields`, choix d'échéance, garde de fiche close             |
| `apps/web/src/components/console/rep-script.tsx:100` à `:104`                                 | SUPPRIMER   | Requête `repScriptKeys.queue` / `fetchRepScriptQueue`                                                           |
| `…/rep-script.tsx:113` à `:117`                                                               | TRANSFORMER | `file`, `liste`, `listeEstFile` : la liste confiée passe devant l'annuaire                                      |
| `…/rep-script.tsx:128` à `:140`, `:167` à `:171`                                              | TRANSFORMER | Squelette, erreur et phrase de la file                                                                          |
| `…/rep-script.tsx:75` à `:81`                                                                 | TRANSFORMER | `annuaireFilters` doit sortir de ce module `'use client'` pour que la page serveur précharge la même clé (§0.4) |
| `…/rep-script.tsx:142` à `:155`, `:220` à `:247`, `:249` à `:682`                             | GARDER      | Recherche, fiche, deux étapes de questions, échéance de rappel, envoi unique : c'est déjà l'état cible          |
| `apps/web/src/components/console/console-ui.tsx`, `use-shortcuts.ts`, `conversion-fields.tsx` | GARDER      |                                                                                                                 |

**État cible de l'étape 1** (`/chues/appels-representants`) : l'écran ouvre sur
le champ de recherche et l'annuaire, sans liste confiée. Sans saisie, les vingt
premiers représentants par ordre alphabétique. Choix d'une fiche (nom, numéro,
département, pastille de relation), garde de confirmation si la relation est
déjà tranchée (`rep-script.tsx:385` à `:415`), deux étapes de questions
(`:452` à `:640`), puis « Enregistrer » envoie **une seule** tentative et
ramène à la liste avec « Appel enregistré pour X ».

**État cible de l'étape 3** (`/chues/console` et `/grand-public/console`),
calqué sur l'étape 1 pour que les deux écrans s'expliquent avec les mêmes mots :

1. Champ « Quel prospect avez-vous appelé ? », autofocalisé, débounce par
   `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/use-debounced-value.ts`
   (comme `rep-script.tsx:98`).
2. Liste de résultats : nom, numéro, dernier appel, statut. Sans saisie, les
   vingt fiches les plus récemment saisies du projet courant. Requête
   `GET /api/v1/prospects` avec `search`, `projet`, `pageSize: 20`, sans
   `campaignId` ni `assignedToId`.
3. Fiche ouverte : nom, numéro en grand avec « Copier », deux lignes de
   contexte, dernier appel.
4. Issues au clavier et au bouton inchangées : méthode obtenue (1, 2, 3, 9), à
   rappeler (5), injoignable (4), refus (6), mauvais numéro (7), autre (8).
5. Formulaire de conversion et choix d'échéance inchangés.
6. Après enregistrement, retour à la liste avec « Appel enregistré pour X ».
   Plus de « Personne suivante » (D11).
7. `?fiche=<id>` continue d'ouvrir directement une fiche, puisque les rappels
   s'en servent. Il devient une lecture par identifiant
   (`GET /api/v1/prospects/{id}`) au lieu d'une recherche dans la file chargée,
   ce qui supprime au passage l'avertissement « la fiche ouverte depuis les
   rappels n'est pas dans cette file » (`console-view.tsx:449`, `:505`).
8. La carte clavier perd « ↑ ↓ » et « Espace ».

#### 4.2.4 Écran d'ouverture, lots, supervision, chiffres

| Emplacement                                                                                                                                  | Verdict     | Détail                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/chues/hub-filters.ts:7` à `:12`                                                                                     | TRANSFORMER | `A_APPELER` décrit une file. Le filtre reste valable (`relationStatus: 'INCONNU'`), le nom devient `NON_QUALIFIES`                                       |
| `…/hub-filters.ts:14` à `:20`                                                                                                                | GARDER      | `SANS_PROSPECT` est une observation sur la base                                                                                                          |
| `apps/web/src/components/chues/hub-view.tsx:48` à `:57`                                                                                      | SUPPRIMER   | Calcul `prioritaire`                                                                                                                                     |
| `…/hub-view.tsx:82`, `:97`, `:103`, `:118`, `:124`, `:148`, `:162`, `:168`, `:177` à `:181`, `:229` à `:239`                                 | SUPPRIMER   | Propagation de `prioritaire`, pastille « À faire maintenant », variante de bouton                                                                        |
| `…/hub-view.tsx:90`, `:132`                                                                                                                  | TRANSFORMER | Deux légendes (§4.2.6)                                                                                                                                   |
| `…/hub-view.tsx:133` à `:141`, `:190` à `:219`                                                                                               | GARDER      | Compte des rappels dus, et le squelette qui empêche d'afficher un zéro provisoire                                                                        |
| `apps/web/src/components/chues/etapes.tsx:14` à `:18`                                                                                        | GARDER      | Les trois étapes ne bougent pas                                                                                                                          |
| `apps/web/src/components/supervision/activity-view.tsx:68`, `:69`, `:385`, `:386`, `:415`, `:416`, `:309` à `:312`                           | SUPPRIMER   | Colonnes « Tâches closes » et « Reste à faire », leurs cellules, la note qui les expliquait. Onze colonnes passent à neuf                                |
| `apps/web/src/components/supervision/supervision-view.tsx`                                                                                   | GARDER      | Présence et sessions                                                                                                                                     |
| `apps/web/src/lib/data/admin.ts:197`, `:207`, `:233`, `:243`, `:255`, `:265`, `:279`, `:299`, `:315`, `:328`, `:349`, `:457`, `:475`, `:489` | SUPPRIMER   | `openTasks` et `tasksClosed` dans `ActivityLine`, `ActivityTotals`, les moyennes et l'export CSV                                                         |
| `apps/web/src/components/chiffres/sources.ts:58` à `:64`, `:160`, `:189`                                                                     | TRANSFORMER | Colonne « Reste à appeler » de la table `par-teleconseiller`                                                                                             |
| `…/chiffres/sources.ts:140` à `:153`                                                                                                         | SUPPRIMER   | Carte `reste-a-appeler` (D3)                                                                                                                             |
| `apps/web/src/components/stats/campaigns-panel.tsx`                                                                                          | SUPPRIMER   | « Pilotage de campagne » (`:69`), tuile « Reste à faire » (`:136`), « Fiches clôturées par jour » (`:152`). Déjà orpheline depuis la refonte Chiffres    |
| Anciens panneaux banque et entonnoir                                                                                                         | SUPPRIMÉ    | Knip a confirmé qu'ils n'avaient plus aucun appelant après la refonte Chiffres                                                                           |
| `apps/web/src/lib/stat-explanations.ts:27` à `:33`, `:95` à `:106`                                                                           | SUPPRIMER   | Clés `campaignContactRate`, `campaignReachRate`, `campaignAttemptsPerMethod`, `campaignRemaining`, `campaignClosedPerDay`, `campaignClosedPerCommercial` |
| `apps/web/src/lib/data/advanced-stats.ts:25`                                                                                                 | SUPPRIMER   | `fetchCampaignPilotage`, plus `closedPerDayTotals`, `closedPerCommercial`, `estimatedEndLabel` s'ils n'ont plus d'appelant                               |

**État cible de l'écran des lots**, `/chues/campagnes` et
`/grand-public/campagnes` (D5 pour l'URL).

_Liste_ (ADMIN, SUPERVISEUR, DIRECTION) : une phrase en tête, un bouton
« Nouveau lot » pour qui peut créer, une barre de filtres (recherche par nom,
cible, auteur, période), et une ligne par lot : nom en lien, cible en clair
(« Représentants qualifiés, département de Thiès », « CHUES, segment BDD2 »),
nombre de fiches, date, auteur, et **appels passés sur ces fiches depuis**
(« 128 appels sur 340 fiches »). Ni barre de progression, ni statut, ni nombre
de téléconseillers, ni date de clôture. Pagination reprise de
`campaigns-view.tsx:156`.

_Création_ (ADMIN seulement, comme aujourd'hui via `canManage`) : un dialogue en
une seule étape, sans aperçu de tourniquet.

1. « Que veut-on exporter ? » : `RadioCardGroup` repris de
   `campaign-target-field.tsx`, cibles « Tout », les quatre segments BDD (CHUES),
   les quatre types Grand Public, et « Représentants » (CHUES seulement).
2. Nom du lot, trois caractères minimum.
3. Si la cible est « Représentants » : cascade Région, Département, IEF, choix
   de qualification « Tous / Non qualifiés / Qualifiés », interrupteur
   « seulement les représentants dormants ».
4. Un compte annoncé avant validation, « 340 fiches seront exportées », donné
   par `GET /api/v1/lots-export/apercu`, jamais estimé localement.
5. « Créer le lot », puis le téléchargement du classeur dans la foulée.

_Détail_ : en-tête (nom, cible en clair, date, auteur, nombre de fiches) ; un
bouton « Télécharger les fiches » qui réutilise
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/exports/download-button.tsx`
(`useFileDownload`), comme le font déjà `campaign-detail-view.tsx:403` et
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/representants/representants-view.tsx:57` ;
une section « Appels passés sur ces fiches » reprise de
`campaign-detail-view.tsx:231` à `:296`, avec `AttemptRenseignements` et
`CallRecordingPlayer` ; aucun bouton de clôture, de pause ni de reprise.

_Consigner depuis les listes_ (B9). Sans cela, une fiche trouvée dans une liste
ne mène à aucune consignation :

- `/chues/prospects` : une colonne d'action avec un lien « Consigner un appel »
  vers `/chues/console?fiche=<id>` dans
  `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/prospects/columns.tsx`,
  habillé en bouton, jamais un `Button` ;
- `/chues/representants/[id]` : le même geste vers
  `/chues/appels-representants?rep=<id>`, et l'étape 1 lit ce paramètre pour
  ouvrir directement la fiche.

_Rappels_ (`/chues/rappels`, `/grand-public/rappels`) : écran conservé, trois
corrections. Le lien de chaque ligne pointe en dur sur `/chues/console`
(`rappels-view.tsx:170`) alors que l'écran sert aussi le Grand Public : le
dériver du `pathname`, comme le fait déjà `projet` (`:64`). La copie ne parle
plus de « console d'appel » ni de « touche 5 » (`:53` à `:58`, `:174`). Le titre
de colonne « Téléconseiller » (`:132`, `:166`) **reste** : c'est qui a promis le
rappel, pas à qui on l'a assigné.

#### 4.2.5 Données, clés de cache, filtres

| Emplacement                                                                                                             | Verdict              | Détail                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/data/phase2.ts:16` à `:54`                                                                            | REMPLACER            | `toCampaignQuery`, `fetchCampaigns` vers les équivalents « lots »                                                                                                                                                       |
| `…/phase2.ts:79` à `:111`                                                                                               | SUPPRIMER            | `createCampaign` (remplacé par `createLot`), `closeCampaign`, `pauseCampaign`, `resumeCampaign`                                                                                                                         |
| `…/phase2.ts:113` à `:165`, `:198` à `:210`                                                                             | SUPPRIMER            | `CampaignPreview`, `spreadIntoDays`, `roundRobinSplit`, `buildCampaignPreview`, `fetchCampaignPreview`                                                                                                                  |
| `…/phase2.ts:189` à `:196`                                                                                              | SUPPRIMER            | `countOpenTasks`                                                                                                                                                                                                        |
| `…/phase2.ts:212` à `:234`                                                                                              | SUPPRIMER            | `programmePdfUrl`, `programmePdfFileName`                                                                                                                                                                               |
| `…/phase2.ts:63` à `:77`, `:167` à `:187`, `:217` à `:225`                                                              | GARDER               | `fetchCallRecording`, `countPendingProspects`, `slugForFileName`                                                                                                                                                        |
| `apps/web/src/lib/data/rep-campaigns.ts`                                                                                | SUPPRIMER le fichier | Sauf `RepQualification` (`:73`) et `REP_QUALIFICATION_STATUSES` (`:76` à `:81`), à déplacer dans `lib/data/lots.ts`. `buildRepAttempt` (`:761`) et `pushRepCallAttempt` (`:774`) vivent déjà dans `lib/data/console.ts` |
| `apps/web/src/lib/data/console.ts:23` à `:27`                                                                           | TRANSFORMER          | `consoleKeys.queue(campaignId)` et `consoleKeys.campaigns`                                                                                                                                                              |
| `…/console.ts:43` à `:67`                                                                                               | TRANSFORMER          | `fetchConsoleQueue` (paramètre `campaignId`, tri figé, `pageSize: 200`) devient `fetchProspectsAChercher(search, projet)`, paginée                                                                                      |
| `…/console.ts:69` à `:84`                                                                                               | SUPPRIMER            | `fetchConsoleCampaigns` et son indice « X ouvertes »                                                                                                                                                                    |
| `…/console.ts:232` à `:342`                                                                                             | SUPPRIMER            | `QueueBucket`, `QUEUE_BUCKET_LABELS`, `BUCKET_RANK`, `bucketOf`, `orderKey`, `sortQueue`, `buildQueue`, `undatedCallbacks`                                                                                              |
| `…/console.ts:344` à `:348`, `:357` à `:382`                                                                            | SUPPRIMER            | `nextAfter`, `queueLabel`                                                                                                                                                                                               |
| `…/console.ts:692` à `:712`                                                                                             | SUPPRIMER            | `REP_QUEUE_SIZE`, `repScriptKeys.queue`, `RepScriptPage`, `fetchRepScriptQueue`. **Garder** `repScriptKeys.root`, utilisé pour l'invalidation (`rep-script.tsx:151`)                                                    |
| `…/console.ts:29` à `:34`, `:86` à `:143`, `:145` à `:230`, `:384` à `:690`, `:714` à `:779`                            | GARDER               | Rappels, créneaux, validation d'appel, conversion, envoi par `sync/push`, appel représentant                                                                                                                            |
| `apps/web/src/lib/query-keys.ts:56` à `:88`                                                                             | REMPLACER            | Bloc « Phase 2 » vers `lotsRoot`, `lots(filters)`, `lot(id)`, `lotApercu(criteres)`                                                                                                                                     |
| `apps/web/src/lib/campaign-filters.ts` (93 lignes)                                                                      | REMPLACER            | Devient `lot-filters.ts` sans `status` (`:12`, `:18`, `:41`, `:58`, `:88`)                                                                                                                                              |
| `apps/web/src/lib/rep-campaign-filters.ts` et son test                                                                  | SUPPRIMER            |                                                                                                                                                                                                                         |
| `apps/web/src/lib/filters.ts:41`, `:80`, `:110`, `:133`, `:189`                                                         | SUPPRIMER            | `campaignId` disparaît du contrat (D4). **Écart tranché** : le plan web voulait le garder en le renommant « lot d'export »                                                                                              |
| `apps/web/src/components/filters/filters-bar.tsx:287`, `:288` et `apps/web/src/components/filters/advanced-chips.ts:29` | SUPPRIMER            | Le filtre et son chip disparaissent avec `campaignId`                                                                                                                                                                   |
| `apps/web/src/lib/types.ts:125` à `:133`                                                                                | TRANSFORMER          | `CampaignSummary`, `CampaignDetail`, `CampaignCommercial`, `CampaignProgress`, `CreateCampaignInput` suivent le contrat. `CampaignAttempt` (`:131`) survit sous le nom du lot                                           |
| `…/types.ts:126`, `:149` à `:159`, `:232` à `:237`, `:244`                                                              | SUPPRIMER            | `CampaignStatus`, `CAMPAIGN_SCOPES`, `CAMPAIGN_STATUS_LABELS`, l'entrée correspondante de `FilterListCoverage` (§2.2)                                                                                                   |
| `…/types.ts:348`                                                                                                        | SUPPRIMER            | `ReferenceData.campagnes`, avec sa source `apps/web/src/lib/data/reference.ts:43` à `:49` et `:72` à `:76`, qui appelait `GET /api/v1/phase2/campaigns`                                                                 |
| `apps/web/src/app/moved-routes.ts:29`, `:30`                                                                            | TRANSFORMER          | `phase2` vers `/chues/campagnes` (garder) ; `rep-campaigns` vers `/chues/campagnes` (la sous-route disparaît)                                                                                                           |
| `apps/web/src/app/moved-routes.ts:40` à `:42`                                                                           | GARDER               | `/phase2/callbacks` vers `/chues/rappels`                                                                                                                                                                               |
| `apps/web/src/lib/data/inbox.ts:85` à `:124`                                                                            | GARDER               | La liste blanche doit continuer d'accepter `/campagnes`, `/chues/campagnes`, `/phase2` et `/rep-campaigns` : des notifications déjà en base portent ces adresses, et `moved-routes.ts` les rattrape                     |

Fichiers à créer sous
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/lots/` :
`cible.tsx`, `lots-view.tsx`, `lots-filters-bar.tsx`, `lot-create-dialog.tsx`,
`lot-detail-view.tsx`, plus `call-recording-player.tsx` et son test déplacés
sans modification. Côté données :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/lot-filters.ts`
et `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/lib/data/lots.ts`
(`fetchLots`, `fetchLot`, `createLot`, `apercuLot`, `lotExportUrl`,
`lotExportFileName`).

#### 4.2.6 Navigation et copie

Fichier :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/src/components/layout/nav-items.ts`
(719 lignes à la rédaction, réécrit en parallèle par le chantier Chiffres :
**relire les numéros avant d'éditer**).

| Ligne                                                                                                | Contenu                                                       | Verdict                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------- |
| `:274` à `:281`                                                                                      | « Campagnes », `/chues/campagnes`, rôles ENCADREMENT, repliée | Label « Lots d'export » |
| `:313` à `:319`                                                                                      | Même entrée pour ADMIN, en pleine barre                       | Même libellé            |
| `:534` à `:540`                                                                                      | « Campagnes » `/grand-public/campagnes`                       | Même libellé            |
| `:490` à `:493`, `:557` à `:560`                                                                     | `/grand-public/console`, « File d'appels et qualification »   | Nouvelle description    |
| `:226` à `:231`, `:404` à `:411`, `:212` à `:217`, `:396` à `:403`, `:234` à `:238`, `:344` à `:349` | Console CHUES, appels représentants, rappels                  | GARDER                  |

Aucune entrée `/chues/campagnes/representants` n'existe dans la barre : la route
est atteinte par l'onglet, ce que déclarent `nav-items.test.ts:107`
(`ATTEINT_AUTREMENT`) et les listes `MASQUEES` (`:118`, `:132`, `:136`).

Copie à remplacer :

| Où                                               | Aujourd'hui                                                                                                                   | Demain                                                                                 |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `nav-items.ts:278`, `:317`, `:538`               | « Distribuer les appels aux téléconseillers »                                                                                 | « Fiches téléchargées et appels qui ont suivi »                                        |
| `nav-items.ts:493`, `:560`                       | « File d'appels et qualification »                                                                                            | « Chercher un prospect et consigner l'appel »                                          |
| `campaigns-view.tsx:56`                          | « Distribuer les appels aux téléconseillers. Tirage définitif. »                                                              | « Choisir une cible, télécharger les fiches, suivre les appels qui ont suivi. »        |
| `campaigns-view.tsx:40`                          | « Utilisez "Nouvelle campagne", en haut, pour répartir les prospects en attente. »                                            | « Utilisez "Nouveau lot", en haut, pour choisir une cible et télécharger ses fiches. » |
| `campaign-create-dialog.tsx:171`, `:175`, `:176` | « Nouvelle campagne d'appels » / « Le tirage est définitif. » / « Les prospects tirés sont retirés des campagnes suivantes. » | « Nouveau lot d'export » / « Choisissez qui vous exportez. »                           |
| `campaign-create-dialog.tsx:334`, `:218`         | « Lancer la campagne » / « L'ordre de sélection fixe l'ordre du tourniquet. »                                                 | « Créer le lot » / (supprimé)                                                          |
| `campaign-target-field.tsx:99`                   | « Qui appelle-t-on ? »                                                                                                        | « Que veut-on exporter ? »                                                             |
| `campaign-detail-view.tsx:216`                   | « Répartition par téléconseiller »                                                                                            | (supprimé)                                                                             |
| `campaign-detail-view.tsx:234`                   | « Tentatives récentes »                                                                                                       | « Appels passés sur ces fiches »                                                       |
| `console-view.tsx:433`                           | « La file d'appel n'a pas pu être chargée. »                                                                                  | « Les prospects n'ont pas pu être lus. »                                               |
| `console-view.tsx:461`, `:462`                   | « Aucun prospect à appeler pour l'instant / dans cette campagne. »                                                            | « Cherchez le prospect que vous venez d'appeler. »                                     |
| `console-view.tsx:455`, `:456`                   | « Retirez le filtre de campagne, ou ouvrez-la depuis les prospects. »                                                         | « Ouvrez-la depuis la liste des prospects. »                                           |
| `console-view.tsx:734`                           | « Suivants à appeler »                                                                                                        | (supprimé)                                                                             |
| `console-view.tsx:95`, `:96`                     | « Parcourir la file » / « Ouvrir la fiche sélectionnée »                                                                      | (supprimés de la carte clavier)                                                        |
| `rep-script.tsx:169`                             | « Votre liste d'appel. Choisissez qui vous venez d'appeler. »                                                                 | « Choisissez qui vous venez d'appeler. » (variante déjà présente `:170`)               |
| `rep-script.tsx:135`                             | « La file des représentants n'a pas pu être chargée. »                                                                        | « L'annuaire n'a pas pu être lu. » (déjà présent `:176`)                               |
| `rappels-view.tsx:53` à `:58`                    | « Une échéance se promet depuis la console d'appel : touche 5, puis le chiffre de l'heure. »                                  | « Une échéance se promet en consignant un appel. »                                     |
| `rappels-view.tsx:174`                           | « Ouvrir dans la console »                                                                                                    | « Ouvrir la fiche »                                                                    |
| `chues/console/page.tsx:19`                      | « La file d'appel des prospects »                                                                                             | « La consignation des appels aux prospects »                                           |
| `grand-public/console/page.tsx:23`               | « La file d'appel Grand Public »                                                                                              | « La consignation des appels Grand Public »                                            |
| `chues/rappels/page.tsx:14`                      | « La file des rappels »                                                                                                       | « Les rappels promis »                                                                 |
| `activity-view.tsx:68`, `:69`                    | « Tâches closes » / « Reste à faire »                                                                                         | (colonnes supprimées)                                                                  |
| `chiffres/sources.ts:63`, `:141`                 | « Reste à appeler »                                                                                                           | (carte et colonne supprimées)                                                          |
| `hub-view.tsx:90`                                | « pas encore appelés »                                                                                                        | « pas encore qualifiés »                                                               |
| `hub-view.tsx:132`                               | « en attente d'appel »                                                                                                        | « pas encore convertis »                                                               |
| `hub-view.tsx:179`                               | « À faire maintenant »                                                                                                        | (pastille supprimée)                                                                   |
| `representants/representant-detail-view.tsx:251` | « Le statut se pose depuis la console d'appel »                                                                               | « Le statut se pose en consignant un appel »                                           |

### 4.3 Mobile

`apps/mobile` est **CPI GO**, une application Flutter Android hors ligne
utilisée par des téléconseillers au Sénégal. Elle sert trois projets cloisonnés
(Accueil, CHUES, Grand Public) derrière un écran hub. Android seul : `ios: false`
dans `pubspec.yaml:150` et `:171`, il n'y a pas de dossier `ios/`.

Architecture en place, à préserver : Riverpod 3 avec providers déclarés à la
main (pas de `riverpod_generator`), point central
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/providers/app_providers.dart` ;
`go_router` 17, routeur unique dans `lib/core/router/app_router.dart`, chemins
constants dans `lib/core/router/route_paths.dart` ; base locale drift, schéma
écrit **en SQL** dans `lib/data/local/schema.drift` (963 lignes), migrations
dans `lib/data/local/database.dart` ; synchronisation delta dans
`lib/core/sync/sync_engine.dart` (2214 lignes) avec file d'écriture `outbox`.

Après ce chantier, le téléconseiller fait trois gestes, librement : chercher un
représentant dans l'annuaire commun et consigner l'appel ; ajouter un prospect ;
chercher un prospect et consigner l'appel de conversion. Plus les rappels qu'il
a promis, l'historique de ce qu'il a consigné, et « À corriger » pour les envois
refusés. Rien d'autre.

#### 4.3.1 Base locale

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/local/schema.drift`

| Ligne(s) | Objet                                                                   | Verdict                          |
| -------- | ----------------------------------------------------------------------- | -------------------------------- |
| 803-808  | Bandeau « Campagnes d'appels »                                          | SUPPRIMER                        |
| 810-818  | `CREATE TABLE call_campaigns`                                           | SUPPRIMER                        |
| 820-834  | `CREATE TABLE call_tasks`                                               | SUPPRIMER                        |
| 836-841  | `call_tasks_campaign_idx`, `call_tasks_prospect_idx` et son commentaire | SUPPRIMER                        |
| 843-851  | Requête nommée `campaignQueue`                                          | SUPPRIMER                        |
| 853-860  | Requête nommée `campaignsWithOpenWork`                                  | SUPPRIMER                        |
| 862-869  | `CREATE TABLE rep_call_campaigns`                                       | SUPPRIMER                        |
| 871-879  | `CREATE TABLE rep_call_tasks`                                           | SUPPRIMER                        |
| 881-882  | Les deux index de `rep_call_tasks`                                      | SUPPRIMER                        |
| 884-891  | Requête nommée `repCampaignQueue`                                       | SUPPRIMER                        |
| 893-899  | Requête nommée `repCampaignsWithOpenWork`                               | SUPPRIMER                        |
| 901-917  | `rep_callback_reminders` et son index                                   | **GARDER** : les rappels restent |
| 919-922  | `pendingRepCallbackReminders`                                           | **GARDER**                       |
| 924-926  | Commentaire des visites qui cite `call_campaigns/call_tasks`            | **RÉÉCRIRE** (§4.3.6)            |
| 492-547  | `CREATE TABLE call_attempts`                                            | **GARDER intégralement**         |
| 437-470  | `CREATE TABLE phase2_directory`                                         | **GARDER**                       |
| 774-795  | `countMyAttempts`, `countMyMethods`, `attemptsForProspect`              | **GARDER**                       |

En pratique, l'étape C4 supprime les lignes **803 à 899 incluses**. La ligne
suivante conservée doit être le commentaire de `rep_callback_reminders`
(« Rappels promis pendant un appel représentant… »).

**`call_attempts` ne porte ni `task_id` ni `campaign_id`.** Vérifié :
aucune occurrence de `taskId` ou `task_id` dans `lib/` hors code engendré. Il n'y
a donc **aucune colonne à retirer**, ni de `call_attempts`, ni de `outbox`, et
le contrat de poussée est inchangé.

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/local/database.dart`

| Ligne(s)  | Objet                                                                                         | Verdict     |
| --------- | --------------------------------------------------------------------------------------------- | ----------- |
| 17        | `int get schemaVersion => 19;`                                                                | **20**      |
| 170-177   | Palier v12 : `createTable(callCampaigns)`, `createTable(callTasks)`, deux `createIndex`       | SUPPRIMER   |
| 215-220   | Palier v17 : `createTable(repCallCampaigns)`, `createTable(repCallTasks)`, deux `createIndex` | SUPPRIMER   |
| 221-224   | Palier v18 (`rep_callback_reminders`)                                                         | **GARDER**  |
| 225-237   | Palier v19 (colonnes de renseignements sur `call_attempts`)                                   | **GARDER**  |
| après 237 | Palier v20                                                                                    | **AJOUTER** |

```dart
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

Pourquoi supprimer les paliers v12 et v17 au lieu de les laisser : `m.createTable`
prend en argument le getter drift de la table (`callCampaigns`). Une fois la
table retirée de `schema.drift`, ce getter n'existe plus et le fichier ne
compile pas. Il n'y a pas de perte : un appareil parti d'une version inférieure
ou égale à v11 n'aura jamais ces tables, et un appareil parti d'une version
supérieure ou égale à v12 les fera supprimer par le palier v20. `DROP TABLE`
supprime les index qui portent dessus, et le schéma dit explicitement
(`schema.drift:820`) qu'aucune clé étrangère ne les vise : aucun nettoyage de
lignes ailleurs.

Dumps dorés :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/drift_schemas/`
contient `drift_schema_v1.json` à `drift_schema_v19.json` ; produire le v20.
Copies Dart engendrées :
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/test/data/generated_migrations/schema_v1.dart`
à `schema_v19.dart` plus `schema.dart`, **jamais éditées à la main** (bandeau
`GENERATED BY drift_dev, DO NOT MODIFY.`) : engendrer `schema_v20.dart` et
régénérer `schema.dart` (ses lignes 7 à 24 gagnent
`import 'schema_v20.dart' as v20;`).

Migration des installations existantes :

| Version installée | Chemin                                                                                                 | Résultat                      |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------- |
| v11 ou moins      | Les paliers 12 et 17 n'existent plus, le palier 20 fait `DROP TABLE IF EXISTS` sur des tables absentes | base à jour, saisies intactes |
| v12 à v16         | `call_campaigns` et `call_tasks` existent, le palier 20 les supprime                                   | base à jour, saisies intactes |
| v17 à v19         | Les quatre tables existent, le palier 20 les supprime                                                  | base à jour, saisies intactes |

Survivent dans tous les cas : `outbox` (les envois en attente), `call_attempts`,
`rep_callback_reminders` (donc les alarmes déjà armées), `representants`,
`prospects`, `prospect_journeys`, `representant_comments`, `visites`,
`form_drafts`, `sync_state` (le curseur). Perdue volontairement : la liste des
fiches qu'une campagne avait confiées.

**Aucun curseur n'est réinitialisé.** Contrairement au palier v8
(`database.dart:131`, `DELETE FROM sync_state WHERE collection = 'all'`), il n'y
a rien à re-télécharger : on retire des données, on n'en ajoute pas.
**Aucune migration de `SharedPreferences`** : une adresse `/campagnes` mémorisée
est rejetée par `RouteMemory.isRestorable`
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/route_memory.dart:151`)
et la mémoire s'efface d'elle-même (`:95`). **Aucune alarme orpheline** : elles
dérivent de l'identifiant d'un rappel
(`lib/core/notifications/rep_callback_notifications.dart:60`) et la table
survit.

#### 4.3.2 Synchronisation et dépôt d'écriture

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/sync/sync_engine.dart`

| Ligne(s)  | Objet                                                     | Verdict      |
| --------- | --------------------------------------------------------- | ------------ |
| 59        | `static const int payloadVersion = 4;`                    | **5** (§2.4) |
| 1975-1992 | Boucle `callCampaigns` (et sa doc `:1975` à `:1977`)      | SUPPRIMER    |
| 1993-2019 | Boucle `callTasks`, avec la suppression sur `!t.isActive` | SUPPRIMER    |
| 2020-2034 | Boucle `repCallCampaigns`                                 | SUPPRIMER    |
| 2035-2057 | Boucle `repCallTasks`                                     | SUPPRIMER    |
| 2059-2088 | Boucle `visites`                                          | **GARDER**   |
| 2090-2107 | Boucle `page.deletions`                                   | **GARDER**   |
| 24        | `const String repCallAttemptEntity = 'rep_call_attempt';` | **GARDER**   |
| 150-155   | Aiguillage de `drain()` vers `_sendRepCallAttempts`       | **GARDER**   |

C4 supprime les lignes **1975 à 2057 incluses**. La ligne suivante conservée est
le commentaire « Le registre : aucune revision… ».

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/sync/stub_api.dart:64`
à `:67` : les quatre arguments passés à `SyncChangesDto(...)`, à retirer
**après** la régénération du client Dart.

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/sync/dio_api.dart`

| Ligne(s)         | Objet                                                                | Verdict    |
| ---------------- | -------------------------------------------------------------------- | ---------- |
| 58               | `RepCampaignsApi get _repCampaigns => _client.getRepCampaignsApi();` | **GARDER** |
| 171-183          | `recordRepCallAttempt`, poste une qualification représentant         | **GARDER** |
| 203-226          | `GET /v1/phase2/directory`                                           | **GARDER** |
| 239-251, 257-283 | Motifs d'issue et référentiels                                       | **GARDER** |

`RepCampaignsApi` est le nom d'une étiquette OpenAPI, pas une campagne au sens
mobile : c'est par là que part la qualification d'un représentant, geste n° 1.
Si D6 renomme l'étiquette, `dio_api.dart:58` et `:176` suivent mécaniquement à
la régénération.

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/repositories/write_repository.dart`

| Ligne(s)           | Objet                                                                                        | Verdict                                  |
| ------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 891-896            | `const Set<String> terminal = {'REACHED', 'PROSPECTS_PROMISED', 'REFUSED', 'WRONG_NUMBER'};` | SUPPRIMER (devient inutilisé)            |
| 919-931            | `if (terminal.contains(outcome)) { update repCallTasks … status DONE }`                      | SUPPRIMER                                |
| 932-945            | Insertion dans `rep_callback_reminders`                                                      | **GARDER**                               |
| 946-966            | `_enqueue` de la qualification                                                               | **GARDER**                               |
| 741-858            | `recordCallAttempt` (conversion)                                                             | **GARDER**, aucune référence à une tâche |
| 977-996, 1004-1019 | `honourRepCallbacks`, `snoozeRepCallback`                                                    | **GARDER**                               |

Retirer le bloc `:919` à `:931` **avant** la déclaration `:891` à `:896`, puis
vérifier par `grep -n "terminal" lib/data/repositories/write_repository.dart`
qu'aucune référence ne subsiste.

#### 4.3.3 Écrans et routes

| Fichier                                                                                                                    | Verdict                                                                              | Remplacement                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/features/campagnes/campagnes.dart` (175 l.)                                                                           | **SUPPRIMER le fichier**                                                             | Les constantes encore utiles (`grandPublicConsole` l. 12-14, `appelPour` et `appelGrandPublicPour` l. 33-42) migrent dans `route_paths.dart` |
| `lib/features/campagnes/presentation/campagnes_screen.dart` (369 l.)                                                       | **SUPPRIMER**                                                                        | Aucun                                                                                                                                        |
| `lib/features/campagnes/presentation/campagne_file_screen.dart` (432 l.)                                                   | **SUPPRIMER**                                                                        | Aucun                                                                                                                                        |
| `lib/features/campagnes/`                                                                                                  | **SUPPRIMER le dossier**                                                             |                                                                                                                                              |
| `lib/features/phase2/presentation/phase2_screen.dart` (2073 l.)                                                            | **GARDER**, une retouche de commentaire (l. 37-39)                                   |                                                                                                                                              |
| `lib/features/phase2/phase2_controller.dart`, `presentation/callback_picker.dart`, `presentation/call_audio_recorder.dart` | **GARDER**                                                                           |                                                                                                                                              |
| `lib/features/representant/presentation/representant_picker_screen.dart` (216 l.)                                          | **GARDER tel quel**                                                                  | C'est déjà l'annuaire cherchable, avec le mode `pourQualifier` (l. 24-26, 185-189)                                                           |
| `lib/features/representant/presentation/representant_qualification_screen.dart` (631 l.)                                   | **GARDER**, ne pas toucher (autre chantier)                                          |                                                                                                                                              |
| `lib/features/representant/presentation/representant_detail_screen.dart`, `representant_form_screen.dart`                  | **GARDER**                                                                           |                                                                                                                                              |
| `lib/features/prospect/presentation/prospect_entry_screen.dart` (964 l.)                                                   | **GARDER**                                                                           | Geste n° 2                                                                                                                                   |
| `lib/features/prospect/presentation/prospect_detail_screen.dart`                                                           | **RÉÉCRIRE** l. 26 (import) et l. 130                                                | `Routes.grandPublicConsole`                                                                                                                  |
| `lib/features/prospect/presentation/prospect_picker_screen.dart`                                                           | **CRÉER**                                                                            | Geste n° 3, §4.3.4                                                                                                                           |
| `lib/features/home/presentation/home_screen.dart` (423 l.)                                                                 | **RÉÉCRIRE** l. 12, 56-105, 107-157                                                  | Trois cartes de gestes, sans compteur de file                                                                                                |
| `lib/features/shell/grand_public_screen.dart` (276 l.)                                                                     | **RÉÉCRIRE** l. 12, 28-60, 90-97 ; supprimer `_GrandeCarte` l. 134-208               | Trois cartes `_Carte`                                                                                                                        |
| `lib/features/shell/hub_screen.dart` (275 l.)                                                                              | **GARDER**, sauf le libellé l. 159                                                   | Ne connaît pas les campagnes                                                                                                                 |
| `lib/features/shell/app_shell.dart` (289 l.)                                                                               | **GARDER**                                                                           | Le badge « À corriger » (l. 106-113) lit `needsAttentionCountProvider`, jamais une tâche                                                     |
| `lib/features/shell/grand_public_fiches_screen.dart` (203 l.)                                                              | **RÉÉCRIRE** l. 200-201 (copie périmée) ; **réutiliser** `ProspectTile` (l. 113-185) |                                                                                                                                              |
| `lib/features/shell/projects.dart`                                                                                         | **RÉÉCRIRE** le commentaire l. 89                                                    |                                                                                                                                              |
| `lib/features/historique/presentation/historique_screen.dart` (258 l.)                                                     | **GARDER**                                                                           | Voir §6                                                                                                                                      |
| `lib/features/corrections/presentation/corrections_screen.dart` (545 l.)                                                   | **GARDER**                                                                           | Aucune référence à une campagne                                                                                                              |
| `lib/features/rappels/**`, `lib/features/notifications/**`, `lib/core/notifications/**`                                    | **GARDER**, ne pas toucher                                                           | Autre chantier ; §4.3.5                                                                                                                      |
| `lib/features/accueil/**`                                                                                                  | **GARDER**                                                                           | Le projet Accueil ignore les campagnes                                                                                                       |

Routeur,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/app_router.dart` :

| Ligne(s)                  | Objet                                                                          | Verdict                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 19-21                     | Trois `import` de `features/campagnes/`                                        | SUPPRIMER                                                                                     |
| 226-235                   | `GoRoute` `/grand-public/campagnes`                                            | SUPPRIMER                                                                                     |
| 236-247                   | `GoRoute` `/grand-public/campagnes/:id`                                        | SUPPRIMER                                                                                     |
| 264-274                   | `GoRoute` `/grand-public/console`                                              | **GARDER**, `CampagnesRoutes.grandPublicConsole` (l. 265) devient `Routes.grandPublicConsole` |
| 406-417                   | `GoRoute` `/campagnes`                                                         | SUPPRIMER                                                                                     |
| 418-428                   | `GoRoute` `/campagnes/representants/:id`                                       | SUPPRIMER                                                                                     |
| 429-438                   | `GoRoute` `/campagnes/:id`                                                     | SUPPRIMER                                                                                     |
| autour de 375             | Nouvelle `GoRoute` `/prospects`                                                | **AJOUTER**, enveloppée dans `_chues(...)` comme ses voisines                                 |
| 329-340, 376-386, 389-395 | `/representants` avec `?but=qualifier`, `/prospects/nouveau`, `/prospects/:id` | **GARDER**                                                                                    |

`go_router` essaie les routes dans l'ordre de déclaration. `/prospects` (exact)
ne peut pas être avalé par `/prospects/:id`, mais l'ordre du fichier veut que
les chemins exacts précèdent les paramétrés (commentaires `app_router.dart:354`
et `:387`) : poser la nouvelle route **avant** `Routes.newProspect`.

Chemins,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/core/router/route_paths.dart` :

| Ligne(s)  | Objet                                                                     | Verdict                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 40        | `static const String prospects = '/prospects';`                           | **GARDER** : la constante existe mais aucune `GoRoute` ne la sert aujourd'hui ; elle n'est citée que par `route_memory.dart:28`                                         |
| 46        | `phase2 = '/phase2'`                                                      | **GARDER**                                                                                                                                                              |
| 63-72     | `butParam`, `butQualifier`, `representantsPourQualifier()`                | **GARDER**                                                                                                                                                              |
| après 32  | `grandPublicConsole = '/grand-public/console'`                            | **AJOUTER**, valeur reprise de `campagnes.dart:14`                                                                                                                      |
| après 111 | `appelPour(String phoneE164)` et `appelGrandPublicPour(String phoneE164)` | **AJOUTER**, repris de `campagnes.dart:33-42` : `Uri(path: phase2, queryParameters: {prefillPhoneParam: phoneE164}).toString()` et son pendant sur `grandPublicConsole` |

Mémoire de route, `lib/core/router/route_memory.dart` : supprimer l'import l. 6
et l'entrée `CampagnesRoutes.liste` l. 32 de `allowList` ; **garder**
`Routes.prospects` l. 28, qui devient enfin une vraie route, et le reste de la
liste (l. 18-34). `lib/core/router/route_guard.dart` : **GARDER**, il raisonne
sur `CpiProject.duChemin` (`projects.dart:91`) qui range tout ce qui n'est ni
`/accueil` ni `/grand-public` dans le CHUES.

Routes supprimées : `/campagnes`, `/campagnes/:id`,
`/campagnes/representants/:id`, `/grand-public/campagnes`,
`/grand-public/campagnes/:id`. Route ajoutée : `/prospects`. Toutes les autres
sont conservées.

#### 4.3.4 Providers et écrans cibles

| Emplacement                                          | Objet                                                                                                                                 | Verdict                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `campagnes.dart:45-53`, `:57-58`                     | `repCampagnesProvider`, `grandPublicCampagnesProvider`, `chuesCampagnesProvider`                                                      | SUPPRIMER avec le fichier                                                                 |
| `campagnes.dart:63-94`                               | `_campagnesDuProjet` (SQL `call_campaigns` JOIN `call_tasks`)                                                                         | SUPPRIMER                                                                                 |
| `campagnes.dart:98-174`                              | `campagneProvider`, `repCampagneProvider`, `fileDeCampagneProvider`, `repFileDeCampagneProvider`, `grandPublicFileDeCampagneProvider` | SUPPRIMER                                                                                 |
| `app_providers.dart` (615 l.)                        | **aucun** provider de campagne ou de tâche                                                                                            | **GARDER intégralement**                                                                  |
| `app_providers.dart:132-136`, `:138-142`, `:144-149` | `representantCountProvider`, `prospectCountProvider`, `grandPublicProspectCountProvider`                                              | **GARDER**, réemployés ci-dessous                                                         |
| `app_providers.dart:223-235`                         | `needsAttentionCountProvider`, `needsAttentionProvider`                                                                               | **GARDER**                                                                                |
| `app_providers.dart:275-283`, `:292-302`             | `historiqueSearchProvider`, `grandPublicProspectListProvider`                                                                         | **GARDER**                                                                                |
| `app_providers.dart:304-326`                         | `representantPickerSearchProvider`, `representantPickerListProvider`                                                                  | **GARDER** : la brique du geste n° 1, et le patron du geste n° 3                          |
| `app_providers.dart:408-453`, `:459-485`             | `grandPublicRappelsProvider`, `representantRappelsProvider`                                                                           | **GARDER**                                                                                |
| `app_providers.dart:516-544`                         | `phase2DirectoryCountProvider`, `phase2ProgressProvider`, `phase2PendingCountProvider`                                                | **GARDER** : progression **personnelle**, jamais une campagne                             |
| `home_screen.dart:29-45`                             | `representantsSansProspectProvider`                                                                                                   | **GARDER** : compte les représentants AMBASSADEUR sans prospect, ne dépend d'aucune tâche |
| `lib/core/providers/sync_coordinator.dart`           |                                                                                                                                       | **GARDER**                                                                                |

**Accueil CHUES** (`HomeScreen`, `/chues`) : trois cartes de gestes, plus les
raccourcis et le graphique d'activité. Aucun compteur de file.

| Rang | Titre                              | Phrase                                                    | Chiffre                                                                      | Destination                           |
| ---- | ---------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| 1    | `Consigner un appel représentant`  | `Cherchez la personne, appelez, notez sa réponse.`        | `representantCountProvider`, libellé `dans l'annuaire`                       | `Routes.representantsPourQualifier()` |
| 2    | `Ajouter un prospect`              | `Notez les collègues que vos représentants vous donnent.` | `representantsSansProspectProvider`, libellé `représentant(s) sans prospect` | `Routes.representants`                |
| 3    | `Consigner un appel de conversion` | `Cherchez le prospect, appelez, notez ce qu'il a dit.`    | `prospectCountProvider`, libellé `fiche(s)`                                  | `Routes.prospects`                    |

`_EtapeCard` (`home_screen.dart:204-300`) se réemploie **tel quel** : il prend
déjà un `AsyncValue<int>` et affiche `…`, `–` ou le nombre. Le paramètre `rang`
n'est plus une phase mais un ordre de lecture : garder `CpiTag('$rang')`
(l. 247). La feuille « Que voulez-vous faire ? » (l. 389-423) reçoit une
**troisième** ligne vers `Routes.prospects` ; `_Raccourcis` (l. 304-345) perd sa
ligne « Consigner un appel » (l. 313-320), devenue doublon, et garde « Rappels »
et « Annonces ». Le calcul `chiffresIllisibles` (l. 67-68) se réduit à
`sansProspect.hasError`. Garder `_ActivityCard`, `_PrimaryAction`, `_bonjour`.

**Accueil Grand Public** (`GrandPublicScreen`) : trois cartes `_Carte` de même
forme (l. 211-276, réemployée). Supprimer la fonction `appeler` (l. 45-60) et la
classe `_GrandeCarte` (l. 134-208), devenue inutilisée.

| Titre                | Détail                                              | Chiffre                             | Destination                 |
| -------------------- | --------------------------------------------------- | ----------------------------------- | --------------------------- |
| `Consigner un appel` | `Après l'appel, notez ce qui a été dit.`            | aucun (`nombre: null`)              | `Routes.grandPublicConsole` |
| `Prospects`          | `Retrouver une fiche`                               | `grandPublicProspectCountProvider`  | `Routes.grandPublicFiches`  |
| `Rappels`            | `Aucun rappel prévu` ou `Prochain <date> à <heure>` | `grandPublicRappelsProvider.length` | `Routes.grandPublicRappels` |

**Hub** (`hub_screen.dart`) : strictement identique, trois tuiles de projet
filtrées par rôle, un en-tête de marque, un bouton de déconnexion, aucun
compteur. Seul le libellé l. 159, `Prospects et appels du jour`, devient
`Prospects et appels` : « du jour » est un vestige de la file. La barre du bas
(`app_shell.dart:99-120`) garde ses quatre destinations et son unique badge.

**Nouveau : sélecteur de prospects**,
`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/prospect/presentation/prospect_picker_screen.dart`,
copie structurelle de `representant_picker_screen.dart` (216 l.), patron validé
du dépôt :

- `CpiScaffold(title: 'Quel prospect ?', subtitle: 'Cherchez son nom ou son numéro.', leading: CpiBackButton())` ;
- `CpiSearchField` branché sur `prospectPickerSearchProvider` ;
- `ListView.builder` de `CpiListEntrance` enveloppant **`ProspectTile`**, déjà
  écrite et exportée par `grand_public_fiches_screen.dart:113-185`. **Ne pas
  réécrire une tuile** : elle pousse aujourd'hui en dur `Routes.prospectDetailFor`
  (l. 129) ; lui ajouter un paramètre nommé optionnel `VoidCallback? onTap`
  (défaut : le comportement actuel) est la modification minimale ;
- tap d'une ligne : `context.pushOnce(Routes.appelPour(prospect.phoneE164))`,
  c'est-à-dire `/phase2?tel=+221…`. `Phase2Screen.prefillPhone`
  (`phase2_screen.dart:35-40`, `:88-93`) sait déjà recevoir un E.164 ;
- états : chargement (`FCircularProgress`), erreur (`CpiErrorState` +
  `messageErreur`), vide sans recherche (`CpiEmptyState`, titre `Aucun prospect`,
  message `Ils arrivent du bureau.`), vide en recherche (titre `Aucun résultat`,
  message `Vérifiez le nom ou le numéro.`) ;
- compteur en tête, comme `_Compteur` de `representant_picker_screen.dart:129-149`.

Nouveaux providers, à poser dans `app_providers.dart` juste après
`representantPickerListProvider` (l. 326), calqués sur `:304-326` :

```
prospectPickerSearchProvider  : NotifierProvider<ProspectPickerSearch, String>
prospectPickerListProvider    : StreamProvider<List<ProspectSyncViewData>>
    → referenceRepositoryProvider.watchAllProspects(
          search: ref.watch(prospectPickerSearchProvider), projet: 'CHUES')
```

`watchAllProspects` existe déjà
(`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/data/repositories/reference_repository.dart:236-264`),
filtre par parcours, cherche sur nom, prénom et téléphone, et borne à 500
lignes. **Aucune requête SQL nouvelle à écrire.** Un provider **distinct** de
`historiqueSearchProvider` est nécessaire : ce dernier est partagé par
`HistoriqueScreen` et `GrandPublicFichesScreen`, et le réutiliser ferait sauter
la recherche d'un écran à l'autre.

#### 4.3.5 Notifications

Vérifié : aucune occurrence de campagne ou de tâche dans
`lib/features/notifications/` ni `lib/core/push/`, en dehors d'une variable
locale nommée `task` (un `Future`, sans rapport) dans
`lib/features/notifications/notification_inbox.dart:69`. Les alarmes sont
entièrement rattachées à une **tentative d'appel** :
`RepCallbackNotifications.schedule`
(`lib/core/notifications/rep_callback_notifications.dart:112-147`) prend un `id`
de rappel et un `representantId`, charge utile `'$id|$representantId'` (l. 123),
source `rep_callback_reminders`, écrite par `write_repository.dart:932-945` au
moment où le téléconseiller promet un rappel pendant l'appel.

**Verdict : GARDER intégralement. Ne modifier aucun fichier de
`lib/core/notifications/` ni `lib/features/notifications/`** : un autre chantier
y travaille.

#### 4.3.6 Client Dart engendré et copie

`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/packages/api-client-dart`
n'est **jamais** édité à la main (`// AUTO-GENERATED FILE, DO NOT MODIFY!`). Il
est produit depuis `apps/api/openapi.json` par `pnpm codegen`
(`package.json:33`), appuyé sur `tools/dev/generate-dart-client.mjs`.

Disparaîtront à la régénération : `lib/src/model/sync_call_campaign_dto.dart`,
`sync_call_task_dto.dart`, `sync_rep_call_campaign_dto.dart`,
`sync_rep_call_task_dto.dart`, `call_task_status.dart`, `campaign_status.dart`
et leurs `.g.dart`, plus les quatre champs de `sync_changes_dto.dart` (l. 87-97).

**Ne pas supprimer à la main** les DTO purement web (`campaign_detail_dto.dart`,
`campaign_pilotage_dto.dart`, `rep_campaign_summary_dto.dart`, etc.) : le mobile
ne les importe pas, et c'est le lot A qui les fait disparaître du contrat.

Ce que le mobile importe et qui doit rester : `CreateRepCallAttemptDto`
(14 champs, **aucun** `taskId`), `RepCallAttemptResultDto`, `RepCallOutcome`,
`SyncOperationDto`, `SyncPullResponseDto`, `SyncPushDto`, `DirectoryEntryDto`,
`CallOutcomeReasonDto`.

Copie affichée :

| Emplacement                                                                                                                                                    | Texte actuel                                                      | Remplacement                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `home_screen.dart:124`                                                                                                                                         | Titre `Qualifier les représentants`                               | `Consigner un appel représentant`                                                                                 |
| `home_screen.dart:126`                                                                                                                                         | `Appelez chaque représentant et notez sa réponse.`                | `Cherchez la personne, appelez, notez sa réponse.`                                                                |
| `home_screen.dart:128-129`                                                                                                                                     | `représentant(s) à appeler`                                       | Retirer le compteur ; sous-titre `N dans l'annuaire`                                                              |
| `home_screen.dart:135`, `:137-139`                                                                                                                             | `Notez les collègues…`, `représentant(s) sans prospect`           | Inchangés                                                                                                         |
| `home_screen.dart:144`                                                                                                                                         | Titre `Convertir les prospects`                                   | `Consigner un appel de conversion`                                                                                |
| `home_screen.dart:145`                                                                                                                                         | `Appelez les prospects pour obtenir leur adhésion.`               | `Cherchez le prospect, appelez, notez ce qu'il a dit.`                                                            |
| `home_screen.dart:147-148`                                                                                                                                     | `prospect(s) à appeler`                                           | Retirer le compteur ; sous-titre `N fiches`                                                                       |
| `home_screen.dart:113`                                                                                                                                         | `Les chiffres n'ont pas pu être lus.`                             | Inchangé                                                                                                          |
| `home_screen.dart:315`                                                                                                                                         | `Après l'appel, notez ce qui a été dit.` (ligne de `_Raccourcis`) | Retirer la ligne, doublon de la carte 3                                                                           |
| `home_screen.dart:394`                                                                                                                                         | `Que voulez-vous faire ?`                                         | Inchangé, mais la feuille reçoit une troisième entrée                                                             |
| `grand_public_screen.dart:21-22` (doc)                                                                                                                         | `appeler la file du jour, tenir les rappels promis`               | `consigner les appels, tenir les rappels promis`                                                                  |
| `grand_public_screen.dart:93`                                                                                                                                  | `Appels du jour`                                                  | `Consigner un appel`                                                                                              |
| `grand_public_screen.dart:95`, `:197`                                                                                                                          | `Rien à appeler aujourd'hui.`, `À appeler`                        | Supprimés avec `_GrandeCarte`                                                                                     |
| `grand_public_screen.dart:111`, `:112`                                                                                                                         | `Aucun rappel prévu`, `Prochain …`                                | **Garder** : « prochain rappel » vise une promesse tenue, pas une file assignée                                   |
| `grand_public_fiches_screen.dart:200-201`                                                                                                                      | `… Touchez « Recevoir les listes » dans Réglages.`                | `… Touchez « Envoyer maintenant » dans Réglages.` : le contrôle réel s'appelle ainsi (`reglages_screen.dart:170`) |
| `hub_screen.dart:159`                                                                                                                                          | `Prospects et appels du jour`                                     | `Prospects et appels`                                                                                             |
| `phase2_screen.dart:37-39` (doc)                                                                                                                               | `quand on vient d'une file de campagne`                           | `quand on arrive depuis une fiche déjà ouverte`                                                                   |
| `projects.dart:89` (doc)                                                                                                                                       | `(représentants, prospects, campagnes, phase 2)`                  | `(représentants, prospects, appels)`                                                                              |
| `schema.drift:924-926` (doc)                                                                                                                                   | `Le tirage descend le registre comme call_campaigns/call_tasks`   | `Le serveur est seul à écrire cette table : un pull rejoué recopie la même ligne, updated_at seul arbitre.`       |
| `sync_engine.dart:1975-1977` (doc), `schema.drift:803-808` (doc), `campagne_file_screen.dart:24-26`, `:107`, `:156`, `campagnes_screen.dart:84`, `:88`, `:188` | Textes de file et de campagne                                     | Supprimés avec leur code                                                                                          |

Mots à **ne plus jamais** écrire dans une chaîne affichée par le mobile :
« campagne », « file », « tâche », « à appeler », « programme », « tirage ».

---

## 5. Tests

### 5.1 API

À **supprimer** : `apps/api/src/modules/phase2/campaigns.service.test.ts`,
`.../phase2/distribution.test.ts`, `.../phase2/programme-pdf.test.ts`
(ce dernier seulement si l'option PDF du lot n'est pas retenue). Ils disparaissent
avec leur code.

| Fichier                                                                                                                         | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/modules/analytics/authorization.sweep.test.ts`                                                                    | **RETOURNER, jamais supprimer.** Il exige aujourd'hui (`:114`, assertion `:122` à `:127`) que **chaque** trace SQL d'une route d'analytics contienne l'identifiant du téléconseiller appelant. Avec la nouvelle portée, l'assertion s'inverse exactement : **plus aucune route ne doit borner sur l'appelant**. Le cas `:142` (« un SUPERVISEUR n'est borné sur personne ») devient la règle générale. Un balayage qui ne vérifie plus rien est pire que pas de balayage |
| `apps/api/src/modules/phase2/phase2-sync.service.test.ts`                                                                       | ADAPTER : retirer les cas de clôture de tâche ; garder idempotence, conflit `PHASE2_ALREADY_COMPLETED`, rappel promis, correction de fiche                                                                                                                                                                                                                                                                                                                               |
| `apps/api/src/modules/phase2/directory-cursor.test.ts`                                                                          | GARDER                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `apps/api/src/modules/rep-campaigns/rep-campaigns.service.test.ts` (45,9 Ko) et `rep-campaigns.integration.test.ts`             | ADAPTER : ne garder que `recordAttempt` (idempotence, commentaire obligatoire, `callbackAt`, suggestion de numéro, bascule de relation, WhatsApp)                                                                                                                                                                                                                                                                                                                        |
| `apps/api/src/modules/sync/sync.service.test.ts`, `sync.integration.test.ts`, `fake-prisma.ts`, `cursor.test.ts`, `dto.test.ts` | ADAPTER : retirer les quatre flux, les délégués `callTask`, `callCampaign`, `repCallTask`, `repCallCampaign` du faux Prisma (`fake-prisma.ts:43`, `:44`) et les positions de curseur                                                                                                                                                                                                                                                                                     |
| `apps/api/src/modules/prospects/portee-lecture.integration.test.ts`                                                             | **RÉÉCRIRE** : il prouve aujourd'hui qu'une fiche confiée par tâche est lisible (`:80` à `:94`, `:132`). Il doit prouver la nouvelle règle                                                                                                                                                                                                                                                                                                                               |
| `apps/api/src/modules/prospects/phase2-surface.integration.test.ts`                                                             | ADAPTER : retirer les quatre blocs de campagne (`:134`, `:171`, `:367`, `:392`, `:415`)                                                                                                                                                                                                                                                                                                                                                                                  |
| `apps/api/src/modules/prospects/filter-consistency.test.ts` et `apps/api/src/common/prospect-where.test.ts`                     | ADAPTER : retirer `campaignId` (`:47`), `assignedToId` (`:48`) et les attentes SQL `:105`, `:113`                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/api/src/modules/analytics/pilotage.service.test.ts`                                                                       | ADAPTER : ne garder que `delays`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/api/src/modules/analytics/supervision.service.test.ts`                                                                    | ADAPTER : retirer `tasksClosed`, `openTasks`, `campaignId`                                                                                                                                                                                                                                                                                                                                                                                                               |
| `apps/api/src/modules/analytics/lot-j.integration.test.ts:35` et `lot-j-chiffres.integration.test.ts`                           | ADAPTER : retirer les assertions sur `campaignPilotage`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `apps/api/src/modules/notifications/reminders.service.test.ts` (31,4 Ko) et `fake-prisma.ts`                                    | ADAPTER : retirer les cas de rappel de tâches ouvertes et les délégués correspondants ; garder rappels dus et dossiers bancaires                                                                                                                                                                                                                                                                                                                                         |
| `apps/api/src/modules/users/users.service.test.ts`                                                                              | ADAPTER : la reprise de portefeuille ne réassigne plus de tâche                                                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/api/src/modules/admin/purge-plan.test.ts`, `purge.service.test.ts`, `purge.integration.test.ts`                           | ADAPTER : nouveau catalogue d'étapes                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/api/src/common/guards/role-routes.test.ts`                                                                                | ADAPTER : retirer `Phase2Controller.getCampaign` (`:161`), `.listCampaigns` (`:162`), `.downloadProgramme` (`:163`), `RepCampaignsController.get` (`:182`), `.list` (`:183`), `.downloadProgramme` (`:184`), `.downloadProgrammes` (`:185`), `AnalyticsController.campaignPilotage` (`:131`) ; ajouter les routes de lot. **Inventaire exhaustif : il rougit tant qu'il n'est pas exact**                                                                                |
| `apps/api/src/modules/export/openapi-contract.test.ts:60`                                                                       | ADAPTER : ajouter les trois filtres de relation et les routes de lot                                                                                                                                                                                                                                                                                                                                                                                                     |
| `packages/database/src/segment.test.ts`                                                                                         | ADAPTER : retirer les cas de `scopeWhere` et `eligibleForCampaignWhere`                                                                                                                                                                                                                                                                                                                                                                                                  |

À **écrire** :

| Fichier                                                                       | Ce qu'il doit prouver                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/modules/lots-export/lots-export.service.test.ts`                | La création fige la liste : deux fiches ajoutées après coup n'entrent pas dans le lot. `itemCount` égale le nombre de lignes écrites. Une cible vide rend `422 LOT_EXPORT_CIBLE_VIDE`. Un lot `REPRESENTANTS` ne peut pas porter d'item `prospectId` |
| `apps/api/src/modules/lots-export/lots-export.integration.test.ts`            | Sur une vraie base : `callsSince` ne compte que les appels postérieurs à `createdAt` et portant sur une fiche du lot. Un appel hors lot ne compte pas. Un appel antérieur à la création ne compte pas                                                |
| `apps/api/src/modules/sync/sync.controller.test.ts` (compléter)               | Un client annonçant `X-CPI-Payload-Version: 4` reçoit `426 APP_UPDATE_REQUIRED` ; `5` passe ; la poussée reste ouverte à 4                                                                                                                           |
| `apps/api/src/modules/prospects/portee-lecture.integration.test.ts` (réécrit) | Un COMMERCIAL lit une fiche créée par un autre ; il ne peut **pas** la modifier (`403 NOT_OWNER`) ; il **peut** y consigner une tentative d'appel                                                                                                    |
| `apps/api/src/modules/export/openapi-contract.test.ts` (complété)             | `GET /lots-export/{id}/export.xlsx` déclare le classeur en binaire. `GET /export/representants.xlsx` annonce `relationStatus`, `whatsappStatus`, `hasWhatsapp`, et accepte le SUPERVISEUR                                                            |
| `apps/api/src/common/guards/role-routes.test.ts` (complété)                   | Un COMMERCIAL n'atteint aucune route de lot. Un SUPERVISEUR lit les lots sans en créer                                                                                                                                                               |

### 5.2 Web

À **supprimer** :
`apps/web/src/components/phase2/campaign-create-dialog.test.tsx` ;
`apps/web/src/components/phase2/rep-campaign-create-dialog.test.tsx`, **sauf**
ses deux tests de cascade région vers département (`:93`, `:103`) et ses trois
tests de qualification (`:116`, `:125`, `:140`), à reprendre dans
`lot-create-dialog.test.tsx` : ce sont les critères de cible d'un lot ;
`apps/web/src/components/phase2/campaign-detail-view.test.tsx`, **sauf** ses
trois tests sur les renseignements de conversion (`:78`, `:86`, `:102`), à
reprendre dans `lot-detail-view.test.tsx` ;
`apps/web/src/lib/rep-campaign-filters.test.ts`.
Blocs à retirer : `sortQueue` (`:95`), `bucketOf` (`:142`), `buildQueue`
(`:154`), `nextAfter` (`:169`), `queueLabel` (`:185`) dans
`apps/web/src/lib/data/console.test.ts` ; `roundRobinSplit` (`:28`),
`buildCampaignPreview` (`:55`), `spreadIntoDays` (`:104`), « aperçu et
étalement » (`:133`) dans `apps/web/src/lib/data/phase2.test.ts`, en gardant
« note vocale » (`:15`) ; « ConsoleView : file » (`:191`) dans
`console-view.test.tsx` ; « montre la liste confiée d'abord » (`:146`) dans
`rep-script.test.tsx`.

À **adapter** :

- `apps/web/src/components/layout/nav-items.test.ts` : intitulés attendus
  (`:309` à `:326`, `:713` à `:725`, `:855` à `:868`, `:872` à `:879`, `:937` à
  `:949`, `:953` à `:962`) ; `ATTEINT_AUTREMENT` (`:97` à `:111`) perd
  `/chues/campagnes/representants` (`:107`) ; `MASQUEES` (`:114` à `:140`) perd
  la même route pour ADMIN (`:118`), DIRECTION (`:132`) et SUPERVISEUR (`:136`).
  Le test « ne garde aucun renvoi vers un écran disparu » (`:1039`) rougira tant
  que la ligne 107 subsiste : c'est le filet attendu.
- `apps/web/src/app/frontieres.test.ts` : aucune modification nécessaire, mais
  il **doit rester vert**. Chaque page du panel déclare `metadata` (`:58`),
  aucun module n'est réexporté par deux pages (`:70`), chaque page dynamique a
  un `loading.tsx` au-dessus d'elle (`:86`). Les nouvelles pages de lots portent
  donc leur `metadata`, et `grand-public/campagnes/[id]/page.tsx` reste le seul
  à réexporter la page CHUES.
- `apps/web/src/app/(panel)/chues/campagnes/access.test.tsx` : deux pages
  importées au lieu de quatre (`:13` à `:17`), deux appels à `guardRoles`
  (`:31`).
- `apps/web/src/app/moved-routes.test.ts` : les tests `:17` et `:36` rougiront
  si `rep-campaigns` pointe vers une route supprimée.
- `apps/web/src/lib/data/inbox.test.ts` : vérifier qu'aucune attente ne dépend
  d'une route supprimée.
- `apps/web/src/components/filters/advanced-chips.test.ts` : le chip
  `campaignId` disparaît (D4).
- `apps/web/src/lib/vocabulaire.test.ts` : le vocabulaire figé cite « campagne
  d'appels prospects » et « campagne d'appels representants ». Ce chantier
  supprime la notion : mettre le test à jour au moment où le reste est vert.
- `apps/web/src/components/chues/etapes.test.tsx:107` : le test « disparaît sur
  les écrans qui ne sont pas une étape » utilise le segment `campagnes` ; il
  reste valable.

À **écrire** : `components/lots/lots-view.test.tsx` (la liste nomme la cible en
clair, chiffre les fiches et les appels passés, et ne montre ni statut, ni barre
de progression, ni nombre de téléconseillers) ;
`components/lots/lot-create-dialog.test.tsx` (aucun téléconseiller proposé ; le
choix « Représentants » fait apparaître la cascade et la qualification ; le
compte de fiches vient du serveur et s'affiche avant validation) ;
`components/lots/lot-detail-view.test.tsx` (en-tête, bouton de téléchargement,
liste des appels avec leurs renseignements ; aucun bouton de clôture, de pause
ni de reprise) ; `components/console/console-view.test.tsx` (ouverture sur la
recherche, ouverture d'une fiche choisie, retour à la liste après
enregistrement) ; **un test de garde** dans le style de `vocabulaire.test.ts`,
qui balaie `src` et refuse dans un texte affiché « file d'appel », « liste
d'appel », « tâche d'appel », « distribuer les appels », « reste à faire ».
C'est le seul moyen d'empêcher le vocabulaire de revenir par un écran non
couvert : à écrire **quand le reste est vert**, sinon il rougit partout à la
fois.

**Playwright**, racine `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/web/e2e/` :

- `workspaces.spec.ts` : supprimer `closeLeftoverCampaigns` (`:28` à `:46`) et
  les cinq tests de campagne (`:170` à `:354`). Écrire à la place un parcours de
  lot : création, compte annoncé, téléchargement du classeur, présence dans la
  liste. La vérification de la signature ZIP `PK\x03\x04` (`readMagic`, `:49` à
  `:56`) se réutilise telle quelle.
- `accessibility.spec.ts:32` à `:34` et `prospects.spec.ts:122` à `:127` : les
  entrées `/campagnes/representants` disparaissent, `/campagnes` change de titre
  attendu, `/console` perd « Carte clavier » si la carte change.
- `redirections.spec.ts:37`, `:38` : `/campagnes/representants` aboutit
  désormais sur `/chues/campagnes`.
- `roles.anon.spec.ts:240`, `:241` : la route supprimée ne peut plus être testée
  en refus de permission, retirer ce bloc ; `:342`, `:343` : ne garder que
  `/chues/campagnes`.
- **`roles.anon.spec.ts:296` à `:303` est déjà rouge avant ce chantier** : il
  attend les intitulés numérotés « 1 · Appeler les représentants », « 2 · Noter
  un prospect », « 3 · Appeler les prospects » et « Mes prospects », qui
  n'existent plus dans `nav-items.ts` (libellés actuels : « Qualifier un
  représentant », « Ajouter un prospect », « Convertir un prospect »,
  « Prospects »). Le corriger au passage, ou le signaler au propriétaire, mais
  ne pas l'imputer à ce chantier.
- `fixtures.ts:11` : le commentaire sur le segment tiré par la création de
  campagne perd son objet.

### 5.3 Mobile

À **supprimer** : `apps/mobile/test/features/campagnes_test.dart` (676 l.) en
entier ; dans `test/support/db_fixture.dart`, `insertCampagne` (l. 172-193) et
`insertTache` (l. 195-217) ; dans `test/core/sync_generations_test.dart`, le
groupe « files d'appels : ce qui n'est plus confié quitte le programme »
(l. 301-385, bandeau compris) puis les aides `tacheDto` (l. 459-473) et
`tacheRepDto` (l. 475-489), devenues sans appel ; dans
`test/core/sync_engine_test.dart`, le test « la file d'une campagne atterrit
telle que le serveur l'a répartie » (l. 1978-2036) ; dans
`test/data/database_test.dart`, le test « la file représentants garde seulement
les tâches ouvertes dans l'ordre » (l. 524-572), le groupe `compteurs` qui suit
(l. 574) restant ; dans `test/data/migration_test.dart`, les blocs v11 vers v12
(l. 1398-1480) et v16 vers v17 (l. 1776-1815), et l'import `schema_v16.dart`
(l. 22) devenu sans usage.

À **adapter** :

| Fichier                                                    | Détail                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `test/data/write_repository_test.dart`                     | Renommer le test l. 709 en `'qualifier un représentant met à jour la fiche'`, supprimer l'insertion de campagne et de tâche (l. 712-731) et l'assertion l. 746 ; **garder** les assertions sur la fiche (l. 741-745), sur `op.entityType` (l. 747-748), sur la charge utile (l. 749) et tout le bloc `repCallbackReminders` (l. 771, 811, 828)                                                                                                                                       |
| `test/data/migration_test.dart`                            | Garder l'import `schema_v11.dart` (l. 18), réutilisé par le nouveau test v11 vers courant ; ajouter `import 'generated_migrations/schema_v19.dart' as v19;`. Le test « le golden couvre toutes les versions déclarées » (l. 63-73) **reste** : il rougit tant que le dump v20 n'existe pas, c'est voulu                                                                                                                                                                              |
| `test/features/home_test.dart` (424 l.)                    | **RÉÉCRIRE** : supprimer l'import l. 10, l'aide `seedFileRepresentants` (l. 43-69), les trois `GoRoute` factices `/campagnes*` (l. 89-110) et les cinq tests l. 154, 221, 239, 264, 331. **Garder** l'aide `mount` (l. 71-152), la `GoRoute` `/representants` (l. 111-115) et les tests l. 317, 344, 365, 387                                                                                                                                                                        |
| `test/features/text_scale_overflow_test.dart` (1028 l.)    | Supprimer les imports l. 13-14, la fixture l. 187-211 (`insertCampagne('campFiche')`, `insertProspect('proCampagne')`, `insertTache('tacheCampagne')`) et les entrées « Campagnes » et « File de campagne » du balayage (l. 502-506) ; **ajouter** après l. 435 l'entrée `'Choisir un prospect': ProspectPickerScreen.new,`. **Garder** la fixture `repCallbackReminders` (l. 174-185)                                                                                               |
| Les sept fichiers qui **construisent** un `SyncChangesDto` | Retrait d'arguments, **après** `pnpm codegen` : `lib/core/sync/stub_api.dart` (l. 64-67), `test/support/fake_api.dart` (l. 486-489), `test/core/sync_engine_test.dart` (l. 1782-1785, 1825-1828, 1882-1885, 1924-1927, 1961-1964), `test/core/sync_generations_test.dart` (l. 514-517), `test/core/sync_ownership_test.dart` (l. 891-894, 1498-1501, 1522-1525), `test/core/sync_reconciliation_test.dart` (l. 974-977), `test/core/sync_visite_referentiels_test.dart` (l. 229-232) |

À **écrire** :

1. **Migration v19 vers v20**, à la fin de `test/data/migration_test.dart`,
   inséré après le `});` (l. 1913) qui ferme le test « v18 -> v19 refuse un
   rendez-vous sans prise de rendez-vous », avant le `}` (l. 1914) qui ferme
   `main()`. `final schema = await verifier.schemaAt(19);` ; ouvrir
   `v19.DatabaseAtV19(schema.newConnection())` ; insérer **en SQL brut** (les
   schémas engendrés n'ont pas de companions typés, commentaire
   `migration_test.dart:41-47`) une campagne, une tâche, une tentative dans
   `call_attempts`, un rappel dans `rep_callback_reminders` et une opération non
   partie dans `outbox` ;
   `await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);` ;
   attendre : `SELECT name FROM sqlite_master WHERE name IN ('call_campaigns','call_tasks','rep_call_campaigns','rep_call_tasks')`
   vide, `db.countMyAttempts().getSingle()` à 1, une ligne dans
   `repCallbackReminders`, et l'opération toujours dans `outbox`. **C'est la
   seule assertion qui compte : une migration ratée sur un appareil de terrain,
   c'est une journée de prospection perdue** (`migration_test.dart:26-31`).
   Preuve du rouge : lancer ce test **avant** d'écrire le palier v20 et vérifier
   qu'il échoue parce que `call_campaigns` existe encore.
2. **Migration v11 vers la version courante** : le chemin long ne casse pas sans
   les paliers 12 et 17.
3. **Accueil CHUES** (`test/features/home_test.dart`) : les trois cartes portent
   les trois titres cibles ; un tap sur la carte 1 pousse
   `/representants?but=qualifier`, sur la carte 2 `/representants`, sur la
   carte 3 `/prospects` ; la carte 2 rend le nombre de représentants sans
   prospect, et `–` quand la lecture échoue. Réemployer l'aide `mount`
   (l. 71-152) en remplaçant seulement ses routes factices.
4. **Sélecteur de prospects** (`test/features/prospect_picker_test.dart`) :
   trois prospects en base via `insertProspect` plus leurs parcours CHUES ;
   taper un morceau de nom réduit la liste ; taper un morceau de numéro avec des
   espaces la réduit aussi ; un tap pousse `/phase2?tel=<E164>` ; liste vide en
   recherche rend `Aucun résultat`.
5. **Débordement de texte** : l'entrée « Choisir un prospect » dans le balayage.

Restent intacts et doivent continuer de passer :
`test/features/phase2_screen_test.dart` (1293 l., le parcours de conversion en
cinq étapes) ; `test/features/accessibilite_ecrans_test.dart` (691 l., chaque
commande porte une action `tap` dans l'arbre sémantique, WCAG 4.1.2 : le
sélecteur de prospects doit y entrer) ; `test/core/theme_tokens_test.dart:226`
(« aucune taille d'icône n'est écrite en dur dans `lib/` », il balaie les
sources) et `:245` à `:251` (l'échelle `CpiSpacing` ne se recalcule pas à la
main) ; `test/features/rappel_alarme_test.dart` (autre chantier, ne pas
toucher) ; `test/core/router_test.dart`, `router_landing_test.dart`,
`test/features/hub_test.dart`, `test/features/shells_test.dart` (aucune
référence à une campagne, mais ils montent le routeur : les faire tourner après
C1) ; `test/data/generated_migrations/schema_v12.dart` à `schema_v19.dart`, qui
sont des photographies de formes passées.

**`test/features/text_scale_overflow_test.dart` est le garde-fou le plus utile
du dépôt** : il peint environ 25 écrans à des tailles de texte allant jusqu'à
1,8 fois sur des largeurs de 320 dp, et échoue au moindre `RenderFlex
overflowed`. Tout écran neuf doit y entrer.

---

## 6. Hors périmètre, signalé

- **Le mobile n'a pas d'historique des appels consignés.** L'onglet « Fiches »
  du CHUES
  (`/Users/cheikh/Workspace/CPI/Projects/crm-monorepo/apps/mobile/lib/features/historique/presentation/historique_screen.dart`)
  liste des **représentants** (`representantListProvider`,
  `app_providers.dart:285-290`), pas des appels. Aucun écran ne montre la liste
  des `call_attempts` et des qualifications saisies par le téléconseiller. La
  table existe et la requête aussi (`attemptsForProspect`, `schema.drift:792`),
  mais elle est **par prospect**. Ce plan garde l'écran tel quel (D14).
- **Deux sources de recherche distinctes sur le mobile, à ne pas fusionner.**
  Le sélecteur de prospects cherche dans `prospects` ; `phase2_directory` couvre
  50 000 à 500 000 numéros **sans nom** (`schema.drift:420-436`, frontière de
  confidentialité délibérée). Un téléconseiller qui cherche « Fatou » ne
  trouvera que les fiches descendues sur l'appareil ; un qui tape un numéro
  complet dans `/phase2` retrouvera n'importe quel dossier de l'annuaire. Les
  deux chemins restent nécessaires.
- **`historiqueSearchProvider` est partagé** entre `HistoriqueScreen` et
  `GrandPublicFichesScreen` (`app_providers.dart:275-283`, `:292-302`). Défaut
  préexistant. Le nouveau sélecteur reçoit son propre provider pour ne pas
  l'aggraver ; corriger le partage existant est hors périmètre.
- Les anciens panneaux banque et entonnoir, orphelins depuis la refonte
  Chiffres, ont été supprimés après confirmation par Knip.
- **`GET /v1/phase2/directory`, `GET /v1/phase2/callbacks` et le module
  `app-updates`** ne sont pas touchés, hors la publication de version de §3.4.
- **Le déploiement lui-même** (`pnpm db:deploy`, publication de l'APK) n'est pas
  du ressort de ce plan.
- **`references/`** : ne pas toucher.

---

## 7. Risques et critères d'acceptation

### 7.1 Risques

| #   | Risque                                                                                                                                                                                                                                                                                            | Parade                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Un APK déjà installé cesse silencieusement de recevoir des fiches** si les quatre clés partent sans que `MIN_PULL_PAYLOAD_VERSION` bouge (chaîne complète en §2.4)                                                                                                                              | Les deux changements dans le **même** déploiement, plus la publication de la version dans le service de mises à jour                            |
| R2  | **Un web en retard sur l'API** rend des `404` bruts à l'utilisateur, sans message                                                                                                                                                                                                                 | API et web dans le même envoi (§3.4)                                                                                                            |
| R3  | **L'arbre de travail bouge.** Trois chantiers écrivent en parallèle                                                                                                                                                                                                                               | Relire chaque fichier avant de l'éditer, ne jamais `Write` par-dessus un fichier modifié, ne jamais `git stash` ni `git checkout` (§0.5)        |
| R4  | **Volume de `lot_export_items`** : jusqu'à 14 millions de lignes par an sans purge                                                                                                                                                                                                                | Les deux étapes de purge sont exposées ; la rétention est D12                                                                                   |
| R5  | **Après le retrait de `campaign-pilotage`, plus aucun écran ne dit « il reste tant de fiches à traiter ».** C'est voulu, mais un tableau de bord qui s'appuyait sur `remaining` ou `estimatedEndDate` rendra un écran **vide** et non une erreur : le cas le plus difficile à repérer             | Les deux points d'entrée repérés sont `apps/web/src/components/stats/campaigns-panel.tsx` et `apps/web/src/lib/data/advanced-stats.ts` (§4.2.4) |
| R6  | **L'ampleur de B4** : `console-view.tsx` fait 944 lignes, dont environ la moitié disparaît. C'est l'étape la plus risquée                                                                                                                                                                         | La mener seule, tests d'abord, sans y mêler d'autre changement                                                                                  |
| R7  | **Ouvrir l'export des représentants au SUPERVISEUR** contredit un choix documenté dans le code (`export.controller.ts:194`)                                                                                                                                                                       | Réécrire le commentaire dans le même geste (§2.1)                                                                                               |
| R8  | **La migration mobile n'aura été prouvée qu'en mémoire** par `migrateAndValidate`. Elle n'est qu'un `DROP TABLE`, donc rapide, mais aucun émulateur ne prouve le comportement sur une base de production chargée de 500 000 lignes d'annuaire, ni les alarmes exactes sur ROM Transsion ou Xiaomi | Un essai sur un appareil réel portant une base de production avant diffusion                                                                    |
| R9  | **Perte définitive du lien appel vers campagne passée** (D7)                                                                                                                                                                                                                                      | Décision du propriétaire                                                                                                                        |
| R10 | **Aucune vérification n'a été exécutée à la rédaction de ce document.** Ni typecheck, ni lint, ni test, ni build                                                                                                                                                                                  | Toutes les commandes de §0.3 et §3 restent à exécuter                                                                                           |

### 7.2 Critères d'acceptation

Le chantier est terminé quand tout ce qui suit est vrai.

**Contrat et API**

1. `pnpm codegen && pnpm codegen:check` passe, et `apps/api/openapi.json` ne
   contient plus aucune des quatorze routes retirées (§2.1), ni
   `CampaignScope`, `CampaignStatus`, `CallTaskStatus`.
2. `POST /api/v1/rep-campaigns/attempts` répond toujours, et sa réponse ne porte
   plus `taskId` ni `taskClosed`.
3. `MIN_PULL_PAYLOAD_VERSION` vaut 5 ; un client annonçant 4 reçoit `426` et
   peut toujours pousser.
4. `GET /api/v1/export/representants.xlsx` accepte `relationStatus`,
   `whatsappStatus`, `hasWhatsapp`, et répond au SUPERVISEUR.
5. Les cinq routes de lot répondent, le classeur est déclaré binaire, et la
   liste des fiches d'un lot est **figée** à la création.
6. Aucun `WHERE` de l'API ne cite `call_tasks` ni `assignedToId` :
   `grep -rn "callTask\|call_tasks\|assignedToId" apps/api/src packages/database/src`
   ne rend plus que du code mort à supprimer.
7. `pnpm --filter @crm/api typecheck|lint|test` verts,
   `pnpm --filter @crm/api test:integration` vert,
   `authorization.sweep.test.ts` **retourné** et vert, `role-routes.test.ts`
   exact.

**Web**

8. Aucun écran ne montre de file, de tâche, d'assignation, de barre de
   progression de campagne, de bouton de clôture, de pause ou de reprise, ni de
   programme PDF par personne.
9. L'étape 1 et l'étape 3 ouvrent toutes deux sur un champ de recherche, et
   ramènent à la liste après enregistrement.
10. `/chues/campagnes` et `/grand-public/campagnes` listent des lots d'export,
    avec le nombre de fiches et les appels passés sur ces fiches depuis la
    création.
11. Le test de garde du vocabulaire refuse « file d'appel », « liste d'appel »,
    « tâche d'appel », « distribuer les appels », « reste à faire » dans tout
    `apps/web/src`.
12. `pnpm --filter @crm/web typecheck|lint|test|build` verts, `pnpm dead-code`
    ne signale aucun orphelin nouveau, et `test:e2e` passe (à l'exception
    connue de `roles.anon.spec.ts:296`, §5.2).

**Mobile**

13. `grep -rn "campagne\|campaign\|call_task\|repCallTask" apps/mobile/lib`
    ne rend plus rien, hors le nom d'étiquette `RepCampaignsApi` (D6).
14. `schemaVersion` vaut 20, `drift_schema_v20.json` et `schema_v20.dart`
    existent, et la migration v19 vers v20 préserve `outbox`, `call_attempts` et
    `rep_callback_reminders`.
15. `payloadVersion` vaut 5.
16. Les trois gestes sont atteignables depuis l'accueil CHUES, et le sélecteur
    de prospects mène à `/phase2?tel=…`.
17. `flutter analyze` rend **0 issue**, `dart format --set-exit-if-changed` ne
    reformate rien, `flutter test` est vert, et le balayage de débordement de
    texte couvre le nouvel écran.

**Dépôt**

18. `pnpm verify:local` et `pnpm test:integration` verts.
19. Rien n'est commité sans demande explicite. Le travail non commité des autres
    chantiers est intact.

---

## Origine

Ce document consolide les audits API, web et mobile réalisés le 28 août 2026.
Les écarts entre domaines sont tranchés en §2.
