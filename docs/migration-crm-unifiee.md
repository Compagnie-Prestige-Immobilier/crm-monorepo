# Migration vers un CRM unifié

## Décision d’architecture

Le CRM devient une seule application pour tous les rôles. CHUES et Grand
Public ne sont plus deux espaces dans l’interface. Ils restent des projets
métier (`Projet`, enum Postgres à deux valeurs) utilisés comme filtre.

Les quatre espaces :

- Registre des visites : l’espace `accueil` actuel, pour le comptoir. Inchangé.
- Téléconseil : fusion des espaces CHUES et Grand Public.
- Banque & Finance : les écrans bancaires aujourd’hui répétés sous `/chues` et
  `/grand-public`.
- Admin : inchangé.

Le mot « Accueil » désigne déjà le comptoir et son registre des visites
(`COQUES` dans `nav-items.ts`, rôle `ACCUEIL`). Il ne nomme pas une page
transversale.

La fusion concerne la navigation, les routes, le filtre Projet et les tableaux
de bord. Elle ne fusionne ni les tables, ni les domaines Go, ni les
formulaires.

## Limites à conserver

- Les prospects et les représentants restent deux entités. Les représentants
  n’ont pas de colonne `projet` : ils appartiennent à CHUES seulement.
- Les appels prospects (`call_attempts`) et les appels représentants
  (`rep_call_attempts`) restent deux historiques.
- Banque & Finance reste un domaine séparé (`internal/banque`), relié aux
  prospects.
- Les résultats d’appel représentants (`RepCallOutcome`, `statuts_qualification`)
  restent séparés des issues d’appel prospects (`CallOutcome`,
  `call_outcome_reasons`).
- Une campagne d’appels est un lot d’export (`lots_export`) : une cible parmi
  quatre, un projet obligatoire, un nom automatique, aucun état.
- Les deux consoles d’appel (CHUES et Grand Public) restent distinctes,
  décision du 11 septembre.
- Les permissions restent contrôlées par le serveur (`socle.Garde`), même si le
  menu masque des écrans.

Hors périmètre de cette migration : fusionner les formulaires prospect CHUES et
Grand Public, réécrire une console, ajouter une page transversale, ajouter un
endpoint, toucher au schéma.

## Travail dans une worktree locale

Une branche locale, jamais poussée. Une worktree détachée perdrait ses commits
à sa suppression.

```bash
rtk git worktree add -b unification ../crm-monorepo-unifie dev
cp .env ../crm-monorepo-unifie/.env
cd ../crm-monorepo-unifie && rtk make setup
```

La base `cpi_v2_dev` est partagée : le schéma ne change pas.

Avant tout travail :

```bash
rtk git status --short
rtk git worktree list
rtk git log -1 --oneline
```

Ne pas utiliser de `reset --hard`, de suppression massive ou de migration
destructive sur l’arbre principal.

## Matrice des rôles

Sept rôles existent (`internal/shared/socle/roles.go`) : `ADMIN`,
`SUPERVISEUR`, `DIRECTION`, `COMMERCIAL` (le téléconseiller),
`CHARGE_CLIENTELE`, `BANQUE_FINANCE`, `ACCUEIL`. La matrice reprend les gardes
serveur actuelles ; elle ne les élargit pas.

| Fonction                                                              | Admin | Superviseur | Direction | Téléconseiller | Chargé de clientèle | Banque & Finance | Accueil |
| --------------------------------------------------------------------- | ----: | ----------: | --------: | -------------: | ------------------: | ---------------: | ------: |
| Registre des visites                                                  |   oui |         non |       oui |            non |                 non |              non |     oui |
| Prospects, représentants, rappels, mes contacts, contacts recommandés |   oui |         oui |       oui |  son périmètre |       son périmètre |              non |     non |
| Créer un prospect                                                     |   oui |         oui |       oui |            non |                 non |              non |     non |
| Campagnes d’appels : créer, modifier, répartir                        |   oui |         oui |   lecture |   attributions |        attributions |              non |     non |
| Supprimer une campagne d’appels                                       |   oui |         non |       non |            non |                 non |              non |     non |
| Tableau de bord Téléconseil                                           |   oui |         oui |       oui |            non |                 non |              non |     non |
| Paramètres CHUES                                                      |   oui |      textes |    textes |            non |                 non |              non |     non |
| Dossiers bancaires, demandes de création de client                    |   oui |         non |       non |            non |                 non |              oui |     non |
| Étapes des dossiers, arbitrage des demandes                           |   oui |         non |       non |            non |                 non |              non |     non |
| Listes de référence                                                   |   oui |         oui |       oui |            non |                 non |              non |     non |
| Reste de l’Admin                                                      |   oui |         non |       non |            non |                 non |              non |     non |

