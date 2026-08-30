# Plan de tests navigateur : espace « Projet CHUES »

Cahier d'exécution Playwright pour le panel web CPI CRM, coque `/chues`.
Document de spécification uniquement : aucun test n'est écrit ici, aucun code
applicatif n'est modifié.

---

## 1. Périmètre et hypothèses

### 1.1 Ce qui est couvert

Toutes les routes sous `apps/web/src/app/(panel)/chues/**` :

| Route | Écran | Rôles autorisés (garde serveur) |
| --- | --- | --- |
| `/chues` | Mon travail (trois étapes) | ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION, BANQUE_FINANCE (redirigé vers `/chues/banque`) |
| `/chues/appels-representants` | Étape 1, qualification | ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION |
| `/chues/prospects/nouveau` | Étape 2, saisie | ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION |
| `/chues/console` | Étape 3, conversion | ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION |
| `/chues/statistiques` | Tableau de bord (Chiffres) | ADMIN, SUPERVISEUR, DIRECTION |
| `/chues/tableau-de-bord` | redirection permanente vers `/chues/statistiques` | aucune garde propre |
| `/chues/supervision` | Pilotage : Activité et Comptes | ADMIN, SUPERVISEUR, DIRECTION |
| `/chues/rappels` | Rappels promis | ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION |
| `/chues/representants` | Liste des représentants | ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION |
| `/chues/representants/[id]` | Fiche représentant | ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION |
| `/chues/representants/import` | Import Excel | ADMIN seulement |
| `/chues/prospects` | Liste des prospects | ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION |
| `/chues/dossiers` | Liste des dossiers bancaires | ADMIN, BANQUE_FINANCE |
| `/chues/dossiers/nouveau` | Ouverture d'un dossier | ADMIN, BANQUE_FINANCE |
| `/chues/dossiers/[id]` | Détail d'un dossier | ADMIN, BANQUE_FINANCE |
| `/chues/dossiers/etapes` | Configuration du flux | ADMIN seulement |
| `/chues/dossiers/export` | Export des dossiers | ADMIN, BANQUE_FINANCE |
| `/chues/banque` | Tableau de bord bancaire | ADMIN, BANQUE_FINANCE |
| `/chues/demandes-clients` | Demandes de création de client | ADMIN, BANQUE_FINANCE |
| `/chues/suggestions` | Contacts recommandés | ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION |
| `/chues/campagnes`, `/chues/campagnes/[id]` | Lots d'export (ex-campagnes) | ADMIN, SUPERVISEUR, DIRECTION |

### 1.2 Hypothèses de plateforme

- Pile vivante attendue : PostgreSQL, `pnpm --filter @crm/api dev` sur le port
  3001, `pnpm dev` du web sur le port 3000. `e2e/global-setup.ts` vérifie
  `/health/ready` et fait échouer la suite si l'API manque ou répond 429.
- `workers: 1`, `fullyParallel: false`, `retries: 0`, `timeout: 60 s`,
  `expect.timeout: 10 s`, `locale: fr-FR`, `timezoneId: Africa/Dakar`.
  Africa/Dakar vaut UTC+0 : aucune bascule d'heure ne décale les bornes de date.
- L'API applique deux limiteurs : **10 connexions par minute et par IP**,
  **300 requêtes par minute**. Le budget total de connexions de la suite est
  donc de six états de session, posés une seule fois (§2.1).
- Le panel parle au serveur par le relais `/api/v1/*` du Next, qui porte le
  cookie `httpOnly`. Un `APIRequestContext` construit avec `baseURL` = URL web
  et `storageState` d'un rôle atteint donc l'API avec les droits de ce rôle.

### 1.3 Ce que ce document N'invente PAS

Les libellés cités entre guillemets français ont été relevés dans le code au
27 août 2026. Un agent qui trouve un libellé différent à l'écran ne modifie ni
l'application ni son sélecteur pour « faire passer » : il laisse le test rouge
et rapporte l'écart (§3).

### 1.4 État instable constaté à la lecture (à lire avant d'écrire quoi que ce soit)

Une autre session est en train de remplacer les campagnes par des lots d'export
et de refondre les trois étapes. L'arbre de travail est donc à mi-chemin. Cinq
constats vérifiés qui conditionnent l'écriture :

1. **`GET /v1/supervision/activite` est cassé au niveau SQL.** Dans
   `apps/api/src/modules/analytics/supervision.service.ts`, la requête des
   totaux se termine par
   `COUNT(DISTINCT f.representant)::int  AS representants,` suivi directement de
   `FROM faits f` : une virgule en trop avant `FROM`. PostgreSQL rend une erreur
   de syntaxe, la route répond 500, et `/chues/statistiques` comme
   `/chues/supervision` tombent sur `QueryErrorState`. Aucun test unitaire ne
   peut l'attraper : la requête est un gabarit de chaîne jamais analysé hors
   base. Tous les scénarios CHF-* et SUP-* seront **rouges pour cette raison**
   tant que la virgule est là. C'est le résultat attendu, à rapporter tel quel.
2. **`console-view.tsx` a été reconstruit** (30 août) : recherche serveur puis
   fiche, issues au clavier, renseignements d'adhésion, `?fiche=<id>` lu par
   `GET /api/v1/prospects/{id}`. Parcours ET3-1 à ET3-7 dans
   `e2e/chues-etape3.commercial.spec.ts`, verts.
3. **`/chues/campagnes` est déjà devenu « Lots d'export »** côté web, avec des
   composants provisoires (`<select>` brut sans nom accessible, aucun état vide,
   aucun aperçu chiffré avant création), alors que `Plan.md` décrit un écran
   nettement plus complet. Tous les scénarios LOT-* sont marqués **cible
   mouvante**.
4. **Plusieurs parcours existants sont déjà rouges** sur des libellés que
   `nav-items.ts` a changés : `roles.anon.spec.ts` attend
   « 1 · Appeler les représentants », « 2 · Noter un prospect »,
   « 3 · Appeler les prospects » quand la navigation écrit désormais
   « Qualifier un représentant », « Ajouter un prospect »,
   « Convertir un prospect ». `accessibility.spec.ts` et `prospects.spec.ts`
   attendent le titre « Appeler les prospects » sur `/console` et « Campagnes »
   sur `/campagnes`. Ne pas les « réparer » : les signaler.
5. **Le mot de passe des comptes de fixture diverge.** `seed.ts` écrase le mot
   de passe à chaque exécution avec `SEED_FIXTURE_PASSWORD`, qui vaut
   `ChangeMoi123456` dans `.env`, alors que `e2e/fixtures.ts` déclare
   `FIXTURE_PASSWORD = 'REDACTED'` et ne le repose jamais sur un
   compte existant. Après un `pnpm db:seed`, toute connexion en fixture échoue.
   Voir §2.1 pour la parade.

---

## 2. Stratégie d'exécution

### 2.1 États de session par rôle

Un seul fichier de préparation, **propriété du mainteneur central**, pas d'un
agent : `apps/web/e2e/roles.setup.ts`, enregistré comme projet `setup` de
`playwright.config.ts` à côté de `auth.setup.ts`.

| Fichier d'état | Compte | Rôle |
| --- | --- | --- |
| `e2e/.auth/admin.json` | `admin@cpi.sn` | ADMIN (déjà posé par `auth.setup.ts`) |
| `e2e/.auth/commercial.json` | `fixture.awa@cpi.sn` | COMMERCIAL |
| `e2e/.auth/commercial2.json` | `fixture.fatou@cpi.sn` | COMMERCIAL |
| `e2e/.auth/superviseur.json` | `fixture.superviseur@cpi.sn` | SUPERVISEUR |
| `e2e/.auth/direction.json` | `fixture.direction@cpi.sn` | DIRECTION |
| `e2e/.auth/banque.json` | `fixture.banque@cpi.sn` | BANQUE_FINANCE |

Six connexions au total pour toute la suite, contre dix par minute autorisées.
Elles doivent être **séquentielles** dans un unique `setup(...)`, pas six
`setup(...)` parallèles.

Mot de passe : lire d'abord `process.env.E2E_FIXTURE_PASSWORD`, puis
`process.env.SEED_FIXTURE_PASSWORD`, puis la constante `FIXTURE_PASSWORD` de
`e2e/fixtures.ts`. La connexion qui échoue doit **faire échouer la préparation
en nommant le compte et le message rendu par le formulaire**, jamais rendre la
main en silence. Aucun mot de passe de production n'apparaît dans un fichier
versionné.

Les projets Playwright à ajouter (mainteneur central) :
`chromium-commercial`, `chromium-superviseur`, `chromium-direction`,
`chromium-banque`, chacun avec son `storageState` et son `testMatch`
(`*.commercial.spec.ts`, `*.superviseur.spec.ts`, …), tous en
`dependencies: ['setup']`. Le projet `chromium` par défaut reste l'ADMIN.

**Aucun spec ne se connecte lui-même**, sauf le parcours qui éprouve la
connexion elle-même (`*.anon.spec.ts`, déjà existant).

### 2.2 Données de fixture à créer

Préfixe obligatoire pour toute donnée créée par un nouveau spec : **`E2E-CHUES-`**,
suivi du code de l'écran. Plages téléphoniques réservées, disjointes de
l'existant (jeu de démonstration `+221 77 501 00 xx`, fixtures partagées
`+221 78 100 1xxx`, rafale de `console.spec.ts` `+221 78 100 90 0x`) :

| Spec | Préfixe de nom | Plage téléphonique réservée |
| --- | --- | --- |
| `chues-chiffres-taux` | `E2E-CHUES-TAUX ` | `+221 78 100 40 01` à `40 09` |
| `chues-etape1` | `E2E-CHUES-ET1 ` | `+221 78 100 41 01` à `41 09` |
| `chues-etape2` | `E2E-CHUES-ET2 ` | `+221 78 100 42 01` à `42 09` |
| `chues-representants` | `E2E-CHUES-REP ` | `+221 78 100 43 01` à `43 09` |
| `chues-prospects` | `E2E-CHUES-PRO ` | `+221 78 100 44 01` à `44 29` |
| `chues-suggestions` | `E2E-CHUES-SUG ` | `+221 78 100 45 01` à `45 09` |
| `chues-dossiers` | `E2E-CHUES-DOS ` | référence bancaire `E2E-CHUES-DOS-<horodatage>` |
| `chues-rappels` | `E2E-CHUES-RAP ` | `+221 78 100 46 01` à `46 09` |
| `chues-lots-export` | `E2E-CHUES-LOT ` | pas de fiche propre, lots nommés seulement |

### 2.3 Jeu de données des taux, calculé à la main

C'est le seul jeu dont chaque chiffre affiché doit être vérifié **au pourcent
près**. Il est posé par `chues-chiffres-taux.spec.ts` et par lui seul.

**Journée d'observation figée : `2026-02-03`.** Aucune autre donnée de la base
ne porte cette date d'acte pour ce compte. L'écran est demandé par son URL :
`/chues/statistiques?periode=libre&du=2026-02-03&au=2026-02-03&teleconseiller=<id de fixture.superviseur>`.

Quatre représentants créés en ADMIN (`POST /api/v1/representants`) :

| Fiche | Nom complet | Téléphone |
| --- | --- | --- |
| R1 | `E2E-CHUES-TAUX Rep Un` | `+221781004001` |
| R2 | `E2E-CHUES-TAUX Rep Deux` | `+221781004002` |
| R3 | `E2E-CHUES-TAUX Rep Trois` | `+221781004003` |
| R4 | `E2E-CHUES-TAUX Rep Quatre` | `+221781004004` |
| R5 | `E2E-CHUES-TAUX Rep Cinq` | `+221781004005` |

Cinq tentatives envoyées **avec la session `superviseur`** sur
`POST /api/v1/rep-campaigns/attempts`, avec des `id` UUID v7 **constants,
écrits en dur dans le spec** : le champ est la clé d'idempotence, donc une
relance de la suite ne double aucun compteur.

| Sur | `outcome` | `clientCreatedAt` | Compté ? |
| --- | --- | --- | --- |
| R1 | `REACHED` (+ `relationStatus: AMBASSADEUR`) | `2026-02-03T10:00:00.000Z` | oui |
| R2 | `REFUSED` (+ `relationStatus: REFUS`) | `2026-02-03T11:00:00.000Z` | oui |
| R3 | `CALLBACK` (+ `callbackAt` J+1) | `2026-02-03T12:00:00.000Z` | oui |
| R4 | `UNREACHABLE` | `2026-02-03T23:59:59.999Z` | oui, borne haute incluse |
| R5 | `UNREACHABLE` | `2026-02-04T00:00:00.000Z` | **non**, hors fenêtre |

Résultats attendus, dérivés des définitions de `supervision.service.ts` et de
`pilotage.sql.ts` (`REP_LIVE_OUTCOMES = REACHED, REFUSED, CALLBACK, UNREACHABLE`,
`REP_ANSWERED_OUTCOMES = REACHED, REFUSED`, `rate(v, t) = null si t = 0, sinon
arrondi à 0,1 %`) :

| Champ | Calcul | Valeur |
| --- | --- | --- |
| `repCalls` | R1+R2+R3+R4 | **4** |
| `repReached` | REACHED + REFUSED = R1+R2 | **2** |
| `repCallback` | R3 | **1** |
| `repUnreachable` | R4 | **1** |
| `repContactRate` | 2/4 | **50** → « 50,0 % » |
| `repCallbackRate` | 1/4 | **25** → « 25,0 % » |
| `repQuestioned` | représentants distincts dont la dernière réponse de la fenêtre est REACHED ou REFUSED : R1, R2 | **2** |
| `repQualified` | parmi eux, dernière réponse REACHED : R1 | **1** |
| `repQualificationRate` | 1/2 | **50** → « 50,0 % » |
| `calls` | aucun appel de prospect ce jour-là | **0** |
| `prospectsCreated` | aucune saisie ce jour-là | **0** |
| `methodObtained` | aucune | **0** |
| `reachRate` | `rate(0, 0)` | **`null`** → « Sans objet » attendu |

Rendu attendu sur les cartes d'usine (marques d'usine de
`dashboard-layout.ts`) :

| Carte | Titre affiché | Marque d'usine | Chiffre affiché | Détail affiché |
| --- | --- | --- | --- | --- |
| `appels-de-qualification` | « Appels aux représentants » | `tuile-courbe` | `4` | « dont 2 ont répondu » |
| `taux-de-contact` | « Représentants joints » | `tuile` | `50` | **aucun** (voir §6, question 1) |
| `a-rappeler` | « Rappels promis » | `tuile` | `1` | **aucun** |
| `taux-de-qualification` | « Représentants qui acceptent » | `tuile` | `50` | **aucun** |
| `prospects-notes` | « Prospects notés » | `tuile-courbe` | `0` | « fiches saisies sur la période » |
| `adhesions` | « Adhésions obtenues » | `tuile` | `0` | aucun |
| `reste-a-appeler` | « Reste à appeler » | `tuile` | `0` | aucun |
| `par-teleconseiller` | « Par téléconseiller » | `tableau` | ligne « Superviseur Fixture » : `4`, `2`, `0`, `0` | colonnes « Appels », « Joints », « Prospects notés », « Adhésions » |

La colonne « Appels » du tableau vaut `repCalls + calls` = 4 + 0 = 4 : elle
mélange volontairement les deux familles d'appels, et c'est ce contrat qu'il
faut fixer.

### 2.4 Ordre, séquentialité, idempotence

- **Tout est séquentiel.** `workers: 1` est une contrainte du dépôt, pas une
  préférence : les parcours partagent une base.
- Chaque `describe` qui pose des données puis les relit se déclare
  `test.describe.configure({ mode: 'serial' })`.
- **Idempotence à la relance** : chaque spec doit pouvoir être rejoué dix fois
  d'affilée sans dériver. Trois moyens admis, dans cet ordre :
  1. une clé d'idempotence stable (`id` d'une tentative, `Idempotency-Key` d'un
     lot de synchronisation) ;
  2. un `beforeAll` qui **supprime d'abord** ses propres fiches par leur
     téléphone réservé, puis les recrée ;
  3. un horodatage dans le nom pour ce qui n'est jamais relu par un autre test
     (référence de dossier, nom de lot).
- Un spec qui laisse des fiches vivantes après lui doit le dire dans son
  en-tête, et ces fiches doivent porter son préfixe.
- **Nettoyage** : chaque spec ne nettoie que ses propres données, en début de
  parcours et non en fin (un `afterAll` ne tourne pas après un échec dur, et le
  reliquat sert au diagnostic).

### 2.5 Ce qui ne doit jamais tourner dans cette suite

