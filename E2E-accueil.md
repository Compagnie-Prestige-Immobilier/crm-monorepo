# Plan de tests navigateur — Connexion, Hub, Coque du panel, Espace Accueil

Document d'exécution. Il sera fusionné avec deux autres plans, puis distribué à
des agents indépendants qui écriront chacun une partie sans se voir.

Rien ici n'est un test écrit : ce sont des contrats à traduire en Playwright,
contre une pile vivante (API NestJS sur 3001, web Next sur 3000, Postgres
amorcé).

---

## 1. Périmètre et hypothèses

### 1.1 Ce que couvre ce document

| Bloc | Routes |
| --- | --- |
| Connexion, session, redirections | `/connexion`, `/`, `/[ancien]/...`, gardes de `(panel)/layout.tsx` et `(hub)/layout.tsx` |
| Hub des espaces | `/espaces` |
| Coque du panel | barre latérale, section « Plus », sélecteur d'espace public/démo, cloche et `/notifications`, API hors ligne, écran « Cet écran n'a pas pu s'afficher », 404 |
| Espace Accueil | `/accueil`, `/accueil/tableau-de-bord`, `/accueil/listes`, `/accueil/import` |

Hors périmètre : tout `/chues/**`, `/grand-public/**`, `/admin/**` autre que
l'accès refusé constaté depuis la coque.

### 1.2 Hypothèses de départ

1. La base publique est migrée et amorcée (`pnpm db:seed`). Les quatre listes du
   registre contiennent les entrées d'origine : entreprises `CPI`,
   `SANTARGILE`, `MAKE-UP ADDICTION` ; 17 directions dont `COMMERCIALE` ; 16
   destinataires dont `MME. NDOYE (RESP. COMM.)` et `AUTRE` ; 16 objets dont
   `SUIVI DE DOSSIER` et `ACHAT TERRAIN`.
2. L'API est déjà lancée. `e2e/global-setup.ts` échoue avec un message explicite
   sinon ; personne ne la redémarre depuis un test.
3. Le serveur Next est démarré par `webServer` ou réutilisé s'il tourne déjà.
4. `workers: 1`, `fullyParallel: false`, `retries: 0` : ces trois réglages sont
   la condition de validité de tout ce document. Aucun agent ne les change.
5. Fuseau `Africa/Dakar`, locale `fr-FR` (fixés dans `playwright.config.ts`).
   Dakar est à UTC toute l'année : `dakarNow()` et l'horloge du serveur
   coïncident. Un test qui compare une date à `new Date()` doit passer par
   `dakarNow()`, pas par l'heure locale de la machine.
6. Les libellés cités entre guillemets dans ce document sont recopiés du code
   source lu le jour de la rédaction. Une apostrophe française `’` (U+2019) y
   est significative : `getByRole('button', { name: "Aujourd'hui" })` avec une
   apostrophe droite ne trouve rien.
7. Le registre des visites n'a **aucune route de suppression** : `VisitesController`
   n'expose que `GET`, `POST` et `PATCH`. Une visite créée par un test reste en
   base pour toujours. Toute la stratégie de données en découle (§2.4).

### 1.3 Cible mouvante

Une autre session de travail retire les listes d'appel et les campagnes
(`Plan.md`, §« Retrait des listes d'appel : la campagne devient un lot
d'export »). Conséquence dans mon périmètre, limitée à la barre latérale :

- l'entrée `/chues/campagnes` s'intitule désormais **« Lots d'export »** dans
  `nav-items.ts` (et non plus « Campagnes ») ;
- `Plan.md` §D5 conserve **par défaut l'URL `/chues/campagnes`** ;
- les répertoires `apps/web/src/app/(panel)/chues/campagnes/representants/` sont
  déjà supprimés dans l'arbre de travail.

**Cible mouvante.** Les scénarios C4 et C5 qui énumèrent la barre latérale d'un
ADMIN citent « Lots d'export ». Si l'entrée disparaît entièrement, l'agent
rapporte l'écart et **laisse le test rouge** ; il ne réécrit pas l'attente sans
instruction du mainteneur central.

---

## 2. Stratégie d'exécution pour ce périmètre

### 2.1 États de session par rôle — prérequis central bloquant

L'API applique **10 connexions par minute et par IP**. Six rôles à éprouver,
une centaine de scénarios : une connexion par test est impossible.

**Modèle imposé** : un seul fichier de préparation, exécuté une fois, produit un
état de session par rôle sur disque. Chaque spec le consomme avec
`test.use({ storageState: … })` et ne se connecte jamais.

| Rôle | Compte | Fichier d'état attendu |
| --- | --- | --- |
| ADMIN | `admin@cpi.sn` | `e2e/.auth/admin.json` (existe déjà) |
| ACCUEIL | `fixture.accueil@cpi.sn` | `e2e/.auth/accueil.json` |
| DIRECTION | `fixture.direction@cpi.sn` | `e2e/.auth/direction.json` |
| SUPERVISEUR | `fixture.superviseur@cpi.sn` | `e2e/.auth/superviseur.json` |
| COMMERCIAL | `fixture.awa@cpi.sn` | `e2e/.auth/commercial.json` |
| BANQUE_FINANCE | `fixture.banque@cpi.sn` | `e2e/.auth/banque.json` |

Six connexions au démarrage, sous le quota de dix.

**Ce fichier n'existe pas encore.** `e2e/auth.setup.ts` ne connecte que l'ADMIN.
Aucun agent ne modifie `auth.setup.ts` ni `playwright.config.ts` : la demande est
adressée au mainteneur central, qui ajoutera le projet de préparation et les
dépendances de projet. Tant qu'elle n'est pas satisfaite, les scénarios marqués
**[dépend des états de rôle]** ne sont pas écrits, et l'agent le dit dans son
retour plutôt que d'improviser une connexion.

**Mot de passe des comptes de fixture — écart à trancher (P1).**
`e2e/fixtures.ts` déclare `FIXTURE_PASSWORD = 'REDACTED'` et ne
l'applique qu'aux comptes **qu'il crée lui-même**. Or `packages/database/src/seed.ts`
crée déjà les six comptes `fixture.*` avec `SEED_FIXTURE_PASSWORD`, valorisé à
`ChangeMoi123456` dans `.env` et `.env.example`. Sur une base amorcée,
`ensureUser` trouve le compte et **n'écrase pas le mot de passe** : se connecter
avec `FIXTURE_PASSWORD` échoue en 401. La préparation des sessions doit lire
`process.env.SEED_FIXTURE_PASSWORD`, avec repli sur `'ChangeMoi123456'`. Aucun
mot de passe n'est écrit en dur dans un fichier de test : tout passe par
variable d'environnement.

### 2.2 Fichiers de spec, un par agent

| Spec | Projet Playwright | État de session | Bloc |
| --- | --- | --- | --- |
| `e2e/accueil-connexion.anon.spec.ts` | `chromium-anonyme` | aucun | §5.1 A1–A9 |
| `e2e/accueil-session.spec.ts` | `chromium` | admin | §5.1 A10–A14 |
| `e2e/accueil-espaces.spec.ts` | `chromium` | admin | §5.2 B1–B4 |
| `e2e/accueil-espaces-roles.spec.ts` | `chromium` | par rôle | §5.2 B5–B10 |
| `e2e/accueil-coque.spec.ts` | `chromium` | admin + accueil | §5.3 C1–C14 |
| `e2e/accueil-registre.spec.ts` | `chromium` | accueil | §5.4 D1–D18 |
| `e2e/accueil-impression.spec.ts` | `chromium` | accueil | §5.5 E1–E7 |
| `e2e/accueil-tableau-de-bord.spec.ts` | `chromium` | accueil | §5.6 F1–F14 |
| `e2e/accueil-listes.spec.ts` | `chromium` | direction | §5.7 G1–G12 |
| `e2e/accueil-import.spec.ts` | `chromium` | direction | §5.8 H1–H12 |
| `e2e/accueil-demo-isolation.spec.ts` | `chromium` | admin | §5.9 I1–I3 |

Un fichier, un agent, un propriétaire. `test.use({ storageState })` se pose au
niveau du fichier ou d'un `test.describe`, jamais au niveau du projet.

### 2.3 Ordre et sérialisation

`workers: 1` sérialise déjà tout. Ce qui doit en plus être **ordonné à
l'intérieur d'un fichier** (`test.describe.configure({ mode: 'serial' })`) :

- `accueil-registre.spec.ts` : la visite créée en D3 est celle que D6 corrige et
  que D10 retrouve après rechargement.
- `accueil-import.spec.ts` : export → dépôt → revue → application, quatre temps
  d'un même travail.
- `accueil-listes.spec.ts` : création → renommage → réordonnancement →
  désactivation d'une même entrée.
- `accueil-demo-isolation.spec.ts` : écriture en démo puis lecture en public.

Partout ailleurs, chaque scénario doit pouvoir tourner seul
(`npx playwright test <fichier> -g "<titre>"`). Un scénario qui n'est vert que
derrière un autre, sans `serial` déclaré, est un défaut du test.

### 2.4 Données de fixture : préfixes, création, nettoyage

Aucune donnée de ce périmètre ne se supprime par l'API. On ne nettoie donc pas :
on **isole** et on **tolère**.

**Identifiant d'exécution.** Chaque spec calcule une fois, au niveau du module :

```
const RUN = String(Date.now()).slice(-8);   // 8 chiffres, unique par exécution
```

et l'inclut dans toute donnée créée. Deux exécutions successives ne se voient
donc jamais, et une assertion « exactement une ligne » reste vraie à la
centième relance.

**Préfixes réservés, un par spec :**

| Spec | Préfixe | Porté par |
| --- | --- | --- |
| `accueil-registre` | `E2E-ACC-REG-<RUN>` | `PRENOM ET NOMS` de la visite |
| `accueil-impression` | `E2E-ACC-IMP-<RUN>` | `PRENOM ET NOMS` |
| `accueil-import` | `E2E-ACC-XLS-<RUN>` | `PRENOM ET NOMS` des lignes du classeur |
| `accueil-listes` | code `E2E_ACC_LST_<RUN>`, libellé `E2E ACC LST <RUN>` | entrées des quatre listes |
| `accueil-demo-isolation` | `E2E-ACC-DEMO-<RUN>` | `PRENOM ET NOMS`, écrit **en espace démo** |
| `accueil-coque`, `accueil-espaces*`, `accueil-session`, `accueil-tableau-de-bord` | — | ne créent **aucune** donnée métier |

Le code d'un référentiel n'accepte que `[A-Z0-9_]` (`CODE_PATTERN` côté API) :
pas de tiret, pas de minuscule. D'où `E2E_ACC_LST_12345678` et non
`E2E-ACC-LST-…`.

**Nettoyage réellement possible :**

- entrée de référentiel créée par le test : la **désactiver** en fin de spec
  (`POST /visites/referentiels/{kind}/{id}/active` avec `{ isActive: false }`),
  pour qu'elle cesse de polluer les listes déroulantes des autres specs. Elle
  reste en base, c'est le contrat produit (« jamais de suppression »).
- disposition de tableau de bord : la remettre à zéro par le bouton
  « Revenir à la disposition par défaut » ou `DELETE
  /tableaux-de-bord/visites/disposition`, sur **le compte du test seulement**.
- visites : rien. Elles s'accumulent. C'est accepté et documenté ; §6 pose la
  question au propriétaire.

**Idempotence.** Les créations qui doivent survivre à une relance (entrées de
référentiel à code stable) absorbent le 409 : on relit la liste et on reprend
l'entrée existante, comme le fait déjà `ensureUser` dans `e2e/fixtures.ts`.

### 2.5 Ce que l'API a le droit de faire dans un test

L'API sert **uniquement** à :

1. poser une précondition qu'aucun écran du périmètre ne pose (créer une visite
   dont on veut vérifier l'affichage, par exemple) ;
2. vérifier après coup un effet que l'écran ne montre pas (lire la disposition
   enregistrée, lire une visite en espace public après une écriture en démo).

Elle ne remplace jamais un geste : si le scénario dit « enregistre une visite »,
le test remplit le formulaire et clique. `APIRequestContext` se construit avec
`storageState` comme dans `e2e/fixtures.ts` (`adminApi()`), et vise le **relais
web** `http://localhost:3000/api/v1/…`, jamais l'API directement : c'est le
relais qui porte le cookie `httpOnly`.

Budget : **300 requêtes par minute**, toutes sources confondues. Un balayage de
vingt écrans consomme deux cents appels. Aucun scénario ne boucle sur une route
sans nécessité.

---

## 3. Règles impératives pour l'agent qui écrit un test

Ces règles priment sur toute habitude personnelle. Un livrable qui les enfreint
est refusé même s'il est vert.

### 3.1 Propriété des fichiers

1. Un agent n'écrit **que dans le fichier de spec qui lui est assigné** (§2.2).
2. Il ne modifie **jamais** `playwright.config.ts`, `e2e/fixtures.ts`,
   `e2e/auth.setup.ts`, `e2e/global-setup.ts`, `e2e/xlsx.ts`, ni le spec d'un
   autre agent. S'il a besoin d'un helper partagé, d'un état de session, d'une
   variable d'environnement ou d'un réglage de projet, il **le décrit dans son
   retour** et le mainteneur central l'intègre.
3. Il ne supprime, ne renomme, ne désactive aucun test existant. Les tests déjà
   en place (`auth.anon.spec.ts`, `redirections.spec.ts`, `roles.anon.spec.ts`,
   `prospects.spec.ts`, `accessibility.spec.ts`, `workspaces.spec.ts`,
   `console.spec.ts`, `representants-import.spec.ts`) restent intacts.
   `e2e/preuve.temp.spec.ts` appartient à un autre agent : ne pas y toucher, ne
   pas s'en inspirer.
4. Il ne touche **jamais** au code applicatif : `apps/web/src`, `apps/api`,
   `packages/**`. **Si un test révèle un bug, le test reste ROUGE** et le bug est
   rapporté. On ne corrige pas l'application, et on n'assouplit pas le test pour
   le faire passer au vert.