Décision en attente : lecture des dossiers et des indicateurs Finance pour le
superviseur et la direction. Elle exige d’élargir `socle.Banque` sur les seules
routes `GET`. Hors périmètre tant que ce n’est pas tranché.

## 1. Coque et navigation

Fichiers concernés :

```text
web/src/components/layout/nav-items.ts
web/src/components/layout/sidebar-shell.tsx
web/src/components/layout/sidebar-nav.tsx
web/src/components/layout/coque-shell.tsx
web/src/routes/_hub.tsx
web/src/routes/_hub/espaces.tsx
```

`Coque` devient `'accueil' | 'teleconseil' | 'finance' | 'admin'`. Les
sections `chues` et `grand-public` de `SECTIONS` fusionnent en une section
`teleconseil`, sans doublon d’entrée, et leurs écrans bancaires partent dans
`finance`.

### Navigation cible

Téléconseil, téléconseiller et chargé de clientèle :

- Mon travail (les trois étapes CHUES)
- Qualifier un représentant
- Convertir un prospect
- Rappels promis
- Mes contacts
- Contacts recommandés
- Représentants
- Prospects

Téléconseil, encadrement :

- Tableau de bord (onglets : chiffres, activité, présence, pôles)
- Prospects
- Ajouter un prospect
- Représentants
- Rappels
- Campagnes d’appels
- Paramètres CHUES
- Listes de référence (lien vers l’Admin, comme aujourd’hui)

Banque & Finance :

- Vue d’ensemble
- Dossiers bancaires
- À ouvrir (plateforme)
- Demandes de création de client
- Exporter les dossiers
- Étapes des dossiers (Admin)

Admin : inchangé.

### Filtre Projet

```text
Projet : Tous | CHUES | Grand Public
```

Le filtre vit dans l’URL (`?projet=`), donc dans l’en-tête de chaque écran,
et suit la navigation. La palette et la barre latérale ne changent pas avec le
projet.

Les écrans propres à CHUES (représentants, qualification, contacts recommandés,
pôle déploiement, paramètres CHUES) ignorent le filtre et l’affichent :
« Projet : CHUES ». Les consoles exigent un projet : avec « Tous », l’entrée
Convertir demande lequel.

## 2. Routes unifiées

```text
/teleconseil                         Mon travail
/teleconseil/tableau-de-bord         chiffres, activité, présence, pôles
/teleconseil/prospects
/teleconseil/prospects/nouveau
/teleconseil/prospects/:id
/teleconseil/console                 console CHUES
/teleconseil/appel/:id               console Grand Public
/teleconseil/appels-representants
/teleconseil/representants
/teleconseil/representants/import
/teleconseil/representants/:id
/teleconseil/suggestions
/teleconseil/mes-contacts
/teleconseil/rappels
/teleconseil/campagnes
/teleconseil/campagnes/:id
/teleconseil/parametres-chues

/finance                             vue d’ensemble
/finance/dossiers
/finance/dossiers/nouveau            à ouvrir (plateforme)
/finance/dossiers/export
/finance/dossiers/etapes
/finance/dossiers/:id
/finance/demandes-clients
```

Des liens sont sauvegardés : la colonne `notifications.route` porte des
chemins du panneau (`/chues/prospects/{id}`, `/demandes-clients`), et les
utilisateurs ont des favoris. La redirection existe déjà :
`web/src/lib/moved-routes.ts` et `web/src/routes/$.tsx`. Y ajouter les préfixes
`/chues` et `/grand-public`, puis supprimer les anciens fichiers de routes.
Aucune migration de données, aucune nouvelle couche.

## 3. Prospects

Une liste, `/teleconseil/prospects`, à partir de `components/prospects/`, avec
le filtre Projet en plus des filtres actuels. La colonne Projet s’affiche
quand le filtre est sur « Tous ». Le paramètre `projet` de
`GET /api/v1/prospects` est déjà optionnel : le panneau cesse de l’envoyer
quand le filtre est sur « Tous ».