`pnpm db:seed`, `pnpm db:reset`, une migration, `POST /admin/demo/reset`
(réservé au parcours « l'espace démo se réinitialise » de `workspaces.spec.ts`),
la désactivation d'un compte partagé, la modification d'un référentiel
(banques, syndicats, régions, départements, IEF, étapes bancaires), la
suppression d'un représentant ou d'un prospect qui ne porte pas le préfixe du
spec.

---

## 3. Règles impératives pour l'agent qui écrit un test

Ce document est distribué à des agents indépendants qui ne se voient pas. Les
règles ci-dessous ne sont pas des conseils.

### 3.1 Posture : un test doit pouvoir échouer

Le but d'un test n'est pas de montrer que l'écran marche : c'est **d'attraper le
défaut nommé dans sa ligne « Échoue si »**. Un scénario dont aucune régression
plausible ne ferait rougir l'assertion ne vaut rien et ne doit pas être écrit.

**Interdits, sans exception :**

- `expect(true).toBe(true)`, `expect(x).toBeDefined()` seul, `toBeTruthy()` sur
  un objet toujours présent ;
- `toBeVisible()` sur un conteneur générique (`main`, `div`, une carte) : viser
  le texte, le rôle ou le libellé exact que le scénario prétend prouver ;
- `page.waitForTimeout(...)` et toute attente fixe. Attendre une condition :
  `expect(...).toHaveText/toHaveURL/toHaveCount`, `waitForURL`,
  `waitForEvent('download')`, `waitForResponse` ;
- `test.skip(...)` et `test.fixme(...)` sans numéro de ticket dans le message ;
- `retries` local, `test.describe.configure({ retries: n })` ;
- `try { … } catch { }` qui avale l'échec, `.catch(() => false)` sur une
  précondition ;
- sélecteurs CSS fragiles : `nth-child`, classes Tailwind, `div > div > span`,
  `[class*="…"]`. Utiliser les rôles ARIA, les libellés, les `aria-label` et
  `getByText` avec la chaîne exacte ;
- regex assouplie pour masquer un écart de libellé. Si le libellé attendu par
  ce document ne se trouve pas, le test échoue et l'écart est rapporté ;
- allongement d'un `timeout` pour faire passer un test instable.

### 3.2 Propriété des fichiers

1. Un agent n'écrit **que dans le fichier de spec qui lui est assigné**.
2. Il ne modifie jamais `playwright.config.ts`, `e2e/fixtures.ts`,
   `e2e/auth.setup.ts`, `e2e/roles.setup.ts`, `e2e/global-setup.ts`,
   `e2e/xlsx.ts`, ni un autre fichier de spec. Un besoin d'infrastructure
   (nouvel état de session, nouvelle aide partagée) est **décrit dans le retour**
   et intégré par le mainteneur central.
3. Il ne supprime ni ne renomme aucun test existant, même s'il le croit
   redondant ou déjà rouge.
4. Il ne touche jamais au code applicatif : `apps/web/src`, `apps/api`,
   `packages/**`. **Si le test révèle un bug, le test reste ROUGE.** On ne
   corrige ni l'application ni l'assertion pour passer au vert.
5. Il ne crée pas d'aide partagée, de page object, de classe de base ni de DSL
   pour un seul spec.

### 3.3 Propriété des données

1. Chaque spec crée ses données avec **son** préfixe (§2.2) et **sa** plage
   téléphonique. Il ne lit et ne supprime que les siennes.
2. Les trente prospects `+221 78 100 1xxx`, le représentant
   « Ibrahima Fixture » (`+221781000001`), le client bancaire
   `+221781001000` et les deux numéros de rafale `+221 78 100 90 0x`
   **appartiennent aux specs existants** (`fixtures.ts`, `console.spec.ts`,
   `workspaces.spec.ts`). Un nouveau spec ne les modifie, ne les supprime et ne
   les clôt jamais. Il peut les **lire**.
3. Aucun spec ne réinitialise la base publique, ne lance `pnpm db:seed`,
   `pnpm db:reset` ni une migration.
4. `POST /api/v1/admin/demo/reset` et le mode démonstration sont la propriété
   exclusive du parcours « l'espace démo se réinitialise et reste isolé » de
   `workspaces.spec.ts`. Aucun autre spec ne l'appelle ni ne l'allume.
5. Les comptes de fixture ne sont ni renommés, ni désactivés, ni changés de
   rôle, ni supprimés.

### 3.4 Ressources partagées

1. **Aucune connexion supplémentaire.** Le limiteur accorde dix par minute pour
   toute la machine. On réutilise l'état de session du rôle (§2.1).
2. Pas de modification des référentiels partagés.
3. `workers: 1` reste obligatoire. Un spec ne relance pas Playwright avec
   d'autres options.
4. L'API accorde 300 requêtes par minute : un `beforeAll` qui boucle sur cent
   fiches est un budget dépensé pour tout le monde. Préparer en lots, viser
   moins de trente requêtes par spec.

### 3.5 Preuve de livraison

Le retour d'un agent contient obligatoirement :

- la **commande exacte** exécutée, par exemple
  `pnpm --filter @crm/web exec playwright test e2e/chues-chiffres.spec.ts --project=chromium-superviseur` ;
- la **sortie brute** du lanceur, non résumée ;
- le nombre exact de tests **passés** et **rouges** ;
- pour chaque rouge, la cause tranchée : **bug applicatif** (avec le fichier et
  la ligne fautive) ou **test à corriger** (avec ce qui manque) ;
- les données laissées en base après le passage.

« Tout passe » sans sortie de commande n'est pas accepté. **Un test rouge sur un
vrai bug est un livrable réussi**, et sera plus utile qu'un test vert.

### 3.6 Interdictions de périmètre

- Ne pas réduire le périmètre assigné pour finir vite. Un scénario non écrit est
  déclaré non écrit, avec sa raison.
- Ne pas fusionner dix scénarios en un seul test : la première assertion qui
  casse masquerait les neuf autres.
- Ne pas remplacer un parcours navigateur par un appel d'API. L'API sert à
  **préparer** une précondition et à **vérifier** un effet en base, jamais à
  remplacer le clic ou la frappe qui est l'objet du test.
- Ne pas fabriquer un état par injection dans `localStorage` ou par exécution de
  JavaScript dans la page quand un geste utilisateur existe.

---

## 4. Données autorisées et interdites, écran par écran

| Écran | L'agent PEUT créer | L'agent NE DOIT PAS toucher |
| --- | --- | --- |
| `/chues` (hub) | rien | tout : l'écran ne fait que lire des compteurs |
| Étape 1 | représentants `E2E-CHUES-ET1 ` sur `+221 78 100 41 0x`, et leurs tentatives d'appel | « Ibrahima Fixture », les représentants du jeu de démonstration, le statut de relation d'une fiche qui n'est pas la sienne |
| Étape 2 | prospects `E2E-CHUES-ET2 ` sur `+221 78 100 42 0x` | les trente prospects `78 100 1xxx`, les deux fiches de rafale `78 100 90 0x` |
| Étape 3 | rien tant que l'écran est un talon | — |
| Chiffres et disposition | sa propre disposition d'écran (`PUT`/`DELETE /tableaux-de-bord/chues/disposition`) sous la session d'un rôle donné | la disposition **par défaut** (`PUT …/par-defaut`, ADMIN) : elle est vue par tous les comptes. Un seul scénario y touche et la remet à l'état trouvé |
| Chiffres, taux | R1 à R5 `E2E-CHUES-TAUX ` et leurs cinq tentatives à `id` constants | toute autre tentative d'appel représentant, toute fiche datée du `2026-02-03` |
| Supervision | rien | les comptes, leur activité, leur état |
| Rappels | rappels promis depuis ses propres fiches `E2E-CHUES-RAP ` | annuler un rappel qu'il n'a pas posé |
| Représentants, fiche, import | fiches `E2E-CHUES-REP ` et classeurs fabriqués à l'exécution | la fiche importée par `representants-import.spec.ts` (`Aïssatou E2E<horodatage>`) |
| Prospects | fiches `E2E-CHUES-PRO ` | la fusion, la réaffectation et la suppression d'une fiche d'un autre spec |
| Suggestions | suggestions posées via une tentative sur ses propres représentants `E2E-CHUES-SUG ` | changer le statut d'une suggestion qu'il n'a pas créée |
| Dossiers | dossiers de référence `E2E-CHUES-DOS-<horodatage>` sur le client `+221781001000` en lecture seule côté prospect | les étapes bancaires (`/chues/dossiers/etapes` en écriture), les dossiers de `workspaces.spec.ts` |
| Banque | rien | — |
| Demandes clients | une demande `E2E-CHUES-DMC ` déposée en session BANQUE_FINANCE | approuver ou refuser une demande d'un autre spec |
| Lots d'export | lots nommés `E2E-CHUES-LOT <horodatage>` | supprimer un lot qu'il n'a pas créé |

---

## 5. Scénarios

Format de chaque entrée :

```
ID | priorité | intitulé
Données   : ce qu'il faut avant
Parcours  : les gestes, dans l'ordre
Assertions: ce qui est vérifié, avec le libellé exact
Échoue si : le défaut concret que l'assertion attrape
Fichier   : cible d'écriture
```

Priorités : **P1** bloquant (une régression ici casse le métier),
**P2** important, **P3** confort.

---

### 5.1 `/chues` — Mon travail

Rôles autorisés : ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION.
BANQUE_FINANCE est **redirigé** vers `/chues/banque` (pas d'écran de refus).
Composant : `components/chues/hub-view.tsx`.

**HUB-1 | P1 | l'écran d'ouverture nomme le téléconseiller et ses trois étapes**
Données : aucune.
Parcours : session COMMERCIAL, aller sur `/chues`.
Assertions : `heading` niveau 1 contenant « Projet CHUES » ; texte exact
« Bonjour Awa. Trois étapes, dans l'ordre. » ; trois `heading` niveau 2 :
« Qualifier un représentant », « Ajouter un prospect », « Convertir un
prospect » ; le titre du document correspond à `/Projet CHUES/`.
Échoue si : le prénom n'est pas extrait du nom complet (« Bonjour Awa Fixture »),
une étape disparaît, l'ordre des étapes change, ou seule la coquille du layout
est rendue sans la page.
Fichier : `e2e/chues-hub.commercial.spec.ts` (nouveau).

**HUB-2 | P1 | chaque étape mène à sa route**
Données : aucune.
Parcours : session COMMERCIAL, `/chues`, cliquer le lien « Qualifier un
représentant », revenir, cliquer « Ajouter un prospect », revenir, cliquer
« Convertir un prospect ».
Assertions : les URL atteintes sont exactement `/chues/appels-representants`,
`/chues/prospects/nouveau`, `/chues/console`.
Échoue si : un geste pointe encore sur une ancienne route (`/console`,
`/appels-representants`) et n'arrive qu'après un renvoi, ou pointe sur l'étape
voisine.
Fichier : `e2e/chues-hub.commercial.spec.ts`.

**HUB-3 | P1 | les trois gestes sont des LIENS, pas des boutons**
Données : aucune.
Parcours : session COMMERCIAL, `/chues`.
Assertions : `getByRole('link', { name: 'Qualifier un représentant' })` porte un
attribut `href` valant `/chues/appels-representants` ; idem pour les deux
autres ; `getByRole('button', { name: 'Qualifier un représentant' })` a un
compte de 0.
Échoue si : une primitive Base UI repose `role="button"` sur le `<a>`, ce qui
supprime l'ouverture dans un nouvel onglet et le menu contextuel.
Fichier : `e2e/chues-hub.commercial.spec.ts`.

**HUB-4 | P2 | un compteur ne montre jamais un zéro provisoire**
Données : aucune.
Parcours : session COMMERCIAL, intercepter `GET /api/v1/representants**` et
retarder la réponse de 2 s (`route.fulfill` après attente d'une **condition**,
pas d'un `waitForTimeout` dans le test : utiliser `route` + `Promise` résolue
par l'événement de requête), puis ouvrir `/chues`.
Assertions : pendant l'attente, aucun texte `0 pas encore appelés` n'est présent ;
après réponse, la légende « pas encore appelés » est visible avec un nombre.
Échoue si : le squelette est retiré et un `0` provisoire s'affiche, ce qui fait
fermer l'écran à un téléconseiller qui a trois cents fiches.
Fichier : `e2e/chues-hub.commercial.spec.ts`.

**HUB-5 | P2 | un compteur en erreur affiche un tiret, pas un zéro**
Données : aucune.
Parcours : session COMMERCIAL, intercepter `GET /api/v1/representants**` et
répondre 500, ouvrir `/chues`.
Assertions : la légende « pas encore appelés » est visible et le chiffre qui la
précède est le tiret demi-cadratin `–` ; l'écran ne rend aucun `heading`
« Serveur injoignable » ni « Chargement impossible ».
Échoue si : une erreur de compteur fait tomber tout l'écran d'ouverture, ou
affiche `0` là où la donnée est inconnue.
Fichier : `e2e/chues-hub.commercial.spec.ts`.

**HUB-6 | P2 | la pastille « À faire maintenant » désigne la première étape qui a du travail**
Données : au moins un représentant `relationStatus = INCONNU` visible du compte.
Parcours : session COMMERCIAL, `/chues`.
Assertions : exactement une occurrence du texte « À faire maintenant » ; elle est
dans l'élément de liste qui contient « Qualifier un représentant ».
Échoue si : la pastille apparaît sur deux étapes à la fois, ou sur l'étape 3
alors que l'étape 1 a des fiches à appeler.
Fichier : `e2e/chues-hub.commercial.spec.ts`.
Note : `Plan.md` prévoit de **supprimer** cette pastille. Si elle a disparu, le
test est rouge et l'agent le rapporte comme « comportement retiré volontairement,
scénario à retirer », sans le supprimer lui-même.

**HUB-7 | P1 | un agent Banque & Finance est redirigé, pas refusé**
Données : aucune.
Parcours : session BANQUE_FINANCE, `page.goto('/chues')`.
Assertions : l'URL finale est `/chues/banque` ; le titre du document
correspond à `/Tableau de bord bancaire/` ; aucun `heading` « Accès refusé ».
Échoue si : la redirection est remplacée par un refus, ce qui casse la tuile
« Projet CHUES » du hub des espaces pour ce rôle (couvert côté navigation par
`roles.anon.spec.ts`, jamais par l'URL directe).
Fichier : `e2e/chues-hub.banque.spec.ts` (nouveau).

**HUB-8 | P3 | l'écran tient sur 375 px de large**
Données : aucune.
Parcours : session COMMERCIAL, `viewport 375 × 812`, `/chues`.
Assertions : les trois `heading` niveau 2 sont visibles ; les trois liens
d'étape sont visibles et cliquables ; `document.documentElement.scrollWidth`
ne dépasse pas `375`.
Échoue si : la grille `md:grid-cols-3` fuit horizontalement, ou une carte passe
sous le pli sans être atteignable.
Fichier : `e2e/chues-hub.commercial.spec.ts`.

---

### 5.2 `/chues/appels-representants` — Étape 1, qualification

Composant : `components/console/rep-script.tsx`.
Rôles autorisés : ADMIN, COMMERCIAL, SUPERVISEUR, DIRECTION.
Refus attendu : BANQUE_FINANCE, ACCUEIL, avec « Les appels aux représentants est
réservé à un autre rôle. ».

**ET1-1 | P1 | l'écran ouvre sur la recherche, focalisée, et ne choisit personne**
Données : au moins un représentant en base.
Parcours : session COMMERCIAL, `/chues/appels-representants`.
Assertions : le champ nommé « Qui avez-vous appelé ? » est visible, porte le
texte de remplacement « Chercher un représentant : nom ou numéro » et **a le
focus** ; le texte « Choisissez qui vous venez d'appeler. » est visible ; aucune
fiche n'est ouverte (aucun bouton « Copier », aucun texte « Étape 1 sur 2 »).
Échoue si : l'écran ouvre directement une fiche, ou le focus n'est pas posé et
le téléconseiller doit cliquer avant de taper.
Fichier : `e2e/chues-etape1.commercial.spec.ts` (nouveau).

**ET1-2 | P1 | la recherche par nom resserre la liste**
Données : représentant `E2E-CHUES-ET1 Awa Diop`, `+221781004101`.
Parcours : taper `E2E-CHUES-ET1 Awa` dans « Qui avez-vous appelé ? ».
Assertions : la liste (`listitem` sous la `ol`) contient exactement une entrée
portant le texte `E2E-CHUES-ET1 Awa Diop` ; le numéro affiché est
`+221 78 100 41 01` (format de `formatPhone`).
Échoue si : le débounce ne part jamais, la recherche est faite côté client sur
une page déjà chargée, ou le numéro est rendu brut `+221781004101`.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-3 | P1 | la recherche par numéro trouve la même fiche que la recherche par nom**
Données : la fiche de ET1-2.
Parcours : taper `781004101`, relever le nom trouvé ; effacer, taper
`78 100 41 01`, relever le nom trouvé.
Assertions : les deux relevés valent `E2E-CHUES-ET1 Awa Diop` et la liste a un
seul élément dans les deux cas.
Échoue si : la recherche compare la chaîne brute au lieu des seuls chiffres, et
« 78 100 41 01 » ne trouve rien.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-4 | P2 | une recherche sans résultat le dit**
Parcours : taper `E2E-CHUES-ET1-INTROUVABLE-ZZZ`.
Assertions : texte exact « Aucun résultat. Vérifiez le nom ou le numéro. » ;
aucun `listitem` dans la liste.
Échoue si : l'écran laisse un squelette permanent, ou affiche la liste
précédente en gardant l'ancien résultat par `placeholderData`.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-5 | P1 | ouvrir une fiche montre le numéro en grand et le sépare en deux étapes**
Données : `E2E-CHUES-ET1 Awa Diop`, relation `INCONNU`.
Parcours : chercher, cliquer l'entrée de liste.
Assertions : `heading` niveau 2 = `E2E-CHUES-ET1 Awa Diop` ; le numéro
`+221 78 100 41 01` est visible ; bouton « Copier » présent ; texte
« Étape 1 sur 2 · Comment s'est passé l'appel ? » ; les trois choix
« Joignable », « À rappeler », « Injoignable » sont des boutons avec
`aria-pressed="false"`.
Échoue si : la fiche s'ouvre sur l'étape 2, ou une quatrième issue (« Mauvais
numéro ») réapparaît à la saisie alors que seules trois sont admises.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-6 | P1 | tant qu'il manque une réponse, « Continuer » est verrouillé et dit ce qui manque**
Parcours : fiche ouverte, ne rien choisir.
Assertions : bouton « Continuer » désactivé, phrase « Choisissez d'abord le
résultat » visible. Puis choisir « Joignable » : le bouton reste désactivé et la
phrase devient « Dites s'il est représentant CPI CHUES ». Puis « Oui » : la
phrase devient « Dites s'il a WhatsApp sur ce numéro ». Puis « Non » à WhatsApp :
la phrase devient « Écrivez le numéro WhatsApp », le champ « Numéro WhatsApp »
apparaît. Saisir `77 123 45 67` : le bouton « Continuer » devient actif.
Échoue si : le verrou saute et une tentative part sans son statut de relation,
ce qu'une contrainte de base refuserait plus tard ; ou la phrase de blocage
disparaît et l'agent ne sait pas ce qui manque.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-7 | P1 | « À rappeler » exige une échéance et l'écrit dans le récapitulatif**
Parcours : fiche ouverte, choisir « À rappeler ».
Assertions : le groupe « Quand rappeler ? » apparaît ; « Continuer » désactivé
avec « Choisissez quand rappeler » ; choisir le premier créneau proposé ;
« Continuer » devient actif ; passer à l'étape 2 ; la liste de définitions
contient l'intitulé « Rappel » avec une valeur non vide.
Échoue si : l'échéance devient facultative et une tentative `CALLBACK` part sans
`callbackAt`, que le serveur refuse.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-8 | P2 | « Choisir une date » propose un jour puis ses demi-heures**
Parcours : « À rappeler », cliquer « Choisir une date », saisir dans « Quel
jour ? » la date de demain.
Assertions : le titre « À quelle heure ? » apparaît et au moins un bouton
d'heure est proposé ; choisir la première heure ; le bouton du calendrier porte
alors l'échéance formatée au lieu de « Choisir une date ».
Échoue si : le champ de date accepte une date passée (`min` retiré), ou aucune
demi-heure n'est proposée pour un jour ouvré à venir.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-9 | P1 | l'enregistrement consigne UNE tentative et revient à la liste**
Données : `E2E-CHUES-ET1 Awa Diop` en relation `INCONNU`.
Parcours : fiche ouverte, « Joignable » puis « Oui » puis « Oui » (WhatsApp même
numéro), « Continuer », écrire un commentaire, « Enregistrer ». Compter les
requêtes `POST /api/v1/rep-campaigns/attempts` par `page.on('request')`.
Assertions : exactement **une** requête `POST` sur cette route ; retour à la
liste ; texte `role="status"` exact
« Appel enregistré pour E2E-CHUES-ET1 Awa Diop. » ; une notification `sonner`
portant la même phrase ; en relisant `GET /api/v1/representants?search=…` la
fiche porte `relationStatus = AMBASSADEUR`.
Échoue si : chaque réponse part au fil de l'eau (plusieurs `POST`), ce qui
empêche de revenir sur une réponse ; ou le statut de relation n'est pas posé.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-10 | P1 | une relation déjà tranchée demande confirmation AVANT tout**
Données : `E2E-CHUES-ET1 Awa Diop` déjà en `AMBASSADEUR` (état laissé par ET1-9
ou posé par l'API dans le `beforeAll`).
Parcours : chercher la fiche, cliquer.
Assertions : un `dialog` s'ouvre, titre exact « Cette personne a déjà accepté
d'être représentant CPI CHUES. », description « Voulez-vous quand même consigner
un nouvel appel ? » ; ni le nom, ni le numéro, ni la première question ne sont
visibles derrière ; « Revenir à la liste » ramène à la liste sans rien écrire ;
rouvrir puis « Continuer » affiche enfin la question « Comment s'est passé
l'appel ? ».
Échoue si : la garde est retirée et une requalification silencieuse écrase un
« oui » déjà obtenu.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-11 | P2 | le même dialogue pour un refus déjà enregistré**
Données : `E2E-CHUES-ET1 Ousmane Fall`, `+221781004102`, relation `REFUS`.
Parcours : ouvrir la fiche.
Assertions : titre du `dialog` exact « Cette personne a déjà refusé. ».
Échoue si : les deux cas partagent un titre générique et l'agent ne sait pas
lequel il a sous les yeux.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-12 | P2 | un refus permet de proposer quelqu'un d'autre, et le numéro devient obligatoire dès qu'on commence**
Parcours : fiche `INCONNU`, « Joignable » puis « Non ».
Assertions : le groupe « Il propose quelqu'un d'autre ? (facultatif) » apparaît
avec les champs « Son numéro », « Son nom et prénom », « Sa remarque » ;
« Continuer » est actif tant que les trois sont vides ; écrire seulement dans
« Son nom et prénom » : « Continuer » se verrouille avec « Écrivez le numéro de
la personne proposée » ; écrire `77 123 45 68` dans « Son numéro » : le bouton
redevient actif.
Échoue si : la suggestion commencée est effacée en silence à l'envoi, ou le
serveur refuse la tentative entière pour un numéro manquant sans que l'écran
l'ait dit.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-13 | P2 | les raccourcis clavier documentés font ce qu'ils annoncent**
Parcours : fiche ouverte ; déplier `Carte clavier`.
Assertions : la liste de définitions contient exactement les trois lignes
`C` → « Copier le numéro », `E` → « Corriger la fiche »,
`Échap` → « Revenir en arrière » ; presser `e` ouvre le dialogue de correction
de fiche ; le fermer ; presser `Échap` sur l'étape 1 revient à la liste ; depuis
l'étape 2, `Échap` revient à l'étape 1 et non à la liste.
Échoue si : la carte clavier annonce une touche qui n'existe plus (par exemple
les flèches ou l'espace, retirés), ou `Échap` saute l'étape intermédiaire et
perd les réponses saisies.
Fichier : `e2e/chues-etape1.commercial.spec.ts`.

**ET1-14 | P1 | l'écran est refusé à un agent Banque & Finance**
Parcours : session BANQUE_FINANCE, `/chues/appels-representants`.
Assertions : `heading` niveau 2 « Accès refusé » ; l'alerte contient
« Les appels aux représentants est réservé à un autre rôle. » et
« Banque & Finance » ; le lien « Retour à l'accueil » porte `href="/espaces"`.
Échoue si : la garde serveur est retirée et l'écran se rend, l'API renvoyant
alors des 403 en cascade.
Fichier : `e2e/chues-etape1.banque.spec.ts` (nouveau).

---

### 5.3 `/chues/prospects/nouveau` — Étape 2, saisie

Composant : `components/prospects/prospect-create-form.tsx`.
Déjà couvert par `console.spec.ts` : la rafale (« la saisie en rafale garde la
banque et le syndicat ») et le doublon (« un numéro déjà pris nomme la fiche
existante »). **Ne pas les réécrire.**

**ET2-1 | P1 | la validation nomme chaque champ manquant**
Données : aucune.
Parcours : session COMMERCIAL, `/chues/prospects/nouveau`, cliquer
« Enregistrer ce prospect » sans rien saisir.
Assertions : les alertes portent exactement « Le prénom est obligatoire. »,
« Le nom est obligatoire. », « Le numéro est obligatoire. »,
« Choisissez un représentant. » ; aucune requête `POST /api/v1/prospects` n'est
partie (compter par `page.on('request')`).
Échoue si : le formulaire part quand même et le serveur rend une erreur
générique, ou une seule erreur globale remplace les quatre messages nommés.
Fichier : `e2e/chues-etape2.commercial.spec.ts` (nouveau).

**ET2-2 | P1 | un numéro invalide pour le pays choisi est refusé côté écran**
Parcours : choisir un représentant, saisir prénom et nom, saisir `123` dans
« Téléphone », enregistrer.
Assertions : alerte « Numéro invalide pour le pays choisi. » ; aucune requête
`POST /api/v1/prospects`.
Échoue si : le contrôle est retiré et un numéro inexploitable atteint la base,
ou l'écran affiche « Le numéro est obligatoire. » pour un champ rempli.
Fichier : `e2e/chues-etape2.commercial.spec.ts`.

**ET2-3 | P1 | l'indicatif du pays change le numéro envoyé**
Parcours : ouvrir le sélecteur nommé « Pays », choisir un pays autre que le
Sénégal, saisir un numéro local valide de ce pays, enregistrer, intercepter le
corps de `POST /api/v1/prospects`.
Assertions : le champ `phone` du corps commence par l'indicatif choisi, pas par
`+221`.
Échoue si : l'indicatif est ignoré et toute saisie est normalisée en `+221`, ce
qui crée des doublons invisibles.
Fichier : `e2e/chues-etape2.commercial.spec.ts`.

**ET2-4 | P2 | la cascade région resserre les départements**
Déjà couvert par `console.spec.ts` (« la cascade région resserre la liste des
départements ») **sur `/chues/representants`**. Ne pas dupliquer.
Ce qui manque : le même resserrement dans le **dialogue de création de
représentant** ouvert depuis ce formulaire.
Parcours : dans le champ « Représentant », taper un nom inconnu
`E2E-CHUES-ET2 Nouveau`, cliquer la proposition de création.
Assertions : le dialogue de fiche s'ouvre avec le champ nom pré-rempli à
`E2E-CHUES-ET2 Nouveau` ; s'il porte les listes Région et Département, le choix
d'une région réduit strictement le nombre d'options de département.
Échoue si : la saisie déjà tapée est perdue à l'ouverture du dialogue, ce qui
oblige à la retaper.
Fichier : `e2e/chues-etape2.commercial.spec.ts`.

**ET2-5 | P2 | la saisie tapée sert de pré-remplissage selon qu'elle contient des lettres ou des chiffres**
Parcours : taper `781004201` (que des chiffres) dans « Représentant », déclencher
la création.
Assertions : le dialogue pré-remplit le champ **téléphone** et laisse le nom
vide ; en refaisant avec `E2E-CHUES-ET2 Fatou`, c'est le **nom** qui est
pré-rempli et le téléphone qui reste vide.
Échoue si : la répartition lettres/chiffres est inversée, et un numéro atterrit
dans le champ nom.
Fichier : `e2e/chues-etape2.commercial.spec.ts`.

**ET2-6 | P2 | `Ctrl + Entrée` enregistre et enchaîne**
Données : plage `+221 78 100 42 0x` vidée en `beforeAll`.
Parcours : remplir représentant, banque, syndicat, prénom, nom, téléphone
`78 100 42 01`, presser `Control+Enter`.
Assertions : le texte d'aide « Ctrl + Entrée enregistre et enchaîne. » est
visible avant le geste ; après le geste, le compteur passe de
« Aucun prospect noté pour l'instant. » à
« 1 prospect noté pour <nom du représentant> aujourd'hui » ; les champs prénom,
nom et téléphone sont vides ; le focus est revenu sur « Prénom ».
Échoue si : le raccourci disparaît, ou il enregistre sans vider l'identité et la
fiche suivante hérite du nom précédent.
Fichier : `e2e/chues-etape2.commercial.spec.ts`.

**ET2-7 | P2 | le lien de sortie ramène au projet**
Parcours : `/chues/prospects/nouveau`.
Assertions : le lien « Terminé, revenir au projet » porte `href="/chues"` ;
cliquer amène à `/chues`.
Échoue si : le lien pointe encore sur une route d'avant le découpage en coques.
Fichier : `e2e/chues-etape2.commercial.spec.ts`.

**ET2-8 | P2 | `?rep=<id>` verrouille le représentant**
Données : identifiant d'un représentant `E2E-CHUES-ET2`.
Parcours : ouvrir `/chues/prospects/nouveau?rep=<id>`.
Assertions : le champ « Représentant » n'est **pas** rendu ; enregistrer une
fiche valide ; le corps de `POST /api/v1/prospects` porte `representantId`
égal à l'identifiant de l'URL.
Échoue si : le paramètre est ignoré et le téléconseiller doit rechoisir le
représentant qu'il vient de quitter, ou la fiche est rattachée au mauvais.
Fichier : `e2e/chues-etape2.commercial.spec.ts`.

**ET2-9 | P3 | l'écran tient sur 375 px**
Parcours : `viewport 375 × 812`, `/chues/prospects/nouveau`.
Assertions : les champs « Prénom », « Nom », « Téléphone » sont visibles ; le
bouton « Enregistrer ce prospect » est visible sans défilement horizontal
(`scrollWidth <= 375`).
Échoue si : la grille `sm:grid-cols-2` fuit et le bouton d'enregistrement sort
de l'écran.
Fichier : `e2e/chues-etape2.commercial.spec.ts`.

---

### 5.4 `/chues/console` — Étape 3, conversion

Composant : `components/console/console-view.tsx` (recherche puis fiche),
`conversion-fields.tsx` (renseignements d'adhésion).
Endpoints : `GET /api/v1/prospects` (recherche, 20 dernières fiches du projet),
`GET /api/v1/prospects/{id}` (`?fiche=`), `POST /api/v1/sync/push`
(`call_attempt`, renseignements de conversion écrits sur la tentative et sur le
prospect). Fichier : `e2e/chues-etape3.commercial.spec.ts`, session COMMERCIAL,
mode série, fiches `+221 78 100 91 01` à `91 04` recréées à chaque exécution.

**ET3-1 | P1 | l'écran ouvre sur la recherche, focalisée**
Champ « Quel prospect avez-vous appelé ? » autofocalisé ; sans saisie, au plus
vingt fiches récentes du projet CHUES ; aucune fiche ouverte d'office.

**ET3-2 | P1 | `?fiche=<id>` ouvre directement la fiche visée**
Lecture par identifiant ; aucun avertissement ; « Revenir à la liste » rend la
recherche. **ET3-2b** rejoue le chemin réel : un rappel promis depuis la fiche
apparaît dans `/chues/rappels`, et « Ouvrir la fiche » rouvre la fiche.

**ET3-3 | P1 | les touches ouvrent l'échéance, les renseignements, et consignent**
`5` ouvre « Quand rappeler », Échap le referme ; `1` ouvre « Phase 3 ·
Conversion », Échap le referme ; `4` consigne `UNREACHABLE` (relu par l'API,
fiche toujours `PENDING`).

**ET3-4 | P1 | après enregistrement, retour à la liste**
`role=status` « Appel enregistré pour X. », aucune fiche ouverte à la place.

**ET3-5 | P2 | la carte clavier ne mentionne plus « ↑ ↓ » ni « Espace »**

**ET3-6 | P2 | une fiche déjà close refuse un nouvel appel en le disant**
Après un refus (`6`), la fiche rouverte affiche « Fiche déjà close (refus) »,
sans bouton d'issue ; `4` ne consigne rien.

**ET3-7 | P1 | l'adhésion exige le dossier complet, et le serveur l'enregistre**
Sur CHUES : ni « Situation » ni « Paiement » (le prospect est enseignant) ;
« Enregistrer l'adhésion » sur un dossier incomplet nomme chaque manque sous son
champ et n'envoie rien ; une fois e-mail, profession, durée dans
l'établissement, fonctionnaire, syndicat, banque, engagement, revenu mensuel et
durée du système renseignés, l'API relit `METHOD_OBTAINED`, la profession, le
syndicat, la tranche de revenu et la durée du système, `type` et `paymentMode`
restant nuls.

---

### 5.5 `/chues/statistiques` — Tableau de bord (Chiffres)

Composants : `components/chiffres/vue.tsx`, `sources.ts`, `filtres.ts`, et la
grille partagée `components/accueil/tableau-de-bord/*`.
Rôles autorisés : ADMIN, SUPERVISEUR, DIRECTION. Refus : COMMERCIAL,
BANQUE_FINANCE, ACCUEIL.
Endpoints : `GET /api/v1/supervision/activite`,
`GET|PUT|DELETE /api/v1/tableaux-de-bord/chues/disposition`.

**Tous les scénarios de cette section sont attendus rouges** tant que la virgule
de trop de `supervision.service.ts` (§1.4 point 1) n'est pas retirée. C'est
précisément ce qu'ils doivent prouver.

#### 5.5.1 Chargement, rôles, période

**CHF-1 | P1 | l'écran d'usine pose ses huit cartes pour un superviseur**
Données : aucune (disposition d'usine, `source: 'usine'`).
Parcours : session SUPERVISEUR, `/chues/statistiques`.
Assertions : les titres de carte exacts « Appels aux représentants »,
« Représentants joints », « Rappels promis », « Représentants qui acceptent »,
« Prospects notés », « Adhésions obtenues », « Reste à appeler »,
« Par téléconseiller » sont visibles ; « Encaissé » et « De l'appel à
l'encaissement » ont un compte de 0 ; aucun `heading` « Chargement impossible »,
« Serveur injoignable » ni « Accès refusé ».
Échoue si : `GET /supervision/activite` répond 500 (bug SQL en cours), si une
carte d'usine disparaît, ou si les montants s'ouvrent à la supervision.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts` (nouveau).

**CHF-2 | P1 | la direction voit en plus les deux cartes de montants**
Parcours : session DIRECTION, `/chues/statistiques`.
Assertions : en plus des huit, les titres « Encaissé » et « De l'appel à
l'encaissement » sont visibles ; le contenu de « Encaissé » contient « FCFA ».
Échoue si : la règle `VOIT_LES_MONTANTS` du contrôleur et le catalogue client
divergent, et un superviseur se voit proposer la recette.
Fichier : `e2e/chues-chiffres.direction.spec.ts` (nouveau).

**CHF-3 | P1 | l'écran est refusé à un téléconseiller**
Parcours : session COMMERCIAL, `/chues/statistiques`.
Assertions : `heading` niveau 2 « Accès refusé » ; alerte contenant
« Les chiffres du projet CHUES est réservé à un autre rôle. » et
« Téléconseiller ».
Échoue si : la garde tombe et un téléconseiller lit l'activité de ses collègues.
Fichier : `e2e/chues-chiffres.commercial.spec.ts` (nouveau).

**CHF-4 | P1 | l'écran est refusé à un agent Banque & Finance**
Parcours : session BANQUE_FINANCE, `/chues/statistiques`.
Assertions : « Accès refusé » et « Banque & Finance ».
Échoue si : idem, sur un rôle qui n'a aucun périmètre CHUES commercial.
Fichier : `e2e/chues-chiffres.banque.spec.ts` (nouveau).

**CHF-5 | P1 | les six pastilles de période changent l'écran et l'URL**
Parcours : session SUPERVISEUR, `/chues/statistiques`, cliquer successivement
« Ce mois-ci », « Mois dernier », « 3 derniers mois », « 12 derniers mois »,
« Cette année », « Année dernière ».
Assertions : la pastille cliquée porte `aria-pressed="true"` et les cinq autres
`"false"` ; l'URL porte `periode=<clé>` (`ce-mois`, `mois-dernier`,
`trois-mois`, `douze-mois`, `cette-annee`, `annee-derniere`) ; la ligne
`aria-live="polite"` sous les pastilles affiche exactement le libellé cliqué.
Échoue si : la période n'entre pas dans l'URL, donc l'adresse partagée à un
collègue n'ouvre pas le même écran ; ou deux pastilles restent enfoncées.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

**CHF-6 | P2 | la plage libre écrit ses deux bornes dans l'URL et les réaffiche**
Parcours : cliquer « Plage libre », saisir `Du` = `2026-02-01`,
`Au` = `2026-02-28`.
Assertions : l'URL porte `periode=libre&du=2026-02-01&au=2026-02-28` ; la ligne
`aria-live` affiche `01 févr. 2026 – 28 févr. 2026` ; le champ `Du` porte
`max=2026-02-28` et le champ `Au` porte `min=2026-02-01`.
Échoue si : les bornes ne se contraignent pas mutuellement et une plage inversée
est acceptée, ou l'affichage retombe sur le libellé d'un preset.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

**CHF-7 | P2 | une plage de plus de 400 jours est refusée par un message, pas par un écran vide**
Parcours : `/chues/statistiques?periode=libre&du=2024-01-01&au=2026-08-27`.
Assertions : un élément `role="alert"` contient
« Cette plage dépasse 400 jours » et le nombre de jours calculé.
Échoue si : la garde disparaît et le serveur est interrogé sur trois ans, ou le
message n'annonce pas le seuil et l'utilisateur ne sait pas quoi raccourcir.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

**CHF-8 | P2 | le sélecteur « Comparer à » garde ses trois choix et l'URL**
Parcours : ouvrir le `combobox` nommé « Comparer à », choisir
« Comparer à : période précédente ».
Assertions : l'URL porte `comparaison=precedente` ; le déclencheur affiche le
libellé complet et non la valeur `precedente` ; « Comparer à : rien » ne pose
aucun paramètre dans l'URL.
Échoue si : Base UI rend la valeur brute au lieu du libellé, comme il le faisait
pour le téléconseiller.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

#### 5.5.2 Vue par téléconseiller

**CHF-9 | P1 | la liste des téléconseillers inclut la supervision et la direction, et exclut la banque**
Données : les comptes de fixture existent (`fixture.awa`, `fixture.fatou`,
`fixture.superviseur`, `fixture.direction`, `fixture.banque`).
Parcours : session SUPERVISEUR, `/chues/statistiques`, ouvrir le `combobox`
nommé « Téléconseiller regardé ».
Assertions : les options contiennent « Toute l'équipe », « Awa Fixture »,
« Fatou Fixture », « Superviseur Fixture », « Direction Fixture » ; aucune
option ne porte « Moussa Fixture » (BANQUE_FINANCE) ni le nom complet du compte
ADMIN.
Échoue si : la constante `TELECONSEIL_ROLES` de `supervision.service.ts` est
resserrée au seul `COMMERCIAL` et les appels passés par l'encadrement
disparaissent de l'écran ; ou un compte d'administration entre dans le plateau.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

**CHF-10 | P1 | le sélecteur affiche le NOM, jamais l'identifiant**
Parcours : ouvrir
`/chues/statistiques?teleconseiller=<id de fixture.direction>`.
Assertions : le déclencheur « Téléconseiller regardé » affiche exactement
« Direction Fixture » ; son texte ne contient aucun fragment de l'UUID (par
exemple les huit premiers caractères de l'identifiant).
Échoue si : la fonction de rendu de `SelectValue` est retirée et Base UI rend la
valeur de l'item, c'est-à-dire l'UUID en clair (régression déjà survenue, fixée
en unitaire par `vue.test.tsx`, jamais éprouvée dans un vrai navigateur).
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

**CHF-11 | P2 | sans choix, le sélecteur annonce « Toute l'équipe » et l'URL reste propre**
Parcours : `/chues/statistiques`, puis choisir un téléconseiller, puis
rechoisir « Toute l'équipe ».
Assertions : au départ le déclencheur affiche « Toute l'équipe » et l'URL ne
porte pas `teleconseiller` ; après le choix, l'URL porte
`teleconseiller=<uuid>` ; après le retour, le paramètre a disparu de l'URL.
Échoue si : `tous` finit écrit dans l'URL comme un identifiant et le serveur
répond 400 sur un UUID invalide.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

**CHF-12 | P1 | le tableau « Par téléconseiller » nomme tout le plateau, même sans acte**
Parcours : session SUPERVISEUR, période `Ce mois-ci`, sans filtre de
téléconseiller.
Assertions : le tableau de la carte « Par téléconseiller » a pour en-têtes
exacts « Téléconseiller », « Appels », « Joints », « Prospects notés »,
« Adhésions » ; il contient une ligne d'en-tête de rang pour « Awa Fixture »,
« Fatou Fixture », « Superviseur Fixture », « Direction Fixture » ; il ne
contient pas « Moussa Fixture ».
Échoue si : la liste est construite à partir des seules lignes d'activité au
lieu du référentiel `teleconseillers`, et un agent sans acte disparaît du
tableau, ce qui masque exactement ce qu'un superviseur cherche.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

#### 5.5.3 Taux vérifiés au chiffre près

Jeu de données et calculs : §2.3. URL utilisée :
`/chues/statistiques?periode=libre&du=2026-02-03&au=2026-02-03&teleconseiller=<id superviseur>`.

**CHF-13 | P1 | le taux de contact vaut exactement 50 % sur 2 joints pour 4 appels**
Données : R1 à R5 et les cinq tentatives de §2.3, posées en session SUPERVISEUR
avec des `id` constants.
Parcours : session SUPERVISEUR, ouvrir l'URL ci-dessus.
Assertions : la carte « Appels aux représentants » affiche le chiffre `4` et le
détail « dont 2 ont répondu » ; la carte « Représentants joints » affiche le
chiffre `50` ; le texte accessible de cette carte (`sr-only`) contient
exactement « 50,0 % des appels aboutissent ».
Échoue si : `REP_LIVE_OUTCOMES` change et le rappel promis ou l'injoignable
sortent du dénominateur (le taux passerait à 100 % ou 66,7 %) ; si un
`CALLBACK` est compté comme joint (le taux passerait à 75 %) ; si la borne haute
`23:59:59.999` est exclusive et R4 disparaît (4 appels deviendraient 3, le taux
66,7 %) ; ou si l'attempt hors fenêtre R5 est compté (5 appels, 40 %).
Fichier : `e2e/chues-chiffres-taux.superviseur.spec.ts` (nouveau).

**CHF-14 | P1 | le taux de rappel vaut exactement 25 % sur 1 rappel pour 4 appels**
Assertions : la carte « Rappels promis » affiche le chiffre `1` ; son texte
accessible contient « 25,0 % des appels ».
Échoue si : `repCallbackRate` est calculé sur les seuls appels joints (1/2 =
50 %) au lieu de tous les appels vivants.
Fichier : `e2e/chues-chiffres-taux.superviseur.spec.ts`.

**CHF-15 | P1 | le taux de qualification vaut exactement 50 % sur 1 accepté pour 2 interrogés**
Assertions : la carte « Représentants qui acceptent » affiche le chiffre `50` ;
son texte accessible contient exactement « 1 sur 2 interrogés ».
Échoue si : le dénominateur devient le nombre d'appels (1/4 = 25 %) au lieu des
représentants distincts ayant répondu ; ou si le « dernier gagnant » n'est plus
appliqué et un représentant rappelé compte deux fois.
Fichier : `e2e/chues-chiffres-taux.superviseur.spec.ts`.

**CHF-16 | P1 | la ligne d'équipe du tableau porte 4, 2, 0, 0**
Assertions : dans la carte « Par téléconseiller », la ligne dont l'en-tête de
rang vaut « Superviseur Fixture » porte, dans l'ordre, les cellules `4`, `2`,
`0`, `0`.
Échoue si : la colonne « Appels » cesse de sommer `repCalls + calls` et n'affiche
plus que les appels de prospects (0), ou si le filtre par téléconseiller ne borne
pas le tableau et d'autres lignes apparaissent.
Fichier : `e2e/chues-chiffres-taux.superviseur.spec.ts`.

**CHF-17 | P2 | une journée sans aucun appel ne se lit pas « 0 % »**
Données : aucune tentative le `2026-02-05` pour ce compte.
Parcours : ouvrir
`/chues/statistiques?periode=libre&du=2026-02-05&au=2026-02-05&teleconseiller=<id superviseur>`.
Assertions : la carte « Représentants joints » affiche le chiffre `0` ; son
texte accessible contient « Sans objet », **pas** « 0,0 % ».
Échoue si : le repli `valeur ?? 0` de `scalaireTaux` masque le `null` du serveur
et « personne appelé » devient indistinguable de « personne joint », ce que le
contrat de `SupervisionActivityCountsDto` interdit explicitement.
Fichier : `e2e/chues-chiffres-taux.superviseur.spec.ts`.
Note : à la lecture, ce scénario est **attendu rouge** : le texte accessible est
construit par `taux()` qui rend bien « Sans objet », mais le chiffre affiché
reste `0`. C'est le défaut à rapporter (voir §6, question 2).

**CHF-18 | P2 | le filtre par téléconseiller borne réellement les chiffres**
Parcours : sur la même journée `2026-02-03`, comparer l'écran filtré sur
`fixture.superviseur` et l'écran filtré sur `fixture.awa`.
Assertions : filtré sur `fixture.awa`, la carte « Appels aux représentants »
affiche `0` et le tableau « Par téléconseiller » ne contient qu'une ligne, celle
d'« Awa Fixture ».
Échoue si : `commercialId` n'est pas transmis, ou n'est appliqué qu'aux lignes
et pas aux totaux, et les chiffres d'un agent portent le travail de l'équipe.
Fichier : `e2e/chues-chiffres-taux.superviseur.spec.ts`.

**CHF-19 | P2 | un rechargement complet rend exactement le même écran**
Parcours : ouvrir l'URL de §2.3, relever le chiffre des quatre cartes de taux,
`page.reload()`.
Assertions : l'URL est inchangée ; les quatre chiffres relevés sont identiques.
Échoue si : les filtres ne vivent pas dans l'URL et un rechargement retombe sur
« Ce mois-ci » et « Toute l'équipe ».
Fichier : `e2e/chues-chiffres-taux.superviseur.spec.ts`.

**CHF-20 | P2 | l'écran en erreur propose de réessayer, il ne reste pas blanc**
Parcours : intercepter `GET /api/v1/supervision/activite**` et répondre 500,
ouvrir `/chues/statistiques`.
Assertions : un `heading` parmi « Chargement impossible » ou « Serveur
injoignable » est visible, avec le texte de repli
« Les chiffres n'ont pas pu être calculés. Réessayez. » et un bouton
« Réessayer » ; lever l'interception, cliquer « Réessayer » : les cartes
s'affichent.
Échoue si : l'erreur laisse un squelette permanent, ou le bouton « Réessayer »
ne relance ni les six requêtes de jeux ni celle de disposition.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

**CHF-21 | P3 | l'écran tient sur 375 px**
Parcours : `viewport 375 × 812`, `/chues/statistiques` en SUPERVISEUR.
Assertions : les huit titres de carte sont atteignables ; le tableau
« Par téléconseiller » défile horizontalement dans son propre conteneur, la page
non (`document.documentElement.scrollWidth <= 375`).
Échoue si : le tableau d'équipe pousse la page entière et rend la navigation
impossible au pouce.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

#### 5.5.4 Mode de composition et disposition sauvegardée

Le mode s'ouvre par le bouton **« Composer l'écran »** (et non « Organiser »,
qui est le libellé du tableau de bord des visites).

**DSP-1 | P1 | « Composer l'écran » ouvre le mode et le nomme**
Parcours : session SUPERVISEUR, `/chues/statistiques`, cliquer
« Composer l'écran ».
Assertions : le texte « Mode organisation » est visible ; les boutons
« Ajouter un graphique », « Quitter » et « Enregistrer » sont visibles ; le
bouton « Composer l'écran » a disparu ; « Proposer par défaut » a un compte de 0
pour un SUPERVISEUR.
Échoue si : « Proposer par défaut » s'ouvre à un non-ADMIN et un superviseur
impose sa disposition à toute l'entreprise.
Fichier : `e2e/chues-disposition.superviseur.spec.ts` (nouveau).

**DSP-2 | P1 | « Proposer par défaut » n'existe que pour l'ADMIN et demande confirmation**
Parcours : session ADMIN, `/chues/statistiques`, « Composer l'écran », cliquer
« Proposer par défaut ».
Assertions : un `dialog` titré « Fixer la disposition par défaut », description
« Les comptes qui n'ont rien enregistré verront cette organisation. », bouton de
confirmation « Proposer par défaut ». **Fermer sans confirmer.**
Échoue si : la confirmation saute et un clic accidentel change l'écran de tous
les comptes.
Fichier : `e2e/chues-disposition.spec.ts` (nouveau, projet ADMIN).
Contrainte : ce scénario **ne confirme jamais**. Aucun agent n'appelle
`PUT …/disposition/par-defaut`.

**DSP-3 | P1 | retirer une carte, enregistrer, recharger : elle reste absente**
Parcours : session SUPERVISEUR, « Composer l'écran », cliquer le bouton nommé
« Retirer Reste à appeler », cliquer « Enregistrer », attendre la fin du
`PUT /api/v1/tableaux-de-bord/chues/disposition`, puis `page.reload()`.
Assertions : après l'enregistrement, le mode est refermé (« Composer l'écran »
de nouveau visible) ; le titre « Reste à appeler » a un compte de 0 ; après le
rechargement complet, il a toujours un compte de 0 ; le bouton
« Revenir à l'écran par défaut » est désormais visible (la disposition est
`source: 'utilisateur'`).
Échoue si : la disposition n'est pas persistée et la carte revient après F5 ; ou
elle est persistée mais l'écran ne le relit pas et affiche encore l'usine.
Fichier : `e2e/chues-disposition.superviseur.spec.ts`.
Nettoyage : le scénario DSP-8 remet l'écran à l'usine ; l'ordre `serial` est
obligatoire dans ce fichier.

**DSP-4 | P1 | ajouter une carte depuis le tiroir**
Parcours : mode composition, cliquer « Ajouter un graphique ».
Assertions : un tiroir titré « Ajouter un graphique » avec la description
« Choisissez ce que vous voulez suivre. L'image montre la forme conseillée. » ;
il propose « Reste à appeler » (retirée en DSP-3) et **ne propose pas** une
carte déjà posée, par exemple « Prospects notés » ; choisir « Reste à appeler » ;
le tiroir se ferme, la carte réapparaît dans la grille ; « Enregistrer ».
Échoue si : le tiroir propose une source déjà placée et l'enregistrement crée un
doublon que le serveur déduplique en silence.
Fichier : `e2e/chues-disposition.superviseur.spec.ts`.

**DSP-5 | P2 | le tiroir dit quand tout est placé**
Parcours : mode composition avec toutes les sources posées.
Assertions : le tiroir affiche « Toutes les sources sont déjà placées. » et
aucune vignette de choix.
Échoue si : le tiroir s'ouvre vide sans rien dire, et l'utilisateur croit qu'il
est cassé.
Fichier : `e2e/chues-disposition.superviseur.spec.ts`.

**DSP-6 | P1 | l'ordre se change AU CLAVIER, sans glisser-déposer, et il est sauvegardé**
Parcours : mode composition ; relever l'ordre des titres de carte ; cliquer le
bouton nommé « Descendre Appels aux représentants » ; « Enregistrer » ;
`page.reload()`.
Assertions : après le clic, la première carte n'est plus « Appels aux
représentants » ; le bouton « Monter » de la première carte de la grille est
désactivé et le bouton « Descendre » de la dernière l'est aussi ; après le
rechargement, l'ordre relevé est identique à celui d'après le clic.
Échoue si : le réordonnancement n'est possible qu'à la souris, ce qui exclut le
clavier ; ou l'ordre n'est pas sérialisé et revient à l'usine après F5.
Fichier : `e2e/chues-disposition.superviseur.spec.ts`.

**DSP-7 | P2 | la marque d'une carte se change et survit au rechargement**
Parcours : mode composition, cliquer le bouton
« Changer la présentation de Représentants joints », choisir « Jauge » dans le
menu, « Enregistrer », `page.reload()`.
Assertions : la carte « Représentants joints » rend un graphique de jauge et non
la tuile ; après rechargement, c'est toujours le cas.
Échoue si : `sanitize` du serveur retombe sur la marque d'usine parce que la
marque choisie n'est pas dans `compatibles`, et le choix de l'utilisateur
disparaît sans message.
Fichier : `e2e/chues-disposition.superviseur.spec.ts`.

**DSP-8 | P1 | « Revenir à l'écran par défaut » efface la disposition personnelle**
Parcours : disposition personnelle enregistrée (état laissé par DSP-3 à DSP-7),
cliquer « Revenir à l'écran par défaut », attendre le
`DELETE /api/v1/tableaux-de-bord/chues/disposition`, `page.reload()`.
Assertions : les huit cartes d'usine sont de nouveau présentes dans l'ordre
d'usine (`Appels aux représentants` en tête, `Par téléconseiller` en queue) ; le
bouton « Revenir à l'écran par défaut » a disparu (la source est redevenue
`usine` ou `defaut`).
Échoue si : la remise à zéro laisse la disposition personnelle en base et
l'écran ne change pas ; ou elle efface aussi la disposition **par défaut** de
l'entreprise.
Fichier : `e2e/chues-disposition.superviseur.spec.ts`. **Ce scénario est le
nettoyage du fichier : il doit rester le dernier.**

**DSP-9 | P2 | « Quitter » avec des changements demande confirmation**
Parcours : mode composition, retirer une carte, cliquer « Quitter ».
Assertions : un `dialog` titré « Quitter sans enregistrer », description
« Les changements faits dans ce mode seront perdus. », bouton
« Quitter sans enregistrer » ; confirmer ; la carte retirée est de nouveau là.
Échoue si : la confirmation ne s'affiche pas et une composition longue est
perdue d'un clic ; ou elle s'affiche même sans changement.
Fichier : `e2e/chues-disposition.superviseur.spec.ts`.

**DSP-10 | P2 | « Quitter » sans changement ne demande rien**
Parcours : mode composition, ne rien modifier, cliquer « Quitter ».
Assertions : aucun `dialog` n'apparaît ; le bouton « Composer l'écran » est de
nouveau visible.
Échoue si : la détection de modification compare des objets par référence et
juge tout écran « modifié ».
Fichier : `e2e/chues-disposition.superviseur.spec.ts`.

**DSP-11 | P2 | la disposition est PROPRE à chaque compte**
Parcours : session SUPERVISEUR, retirer « Adhésions obtenues » et enregistrer ;
dans un contexte séparé porteur de l'état DIRECTION, ouvrir
`/chues/statistiques`.
Assertions : chez la DIRECTION, la carte « Adhésions obtenues » est **toujours
présente**.
Échoue si : la disposition est enregistrée globalement au lieu d'être rattachée
au compte, et un superviseur modifie l'écran de la direction.
Fichier : `e2e/chues-disposition.superviseur.spec.ts` (deux contextes dans un
seul test, sans connexion supplémentaire : les deux états de session sont déjà
sur disque).
Nettoyage : remettre la disposition du SUPERVISEUR à l'usine en fin de test par
« Revenir à l'écran par défaut », geste utilisateur et non appel d'API.

**DSP-12 | P2 | la disposition est PROPRE à chaque écran**
Parcours : session SUPERVISEUR, retirer une carte sur `/chues/statistiques`,
enregistrer, puis ouvrir `/grand-public/statistiques`.
Assertions : l'écran Grand Public garde ses cartes d'uside (`prospects-notes`,
`adhesions`, `reste-a-appeler`, `par-teleconseiller`) ; la carte retirée côté
CHUES n'existe de toute façon pas là-bas.
Échoue si : le paramètre `ecran` du chemin est ignoré et les deux écrans
partagent une disposition.
Fichier : `e2e/chues-disposition.superviseur.spec.ts`.
Note : `/grand-public` sort du périmètre de ce document. Ce scénario n'y fait
qu'une lecture ; il ne modifie rien.

---

### 5.6 `/chues/tableau-de-bord` — redirection

**TDB-1 | P1 | l'ancienne route mène aux chiffres, en redirection permanente**
Parcours : session SUPERVISEUR, `page.goto('/chues/tableau-de-bord')`.
Assertions : l'URL finale est exactement `/chues/statistiques` ; les cartes de
l'écran des chiffres sont rendues (au moins le titre « Par téléconseiller »).
Échoue si : la redirection est retirée et les notifications déjà envoyées en
base, qui portent cette adresse, tombent en 404.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

**TDB-2 | P2 | les anciennes adresses hors coque arrivent aussi**
Parcours : `page.goto('/tableau-de-bord')` puis `page.goto('/statistiques')`.
Assertions : les deux atterrissent sous `/chues/statistiques` ou
`/accueil/tableau-de-bord` selon la table de renvois, sans page « Page
introuvable ».
Échoue si : l'attrape-tout de renvoi est cassé pour ces deux racines.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.
Note : la table complète est déjà fixée en unitaire (`src/app/moved-routes.test.ts`)
et le câblage par `e2e/redirections.spec.ts`. Ne pas balayer les dix-sept
racines ici.

---

### 5.7 `/chues/supervision` — Pilotage

Composants : `supervision-tabs.tsx`, `activity-view.tsx`, `supervision-view.tsx`.
Rôles : ADMIN, SUPERVISEUR, DIRECTION. Même endpoint cassé que §5.5.

**SUP-1 | P1 | les deux volets existent et l'onglet vit dans l'URL**
Parcours : session SUPERVISEUR, `/chues/supervision`.
Assertions : deux `tab` nommés « Activité » et « Comptes » ; « Activité » est
sélectionné par défaut et l'URL ne porte pas `volet` ; cliquer « Comptes » pose
`volet=comptes` dans l'URL ; recharger la page garde l'onglet « Comptes »
sélectionné.
Échoue si : l'onglet n'est pas dans l'URL et un lien partagé ouvre toujours le
mauvais volet ; ou les deux volets sont montés en même temps et le volet Comptes
se rafraîchit en boucle derrière l'Activité.
Fichier : `e2e/chues-supervision.superviseur.spec.ts` (nouveau).

**SUP-2 | P1 | le tableau d'activité porte ses neuf colonnes**
Parcours : volet « Activité ».
Assertions : les en-têtes de colonne exactes « Appels », « Méthodes »,
« NRP / injoignables », « Faux numéros », « Refus », « À rappeler »,
« Joignabilité », « Prospects saisis », « Représentants contactés » sont
présentes ; les colonnes « Tâches closes » et « Reste à faire » ont un compte
de 0 (elles sont retirées par le chantier en cours).
Échoue si : une colonne de campagne réapparaît alors que les tâches n'existent
plus, ou une colonne d'appel disparaît.
Fichier : `e2e/chues-supervision.superviseur.spec.ts`.

**SUP-3 | P2 | les trois périodes changent la requête**
Parcours : cliquer « Aujourd'hui », « Cette semaine », « 7 derniers jours »
(libellés de `PERIOD_LABELS`, à relire dans `lib/data/admin.ts`).
Assertions : la pastille cliquée porte `aria-pressed="true"` ; la requête
`GET /api/v1/supervision/activite` repart avec de nouvelles bornes `actFrom` et
`actTo` (interception).
Échoue si : la clé de cache n'inclut pas la plage et l'écran affiche les
chiffres de la période précédente.
Fichier : `e2e/chues-supervision.superviseur.spec.ts`.

**SUP-4 | P2 | le tri par colonne bascule et se voit**
Parcours : cliquer l'en-tête « Appels » deux fois.
Assertions : le premier clic trie en décroissant, le second en croissant ;
l'ordre des lignes du tableau s'inverse effectivement (relever les noms avant et
après).
Échoue si : le tri est purement décoratif et l'ordre des lignes ne change pas.
Fichier : `e2e/chues-supervision.superviseur.spec.ts`.

**SUP-5 | P2 | l'export CSV produit un vrai fichier**
Parcours : cliquer le bouton de téléchargement du volet Activité.
Assertions : `download.suggestedFilename()` correspond à
`/^cpi-supervision-activite-\d{4}-\d{2}-\d{2}(_\d{4}-\d{2}-\d{2})?\.csv$/` ; le
fichier fait plus de 100 octets ; sa première ligne contient les mêmes intitulés
de colonne que le tableau.
Échoue si : le fichier téléchargé est une réponse JSON d'erreur renommée en
`.csv`, ou ses colonnes ont dérivé de celles de l'écran.
Fichier : `e2e/chues-supervision.superviseur.spec.ts`.

**SUP-6 | P2 | sans aucun compte de plateau, l'écran le dit**
Parcours : intercepter `GET /api/v1/supervision/activite**` et répondre un corps
valide avec `items: []` et `teleconseillers: []`.
Assertions : texte exact « Aucun compte téléconseiller. Créez-en un depuis les
comptes. ».
Échoue si : un tableau vide sans message laisse croire à un écran cassé.
Fichier : `e2e/chues-supervision.superviseur.spec.ts`.

**SUP-7 | P2 | le volet Comptes montre la présence**
Parcours : onglet « Comptes ».
Assertions : le texte « Présence et dernière activité des comptes. » est
visible ; les deux sections vides annoncent « Aucun compte téléconseiller. » et
« Aucun compte au pôle Banque & Finance. » si elles sont vides.
Échoue si : le volet est monté vide sans message d'état.
Fichier : `e2e/chues-supervision.superviseur.spec.ts`.

**SUP-8 | P1 | l'écran est refusé à un téléconseiller**
Parcours : session COMMERCIAL, `/chues/supervision`.
Assertions : « Accès refusé » et l'alerte contient « La supervision est réservé
à un autre rôle. » et « Téléconseiller ».
Échoue si : un téléconseiller lit l'activité nominative de ses collègues.
Fichier : `e2e/chues-supervision.commercial.spec.ts` (nouveau).
Déjà partiellement couvert : `roles.anon.spec.ts` balaie `/chues/supervision`
parmi les routes interdites. Ne pas dupliquer la boucle ; ce scénario y ajoute
le libellé de l'écran refusé.

---

### 5.8 `/chues/rappels` — Rappels promis

Composant : `components/rappels/rappels-view.tsx`.

**RAP-1 | P1 | les trois onglets et le compteur de retards**
Parcours : session COMMERCIAL, `/chues/rappels`.
Assertions : trois `tab` nommés « En retard », « Aujourd'hui »,
« Cette semaine » ; une région `role="status"` affiche un nombre suivi de
« rappel en retard » ou « rappels en retard » ; l'accord du pluriel est correct
pour le nombre affiché.
Échoue si : le compteur se lit « 1 rappels » ou « 2 rappel », ou la région n'est
pas annoncée.
Fichier : `e2e/chues-rappels.commercial.spec.ts` (nouveau).

**RAP-2 | P1 | un rappel promis apparaît dans « Cette semaine »**
Données : une fiche `E2E-CHUES-RAP` avec un rappel posé à J+1 via l'étape 1 ou
via `POST /api/v1/rep-campaigns/attempts`.
Parcours : `/chues/rappels`, onglet « Cette semaine ».
Assertions : une seule `row` contient le numéro de la fiche ; les colonnes
attendues sont « Prospect », « Échéance », « Retard », « Commentaire »,
« Téléconseiller » (ce dernier seulement pour un rôle qui peut filtrer), et une
colonne d'actions dont l'intitulé est masqué (`sr-only` « Actions »).
Échoue si : la file des rappels n'inclut pas les rappels du projet CHUES, ou la
colonne « Téléconseiller » apparaît pour un COMMERCIAL, qui ne doit voir que les
siens.
Fichier : `e2e/chues-rappels.commercial.spec.ts`.

**RAP-3 | P1 | un rappel à l'heure n'est pas marqué en retard**
Assertions : sur la ligne d'un rappel à venir, la cellule « Retard » affiche
exactement « Sans objet » et non un badge rouge.
Échoue si : `overdue` est calculé sur l'horloge du navigateur au lieu du
`serverTime` renvoyé, et un décalage de fuseau marque en retard un rappel
d'aujourd'hui.
Fichier : `e2e/chues-rappels.commercial.spec.ts`.

**RAP-4 | P1 | « Ouvrir dans la console » ouvre bien la fiche**
Parcours : cliquer « Ouvrir dans la console » sur une ligne.
Assertions attendues : l'URL contient `fiche=<id du prospect>` **et** l'écran
d'arrivée ouvre cette fiche (nom du prospect visible).
Échoue si : l'écran d'arrivée est le talon actuel « Rechercher une fiche », qui
ignore `?fiche=` : le seul chemin de la file des rappels vers la consignation
est alors rompu. **Ce scénario est attendu rouge aujourd'hui** (§1.4 point 2).
Fichier : `e2e/chues-rappels.commercial.spec.ts`.

**RAP-5 | P2 | « Annuler » retire le rappel et le dit**
Parcours : cliquer « Annuler » sur une ligne posée par ce spec.
Assertions : une notification « Rappel annulé. » apparaît ; la ligne disparaît
de l'onglet courant après invalidation, sans rechargement manuel.
Échoue si : l'annulation aboutit côté serveur mais la liste n'est pas
invalidée, et l'agent annule deux fois.
Fichier : `e2e/chues-rappels.commercial.spec.ts`.
Contrainte : n'annuler que les rappels posés par ce spec sur ses propres fiches.

**RAP-6 | P2 | l'état vide de chaque onglet a son propre texte**
Données : un compte sans aucun rappel, ou interception rendant `items: []`.
Assertions : onglet « En retard » → « Aucun rappel en retard » ; « Aujourd'hui »
→ « Aucun rappel aujourd'hui » ; « Cette semaine » → « Aucun rappel cette
semaine ».
Échoue si : les trois onglets partagent un état vide générique et l'agent ne
sait pas lequel il regarde.
Fichier : `e2e/chues-rappels.commercial.spec.ts`.

**RAP-7 | P2 | le filtre par téléconseiller n'existe que pour l'encadrement**
Parcours : session COMMERCIAL puis session SUPERVISEUR sur `/chues/rappels`.
Assertions : en COMMERCIAL, aucun champ nommé « Téléconseiller » et aucune
colonne « Téléconseiller » ; en SUPERVISEUR, le champ existe avec le texte de
remplacement « Tous les téléconseillers » et la colonne apparaît.
Échoue si : un téléconseiller peut filtrer sur ses collègues, ou l'encadrement
perd le filtre dont il vit.
Fichier : `e2e/chues-rappels.superviseur.spec.ts` (nouveau) et
`e2e/chues-rappels.commercial.spec.ts`.

**RAP-8 | P3 | la copie de l'état vide ne parle plus d'une touche qui n'existe plus**
Assertions : le texte de l'état vide de « Aujourd'hui » ne contient pas
« touche 5 » si l'étape 3 n'a plus de raccourci numéroté.
Échoue si : la copie promet un geste que l'écran ne propose plus.
Fichier : `e2e/chues-rappels.commercial.spec.ts`.
Note : à la lecture, ce texte dit encore « Une échéance se promet depuis la
console d'appel : touche 5, puis le chiffre de l'heure. ». **Attendu rouge**
jusqu'à la livraison du lot console.

---

### 5.9 `/chues/representants` — Liste

**REP-1 | P1 | la liste se rend avec sa recherche et son décompte**
Parcours : session COMMERCIAL, `/chues/representants`.
Assertions : `heading` niveau 1 « Représentants » ; un champ nommé
« Recherche » ; une région `role="status"` portant un décompte ou « Aucun
résultat ».
Échoue si : le décompte est absent et l'utilisateur ne sait pas si le filtre a
rendu zéro ligne ou si la page n'a pas chargé.
Fichier : `e2e/chues-representants.commercial.spec.ts` (nouveau).

**REP-2 | P1 | la recherche filtre par nom et par numéro**
Données : `E2E-CHUES-REP Mariama Sy`, `+221781004301`.
Parcours : saisir `E2E-CHUES-REP Mariama` puis `781004301`.
Assertions : dans les deux cas, une seule ligne contenant ce nom.
Échoue si : la recherche par chiffres n'atteint pas le téléphone normalisé.
Fichier : `e2e/chues-representants.commercial.spec.ts`.

**REP-3 | P2 | la cascade région / département**
Déjà couvert par `console.spec.ts` (« la cascade région resserre la liste des
départements »). **Ne pas réécrire.** Ce document ne demande ici que de vérifier
que la cascade est bien sur `/chues/representants` et non sur l'ancienne route
`/representants` : si `console.spec.ts` navigue encore vers `/representants`, il
passe par un renvoi. À signaler au mainteneur, pas à corriger.

**REP-4 | P2 | un filtre sans résultat le dit avec les bons mots**
Parcours : saisir `E2E-CHUES-REP-INTROUVABLE`.
Assertions : texte exact « Aucun représentant ne correspond à ces critères. »
(et non « Aucun représentant enregistré. », qui est réservé à la base vide).
Échoue si : les deux états vides sont confondus, et l'utilisateur croit la base
vide alors que son filtre est trop étroit.
Fichier : `e2e/chues-representants.commercial.spec.ts`.

**REP-5 | P2 | la pagination avance et recule**
Données : plus d'une page de représentants.
Parcours : cliquer le bouton nommé « Page suivante » puis « Page précédente ».
Assertions : le décompte `role="status"` change entre les deux pages ; le bouton
« Page précédente » est désactivé sur la première page.
Échoue si : les deux boutons restent actifs en butée et un clic sort de la
plage.
Fichier : `e2e/chues-representants.commercial.spec.ts`.

**REP-6 | P2 | un rôle en lecture seule ne voit aucun geste d'écriture**
Parcours : session SUPERVISEUR, `/chues/representants`.
Assertions : aucun bouton dont le nom commence par « Modifier la fiche de » ;
aucun bouton de création de représentant.
Échoue si : l'écran propose un geste que l'API refusera, ce qui est un défaut de
conception assumé comme tel dans le dépôt.
Fichier : `e2e/chues-representants.superviseur.spec.ts` (nouveau).

**REP-7 | P2 | l'export du registre produit un vrai classeur**
Parcours : session ADMIN, `/chues/representants`, déclencher l'export.
Assertions : le fichier téléchargé commence par la signature ZIP
`50 4B 03 04` et pèse plus de 1 000 octets.
Échoue si : un 502 relayé tel quel est enregistré sous une extension `.xlsx`.
Fichier : `e2e/chues-representants.spec.ts` (nouveau, projet ADMIN).

---

### 5.10 `/chues/representants/[id]` — Fiche

**REPD-1 | P1 | la fiche s'ouvre depuis la liste et porte son histoire**
Parcours : session COMMERCIAL, `/chues/representants`, cliquer le lien du nom
d'une fiche `E2E-CHUES-REP`.
Assertions : l'URL correspond à `/chues/representants/<uuid>` ; le texte
« Histoire de la relation » est visible.
Échoue si : le lien de la ligne pointe encore sur `/representants/<id>` et
n'arrive qu'après un renvoi, ou la fiche rend une coquille sans son historique.
Fichier : `e2e/chues-representants.commercial.spec.ts`.

**REPD-2 | P2 | une fiche sans prospect le dit**
Données : `E2E-CHUES-REP Sans Prospect`, sans aucune fiche rattachée.
Assertions : le texte « Aucune fiche remise pour l'instant. » est visible.
Échoue si : la section reste vide sans message et l'agent croit à un défaut de
chargement.
Fichier : `e2e/chues-representants.commercial.spec.ts`.

**REPD-3 | P2 | une relation jamais tranchée le dit aussi**
Assertions : le texte « Aucune bascule enregistrée. » est visible sur une fiche
en `INCONNU`.
Échoue si : l'historique vide se lit comme un historique perdu.
Fichier : `e2e/chues-representants.commercial.spec.ts`.

**REPD-4 | P2 | un identifiant inconnu rend une page introuvable, pas une erreur serveur**
Parcours : `/chues/representants/00000000-0000-7000-8000-000000000000`.
Assertions : la page « Page introuvable » est rendue, ou un état d'erreur
explicite ; aucune trace d'exception non rattrapée dans la console du navigateur
(`page.on('pageerror')` ne relève rien).
Échoue si : `unstable_rethrow` laisse passer une erreur de préchargement et la
route rend une page blanche.
Fichier : `e2e/chues-representants.commercial.spec.ts`.

**REPD-5 | P3 | la fiche tient sur 375 px**
Assertions : le nom, le numéro et la section « Histoire de la relation » sont
visibles sans défilement horizontal de la page.
Échoue si : la chronologie déborde à droite.
Fichier : `e2e/chues-representants.commercial.spec.ts`.

---

### 5.11 `/chues/representants/import` — Import Excel

**Déjà couvert par `e2e/representants-import.spec.ts` (trois parcours) :**
téléchargement du modèle, simulation puis application, redépôt sans doublon. Ne
réécrire aucun des trois.

**IMP-1 | P1 | l'écran est refusé à tout rôle autre qu'ADMIN**
Parcours : sessions COMMERCIAL, SUPERVISEUR, DIRECTION, BANQUE_FINANCE sur
`/chues/representants/import`.
Assertions : chacune rend « Accès refusé » ; l'alerte contient
« L'import de représentants est réservé à un autre rôle. » et le libellé du rôle
en cours (« Téléconseiller », « Supervision », « Direction »,
« Banque & Finance »).
Échoue si : la garde `guardRoles(['ADMIN'])` s'élargit et un superviseur écrit
en masse dans le registre.
Fichier : `e2e/chues-import.roles.spec.ts` (nouveau, un test par rôle).
Note : `roles.anon.spec.ts` couvre déjà le refus pour BANQUE_FINANCE et
COMMERCIAL. Ce scénario ajoute SUPERVISEUR et DIRECTION, non couverts.

**IMP-2 | P2 | un fichier qui n'est pas un classeur est refusé avec un motif**
Parcours : session ADMIN, déposer un fichier `.txt` renommé `.xlsx` contenant du
texte.
Assertions : un message d'erreur nommé apparaît ; le cadran « Lignes lues »
n'apparaît pas ; aucune fiche n'est créée.
Échoue si : le lecteur plante sans message, ou compte des lignes fantômes.
Fichier : `e2e/chues-import.spec.ts` (nouveau, projet ADMIN).

**IMP-3 | P2 | un classeur sans aucune ligne de données rend un rapport à zéro**
Parcours : déposer un classeur ne contenant que la ligne d'en-têtes et la ligne
d'exemple.
Assertions : « Lignes lues » vaut `0` ; le bouton d'application affiche
« Créer 0 représentant » et est désactivé.
Échoue si : le bouton disparaît et l'écran semble cassé, ou l'application part
sur zéro ligne.
Fichier : `e2e/chues-import.spec.ts`.

**IMP-4 | P2 | un nom avec caractères spéciaux survit à l'aller-retour**
Parcours : déposer un classeur avec `E2E-CHUES-IMP Ndèye Coumba N'Diaye-Sy`,
appliquer, puis chercher ce nom dans `/chues/representants`.
Assertions : la fiche trouvée porte exactement ce nom, apostrophe et accents
compris.
Échoue si : l'encodage du classeur ou la normalisation serveur ampute
l'apostrophe ou les accents.
Fichier : `e2e/chues-import.spec.ts`.

**IMP-5 | P3 | l'écran d'import tient sur 375 px**
Assertions : la zone de dépôt et le bouton « Télécharger le modèle Excel » sont
visibles sans défilement horizontal.
Échoue si : le tableau du rapport pousse la page.
Fichier : `e2e/chues-import.spec.ts`.

---

### 5.12 `/chues/prospects` — Liste

**Déjà couvert :** `prospects.spec.ts` (filtrage par statut, URL, rechargement,
export xlsx) et `workspaces.spec.ts` (filtres de conversion, double export,
colonnes de conversion). **Ne pas réécrire.**

**PRO-1 | P1 | l'écran est borné au projet CHUES**
Parcours : session COMMERCIAL, `/chues/prospects`, intercepter
`GET /api/v1/prospects**`.
Assertions : la requête porte `projet=CHUES` ; aucune fiche Grand Public
n'apparaît (vérifier par une fiche Grand Public connue, si l'environnement en a
une ; sinon, l'assertion porte sur le paramètre de requête seul).
Échoue si : la ligne `filters.projet = 'CHUES'` de la page saute et les deux
projets se mélangent dans une même liste.
Fichier : `e2e/chues-prospects.commercial.spec.ts` (nouveau).

**PRO-2 | P1 | un téléconseiller ne voit que son périmètre**
Données : une fiche `E2E-CHUES-PRO` créée par `fixture.awa`.
Parcours : session `fixture.fatou` (`chromium-commercial2`), chercher cette
fiche.
Assertions : la ligne n'apparaît pas ; le décompte affiche « Aucun résultat ».
Échoue si : `scope.ts` cesse de borner la liste et un téléconseiller lit le
portefeuille d'un collègue.
Fichier : `e2e/chues-prospects.commercial2.spec.ts` (nouveau).
Contrainte : ce scénario nécessite un état de session pour `fixture.fatou`
(§2.1). Si le mainteneur ne l'a pas encore posé, l'agent le déclare non écrit et
ne se connecte pas lui-même.

**PRO-3 | P2 | un rôle en lecture seule n'a ni fusion, ni réaffectation, ni suppression**
Parcours : session SUPERVISEUR, `/chues/prospects`.
Assertions : aucun bouton de fusion, de réaffectation ou de suppression n'est
rendu ; l'export reste proposé.
Échoue si : l'écran propose un geste que l'API refuse.
Fichier : `e2e/chues-prospects.superviseur.spec.ts` (nouveau).

**PRO-4 | P2 | une recherche sans résultat le dit et n'efface pas les filtres**
Parcours : filtrer sur un statut, puis chercher `E2E-CHUES-PRO-INTROUVABLE`.
Assertions : le décompte annonce zéro ; l'URL garde le paramètre de statut ; le
tableau n'affiche pas les lignes de la recherche précédente.
Échoue si : `keepPreviousData` laisse l'ancien tableau et l'utilisateur croit
que son filtre n'a rien changé.
Fichier : `e2e/chues-prospects.commercial.spec.ts`.

**PRO-5 | P2 | un caractère spécial dans la recherche ne casse pas l'URL**
Parcours : chercher `N'Diaye & Cie / 100 %`.
Assertions : l'URL porte la valeur encodée ; recharger la page restitue le même
terme dans le champ de recherche.
Échoue si : l'encodage est perdu et le rechargement rend une recherche
tronquée, ou l'application rend une erreur de routage.
Fichier : `e2e/chues-prospects.commercial.spec.ts`.

**PRO-6 | P2 | l'export suit le filtre affiché**
Parcours : filtrer sur `segment=BDD1`, exporter la vue filtrée, relever la
taille du fichier ; retirer le filtre, réexporter.
Assertions : les deux fichiers sont de vrais classeurs (signature ZIP) et leurs
tailles diffèrent.
Échoue si : l'export ignore les filtres et rend toujours la base entière, ce que
`prospects.spec.ts` ne prouve pas (il n'exporte qu'une seule fois).
Fichier : `e2e/chues-prospects.commercial.spec.ts`.

**PRO-7 | P2 | une grande volumétrie n'écroule pas l'écran**
Données : la base de développement avec au moins deux cents prospects CHUES.
Parcours : ouvrir `/chues/prospects?pageSize=100`.
Assertions : le tableau est rendu en moins du délai d'attente par défaut ; le
décompte est cohérent avec le nombre de lignes affichées.
Échoue si : la pagination est ignorée et le navigateur rend des milliers de
lignes.
Fichier : `e2e/chues-prospects.commercial.spec.ts`.

**PRO-8 | P3 | le tableau reste utilisable sur 375 px**
Assertions : le décompte et au moins la colonne du nom sont visibles ; le
défilement horizontal est confiné au tableau.
Échoue si : la page entière défile latéralement.
Fichier : `e2e/chues-prospects.commercial.spec.ts`.

---

### 5.13 `/chues/suggestions` — Contacts recommandés

**SUG-1 | P1 | l'écran explique d'où viennent les numéros**
Parcours : session COMMERCIAL, `/chues/suggestions`.
Assertions : texte exact « Numéros donnés par un représentant qui décline, pour
qu'un collègue soit appelé à sa place. » ; un groupe nommé
« Filtrer par statut » avec au moins le bouton « Tous ».
Échoue si : la phrase d'explication disparaît et l'écran devient une liste sans
contexte.
Fichier : `e2e/chues-suggestions.commercial.spec.ts` (nouveau).

**SUG-2 | P1 | une suggestion posée à l'étape 1 arrive ici**
Données : représentant `E2E-CHUES-SUG Refus`, `+221781004501` ; une tentative
`REFUSED` portant `suggestedPhone = 77 123 45 90` et
`suggestedName = E2E-CHUES-SUG Contact`.
Parcours : `/chues/suggestions`.
Assertions : une carte de la liste « Numéros suggérés » porte le numéro formaté
`+221 77 123 45 90` et le nom `E2E-CHUES-SUG Contact` ; elle mentionne
« Donné par le représentant » suivi du code court de la fiche source, et
« recueilli par » suivi du nom du compte qui a consigné.
Échoue si : la suggestion est perdue à l'envoi de la tentative, ou la provenance
n'est pas rendue et l'écran ne dit plus qui a proposé qui.
Fichier : `e2e/chues-suggestions.commercial.spec.ts`.

**SUG-3 | P2 | marquer appelé change le statut et le dit**
Parcours : sur la carte du spec, cliquer « Marquer appelé ».
Assertions : notification « Numéro marqué « Appelé ». » (libellé exact issu de
`SUGGESTION_STATUS_LABELS`, à relire dans `lib/data/suggestions.ts`) ; la carte
porte désormais le badge du nouveau statut ; les boutons « Marquer appelé » et
« Abandonner » ont disparu de cette carte.
Échoue si : le statut est écrit côté serveur mais la liste n'est pas invalidée
et l'agent rejoue le geste.
Fichier : `e2e/chues-suggestions.commercial.spec.ts`.

**SUG-4 | P2 | chaque filtre a son propre état vide**
Parcours : choisir un statut sans aucune suggestion.
Assertions : texte `Aucun numéro « <libellé du statut> ».` et la phrase
« Retirez le filtre pour voir les autres numéros. » ; sans filtre et sans
donnée, le texte est « Aucun numéro suggéré pour l'instant. » avec la phrase
d'explication qui nomme la console d'appel et le mobile.
Échoue si : les deux états vides sont confondus.
Fichier : `e2e/chues-suggestions.commercial.spec.ts`.

**SUG-5 | P2 | « Créer la fiche » pré-remplit avec le numéro suggéré**
Parcours : cliquer « Créer la fiche » sur la carte du spec.
Assertions : le dialogue de fiche représentant s'ouvre avec le nom et le numéro
de la suggestion déjà saisis. **Ne pas confirmer la création** (une fiche
créée ici sortirait du préfixe du spec si elle prend le nom de la suggestion :
n'utiliser que des suggestions dont le nom porte déjà `E2E-CHUES-SUG`).
Échoue si : le pré-remplissage est perdu, ce qui oblige à recopier le numéro à
la main.
Fichier : `e2e/chues-suggestions.commercial.spec.ts`.

**SUG-6 | P2 | un rôle en lecture seule ne voit aucun geste**
Parcours : session SUPERVISEUR ou DIRECTION.
Assertions : aucun bouton « Marquer appelé », « Abandonner » ni « Créer la
fiche » ; les cartes restent lisibles.
Échoue si : `readsOnly` cesse d'être appliqué et l'écran propose un geste refusé
par l'API.
Fichier : `e2e/chues-suggestions.superviseur.spec.ts` (nouveau).

---

### 5.14 `/chues/dossiers` — Liste bancaire

**Déjà couvert par `workspaces.spec.ts` :** « la liste, les vues rapides et
l'export des dossiers » (filtres `stageType=CASHED` et `REJECTED`, export
xlsx). **Ne pas réécrire ces trois points.**

**DOS-1 | P1 | l'écran est refusé à un téléconseiller et à la supervision**
Parcours : sessions COMMERCIAL puis SUPERVISEUR sur `/chues/dossiers`.
Assertions : « Accès refusé » et l'alerte contient « Le suivi des dossiers
bancaires est réservé à un autre rôle. ».
Échoue si : la garde `['ADMIN', 'BANQUE_FINANCE']` s'élargit et un téléconseiller
lit les montants encaissés.
Fichier : `e2e/chues-dossiers.roles.spec.ts` (nouveau).
Note : `roles.anon.spec.ts` couvre déjà le refus au COMMERCIAL. Ce scénario y
ajoute SUPERVISEUR et DIRECTION.

**DOS-2 | P1 | un agent bancaire voit la liste**
Parcours : session BANQUE_FINANCE, `/chues/dossiers`.
Assertions : `heading` niveau 1 « Dossiers bancaires » ; une région
`role="status"` portant « Dossiers affichés » ou « Aucun résultat ».
Échoue si : le rôle propriétaire de l'écran s'en voit refuser l'accès.
Fichier : `e2e/chues-dossiers.banque.spec.ts` (nouveau).

**DOS-3 | P2 | les deux états vides sont distincts**
Parcours : filtrer sur un critère sans résultat.
Assertions : texte « Aucun dossier ne correspond à ces filtres » (et non
« Aucun dossier bancaire », réservé à la liste totalement vide).
Échoue si : les deux se confondent.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOS-4 | P2 | les vues rapides vivent dans l'URL et survivent au rechargement**
Parcours : cliquer « Encaissés » puis recharger.
Assertions : l'URL porte `stageType=CASHED` avant et après le rechargement ; le
décompte est identique.
Échoue si : la vue rapide n'est qu'un état local et le lien partagé n'ouvre pas
la même liste. Le parcours existant vérifie l'URL mais **pas** le rechargement.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOS-5 | P2 | la pagination**
Parcours : « Page suivante » puis « Page précédente ».
Assertions : le décompte change ; « Page précédente » est désactivé en première
page.
Échoue si : la butée n'est pas gardée.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOS-6 | P3 | la liste tient sur 375 px**
Assertions : le décompte et la référence du premier dossier sont visibles sans
défilement horizontal de la page.
Échoue si : le tableau pousse la page.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

---

### 5.15 `/chues/dossiers/nouveau` — Ouverture

**Déjà couvert par `workspaces.spec.ts` :** la recherche de client, le résumé
compact, l'ouverture, et la référence dupliquée signalée au flou avec lien.
**Ne pas réécrire.**

**DOSN-1 | P1 | seules les fiches « méthode obtenue » sont proposées**
Données : un prospect `E2E-CHUES-PRO` en statut `PENDING`.
Parcours : session BANQUE_FINANCE, `/chues/dossiers/nouveau`, chercher ce
prospect par son numéro.
Assertions : le texte « Aucun client ne correspond. » est visible ; aucun bouton
de résultat portant le numéro cherché.
Échoue si : le filtre de statut saute et un dossier s'ouvre sur une fiche qui
n'a pas encore adhéré, ce qui ne se découvre qu'à l'encaissement.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSN-2 | P1 | l'ouverture exige une référence bancaire**
Parcours : choisir un client éligible, laisser « Référence bancaire » vide,
cliquer « Ouvrir le dossier ».
Assertions : le dossier n'est pas créé (l'URL reste `/chues/dossiers/nouveau`) ;
un message nomme le champ manquant.
Échoue si : un dossier sans référence atteint la base et devient introuvable
pour la banque.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSN-3 | P2 | la recherche par nom et par numéro donne le même client**
Parcours : chercher le client éligible par son numéro `+221781001000` puis par
son nom.
Assertions : les deux recherches proposent la même fiche (même texte de
résultat).
Échoue si : la répartition nom/téléphone selon la proportion de chiffres du
terme est cassée, piège déjà rencontré et documenté dans `workspaces.spec.ts`.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSN-4 | P2 | le contrôle de doublon part au FLOU, pas à la frappe**
Parcours : saisir une référence existante caractère par caractère, sans quitter
le champ.
Assertions : aucune alerte « existe déjà » tant que le champ garde le focus ;
elle apparaît après `blur`.
Échoue si : le contrôle part à chaque frappe et sature l'API (300 requêtes par
minute).
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSN-5 | P2 | un caractère spécial dans la référence est accepté ou refusé, jamais ignoré**
Parcours : saisir `E2E-CHUES-DOS/2026-#1`.
Assertions : soit le dossier est créé et la référence est rendue à l'identique
sur le détail, soit un message nomme le caractère refusé.
Échoue si : la référence est tronquée en silence et la banque ne retrouve pas
son dossier.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

---

### 5.16 `/chues/dossiers/[id]` — Détail

**Déjà couvert par `workspaces.spec.ts` :** cycle jusqu'à l'encaissement (montant
verrouillé, aperçu FCFA, étape terminale, historique), rejet avec motif, motif
« Autre » exigeant une précision. **Ne pas réécrire.**

**DOSD-1 | P1 | un montant à zéro est refusé**
Parcours : dossier ouvert par ce spec, « Déclarer l'encaissement », saisir `0`.
Assertions : le bouton « Confirmer l'encaissement » reste désactivé.
Échoue si : un encaissement à zéro est accepté et fausse la recette.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSD-2 | P1 | un montant non numérique est refusé**
Parcours : saisir `abc` puis `-5000` dans « Montant encaissé ».
Assertions : le bouton de confirmation reste désactivé dans les deux cas.
Échoue si : un montant négatif atteint la base.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSD-3 | P2 | un très gros montant reste lisible**
Parcours : saisir `999999999999`.
Assertions : l'aperçu `role="status"` affiche le montant groupé et l'unité
« FCFA » ; il ne déborde pas de la boîte de dialogue à 375 px.
Échoue si : le regroupement des milliers est perdu et « 12000000 » se confond
avec « 1200000 », défaut que l'aperçu existe précisément pour éviter.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSD-4 | P1 | un dossier encaissé ne propose plus aucun geste**
Parcours : dossier mené jusqu'à l'encaissement.
Assertions : « Étape terminale » visible ; les boutons « Rejeter le dossier »,
« Déclarer l'encaissement » et tout bouton commençant par « Passer à » ont un
compte de 0.
Échoue si : le verrou saute et un dossier terminal est rouvert, ce qui fausse
l'historique.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSD-5 | P2 | un rechargement rend le même état**
Parcours : après une transition, `page.reload()`.
Assertions : l'étape courante affichée est la même ; l'historique porte le même
nombre d'entrées.
Échoue si : l'état n'est qu'en mémoire et un rechargement rend un dossier à
l'étape précédente.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSD-6 | P2 | un identifiant inconnu ne rend pas une page blanche**
Parcours : `/chues/dossiers/00000000-0000-7000-8000-000000000000`.
Assertions : page « Page introuvable » ou état d'erreur nommé ; aucun
`pageerror`.
Échoue si : le préchargement lève une erreur non rattrapée.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSD-7 | P2 | une transition concurrente est refusée proprement**
Parcours : ouvrir le même dossier dans deux onglets du **même** contexte,
avancer d'une étape dans l'onglet A, puis avancer dans l'onglet B qui affiche
encore l'ancienne étape.
Assertions : l'onglet B rend un message d'erreur nommé et ne saute pas deux
étapes ; après rechargement, le dossier est à l'étape suivant A d'un seul cran.
Échoue si : la concurrence fait sauter deux étapes ou écrase la première
transition.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

---

### 5.17 `/chues/dossiers/etapes` — Configuration du flux

**Déjà couvert par `workspaces.spec.ts` :** présence des boutons nommés
« Monter « … » » et « Descendre « … » », étape initiale non déplaçable, étapes
système « Non modifiable ». **Ne pas réécrire.**

**DOSE-1 | P1 | le réordonnancement est réellement possible au clavier seul**
Parcours : session ADMIN, `/chues/dossiers/etapes` ; atteindre par `Tab` le
bouton « Descendre « … » » d'une étape modifiable, l'actionner par `Entrée`.
Assertions : l'ordre des éléments de liste change ; l'étape déplacée porte le
focus après le geste (sans quoi le clavier se perd).
Échoue si : le geste n'existe qu'à la souris, ou le focus est renvoyé en tête de
liste et l'utilisateur au clavier doit tout retraverser à chaque déplacement.
Fichier : `e2e/chues-dossiers-etapes.spec.ts` (nouveau, projet ADMIN).
Contrainte : le scénario **remet l'ordre initial** par le geste inverse avant de
finir. Le référentiel des étapes est partagé.

**DOSE-2 | P1 | l'écran est refusé à un agent bancaire**
Parcours : session BANQUE_FINANCE.
Assertions : « Accès refusé » et l'alerte contient « La configuration du flux
bancaire est réservé à un autre rôle. ».
Échoue si : une banque réordonne le flux de toutes les banques.
Fichier : `e2e/chues-dossiers.roles.spec.ts`.

**DOSE-3 | P2 | la butée haute et la butée basse sont gardées**
Assertions : le bouton « Monter » de la première étape modifiable est désactivé
et le bouton « Descendre » de la dernière l'est aussi.
Échoue si : le clic en butée envoie une requête que l'API refuse.
Fichier : `e2e/chues-dossiers-etapes.spec.ts`.

**DOSE-4 | P3 | l'écran tient sur 375 px**
Assertions : les boutons de déplacement restent atteignables au pouce (taille
minimale 44 px de haut).
Échoue si : les boutons se chevauchent sur petit écran.
Fichier : `e2e/chues-dossiers-etapes.spec.ts`.

---

### 5.18 `/chues/dossiers/export` — Export des dossiers

**DOSX-1 | P1 | l'export produit un vrai classeur**
Parcours : session BANQUE_FINANCE, `/chues/dossiers/export`, déclencher
l'export.
Assertions : le fichier commence par `50 4B 03 04` et pèse plus de 1 000 octets ;
le nom du fichier est daté.
Échoue si : un JSON d'erreur est relayé sous l'extension `.xlsx`.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSX-2 | P2 | l'écran annonce le périmètre de l'export**
Parcours : sans aucun filtre.
Assertions : texte exact « Aucun filtre : tous les dossiers. ».
Échoue si : l'utilisateur exporte la base entière en croyant exporter sa vue.
Fichier : `e2e/chues-dossiers.banque.spec.ts`.

**DOSX-3 | P2 | l'écran est refusé à un téléconseiller**
Parcours : session COMMERCIAL.
Assertions : « Accès refusé » et « L'export des dossiers bancaires est réservé à
un autre rôle. ».
Échoue si : la garde s'élargit.
Fichier : `e2e/chues-dossiers.roles.spec.ts`.

---

### 5.19 `/chues/banque` — Tableau de bord bancaire

**Déjà couvert par `workspaces.spec.ts` :** présence de « Taux de rejet »,
« Délai moyen », « Dossiers par étape », montants en FCFA, sous session ADMIN.
**Ne pas réécrire.**

**BQ-1 | P1 | un agent bancaire y atterrit et le titre du document le confirme**
Parcours : session BANQUE_FINANCE, `/chues/banque`.
Assertions : le titre du document correspond à `/Tableau de bord bancaire/` ;
« Taux de rejet » et « Délai moyen » sont visibles ; aucun état d'erreur.
Échoue si : l'écran d'atterrissage du rôle rend un refus ou une coquille vide,
ce que le seul titre de niveau 1 (dérivé de la route) ne prouverait pas.
Fichier : `e2e/chues-banque.banque.spec.ts` (nouveau).

**BQ-2 | P2 | chaque graphique a son état vide nommé**
Parcours : filtrer sur une période sans dossier.
Assertions : les messages exacts « Aucun dossier rejeté sur la période
filtrée. », « Aucune activité d'agent sur la période filtrée. »,
« Aucun dossier clos. » apparaissent selon le graphique.
Échoue si : un graphique vide se rend comme un canevas blanc et se lit comme une
panne.
Fichier : `e2e/chues-banque.banque.spec.ts`.

**BQ-3 | P2 | un montant nul se lit « 0 FCFA », jamais vide**
Assertions : la tuile de montant affiche « 0 FCFA » et non une chaîne vide.
Échoue si : le repli de `MoneyText` est retiré.
Fichier : `e2e/chues-banque.banque.spec.ts`.

**BQ-4 | P2 | l'écran est refusé à un téléconseiller et à la supervision**
Parcours : sessions COMMERCIAL et SUPERVISEUR.
Assertions : « Accès refusé » et « Le tableau de bord bancaire est réservé à un
autre rôle. ».
Échoue si : la garde `['ADMIN', 'BANQUE_FINANCE']` s'élargit.
Fichier : `e2e/chues-dossiers.roles.spec.ts`.

**BQ-5 | P3 | l'écran tient sur 375 px**
Assertions : les trois indicateurs de tête sont visibles ; aucun défilement
horizontal de la page.
Échoue si : la grille de graphiques déborde.
Fichier : `e2e/chues-banque.banque.spec.ts`.

---

### 5.20 `/chues/demandes-clients` — Demandes de création de client

**Déjà couvert par `workspaces.spec.ts` :** le parcours complet dépôt bancaire →
arbitrage administrateur → prospect créé avec provenance → retour côté banque.
**Ne pas réécrire ce parcours.**

**DMC-1 | P1 | les deux rôles voient deux titres différents**
Parcours : session BANQUE_FINANCE puis session ADMIN sur
`/chues/demandes-clients`.
Assertions : en BANQUE_FINANCE, `heading` niveau 1 « Mes demandes de
création » ; en ADMIN, « Créations de client à valider ».
Échoue si : les deux rôles partagent un titre et l'agent bancaire croit pouvoir
arbitrer.
Fichier : `e2e/chues-demandes.banque.spec.ts` et `e2e/chues-demandes.spec.ts`
(nouveaux).

**DMC-2 | P1 | l'écran est refusé à un téléconseiller et à la supervision**
Parcours : sessions COMMERCIAL, SUPERVISEUR, DIRECTION.
Assertions : « Accès refusé » et « Le suivi des demandes de création est réservé
à un autre rôle. ».
Échoue si : la garde `['ADMIN', 'BANQUE_FINANCE']` s'élargit.
Fichier : `e2e/chues-dossiers.roles.spec.ts`.

**DMC-3 | P1 | le dépôt refuse une demande incomplète**
Parcours : session BANQUE_FINANCE, `/chues/dossiers/nouveau`, chercher un nom
inconnu, « Demander la création du client », laisser le téléphone vide.
Assertions : le bouton « Envoyer la demande » est désactivé, ou l'envoi rend un
message nommant le champ manquant ; aucune demande n'apparaît ensuite dans
« Mes demandes de création ».
Échoue si : une demande sans numéro atteint l'arbitrage et l'administration ne
peut rien en faire.
Fichier : `e2e/chues-demandes.banque.spec.ts`.

**DMC-4 | P2 | le refus d'une demande est motivé et visible des deux côtés**
Données : une demande `E2E-CHUES-DMC` déposée par ce spec.
Parcours : session ADMIN, refuser la demande avec un motif ; puis en session
BANQUE_FINANCE, ouvrir « Mes demandes de création », onglet des refusées.
Assertions : la carte porte le motif saisi ; l'agent bancaire ne voit aucun
bouton d'arbitrage.
Échoue si : le motif n'est pas transmis et la banque redépose la même demande.
Fichier : `e2e/chues-demandes.banque.spec.ts` (deux contextes, aucune connexion
supplémentaire).

**DMC-5 | P2 | l'état vide de chaque filtre**
Assertions : sans aucune demande, « Aucune demande en attente » ; avec un filtre
sans résultat, « Aucune demande ne correspond à ces filtres ».
Échoue si : les deux se confondent.
Fichier : `e2e/chues-demandes.spec.ts`.

**DMC-6 | P2 | la pagination et le décompte**
Assertions : la région `role="status"` porte le texte masqué
« Demandes affichées : » suivi d'un nombre ; les boutons « Page précédente » et
« Page suivante » sont gardés en butée.
Échoue si : le décompte est absent et l'utilisateur ne sait pas s'il voit tout.
Fichier : `e2e/chues-demandes.spec.ts`.

---

### 5.21 `/chues/campagnes` et `/chues/campagnes/[id]` — Lots d'export (**cible mouvante**)

L'écran est en cours de remplacement. Les composants actuels
(`components/lots-export/*`) sont provisoires. `Plan.md` §4.2.4 décrit la cible.
**Tous les scénarios de cette section sont à écrire une fois le lot web livré**,
sauf LOT-1 et LOT-2, écrivables aujourd'hui pour verrouiller ce qui existe.

**LOT-1 | P1 | la route rend la liste des lots et non l'ancien écran de campagnes**
Parcours : session ADMIN, `/chues/campagnes`.
Assertions : `heading` niveau 1 « Lots d'export » ; sous-titre
« Fiches figées pour Excel, impression ou terrain. » ; aucun texte
« Distribuer les appels aux téléconseillers », « Répartition en tourniquet » ni
« Lancer la campagne ».
Échoue si : la migration est partiellement déployée et l'ancien écran revient
sur une route, ou l'entrée de menu « Lots d'export » mène encore à une campagne.
Fichier : `e2e/chues-lots-export.spec.ts` (nouveau, projet ADMIN).
**Cible mouvante : à réécrire une fois le lot web livré.**

**LOT-2 | P1 | l'écran est refusé à un téléconseiller et à un agent bancaire**
Parcours : sessions COMMERCIAL et BANQUE_FINANCE.
Assertions attendues : refus lisible.
Attention : la page actuelle fait `redirect('/chues')` au lieu de rendre
`PermissionDenied`. Assertion à écrire : l'URL finale est `/chues` pour un
COMMERCIAL, et `/chues/banque` pour un agent bancaire (double renvoi).
Échoue si : un rôle non autorisé atteint la liste des lots, ou si le renvoi
boucle.
Fichier : `e2e/chues-lots-export.roles.spec.ts` (nouveau).
**Cible mouvante.**

**LOT-3 | P1 | la création annonce le nombre de fiches AVANT de créer**
Cible `Plan.md` : « 340 fiches seront exportées », donné par
`GET /api/v1/lots-export/apercu`, jamais estimé localement.
Échoue si : l'aperçu est calculé côté client et diverge du tirage réel, ou le
lot est créé sans que l'utilisateur ait vu ce qu'il fige.
Fichier : `e2e/chues-lots-export.spec.ts`. **Cible mouvante.**

**LOT-4 | P1 | un nom de moins de trois caractères est refusé**
Cible : nom du lot, trois caractères minimum.
Échoue si : un lot sans nom utilisable est créé et devient introuvable.
Fichier : `e2e/chues-lots-export.spec.ts`. **Cible mouvante.**

**LOT-5 | P1 | le classeur Excel du lot est un vrai classeur**
Cible : `GET /api/v1/lots-export/{id}/export.xlsx`. Assertion : signature ZIP
`50 4B 03 04`, taille supérieure à 1 000 octets, nom de fichier daté.
Échoue si : un JSON d'erreur est relayé sous l'extension `.xlsx`, seul défaut
que la taille et le nom ne révèlent pas.
Fichier : `e2e/chues-lots-export.spec.ts`. **Cible mouvante.**
Note : aujourd'hui, le lien porte `href` et non un bouton de téléchargement ;
l'assertion `waitForEvent('download')` peut ne pas se déclencher si le serveur
ne pose pas `Content-Disposition`. À vérifier au navigateur (§6, question 5).

**LOT-6 | P1 | l'archive ZIP des fiches PDF est une vraie archive**
Cible : `GET /api/v1/lots-export/{id}/fiches.zip`. Assertion : signature ZIP ;
plus d'un fichier à l'intérieur si le lot compte plus d'une fiche.
Échoue si : l'archive est vide, ou contient un seul PDF pour un lot de 340
fiches.
Fichier : `e2e/chues-lots-export.spec.ts`. **Cible mouvante.**

**LOT-7 | P2 | une fiche PDF isolée est un vrai PDF**
Cible : `GET /api/v1/lots-export/{id}/fiches/{itemId}.pdf`. Assertion : les
quatre premiers octets valent `%PDF`.
Échoue si : la route rend du HTML d'erreur.
Fichier : `e2e/chues-lots-export.spec.ts`. **Cible mouvante.**

**LOT-8 | P2 | le suivi admin compte les appels postérieurs à la création**
Cible : « 128 appels sur 340 fiches » ; un appel antérieur à la création ou
portant sur une fiche hors lot ne compte pas.
Données à poser : créer le lot, puis consigner un appel sur une fiche du lot,
puis relire le détail.
Échoue si : `callsSince` compte tous les appels de la base, ce qui rend le
chiffre inutile.
Fichier : `e2e/chues-lots-export.spec.ts`. **Cible mouvante.**

**LOT-9 | P2 | le lot est FIGÉ : une fiche créée après lui n'y entre pas**
Données : créer un lot sur un périmètre, puis créer une fiche
`E2E-CHUES-LOT` dans ce périmètre, puis rouvrir le détail.
Assertions : `itemCount` est inchangé ; la nouvelle fiche n'est pas dans le
classeur exporté.
Échoue si : le lot est recalculé à chaque lecture et le terrain reçoit un
document différent de celui qu'on lui avait annoncé.
Fichier : `e2e/chues-lots-export.spec.ts`. **Cible mouvante.**

---

### 5.22 Transverse

**TRV-1 | P1 | le jeton de session reste hors de portée du JavaScript sur un écran CHUES**
Parcours : session COMMERCIAL, `/chues`.
Assertions : `document.cookie` ne contient ni `cpi_at` ni `cpi_rt` ; les deux
cookies existent dans le contexte avec `httpOnly: true`.
Échoue si : le relais cesse de poser des cookies `httpOnly` et une XSS repart
avec la base de prospects.
Fichier : `e2e/chues-hub.commercial.spec.ts`.
Note : `prospects.spec.ts` le vérifie déjà sur `/tableau-de-bord` en ADMIN. Ce
scénario le refait sur une session COMMERCIAL, jamais couverte.

**TRV-2 | P1 | tous les écrans CHUES d'un ADMIN se chargent sans état d'erreur**
Parcours : balayage des routes de §1.1 accessibles à un ADMIN.
Assertions : pour chaque route, le repère propre à l'écran est visible et aucun
`heading` parmi « Serveur injoignable », « Chargement impossible », « Le serveur
CPI a rencontré une erreur », « Accès refusé » n'est rendu.
Échoue si : une route rend une coquille de layout au-dessus d'une page qui n'a
rien rendu (le titre de niveau 1 vient de la barre supérieure et ne le
prouverait pas).
Fichier : `e2e/prospects.spec.ts`, parcours existant « chaque écran du panel se
charge sans état d'erreur », **à faire mettre à jour par le mainteneur** : sa
table contient encore `/console` → « Appeler les prospects » et
`/campagnes` → « Campagnes », deux titres qui n'existent plus. Aucun agent ne le
modifie de sa propre initiative.

**TRV-3 | P1 | le refus nomme le rôle en cours et propose une sortie**
Parcours : pour chaque couple (rôle, route interdite) de §1.1.
Assertions : `heading` niveau 2 « Accès refusé » ; l'alerte contient le libellé
du rôle (« Téléconseiller », « Supervision », « Direction »,
« Banque & Finance », « Accueil ») ; le lien « Retour à l'accueil » porte
`href="/espaces"`.
Échoue si : le refus est anonyme et l'utilisateur ne sait pas quoi demander à
son administrateur.
Fichier : réparti dans les fichiers `*.roles.spec.ts` de chaque section.

**TRV-4 | P2 | hors ligne, l'écran le dit au lieu de rester figé**
Parcours : ouvrir `/chues/statistiques` en SUPERVISEUR, puis
`context.setOffline(true)`, puis déclencher un rafraîchissement (changer de
période).
Assertions : un `heading` « Serveur injoignable » apparaît avec un bouton
« Réessayer » ; rétablir le réseau et cliquer « Réessayer » ramène les cartes.
Échoue si : l'écran garde silencieusement les données périmées et le superviseur
prend une décision sur des chiffres d'il y a une heure.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

**TRV-5 | P2 | une API en 429 ne se lit pas comme une erreur de données**
Parcours : intercepter une requête d'écran CHUES et répondre 429.
Assertions : un état d'erreur distinct est rendu, avec un bouton « Réessayer » ;
l'écran ne rejoue pas la requête en boucle (compter les requêtes pendant cinq
secondes de condition, sans attente fixe).
Échoue si : un `refetchInterval` continue de marteler l'API déjà limitée.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

**TRV-6 | P2 | la navigation d'un téléconseiller nomme les trois étapes telles qu'elles s'appellent**
Parcours : session COMMERCIAL, `/chues`.
Assertions : dans la navigation nommée « Navigation principale », les liens
exacts « Mon travail », « Qualifier un représentant », « Ajouter un prospect »,
« Convertir un prospect », « Rappels promis » sont visibles ; « Tableau de
bord », « Lots d'export », « Mon équipe » ont un compte de 0.
Échoue si : la navigation et les écrans divergent, comme aujourd'hui entre
`nav-items.ts` et `roles.anon.spec.ts` (§1.4 point 4).
Fichier : `e2e/chues-hub.commercial.spec.ts`.
Note : `roles.anon.spec.ts` couvre déjà ce point mais avec les **anciens**
libellés. Signaler l'écart, ne pas modifier ce fichier.

**TRV-7 | P2 | la navigation de l'encadrement ouvre sur les chiffres**
Parcours : session SUPERVISEUR, ouvrir la coque CHUES depuis `/espaces`.
Assertions : l'URL atteinte est `/chues/statistiques` ; les liens « Tableau de
bord », « Mon équipe », « Lots d'export » sont présents.
Échoue si : l'encadrement atterrit sur l'écran des trois étapes et doit
chercher ses chiffres.
Fichier : `e2e/chues-chiffres.superviseur.spec.ts`.

**TRV-8 | P3 | aucune violation axe sur les écrans CHUES nouvellement couverts**
Parcours : `/chues/appels-representants` en session COMMERCIAL sur une fiche
ouverte à l'étape 2 ; `/chues/statistiques` en mode composition.
Assertions : `AxeBuilder().analyze()` ne rend aucune violation.
Échoue si : les poignées de glisser-déposer du mode composition posent des
attributs `aria-*` invalides, source classique de violations, non couverte par
`accessibility.spec.ts` qui n'analyse que le mode « Organiser » du tableau de
bord des visites.
Fichier : `e2e/chues-accessibilite.spec.ts` (nouveau).
Contrainte : ne pas rebalayer les vingt-six routes déjà analysées par
`accessibility.spec.ts`.

---

## 6. Ce que la lecture n'a pas permis de trancher

Chaque point ci-dessous est une **question précise à vérifier dans le
navigateur** avant d'écrire l'assertion correspondante. L'agent qui la tranche
rapporte la réponse observée ; il ne devine pas.

1. **Un taux s'affiche-t-il avec son signe pourcent ?**
   `renderMark` passe `detail={marque === 'tuile' ? undefined : libelle}` et
   `TuileWidget` rend `formatNumber(valeur)`. Les trois cartes de taux ont
   `tuile` pour marque d'usine. À l'écran, « Représentants joints » devrait donc
   afficher `50` sans « % » et sans la phrase « 50,0 % des appels aboutissent »,
   qui n'existerait qu'en `sr-only`.
   **Question exacte** : sur `/chues/statistiques`, la carte « Représentants
   joints » affiche-t-elle « 50 », « 50 % » ou « 50,0 % » ? La phrase
   « des appels aboutissent » est-elle visible à l'œil ou seulement pour un
   lecteur d'écran ?

2. **Un dénominateur vide se lit-il « Sans objet » ou « 0 » ?**
   `scalaireTaux` fait `valeur ?? 0` : le `null` du serveur devient `0` dans la
   tuile, alors que le libellé produit par `taux(null)` vaut « Sans objet ».
   **Question exacte** : sur une période sans aucun appel, la carte
   « Représentants joints » affiche-t-elle « 0 », ou une mention « Sans objet » ?

3. **La carte « Reste à appeler » montre-t-elle un reste ?**
   Son extraction lit `activite.totals.calls` avec la légende « appels
   consignés sur la période ». Le titre et la donnée ne parlent pas de la même
   chose.
   **Question exacte** : la carte titrée « Reste à appeler » affiche-t-elle le
   nombre d'appels déjà consignés ? Si oui, l'écart titre/donnée est un défaut à
   rapporter, et `Plan.md` prévoit de supprimer la carte (D3).

4. **Combien de titres de niveau 1 sur `/chues/console` ?**
   La barre supérieure dérive un `h1` de la route (« Convertir un prospect » par
   `navTitle`) et `ConsoleView` rend son propre `h1` « Rechercher une fiche ».
   **Question exacte** : la page porte-t-elle deux `h1` distincts ? Si oui, quel
   est celui que `getByRole('heading', { level: 1 })` trouve en premier ?

5. **Les liens de téléchargement des lots déclenchent-ils un `download` ?**
   `lots-export-view.tsx` rend des `<a href="/api/v1/lots-export/{id}/export.xlsx">`
   sans attribut `download`, contrairement aux exports existants qui passent par
   `useFileDownload`.
   **Question exacte** : cliquer « Excel » sur un lot déclenche-t-il un
   événement `download` Playwright, ou une navigation ? Le serveur pose-t-il un
   en-tête `Content-Disposition: attachment` ?

6. **Le `<select>` brut « Cible » de la création de lot a-t-il un nom accessible ?**
   Il est enveloppé dans un `<label>` sans `htmlFor` ni `aria-label`.
   **Question exacte** : `getByRole('combobox', { name: 'Cible' })` le trouve-t-il,
   ou faut-il passer par `getByLabel` ? Un audit axe sur cet écran remonte-t-il
   une violation ?

7. **Quel est le libellé exact de la période dans la supervision ?**
   `PERIOD_LABELS` vit dans `lib/data/admin.ts` et n'a pas été relu.
   **Question exacte** : les trois pastilles s'appellent-elles « Aujourd'hui »,
   « Cette semaine », « 7 derniers jours », et la quatrième
   « Période personnalisée » ?

8. **Les libellés de statut des suggestions.**
   `SUGGESTION_STATUS_LABELS` vit dans `lib/data/suggestions.ts`, non relu.
   **Question exacte** : `A_APPELER`, `APPELE` et `ABANDONNE` s'affichent-ils
   « À appeler », « Appelé », « Abandonné » ?

9. **La liste des rappels de l'encadrement filtre-t-elle sur les seuls COMMERCIAL ?**
   `rappels-view.tsx` demande `fetchUsers({ role: 'COMMERCIAL' })`, alors que
   `/chues/statistiques` inclut désormais SUPERVISEUR et DIRECTION dans le
   plateau.
   **Question exacte** : un rappel promis par un superviseur apparaît-il dans la
   file, et son auteur figure-t-il dans le filtre « Téléconseiller » ? Si non,
   les deux écrans donnent deux définitions différentes du plateau.

10. **La date de la journée d'observation `2026-02-03` est-elle libre ?**
    Le jeu de démonstration et les fixtures existantes posent des tentatives
    dont la date d'acte n'a pas été inventoriée.
    **Question exacte** : sur une base amorcée, `GET /api/v1/supervision/activite`
    avec `actFrom=2026-02-03T00:00:00.000Z` et `actTo=2026-02-03T23:59:59.999Z`
    rend-il des totaux nuls avant que ce spec ne pose ses données ? Si non,
    choisir une autre journée et la fixer dans le spec.

11. **Le montant d'encaissement accepte-t-il zéro et le négatif ?**
    `workspaces.spec.ts` vérifie seulement le verrou sur champ vide.
    **Question exacte** : « 0 » et « -5000 » laissent-ils le bouton
    « Confirmer l'encaissement » désactivé ?

12. **La transition concurrente de dossier est-elle gardée ?**
    Aucune trace d'un jeton de version dans le détail lu.
    **Question exacte** : deux onglets qui avancent le même dossier produisent
    quel résultat : deux transitions, un refus nommé, ou un saut d'étape ?

---

## 7. Récapitulatif chiffré

### 7.1 Par écran

| Écran | P1 | P2 | P3 | Total |
| --- | --- | --- | --- | --- |
| `/chues` Mon travail (HUB) | 4 | 3 | 1 | 8 |
| Étape 1, `/chues/appels-representants` (ET1) | 9 | 5 | 0 | 14 |
| Étape 2, `/chues/prospects/nouveau` (ET2) | 3 | 5 | 1 | 9 |
| Étape 3, `/chues/console` (ET3, cible mouvante) | 4 | 2 | 0 | 6 |
| `/chues/statistiques` chiffres (CHF) | 12 | 8 | 1 | 21 |
| `/chues/statistiques` composition (DSP) | 6 | 6 | 0 | 12 |
| `/chues/tableau-de-bord` (TDB) | 1 | 1 | 0 | 2 |
| `/chues/supervision` (SUP) | 3 | 5 | 0 | 8 |
| `/chues/rappels` (RAP) | 4 | 3 | 1 | 8 |
| `/chues/representants` (REP) | 2 | 5 | 0 | 7 |
| `/chues/representants/[id]` (REPD) | 1 | 3 | 1 | 5 |
| `/chues/representants/import` (IMP) | 1 | 3 | 1 | 5 |
| `/chues/prospects` (PRO) | 2 | 5 | 1 | 8 |
| `/chues/suggestions` (SUG) | 2 | 4 | 0 | 6 |
| `/chues/dossiers` (DOS) | 2 | 3 | 1 | 6 |
| `/chues/dossiers/nouveau` (DOSN) | 2 | 3 | 0 | 5 |
| `/chues/dossiers/[id]` (DOSD) | 3 | 4 | 0 | 7 |
| `/chues/dossiers/etapes` (DOSE) | 2 | 1 | 1 | 4 |
| `/chues/dossiers/export` (DOSX) | 1 | 2 | 0 | 3 |
| `/chues/banque` (BQ) | 1 | 3 | 1 | 5 |
| `/chues/demandes-clients` (DMC) | 3 | 3 | 0 | 6 |
| `/chues/campagnes` lots (LOT, cible mouvante) | 6 | 3 | 0 | 9 |
| Transverse (TRV) | 3 | 4 | 1 | 8 |
| **Total** | **77** | **84** | **11** | **172** |

### 7.2 Par priorité

- **P1 bloquant : 77** scénarios.
- **P2 important : 84** scénarios.
- **P3 confort : 11** scénarios.
- **Total : 172** scénarios.

### 7.3 Par état

| État | Nombre |
| --- | --- |
| Écrivables immédiatement | 157 |
| Cible mouvante, à écrire après livraison du lot web (ET3 : 6, LOT : 9) | 15 |
| Écrivables mais attendus **rouges** en l'état du dépôt | 4 explicitement nommés (RAP-4, RAP-8, CHF-17, ET3-1), plus les 29 scénarios CHF-* et SUP-* tant que la virgule SQL de `supervision.service.ts:259` n'est pas retirée |

### 7.4 Fichiers de spec

| Fichier | Nouveau ou existant | Projet Playwright |
| --- | --- | --- |
| `e2e/roles.setup.ts` | nouveau, **mainteneur central** | `setup` |
| `e2e/chues-hub.commercial.spec.ts` | nouveau | `chromium-commercial` |
| `e2e/chues-hub.banque.spec.ts` | nouveau | `chromium-banque` |
| `e2e/chues-etape1.commercial.spec.ts` | nouveau | `chromium-commercial` |
| `e2e/chues-etape1.banque.spec.ts` | nouveau | `chromium-banque` |
| `e2e/chues-etape2.commercial.spec.ts` | nouveau | `chromium-commercial` |
| `e2e/chues-etape3.commercial.spec.ts` | nouveau, cible mouvante | `chromium-commercial` |
| `e2e/chues-chiffres.superviseur.spec.ts` | nouveau | `chromium-superviseur` |
| `e2e/chues-chiffres.direction.spec.ts` | nouveau | `chromium-direction` |
| `e2e/chues-chiffres.commercial.spec.ts` | nouveau | `chromium-commercial` |
| `e2e/chues-chiffres.banque.spec.ts` | nouveau | `chromium-banque` |
| `e2e/chues-chiffres-taux.superviseur.spec.ts` | nouveau | `chromium-superviseur` |
| `e2e/chues-disposition.superviseur.spec.ts` | nouveau, `serial` | `chromium-superviseur` |
| `e2e/chues-disposition.spec.ts` | nouveau | `chromium` (ADMIN) |
| `e2e/chues-supervision.superviseur.spec.ts` | nouveau | `chromium-superviseur` |
| `e2e/chues-supervision.commercial.spec.ts` | nouveau | `chromium-commercial` |
| `e2e/chues-rappels.commercial.spec.ts` | nouveau | `chromium-commercial` |
| `e2e/chues-rappels.superviseur.spec.ts` | nouveau | `chromium-superviseur` |
| `e2e/chues-representants.commercial.spec.ts` | nouveau | `chromium-commercial` |
| `e2e/chues-representants.superviseur.spec.ts` | nouveau | `chromium-superviseur` |
| `e2e/chues-representants.spec.ts` | nouveau | `chromium` (ADMIN) |
| `e2e/chues-import.spec.ts` | nouveau | `chromium` (ADMIN) |
| `e2e/chues-import.roles.spec.ts` | nouveau | multi-projets |
| `e2e/chues-prospects.commercial.spec.ts` | nouveau | `chromium-commercial` |
| `e2e/chues-prospects.commercial2.spec.ts` | nouveau | `chromium-commercial2` |
| `e2e/chues-prospects.superviseur.spec.ts` | nouveau | `chromium-superviseur` |
| `e2e/chues-suggestions.commercial.spec.ts` | nouveau | `chromium-commercial` |
| `e2e/chues-suggestions.superviseur.spec.ts` | nouveau | `chromium-superviseur` |
| `e2e/chues-dossiers.banque.spec.ts` | nouveau, `serial` | `chromium-banque` |
| `e2e/chues-dossiers.roles.spec.ts` | nouveau | multi-projets |
| `e2e/chues-dossiers-etapes.spec.ts` | nouveau | `chromium` (ADMIN) |
| `e2e/chues-banque.banque.spec.ts` | nouveau | `chromium-banque` |
| `e2e/chues-demandes.banque.spec.ts` | nouveau | `chromium-banque` |
| `e2e/chues-demandes.spec.ts` | nouveau | `chromium` (ADMIN) |
| `e2e/chues-lots-export.spec.ts` | nouveau, cible mouvante | `chromium` (ADMIN) |
| `e2e/chues-lots-export.roles.spec.ts` | nouveau, cible mouvante | multi-projets |
| `e2e/chues-accessibilite.spec.ts` | nouveau | `chromium-commercial` |
| `e2e/console.spec.ts` | **existant, ne pas modifier** | `chromium` |
| `e2e/workspaces.spec.ts` | **existant, ne pas modifier** | `chromium` |
| `e2e/representants-import.spec.ts` | **existant, ne pas modifier** | `chromium` |
| `e2e/roles.anon.spec.ts` | **existant, ne pas modifier** | `chromium-anonyme` |
| `e2e/prospects.spec.ts` | **existant, mise à jour par le mainteneur** | `chromium` |
| `e2e/accessibility.spec.ts` | **existant, mise à jour par le mainteneur** | `chromium` |