5. Il ne crée pas de fichier de rapport, de résumé ou d'analyse. Le retour se
   fait dans le message final.

### 3.2 Propriété des données

1. Chaque spec crée ses données avec **son** préfixe (§2.4) et son `RUN`.
2. Un test ne lit, ne modifie et ne désactive que **ses** données. Une assertion
   du type « la liste contient 3 lignes » sans filtre sur le préfixe est
   interdite : la base est partagée et grossit.
3. Interdit : `pnpm db:seed`, `pnpm db:reset`, toute migration, tout `TRUNCATE`,
   tout accès direct à Postgres.
4. Interdit : `POST /admin/demo/reset`, **sauf** dans
   `accueil-demo-isolation.spec.ts`, seul propriétaire déclaré de l'espace démo
   dans ce plan — et encore, en coordination avec
   `workspaces.spec.ts` qui le réinitialise déjà.
5. Un test qui bascule la session en espace démo la **remet en public** dans un
   `finally` ou un `afterAll`. Une session laissée en démo fait échouer tout ce
   qui suit, dans un autre fichier, pour une raison illisible.

### 3.3 Ressources partagées

1. **Aucune connexion supplémentaire.** Le limiteur autorise 10 par minute pour
   toute la suite. On réutilise l'état de session du rôle. Aucun
   `page.goto('/connexion')` suivi d'un remplissage de formulaire, sauf dans
   `accueil-connexion.anon.spec.ts`, qui en est le sujet et qui en dépense
   au plus trois.
2. Interdit de modifier les référentiels partagés : banques, syndicats,
   départements, IEF, et les entrées **système** des quatre listes du registre
   (celles marquées « Classeur d'origine » : `CPI`, `SANTARGILE`,
   `MAKE-UP ADDICTION`, `COMMERCIALE`, `MME. NDOYE (RESP. COMM.)`, `AUTRE`,
   `SUIVI DE DOSSIER`…). On ne les renomme pas, on ne les désactive pas, on ne
   les déplace pas.
3. Interdit de modifier, désactiver ou changer le mot de passe d'un compte qui
   n'est pas le sien — et aucun compte de ce plan n'appartient à un agent :
   `admin@cpi.sn` et les six `fixture.*` sont partagés.