Une route de fiche, `/teleconseil/prospects/:id`. Le composant monté dépend de
`prospect.projet` : `prospects/prospect-detail-view.tsx` pour CHUES,
`grand-public/prospect-detail.tsx` pour Grand Public. Les deux formulaires
restent ; leurs champs de conversion diffèrent et sont figés.

`/teleconseil/prospects/nouveau?projet=` ouvre le formulaire du projet choisi.

Chaque qualification affiche son auteur, sa date, le résultat et le
commentaire, comme aujourd’hui.

## 4. Représentants

CHUES seulement. Les écrans `components/representants/`,
`components/suggestions/` et `components/contacts/` changent de route, pas de
contenu :

```text
/teleconseil/representants
/teleconseil/representants/:id
/teleconseil/representants/import
/teleconseil/appels-representants
/teleconseil/suggestions
```

## 5. Campagnes d’appels

Code existant à réutiliser :

```text
internal/campagnes/
sql/queries/campagnes.sql
web/src/components/lots-export/
web/src/lib/data/lots-export.ts
```

Route : `/teleconseil/campagnes` et `/teleconseil/campagnes/:id`.

Filtres de liste :

```text
Projet : Tous | CHUES | Grand Public
Cible  : Représentants | Prospects | Représentants injoignables | Contacts recommandés
Créée par | Date
```

Un lot n’a pas d’état : ni actif, ni en pause, ni terminé. Ne pas en inventer.

Le dialogue de création garde ses trois étapes (Fiches, Équipe, Lancement).
Une seule différence : l’étape Fiches demande le projet quand le filtre est
sur « Tous », puisque la coque ne le donne plus. Le nom reste automatique. Une
campagne reste mono-projet : `lots_export.projet` est obligatoire.

`listLotsExport` accepte déjà l’absence de `projet` ; `mes-attributions` le
garde obligatoire.

Permissions, inchangées :

- Admin : créer, modifier, répartir, supprimer ;
- Superviseur : créer, modifier, répartir ;
- Direction : consulter ;
- téléconseiller et chargé de clientèle : leurs attributions.

## 6. Tableau de bord Téléconseil

Code existant :

```text
internal/analytics/
web/src/lib/data/chiffres.ts
web/src/components/chiffres/
web/src/components/supervision/
web/src/components/pilotage/
```

Une route, `/teleconseil/tableau-de-bord`, avec les onglets actuels :
chiffres, activité, présence, pôles. Filtres actuels (période,
téléconseiller) plus Projet.

Les onze endpoints `/api/v1/supervision/*` et `/api/v1/analytics/*` prennent
`projet` en optionnel dans huma, mais certaines requêtes de
`sql/queries/analytics.sql` l’exigent encore (`@projet::"Projet"`). Les passer
en `sqlc.narg` : absent, la requête ne filtre pas le projet. Aucun endpoint
ajouté, aucun indicateur ajouté.

Un compteur qui a déjà une liste (rappels, prospects, représentants, campagnes)
ouvre cette liste avec les mêmes filtres :

```text
42 rappels en retard  ->  /teleconseil/rappels?etat=RETARD&projet=TOUS
```

Les graphiques n’ouvrent rien.

## 7. Rappels

Existant : `components/rappels/rappels-view.tsx` et
`rappel-pop-up-intrusif.tsx`. La popup sonne toutes les huit secondes, montre
un rappel et le nombre en attente, et propose Plus tard, Annuler ce rappel,
Consigner l’appel. Plus tard ferme seulement la popup ; Annuler touche seulement
le rappel affiché.

Changements :

- route `/teleconseil/rappels` avec le filtre Projet, et le projet affiché dans
  la popup ;
- deux liens dans la popup : Appeler (`tel:`) et WhatsApp, avec
  `components/prospects/bouton-whatsapp.tsx`.

Reporter un rappel se fait déjà en consignant l’appel avec le résultat Rappel
et une nouvelle date. Pas de bouton Reporter, pas d’endpoint : la table
`scheduled_callbacks` n’a pas de route de report.

`e2e/rappels.spec.ts` prouve qu’annuler un rappel parmi plusieurs laisse les
autres en place.

## 8. Banque & Finance

Le domaine reste séparé côté serveur :

```text
internal/banque/
sql/queries/banque.sql
web/src/components/bank/
```

Une coque `finance`, une entrée `/finance`, à la place des copies sous `/chues`
et `/grand-public`. Composants repris tels quels : `bank-dashboard-view`,
`bank-cases-view`, `bank-kanban`, `bank-a-ouvrir-view`, `bank-stages-view`,
`bank-export-view`, `bank-case-detail-view`, `client-request-dialog`.

Filtres : les filtres actuels de `bank-filters-bar.tsx` plus Projet. Le
paramètre `projet` de `GET /api/v1/bank-cases` et de
`GET /api/v1/bank-cases/analytics` est déjà optionnel ; vérifier leurs
requêtes SQL avec `projet` vide. `bank-cases/a-ouvrir` le garde obligatoire :
la plateforme est propre à un projet.

Les étapes sont celles configurées dans `bank_case_stages`, pas une liste fixe.

Accès : Admin et Banque & Finance (`socle.Banque`). L’ouverture en lecture au
superviseur et à la direction attend la décision de la matrice.

## 9. Page après connexion

L’écran de choix `/espaces` disparaît. Après connexion, chaque rôle atterrit
sur son premier écran :

- Accueil : registre des visites ;
- téléconseiller et chargé de clientèle : Mon travail ;
- direction : leads importés (fiches très intéressées et qualité des classeurs) ;
- superviseur, admin : tableau de bord Téléconseil ;
- Banque & Finance : vue d’ensemble.

Différé : une page transversale (rappels du jour, campagnes, dossiers en
attente).

## 10. Admin

Inchangé. Le projet est un enum Postgres (`CHUES`, `GRAND_PUBLIC`), pas une
donnée de configuration. Il n’existe ni équipes (`users.departementId` est
mort) ni journal général ; le seul journal est celui des paramètres CHUES.

## 11. Données

Aucune table ne change, aucune migration goose, aucune donnée supprimée. Le
seul changement côté serveur : les requêtes SQL de liste et d’indicateurs
citées aux sections 6 et 8 acceptent un `projet` vide. Les gardes de
`socle.Garde` ne changent pas.

## 12. Ordre d’implémentation

1. décision sur la lecture Finance par l’encadrement ;
2. coques et navigation ;
3. routes Téléconseil et Finance, préfixes dans `moved-routes.ts` ;
4. requêtes SQL d’indicateurs avec `projet` vide ;
5. prospects ;
6. représentants ;
7. rappels ;
8. campagnes d’appels ;
9. tableau de bord ;
10. Banque & Finance ;
11. page après connexion ;
12. suppression des fichiers de routes `chues/` et `grand-public/` ;
13. e2e, puis bascule.

## 13. Validation

Un parcours par métier, aucun test unitaire. Adapter les parcours existants aux
nouvelles routes plutôt qu’en écrire :

```text
e2e/connexion.spec.ts          atterrissage par rôle
e2e/roles.spec.ts              restrictions de permissions
e2e/listes-et-fiches.spec.ts   prospects, filtre Tous / CHUES / Grand Public
e2e/convertir.spec.ts          console et qualification
e2e/rappels.spec.ts            popup, annulation d’un rappel parmi plusieurs
e2e/chiffres.spec.ts           tableau de bord, projet Tous et par projet
e2e/parite-banque.spec.ts      dossiers Finance
e2e/suggestions.spec.ts        contacts recommandés
```

Une seule addition : le filtre Projet dans `listes-et-fiches.spec.ts`. Une
campagne d’appels créée depuis « Tous » s’ajoute au parcours existant s’il en
a un, sinon à `listes-et-fiches.spec.ts`.

Chaque parcours touché se casse une fois avant d’être gardé.

```bash
rtk make test              # intégration Go, gardes comprises
rtk pnpm verify:local
rtk pnpm complexite:go
rtk make e2e               # Playwright, --workers=29
```

## Définition de terminé

- personne ne choisit CHUES ou Grand Public pour commencer ;
- une seule navigation, un seul jeu de routes ;
- le projet est un filtre dans l’URL, y compris « Tous » ;
- une campagne d’appels se crée depuis un seul endroit, les anciennes restent
  lisibles ;
- Finance est une entrée unique ;
- les anciennes adresses redirigent ;
- les gardes serveur sont inchangées et prouvées par `roles.spec.ts` ;
- aucune table, aucune donnée, aucun endpoint ajouté ni supprimé.

## 14. Règles UX de la migration

- L’en-tête de chaque écran nomme l’espace, l’écran et le projet :
  « Téléconseil / Prospects, Projet : Tous ».
- Changer de projet garde la recherche, la période et le téléconseiller
  sélectionnés.