4. Interdit d'utiliser « Proposer par défaut » sur un tableau de bord : le
   bouton fixe la disposition de **tous** les comptes qui n'en ont pas
   enregistré (voir F13, qui décrit comment le couvrir sans l'exécuter).
5. `workers: 1` reste obligatoire. Aucun `test.describe.parallel`.

### 3.4 Preuve de livraison

1. L'agent rend la **sortie brute** de la commande exécutée, au minimum
   `npx playwright test e2e/<son-fichier>.spec.ts --reporter=list`.
2. Il indique le **nombre exact** de tests passés et de tests rouges.
3. Pour chaque rouge, il tranche : **bug applicatif** (avec la route, le libellé
   attendu, le libellé obtenu, le fichier source fautif) ou **test à corriger**
   (avec ce qu'il a corrigé).
4. « Tout passe » sans sortie de commande n'est pas accepté.
5. **Un test rouge sur un vrai bug est un livrable réussi.** C'est même le but :
   un scénario qui ne peut pas échouer ne vaut rien.

### 3.5 Interdictions de rédaction

Interdit, sans exception :

- assertions molles : `toBeVisible()` sur un conteneur générique (`main`, `div`,
  la carte entière), `expect(true).toBe(true)`, `expect(x).toBeDefined()` seul,
  `toHaveCount(n)` sans filtre sur ses propres données ;
- `page.waitForTimeout(...)` et tout `sleep`. On attend une **condition** :
  `expect(...).toBeVisible()`, `waitForURL`, `waitForResponse`,
  `expect(locator).toHaveText(...)`. Les délais restent des bornes d'échec, pas
  des synchronisations ;
- `test.skip(...)` ou `test.fixme(...)` sans numéro de ticket ni justification
  écrite dans le retour ; interdit d'ignorer un test parce qu'il est rouge ;
- `retries`, `test.retry`, boucle de réessai maison ;
- `try { ... } catch { }` qui avale un échec, et `.catch(() => false)` autour
  d'une attente (le piège documenté en tête de `roles.anon.spec.ts`) ;
- sélecteurs CSS fragiles : `nth-child`, classes Tailwind (`.bg-card`,
  `.text-muted-foreground`), `locator('div > div > span')`, `data-testid`
  ajouté au code applicatif (interdit par §3.1.4) ;
- réduire le périmètre pour finir vite, fusionner dix scénarios en un test,
  remplacer un parcours navigateur par un appel API ;
- masquer un écart de libellé en élargissant le sélecteur. `getByText(/visite/i)`
  à la place de `getByRole('heading', { name: '1 visite aujourd’hui' })` est
  un refus de constater le bug.

**Autorisé et recommandé** : `getByRole`, `getByLabel`, `getByPlaceholder`,
`getByText` avec libellé exact, `filter({ hasText })`, `exact: true` dès qu'un
libellé est le préfixe d'un autre. Les expressions régulières sont autorisées
**ancrées** (`/^Accueil/`, `/^cpi-registre-visites-\d{4}-\d{2}-\d{2}\.xlsx$/`),
jamais ouvertes.

**Pièges de sélecteur relevés dans ce dépôt** (déjà payés par d'autres) :

- `getByRole('alert')` seul attrape aussi le *route-announcer* de Next et la
  région vide du `Toaster` de Sonner. Filtrer : `page.locator('form').getByRole('alert')`
  ou `page.getByRole('alert').filter({ hasText: '…' })`.
- `getByRole('status')` seul attrape la région `aria-live` de Sonner. Filtrer sur
  le texte attendu.
- Un en-tête de colonne triable et un filtre portent parfois le même nom
  accessible : distinguer par le rôle (`button` contre `combobox`).
- `FilterCombobox` compose son nom accessible avec le libellé **et** la valeur
  affichée, plus le mot « Obligatoire » quand le champ est requis : le nom d'un
  champ entreprise vide et requis est `ENTREPRISE Obligatoire Choisir`. Les
  options du menu portent le rôle `option`.

---

## 4. Données de fixture par écran : autorisé / interdit

| Écran | L'agent PEUT créer | L'agent NE DOIT PAS toucher |
| --- | --- | --- |
| `/connexion`, `/`, anciennes adresses | rien | aucun compte, aucun mot de passe |
| `/espaces` | rien | les rôles des comptes de fixture |
| Coque du panel | rien | l'état démo hors du spec propriétaire ; les cookies de repli de barre d'un autre spec |
| `/accueil` (registre) | des visites `E2E-ACC-REG-<RUN> …` ; corriger **ses** visites | toute visite qui ne porte pas son préfixe ; les quatre listes ; le nom des colonnes |
| `/accueil` (impression) | des visites `E2E-ACC-IMP-<RUN> …` | idem |
| `/accueil/tableau-de-bord` | **sa** disposition (compte du test) | la disposition par défaut (« Proposer par défaut ») ; les visites d'autrui ; la période enregistrée d'un autre compte |
| `/accueil/listes` | une entrée par liste, code `E2E_ACC_LST_<RUN>_<KIND>` ; renommer, déplacer, désactiver **ces** entrées | les entrées « Classeur d'origine » ; l'ordre global des listes au-delà de ses propres entrées ; le code d'une entrée existante (immuable de toute façon) |
| `/accueil/import` | un classeur fabriqué à l'exécution, lignes `E2E-ACC-XLS-<RUN> …` ; un travail d'import et son application | les travaux d'import d'un autre spec (`/admin/imports` liste tout) ; les visites préexistantes désignées par un `N° REGISTRE` qui n'est pas le sien |
| Espace démo | des visites `E2E-ACC-DEMO-<RUN> …` **dans le schéma `demo`** | l'espace public pendant qu'il est en démo ; `POST /admin/demo/reset` hors du spec propriétaire |

---

## 5. Scénarios

Format de chaque entrée :

> **ID — titre** · priorité · spec cible · rôle(s) · précondition
> Gestes → assertions (libellés exacts) → **Échoue si :** le défaut concret que
> l'assertion attrape.

Priorités : **P1** bloquant (sécurité, perte de données, écran inutilisable),
**P2** important (règle métier, message faux), **P3** confort.

---

### 5.1 Connexion, session, redirections

Route : `/connexion`, `/`, `/[ancien]/[[...segments]]`, gardes de layout.
Rôles autorisés : tous pour `/connexion` ; le panel exige une session.
Précondition : navigateur vierge pour A1–A9 (projet `chromium-anonyme`).

**A1 — le champ identifiant vide refuse l'envoi et nomme le champ** · P1 ·
`accueil-connexion.anon.spec.ts` · anonyme

- Aller sur `/connexion`, laisser « E-mail ou identifiant » vide, saisir un mot
  de passe de 12 caractères, cliquer « Se connecter ».
- Assertions : l'URL reste sur `/connexion` ; le paragraphe `#identifier-error`
  affiche exactement `E-mail ou identifiant obligatoire.` ; le champ porte
  `aria-invalid="true"` ; **aucune requête n'est partie** vers
  `/api/auth/login` (interception par `page.route` ou `waitForRequest` avec
  borne courte, jamais un `waitForTimeout`).
- **Échoue si :** la validation zod côté client est retirée et le formulaire
  consomme une tentative de connexion sur un quota de dix par minute ; ou si le
  message change sans que le plan soit mis à jour.

**A2 — un mot de passe trop court est refusé avant l'envoi** · P2 ·
`accueil-connexion.anon.spec.ts` · anonyme

- Identifiant `admin@cpi.sn`, mot de passe `court` (5 caractères), envoyer.
- Assertion : `#password-error` affiche `Le mot de passe compte au moins 8 caractères.`
- **Échoue si :** la borne `min(8)` disparaît du schéma et chaque frappe
  malheureuse brûle une tentative.

**A3 — un identifiant refusé ne révèle pas si le compte existe** · P3 ·
**déjà couvert** par `auth.anon.spec.ts` (`« un identifiant refusé ne révèle pas
si le compte existe »`). Ne pas réécrire. Vérifier seulement, à la relecture,
que le message générique attendu est bien `Identifiants incorrects ou compte non
autorisé.` (route `/api/auth/login`, statut 401).

**A4 — un agent d'accueil se connecte et atterrit sur le hub** · P1 ·
`accueil-connexion.anon.spec.ts` · ACCUEIL · compte `fixture.accueil@cpi.sn`,
mot de passe lu dans `SEED_FIXTURE_PASSWORD`

- Remplir et envoyer.
- Assertions : `waitForURL(/\/espaces$/)` ; le titre de niveau 1 est
  `Choisissez un espace` ; les cookies du contexte contiennent `cpi_at` et
  `cpi_rt` ; `document.cookie` **ne** les contient **pas** (ils sont `httpOnly`).
- **Échoue si :** `homePathForRole` cesse de renvoyer tout le monde sur le hub et
  envoie l'accueil sur un écran qu'il n'a pas le droit d'ouvrir ; ou si un cookie
  de session devient lisible en JavaScript, ce qui rendrait une XSS suffisante
  pour voler la session.

**A5 — la connexion respecte la destination demandée (`?suite=`)** · P1 ·
`accueil-connexion.anon.spec.ts` · ACCUEIL

- Aller sur `/connexion?suite=%2Faccueil%2Ftableau-de-bord`, se connecter.
- Assertion : l'URL finale est `/accueil/tableau-de-bord` (et non `/espaces`) ;
  le titre du document contient `Tableau de bord des visites`.
- **Échoue si :** le paramètre `suite` est ignoré : un utilisateur dont la
  session a expiré au milieu d'un écran est renvoyé au hub et perd son contexte.

**A6 — une destination externe déguisée est ignorée** · P1 sécurité ·
`accueil-connexion.anon.spec.ts` · ACCUEIL

- Aller sur `/connexion?suite=//evil.example.com`, puis sur
  `/connexion?suite=/\evil`, se connecter dans chaque cas.
- Assertion : l'URL finale reste sur `localhost:3000` et vaut `/espaces` ; à
  aucun moment `page.url()` ne quitte l'origine.
- **Échoue si :** le motif `^\/(?!\/)[^\\]*$` de `connexion/page.tsx` est
  relâché et le panel devient un tremplin de redirection ouverte.

**A7 — une session expirée l'annonce sur l'écran de connexion** · P2 ·
`accueil-connexion.anon.spec.ts` · anonyme

- Aller sur `/connexion?session=expiree`.
- Assertion : un élément `role="status"` contient exactement
  `Session expirée. Reconnectez-vous.`
- **Échoue si :** `SESSION_EXPIRED_PARAM` change côté client sans que la page le
  suive, et l'utilisateur déconnecté en pleine saisie ne comprend pas pourquoi
  il est revenu à la connexion.

**A8 — la racine anonyme mène à la connexion** · P1 ·
`accueil-connexion.anon.spec.ts` · anonyme

- `page.goto('/')`.
- Assertion : `waitForURL(/\/connexion/)` ; le titre de niveau 1 est `Connexion`.
- **Échoue si :** `RootPage` cesse de lire la session et rend le hub à un
  visiteur non authentifié.

**A9 — un écran de l'accueil est verrouillé aux anonymes** · P1 ·
`accueil-connexion.anon.spec.ts` · anonyme

- Pour chacune des quatre routes `/accueil`, `/accueil/tableau-de-bord`,
  `/accueil/listes`, `/accueil/import` : `page.goto`.
- Assertion : chaque fois, l'URL finale est `/connexion` ; le titre `Connexion`
  est rendu ; le corps de la page **ne contient pas** le mot `Registre` ni le
  bouton `Ajouter une visite` (aucune fuite avant redirection).
- **Échoue si :** un `guardRoles` disparaît d'une page ou le layout `(panel)`
  cesse de rediriger : le registre des visites d'une société devient public.

**A10 — la connexion est refusée à qui a déjà une session** · P2 ·
`accueil-session.spec.ts` · ADMIN

- `page.goto('/connexion')`.
- Assertion : redirection vers `/espaces`, titre `Choisissez un espace`.
- **Échoue si :** la garde de `connexion/page.tsx` saute et un utilisateur
  connecté peut se reconnecter, brûlant le quota de dix par minute.

**A11 — la déconnexion depuis le hub reverrouille tout l'accueil** · P2 ·
`accueil-session.spec.ts` · ADMIN — **attention : consomme l'état de session**

- Depuis `/espaces`, ouvrir le menu `Compte de Administrateur CPI`, cliquer
  `Se déconnecter` ; puis `page.goto('/accueil')`.
- Assertions : URL `/connexion` ; les cookies `cpi_at` et `cpi_rt` ont disparu du
  contexte ; `/accueil` ne rend pas le registre.
- **Contrainte de sûreté :** ce scénario **doit** s'exécuter dans un contexte
  jetable (`browser.newContext({ storageState: 'e2e/.auth/admin.json' })` créé
  dans le test et fermé après), **jamais** sur la `page` partagée : effacer les
  cookies du contexte partagé ferait tomber tous les tests suivants.
- **Échoue si :** `/api/auth/logout` cesse d'effacer les cookies et une session
  reste ouverte sur un poste partagé du comptoir d'accueil.

**A12 — les cookies de session restent hors de portée du JavaScript, sur un
écran de l'accueil** · P2 · `accueil-session.spec.ts` · ADMIN

- `page.goto('/accueil')`, attendre le bouton `Ajouter une visite`.
- Assertions : `document.cookie` ne contient ni `cpi_at` ni `cpi_rt` ;
  `context.cookies()` les donne avec `httpOnly === true`.
- Référence : `prospects.spec.ts` fait la même preuve sur `/tableau-de-bord`.
  Ici la valeur ajoutée est la coque Accueil, servie par un autre layout.
- **Échoue si :** un jour la session passe en cookie lisible pour simplifier un
  appel client.

**A13 — `/notifications` est un écran, pas une ancienne adresse** · P2 ·
`accueil-session.spec.ts` · ACCUEIL **[dépend des états de rôle]**

- Avec la session ACCUEIL : `page.goto('/notifications')`.
- Assertions : l'URL **reste** `/notifications` (le segment statique gagne sur
  l'attrape-tout `[ancien]`, qui renverrait vers `/admin/notifications`) ; le
  titre de niveau 1 de la barre supérieure est `Notifications` ; aucun titre
  `Accès refusé` n'est rendu.
- Complément ADMIN (même spec, session admin) : `page.goto('/notifications')`
  redirige vers `/admin/notifications?onglet=reception`.
- **Échoue si :** l'ordre de résolution des routes change et un agent d'accueil
  est envoyé sur le composeur d'administration, où il récolte un « Accès refusé ».

**A14 — une adresse qui n'a jamais existé reste introuvable** · P3 ·
`accueil-session.spec.ts` · ADMIN

- `page.goto('/accueils')` (faute de frappe volontaire, racine inconnue de
  `MOVED_ROUTES`).
- Assertions : titre de niveau 1 `Page introuvable` ; texte
  `Cette adresse ne correspond à aucun écran du panel.` ; un lien
  `Revenir aux espaces` pointant sur `/espaces`.
- Référence : `redirections.spec.ts` couvre déjà `/comptabilite`. Ce scénario
  ajoute la **proximité avec un segment réel** (`/accueils` contre `/accueil`) :
  c'est ce que l'attrape-tout pourrait absorber par erreur.
- **Échoue si :** `[ancien]` avale une racine inconnue et rend une page vide au
  lieu du 404, ou si le segment statique `/accueil` capture `/accueils`.

---

### 5.2 Hub « Choisissez un espace » (`/espaces`)

Rôles autorisés : tous les rôles authentifiés. Refusé : anonyme (A9 couvre la
redirection). Précondition : session posée, aucune donnée métier.

**B1 — un administrateur voit quatre tuiles, toutes ouvertes** · P2 ·
`accueil-espaces.spec.ts` · ADMIN

- `page.goto('/espaces')`.
- Assertions : titre de niveau 1 `Choisissez un espace` ; dans `main`, quatre
  `listitem` ; un lien par tuile nommé `Accueil`, `Projet CHUES`,
  `Projet Grand Public`, `Admin` (regex ancrée `/^Accueil/` etc., la tuile
  portant aussi sa description) ; aucune tuile ne contient
  `Réservé à d’autres profils`.
- Recouvrement : `auth.anon.spec.ts` vérifie déjà la présence des quatre liens
  après connexion. Ne pas dupliquer le clic vers CHUES ; ajouter ici les
  descriptions exactes : `Registre des visites du comptoir`,
  `Enrôlement des enseignants syndiqués`, `Vente hors syndicat, en préparation`,
  `Comptes, listes de référence, imports et paramètres`.
- **Échoue si :** une tuile perd sa description, ou une cinquième coque
  apparaît sans que le plan la connaisse.

**B2 — la tuile Accueil mène au registre** · P1 ·
`accueil-espaces.spec.ts` · ADMIN

- Cliquer le lien `/^Accueil/` dans `main`.
- Assertions : `waitForURL('**/accueil')` — URL **exactement** `/accueil`, pas un
  sous-chemin ; titre du **document** `Registre des visites` (posé par la page,
  pas par la barre supérieure) ; le bouton `Ajouter une visite` est visible.
- **Échoue si :** `coqueHomePath(role, 'accueil')` change et fait atterrir sur
  un onglet secondaire, ou si la tuile pointe une route qui rend une coquille
  vide.

**B3 — le hub porte l'état de retour et propose de revenir** · P2 ·
`accueil-espaces.spec.ts` · ADMIN

- `page.goto('/espaces?retour=%2Faccueil%2Flistes')`.
- Assertions : le titre de niveau 1 devient `Changer d’espace` (et non
  « Choisissez un espace ») ; un bouton-lien `Retour` porte
  `href="/accueil/listes"` ; le cliquer ramène sur `/accueil/listes`.
- **Échoue si :** le paramètre `retour` est ignoré : le lien « Espaces » de la
  barre supérieure devient une impasse d'où l'on ne revient qu'en arrière.

**B4 — un retour hostile est neutralisé** · P1 sécurité ·
`accueil-espaces.spec.ts` · ADMIN

- Trois cas : `?retour=//evil.example.com`, `?retour=/\evil`,
  `?retour=/espaces`.
- Assertions : dans les trois cas le titre reste `Choisissez un espace` et
  **aucun** bouton `Retour` n'est rendu (`getByRole('button', { name: 'Retour', exact: true })`
  a un compte de 0, de même pour le lien).
- **Échoue si :** le filtre de `espaces/page.tsx` est relâché (redirection
  ouverte), ou si `?retour=/espaces` produit une boucle sur lui-même.

**B5 — un agent d'accueil ne voit qu'une tuile ouverte** · P1 ·
`accueil-espaces-roles.spec.ts` · ACCUEIL **[dépend des états de rôle]**

- `page.goto('/espaces')`.
- Assertions : la tuile `Accueil` porte un lien ; les tuiles `Projet CHUES`,
  `Projet Grand Public`, `Admin` contiennent `Réservé à d’autres profils` et
  **n'ont aucun lien** (`tuile.getByRole('link')` a un compte de 0).
- **Échoue si :** `COQUES[].roles` s'élargit par accident et un compte de
  comptoir se voit proposer l'administration, où l'API le refusera ensuite.

**B6 — la Direction ouvre Accueil, CHUES et Grand Public, jamais l'Admin** · P2 ·
`accueil-espaces-roles.spec.ts` · DIRECTION **[dépend des états de rôle]**

- Assertions : trois tuiles avec lien ; `Admin` grisée avec
  `Réservé à d’autres profils`.
- **Échoue si :** la coque Admin s'ouvre à la Direction alors que
  `/admin/parametres` refuse toujours en serveur : une tuile qui mène à un refus
  est un défaut de conception, pas une protection.

**B7 — l'atterrissage par rôle mène là où l'API ne répond pas 403** · P1 ·
`accueil-espaces-roles.spec.ts` · ACCUEIL, DIRECTION, SUPERVISEUR, COMMERCIAL,
BANQUE_FINANCE **[dépend des états de rôle]**

Un cas par rôle, table paramétrée (`for (const … of …) test(…)`, un `test` par
ligne — **pas** une boucle dans un seul test) :

| Rôle | Tuile cliquée | URL attendue | Repère propre à l'écran |
| --- | --- | --- | --- |
| ACCUEIL | `Accueil` | `/accueil` | bouton `Ajouter une visite` |
| DIRECTION | `Accueil` | `/accueil` | bouton `Ajouter une visite` |
| DIRECTION | `Projet CHUES` | `/chues/statistiques` | titre de document contenant `Chiffres` |
| SUPERVISEUR | `Projet CHUES` | `/chues/statistiques` | idem |
| COMMERCIAL | `Projet CHUES` | `/chues` | texte `Trois étapes, dans l’ordre.` |
| BANQUE_FINANCE | `Projet CHUES` | `/chues/banque` | titre de document contenant `Tableau de bord bancaire` |

- Assertion supplémentaire commune : sur l'écran d'arrivée, aucun titre
  `Accès refusé`, `Serveur injoignable`, `Chargement impossible`.
- Recouvrement : `roles.anon.spec.ts` couvre déjà BANQUE_FINANCE et COMMERCIAL
  **au prix d'une connexion par test**. Les lignes correspondantes de ce tableau
  ne sont écrites **que** si le mainteneur central décide de basculer
  `roles.anon.spec.ts` sur les états de session ; sinon, l'agent se limite aux
  trois lignes ACCUEIL / DIRECTION / SUPERVISEUR et le dit dans son retour.
- **Échoue si :** `coqueHomePath` renvoie un écran interdit au rôle — la première
  seconde d'utilisation se solde alors par un « Accès refusé », ce que
  `nav-items.test.ts` ne peut pas voir puisqu'il ne connaît pas la garde serveur.

**B8 — le hub survit à un rechargement dur** · P3 ·
`accueil-espaces-roles.spec.ts` · ACCUEIL **[dépend des états de rôle]**

- `page.goto('/espaces')`, `page.reload()`.
- Assertion : le titre `Choisissez un espace` est de nouveau rendu et la tuile
  `Accueil` reste la seule cliquable.
- **Échoue si :** `dynamic = 'force-dynamic'` disparaît du layout du hub et une
  page mise en cache montre les tuiles d'un autre rôle.

**B9 — aucune boucle de redirection entre `/`, `/connexion` et `/espaces`** ·
P1 · `accueil-espaces-roles.spec.ts` · ACCUEIL **[dépend des états de rôle]**

- Successivement `page.goto('/')` puis `page.goto('/connexion')`.
- Assertion : à chaque fois, `waitForURL('**/espaces')` aboutit et le titre
  `Choisissez un espace` est rendu.
- Recouvrement : `roles.anon.spec.ts` fait la même preuve pour le téléconseiller.
  Ici c'est le rôle ACCUEIL, dont la seule coque ouverte est celle du registre —
  le cas le plus exposé à une boucle.
- **Échoue si :** une redirection s'ajoute et le navigateur oscille jusqu'au
  délai dépassé ; seul `waitForURL` le nomme.

**B10 — le hub reste utilisable au clavier** · P3 ·
`accueil-espaces-roles.spec.ts` · ACCUEIL **[dépend des états de rôle]**

- Depuis `/espaces`, `page.keyboard.press('Tab')` jusqu'à ce que la tuile
  `Accueil` ait le focus (`expect(locator).toBeFocused()`), puis `Enter`.
- Assertion : URL `/accueil`.
- **Échoue si :** la tuile devient un `div` cliquable et sort de l'ordre de
  tabulation : l'agent d'accueil qui travaille au clavier ne peut plus entrer
  dans son espace.

---

### 5.3 Coque du panel

Routes concernées : toutes les routes `(panel)`. Rôles : ADMIN et ACCUEIL pour
ce bloc. Précondition : session posée.

**C1 — la barre latérale d'un agent d'accueil ne montre qu'une entrée** · P1 ·
`accueil-coque.spec.ts` · ACCUEIL **[dépend des états de rôle]**

- `page.goto('/accueil')`.
- Assertions : dans `getByRole('navigation', { name: 'Navigation principale' })`,
  un lien `Registre des visites` (exact) est visible et porte `aria-current="page"` ;
  **aucun** lien nommé `Tableau de bord`, `Listes`, `Import du registre`,
  `Prospects`, `Utilisateurs`, `Paramètres` (compte de 0, `exact: true`) ; aucune
  section `Plus` n'est rendue.
- **Échoue si :** une entrée `hidden` réapparaît dans la barre et double le
  chemin déjà offert par les onglets, ou si une entrée d'un autre espace fuit
  dans la coque Accueil.

**C2 — les onglets du registre sont le seul chemin vers ses trois écrans** ·
P1 · `accueil-coque.spec.ts` · ADMIN

- `page.goto('/accueil')`.
- Assertions : la navigation `Visites` (`getByRole('navigation', { name: 'Visites' })`)
  contient quatre liens exacts, dans cet ordre : `Liste`, `Tableau de bord`,
  `Listes`, `Import` ; `Liste` porte `aria-current="page"` ; cliquer `Tableau de bord`
  mène à `/accueil/tableau-de-bord` et c'est **lui** qui porte alors
  `aria-current="page"`.
- **Échoue si :** `aria-current` est posé sur le mauvais onglet, ou si un onglet
  pointe une route inexistante — le seul chemin vers l'écran étant rompu.

**C3 — un agent d'accueil ne voit que deux onglets** · P1 ·
`accueil-coque.spec.ts` · ACCUEIL **[dépend des états de rôle]**

- `page.goto('/accueil')`.
- Assertions : la navigation `Visites` contient exactement `Liste` et
  `Tableau de bord` ; `Listes` et `Import` ont un compte de 0.
- **Échoue si :** le filtre par rôle de `visites-tabs.tsx` saute et le comptoir
  se voit proposer la gestion des listes, qu'il n'a pas le droit d'ouvrir.

**C4 — une URL interdite rend un refus lisible, jamais une page cassée** · P1 ·
`accueil-coque.spec.ts` · ACCUEIL **[dépend des états de rôle]**

- `page.goto('/accueil/listes')` puis `page.goto('/accueil/import')`.
- Assertions, pour chacun : un titre `Accès refusé` (niveau 2) ; l'alerte
  correspondante (`getByRole('alert').filter({ hasText: 'Accès refusé' })`)
  contient `Rôle en cours :` et `Accueil` ; pour `/accueil/listes` elle contient
  `La gestion des listes du registre` ; pour `/accueil/import`,
  `L’import du registre des visites` ; un lien `Retour à l’accueil` porte
  `href="/espaces"`.
- **Échoue si :** `guardRoles` est retiré d'une page, et un agent de comptoir
  peut renommer les listes du registre ou réécrire le registre en masse ; ou si
  le refus n'annonce plus le rôle en cours, laissant l'utilisateur sans rien à
  demander à son administrateur.

**C5 — la section « Plus » se déplie et retient son état** · P2 ·
`accueil-coque.spec.ts` · ADMIN

- `page.goto('/chues')` (la coque Accueil n'a pas de section repliée : elle n'a
  qu'une entrée). Cliquer le résumé `Plus`.
- Assertions : avant le clic, `Contacts recommandés` a un compte de 0 ; après,
  il est visible ; après `page.reload()`, il est **encore** visible (le cookie
  `sidebar-more` a été posé) ; puis replier et vérifier que le rechargement le
  laisse replié.
- **Cible mouvante** : les entrées repliées d'un ADMIN comprennent
  `Lots d’export` (`/chues/campagnes`), susceptible de disparaître. Utiliser
  `Contacts recommandés` comme repère principal, pas `Lots d’export`.
- **Échoue si :** la préférence de repli n'est pas persistée et l'utilisateur
  redéplie « Plus » à chaque navigation ; ou si un écran replié qui est l'écran
  courant reste caché, sa surbrillance devenant invisible.

**C6 — la barre latérale se réduit et se souvient** · P2 ·
`accueil-coque.spec.ts` · ADMIN

- Depuis `/accueil`, cliquer `Réduire la navigation`.
- Assertions : le bouton porte désormais le nom accessible
  `Déployer la navigation` et `aria-expanded="false"` ; le lien
  `Registre des visites` reste atteignable (son libellé passe en `sr-only`,
  donc `getByRole('link', { name: 'Registre des visites' })` le trouve
  toujours) ; après `page.reload()`, la barre est **toujours** réduite (cookie
  lu côté serveur) ; redéployer et vérifier le retour à
  `aria-expanded="true"`.
- **Échoue si :** l'état de repli n'est plus lu côté serveur et la barre saute
  d'une largeur à l'autre à l'hydratation ; ou si le libellé disparaît de
  l'arbre d'accessibilité en mode réduit, rendant la navigation muette au
  lecteur d'écran.
- **Nettoyage obligatoire** : le cookie de repli est partagé avec les autres
  specs. Le test **remet la barre déployée** avant de finir.

**C7 — en 375 px, la navigation passe dans un tiroir** · P2 ·
`accueil-coque.spec.ts` · ACCUEIL **[dépend des états de rôle]**

- `page.setViewportSize({ width: 375, height: 812 })`, `page.goto('/accueil')`.
- Assertions : le bouton `Ouvrir la navigation` est visible ; le cliquer ouvre un
  panneau dont le titre accessible est `Navigation principale` ; y cliquer
  `Registre des visites` referme le panneau (compte de 0 sur le lien) et laisse
  l'URL sur `/accueil`.
- **Échoue si :** le tiroir ne se referme pas après navigation et masque l'écran
  sur lequel on vient d'arriver ; ou si la barre fixe reste affichée sous 768 px
  et vole la moitié de l'écran du comptoir.

**C8 — le lien « Espaces » de la barre supérieure porte le retour** · P2 ·
`accueil-coque.spec.ts` · ADMIN

- Depuis `/accueil/tableau-de-bord`, cliquer le lien `Espaces`.
- Assertions : l'URL est `/espaces?retour=%2Faccueil%2Ftableau-de-bord` ; le
  titre est `Changer d’espace` ; le bouton `Retour` ramène exactement à
  `/accueil/tableau-de-bord`.
- **Échoue si :** l'encodage du retour se perd et l'aller-retour vers le hub
  coûte une navigation en arrière.

**C9 — le titre de la barre supérieure suit la route, préfixe le plus long** ·
P2 · `accueil-coque.spec.ts` · ADMIN

- Table paramétrée : `/accueil` → `Registre des visites` ;
  `/accueil/tableau-de-bord` → `Tableau de bord` ; `/accueil/listes` →
  `Listes` ; `/accueil/import` → `Import du registre`.
- Assertion : `getByRole('heading', { level: 1, name: <attendu>, exact: true })`.
- **Échoue si :** la règle du préfixe le plus long casse et les quatre écrans
  affichent tous « Registre des visites », rendant la barre inutile pour savoir
  où l'on est.

**C10 — la cloche s'ouvre et mène à la boîte de réception** · P2 ·
`accueil-coque.spec.ts` · ACCUEIL **[dépend des états de rôle]**

- Depuis `/accueil`, cliquer le bouton de la cloche
  (`getByRole('button', { name: /notification/i })` — le nom vient de
  `bellLabel(unreadCount)` ; **relever le libellé exact en navigateur avant
  d'écrire**, voir §6 Q3).
- Assertions : le panneau contient le titre `Notifications` ; il contient soit
  une liste, soit l'état vide `Aucune annonce` accompagné de
  `Les rappels et les demandes à traiter apparaîtront ici.` ; le lien
  `Tout voir` mène à `/notifications` et l'écran rendu porte le titre de
  niveau 1 `Notifications`.
- **Échoue si :** la cloche est montrée à un rôle sans boîte de réception et
  « Tout voir » aboutit sur un refus de permission ; ou si l'état vide manque et
  le panneau reste blanc, indistinguable d'un chargement raté.

**C11 — l'agent d'accueil est bien dans `INBOX_ROLES`** · P3 ·
`accueil-coque.spec.ts` · ACCUEIL **[dépend des états de rôle]**

- Depuis `/accueil`, compter les boutons de cloche : exactement 1.
- Contre-épreuve, même spec, session COMMERCIAL si disponible : compte de 0.
- **Échoue si :** `INBOX_ROLES` change et un rôle sans boîte se voit proposer
  une cloche morte.

**C12 — API injoignable : la coque le dit au lieu de blanchir** · P1 ·
`accueil-coque.spec.ts` · ADMIN

- `page.route('**/api/v1/**', route => route.abort('failed'))` **avant** la
  navigation, puis `page.goto('/accueil')`.
- Assertions : un titre `Serveur injoignable` **ou**
  `Session non vérifiée. Réessayez dans un instant.` est rendu dans un
  `role="alert"` ; la page ne reste pas vide ; aucun texte anglais de Next
  n'apparaît.
- Variante interne à l'écran : ne couper que `**/api/v1/visites**` après
  chargement de la coque, recharger, et vérifier que la coque (barre latérale,
  barre supérieure) **reste** rendue tandis que le corps affiche
  `Le registre n’a pas pu être chargé.` avec un bouton `Réessayer`.
- **Échoue si :** une panne d'API produit un écran blanc sans message, ce qui au
  comptoir se traduit par « l'ordinateur ne marche plus » sans plus de
  diagnostic ; ou si l'erreur d'une requête emporte toute la coque.

**C13 — « Réessayer » relance vraiment la requête** · P2 ·
`accueil-coque.spec.ts` · ADMIN

- Couper `**/api/v1/visites?**` (abort), aller sur `/accueil`, constater
  `Le registre n’a pas pu être chargé.` ; rétablir la route
  (`page.unroute`), cliquer `Réessayer`.
- Assertions : le message d'erreur disparaît ; le tableau du registre ou l'état
  vide est rendu ; on n'a **pas** rechargé la page (`page.reload()` interdit
  ici — le but est de prouver le bouton).
- **Échoue si :** le bouton est décoratif et n'appelle pas `refetch`, obligeant
  l'utilisateur à recharger pour sortir d'une erreur passagère.

**C14 — une erreur de rendu montre l'écran « Cet écran n'a pas pu s'afficher »** ·
P2 · `accueil-coque.spec.ts` · ADMIN

- Provoquer une exception de rendu **sans toucher au code applicatif** : servir
  une réponse structurellement invalide sur une route lue par un composant
  client, par exemple `page.route('**/api/v1/tableaux-de-bord/visites/disposition',
  route => route.fulfill({ status: 200, contentType: 'application/json',
  body: '{"widgets":"pas-un-tableau","preset":"essentiel","source":"usine","updatedAt":null}' }))`
  puis `page.goto('/accueil/tableau-de-bord')`.
- Assertions attendues : un `role="alert"` contenant le titre
  `Cet écran n’a pas pu s’afficher`, le texte
  `Rien n’a été perdu et le reste du panneau fonctionne.`, un bouton
  `Réessayer` et un lien `Revenir aux espaces`.
- **Si la charge falsifiée ne déclenche aucune erreur** (l'écran l'absorbe),
  l'agent ne force pas : il rapporte que la frontière d'erreur n'a pas pu être
  atteinte par ce moyen et laisse le scénario non écrit, avec sa raison. Il ne
  modifie **pas** l'application pour la faire échouer.
- **Échoue si :** une exception de composant client remplace tout le panneau par
  la page d'erreur générique de Next, en anglais et sans issue.

---

### 5.4 Espace Accueil — registre des visites (`/accueil`)

Rôles autorisés : ADMIN, DIRECTION, ACCUEIL (`VISITE_REGISTRE_ROLES` côté API).
Refusés : COMMERCIAL, SUPERVISEUR, BANQUE_FINANCE (tuile grisée au hub, et
`Accès refusé` sur l'URL directe — couvert par C4 pour les sous-écrans).
Session de travail : **ACCUEIL**. C'est le rôle qui vit sur cet écran, et c'est
le seul qui n'est partagé avec aucun autre spec de ce plan.
Données : visites `E2E-ACC-REG-<RUN> …`, jamais supprimables.

**D1 — l'écran s'ouvre sur la journée, sans état d'erreur** · P1 ·
`accueil-registre.spec.ts`

- `page.goto('/accueil')`.
- Assertions : le bouton `Ajouter une visite` est visible ; le groupe `Période`
  contient deux bascules, `Aujourd’hui` avec `aria-pressed="true"` et
  `Tout le registre` avec `aria-pressed="false"` ; un titre de niveau 2 se
  termine par `aujourd’hui` ; aucun titre `Serveur injoignable`,
  `Chargement impossible`, `Accès refusé`.
- **Échoue si :** la période par défaut bascule sur tout le registre et le
  comptoir se retrouve devant des milliers de lignes au lieu de sa journée.

**D2 — l'état vide de la journée propose la sortie** · P2 ·
`accueil-registre.spec.ts`

- Se placer sur une journée sans visite : ouvrir `Rechercher`, poser
  `Du` = `Au` = une date passée où le registre est vide (par exemple le
  1er janvier de l'année précédente ; à défaut, une date choisie et vérifiée par
  appel API en précondition).
- Assertions : le titre `Aucune visite pour cette recherche` et la description
  `Élargissez la période ou retirez un filtre.` sont rendus.
- Puis retirer les dates, revenir sur `Aujourd’hui` **avant** toute création : si
  le jour est vide, le titre attendu est
  `Aucune visite enregistrée aujourd’hui`, la description
  `Enregistrez la première ou consultez les visites précédentes.` et un bouton
  `Voir tout le registre` bascule sur `periode=tout`.
- **Échoue si :** les deux états vides sont confondus et le bouton
  « Voir tout le registre » s'affiche sur une recherche filtrée, où il efface
  silencieusement les critères de l'utilisateur.

**D3 — enregistrer une visite, la file d'attente conserve l'entreprise** · P1 ·
`accueil-registre.spec.ts` · **cœur du périmètre**

- Cliquer `Ajouter une visite`. Le dialogue s'ouvre, titre
  `Enregistrer une visite`, formulaire de nom accessible
  `Enregistrer une visite`.
- Remplir : `PRENOM ET NOMS` = `E2E-ACC-REG-<RUN> Awa Diop` ;
  `TELEPHONES` = `78 454 44 66` ; `ENTREPRISE` = `CPI` ; `OBJET VISITE` =
  `SUIVI DE DOSSIER` ; `COMMENTAIRES / NOTES` = `E2E premiere ligne`. Laisser
  `DATE VISITE` et `HEURE VISITE` tels que préremplis.
- Cliquer `Enregistrer la visite`.
- Assertions : un toast contient `enregistrée.` et une référence de la forme
  `V-<année>-<6 chiffres>` (regex ancrée `/^Visite V-\d{4}-\d{6} enregistrée\.$/`) ;
  **le dialogue reste ouvert** ; le champ `PRENOM ET NOMS` est vide et a le
  focus ; le champ `ENTREPRISE` affiche toujours `CPI` ; `OBJET VISITE` est
  revenu à `Choisir` ; le commentaire est vide.
- **Échoue si :** le dialogue se referme après enregistrement — trois visiteurs
  de la même société ne peuvent plus être saisis d'affilée, ce qui est le geste
  quotidien du comptoir ; ou si l'entreprise est réinitialisée avec le reste.

**D4 — la nouvelle visite apparaît en tête du registre** · P1 ·
`accueil-registre.spec.ts` (suite sérielle de D3)

- Fermer le dialogue (`Escape` ou le bouton de fermeture), rechercher
  `E2E-ACC-REG-<RUN>` dans le champ `Recherche` du bloc `Rechercher`.
- Assertions : le tableau contient **exactement une** ligne ; sa cellule
  `PRENOM ET NOMS` vaut `E2E-ACC-REG-<RUN> Awa Diop` ; sa cellule
  `N° REGISTRE` correspond à la référence annoncée par le toast de D3 ; les
  colonnes `ENTREPRISE` et `OBJET VISITE` valent `CPI` et `SUIVI DE DOSSIER`.
- **Échoue si :** l'invalidation de la requête `['visites']` est perdue et la
  visite n'apparaît qu'après un rechargement manuel : l'accueil croit avoir
  perdu la saisie et la refait, créant un doublon.

**D5 — le nom vide est refusé, champ par champ** · P1 ·
`accueil-registre.spec.ts`

- Ouvrir le dialogue, cliquer directement `Enregistrer la visite`.
- Assertions : trois messages, chacun dans un `role="alert"` :
  `À renseigner.` sous `PRENOM ET NOMS`, `À choisir dans la liste.` sous
  `ENTREPRISE` et sous `OBJET VISITE` ; aucune requête `POST /api/v1/visites`
  n'est partie ; le dialogue reste ouvert.
- **Échoue si :** le bouton envoie quand même et l'API répond un 400 qui ne
  nomme aucun champ — l'accueil reste devant un visiteur sans savoir quoi
  corriger.

**D6 — un nom d'un seul caractère est refusé** · P2 ·
`accueil-registre.spec.ts`

- Saisir `A` dans `PRENOM ET NOMS`, quitter le champ (blur).
- Assertion : `Au moins deux caractères.`
- **Échoue si :** la borne client s'écarte de `@MinLength(2)` de
  `CreateVisiteDto` et la seule barrière devient un 400 opaque.

**D7 — la date effacée est signalée** · P1 ·
`accueil-registre.spec.ts`

- Ouvrir le dialogue, effacer la date par la croix du sélecteur `DATE VISITE`,
  remplir le reste correctement, envoyer.
- Assertions : un `role="alert"` `À renseigner.` sous la date ; le dialogue reste
  ouvert ; aucun `POST` n'est parti.
- **Échoue si :** le bouton ne fait rien sans message — c'est le défaut nommé en
  commentaire dans `visite-form.tsx`, et il doit rester corrigé.

**D8 — le commentaire compte ses caractères et s'arrête à 2000** · P3 ·
`accueil-registre.spec.ts`

- Saisir 10 caractères dans `COMMENTAIRES / NOTES`.
- Assertion : la description du champ affiche `10 / 2000 caractères`.
- Coller 2100 caractères : le champ en contient 2000 (`maxLength`), la
  description affiche `2000 / 2000 caractères`, aucun message d'erreur.
- **Échoue si :** le compteur ment ou le plafond disparaît et l'API rejette la
  saisie après coup.

**D9 — les caractères spéciaux et les accents traversent le tour complet** ·
P2 · `accueil-registre.spec.ts`

- Créer une visite nommée `E2E-ACC-REG-<RUN> Ndèye O’Brien-Sy «ç»` avec le
  commentaire `Accents : é à ù — «guillemets» & <balise>`.
- Assertions : le toast annonce la référence ; après recherche sur le préfixe, la
  cellule `PRENOM ET NOMS` affiche **exactement** la chaîne saisie et la cellule
  `COMMENTAIRES / NOTES` **exactement** le commentaire ; la page ne contient
  aucun `&lt;balise&gt;` visible ni balise injectée.
- **Échoue si :** un échappement double s'installe (`O&#39;Brien`) ou une chaîne
  est tronquée à la première apostrophe.

**D10 — les filtres vivent dans l'URL et survivent au rechargement** · P1 ·
`accueil-registre.spec.ts`

- Ouvrir `Rechercher`, saisir `E2E-ACC-REG-<RUN>`, déplier `Filtres avancés`,
  choisir `ENTREPRISE` = `CPI`.
- Assertions : l'URL contient `search=E2E-ACC-REG-<RUN>` et `entrepriseId=<uuid>` ;
  après `page.reload()`, l'URL est identique, le champ de recherche contient
  toujours la valeur, le filtre entreprise affiche `CPI`, et le tableau montre le
  même nombre de lignes qu'avant le rechargement (comparaison de la valeur lue,
  pas d'un nombre écrit en dur).
- **Échoue si :** l'état quitte l'URL : le lien devient impartageable et
  l'impression ne peut plus s'aligner sur ce qui est affiché.

**D11 — une recherche d'un seul caractère n'est pas envoyée** · P2 ·
`accueil-registre.spec.ts`

- Saisir `E` seul dans la recherche.
- Assertions : aucune requête `GET /api/v1/visites` ne part avec un paramètre
  `search` (interception et lecture de l'URL des requêtes) ; le tableau n'affiche
  pas d'erreur.
- **Échoue si :** `SEARCH_MIN_LENGTH` est contourné et l'API répond 400 sur
  chaque frappe, l'écran se couvrant d'erreurs pendant la saisie.

**D12 — la bascule « Tout le registre » élargit et se voit dans l'URL** · P2 ·
`accueil-registre.spec.ts`

- Cliquer `Tout le registre`.
- Assertions : `aria-pressed="true"` sur ce bouton et `false` sur
  `Aujourd’hui` ; l'URL contient `periode=tout` ; le titre de niveau 2 se
  termine par `au registre` (et non `aujourd’hui`) ; le nombre annoncé est
  supérieur ou égal à celui de la journée.
- **Échoue si :** la bascule change l'affichage sans changer l'URL, et un
  rechargement ramène l'utilisateur à la journée sans prévenir.

**D13 — « Retirer les filtres » remet l'écran à zéro** · P2 ·
`accueil-registre.spec.ts`

- Avec une recherche et un filtre entreprise actifs, cliquer
  `Retirer les filtres`.
- Assertions : l'URL n'a plus ni `search` ni `entrepriseId` ; le champ de
  recherche est vide ; le filtre entreprise affiche de nouveau `Toutes` ; la
  bascule `Aujourd’hui` est de nouveau pressée.
- **Échoue si :** le bouton ne retire qu'une partie des critères, et le compteur
  affiché contredit ce que l'écran montre.

**D14 — corriger une visite : la date est montrée, jamais modifiable** · P1 ·
`accueil-registre.spec.ts` (suite sérielle de D3)

- Rechercher son préfixe, cliquer `Modifier la visite de E2E-ACC-REG-<RUN> Awa Diop`.
- Assertions : la ligne devient un formulaire de nom accessible
  `Corriger la visite` ; `DATE VISITE` est un **texte**, pas un sélecteur
  (`getByRole('button', { name: /DATE VISITE/ })` a un compte de 0 dans ce
  formulaire) ; les boutons sont `Enregistrer la correction` et `Annuler`.
- Changer `DESTINATAIRES` pour `MME. NDOYE (RESP. COMM.)`, enregistrer.
- Assertions : un toast `Visite V-…-…… corrigée.` ; la ligne revient en lecture
  et sa cellule `DESTINATAIRES` affiche `MME. NDOYE (RESP. COMM.)` ; la cellule
  `N° REGISTRE` est inchangée.
- **Échoue si :** la date redevient modifiable — l'API refuse de déplacer une
  ligne d'un jour à l'autre, et l'écran promettrait une correction impossible ;
  ou si la correction renvoie tous les champs et échoue dès qu'une entrée de
  référentiel a été retirée depuis.

**D15 — « Annuler » une correction ne modifie rien** · P2 ·
`accueil-registre.spec.ts`

- Ouvrir la correction, changer le nom, cliquer `Annuler`.
- Assertions : la ligne revient en lecture avec **l'ancien** nom ; aucune requête
  `PATCH /api/v1/visites/*` n'est partie.
- **Échoue si :** le bouton enregistre au lieu d'abandonner : une correction
  entamée puis abandonnée écrase la ligne du registre.

**D16 — le tri par colonne change l'URL et l'ordre** · P2 ·
`accueil-registre.spec.ts`

- Sur `Tout le registre`, cliquer l'en-tête `PRENOM ET NOMS`.
- Assertions : l'URL contient `sortBy=visitorName` et `sortDir=asc` ; l'en-tête
  porte `aria-sort="ascending"` ; recliquer donne `sortDir=desc` et
  `aria-sort="descending"` ; la première cellule de nom change entre les deux
  états.
- **Échoue si :** le re-tri client « le plus récent en haut » écrase le
  classement du serveur sur un tri par nom, et l'écran ment sur son ordre.

**D17 — la pagination annonce ce qu'elle montre** · P2 ·
`accueil-registre.spec.ts` · précondition : plus de 100 visites au registre
(`VISITE_PAGE_SIZE = 100`) ; à défaut, le scénario est déclaré **non joué** dans
le retour, avec le nombre réel constaté — il n'est **pas** rendu vert par un
`skip` silencieux.

- Sur `Tout le registre`, lire la ligne `role="status"` de pagination.
- Assertions : elle contient le texte caché `Visites affichées : ` et une plage
  `1–100 sur <total>` ; `Page précédente` est désactivé ; cliquer
  `Page suivante` met l'URL à `page=2` et la plage à `101–…` ; le compteur
  central passe de `1 / N` à `2 / N`.
- **Échoue si :** la plage affichée ne correspond pas à la page servie, et
  l'accueil croit avoir imprimé tout le registre alors qu'il n'en a qu'une page.

**D18 — le bouton « Imprimer » est désactivé quand il n'y a rien à imprimer** ·
P3 · `accueil-registre.spec.ts`

- Se placer sur une recherche sans résultat (voir D2).
- Assertion : le bouton `Imprimer` est désactivé (`toBeDisabled()`).
- **Échoue si :** on peut ouvrir le dialogue d'impression sur zéro ligne et
  produire une feuille vide au visiteur qui attend.

---

### 5.5 Registre — dialogue d'impression

Même route, même rôle, spec séparé pour ne pas mêler impression et saisie.
Précondition : au moins une visite `E2E-ACC-IMP-<RUN>` créée par ce spec, la
recherche filtrée sur son préfixe.

**Avertissement d'environnement.** `window.print()` en Chromium headless ne
produit pas de boîte de dialogue et ne déclenche pas forcément `afterprint`.
Les scénarios ci-dessous n'attendent **jamais** l'événement d'impression : ils
vérifient le DOM et les media queries.

**E1 — le dialogue s'ouvre et annonce la portée** · P2 ·
`accueil-impression.spec.ts`

- Cliquer `Imprimer`.
- Assertions : titre `Préparer l’impression` ; description
  `Les filtres et la période affichés seront conservés.` ; trois groupes de
  champs, légendes `Quoi imprimer`, `Orientation`, `Colonnes` ; l'option
  `La page affichée` est cochée par défaut et sa ligne secondaire annonce
  `<n> visites, environ <p> pages` où `<n>` est le nombre de lignes réellement
  affichées.
- **Échoue si :** le décompte annoncé ne correspond pas au tableau et
  l'utilisateur imprime un volume qu'il n'attendait pas.

**E2 — les deux colonnes d'identité ne peuvent pas être décochées** · P1 ·
`accueil-impression.spec.ts`

- Dans le groupe `Colonnes`, tenter de décocher `DATE VISITE` puis
  `PRENOM ET NOMS`.
- Assertions : les deux cases sont **désactivées** (`toBeDisabled()`) et restent
  cochées ; les neuf autres (`N° REGISTRE`, `HEURE VISITE`, `TELEPHONES`,
  `ENTREPRISE`, `DIRECTION`, `DESTINATAIRES`, `OBJET VISITE`,
  `COMMENTAIRES / NOTES`) se décochent.
- **Échoue si :** `IMPRESSION_COLONNES_VERROUILLEES` est vidé : la feuille
  imprimée n'identifie plus ni le jour ni la personne, et ce n'est plus un
  registre.

**E3 — décocher une colonne la retire de la feuille** · P2 ·
`accueil-impression.spec.ts`

- Décocher `COMMENTAIRES / NOTES`, fermer le dialogue par `Annuler`, puis
  `page.emulateMedia({ media: 'print' })`.
- Assertions : en média `print`, la cellule de commentaire de la ligne
  `E2E-ACC-IMP-<RUN>` n'est pas visible, tandis que sa cellule
  `PRENOM ET NOMS` l'est ; revenir en média `screen` les rend toutes les deux
  visibles.
- **Échoue si :** la classe `print:hidden` cesse d'être posée et l'accueil
  imprime des notes internes qu'il voulait masquer.

**E4 — l'orientation choisie est écrite dans la règle `@page`** · P3 ·
`accueil-impression.spec.ts`

- Choisir `Portrait`, fermer par `Annuler`.
- Assertion : l'élément `style[media="print"]` de la page contient
  `size: portrait` ; après avoir choisi `Paysage`, il contient `size: landscape`.
- **Échoue si :** le choix d'orientation n'a aucun effet et le registre à onze
  colonnes s'imprime tronqué en portrait.

**E5 — l'écran d'impression masque ce qui n'est pas le registre** · P2 ·
`accueil-impression.spec.ts`

- `page.emulateMedia({ media: 'print' })` sur `/accueil`.
- Assertions : le bouton `Ajouter une visite`, la section
  `Rechercher dans le registre`, la navigation `Visites` et la colonne
  `CORRIGER` ne sont pas visibles ; le tableau des visites l'est.
- **Échoue si :** la feuille imprimée sort avec les boutons de l'interface, ce
  qui la rend inutilisable comme registre papier.

**E6 — « Tout le résultat filtré » charge toutes les pages avant d'imprimer** ·
P2 · `accueil-impression.spec.ts` · précondition : plus de 200 lignes dans le
filtre courant (`TAILLE_PAGE_IMPRESSION = 200`). À défaut : scénario **non joué**,
déclaré comme tel.

- Choisir `Tout le résultat filtré`, cliquer `Ouvrir l’impression`.
- Assertions : pendant le chargement, un `role="progressbar"` est rendu avec
  `aria-valuemax` égal au nombre de pages et le texte
  `Chargement des visites… page X sur Y` ; à la fin, le bloc d'impression caché
  contient `Registre des visites : ` suivi du libellé de période, et autant de
  lignes que le total annoncé.
- **Échoue si :** `window.print()` est appelé avant que React ait commité le
  tableau complet — la feuille ne contient alors que la page affichée, sans
  erreur ni indice.

**E7 — au-delà de 3000 visites, l'impression totale est refusée** · P2 ·
`accueil-impression.spec.ts` · précondition : `PLAFOND_IMPRESSION_TOTALE = 3000`
dépassé sur `Tout le registre`. Sinon : **non joué**, déclaré.

- Assertions : l'option `Tout le résultat filtré` est désactivée ; un
  `role="alert"` affiche `<n> visites : trop pour une impression. Réduisez la
  période, ou exportez en Excel.`
- **Échoue si :** le plafond saute et le navigateur se fige en chargeant
  quinze pages de deux cents lignes.

---

### 5.6 Espace Accueil — tableau de bord composable (`/accueil/tableau-de-bord`)

Rôles autorisés : ADMIN, DIRECTION, ACCUEIL (garde de page) ; l'API
`tableaux-de-bord` ouvre en plus au SUPERVISEUR, mais l'écran lui est fermé.
Refusés : COMMERCIAL, SUPERVISEUR, BANQUE_FINANCE.
Session de travail : **ACCUEIL** — sa disposition n'est lue par aucun autre spec.
`accessibility.spec.ts` visite cet écran avec la session **ADMIN** : ne jamais
enregistrer de disposition sur le compte admin.

**F1 — l'écran se charge sur le mois en cours** · P1 ·
`accueil-tableau-de-bord.spec.ts`

- `page.goto('/accueil/tableau-de-bord')`.
- Assertions : titre de niveau 1 `Tableau de bord` ; dans le groupe
  `Période affichée`, le bouton `Ce mois-ci` porte `aria-pressed="true"` ; la
  ligne `aria-live="polite"` affiche `Ce mois-ci` ; un bouton
  `Organiser les graphiques` et un bouton `Exporter le détail` sont visibles ;
  aucun titre d'erreur.
- **Échoue si :** le préréglage par défaut change sans que le libellé annoncé
  suive, et l'utilisateur lit des chiffres d'une autre période que celle qu'il
  croit.

**F2 — les six préréglages écrivent la période dans l'URL** · P2 ·
`accueil-tableau-de-bord.spec.ts`

- Table paramétrée sur les six boutons : `Ce mois-ci` → `periode=ce-mois`,
  `Mois dernier` → `mois-dernier`, `3 derniers mois` → `trois-mois`,
  `12 derniers mois` → `douze-mois`, `Cette année` → `cette-annee`,
  `Année dernière` → `annee-derniere`.
- Assertions : l'URL contient le paramètre attendu ; la ligne `aria-live`
  affiche le libellé du bouton ; `aria-pressed` est vrai sur lui seul.
- **Échoue si :** deux boutons produisent la même plage, ou l'URL ne suit pas et
  le rechargement ramène au mois en cours.

**F3 — une plage libre survit au rechargement** · P2 ·
`accueil-tableau-de-bord.spec.ts`

- Ouvrir `Plage libre`, poser `Du` et `Au` sur deux dates du mois précédent.
- Assertions : l'URL contient `periode=libre&du=<iso>&au=<iso>` ; la ligne
  `aria-live` affiche `<jj mmm aaaa> – <jj mmm aaaa>` en français
  (`dd MMM yyyy`, locale `fr`) ; après `page.reload()`, l'URL et le libellé sont
  identiques.
- **Échoue si :** la plage libre est perdue au rechargement, ou le libellé
  s'affiche en anglais malgré la locale.

**F4 — une plage de plus de 400 jours est refusée avant l'appel** · P1 ·
`accueil-tableau-de-bord.spec.ts`

- Poser une plage libre de 500 jours.
- Assertions : un `role="alert"` affiche
  `Cette plage dépasse 400 jours (500 jours) : revenez à une période plus courte.` ;
  **aucune** requête `GET /api/v1/visites/statistiques` n'est partie avec ces
  bornes (la requête est désactivée par `enabled: !tropLarge`).
- **Échoue si :** la garde client saute et l'API répond
  `VISITE_STATS_RANGE_TOO_WIDE` : l'écran affiche une erreur brute là où il
  devait guider.

**F5 — le sélecteur de comparaison change l'URL** · P3 ·
`accueil-tableau-de-bord.spec.ts`

- Ouvrir le sélecteur `Comparer à`, choisir
  `Comparer à : période précédente`.
- Assertions : l'URL contient `comparaison=precedente` ; choisir
  `Comparer à : rien` retire le paramètre.
- **Échoue si :** la comparaison n'est pas partageable par lien, ou l'option
  choisie n'est pas celle affichée.

**F6 — le mode Organiser s'ouvre et annonce son état** · P1 ·
`accueil-tableau-de-bord.spec.ts`

- Cliquer `Organiser les graphiques`.
- Assertions : le texte `Mode organisation` est rendu ; les boutons
  `Ajouter un graphique`, `Quitter` et `Enregistrer` sont visibles ;
  `Exporter le détail` et `Organiser les graphiques` ne le sont plus ; le bouton
  `Proposer par défaut` est **absent** pour un compte ACCUEIL (réservé ADMIN).
- Recouvrement partiel : `accessibility.spec.ts` entre déjà dans ce mode pour
  l'audit axe, sous session ADMIN. Ne pas réauditer axe ici.
- **Échoue si :** un compte non administrateur se voit proposer de fixer la
  disposition par défaut de tous les comptes.

**F7 — ajouter un graphique depuis le tiroir des sources** · P1 ·
`accueil-tableau-de-bord.spec.ts`

- En mode Organiser, cliquer `Ajouter un graphique` ; le tiroir s'ouvre, titre
  `Ajouter un graphique`, description
  `Choisissez ce que vous voulez suivre. L’image montre la forme conseillée.`
- Choisir une source absente de la disposition, par exemple `Par heure`.
- Assertions : le tiroir se ferme ; une carte titrée `Par heure` apparaît dans la
  grille et **reçoit le focus** ; le bouton `Enregistrer` est actif.
- **Échoue si :** la source ajoutée n'est pas défilée ni focalisée et disparaît
  hors de l'écran, l'utilisateur croyant que le clic n'a rien fait ; ou si une
  source déjà placée reste proposée, ce que l'API refuse (contrainte d'unicité
  des sources).

**F8 — la disposition enregistrée survit à un rechargement** · P1 ·
`accueil-tableau-de-bord.spec.ts` · **le scénario central de cet écran**

- Depuis F7, cliquer `Enregistrer`.
- Assertions : le mode Organiser se ferme (`Mode organisation` a un compte de 0) ;
  le bouton `Revenir à la disposition par défaut` **apparaît** (la disposition
  vient désormais de l'utilisateur) ; après `page.reload()`, la carte `Par heure`
  est toujours présente ; contre-preuve par l'API : `GET
  /api/v1/tableaux-de-bord/visites/disposition` renvoie `source: "utilisateur"`
  et une liste de `widgets` contenant `par-heure`.
- **Échoue si :** la disposition sauvegardée n'est pas rechargée après F5 —
  l'utilisateur réorganise son écran à chaque ouverture ; ou si `serializeWidget`
  laisse fuir la clé cliente `id`, que `forbidNonWhitelisted` rejette en 400
  silencieux.

**F9 — retirer un graphique et enregistrer** · P2 ·
`accueil-tableau-de-bord.spec.ts` (suite sérielle de F8)

- Rentrer en mode Organiser, cliquer `Retirer Par heure`, `Enregistrer`.
- Assertions : la carte `Par heure` disparaît ; après rechargement elle est
  toujours absente ; l'API ne la renvoie plus.
- **Échoue si :** le retrait n'est visuel que jusqu'au rechargement.

**F10 — quitter sans enregistrer demande confirmation et rétablit** · P1 ·
`accueil-tableau-de-bord.spec.ts`

- Entrer en mode Organiser, ajouter une source, cliquer `Quitter`.
- Assertions : une boîte de confirmation titrée `Quitter sans enregistrer` avec
  la description `Les changements faits dans ce mode seront perdus.` et le bouton
  `Quitter sans enregistrer` ; le confirmer ramène la grille à son état
  antérieur (la source ajoutée n'est plus là) ; l'API n'a reçu aucun
  `PUT /tableaux-de-bord/visites/disposition`.
- Contre-épreuve : entrer en mode Organiser **sans rien modifier** et cliquer
  `Quitter` : aucune confirmation, sortie directe.
- **Échoue si :** la confirmation s'affiche alors que rien n'a changé (elle
  devient un réflexe qu'on clique sans lire), ou n'apparaît pas quand du travail
  serait perdu.

**F11 — « Revenir à la disposition par défaut » efface la sienne** · P2 ·
`accueil-tableau-de-bord.spec.ts` · **nettoyage obligatoire de ce spec**

- Cliquer `Revenir à la disposition par défaut`.
- Assertions : le bouton disparaît ; l'API renvoie `source: "defaut"` ou
  `"usine"` ; après rechargement, la grille correspond à cette disposition.
- Ce scénario est **le dernier** du fichier : il remet le compte ACCUEIL dans son
  état d'origine.
- **Échoue si :** la remise à zéro ne supprime que l'affichage et la disposition
  personnelle réapparaît au rechargement suivant.

**F12 — l'export CSV du détail produit un vrai fichier** · P2 ·
`accueil-tableau-de-bord.spec.ts`

- Cliquer `Exporter le détail` en attendant l'événement `download`.
- Assertions : le nom du fichier correspond à
  `/^cpi-visites-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/` ; le fichier
  téléchargé commence par la ligne `Visites du <du> au <au>` et contient une
  ligne `Total`.
- **Échoue si :** le bouton n'attache rien, ou produit un CSV vide quand la
  période ne contient aucune visite (le fichier doit exister avec `Total,0`).

**F13 — « Proposer par défaut » est réservé à l'administrateur** · P2 ·
`accueil-tableau-de-bord.spec.ts` · session ACCUEIL

- En mode Organiser, compter les boutons `Proposer par défaut` : **0**.
- **Le geste lui-même n'est jamais exécuté**, à aucun rôle : il modifie la
  disposition de tous les comptes qui n'en ont pas enregistré (§3.3.4). Le
  scénario prouve seulement son absence pour un non-administrateur.
- **Échoue si :** le bouton apparaît à un rôle non administrateur ; l'API le
  refuserait, mais l'écran aurait promis un geste impossible.

**F14 — l'écran est utilisable en 375 px** · P3 ·
`accueil-tableau-de-bord.spec.ts`

- `setViewportSize({ width: 375, height: 812 })`, recharger.
- Assertions : le groupe `Période affichée` reste atteignable (les boutons
  passent à la ligne, ils ne sont pas coupés : chaque bouton de préréglage est
  visible) ; `Organiser les graphiques` est visible et cliquable ; aucune barre
  de défilement horizontale sur le document
  (`document.documentElement.scrollWidth <= clientWidth`).
- **Échoue si :** la grille déborde et une carte devient inatteignable sur le
  téléphone du comptoir.

---

### 5.7 Espace Accueil — listes du registre (`/accueil/listes`)

Rôles autorisés : ADMIN, DIRECTION uniquement (`LISTES_ROLES` côté API,
`guardRoles(['ADMIN','DIRECTION'])` côté page). Refusés : ACCUEIL (couvert par
C4), tous les autres. Session de travail : **DIRECTION** (l'ADMIN est trop
partagé ; la Direction n'est utilisée par aucun autre spec de ce plan).
Données : une entrée par liste, code `E2E_ACC_LST_<RUN>_ENTREPRISE`, etc.

**G1 — l'écran ouvre sur les entreprises** · P1 ·
`accueil-listes.spec.ts`

- `page.goto('/accueil/listes')`.
- Assertions : titre de document `Listes du registre des visites` ; texte
  d'introduction
  `Les quatre listes proposées à la saisie du registre. Une entrée retirée reste lisible sur les visites déjà enregistrées, et disparaît de la saisie.` ;
  quatre onglets `Entreprises`, `Directions`, `Destinataires`,
  `Objets de visite` ; l'onglet `Entreprises` est sélectionné ; le titre de
  niveau 2 est `Entreprises` avec la description
  `La société ou l’organisme visité.` ; un bouton `Nouvelle entreprise`.
- **Échoue si :** un onglet manque ou l'onglet par défaut change sans que l'URL
  le reflète.

**G2 — changer d'onglet écrit l'URL et accorde les libellés** · P2 ·
`accueil-listes.spec.ts`

- Table paramétrée sur les quatre onglets.
- Assertions : `Entreprises` → pas de paramètre `onglet` (valeur par défaut),
  bouton `Nouvelle entreprise` ; `Directions` → `?onglet=directions`, bouton
  `Nouvelle direction`, description `Le service concerné par la visite, quand il est connu.` ;
  `Destinataires` → `?onglet=destinataires`, bouton `Nouveau destinataire`,
  description `La personne demandée par le visiteur.` ; `Objets de visite` →
  `?onglet=objets`, bouton `Nouvel objet`, description `Le motif de la visite.`
- **Échoue si :** un accord de genre est faux (« Nouveau entreprise ») ou l'URL
  ne suit pas l'onglet, rendant le lien impartageable.

**G3 — créer une entrée : le code est obligatoire et normalisé** · P1 ·
`accueil-listes.spec.ts`

- Cliquer `Nouvelle entreprise` ; le dialogue s'ouvre, titre
  `Nouvelle entreprise`, description `Le code est définitif, utile pour l’export.`
- Cliquer `Enregistrer` sans rien saisir.
- Assertions : `Le code est obligatoire.` sous `Code` et
  `Le libellé est obligatoire.` sous `Libellé` ; aucune requête `POST` partie.
- Saisir le code en minuscules `e2e_acc_lst_<RUN>_ent` et le libellé
  `E2E ACC LST <RUN> Entreprise`, enregistrer.
- Assertions : toast `E2E ACC LST <RUN> Entreprise ajouté.` ; le dialogue se
  ferme ; la ligne apparaît dans la liste avec le texte
  `Code E2E_ACC_LST_<RUN>_ENT` (le code a été mis en majuscules par le schéma).
- **Échoue si :** la normalisation en majuscules disparaît et l'API refuse en 400
  sur `CODE_PATTERN`, sans que l'écran dise quoi corriger.

**G4 — un code invalide est refusé avec sa règle** · P2 ·
`accueil-listes.spec.ts`

- Saisir le code `E2E-ACC` (tiret interdit), libellé valide, enregistrer.
- Assertion : `Majuscules, chiffres et tirets bas seulement.`
- **Échoue si :** la règle client s'écarte de `CODE_PATTERN` côté serveur.

**G5 — un code déjà pris est signalé par un message, pas par un silence** · P1 ·
`accueil-listes.spec.ts` (suite sérielle de G3)

- Recréer une entrée avec **le même code** que G3.
- Assertions : un toast d'erreur est affiché ; il porte le message du serveur
  (409 `VISITE_REFERENTIEL_CODE_CONFLICT`) ou, à défaut,
  `Un enregistrement existe déjà avec ces valeurs.` ; le dialogue **reste
  ouvert** ; la liste ne contient toujours qu'**une** entrée portant ce code.
- **Échoue si :** le toast dit succès alors que l'API a répondu 409, et la
  Direction croit avoir ajouté une entrée qui n'existe pas ; ou si le dialogue
  se ferme en effaçant la saisie.

**G6 — renommer une entrée sans toucher au code** · P2 ·
`accueil-listes.spec.ts` (suite sérielle de G3)

- Cliquer `Modifier E2E ACC LST <RUN> Entreprise`.
- Assertions : titre `Renommer « E2E ACC LST <RUN> Entreprise »` ; description
  `Le code reste inchangé : les visites déjà enregistrées le désignent.` ; le
  champ `Code` **n'est pas rendu** (compte de 0).
- Renommer en `E2E ACC LST <RUN> Entreprise bis`, enregistrer.
- Assertions : toast `E2E ACC LST <RUN> Entreprise bis enregistré.` ; la ligne
  affiche le nouveau libellé et **toujours** `Code E2E_ACC_LST_<RUN>_ENT`.
- **Échoue si :** le code devient modifiable et les visites déjà enregistrées qui
  le désignent perdent leur référence.

**G7 — la recherche filtre sans accent ni casse** · P2 ·
`accueil-listes.spec.ts`

- Saisir `e2e acc lst <RUN>` dans le champ `Rechercher` (placeholder
  `Nom ou code…`).
- Assertions : l'URL contient `recherche=…` ; la liste ne contient que les
  entrées du test ; saisir un terme sans résultat affiche
  `Aucune entrée ne correspond à cette recherche.`
- **Échoue si :** la recherche est sensible aux accents et la Direction ne
  retrouve pas `FINANCE & COMPTABILITE` en tapant « comptabilité ».

**G8 — la recherche désactive le glisser-déposer** · P2 ·
`accueil-listes.spec.ts`

- Avec une recherche active, viser la poignée
  `Réordonner <libellé> par glisser-déposer`.
- Assertion : elle est désactivée (`toBeDisabled()`).
- **Échoue si :** on peut réordonner une liste filtrée et l'ordre enregistré ne
  correspond plus à ce qu'on croyait déplacer.

**G9 — monter et descendre une entrée au clavier** · P1 ·
`accueil-listes.spec.ts` (suite sérielle de G3)

- Sans recherche active, relever la position de l'entrée du test, cliquer
  `Monter <libellé>`.
- Assertions : l'entrée est passée avant sa voisine précédente (comparaison de
  l'ordre des textes de la liste `ol` avant/après) ; après `page.reload()`,
  l'ordre est conservé ; l'entrée en première position a son bouton
  `Monter …` désactivé, la dernière son bouton `Descendre …` désactivé.
- **Contrainte de données** : ne déplacer **que** l'entrée du test, et la
  redescendre en fin de scénario. Ne jamais déplacer une entrée
  `Classeur d’origine`.
- **Échoue si :** le réordonnancement n'est pas persisté (l'API `reorder` n'est
  pas appelée ou son erreur est avalée) et la liste retrouve son ordre au
  rechargement.

**G10 — désactiver une entrée exige le décompte et le montre** · P1 ·
`accueil-listes.spec.ts`

- Cliquer `Désactiver <libellé du test>`.
- Assertions : titre `Désactiver « <libellé> » ?` ; description
  `Retirée des listes de saisie. Reste disponible en filtre et en export.` ; un
  encart chiffré `0 visites référencent cette entreprise.` (accord :
  `1 visite référence cette entreprise.` au singulier) ; l'encart d'information
  `Aucune visite n’est supprimée.` ; les boutons `Annuler` et `Désactiver`.
- Confirmer.
- Assertions : toast `<libellé> désactivé.` ; la ligne porte le badge `Retirée` ;
  son bouton d'action s'appelle désormais `Réactiver <libellé>`.
- **Échoue si :** le décompte affiche `0` alors que l'appel a échoué (le
  composant doit alors afficher
  `Le nombre de fiches concernées n’a pas pu être lu.` et remplacer le bouton par
  `Réessayer le décompte`) — une Direction retirerait d'un clic une entrée
  portée par des milliers de visites.

**G11 — le décompte indisponible bloque la désactivation** · P1 ·
`accueil-listes.spec.ts`

- `page.route('**/api/v1/visites/referentiels/usage', route => route.abort('failed'))`,
  recharger, ouvrir la désactivation d'une entrée du test.
- Assertions : le `role="alert"` contient
  `Le nombre de fiches concernées n’a pas pu être lu.` ; le bouton `Désactiver`
  a un compte de **0** ; un bouton `Réessayer le décompte` est proposé.
- **Échoue si :** l'écran affiche `0` par défaut quand le décompte manque : c'est
  exactement le défaut que le commentaire du composant dit avoir corrigé.

**G12 — une entrée retirée disparaît de la saisie mais reste lisible** · P1 ·
`accueil-listes.spec.ts` (suite sérielle de G10)

- Aller sur `/accueil`, ouvrir `Ajouter une visite`, ouvrir le champ
  `ENTREPRISE`.
- Assertions : l'option `E2E ACC LST <RUN> Entreprise bis` a un compte de **0**
  dans la liste des options ; en revanche, dans le filtre `ENTREPRISE` du bloc
  `Filtres avancés` du registre… **à vérifier en navigateur** : les deux
  composants tirent le même `GET /visites/referentiels` avec `activeOnly=true`
  par défaut (voir §6 Q5).
- **Échoue si :** une entrée retirée reste proposée à la saisie — la
  désactivation ne sert alors à rien.

---

### 5.8 Espace Accueil — import du registre (`/accueil/import`)

Rôles autorisés : ADMIN, DIRECTION. Refusés : ACCUEIL (couvert par C4) et tous
les autres. Session de travail : **DIRECTION**.
Attention : `POST /visites/import` est limité à **5 dépôts par minute**. Ce spec
n'en fait pas plus de trois.

**Fabrication du classeur.** Le lecteur d'import commence à la **ligne 3**
(`FIRST_DATA_ROW = 3`). Un classeur construit avec `buildXlsx` doit donc être :

```
ligne 1 : les 11 en-têtes, dans l'ordre
          N° REGISTRE, DATE VISITE, HEURE VISITE, PRENOM ET NOMS, TELEPHONES,
          ENTREPRISE, DIRECTION, DESTINATAIRES, OBJET VISITE,
          COMMENTAIRES / NOTES, SAISIE LE
ligne 2 : une ligne de remplissage (le vrai export y met un rappel)
ligne 3+ : les données
```

Nom de feuille : `Registre` (motif `/^Registre/i`).
`buildXlsx` (`e2e/xlsx.ts`) suffit ; **ne pas le modifier** (§3.1.2).

**H1 — l'écran présente ses quatre temps** · P1 ·
`accueil-import.spec.ts`

- `page.goto('/accueil/import')`.
- Assertions : titre de document `Import du registre des visites` ; cartes
  `1. Exporter le registre` et `2. Déposer le classeur corrigé` ; la zone de
  dépôt annonce `Glissez le classeur ici, ou choisissez un fichier` et
  `Format .xlsx, 25 Mo au maximum.` ; un bouton
  `Exporter le registre filtré` ; **aucune** carte `3. Analyse` ni `4. Revue`
  avant dépôt.
- **Échoue si :** l'écran affiche un panneau d'analyse vide au chargement, ou
  perd la promesse « rien n'est écrit tant que vous n'avez pas confirmé ».

**H2 — l'export filtré produit un vrai classeur** · P1 ·
`accueil-import.spec.ts`

- Poser `Du` et `Au` sur le jour courant, cliquer `Exporter le registre filtré`
  en attendant l'événement `download`.
- Assertions : le nom du fichier correspond à
  `/^cpi-registre-visites-\d{4}-\d{2}-\d{2}\.xlsx$/` ; sa taille dépasse 1 000
  octets ; ses quatre premiers octets sont `50 4B 03 04` (signature ZIP) ; un
  toast `Fichier généré.` est affiché.
- **Échoue si :** un 502 relayé tel quel est téléchargé sous le nom `.xlsx` — ce
  que seule la signature binaire distingue d'un vrai classeur.

**H3 — un fichier trop lourd est refusé avant l'envoi** · P2 ·
`accueil-import.spec.ts`

- Déposer via `setInputFiles` un tampon de 26 Mo nommé `gros.xlsx`.
- Assertions : un toast `Fichier trop volumineux : 25 Mo au maximum.` ; **aucune**
  requête `POST /api/v1/visites/import` n'est partie.
- **Échoue si :** le garde client saute et l'API répond 413 après un envoi de
  26 Mo, sur une connexion de comptoir.

**H4 — un classeur identique au registre ne propose rien à appliquer** · P2 ·
`accueil-import.spec.ts` · précondition : au moins une visite
`E2E-ACC-XLS-<RUN>` créée par appel API, puis exportée

- Déposer le classeur exporté **sans le modifier**.
- Assertions : la carte `3. Analyse · déposé le <date>` apparaît avec le badge
  `Simulation` ; pendant le travail, `Lecture du fichier…` ; à la fin,
  `Analyse terminée, le <date>.` ; les quatre chiffres `À créer`, `À corriger`,
  `Inchangées`, `Refusées` sont rendus, avec `À créer` = 0 et `À corriger` = 0 ;
  le texte `Votre classeur est identique au registre. Rien à appliquer.` est
  affiché ; **aucune** carte `4. Revue`.
- **Échoue si :** un aller-retour sans modification produit des différences —
  signe que l'export et le lecteur d'import ne s'accordent pas sur un format
  (date, heure, libellé), et que la Direction s'apprête à réécrire tout son
  registre.

**H5 — une création se détecte, se revoit et s'applique** · P1 ·
`accueil-import.spec.ts` · **le parcours central**

- Fabriquer un classeur avec **une** ligne de données, `N° REGISTRE` vide, date
  du jour, `PRENOM ET NOMS` = `E2E-ACC-XLS-<RUN> Fatou Sarr`,
  `ENTREPRISE` = `CPI`, `OBJET VISITE` = `SUIVI DE DOSSIER`. Déposer.
- Assertions après analyse : `À créer` = 1 ; la carte `4. Revue` apparaît avec la
  description `1 différence · 0 correction · 1 création` ; la ligne de revue
  porte le libellé `E2E-ACC-XLS-<RUN> Fatou Sarr, <jj/mm/aaaa>` (ou
  `…, jj/mm hh:mm` si une heure est fournie), un badge `Création`, le texte
  `ligne 3` et une case **cochée** ; le bouton d'application s'intitule
  `Appliquer 1 création`.
- Cliquer ce bouton : un dialogue titré `Appliquer 1 création ?` avec la
  description `Cette action écrit les visites cochées en base et ne s’annule pas.`
  et un encart `1 visite créée à partir de « <nom du fichier> ».`
- Confirmer : toast `Application lancée. L’écran suit son avancement.` ; puis
  l'encart de succès `1 visite créée, 0 corrigée.`
- Contre-preuve navigateur : aller sur `/accueil`, chercher
  `E2E-ACC-XLS-<RUN>`, constater **une** ligne portant ce nom et un
  `N° REGISTRE` non vide.
- **Échoue si :** la simulation écrit en base (la promesse centrale de l'écran) —
  détectable en vérifiant, **avant** de confirmer, que `/accueil` ne contient pas
  encore la ligne ; ou si l'application ne crée rien alors que l'écran annonce un
  succès.

**H6 — une correction montre l'avant et l'après** · P2 ·
`accueil-import.spec.ts` (suite sérielle de H5)

- Réexporter le registre filtré sur le préfixe du test, modifier dans le classeur
  fabriqué la colonne `COMMENTAIRES / NOTES` de la ligne créée en H5 (en
  conservant son `N° REGISTRE`), redéposer.
- Assertions : `À corriger` = 1, `À créer` = 0 ; la ligne de revue porte le badge
  `Correction` et une ligne de détail
  `COMMENTAIRES / NOTES : « <avant> » → « <après> »` ; le bouton s'intitule
  `Appliquer 1 correction`.
- **Échoue si :** le différentiel affiche l'avant et l'après inversés, ou nomme
  une colonne qui n'a pas changé : la Direction valide alors une correction
  qu'elle n'a pas voulue.

**H7 — un numéro de registre inconnu est refusé, pas replié en création** · P1 ·
`accueil-import.spec.ts`

- Classeur d'une ligne avec `N° REGISTRE` = `V-1999-000001` (inexistant).
- Assertions : `Refusées` = 1 et `À créer` = 0 ; le bloc `Lignes refusées`
  apparaît avec le tableau `Ligne` / `Colonne` / `Motif` ; la ligne 3 y figure ;
  la colonne citée est `N° REGISTRE`.
- **Échoue si :** une coquille sur un numéro produit une visite fantôme que
  personne ne cherchait.

**H8 — décocher une ligne change le libellé du bouton** · P2 ·
`accueil-import.spec.ts`

- Sur une revue à deux différences (une création, une correction), décocher la
  création.
- Assertions : le bouton passe de `Appliquer 1 correction et 1 création` à
  `Appliquer 1 correction` ; tout décocher donne `Rien à appliquer` et le bouton
  est **désactivé**.
- **Échoue si :** le bouton annonce un nombre qui ne correspond pas à ce qui sera
  écrit — l'écran ment sur une action irréversible.

**H9 — « Tout cocher » et « Tout décocher » portent sur toutes les pages** · P2 ·
`accueil-import.spec.ts` · précondition : plus de 50 différences
(`VISITES_IMPORT_REVUE_PAGE_SIZE = 50`) ; sinon **non joué**, déclaré

- Cliquer `Tout décocher` puis `Tout cocher`.
- Assertions : après « Tout décocher », le bouton d'application affiche
  `Rien à appliquer` ; après « Tout cocher », il affiche le total exact des
  différences ; la page 2 de la revue montre les mêmes cases que la page 1.
- **Échoue si :** la sélection ne porte que sur la page affichée et la Direction
  applique 50 lignes en croyant en appliquer 300.

**H10 — la revue se pagine** · P3 ·
`accueil-import.spec.ts` · même précondition que H9

- Cliquer `Page suivante`.
- Assertions : le compteur passe de `1 / N` à `2 / N` ; `Page précédente` devient
  actif ; le `role="status"` annonce `<total> différences`.
- **Échoue si :** la pagination affiche toujours la première page et les
  différences au-delà de la cinquantième sont invisibles.

**H11 — « Déposer un autre fichier » remet l'écran à zéro** · P3 ·
`accueil-import.spec.ts`

- Après une analyse, cliquer `Déposer un autre fichier`.
- Assertions : les cartes `3. Analyse` et `4. Revue` disparaissent ; le champ de
  fichier reprend le focus ; les cartes 1 et 2 restent.
- **Échoue si :** l'écran garde le travail précédent et la Direction croit
  analyser son nouveau fichier alors qu'elle lit l'ancien.

**H12 — un dépôt refusé par le serveur le dit** · P2 ·
`accueil-import.spec.ts`

- `page.route('**/api/v1/visites/import', route => route.fulfill({ status: 400,
  contentType: 'application/json', body: '{"message":"Feuille Registre introuvable."}' }))`,
  puis déposer un classeur valide.
- Assertions : un toast d'erreur contenant `Feuille Registre introuvable.` (le
  message du serveur, pas le repli) ; aucune carte `3. Analyse` n'apparaît.
- **Échoue si :** le message du serveur est écrasé par le repli
  `Le classeur n’a pas pu être déposé.` et la Direction ne sait pas quoi corriger
  dans son fichier.

---

### 5.9 Espace démo : isolation prouvée

Rôle : ADMIN seul (`POST /admin/demo/reset` et le bascule d'espace).
Spec propriétaire : `accueil-demo-isolation.spec.ts`, `mode: 'serial'`.
Ce spec est **le seul** autorisé à basculer la session en démo dans ce plan, et
il la remet en public dans un `afterAll` inconditionnel.

Recouvrement : `workspaces.spec.ts` couvre déjà la réinitialisation et la
bascule aller-retour (`« l'espace démo se réinitialise et reste isolé »`), mais
**ne prouve pas l'isolation** : il ne fait qu'entrer et sortir. C'est ce qui
manque, et c'est le sujet ci-dessous.

**I1 — une visite écrite en démo n'apparaît pas en public** · P1 ·
`accueil-demo-isolation.spec.ts`

- Basculer en démo (menu utilisateur → `Ouvrir l’espace démo`), attendre le
  bandeau `role="status"` contenant `Espace démo` et le texte
  `Données fictives. Les e-mails et les exports intégraux sont désactivés.`
- Aller sur `/accueil`, enregistrer une visite
  `E2E-ACC-DEMO-<RUN> Visiteur Demo`, entreprise et objet au choix parmi les
  entrées du jeu de démonstration.
- Assertions : le toast annonce une référence ; une recherche sur le préfixe en
  **démo** renvoie exactement une ligne.
- Quitter la démo (`Quitter l’espace démo`), attendre la disparition du bandeau.
- Assertions : sur `/accueil`, bascule `Tout le registre` et recherche du même
  préfixe → **zéro** ligne ; l'état vide `Aucune visite pour cette recherche` est
  rendu.
- **Échoue si :** le schéma `demo` fuit dans `public` — c'est exactement la
  régression corrigée récemment, et rien d'autre ne la surveille.

**I2 — une visite écrite en public n'apparaît pas en démo** · P1 ·
`accueil-demo-isolation.spec.ts` (suite sérielle)

- En espace public, enregistrer `E2E-ACC-DEMO-<RUN> Visiteur Public`.
- Basculer en démo, chercher le même préfixe sur `Tout le registre`.
- Assertion : zéro ligne portant `Visiteur Public`.
- **Échoue si :** l'isolation ne fonctionne que dans un sens, le cas le plus
  dangereux étant celui-ci : des données réelles visibles dans un espace
  présenté comme fictif.

**I3 — la réinitialisation de la démo n'efface rien en public** · P1 ·
`accueil-demo-isolation.spec.ts` (suite sérielle)

- En espace public, relever le nombre de visites du préfixe
  `E2E-ACC-DEMO-<RUN>` (une, celle de I2).
- Aller sur `/admin/parametres`, cliquer `Réinitialiser l’espace démo`, attendre
  `Espace démo réinitialisé.` (borne large : la réinitialisation est longue ;
  `workspaces.spec.ts` lui accorde 90 secondes).
- Revenir sur `/accueil` en public, rechercher le préfixe.
- Assertion : la visite de I2 est **toujours** là, avec la même référence.
- **Coordination obligatoire** : `workspaces.spec.ts` réinitialise déjà la démo.
  Deux réinitialisations dans une même exécution sont longues mais sans danger.
  L'agent signale au mainteneur central s'il constate un conflit d'ordre.
- **Échoue si :** `POST /admin/demo/reset` touche le schéma `public` — perte de
  données irréversible en production.

---

## 6. Ce que je n'ai pas pu déterminer par lecture

À vérifier en navigateur **avant** d'écrire le test concerné. L'agent qui lève
une de ces questions inscrit la réponse observée dans son retour.

**Q1 — Nom accessible exact d'un `FilterCombobox` requis.**
`Label` rend le libellé suivi d'un `<span>Obligatoire</span>`, et le déclencheur
porte `aria-labelledby="{labelId} {triggerId}"`. Le nom calculé devrait donc être
`ENTREPRISE Obligatoire Choisir`, mais l'espacement dépend du calcul du nom
accessible du navigateur.
*Question exacte* : sur `/accueil`, dialogue `Enregistrer une visite`, que renvoie
`page.getByRole('combobox').first().evaluate(el => el.getAttribute('aria-labelledby'))`
et quel nom accessible Playwright expose-t-il
(`page.getByRole('combobox').all()` puis inspection du sélecteur) ?

**Q2 — Le compte `fixture.accueil@cpi.sn` peut-il réellement se connecter ?**
Le seed le crée avec `SEED_FIXTURE_PASSWORD` ; `e2e/fixtures.ts` en suppose un
autre (§2.1). Aucun test existant ne s'y connecte.
*Question exacte* : la connexion à `/connexion` avec `fixture.accueil@cpi.sn` et
la valeur de `SEED_FIXTURE_PASSWORD` du `.env` aboutit-elle sur `/espaces`, et le
compte est-il actif (`isActive`) ?

**Q3 — Libellé exact de la cloche de notifications.**
Il vient de `bellLabel(unreadCount)` dans `lib/data/inbox.ts`, que je n'ai pas
lu ; il varie selon le nombre de non-lues.
*Question exacte* : sur `/accueil` avec la session ACCUEIL, quel est le nom
accessible du bouton de la cloche à zéro non-lue, et à au moins une ?

**Q4 — Le registre de démonstration contient-il des entrées de référentiel ?**
Le scénario I1 enregistre une visite en espace démo : il lui faut une entreprise
et un objet **actifs dans le schéma `demo`**.
*Question exacte* : après `POST /admin/demo/reset`, la liste `ENTREPRISE` du
formulaire de saisie du registre, en espace démo, est-elle non vide, et quelles
sont ses entrées ?

**Q5 — Une entrée désactivée reste-t-elle proposée en filtre ?**
`RegistreView` et `VisiteForm` appellent tous deux
`fetchVisiteReferentiels()` sans paramètre, donc `activeOnly` vaut `true` côté
API. Le filtre du registre perdrait alors la possibilité de retrouver les
visites rangées sous une entrée retirée — ce que la description du produit
promet pourtant (« Reste disponible en filtre et en export »).
*Question exacte* : après avoir désactivé une entrée, apparaît-elle encore dans
le combobox `ENTREPRISE` du bloc `Filtres avancés` de `/accueil` ? Si non, c'est
un écart entre la promesse du dialogue de désactivation et le comportement réel,
à rapporter comme bug (scénario G12).

**Q6 — Combien de visites contient la base amorcée ?**
Les scénarios D17, E6, E7, H9 et H10 exigent respectivement plus de 100, 200,
3000 et 50 lignes. Je n'ai pas trouvé de semis de visites dans `seed.ts` (seules
les quatre listes y sont amorcées).
*Question exacte* : `GET /api/v1/visites?periode=tout&pageSize=1` renvoie quel
`meta.total` sur une base fraîchement amorcée ? Si le total est faible, ces cinq
scénarios sont déclarés **non joués** avec le chiffre constaté, ou le mainteneur
central décide d'un semis dédié — qu'aucun agent ne fabrique de sa propre
initiative (des milliers de visites indestructibles).

**Q7 — La frontière d'erreur de rendu est-elle atteignable sans toucher au
code ?** Le scénario C14 propose une charge falsifiée ; rien ne garantit qu'elle
produise une exception plutôt qu'un affichage dégradé.
*Question exacte* : la réponse falsifiée décrite en C14 fait-elle apparaître le
titre `Cet écran n’a pas pu s’afficher` ? Sinon, quel autre point d'entrée du
périmètre lève une exception de rendu ?

**Q8 — `window.print()` en Chromium headless.**
E4 et E6 supposent qu'appeler l'impression ne bloque pas la page.
*Question exacte* : cliquer `Ouvrir l’impression` avec la portée `La page
affichée` laisse-t-il la page interactive, ou la suite du test se bloque-t-elle ?
Si elle se bloque, E4 et E6 se limitent à `emulateMedia({ media: 'print' })` sans
jamais cliquer ce bouton.

**Q9 — Écart documenté sans effet : `VISITE_STATS_RANGE_INVALID`.**
`visites.controller.ts` documente deux codes d'erreur 400 pour
`GET /visites/statistiques` ; `VisiteStatsError` les déclare bien dans le service,
mais je n'ai pas pu confirmer par lecture qu'une plage inversée (`from > to`) les
déclenche.
*Question exacte* : `GET /api/v1/visites/statistiques?from=2026-12-31&to=2026-01-01`
renvoie-t-il 400 avec `VISITE_STATS_RANGE_INVALID`, ou 200 avec un total nul ?
Si c'est 200, l'écran ne peut pas le signaler et le scénario F4 reste la seule
protection.

---

## 7. Récapitulatif chiffré

### 7.1 Par écran et par priorité

| Bloc | Écran / route | P1 | P2 | P3 | Total |
| --- | --- | --- | --- | --- | --- |
| 5.1 | Connexion, session, redirections | 6 | 5 | 3 | **14** |
| 5.2 | Hub `/espaces` | 4 | 3 | 3 | **10** |
| 5.3 | Coque du panel | 6 | 6 | 2 | **14** |
| 5.4 | `/accueil` — registre | 7 | 9 | 2 | **18** |
| 5.5 | `/accueil` — impression | 1 | 4 | 2 | **7** |
| 5.6 | `/accueil/tableau-de-bord` | 4 | 7 | 3 | **14** |
| 5.7 | `/accueil/listes` | 6 | 5 | 1 | **12** |
| 5.8 | `/accueil/import` | 4 | 5 | 3 | **12** |
| 5.9 | Espace démo — isolation | 3 | 0 | 0 | **3** |
| | **Total** | **41** | **44** | **19** | **104** |

### 7.2 Par spec cible

| Spec | Scénarios | Dont déjà couverts ailleurs | Dont conditionnels |
| --- | --- | --- | --- |
| `accueil-connexion.anon.spec.ts` | 9 | 1 (A3) | 0 |
| `accueil-session.spec.ts` | 5 | 0 | 1 (A13) |
| `accueil-espaces.spec.ts` | 4 | partiel B1 | 0 |
| `accueil-espaces-roles.spec.ts` | 6 | partiel B7 | 6 (états de rôle) |
| `accueil-coque.spec.ts` | 14 | partiel C5 | 6 (états de rôle) |
| `accueil-registre.spec.ts` | 18 | 0 | 1 (D17, volumétrie) |
| `accueil-impression.spec.ts` | 7 | 0 | 2 (E6, E7, volumétrie) |
| `accueil-tableau-de-bord.spec.ts` | 14 | partiel F6 (axe) | 0 |
| `accueil-listes.spec.ts` | 12 | 0 | 0 |
| `accueil-import.spec.ts` | 12 | 0 | 2 (H9, H10, volumétrie) |
| `accueil-demo-isolation.spec.ts` | 3 | partiel I (bascule) | 0 |

### 7.3 Dépendances bloquantes avant écriture

1. **États de session par rôle** (§2.1) : 12 scénarios en dépendent (B5–B10,
   C1, C3, C4, C7, C10, C11, A13). Demande au mainteneur central.
2. **Mot de passe des comptes de fixture** (§2.1) : écart entre
   `SEED_FIXTURE_PASSWORD` et `FIXTURE_PASSWORD`. Sans arbitrage, aucun état de
   session non-admin n'est constructible.
3. **Volumétrie du registre** (§6 Q6) : 5 scénarios conditionnels.