- Un écran qui ignore le filtre l’affiche : « Projet : CHUES ».
- Une confirmation nomme l’objet et l’effet avant Annuler ce rappel, Supprimer
  une campagne d’appels et Retirer des fiches : « Annuler le rappel de Awa Ba ?
  Il ne réapparaîtra plus dans la file. »
- Le vocabulaire et le ton suivent `CLAUDE.md` : `teleconseiller`, `Banque &
Finance`, `campagne d’appels prospects`, `campagne d’appels representants`.

Le reste (états d’écran, textes vides, erreurs) suit les conventions déjà en
place dans le panneau ; cette migration n’en ajoute pas.

## 15. Mode d’exécution obligatoire pour un agent

Cette section est normative. L’agent doit suivre les tâches dans l’ordre et ne
jamais réaliser toute la migration en une seule fois.

### Règles absolues

Avant chaque tâche, l’agent doit lire les fichiers indiqués, vérifier qu’ils
existent, afficher son périmètre et ne modifier que les fichiers autorisés.
Après chaque tâche, il exécute la vérification indiquée et s’arrête si elle
échoue.

L’agent ne doit jamais :

- réécrire un domaine entier pour corriger un écran ;
- modifier le SQL sans tâche SQL explicite ;
- modifier un fichier généré à la main ;
- ajouter un package sans justification ;
- créer une API si une API existante suffit ;
- supprimer une ancienne route avant validation de la nouvelle ;
- modifier Finance pour régler un problème Téléconseil ;
- ajouter des tests unitaires ;
- envoyer `TOUS` à une API qui attend l’absence du filtre projet.

Si plus de dix fichiers sont nécessaires pour une tâche, l’agent s’arrête et
scinde la tâche. Il ne devine pas en cas de contradiction : il documente le
blocage et attend une décision.

### Tâche 0 : état initial

Lecture seule : `AGENTS.md`, `docs/v2-refonte/plan.md`,
`web/src/components/layout/nav-items.ts`, `internal/shared/socle/roles.go`.

```bash
rtk git status --short
rtk git worktree list
rtk git log -1 --oneline
```

Résultat attendu : l’agent connaît l’état du dépôt et ne supprime aucune
modification existante.

### Tâche 1 : rôles

Fichiers autorisés : `internal/shared/socle/roles.go`, `web/src/lib/types.ts`.
Objectif : vérifier les rôles techniques et les libellés affichés. Interdit de
modifier les règles de campagnes ou Finance.

```bash
rtk pnpm --dir web typecheck
```

Terminé lorsque l’interface affiche `Téléconseiller` et que les rôles compilent.

### Tâche 2 : chemins

Fichiers autorisés : le helper de chemins déjà existant et
`web/src/lib/data/lots-export.ts`. Ne pas créer une abstraction si aucun
helper n’existe.

Objectif : ajouter les chemins `/teleconseil` et `/finance` sans modifier les
composants métier et sans supprimer les anciens chemins.

### Tâche 3 : navigation

Fichiers autorisés : `web/src/components/layout/nav-items.ts`,
`sidebar-nav.tsx`, `sidebar-shell.tsx`, `coque-shell.tsx`.

Objectif : afficher Accueil, Téléconseil, Banque & Finance et Administration.
Interdit de modifier le contenu des pages liées.

```bash
rtk pnpm --dir web typecheck
rtk pnpm lint
```

### Tâche 4 : route Téléconseil

Fichiers autorisés : les nouveaux fichiers sous
`web/src/routes/_panneau/teleconseil/` uniquement.

Objectif : rendre `/teleconseil` accessible avec un écran fonctionnel. Ne pas
supprimer `/chues` ou `/grand-public`.

### Tâche 5 : prospects

Fichiers autorisés :

```text
web/src/components/prospects/prospects-view.tsx
web/src/components/filters/use-prospect-filters.ts
web/src/lib/data/prospects.ts
web/src/routes/_panneau/teleconseil/prospects/
```

Objectif : une liste avec `Projet : Tous | CHUES | Grand Public`.
`Tous` signifie absence de filtre projet côté API.

Validation : rechercher un téléphone, changer les trois projets, paginer et
réinitialiser les filtres.

### Tâche 6 : fiche prospect

Fichiers autorisés : composants de fiche prospect, console et route
`teleconseil/prospects/:id`.

Objectif : une fiche unique avec champs spécifiques affichés seulement quand
ils sont pertinents. Interdit de changer les statuts ou le schéma SQL.

Terminé lorsque l’utilisateur peut voir, appeler, commenter et revenir à la
liste sans perdre le contexte.

### Tâche 7 : représentants

Fichiers autorisés : `web/src/components/representants/` et les routes
`web/src/routes/_panneau/teleconseil/representants/`.

Objectif : déplacer l’accès dans Téléconseil sans mélanger représentants et
prospects. Ne pas modifier les tables ni Finance.

### Tâche 8 : rappels

Fichiers autorisés : `web/src/components/rappels/` et la route
`teleconseil/rappels/`.

Tester avec trois rappels : fermer la popup, annuler le rappel courant,
reporter le rappel courant et consigner un appel. Les deux autres rappels
doivent rester présents.

### Tâche 9 : campagnes

Fichiers autorisés : `web/src/components/lots-export/`,
`web/src/lib/data/lots-export.ts`, la route `teleconseil/campagnes/` et
`internal/campagnes/campagnes.go` seulement si le contrat actuel est
insuffisant.

Objectif : une liste Tous/CHUES/Grand Public et un wizard commun.
Une campagne prospects reste mono-projet. Ne pas rendre
`lots_export.projet` nullable sans migration SQL séparée.

Validation : créer une campagne de chaque projet, filtrer Tous, ouvrir les
détails et vérifier la répartition.

### Tâche 10 : KPI

Fichiers autorisés : `web/src/components/chiffres/`,
`web/src/components/supervision/`, `web/src/components/pilotage/`,
`web/src/lib/data/chiffres.ts`, `web/src/lib/data/admin.ts` et la route
`teleconseil/kpi/`.

Objectif : un tableau de bord Projet Tous/CHUES/Grand Public. Réutiliser les
endpoints existants. Ajouter au maximum un endpoint si aucun endpoint
existant ne peut fournir le bloc demandé.

### Tâche 11 : Finance

Fichiers autorisés : `web/src/components/bank/`, les routes
`web/src/routes/_panneau/finance/` et `internal/banque/` uniquement si la
permission ou le filtre existant est insuffisant.

Objectif : une entrée Finance avec le filtre projet. Interdit de fusionner
`internal/banque` avec `internal/prospects`.

### Tâche 12 : Accueil et Administration

Modifier uniquement les dossiers existants `web/src/routes/_panneau/accueil/`,
`web/src/components/accueil/`, `web/src/routes/_panneau/admin/` et
`web/src/components/admin/`.

Accueil montre le travail à faire. Administration gère les utilisateurs,
référentiels, imports et paramètres. Ne pas copier les KPI dans Accueil.

### Tâche 13 : autorisations serveur

Relire et vérifier `roles.go`, `internal/campagnes/`,
`internal/analytics/` et `internal/banque/`. Tester chaque nouvelle route
avec un rôle autorisé et un rôle interdit. Masquer un lien ne remplace jamais
l’autorisation serveur.

### Tâche 14 : données

Cette tâche arrive après validation des tâches 5 à 13. Avant toute migration :
sauvegarde, copie de production, rapport des doublons, rappels orphelins,
dossiers Finance incohérents et validation du propriétaire. Ne supprimer
aucune donnée par défaut.

### Tâche 15 : suppression des anciennes routes

Cette tâche est la dernière tâche de code. Avant suppression :

```bash
rtk rg -n '/chues|/grand-public' web/src internal e2e
```

Chaque résultat doit être remplacé, supprimé ou justifié. Supprimer seulement
les routes qui possèdent un équivalent validé.

### Tâche 16 : validation finale

```bash
rtk pnpm plafonds
rtk pnpm lint:go
rtk pnpm complexite:go
rtk pnpm verify:local
rtk make e2e
rtk git diff --check
```

Refuser la livraison si un rappel en annule un autre, si les KPI Tous sont
incohérents, si un rôle accède à une route interdite, si une erreur efface les
filtres, si un fichier généré est suivi par Git ou si un test unitaire est créé.

### Compte rendu obligatoire

Après chaque tâche, l’agent répond avec :

```text
Tâche terminée :
Fichiers modifiés :
Fichiers non modifiés volontairement :
Vérifications exécutées :
Résultat : réussi / échoué
Risque restant :
Tâche suivante autorisée : oui / non
```

Si le résultat est `échoué`, il ne passe pas à la tâche suivante.
