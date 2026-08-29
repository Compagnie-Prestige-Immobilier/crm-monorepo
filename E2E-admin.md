# Plan de tests navigateur — Admin, Grand Public, matrice des rôles, démo, versions Android

Document d'exécution. Il sera fusionné avec deux autres plans (CHUES, Accueil/mobile)
puis distribué à des agents qui écriront chacun un fichier de spec sans se voir et
sans autre contexte que ce document.

Racine du dépôt : `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo`.
Outil : Playwright, navigateur réel, contre une pile vivante (API NestJS sur
`http://localhost:3001`, web Next sur `http://localhost:3000`).
Aucun test unitaire ici. Aucun test qui simule `fetch`.

---

## 0. Posture : un test doit pouvoir casser

Le but d'un scénario n'est pas de montrer que l'écran marche. Il est de **rendre
rouge un défaut précis**. Chaque scénario de ce document porte une ligne
`Échoue si :` qui nomme le défaut que l'assertion attrape. Si vous écrivez une
assertion qui ne peut pas devenir rouge pour ce défaut, vous n'avez pas écrit le
scénario demandé.

### Interdits absolus dans une spec

| Interdit | Pourquoi |
| --- | --- |
| `expect(conteneur).toBeVisible()` seul | Une `<div>` vide est visible. Ça ne prouve rien. |
| `expect(true).toBe(true)`, `expect(x).toBeDefined()` comme seule assertion | Ne peut pas casser. |
| `page.waitForTimeout(...)` | Attente fixe. Utiliser `expect(...).toHaveText/toHaveURL/toHaveCount`, `waitForURL`, `waitForResponse`, `waitForEvent`. |
| `test.skip(...)` / `test.fixme(...)` sans numéro de ticket en commentaire | Une couverture qui s'efface est pire que pas de couverture. |
| `retries`, `test.retry`, relance manuelle d'une assertion | Un vert au troisième essai ne prouve rien. |
| `try { ... } catch { }` autour d'une assertion | Avale l'échec. |
| Sélecteurs CSS de position ou de style : `nth-child`, `.flex`, `.text-muted-foreground`, `div > div` | Cassent au premier changement de mise en page et ne cassent pas quand le libellé change. |
| `getByText(/prospect/i)` et autres regex larges pour masquer un écart de libellé | Le but est justement d'attraper l'écart. Libellé EXACT ou `exact: true`. |
| Remplacer un clic par un appel API | L'API sert à préparer et à vérifier, jamais à jouer le parcours. |
| Fusionner dix scénarios dans un `test()` | Un échec doit nommer un défaut, pas un chapitre. |

### Ce qui compte comme assertion valable

- Un libellé français **exact** relevé dans le code (les libellés de ce document
  sont copiés du code, apostrophe typographique `’` comprise — voir §1.4).
- Une URL complète, ancrée : `toHaveURL(/\/admin\/commerciaux$/)`, pas `/commerciaux/`.
- Le **titre du document** (`toHaveTitle`) quand le titre de niveau 1 vient de la
  barre supérieure et non de la page (voir §1.3).
- Un compte d'éléments : `toHaveCount(0)` pour prouver une absence.
- Une **requête réseau** observée (`page.waitForResponse`, `page.on('response')`)
  pour prouver qu'un écran interdit n'a chargé aucune donnée.
- Un fichier téléchargé et son contenu (signature binaire, taille).
- L'état réel en base relu par l'API après le geste navigateur.

---

## 1. Périmètre et hypothèses

### 1.1 Ce que couvre ce document

1. **Espace Admin** : `/admin`, `/admin/commerciaux`, `/admin/imports`,
   `/admin/notifications`, `/admin/parametres` (dont publication d'une version
   Android), `/admin/referentiels`, `/admin/referentiels/issues-appel`.
2. **Espace Projet Grand Public** : `/grand-public`, `/grand-public/nouveau`,
   `/grand-public/[id]`, `/grand-public/console`, `/grand-public/rappels`,
   `/grand-public/statistiques`, `/grand-public/tableau-de-bord`,
   `/grand-public/campagnes/[id]`.
3. **Matrice rôles × écrans** pour les six rôles et toutes les routes du panel.
4. **Espace démo** : bascule, réinitialisation, isolement dans les deux sens.
5. **Transversal** : `/notifications`, expiration de session, API éteinte, 429,
   404, page d'erreur de rendu, largeur 375 px, accessibilité axe.

### 1.2 Ce que ce document ne couvre pas (autres plans)

Contenu métier des écrans CHUES (console d'appel, représentants, dossiers
bancaires, suggestions, supervision, lots d'export) et du registre des visites
`/accueil/*`. Ce document ne retient de ces routes que **l'accès et le refus**,
pour la matrice des rôles.

### 1.3 Hypothèses de plateforme, vérifiées en lecture

- `apps/web/playwright.config.ts` : `workers: 1`, `fullyParallel: false`,
  `retries: 0`, `timeout: 60_000`, `expect.timeout: 10_000`, locale `fr-FR`,
  fuseau `Africa/Dakar`, `trace: retain-on-failure`.
  **Ces réglages ne se modifient pas.**
- `e2e/global-setup.ts` vérifie `GET http://localhost:3001/health/ready` avant la
  suite et échoue proprement sur un 429 ou une API éteinte.
- Projet `setup` (`e2e/auth.setup.ts`) : connecte l'admin **une seule fois** et
  range `e2e/.auth/admin.json`.
- Projet `chromium` : `storageState: e2e/.auth/admin.json`, `testIgnore: /\.anon\.spec\.ts/`.
- Projet `chromium-anonyme` : `testMatch: /\.anon\.spec\.ts/`, navigateur vierge.
- `webServer` : `pnpm dev`, `reuseExistingServer: true`. L'API n'est **pas**
  démarrée par Playwright ; elle est supposée lancée.
- **Le titre de niveau 1 de la plupart des écrans est rendu par la barre
  supérieure** (`components/layout/topbar.tsx`, `navTitle(role, pathname)`), pas
  par la page. Un `<h1>` correct ne prouve donc pas que la page a rendu quoi que
  ce soit. Pour ces écrans, utiliser `toHaveTitle(...)` (posé par la page via
  `export const metadata`) **et** un repère propre à l'écran.
  Exception : `/espaces`, `/grand-public`, `/grand-public/nouveau`,
  `/grand-public/[id]`, `/grand-public/console` et la page 404 rendent leur
  propre `<h1>`. Sur ces routes il y a donc **deux `<h1>`** dans le document
  (barre supérieure + page) : `getByRole('heading', { level: 1 })` viole le mode
  strict. Viser le titre par son nom exact, ou `page.getByRole('main').getByRole('heading', { level: 1 })`.

### 1.4 Apostrophes et espaces

Le code utilise l'apostrophe typographique `’` (U+2019) dans presque tous les
libellés : « Nouvel utilisateur », « Réinitialiser l’espace démo »,
« Cet écran n’a pas pu s’afficher ». Certains libellés portent une espace
insécable ` ` (« Réessayez ; », « Prospects affichés : »,
« Code à communiquer : »). **Copier-coller le libellé depuis le fichier
source cité, ne pas le retaper.** Une apostrophe droite `'` fait échouer le
sélecteur pour une raison qui n'a rien à voir avec le défaut cherché.

### 1.5 Limites de débit de l'API, non négociables

- Connexion : **10 par minute et par IP** (`apps/api/src/modules/auth/auth.controller.ts`,
  `@Throttle({ default: { ttl: seconds(60), limit: 10 } })`).
- Global : **300 requêtes par minute** (`API_GLOBAL_RATE_LIMIT`, défaut 300).
- Téléchargement d'APK : `APK_DOWNLOAD_RATE_LIMIT` (défaut **10 par heure**,
  `ttl: seconds(3_600)`), route publique `GET /api/v1/app-updates/android/download`.

Conséquence : **aucune spec ne se connecte**. Six connexions au total, posées une
fois par le projet `setup`. Un agent qui écrit `page.goto('/connexion')` suivi
d'un remplissage de formulaire, hors des specs `*.anon.spec.ts` explicitement
désignées, casse la suite entière pour tout le monde.

---

## 2. Stratégie d'exécution

### 2.1 Six états de session, posés une fois — travail du mainteneur central

**À faire AVANT de distribuer les specs. Aucun agent n'écrit ce fichier.**

`e2e/auth.setup.ts` est étendu pour produire six états au lieu d'un :

| Rôle | Identifiant | Fichier d'état |
| --- | --- | --- |
| ADMIN | `admin@cpi.sn` | `e2e/.auth/admin.json` (existe déjà) |
| COMMERCIAL | `fixture.awa@cpi.sn` | `e2e/.auth/commercial.json` |
| SUPERVISEUR | `fixture.superviseur@cpi.sn` | `e2e/.auth/superviseur.json` |
| DIRECTION | `fixture.direction@cpi.sn` | `e2e/.auth/direction.json` |
| ACCUEIL | `fixture.accueil@cpi.sn` | `e2e/.auth/accueil.json` |
| BANQUE_FINANCE | `fixture.banque@cpi.sn` | `e2e/.auth/banque.json` |

Six connexions, sous le plafond de dix par minute. Les mots de passe viennent de
variables d'environnement, **jamais écrits en clair dans une spec** :
`E2E_ADMIN_PASSWORD` (défaut de lecture `ChangeMoiEnProd2026` dans
`e2e/auth.setup.ts`) et `E2E_FIXTURE_PASSWORD`.

> **Piège vérifié en lecture, à régler avant tout.**
> `packages/database/src/seed.ts` crée les six comptes `fixture.*` avec
> `SEED_FIXTURE_PASSWORD` (`.env` et `.env.example` : `ChangeMoi123456`).
> `apps/web/e2e/fixtures.ts` déclare `FIXTURE_PASSWORD = 'Fixture1-CPI-Sunugal'`
> et `ensureUser()` ne crée un compte **que s'il est absent** : après un
> `pnpm db:seed`, les comptes existent déjà avec le mot de passe du seed, et
> `roles.anon.spec.ts` se connecte avec l'autre. Les deux valeurs doivent être
> alignées (soit `SEED_FIXTURE_PASSWORD=Fixture1-CPI-Sunugal` dans `.env`, soit
> `E2E_FIXTURE_PASSWORD=ChangeMoi123456`) avant la première exécution. C'est la
> première chose à vérifier si toutes les specs de rôle échouent d'un bloc.

Chaque spec déclare le projet Playwright dont elle dépend en tête de fichier :

```ts
test.use({ storageState: 'e2e/.auth/superviseur.json' });
```

Le mainteneur central ajoute au besoin des projets `chromium-<role>` dans
`playwright.config.ts`, avec `dependencies: ['setup']`. Un agent ne touche pas
ce fichier ; il déclare son besoin dans son retour.

### 2.2 Données de fixture : nommage et propriété

**Règle de préfixe.** Chaque spec possède un préfixe qui n'appartient qu'à elle.
Elle crée, lit et supprime uniquement ce qui porte son préfixe.

| Spec | Préfixe | Ce qu'elle peut créer |
| --- | --- | --- |
| `admin-utilisateurs.spec.ts` | `E2E-ADM-USR-` | comptes utilisateurs |
| `admin-referentiels.spec.ts` | `E2E-ADM-REF-` | banques, syndicats, départements |
| `admin-issues-appel.spec.ts` | `E2E-ADM-ISS-` | motifs d'issue d'appel |
| `admin-imports.spec.ts` | `E2E-ADM-IMP-` | classeurs déposés (fichiers, pas de lignes appliquées) |
| `admin-notifications.spec.ts` | `E2E-ADM-NOT-` | notifications, gabarits |
| `android-release.spec.ts` | `E2E-APK-` | versions Android (plage de `versionCode` réservée, §2.6) |
| `grand-public.spec.ts` | `E2E-GP-` | prospects Grand Public |
| `grand-public-chiffres.spec.ts` | `E2E-GPC-` | dispositions de tableau de bord (compte propre) |
| `roles-matrice.anon.spec.ts` | aucun | ne crée rien, lecture seule |
| `demo-isolement.spec.ts` | `E2E-DEMO-` | prospects témoins des deux côtés |
| `transversal.spec.ts` | `E2E-TR-` | rien de durable |

**Numéros de téléphone.** Plage réservée aux nouvelles specs :
`+2217810 02xxx` (`+221781002000` à `+221781002999`). Les plages
`+221781001000..1029` (fixtures existantes) et `+22177010xxxx` / `+22177020xxxx`
(jeu de démonstration) sont **prises**, ne pas y écrire.

**E-mails de comptes de test** : `e2e-adm-usr-<n>@cpi.test`. Le domaine `.test`
est réservé (RFC 2606) : aucun e-mail réel ne partira jamais dessus.

### 2.3 Ce qu'aucune spec ne touche jamais

- Comptes : `admin@cpi.sn`, `fixture.awa`, `fixture.fatou`, `fixture.banque`,
  `fixture.superviseur`, `fixture.direction`, `fixture.accueil`. Ni
  désactivation, ni renommage, ni changement de mot de passe, ni suppression.
- Référentiels du seed : syndicat `CHUES`, banque `CBAO`, régions et
  départements du Sénégal, offres, tranches de revenu, professions, motifs
  d'issue système, étapes de dossier bancaire.
- Versions Android publiées hors de la plage réservée (§2.6).
- Base publique : jamais `pnpm db:seed`, `db:reset`, `prisma migrate`,
  `DELETE /api/v1/admin/purge`, ni export intégral de la base.
- `POST /api/v1/admin/demo/reset` : **réservé à `demo-isolement.spec.ts`**, seule
  propriétaire de l'espace démo. Toute autre spec qui appelle cette route détruit
  les données d'une spec voisine en cours.
- Fichiers d'infrastructure de test : `playwright.config.ts`, `e2e/fixtures.ts`,
  `e2e/auth.setup.ts`, `e2e/global-setup.ts`, `e2e/xlsx.ts`, et **toute autre
  spec que la sienne**.

### 2.4 Ordre et séquentialité

`workers: 1` est déjà imposé par la configuration. En plus :

- `demo-isolement.spec.ts` : `test.describe.configure({ mode: 'serial' })`. La
  bascule d'espace est un état de session global, la réinitialisation est
  destructive. Cette spec doit tourner **seule** ; le mainteneur la place en
  dernier dans l'ordre d'exécution (`testMatch` ordonné ou exécution séparée).
- `android-release.spec.ts` : `mode: 'serial'`. Le service impose un
  `versionCode` strictement croissant : deux publications concurrentes se
  refusent mutuellement (`APK_VERSION_NOT_GREATER`).
- `admin-utilisateurs.spec.ts` : `mode: 'serial'` à l'intérieur du fichier. La
  création puis la modification puis la désactivation visent la même ligne.
- Les autres specs : ordre libre à l'intérieur du fichier, chaque `test()`
  autonome.

### 2.5 Idempotence à la relance

Chaque spec doit pouvoir tourner deux fois d'affilée sans nettoyage manuel.

- **Avant** : `beforeAll` cherche ses données par préfixe via l'API admin et les
  retire (`DELETE /api/v1/users/:id`, `DELETE /api/v1/prospects/:id`,
  désactivation pour les référentiels, qui n'ont pas de suppression).
- **Pendant** : chaque nom porte un suffixe stable par scénario, pas un
  `Date.now()`. Un identifiant aléatoire empêche le nettoyage par préfixe de la
  fois suivante de savoir ce qu'il ramasse. Exemple :
  `E2E-ADM-USR-creation`, `E2E-ADM-USR-doublon`, `E2E-ADM-USR-desactivation`.
- **Après** : `afterAll` remet dans l'état trouvé ce qui ne peut pas être
  supprimé (réactive un compte, remet un référentiel actif, rétablit une
  disposition de tableau de bord par `DELETE /api/v1/tableaux-de-bord/{ecran}/disposition`).
- Un `afterAll` qui échoue ne doit pas masquer un échec de test : ne pas y mettre
  d'assertion.

### 2.6 Versions Android : plage réservée et fixtures binaires

**Fixtures binaires : elles existent déjà, versionnées, et sont petites.**
`apps/api/src/modules/app-updates/fixtures/` contient :

| Fichier | Taille | Ce qu'il éprouve |
| --- | --- | --- |
| `cpi-go-v7.apk` | 8,1 Ko | APK valide, paquet `sn.cpi.go`, signé de la clé de test (`9434b1f9…f3909`) |
| `cpi-go-v12.apk` | 8,1 Ko | même clé, `versionCode` supérieur |
| `cpi-go-v12-autre-cle.apk` | 8,1 Ko | signé d'une **autre** clé (`3a22ee16…928a6`) → `APK_SIGNER_MISMATCH` |
| `cpi-go-v7-non-signe.apk` | 683 o | aucun bloc de signature v2/v3 → `APK_UNSIGNED` |
| `autre-editeur-v99.apk` | 691 o | paquet étranger → `APK_FOREIGN_PACKAGE` |
| `manifeste-illisible.apk` | 199 o | manifeste illisible → `APK_MANIFEST_UNREADABLE` |

Les empreintes de signataire sont exportées par
`apps/api/src/modules/app-updates/fake-release-store.ts` (`FIXTURE_SIGNER`,
`AUTRE_SIGNER`). **Ne pas fabriquer de nouvel APK** : il n'y a rien à gagner, et
générer un keystore dans la suite ajoute une dépendance sur `apksigner` et le
build-tools Android sur la machine de test. Ces fichiers ont été produits une
fois avec un keystore de test jetable ; la clé de production n'y est pas et n'y
sera jamais.

Chemin depuis la spec web :
`resolve(__dirname, '../../api/src/modules/app-updates/fixtures/cpi-go-v7.apk')`.
Le mainteneur peut préférer une copie sous `apps/web/e2e/fixtures/apk/` ; dans ce
cas c'est lui qui la crée, pas l'agent.

**Contrainte d'environnement.** `APK_SIGNER_SHA256` (`.env.example` ligne 51) est
vide par défaut. Vide, `AppUpdatesService.expectedSigner()` prend le signataire de
la première release déjà publiée. Pour que `APK_SIGNER_MISMATCH` soit reproductible,
l'API doit tourner avec `APK_SIGNER_SHA256=9434b1f9594e7f5d20bda74d047e40affdc8003f51d89421d4b79456ad7f3909`
(l'empreinte des fixtures). Sans cette variable, le résultat dépend de ce qui est
déjà en base. **C'est une précondition d'environnement à documenter, pas quelque
chose qu'une spec pose.**

**Plage de `versionCode` réservée aux tests : 900 000 à 999 999.** Les fixtures
portent 7 et 12 ; elles ne peuvent donc pas être publiées si une release de la
plage haute existe déjà (`versionCode` strictement croissant). L'ordre est donc :
publier d'abord les fixtures basses (7 puis 12), puis les cas d'erreur.
`admin-parametres.spec.ts` et `android-release.spec.ts` ne retirent **que** les
versions qu'elles ont publiées, jamais une version trouvée en base.

**Ce que la spec laisse derrière elle.** Les releases publiées restent : le
service ne les supprime pas et `withdraw` refuse de retirer la dernière en ligne
(`APK_LAST_RELEASE`). Le `afterAll` retire les versions du test **sauf si elles
sont les dernières en ligne**, et le retour de l'agent nomme ce qui reste.

### 2.7 Environnement attendu

```bash
docker compose -f infra/docker/docker-compose.yml up -d
pnpm db:migrate && pnpm db:seed
APK_SIGNER_SHA256=9434b1f9594e7f5d20bda74d047e40affdc8003f51d89421d4b79456ad7f3909 pnpm --filter @crm/api dev
pnpm --filter @crm/web dev
```

---

## 3. Règles impératives pour l'agent qui écrit un test

Vous écrivez **un** fichier de spec. Vous ne connaissez pas les autres agents.
Ces règles évitent que vos écritures détruisent leur travail.

### 3.1 Propriété des fichiers

1. Vous n'écrivez que dans **le fichier de spec qui vous est assigné**.
2. Vous ne modifiez **jamais** : `apps/web/playwright.config.ts`,
   `apps/web/e2e/fixtures.ts`, `apps/web/e2e/auth.setup.ts`,
   `apps/web/e2e/global-setup.ts`, `apps/web/e2e/xlsx.ts`, ni **aucune autre
   spec**. Si vous avez besoin d'un nouvel état de session, d'un nouvel
   utilitaire partagé ou d'un projet Playwright supplémentaire : vous le
   **décrivez dans votre retour**, et le mainteneur central l'intègre.
3. Vous ne supprimez ni ne renommez aucun test existant, même s'il vous paraît
   redondant ou faux. Vous le signalez.
4. Vous ne touchez **jamais** au code applicatif : `apps/web/src`, `apps/api`,
   `packages/**`. Si votre test révèle un bug, **le test reste rouge** et le bug
   est rapporté. On ne corrige pas l'application pour verdir un test, et on
   n'assouplit pas le test pour verdir une application fausse.
5. Vous n'ajoutez aucune dépendance npm. La pile installée
   (`@playwright/test`, `@axe-core/playwright`) suffit.

### 3.2 Propriété des données

1. Toute donnée que vous créez porte **votre préfixe** (§2.2). Vous ne lisez, ne
   modifiez et ne supprimez que ce qui le porte.
2. **Comptes utilisateurs** : vous créez les vôtres (`E2E-ADM-USR-…`,
   `e2e-adm-usr-*@cpi.test`). Vous ne désactivez, ne renommez et ne changez le
   mot de passe **que des vôtres**. Jamais `admin@cpi.sn`, jamais un `fixture.*`.
3. **Référentiels** : vous créez des entrées `E2E-ADM-REF-…` que vous pourrez
   désactiver (il n'y a pas de suppression d'un référentiel). Vous ne modifiez
   ni `CHUES`, ni `CBAO`, ni un département existant, ni un motif d'issue système.
4. **Versions Android** : vous ne retirez que les versions publiées par votre
   test. Vous isolez vos `versionCode` dans la plage 900 000–999 999 quand vous
   en fabriquez, et vous nommez dans votre retour ce que vous laissez en base.
5. **Base** : jamais `pnpm db:seed`, `db:reset`, ni migration. Jamais la purge
   ni l'export intégral. `POST /api/v1/admin/demo/reset` est réservé à
   `demo-isolement.spec.ts` : si ce n'est pas votre spec, vous ne l'appelez pas.
6. Vous laissez la base dans l'état où vous l'avez trouvée, à vos données près,
   et votre spec doit pouvoir être relancée immédiatement.

### 3.3 Ressources partagées

1. **Aucune connexion supplémentaire.** Vous réutilisez l'état de session posé
   par le projet `setup` via `test.use({ storageState: '…' })`. Le formulaire de
   connexion ne se rejoue que dans les specs `*.anon.spec.ts` explicitement
   désignées par ce document.
2. `workers: 1` reste obligatoire. Vous ne mettez pas `fullyParallel: true` dans
   votre fichier, ni `test.describe.parallel`.
3. Le limiteur de téléchargement APK est de dix par heure : un scénario qui
   télécharge un APK ne le fait **qu'une fois**, et jamais en boucle.
4. Un écran du panel émet une dizaine d'appels d'API. Un balayage de trente
   routes coûte trois cents appels, soit la totalité du quota d'une minute :
   n'enchaînez pas deux balayages larges dans le même fichier.

### 3.4 Preuve de livraison

Votre retour contient, obligatoirement :

1. **La sortie brute** de la commande exécutée :
   `pnpm --filter @crm/web exec playwright test e2e/<votre-fichier>.spec.ts --reporter=list`
2. Le nombre exact de tests **passés** et **rouges**.
3. Pour chaque rouge : la cause, tranchée entre **bug applicatif** (le test est
   juste, l'application est fausse — nommer le fichier et la ligne) et **test à
   corriger** (le test est faux — l'avoir corrigé et l'avoir relancé).
4. La liste des données laissées en base.
5. Les besoins d'infrastructure que vous n'avez pas pu couvrir seul.

« Tout passe » sans sortie de commande n'est pas accepté.
**Un test rouge qui pointe un vrai bug est un livrable réussi.**

### 3.5 Interdictions de méthode

1. Ne pas réduire le périmètre pour finir vite. Si un scénario du document ne
   peut pas être écrit, dire lequel et pourquoi, ne pas le supprimer en silence.
2. Ne pas fusionner plusieurs scénarios en un seul `test()`.
3. Ne pas remplacer un parcours navigateur par un appel API. L'API prépare et
   vérifie ; le clic reste le clic.
4. Ne pas élargir un sélecteur pour absorber un écart de libellé. Si le libellé
   attendu par ce document ne se trouve pas à l'écran, c'est un défaut : le test
   reste rouge et l'écart est rapporté.

---

## 4. Matrice rôles × écrans

**Spec cible : `e2e/roles-matrice.anon.spec.ts` (nouveau).**
Existant à ne pas dupliquer : `e2e/roles.anon.spec.ts` couvre déjà
BANQUE_FINANCE et COMMERCIAL (atterrissage, barre, quelques URL interdites).

> **Avertissement mesuré en lecture.** `e2e/roles.anon.spec.ts` affirme des
> libellés de navigation que `apps/web/src/components/layout/nav-items.ts` ne
> produit plus : il attend `1 · Appeler les représentants`, `2 · Noter un prospect`,
> `3 · Appeler les prospects`, `Mes représentants`, `Chiffres`, `Campagnes`, alors
> que le fichier écrit aujourd'hui `Qualifier un représentant`,
> `Ajouter un prospect`, `Convertir un prospect`, `Représentants`,
> `Tableau de bord`, `Lots d’export`. Ce fichier est donc **déjà rouge**.
> L'agent de la matrice ne le corrige pas (règle 3.1.3) : il le signale, et il
> écrit sa propre spec sur les libellés réels ci-dessous.

### 4.1 Les deux sens de chaque cellule, obligatoires

Pour chaque couple (rôle, route), écrire **les deux vérifications** :

**Sens autorisé.**
```
await page.goto(route);
// l'écran a rendu SON contenu : titre de document + repère propre à l'écran
await expect(page).toHaveTitle(/<titre metadata>/);
await expect(page.getByText('<repère>')).toBeVisible();
await expect(page.getByRole('heading', { name: 'Accès refusé' })).toHaveCount(0);
```

**Sens interdit.** Deux assertions, pas une :
```
// 1. le refus est LISIBLE et nomme le rôle
await page.goto(route);
await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
await expect(page.getByRole('alert').filter({ hasText: 'Accès refusé' }))
  .toContainText('<libellé du rôle>');
await expect(page.getByRole('link', { name: 'Retour à l’accueil', exact: true }))
  .toHaveAttribute('href', '/espaces');

// 2. AUCUNE donnée métier n'a été chargée : le réseau le prouve
//    (poser l'écouteur AVANT le goto)
const appels: string[] = [];
page.on('response', (r) => {
  const u = new URL(r.url());
  if (u.pathname.startsWith('/api/v1/') && r.status() < 400) appels.push(u.pathname);
});
// … goto …
expect(appels.filter((p) => p.startsWith('/api/v1/prospects'))).toEqual([]);
```

Le second point est ce qui distingue « l'écran affiche un refus » de « l'écran a
chargé les données puis affiché un refus par-dessus ». C'est le défaut qui
compte.

### 4.2 Libellés des rôles rendus par « Accès refusé »

`apps/web/src/lib/types.ts`, `ROLE_LABELS` :
ADMIN → **Administrateur** · COMMERCIAL → **Téléconseiller** ·
BANQUE_FINANCE → **Banque & Finance** · SUPERVISEUR → **Supervision** ·
DIRECTION → **Direction** · ACCUEIL → **Accueil**.

Le composant est `apps/web/src/components/permission-denied.tsx` :
`<h2>Accès refusé</h2>`, puis « … est réservé à un autre rôle. Rôle en cours : **<libellé>**. »,
puis un lien « Retour à l’accueil » vers `/espaces` (car `homePathForRole` rend
`/espaces` pour tout rôle ayant au moins une coque).

### 4.3 Atterrissage après connexion

Tous les rôles atterrissent sur `/espaces` (`homePathForRole` dans
`nav-items.ts`). Le hub montre **quatre tuiles, toujours** : celles hors de portée
sont grisées, sans lien, et portent « Réservé à d’autres profils ».

| Rôle | Tuiles ouvertes | Tuiles grisées | Destination de la tuile cliquée |
| --- | --- | --- | --- |
| ADMIN | Accueil, Projet CHUES, Projet Grand Public, Admin | — | Accueil → `/accueil` · CHUES → `/chues/statistiques` · Grand Public → `/grand-public/statistiques` · Admin → `/admin/commerciaux` |
| DIRECTION | Accueil, Projet CHUES, Projet Grand Public | Admin | Accueil → `/accueil` · CHUES → `/chues/statistiques` · Grand Public → `/grand-public/statistiques` |
| SUPERVISEUR | Projet CHUES, Projet Grand Public | Accueil, Admin | CHUES → `/chues/statistiques` · Grand Public → `/grand-public/statistiques` |
| COMMERCIAL | Projet CHUES, Projet Grand Public | Accueil, Admin | CHUES → `/chues` · Grand Public → `/grand-public/console` |
| ACCUEIL | Accueil | CHUES, Grand Public, Admin | Accueil → `/accueil` |
| BANQUE_FINANCE | Projet CHUES | Accueil, Grand Public, Admin | CHUES → `/chues/banque` |

Destinations calculées par `coqueHomePath(role, coque)` = première entrée non
repliée de la barre. Les vérifier **par un clic sur la tuile**, pas en tapant
l'URL : c'est le lien de la tuile qui porte le calcul.

**ROLE-01 à ROLE-06 — atterrissage et tuiles, un scénario par rôle.**
Priorité **P1**.
Précondition : état de session du rôle.
Assertions : `toHaveURL(/\/espaces$/)` ; `getByRole('heading', { name: 'Choisissez un espace', level: 1 })` visible ;
pour chaque tuile grisée, `getByRole('listitem').filter({ hasText: '<label>' })`
contient « Réservé à d’autres profils » **et** `getByRole('link')` y compte 0 ;
clic sur chaque tuile ouverte → URL exacte du tableau ci-dessus.
**Échoue si :** une tuile hors de portée devient cliquable ; un rôle atterrit
ailleurs que sur `/espaces` ; la tuile CHUES d'un agent bancaire mène au tableau
de bord des prospects (403 immédiat) au lieu de `/chues/banque` ; la tuile Grand
Public d'un SUPERVISEUR mène à `/grand-public` (liste) au lieu du tableau de bord.
Existant : ROLE-05 (BANQUE_FINANCE) et ROLE-04 (COMMERCIAL) sont partiellement
couverts par `roles.anon.spec.ts` — les reprendre ici pour les six rôles, avec
la destination exacte de chaque tuile.

### 4.4 Entrées de navigation, par rôle et par coque

Source de vérité : `apps/web/src/components/layout/nav-items.ts`.
La barre est `getByRole('navigation', { name: 'Navigation principale' })`.
Les entrées `secondary: true` sont sous un repli `<details>` dont le résumé est
`Plus` (`getByText('Plus', { exact: true })`). Les entrées `hidden: true` ne sont
**jamais** dans la barre.

**Coque CHUES.**

| Rôle | Barre principale, dans l'ordre | Sous « Plus » | Absentes |
| --- | --- | --- | --- |
| COMMERCIAL | Mon travail, Qualifier un représentant, Ajouter un prospect, Convertir un prospect, Rappels promis | Contacts recommandés, Représentants, Prospects | Tableau de bord, Mon équipe, Lots d’export, Dossiers bancaires, Utilisateurs, Listes de référence, Paramètres |
| SUPERVISEUR | Tableau de bord, Qualifier un représentant, Ajouter un prospect, Convertir un prospect, Rappels promis, Mon équipe | Contacts recommandés, Représentants, Prospects, Lots d’export | Mon travail, Dossiers bancaires, Utilisateurs, Listes de référence, Paramètres, Créations de client à valider |
| DIRECTION | idem SUPERVISEUR | idem SUPERVISEUR | idem SUPERVISEUR |
| ADMIN | Tableau de bord, Prospects, Représentants, Lots d’export, Dossiers bancaires | Les trois étapes, Équipes, Rappels, Contacts recommandés, Vue d’ensemble bancaire, Créations de client à valider, Exporter les dossiers, Étapes des dossiers | Mon travail, Mes demandes de création |
| BANQUE_FINANCE | Vue d’ensemble, Dossiers bancaires, Ouvrir un dossier, Mes demandes de création | Exporter les dossiers | tout le reste |
| ACCUEIL | (coque fermée) | — | — |

**Coque Grand Public.**

| Rôle | Barre principale | Sous « Plus » | Absentes |
| --- | --- | --- | --- |
| COMMERCIAL | Appeler les prospects, Rappels promis, Noter un prospect | Mes prospects | Tableau de bord |
| SUPERVISEUR | Tableau de bord, Prospects | Rappels | Noter un prospect, Appeler les prospects |
| DIRECTION | idem SUPERVISEUR | idem SUPERVISEUR | idem SUPERVISEUR |
| ADMIN | Tableau de bord, Prospects | Rappels, Appeler les prospects, Noter un prospect | — |
| ACCUEIL, BANQUE_FINANCE | (coque fermée) | — | — |

**Coque Admin.** ADMIN seul : Utilisateurs, Listes de référence,
Importer un fichier Excel, Envoyer une notification, Paramètres. Aucun repli.

**Coque Accueil.** ADMIN, DIRECTION, ACCUEIL : une seule entrée visible,
**Registre des visites**. Les trois autres (`Tableau de bord`, `Listes`,
`Import du registre`) sont `hidden: true` : elles ne sont **pas** dans la barre,
même pour un ADMIN, et s'atteignent par les onglets du registre.

**ROLE-07 à ROLE-16 — navigation par rôle et par coque.**
Un scénario par couple (rôle, coque ouverte) : 4 pour CHUES (COMMERCIAL,
SUPERVISEUR, ADMIN, BANQUE_FINANCE — DIRECTION identique à SUPERVISEUR,
paramétrer les deux dans le même `test.describe` avec une table), 3 pour Grand
Public (COMMERCIAL, SUPERVISEUR/DIRECTION, ADMIN), 1 pour Admin, 2 pour Accueil
(ADMIN/DIRECTION, ACCUEIL). Priorité **P1**.
Assertions :
- chaque entrée « barre principale » : `nav.getByRole('link', { name: '<label>', exact: true })` visible ;
- **l'ordre** : `nav.getByRole('link').allTextContents()` commence par la liste
  attendue — c'est ce qui prouve que « Tableau de bord » est bien la **première**
  entrée de l'encadrement dans CHUES et dans Grand Public ;
- chaque entrée « Plus » : `toHaveCount(0)` **avant** le clic sur `Plus`, visible
  **après** ;
- chaque entrée « absente » : `toHaveCount(0)`, `exact: true` obligatoire ;
- « Mon travail » : présent pour COMMERCIAL, `toHaveCount(0)` pour tous les autres.

**Échoue si :** « Tableau de bord » n'est plus en tête pour SUPERVISEUR, DIRECTION
ou ADMIN dans CHUES ou Grand Public ; « Mon travail » apparaît pour un rôle autre
que COMMERCIAL ; une entrée d'administration apparaît dans la barre d'un
SUPERVISEUR ; une entrée repliée remonte dans la barre principale (elle
allongerait la liste du matin) ; une entrée `hidden` (Listes, Import du registre,
Tableau de bord de l'accueil) apparaît dans la barre ; un libellé change sans que
ce document soit mis à jour.

### 4.5 Routes du panel, autorisation par rôle

Relevé exhaustif de `guardRoles([...])` dans chaque `page.tsx`
(`find apps/web/src/app -name page.tsx`). `A` = ADMIN, `D` = DIRECTION,
`S` = SUPERVISEUR, `C` = COMMERCIAL, `Ac` = ACCUEIL, `B` = BANQUE_FINANCE.

| Route | Autorisés | Refusés | Comportement du refus |
| --- | --- | --- | --- |
| `/espaces` | tous | — | — |
| `/accueil` | **aucun garde** ⚠ | — | *voir §4.7, trou* |
| `/accueil/tableau-de-bord` | A, D, Ac | S, C, B | Accès refusé |
| `/accueil/listes` | A, D | S, C, B, Ac | Accès refusé |
| `/accueil/import` | A, D | S, C, B, Ac | Accès refusé |
| `/admin` | A | autres | redirection vers `coqueHomePath` du rôle |
| `/admin/commerciaux` | A | D, S, C, Ac, B | Accès refusé — « La gestion des comptes » |
| `/admin/imports` | A | autres | Accès refusé — « Les imports de masse » |
| `/admin/notifications` | A | autres | D, S, Ac, B → **redirigés** vers `/notifications` ; C → Accès refusé |
| `/admin/parametres` | A | autres | Accès refusé — « Les paramètres de la plateforme » |
| `/admin/referentiels` | A | autres | Accès refusé — « La gestion des référentiels » |
| `/admin/referentiels/issues-appel` | A | autres | Accès refusé — « Le référentiel des issues d’appel » |
| `/chues` | A, C, S, D, B | Ac | B **redirigé** vers `/chues/banque` ; Ac → Accès refusé |
| `/chues/appels-representants` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/banque` | A, B | D, S, C, Ac | Accès refusé |
| `/chues/campagnes` | A, S, D | C, Ac, B | **redirection vers `/chues`** ⚠ |
| `/chues/campagnes/[id]` | A, S, D | C, Ac, B | **redirection vers `/chues`** ⚠ |
| `/chues/console` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/demandes-clients` | A, B | D, S, C, Ac | Accès refusé |
| `/chues/dossiers` | A, B | D, S, C, Ac | Accès refusé |
| `/chues/dossiers/[id]` | A, B | autres | Accès refusé |
| `/chues/dossiers/etapes` | A | autres | Accès refusé |
| `/chues/dossiers/export` | A, B | autres | Accès refusé |
| `/chues/dossiers/nouveau` | A, B | autres | Accès refusé |
| `/chues/prospects` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/prospects/nouveau` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/rappels` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/representants` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/representants/[id]` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/representants/import` | A | autres | Accès refusé |
| `/chues/statistiques` | A, S, D | C, Ac, B | Accès refusé — « Les chiffres du projet CHUES » |
| `/chues/suggestions` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/supervision` | A, S, D | C, Ac, B | Accès refusé |
| `/chues/tableau-de-bord` | — | — | `permanentRedirect` vers `/chues/statistiques` |
| `/grand-public` | A, D, S, C | Ac, B | Accès refusé — « Le projet Grand Public » |
| `/grand-public/[id]` | A, D, S, C | Ac, B | Accès refusé — « La fiche d’un prospect » |
| `/grand-public/campagnes/[id]` | A, S, D | C, Ac, B | **redirection vers `/chues`** ⚠ |
| `/grand-public/console` | A, C | D, S, Ac, B | Accès refusé — « La file d’appel Grand Public » |
| `/grand-public/nouveau` | A, C | D, S, Ac, B | Accès refusé — « La saisie d’un prospect Grand Public » |
| `/grand-public/rappels` | A, C, S, D | Ac, B | Accès refusé — « La file des rappels » |
| `/grand-public/statistiques` | A, S, D | C, Ac, B | Accès refusé — « Les chiffres du projet Grand Public » |
| `/grand-public/tableau-de-bord` | — | — | `permanentRedirect` vers `/grand-public/statistiques` |
| `/notifications` | A, D, S, B, Ac | C | A **redirigé** vers `/admin/notifications?onglet=reception` ; C → Accès refusé |

**ROLE-17 à ROLE-22 — balayage des URL interdites, un scénario par rôle.**
Priorité **P1**.
Pour chaque rôle, un `test()` qui parcourt **toutes** ses routes refusées du
tableau et applique les deux assertions du §4.1. Utiliser une table
paramétrée `for (const route of ROUTES_REFUSEES[role])` avec un message
d'assertion nommant la route : `expect(..., \`${route} devrait être refusé à ${role}\`)`.

Découper en deux `test()` par rôle si le balayage dépasse une trentaine de
routes (quota API, §3.3.4) : un pour les routes de la coque Admin, un pour le
reste.

**Échoue si :** une route interdite rend son écran ; une route interdite charge
des données avant de refuser ; un refus n'affiche pas « Accès refusé » mais une
page blanche, une erreur anglaise de Next, ou une boucle de redirection (le
`waitForURL` expire) ; le refus ne nomme pas le rôle en cours ; le lien de sortie
ne pointe pas vers `/espaces`.

### 4.6 Redirections plutôt que refus, à vérifier explicitement

Cinq routes ne refusent pas : elles renvoient. Ce sont des cellules de la matrice
à part entière, avec leur propre scénario.

| Scénario | Rôle | Route | Attendu |
| --- | --- | --- | --- |
| ROLE-23 P2 | D, S, Ac, B | `/admin/notifications` | `waitForURL('**/notifications')`, la boîte de réception rend son contenu, pas de « Accès refusé » |
| ROLE-24 P2 | ADMIN | `/notifications` | `waitForURL(/\/admin\/notifications\?onglet=reception$/)`, onglet « Boîte de réception » actif |
| ROLE-25 P2 | BANQUE_FINANCE | `/chues` | `waitForURL('**/chues/banque')`, `toHaveTitle(/Tableau de bord bancaire/)` |
| ROLE-26 P2 | tous rôles autorisés | `/chues/tableau-de-bord` et `/grand-public/tableau-de-bord` | `permanentRedirect` : URL finale `/chues/statistiques` et `/grand-public/statistiques` |
| ROLE-27 P2 | COMMERCIAL | `/chues/campagnes`, `/chues/campagnes/<uuid>`, `/grand-public/campagnes/<uuid>` | URL finale `/chues` |

**Échoue si :** une redirection boucle (le `waitForURL` expire au lieu d'assertion
fausse) ; l'ADMIN se retrouve avec deux écrans de boîte de réception ;
`/chues/tableau-de-bord` cesse de renvoyer et rend un écran vide (des
notifications déjà envoyées en base pointent sur cette route).

**ROLE-27 mérite un commentaire dans la spec** : renvoyer un COMMERCIAL vers
`/chues` sans rien dire est une **incohérence assumée par le code**
(`redirect('/chues')` au lieu de `PermissionDenied`). Le scénario fige le
comportement actuel ; le rapport doit le nommer comme un écart de traitement du
refus, à trancher par le propriétaire.

### 4.7 Trous relevés en lecture, à éprouver

**ROLE-28 — `/accueil` n'a aucun garde de rôle. P1.**
`apps/web/src/app/(panel)/accueil/page.tsx` rend `<RegistreView />` sans appeler
`guardRoles`. Seul le `layout.tsx` du panel vérifie qu'une session existe. Un
COMMERCIAL ou un BANQUE_FINANCE qui tape `/accueil` obtient donc la coquille du
registre ; l'API répond 403 sur les visites (`role-routes.test.ts` : ni
`VisitesController.list` ni `.statistiques` ne sont ouverts à ces rôles), et
l'écran affiche un état d'erreur de chargement à la place d'un refus lisible.

Scénario, avec l'état COMMERCIAL puis BANQUE_FINANCE :
`page.goto('/accueil')` →
`await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();`
**Ce test doit être écrit tel quel et rester ROUGE.** Il documente le trou.
Le rapport indique : `apps/web/src/app/(panel)/accueil/page.tsx` ne pose pas
`guardRoles(['ADMIN','DIRECTION','ACCUEIL'])` comme ses trois sous-routes.
**Échoue si :** un rôle sans droit sur le registre voit autre chose qu'un refus.

**ROLE-29 — `/grand-public/prospects` n'existe pas et est pourtant lié. P1.**
`apps/web/src/components/console/console-view.tsx` rend un bouton
« Ouvrir l’annuaire » dont le `href` vaut `/grand-public/prospects` quand
`projet === 'GRAND_PUBLIC'`. Aucune route `grand-public/prospects/page.tsx`
n'existe : le chemin est capté par le segment dynamique `/grand-public/[id]` avec
`id = "prospects"`, `fetchProspect('prospects')` échoue (l'API pose un
`ParseUUIDPipe`) et l'écran rend « Cette fiche n’a pas pu être chargée. ».
La liste Grand Public vit à `/grand-public`.

Scénario, état COMMERCIAL : `/grand-public/console` → clic sur
« Ouvrir l’annuaire » → `await expect(page).toHaveURL(/\/grand-public$/)`.
**Doit rester ROUGE** jusqu'à correction du `href`.
**Échoue si :** le lien de l'annuaire Grand Public mène ailleurs que sur la liste
Grand Public.

**ROLE-30 — `/grand-public/campagnes/[id]` rend un écran CHUES. P2.**
`apps/web/src/app/(panel)/grand-public/campagnes/[id]/page.tsx` réexporte
`../../../chues/campagnes/[id]/page`, dont la page est devenue
`LotExportDetailPage` (`LotExportDetailView`, données `/api/v1/lots-export/...`).
La métadonnée de la route Grand Public annonce pourtant
« Campagne d’appels Grand Public ». **Cible mouvante** : `Plan.md` à la racine
décrit le retrait des listes d'appel et la transformation de la campagne en
**lot d'export** (Excel, PDF fiche par fiche, ZIP de PDF), sans assignation ni
tâche, côté web seulement. Écrire le scénario sur la cible de `Plan.md` :
- état ADMIN, `page.goto('/grand-public/campagnes/<id d’un lot existant>')` ;
- assertion : l'écran rend le détail du lot (nombre de fiches, auteur, date,
  boutons d'export) et **aucune** notion d'assignation, de tâche, de file ni de
  « reste à faire » n'apparaît :
  `await expect(page.getByText(/assign|tâche|à appeler|reste à faire/i)).toHaveCount(0)`.
- Marquer le `test()` d'un commentaire `// CIBLE MOUVANTE — Plan.md §0.1`.
**Échoue si :** l'écran affiche encore une répartition par téléconseiller, une
liste d'appel, un compteur de tâches ; ou si la route Grand Public affiche un
titre de document qui ne correspond pas à ce qu'elle rend.

---

## 5. Espace Admin

### 5.1 `/admin` — racine de la coque

Pas d'écran. `apps/web/src/app/(panel)/admin/page.tsx` appelle
`redirect(coqueHomePath(user.role, 'admin'))`. Pour un ADMIN, cela vaut
`/admin/commerciaux`. Il n'existe **aucun tableau de bord ni écran de
supervision sous `/admin`** : la supervision vit à `/chues/supervision`.

**ADM-ROOT-01 P2** — état ADMIN : `page.goto('/admin')` →
`await page.waitForURL(/\/admin\/commerciaux$/)` puis
`await expect(page).toHaveTitle(/Téléconseillers/)`.
**Échoue si :** `/admin` rend une page vide, boucle, ou renvoie ailleurs que sur
la première entrée de la barre Admin.

### 5.2 `/admin/commerciaux` — comptes utilisateurs

Spec cible : **`e2e/admin-utilisateurs.spec.ts` (nouveau)**, `mode: 'serial'`,
état ADMIN.
Composants : `components/commerciaux/commerciaux-view.tsx`,
`user-form-dialog.tsx`, `deactivate-user-dialog.tsx`, `password-dialog.tsx`.
Titre du document : **Téléconseillers**. Titre de niveau 1 (barre) : **Utilisateurs**.

**Données autorisées** : comptes `E2E-ADM-USR-*` / `e2e-adm-usr-*@cpi.test`.
**Interdits** : `admin@cpi.sn`, tous les `fixture.*`, tout compte préexistant.

> **Piège de filtre par défaut, vérifié en lecture.**
> `apps/web/src/lib/user-filters.ts` : `EMPTY_USER_FILTERS.role = 'COMMERCIAL'`.
> **La liste s'ouvre filtrée sur les téléconseillers.** Un compte créé avec le
> rôle ADMIN, BANQUE_FINANCE, SUPERVISEUR, DIRECTION ou ACCUEIL **n'apparaît pas**
> après création tant que le filtre « Rôle » n'est pas changé. Un scénario qui
> crée un banquier puis cherche sa ligne échouera pour cette raison, pas pour un
> bug d'écriture. En tenir compte, et l'éprouver (ADM-USR-04).

| Élément | Libellé exact |
| --- | --- |
| Bouton de création | `Nouvel utilisateur` |
| Champ de recherche | label `Recherche`, placeholder `Nom, e-mail, identifiant…` |
| Filtre rôle | label `Rôle`, valeurs `Tous les rôles`, `Administrateur`, `Téléconseiller`, `Banque & Finance`, `Supervision`, `Direction`, `Accueil` |
| Filtre état | label `État du compte`, valeurs `Tous`, `Actifs`, `Désactivés` |
| Colonnes | `Utilisateur`, `Identifiants`, `Département`, `Prospects`, `Dernière connexion` |
| État vide | `Aucun compte ne correspond à ces critères.` + `Élargissez la recherche ou créez un compte.` |
| Menu de ligne | `Actions pour <nom complet>` (aria-label) |
| Entrées du menu | `Modifier`, `Réinitialiser le mot de passe`, `Désactiver le compte` / `Réactiver le compte` |
| Badge d'un compte fermé | `Désactivé` |
| Jamais connecté | `Jamais connecté` |
| Erreur de liste | `Liste des comptes non chargée.` |

Dialogue de création (`user-form-dialog.tsx`) : titre `Nouvel utilisateur`,
description `Le rôle décide de ce que le compte pourra consulter.`, champs
`Nom complet`, `Adresse e-mail`, `Identifiant` (description
`Utilisé pour la connexion, avec l’e-mail.`), `Téléphone` (description
`Format libre.`), `Rôle`, `Département`, `Mot de passe` (description
`12 caractères minimum.`), boutons `Annuler` et `Créer le compte`.
En modification : titre `Modifier le compte`, description
`Le mot de passe n’est pas modifiable ici.`, bouton `Enregistrer`.

Messages de validation (`apps/web/src/lib/schemas.ts`) :
`Le nom complet est obligatoire.` · `Adresse e-mail invalide.` ·
`L'identifiant compte au moins 3 caractères.` ·
`Lettres, chiffres, point et tiret bas uniquement, sans espace ni accent.` ·
`Le mot de passe compte au moins 12 caractères.` · `Choisissez le rôle du compte.`

Toasts : `Compte de <nom> créé.` · `Compte de <nom> mis à jour.` ·
`<nom> désactivé. Ses prospects et représentants sont conservés.` ·
`<nom> réactivé.` · `Mot de passe réinitialisé. <nom> est déconnecté.`
Erreur 409 relayée par `apiErrorText` : le message serveur est affiché tel quel,
soit **`Cette adresse e-mail est déjà utilisée.`** ou
**`Ce nom d’utilisateur est déjà utilisé.`**
(`apps/api/src/modules/users/users.service.ts`, code `USER_IDENTIFIER_TAKEN`).

| # | Scénario | Prio |
| --- | --- | --- |
| ADM-USR-01 | Création d'un téléconseiller : ouvrir `Nouvel utilisateur`, remplir les six champs, `Créer le compte`. Toast `Compte de E2E-ADM-USR-creation créé.`, la ligne apparaît dans le tableau avec son e-mail et `@identifiant`, `Jamais connecté`, `0` prospect. | P1 |
| ADM-USR-02 | Formulaire vide : cliquer `Créer le compte` sans rien saisir. Les cinq messages de validation s'affichent **et aucune requête `POST /api/v1/users` n'est partie** (`page.on('request')`). | P1 |
| ADM-USR-03 | E-mail déjà pris : rejouer ADM-USR-01 avec le même e-mail et un identifiant différent. Toast d'erreur `Cette adresse e-mail est déjà utilisée.`, la boîte **reste ouverte**, aucune seconde ligne dans le tableau. | P1 |
| ADM-USR-04 | Création d'un compte `Banque & Finance` : après création, la ligne **n'est pas** dans la liste par défaut (filtre `Téléconseiller`) ; changer le filtre `Rôle` sur `Banque & Finance` la fait apparaître, et l'URL porte `?role=BANQUE_FINANCE`. | P1 |
| ADM-USR-05 | Identifiant invalide : saisir `e2e adm usr` (espaces) → `Lettres, chiffres, point et tiret bas uniquement, sans espace ni accent.` | P2 |
| ADM-USR-06 | Mot de passe trop court : 11 caractères → `Le mot de passe compte au moins 12 caractères.` | P2 |
| ADM-USR-07 | Modification du rôle : passer le compte ADM-USR-01 de `Téléconseiller` à `Supervision`, `Enregistrer`, toast `Compte de … mis à jour.`, la ligne disparaît du filtre par défaut et réapparaît sous `Supervision`. | P1 |
| ADM-USR-08 | Recherche temporisée : taper `E2E-ADM-USR` dans `Recherche`, l'URL porte `?search=E2E-ADM-USR` après la temporisation, le tableau ne montre que les lignes du préfixe, un rechargement complet restitue le même écran. | P1 |
| ADM-USR-09 | Recherche sans résultat : taper `E2E-ADM-USR-inexistant`, l'état vide s'affiche avec ses deux phrases exactes. | P2 |
| ADM-USR-10 | Caractères spéciaux : créer un compte dont le nom complet est `E2E-ADM-USR-Ndèye O’Brien & Cie`, vérifier que la ligne l'affiche à l'identique et que la recherche sur `Ndèye` le retrouve. | P2 |
| ADM-USR-11 | Désactivation sans portefeuille : menu → `Désactiver le compte` ; la boîte annonce `Désactiver le compte de <nom> ?`, `0 prospects sont rattachés à ce compte.` (le compteur), **aucun champ de repreneur**, `Rien n’est supprimé.` ; confirmer → toast `<nom> désactivé. Ses prospects et représentants sont conservés.` et badge `Désactivé` sur la ligne. | P1 |
| ADM-USR-12 | Désactivation avec portefeuille : donner au compte un prospect (par l'API, en préparation), rouvrir la boîte, confirmer **sans** choisir de repreneur → message d'erreur dans le champ `Désignez le téléconseiller qui reprend le portefeuille.` et **aucune requête `PATCH .../active` partie**. Puis choisir un repreneur et confirmer → succès. | P1 |
| ADM-USR-13 | Réactivation : menu du compte désactivé → `Réactiver le compte`, toast `<nom> réactivé.`, le badge disparaît. | P2 |
| ADM-USR-14 | Auto-protection : sur la ligne d'`admin@cpi.sn` (le compte de la session), l'entrée `Désactiver le compte` est **désactivée** (`aria-disabled` / `toBeDisabled`). Aucun clic, aucune requête. | P1 |
| ADM-USR-15 | Réinitialisation de mot de passe : menu → `Réinitialiser le mot de passe` ; la description nomme le compte et son e-mail ; saisir deux valeurs différentes → `Les deux mots de passe diffèrent.` ; saisir deux fois la même (≥ 12) → toast `Mot de passe réinitialisé. <nom> est déconnecté.` Le mot de passe posé est une constante de la spec, jamais un secret réel. | P1 |
| ADM-USR-16 | Largeur 375 px : `page.setViewportSize({ width: 375, height: 812 })` ; la barre latérale est repliée derrière `Ouvrir la navigation` ; le tableau défile horizontalement sans que le bouton `Nouvel utilisateur` sorte du cadre ; le menu `Actions pour <nom>` s'ouvre et ses trois entrées sont atteignables. | P2 |
| ADM-USR-17 | Pagination par URL : la vue **ne rend aucun contrôle de pagination** alors que `parseUserFilters` lit `page`. Aller à `/admin/commerciaux?page=2` et vérifier le comportement attendu : soit la deuxième page s'affiche, soit un contrôle permet d'y revenir. **Écrire l'assertion sur la présence d'un contrôle de page ; ce test restera ROUGE et documente l'absence de pagination.** | P2 |

**Échoue si :** la création n'écrit pas ; le 409 est avalé et la boîte se ferme
comme si tout allait bien ; le message d'erreur du serveur est remplacé par un
texte générique ; la désactivation d'un compte porteur de fiches passe sans
repreneur (le portefeuille gèle) ; l'ADMIN peut se désactiver lui-même ; le filtre
de recherche ne survit pas à un rechargement ; à 375 px un geste devient
inatteignable ; un compte créé avec un rôle non-COMMERCIAL est introuvable et rien
ne l'explique.

### 5.3 `/admin/referentiels` — listes de référence

Spec cible : **`e2e/admin-referentiels.spec.ts` (nouveau)**, état ADMIN.
Composant : `components/referentiels/referentiels-view.tsx`, dialogues
`referentiel-form-dialog.tsx`, `deactivate-dialog.tsx`.
Titre du document : **Référentiels**. Titre de barre : **Listes de référence**.

Six onglets : `Banques`, `Syndicats`, `Départements`, `Professions`, `Revenus`,
`Offres`. L'onglet vit dans l'URL (`?onglet=syndicats`), la recherche aussi
(`?recherche=…`), et l'onglet `banques` n'écrit pas de paramètre.
Lien en tête : `Issues d’appel` vers `/admin/referentiels/issues-appel`.

| Onglet | Titre | Description | Bouton de création | Placeholder de recherche | État vide |
| --- | --- | --- | --- | --- | --- |
| Banques | `Banques` | `Domiciliation bancaire du prospect.` | `Nouvelle banque` | `Abréviation ou nom complet…` | `Aucune banque enregistrée.` / `Aucune banque ne correspond à cette recherche.` |
| Syndicats | `Syndicats` | `Appartenance syndicale du prospect.` | `Nouveau syndicat` | `Sigle, nom ou secteur…` | `Aucun syndicat enregistré.` / `Aucun syndicat ne correspond à cette recherche.` |
| Départements | `Départements` | `Triés par région, puis par nom.` | `Nouveau département` | `Département, code ou région…` | `Aucun département enregistré.` / `Aucun département ne correspond à cette recherche.` |

Dialogue : `Nouvelle banque` / `Modifier la banque`, `Nouveau syndicat` /
`Modifier le syndicat` (description `Le sigle est affiché dans les listes de saisie.`),
`Nouveau département` / `Modifier le département`. Bouton `Enregistrer`.
Validation : `Le nom est obligatoire.`, `L'abréviation est obligatoire.`,
`Le sigle est obligatoire.`, `Le code est obligatoire.`,
`La région est obligatoire.`, `L'ordre est un nombre entier.`,
`L'ordre ne peut pas être négatif.`, `Ordre trop grand.`

Actions de ligne (aria-label) : `Monter <abréviation>`, `Descendre <abréviation>`,
`Modifier <abréviation>`.
Toasts : `<sigle> réactivé.`, `<sigle> désactivé.`,
`Réordonnancement impossible. Réessayez.`

Boîte de désactivation (`deactivate-dialog.tsx`) : titre
`Désactiver « <libellé> » ?`, description
`Retirée des listes de saisie. Reste disponible en filtre et en export.`,
compteur `<n> prospects référencent cette banque.`, encart
`Aucun prospect n’est supprimé.` avec la mention du suffixe `(retiré)`,
boutons `Annuler` et `Désactiver`. Si le décompte n'est pas revenu :
alerte `Le nombre de fiches concernées n’a pas pu être lu.` et bouton
`Réessayer le décompte` **à la place** du bouton `Désactiver`.

| # | Scénario | Prio |
| --- | --- | --- |
| ADM-REF-01 | Les six onglets se chargent : cliquer chacun, l'URL porte `?onglet=<clé>` (sauf banques), le titre `<h2>` et la description exacte apparaissent, aucun `Chargement impossible`. | P1 |
| ADM-REF-02 | Création d'une banque : `Nouvelle banque`, nom `E2E-ADM-REF Banque Témoin`, abréviation `E2EREF`, ordre `9000`, `Enregistrer` ; la ligne apparaît en fin de liste. | P1 |
| ADM-REF-03 | Formulaire vide : `Enregistrer` sans rien → `Le nom est obligatoire.` **et** `L'abréviation est obligatoire.`, aucune requête `POST`. | P1 |
| ADM-REF-04 | Doublon d'abréviation : recréer `E2EREF`. L'API n'a pas de garde applicative (`referentiels.service.ts` appelle `prisma.banque.create` sans capter le conflit) ; le filtre Prisma renvoie 409 `UNIQUE_CONSTRAINT_VIOLATION` avec le message **`Cette valeur existe déjà.`**. Assertion sur ce texte exact dans le toast, et la boîte reste ouverte. | P1 |
| ADM-REF-05 | Ordre invalide : saisir `-1` → `L'ordre ne peut pas être négatif.` ; saisir `abc` → `L'ordre est un nombre entier.` | P2 |
| ADM-REF-06 | Tri au clavier : donner le focus au bouton `Monter E2EREF` par `Tab` puis `Enter` ; la ligne remonte d'un rang **dans le DOM** (comparer `allTextContents()` avant/après) ; recharger la page : l'ordre est conservé. | P1 |
| ADM-REF-07 | Désactivation avec décompte : ouvrir la boîte sur `E2E-ADM-REF Banque Témoin` (0 fiche), lire `0 prospect référence cette banque.`, confirmer `Désactiver` ; la ligne porte le suffixe `(retiré)` dans les listes de saisie et reste visible ici. | P1 |
| ADM-REF-08 | Décompte indisponible : intercepter `GET /api/v1/referentiels/usage` avec `page.route(...)` et répondre 500 ; ouvrir la boîte → l'alerte `Le nombre de fiches concernées n’a pas pu être lu.` s'affiche, le bouton `Désactiver` est **absent** (`toHaveCount(0)`) et `Réessayer le décompte` est présent. | P1 |
| ADM-REF-09 | Recherche dans l'URL : taper `E2E-ADM-REF` dans `Rechercher` → l'URL porte `?recherche=E2E-ADM-REF` ; un rechargement restitue le filtre et la même ligne unique. | P2 |
| ADM-REF-10 | Recherche insensible aux accents : chercher `temoin` (sans accent) doit retrouver `Banque Témoin` (`normalize` retire les diacritiques). | P3 |
| ADM-REF-11 | Changement d'onglet vide la recherche : chercher dans `Banques` puis cliquer `Syndicats` → l'URL ne porte plus `recherche`. | P3 |
| ADM-REF-12 | 375 px : les six onglets restent atteignables (défilement horizontal de la `TabsList`), la boîte de création reste utilisable et son bouton `Enregistrer` visible sans zoom. | P2 |

**Échoue si :** un doublon d'abréviation crée une seconde banque ; la
désactivation est proposée alors que le décompte a échoué (le défaut nommé dans
le code : « afficher 0 quand l'appel a échoué faisait retirer d'un clic une
banque portée par des milliers de fiches ») ; le tri au clavier est impossible ;
l'ordre n'est pas persisté ; l'onglet ou la recherche ne vivent pas dans l'URL.

### 5.4 `/admin/referentiels/issues-appel`

Spec cible : **`e2e/admin-issues-appel.spec.ts` (nouveau)**, état ADMIN.
Composant : `components/referentiels/call-outcome-reasons-view.tsx`.
Titre du document : **Issues d’appel**. Titre de barre : hérité de
`Listes de référence`. Utiliser `toHaveTitle(/Issues d’appel/)`.

Introduction : `Issues proposées au téléconseiller à la fin d’un appel.`
Bouton : `Nouveau motif`. Colonnes : `Code`, `Libellé`,
`Effet sur le prospect`, `Couleur`, `Saisie exigée`, `Sur les téléphones`,
`Actions`. Dialogue : `Nouveau motif d’issue` / `Modifier le motif`, champs
`Code` (placeholder `NRP`), `Libellé` (placeholder `Ne répond pas`), couleur
`Aucune`.
Toasts : `<libellé> ajouté. Il atteindra les téléphones après la mise à jour de l’application.`,
`<libellé> enregistré.`, `<libellé> retiré.`, `<libellé> remis en service.`
Conflits serveur (`apps/api/src/modules/referentiels/call-outcome-reasons.service.ts`) :
`Le code « <code> » est déjà utilisé par le motif « <libellé> ».`,
`Le libellé « <libellé> » est déjà porté par le motif « <code> ».`,
`« <libellé> » est un motif système : sa règle est compilée dans l’application de terrain et ne se reconfigure pas ici.`,
`Seul l’effet SCHEDULE_CALLBACK planifie un rappel : « <effet> » ne peut pas en exiger la date.`

| # | Scénario | Prio |
| --- | --- | --- |
| ADM-ISS-01 | L'écran se charge : `toHaveTitle(/Issues d’appel/)`, les sept en-têtes de colonne présents, aucun `Chargement impossible`. | P1 |
| ADM-ISS-02 | Création : `Nouveau motif`, code `E2EISS`, libellé `E2E-ADM-ISS Motif témoin`, effet neutre, `Enregistrer` → toast exact avec la phrase sur les téléphones, la ligne apparaît. | P1 |
| ADM-ISS-03 | Code en doublon : recréer `E2EISS` → toast `Le code « E2EISS » est déjà utilisé par le motif « E2E-ADM-ISS Motif témoin ».`, boîte ouverte, aucune seconde ligne. | P1 |
| ADM-ISS-04 | Libellé en doublon avec un autre code → toast `Le libellé « … » est déjà porté par le motif « … ».` | P2 |
| ADM-ISS-05 | Motif système : tenter de modifier un motif du seed (ex. `NRP`) → toast contenant `est un motif système`. Ne pas persister le changement. | P1 |
| ADM-ISS-06 | Retrait puis remise en service du motif `E2EISS` : les deux toasts exacts, la colonne `Sur les téléphones` reflète l'état. | P2 |
| ADM-ISS-07 | **État vide absent.** La vue rend `query.data.map(...)` sans vérifier `length` : une liste vide produit un tableau à en-têtes et sans corps, sans phrase d'explication. Écrire l'assertion sur la présence d'un état vide (`Aucun motif d’issue`) après avoir filtré à vide. **Ce test reste ROUGE et documente l'absence d'état vide.** | P3 |

**Échoue si :** un code en doublon crée un second motif ; un motif système
devient modifiable (les téléphones en place cassent) ; un motif créé n'apparaît
pas dans la liste après invalidation du cache.

### 5.5 `/admin/imports` — dépôt de classeurs et historique

Spec cible : **`e2e/admin-imports.spec.ts` (nouveau)**, état ADMIN.
Composant : `components/imports/imports-view.tsx`.
Titre du document et titre de barre : **Importer un fichier Excel**.
Repère propre à l'écran : `Déposer un classeur`.

Entités (`lib/data/imports.ts`, `IMPORT_KIND_LABELS`) proposées par le sélecteur
`Entité à importer` : `Prospects CHUES`, `Prospects Grand Public`,
`Représentants`, `Visites`.
Description : `Le fichier est d’abord simulé. Rien n’est écrit tant que vous n’avez pas confirmé l’application.`
Bouton : `Télécharger le modèle`. Plafond de taille : **25 Mo**, message
`Fichier trop volumineux : 25 Mo au maximum.` Extension acceptée : `.xlsx`.
Repli d'historique : `Imports précédents`. État vide de l'historique :
titre `Aucun import`, description
`Déposez un classeur ci-dessus : les travaux apparaîtront ici avec leur rapport.`
Colonnes de l'historique : `Fichier`, `Entité`, `État`, `Créées`, `Ignorées`,
`Erreurs`, `Déposé le`. Pagination : `Page précédente` / `Page suivante`.
Note : `Un travail « échu » n’a pas échoué : son classeur et son rapport ont passé leur échéance.`
Après simulation : `Simulation` (badge), `Déposer un autre fichier`,
`Aucune ligne à créer : tout le fichier est soit déjà en base, soit refusé.`
Toast d'application : `Application lancée. L’écran suit son avancement.`

> Existant : `e2e/representants-import.spec.ts` couvre déjà, pour les
> **représentants**, le téléchargement du modèle, la simulation qui n'écrit rien,
> l'application et le redépôt sans doublon. **Ne pas dupliquer.** Ce document
> couvre l'écran `/admin/imports` lui-même : sélecteur d'entité, refus de
> fichier, historique et pagination.

| # | Scénario | Prio |
| --- | --- | --- |
| ADM-IMP-01 | L'écran se charge : `toHaveTitle(/Importer un fichier Excel/)`, `Déposer un classeur` visible, les quatre entités présentes dans le sélecteur, aucun état d'erreur. | P1 |
| ADM-IMP-02 | Le sélecteur d'entité change le texte d'aide : passer sur `Prospects Grand Public` fait apparaître `Seuls le nom et le téléphone sont exigés` et le plafond de lignes de cette entité. | P2 |
| ADM-IMP-03 | Modèle Grand Public : sélectionner `Prospects Grand Public`, cliquer `Télécharger le modèle`, capturer le `download`, vérifier l'extension `.xlsx` et la signature ZIP `50 4B 03 04` du fichier. | P1 |
| ADM-IMP-04 | Fichier de mauvaise extension : déposer un `.txt` via `setInputFiles` → le dépôt est refusé, aucune requête `POST /api/v1/imports` ne part. | P1 |
| ADM-IMP-05 | Fichier trop gros : fabriquer en mémoire un buffer de 26 Mo nommé `E2E-ADM-IMP-trop-gros.xlsx`, le déposer → toast `Fichier trop volumineux : 25 Mo au maximum.` et **aucune requête** ne part (le contrôle est côté navigateur). | P1 |
| ADM-IMP-06 | Historique : déplier `Imports précédents` ; si des travaux existent, les sept en-têtes sont présents et la ligne la plus récente porte l'entité et l'état ; sinon l'état vide affiche `Aucun import` et sa phrase exacte. | P2 |
| ADM-IMP-07 | Pagination de l'historique : `Page suivante` est désactivée quand il n'y a qu'une page ; s'il y en a plusieurs, un clic change les lignes affichées et le compteur `Travaux d’import` (région `status`) change de texte. | P2 |
| ADM-IMP-08 | Historique en panne : `page.route('**/api/v1/imports*', r => r.fulfill({ status: 500 }))`, recharger, déplier → le message en ligne `L’historique des imports n’a pas pu être chargé.` s'affiche avec `Réessayer`, et le **reste de l'écran (dépôt) reste utilisable**. | P2 |

**Échoue si :** un fichier hors `.xlsx` part vers l'API ; un fichier de plus de
25 Mo est envoyé et occupe la bande passante avant d'être refusé côté serveur ;
l'historique en panne fait tomber toute la page au lieu du seul bloc ;
la simulation applique des lignes sans confirmation.

### 5.6 `/admin/notifications` — composeur et historique

Spec cible : **`e2e/admin-notifications.spec.ts` (nouveau)**, état ADMIN.
Composants : `components/notifications/notifications-view.tsx`,
`notification-composer.tsx`, `inbox-view.tsx`, `template-manager.tsx`.
Titre du document et de barre : **Notifications**.

Trois onglets pour l'ADMIN : `Boîte de réception`, `Historique`, `Gabarits`.
Le non-ADMIN ne voit que `Boîte de réception` (via `/notifications`).
Bouton : `Nouvelle notification`.
Composeur : titre `Nouvelle notification` puis `Confirmer l’envoi` ;
descriptions `Envoi push aux destinataires choisis.` puis `L’envoi est irréversible.` ;
champs `Gabarit` (facultatif, placeholder `Aucun gabarit`), `Titre` (120 car.),
`Message` (500 car.), `Catégorie`, `Lien profond` (description
`Route interne ouverte au tap.`, placeholder `/phase2`), `Destinataires`,
`Rôle` (si audience ROLE), `Département` (si audience DEPARTEMENT),
`Identifiants des comptes` (si audience USERS, description
`Un identifiant par ligne.`), `Quand` avec `Envoyer maintenant` / `Programmer`,
`Date et heure` si `Programmer`.
Boutons finaux : `Envoyer maintenant` ou `Programmer`.
Toasts : `Envoyée à <n> destinataire(s).` ·
`Notification programmée. Annulable jusqu’au départ.` · `Envoi annulé.`
Historique vide : `Aucune notification envoyée` /
`Un envoi part en push vers les destinataires choisis, et reste dans leur boîte de réception.`
+ bouton `Composer la première`. Avec filtres actifs :
`Aucun envoi ne correspond à ces critères` / `Changez d’état ou de catégorie.`
Filtres de l'historique : `État`, `Catégorie`, bouton `Tout effacer`.
Annulation : boîte `Annuler l’envoi « <titre> » ?`
Erreur d'historique : `L’historique des notifications n’a pas pu être chargé.`

**Contrainte de données.** Une notification envoyée part réellement en push et
reste dans la boîte de réception des destinataires. **Les scénarios d'envoi
réel visent l'audience la plus étroite possible** : audience `USERS` avec le seul
identifiant d'un compte `E2E-ADM-USR-*` créé pour l'occasion, jamais
`Tous les comptes` ni un rôle entier. Titre préfixé `E2E-ADM-NOT-`.

| # | Scénario | Prio |
| --- | --- | --- |
| ADM-NOT-01 | Les trois onglets s'affichent pour un ADMIN, l'onglet vit dans l'URL (`?onglet=historique`), un rechargement le restitue. | P1 |
| ADM-NOT-02 | Envoi ciblé : `Nouvelle notification`, titre `E2E-ADM-NOT envoi témoin`, message court, destinataires `Comptes désignés` avec l'identifiant du compte témoin, `Envoyer maintenant` → étape `Confirmer l’envoi` puis toast `Envoyée à 1 destinataire(s).` La ligne apparaît en tête de l'`Historique`. | P1 |
| ADM-NOT-03 | Formulaire vide : ouvrir le composeur et tenter d'avancer → les erreurs de champ obligatoire s'affichent, **aucune requête `POST /api/v1/notifications`** ne part. | P1 |
| ADM-NOT-04 | Titre au-delà de 120 caractères : le champ tronque ou refuse ; le compteur ou le message le dit, et l'envoi ne part pas avec un titre plus long. | P2 |
| ADM-NOT-05 | Programmation : choisir `Programmer`, poser une date **passée** → erreur de champ ; poser une date à J+1 → toast `Notification programmée. Annulable jusqu’au départ.` | P1 |
| ADM-NOT-06 | Annulation d'un envoi programmé : dans l'`Historique`, ouvrir l'annulation → boîte `Annuler l’envoi « E2E-ADM-NOT … » ?`, confirmer → toast `Envoi annulé.` et l'état de la ligne change. | P1 |
| ADM-NOT-07 | Filtres d'historique : choisir un `État` puis une `Catégorie` ; l'URL porte les deux ; `Tout effacer` les retire ; sans résultat, l'état vide affiche `Aucun envoi ne correspond à ces critères`. | P2 |
| ADM-NOT-08 | Détail d'un envoi : ouvrir une ligne → la boîte porte le titre de la notification (pas `Détail de l’envoi`, qui n'est que le repli). | P2 |
| ADM-NOT-09 | Lien profond : saisir `/chemin-inexistant` dans `Lien profond` → le champ signale la route inconnue (`routeIssue`) ; saisir une route de la liste `cpi-routes` → pas d'erreur. | P3 |
| ADM-NOT-10 | 375 px : le composeur (`sm:max-w-4xl`, `max-h-[92vh] overflow-y-auto`) reste défilable, le bouton d'envoi est atteignable, aucun champ n'est coupé. | P2 |

**Échoue si :** un envoi part sans confirmation ; une notification programmée
dans le passé est acceptée ; l'annulation ne change pas l'état de la ligne ;
les filtres ne vivent pas dans l'URL ; un envoi de test atteint une audience plus
large que le compte témoin.

### 5.7 `/admin/parametres` — hors publication Android

Spec cible : **`e2e/admin-parametres.spec.ts` (nouveau)**, état ADMIN.
Titre du document et de barre : **Paramètres**.
Introduction : `Ces actions portent sur les données de tous les utilisateurs.`
Cartes, dans l'ordre : `Espace démo`, `Version Android`,
`Historique des versions`, `Suppression des données`,
`Export intégral de la base` (cette dernière seulement si `DB_DUMP_ENABLED=true`).

| # | Scénario | Prio |
| --- | --- | --- |
| ADM-PAR-01 | L'écran se charge et compose les cartes dans l'ordre : `Espace démo`, `Version Android`, `Historique des versions`, `Suppression des données`. Assertion sur l'ordre réel des titres (`getByRole('heading').allTextContents()`), pas sur leur simple présence. | P1 |
| ADM-PAR-02 | Carte `Espace démo` : la description `Le jeu est reconstruit par la factory à partir des référentiels et comptes actuels.` est visible, les cinq compteurs (`comptes`, `représentants`, `prospects`, `campagnes`, `dossiers bancaires`) portent un nombre, le bouton `Réinitialiser l’espace démo` est présent. **Ne pas cliquer** : la réinitialisation appartient à `demo-isolement.spec.ts`. | P1 |
| ADM-PAR-03 | Carte `Suppression des données` : le badge `Irréversible` est présent et la description `Sélection par domaine. La suppression est définitive.` s'affiche. **Aucun clic sur un geste de purge, jamais.** | P1 |
| ADM-PAR-04 | Carte `Export intégral de la base` : si elle est rendue, la description `Structure et contenu complets, dans une archive compressée. Réservé aux sauvegardes et aux migrations.` s'affiche. **Ne pas déclencher l'export.** Si elle est absente, vérifier que `DB_DUMP_ENABLED` n'est pas posé, et ne pas échouer sur son absence : l'assertion est conditionnelle et documentée. | P3 |
| ADM-PAR-05 | Refus : avec chacun des cinq autres états de rôle, `/admin/parametres` rend `Accès refusé` et le texte `Les paramètres de la plateforme est réservé à un autre rôle.` (couvert aussi par ROLE-17..22 ; garder ici l'assertion sur le libellé « what » précis). | P2 |

**Échoue si :** une carte disparaît de l'écran ; l'ordre change au point de mettre
la purge ou l'export intégral en avant ; les compteurs de l'espace démo affichent
`—` ou restent en squelette.

### 5.8 Publication d'une version Android

Spec cible : **`e2e/android-release.spec.ts` (nouveau)**,
`test.describe.configure({ mode: 'serial' })`, état ADMIN.
Composants : `components/settings/android-release-card.tsx`,
`android-release-upload.ts`, `android-release-upload-toast.tsx`.
Relais : `apps/web/src/app/api/app-updates/android/route.ts`.
API : `apps/api/src/modules/app-updates/**`.

**Libellés exacts de la carte `Version Android`.**
Description : `Le fichier est vérifié par le serveur avant d’être distribué. La version et le numéro de build sont lus dans l’APK.`
Bandeau : `En ligne : ` + `CPI GO <versionName> · build <versionCode>` ou
`aucune version publiée` ; `Plancher obligatoire : ` + `build <n>` ou `aucun`.
Zone de dépôt : bouton-label `Choisir un fichier APK`, aide
`ou glissez le fichier ici. Seuls les fichiers .apk sont acceptés.`
Champ : `Notes de version (facultatif)`, placeholder `Corrections et nouveautés…`,
2 000 caractères.
Bouton : `Publier` ; pendant l'envoi : `Envoi en cours…` (bouton désactivé) et
le message `L’envoi continue en bas de l’écran, même si vous changez de page.`
Refus local : `Déposez un fichier .apk.`

**Barre de progression (toast persistant, `id: 'android-release-upload'`).**
Rendue par `AndroidReleaseUploadToast`, montée à côté du `Toaster` : elle vit
**sur tous les écrans**. Contenu : nom du fichier, pourcentage
(`<n> %`), une `Progress` d'aria-label `Envoi de <nom du fichier>`,
`<taille envoyée> sur <taille totale>`, bouton `Annuler`.
Formats de taille (`formatFileSize`) : `<n> Ko` sous 1 Mo, `<n,n> Mo` au-delà.

**Popup de fin.** Titre `Version publiée`, description
`Voici ce que le serveur a lu dans le fichier. Rien n’a été saisi à la main.`,
liste `Version`, `Build`, `Taille`, `Empreinte`, `Signataire` (les deux
empreintes raccourcies à `8 premiers…8 derniers` par `shortHash`), encart
`Rendre obligatoire` / `Les téléphones en dessous de cette version devront l’installer pour continuer.`
ou, si déjà obligatoire, `Cette version est déjà une mise à jour obligatoire.`
Boutons `Fermer` et `Rendre obligatoire`.
Toast de succès en parallèle : `CPI GO <versionName> publiée.`
Toast d'annulation : `Envoi annulé.`
Toast d'échec : le message du serveur, sinon `La publication a échoué.`

**Historique.** Carte `Historique des versions`, description
`Les versions retirées restent listées : elles ne sont plus distribuées.`
Colonnes : `Build`, `Version`, `Publiée le`, `Par`, `Taille`, `Obligatoire`,
`État`, (actions). Badges : `Mise à jour obligatoire` / `Non`, `Retirée` / `En ligne`.
Actions : `Rendre obligatoire`, `Retirer`.
État vide : `Aucune version publiée.`
Erreur : `L’historique des versions Android n’a pas pu être lu.`
Boîte de retrait : titre `Retirer CPI GO <versionName> ?`, description
`Le retrait arrête la distribution de cette version et abaisse le plancher. Il ne désinstalle rien sur les téléphones qui l’ont déjà.`,
encart `Build <n> · Signataire <empreinte courte>`, bouton `Retirer`.
Toasts : `CPI GO <versionName> retirée.`,
`CPI GO <versionName> est maintenant obligatoire.`,
`Le retrait a échoué.`, `La version n’a pas pu être rendue obligatoire.`

**Erreurs serveur, messages exacts** (`apk-manifest.ts`, `apk-signature.ts`,
`app-updates.service.ts`) — le panel les relaie tels quels via `apiErrorText` :

| Code | Message (extrait à asserter) |
| --- | --- |
| `APK_MANIFEST_UNREADABLE` (400) | `Le manifeste de cet APK est illisible` |
| `APK_FOREIGN_PACKAGE` (422) | `et non « sn.cpi.go »` |
| `APK_VERSION_NOT_GREATER` (422) | `Une publication doit être STRICTEMENT supérieure` |
| `APK_UNSIGNED` (422) | `ne porte pas de bloc de signature v2/v3 lisible` |
| `APK_SIGNER_MISMATCH` (422) | `Android refuse une mise à jour signée par une autre clé` |
| `APK_RELEASE_UNKNOWN` (404) | `Aucune release en ligne ne porte le versionCode` |
| `APK_LAST_RELEASE` (409) | `C’est la seule release en ligne` |
| `APK_VERSION_WITHDRAWN` (404) | sur le téléchargement d'une version retirée |

> Existant : `apps/web/src/components/settings/android-release-card.test.tsx`
> couvre déjà en Vitest la progression, la fenêtre de confirmation, le refus de
> signataire, l'annulation, la survie de la barre au démontage de la carte,
> l'historique, le passage en obligatoire, le retrait et le refus de retirer la
> dernière version. **Ce que le Vitest ne peut pas prouver, et que ces scénarios
> doivent prouver : le flux réel de 8 Ko traverse `XMLHttpRequest`, le relais
> Next `duplex: 'half'`, le multipart Fastify, la lecture du manifeste et du bloc
> de signature sur disque, et la barre survit à une VRAIE navigation de page.**

| # | Scénario | Prio |
| --- | --- | --- |
| APK-01 | Publication réussie de `cpi-go-v7.apk` : `setInputFiles` sur l'entrée `.apk`, le nom du fichier et sa taille (`8 Ko`) s'affichent sous la zone de dépôt, `Publier` → la barre apparaît en bas à droite avec `Envoi de cpi-go-v7.apk` ; à la fin, toast `CPI GO 1.0.7 publiée.` (adapter le `versionName` réel lu dans la fixture) et la popup `Version publiée` s'ouvre. | P1 |
| APK-02 | La popup dit ce que le serveur a lu : `Version`, `Build`, `Taille`, `Empreinte`, `Signataire` sont renseignés ; le `Signataire` affiché correspond au raccourci de `9434b1f9…ad7f3909` ; aucune valeur n'est vide ni `—`. | P1 |
| APK-03 | Publier puis rendre obligatoire sont **deux gestes** : à l'ouverture de la popup, l'encart `Rendre obligatoire` est une proposition, pas un fait ; le bandeau de la carte affiche encore `Plancher obligatoire : aucun` (ou l'ancien plancher). Cliquer `Rendre obligatoire` → toast `CPI GO <version> est maintenant obligatoire.` et le bandeau passe à `build <n>`. | P1 |
| APK-04 | **Envoi non bloquant.** Pendant l'envoi (barre visible, bouton `Publier` désactivé, message `L’envoi continue en bas de l’écran, même si vous changez de page.`), naviguer vers `/admin/commerciaux` par un clic dans la barre latérale. La barre de progression **reste visible** et l'envoi aboutit : le toast de succès apparaît alors qu'on est sur un autre écran. Le fichier de 8 Ko partant trop vite, ralentir le relais avec `page.route('**/api/app-updates/android', async route => { await new Promise(r => setTimeout(r, 4000)); await route.continue(); })` — un délai posé sur le **réseau** est légitime ; un `waitForTimeout` dans le test ne l'est pas. | P1 |
| APK-05 | Annulation : pendant l'envoi ralenti, cliquer `Annuler` dans la barre → toast `Envoi annulé.`, la barre disparaît, **aucune nouvelle ligne dans l'historique** (relire `GET /api/v1/app-updates/android/releases` par l'API et comparer le nombre d'éléments). | P1 |
| APK-06 | `APK_SIGNER_MISMATCH` : déposer `cpi-go-v12-autre-cle.apk` → toast contenant `Android refuse une mise à jour signée par une autre clé`, aucune ligne ajoutée à l'historique. Précondition : `APK_SIGNER_SHA256` posée (§2.6). | P1 |
| APK-07 | `APK_UNSIGNED` : déposer `cpi-go-v7-non-signe.apk` → toast contenant `ne porte pas de bloc de signature v2/v3 lisible`. | P1 |
| APK-08 | `APK_FOREIGN_PACKAGE` : déposer `autre-editeur-v99.apk` → toast contenant `et non « sn.cpi.go »`. | P1 |
| APK-09 | `APK_MANIFEST_UNREADABLE` : déposer `manifeste-illisible.apk` → toast contenant `Le manifeste de cet APK est illisible`. | P1 |
| APK-10 | `APK_VERSION_NOT_GREATER` : republier `cpi-go-v7.apk` après que la 7 (ou plus) soit en ligne → toast contenant `Une publication doit être STRICTEMENT supérieure`. | P1 |
| APK-11 | Fichier non-APK : `setInputFiles` avec un `.txt` renommé sans extension `.apk` → toast local `Déposez un fichier .apk.` et **aucune requête** vers `/api/app-updates/android`. | P1 |
| APK-12 | `APK_LAST_RELEASE` : quand une seule version est en ligne, cliquer `Retirer` puis confirmer → toast contenant `C’est la seule release en ligne`, la ligne reste `En ligne`. Si plusieurs versions sont en ligne au moment du test, publier d'abord `cpi-go-v12.apk` puis retirer la 7, et ne pas jouer ce scénario — le noter dans le retour plutôt que de retirer une version qu'on n'a pas publiée. | P1 |
| APK-13 | Retrait normal : avec deux versions en ligne, `Retirer` la plus ancienne → la boîte affiche `Retirer CPI GO <version> ?`, la phrase `Il ne désinstalle rien sur les téléphones qui l’ont déjà.` et l'encart `Build <n> · Signataire <empreinte courte>` ; confirmer → toast `CPI GO <version> retirée.`, la ligne passe au badge `Retirée` et perd ses boutons d'action. | P1 |
| APK-14 | Plancher après retrait : rendre la version 7 obligatoire, publier la 12, retirer la 7 → le bandeau `Plancher obligatoire` **redescend** (`aucun` ou le build obligatoire encore en ligne). C'est le comportement annoncé par la boîte de retrait ; l'assertion porte sur le bandeau, pas sur l'API. | P1 |
| APK-15 | Historique : les huit en-têtes sont présents, la ligne la plus récente porte le `Build`, la `Version`, la taille formatée (`8 Ko`), le nom du publieur (`Par`) et le badge `En ligne`. Une version retirée reste listée. | P2 |
| APK-16 | Historique en panne : `page.route('**/api/v1/app-updates/android/releases', r => r.fulfill({ status: 500 }))` → la carte affiche `L’historique des versions Android n’a pas pu être lu.` avec un bouton `Réessayer`, et le reste de `/admin/parametres` (carte `Espace démo`, carte de suppression) reste rendu. | P2 |
| APK-17 | Notes de version : publier `cpi-go-v12.apk` avec une note `E2E-APK note de version`, vérifier qu'elle est enregistrée (relecture par l'API `GET .../releases`, champ `notes`). Le champ est limité à 2 000 caractères : coller 2 100 caractères et vérifier que le champ tronque. | P3 |
| APK-18 | Avertissement de fermeture : pendant l'envoi ralenti, `window.dispatchEvent(new Event('beforeunload'))` n'est pas observable ; à la place, vérifier que l'écouteur est bien posé en tentant `page.goto('/')` pendant l'envoi et en constatant que Playwright n'est pas bloqué (les dialogues `beforeunload` sont auto-acceptés). **Assertion réelle : après la navigation, la barre est toujours montée et l'envoi se termine.** | P3 |

**Échoue si :** l'envoi bloque la navigation ; la barre de progression disparaît
quand on quitte `/admin/parametres` ; un APK signé d'une autre clé est publié
(le parc devrait désinstaller l'application pour accepter la mise à jour, en
perdant les saisies non synchronisées) ; un APK non signé ou d'un autre éditeur
est accepté ; un `versionCode` inférieur ou égal est publié (le parc reçoit une
version plus ancienne que la sienne) ; « publier » rend automatiquement
obligatoire ; le retrait de la dernière version en ligne passe (le parc n'a plus
rien à télécharger) ; le plancher ne redescend pas après un retrait ; une erreur
serveur est remplacée par un message générique qui n'apprend rien à
l'administrateur.

**Ne pas faire :** ne pas télécharger l'APK depuis
`GET /api/v1/app-updates/android/download` en boucle — le limiteur est de dix
par heure et il est partagé avec les tests d'un autre plan. Un seul
téléchargement, si vraiment nécessaire, et le dire dans le retour.

---

## 6. Espace Projet Grand Public

Spec cible principale : **`e2e/grand-public.spec.ts` (nouveau)**, état ADMIN
sauf mention contraire. Tableau de bord : **`e2e/grand-public-chiffres.spec.ts` (nouveau)**.

### 6.1 `/grand-public` — liste des prospects

Composant : `components/grand-public/prospects-view.tsx`.
Titre du document : **Prospects Grand Public**. Titre de barre : **Prospects**
(ADMIN, DIRECTION, SUPERVISEUR) ou **Mes prospects** (COMMERCIAL, replié).
La page rend **son propre `<h1>` : `Prospects Grand Public`** — deux `<h1>` dans
le document (§1.3).
Sous-titre : `Les particuliers démarchés hors syndicat. Les fiches CHUES ne figurent pas ici.`

Filtres : `Rechercher` (placeholder `Nom, prénom ou téléphone`), bouton
`Filtres` (avec `(<n>)` quand des critères sont actifs), `Canal de provenance`
(placeholder `Tous les canaux`), groupes `Situation` et `Statut` (boutons
`aria-pressed`), `Saisi à partir du`, `Saisi jusqu’au`, `Tout effacer`.
Colonnes : `Nom`, `Statut`, `Situation`, `Profession`, `Canal`, `Banque`,
`Segment`, `Téléconseiller`, `Saisi le`.
Compteur (région `status`) : `Prospects affichés : ` puis
`<premier>–<dernier> sur <total>` ou `Aucun résultat`.
Pagination : `Lignes` (sélecteur), `Page précédente`, `Page suivante`, `<n> / <n>`.
État vide sans filtre : `Aucun prospect Grand Public n’a encore été saisi.` /
`La première fiche se crée depuis « Nouveau prospect ».` + bouton `Nouveau prospect`.
État vide avec filtres : `Aucun prospect ne correspond à ces filtres.` /
`Élargissez la période ou retirez un critère.`
Erreur : `La liste des prospects Grand Public n’a pas pu être chargée.`
Erreur partielle des canaux :
`La liste des canaux de provenance n’a pas pu être chargée. Les autres filtres restent utilisables.`
Bouton de création : `Nouveau prospect` (visible seulement si
`canCreate = !readsOnly(role)` — donc **pas** pour SUPERVISEUR ni DIRECTION).

| # | Scénario | Prio |
| --- | --- | --- |
| GP-01 | L'écran se charge : `toHaveTitle(/Prospects Grand Public/)`, le sous-titre exact, les neuf en-têtes de colonne, le compteur non vide, aucun état d'erreur. | P1 |
| GP-02 | Filtre de statut : déplier `Filtres`, cliquer `Nouveau` dans le groupe `Statut` ; le bouton porte `aria-pressed="true"` ; l'URL porte `statut=NOUVEAU` ; le compteur change ; **un rechargement complet restitue le même compteur et le même bouton pressé**. | P1 |
| GP-03 | Le bouton `Filtres` affiche le nombre de critères actifs : `Filtres (2)` après un statut et une date. | P2 |
| GP-04 | `Tout effacer` retire les critères, l'URL redevient `/grand-public` sans paramètre (sauf `pageSize` si modifié), et le compteur revient au total. | P2 |
| GP-05 | Recherche : taper le téléphone d'un prospect `E2E-GP-*` créé en préparation → une seule ligne, son nom affiché en `<prénom> <nom>`. | P1 |
| GP-06 | État vide filtré : chercher `E2E-GP-inexistant-zzz` → `Aucun prospect ne correspond à ces filtres.` et `Élargissez la période ou retirez un critère.` | P1 |
| GP-07 | Pagination : passer `Lignes` à la plus petite valeur, `Page suivante` change le compteur `<a>–<b> sur <total>` et l'URL porte `page=2` ; `Page précédente` est désactivée sur la page 1, `Page suivante` sur la dernière. | P1 |
| GP-08 | Grande volumétrie : avec `pageSize` au maximum et le total réel de la base, le tableau rend ses lignes en moins de la limite de `expect` et le compteur affiche le total exact renvoyé par `GET /api/v1/prospects` (comparer avec l'API). | P2 |
| GP-09 | Rôle lecteur : avec l'état SUPERVISEUR puis DIRECTION, l'écran se charge **et le bouton `Nouveau prospect` est absent** (`toHaveCount(0)`), en haut de page comme dans l'état vide. | P1 |
| GP-10 | Canaux en panne : `page.route('**/api/v1/referentiels/canaux-provenance*', r => r.fulfill({ status: 500 }))` → le message de panne partielle s'affiche **et le tableau des prospects reste rendu**. | P2 |
| GP-11 | 375 px : le tableau défile horizontalement (`overflow-x-auto`), le compteur et la pagination restent visibles, le bouton `Nouveau prospect` reste atteignable. | P2 |
| GP-12 | Ouverture d'une fiche : cliquer le nom d'une ligne → `waitForURL(/\/grand-public\/[0-9a-f-]{36}$/)` et la fiche rend le nom et le téléphone. | P1 |

**Échoue si :** un filtre ne survit pas au rechargement (le lien partagé ramène
la liste entière sans rien signaler) ; le compteur ment sur le total ; un
SUPERVISEUR ou une DIRECTION se voit proposer une création que l'API refusera ;
une panne du référentiel des canaux fait tomber toute la liste ; des fiches CHUES
apparaissent dans la liste Grand Public.

### 6.2 `/grand-public/nouveau` — saisie d'un prospect

Composant : `components/grand-public/prospect-form.tsx`.
Titre du document : **Nouveau prospect Grand Public**.
`<h1>` de page : `Nouveau prospect Grand Public`, sous-titre
`Le nom, le prénom et le téléphone suffisent. Le reste se complète plus tard.`
Champs : `Prénom` (obligatoire), `Nom` (obligatoire), téléphone, `Profession`
(placeholder `Rechercher une profession`), groupe `Situation`,
`Banque de domiciliation` (`Choisir une banque`), `Syndicat` (`Choisir un syndicat`),
`Revenu mensuel` (`Choisir une tranche`), `Paiement` (`Comptant`, `Échelonné`),
`Durée de remboursement`, `Canal de provenance` (`Choisir un canal`).
Aide : `Ctrl + Entrée enregistre et enchaîne. Le canal et la durée restent en place.`
Après une saisie : `<n> prospect(s) enregistré(s). Dernier : <nom>.`
Boutons : `Enregistrer et ouvrir la fiche` (secondaire) et
`Enregistrer et suivant` (principal, `Enregistrement…` pendant l'envoi).
Toast : `<prénom> <nom> enregistré.`
Le même formulaire est monté **en boîte** depuis la liste (`embedded`), sous le
titre `Nouveau prospect Grand Public` et la description
`Le nom, le prénom et le téléphone suffisent.` — sans le `<h1>`.
Accès : ADMIN et COMMERCIAL seulement.

| # | Scénario | Prio |
| --- | --- | --- |
| GP-13 | Saisie minimale : prénom `E2E-GP`, nom `Temoin01`, téléphone `+221781002001`, `Enregistrer et suivant` → toast `E2E-GP Temoin01 enregistré.`, le formulaire se vide **sauf** le canal et la durée, et le compteur passe à `1 prospect enregistré. Dernier : …`. | P1 |
| GP-14 | Champs vides : `Enregistrer et suivant` sans rien → les messages d'obligation s'affichent sur `Prénom`, `Nom` et le téléphone, **aucune requête `POST /api/v1/prospects`** ne part. | P1 |
| GP-15 | Numéro déjà pris : rejouer GP-13 avec le même téléphone → le refus du serveur (409) est affiché et **nomme la fiche existante** ; aucun second prospect créé (recompte par l'API). | P1 |
| GP-16 | Raccourci clavier : remplir puis `Control+Enter` → même comportement que `Enregistrer et suivant`. Utiliser `page.keyboard.press('Control+Enter')` sur le formulaire, pas un clic. | P2 |
| GP-17 | `Enregistrer et ouvrir la fiche` : le navigateur arrive sur `/grand-public/<uuid>` et la fiche porte le nom saisi. | P1 |
| GP-18 | Saisie depuis la boîte de la liste : depuis `/grand-public`, `Nouveau prospect` ouvre la boîte titrée `Nouveau prospect Grand Public` avec la description courte ; enregistrer ferme la boîte et la nouvelle ligne apparaît dans le tableau **sans rechargement**. | P1 |
| GP-19 | Caractères spéciaux : prénom `E2E-GP Ndèye-Awa`, nom `O’Brien` → la fiche et la liste les affichent à l'identique. | P2 |
| GP-20 | Refus de rôle : avec l'état SUPERVISEUR, `/grand-public/nouveau` rend `Accès refusé` et `La saisie d’un prospect Grand Public est réservé à un autre rôle.` | P1 |
| GP-21 | 375 px : la grille `sm:grid-cols-2` passe en une colonne, les deux boutons d'enregistrement restent atteignables sans défilement horizontal. | P2 |

**Échoue si :** un prospect est créé sans nom ou sans téléphone ; un doublon de
téléphone crée une seconde fiche ; le canal et la durée sont perdus entre deux
saisies en rafale (le formulaire est conçu pour l'enchaînement) ; la boîte de la
liste ne rafraîchit pas le tableau.

### 6.3 `/grand-public/[id]` — fiche d'un prospect

Composant : `components/grand-public/prospect-detail.tsx`.
Titre du document : **Fiche Grand Public**. `<h1>` de page : le nom du prospect.
Lien de retour : `Prospects Grand Public` vers `/grand-public`.
Cartes : `Le prospect` (`Situation`, `Profession`, `Canal de provenance`,
`Durée du système`), `Rattachements` (`Banque de domiciliation`, `Syndicat`,
`Représentant`, `Segment`), `Suivi` (`Téléconseiller`, `Saisi le`, `Dernier appel`).
Absences nommées : `Question non posée`, `Non renseignée`, `Aucun`,
`Jamais appelé`.
Gestes (si `canEdit`, c'est-à-dire ADMIN ou COMMERCIAL, et statut ≠ `CONVERTI`) :
`Intéressé`, `Refusé`, puis `Confirmer la conversion` si `Intéressé`.
Toasts : `Consentement enregistré.`, `Conversion confirmée.`
Boîte de conversion : titre `Confirmer la conversion`, champ `Offre`.
Fiche d'un autre projet : `Cette fiche relève du projet CHUES`, texte
`Les deux projets ne partagent aucun écran. Elle se consulte depuis le suivi CHUES.`,
lien `Ouvrir le suivi CHUES` vers `/chues/prospects`.
Chargement impossible : `Cette fiche n’a pas pu être chargée.`

| # | Scénario | Prio |
| --- | --- | --- |
| GP-22 | Fiche complète : ouvrir la fiche d'un prospect `E2E-GP-*`, les trois cartes rendent leurs libellés, le téléphone est un lien `tel:` cliquable, le badge de statut correspond au statut de la liste. | P1 |
| GP-23 | Absences : sur une fiche saisie au minimum, `Situation` affiche `Question non posée`, `Durée du système` affiche `Non renseignée`, `Segment` affiche `Aucun`, `Dernier appel` affiche `Jamais appelé`. C'est le point : l'écran **nomme** l'absence au lieu d'un tiret muet. | P1 |
| GP-24 | Consentement : cliquer `Intéressé` → toast `Consentement enregistré.` et le bouton `Confirmer la conversion` apparaît. Cliquer `Refusé` → le consentement bascule et le bouton de conversion disparaît. | P1 |
| GP-25 | Conversion : depuis `Intéressé`, `Confirmer la conversion` → boîte titrée `Confirmer la conversion`, choisir une `Offre`, confirmer → toast `Conversion confirmée.`, le badge passe à `Converti` et **les trois boutons de consentement disparaissent**. | P1 |
| GP-26 | Fiche CHUES ouverte depuis Grand Public : ouvrir `/grand-public/<id d’un prospect CHUES>` → `Cette fiche relève du projet CHUES` et le lien `Ouvrir le suivi CHUES` pointe sur `/chues/prospects`. | P1 |
| GP-27 | Identifiant invalide : `/grand-public/pas-un-uuid` → l'écran rend un état d'erreur lisible en français, pas une trace ni une page blanche. Assertion sur `Cette fiche n’a pas pu être chargée.` ou sur le titre `Requête refusée` de `QueryErrorState`. | P1 |
| GP-28 | Rôle lecteur : avec SUPERVISEUR, la fiche se charge mais `Intéressé`, `Refusé` et `Confirmer la conversion` sont **absents** (`toHaveCount(0)`). | P1 |

**Échoue si :** une fiche CHUES est éditable depuis l'écran Grand Public ; une
absence est rendue par un tiret sans explication ; un rôle en lecture seule se
voit proposer un geste que l'API refusera ; un identifiant invalide casse
l'écran.

### 6.4 `/grand-public/console`

Composant : `components/console/console-view.tsx` — **écran devenu un renvoi**.
`<h1>` de page : `Rechercher une fiche`. Texte :
`Les fiches sont consultées librement. Ouvrez l’annuaire pour chercher un prospect et consigner l’appel.`
Bouton : `Ouvrir l’annuaire`, `href` = `/grand-public/prospects` pour ce projet.
Titre du document : **Appeler les prospects**.

| # | Scénario | Prio |
| --- | --- | --- |
| GP-29 | L'écran se charge : `toHaveTitle(/Appeler les prospects/)`, `<h1>` `Rechercher une fiche` et le texte exact. Aucune file d'appels, aucune carte clavier. | P1 |
| GP-30 | Le lien `Ouvrir l’annuaire` mène à la liste Grand Public : **voir ROLE-29, ce test reste ROUGE** tant que le `href` vaut `/grand-public/prospects`. | P1 |
| GP-31 | Refus : avec SUPERVISEUR et DIRECTION, `Accès refusé` et `La file d’appel Grand Public est réservé à un autre rôle.` | P2 |

> **Note pour la fusion des trois plans.** `e2e/console.spec.ts` couvre encore la
> console CHUES avec traitement d'appel au clavier, saisie en rafale, numéro déjà
> pris et cascade région/département, et `e2e/accessibility.spec.ts` /
> `e2e/prospects.spec.ts` attendent le repère `Carte clavier` sur `/console`.
> `ConsoleView` ne rend plus rien de tout cela. **Ces fichiers sont déjà rouges.**
> L'agent ne les corrige pas ; il le signale.

### 6.5 `/grand-public/rappels`

`apps/web/src/app/(panel)/grand-public/rappels/page.tsx` réexporte la page CHUES.
`components/rappels/rappels-view.tsx` lit le projet dans l'URL
(`pathname.startsWith('/grand-public') ? 'GRAND_PUBLIC' : 'CHUES'`) : la file est
bien bornée au projet.
Titre du document : **Rappels**. Onglets : `En retard`, `Aujourd’hui`, (semaine).
États vides : `Aucun rappel en retard`, `Aucun rappel aujourd’hui`,
`Aucun rappel cette semaine`.
Filtre par téléconseiller : seulement si `canFilter` (rôle ≠ COMMERCIAL).

| # | Scénario | Prio |
| --- | --- | --- |
| GP-32 | L'écran se charge et **les requêtes portent bien le projet Grand Public** : intercepter `GET /api/v1/callbacks*` et vérifier que le paramètre de projet vaut `GRAND_PUBLIC`. C'est la seule preuve que la page réexportée ne sert pas la file CHUES sous une étiquette Grand Public. | P1 |
| GP-33 | Les trois portées se sélectionnent et l'état vide correspondant s'affiche quand il n'y a rien, avec son libellé exact. | P2 |
| GP-34 | Avec l'état COMMERCIAL, le filtre par téléconseiller est **absent** ; avec SUPERVISEUR il est présent. | P2 |

**Échoue si :** la file Grand Public affiche des rappels CHUES ; un état vide est
rendu par un tableau sans corps ; un téléconseiller peut regarder la file d'un
autre.

### 6.6 `/grand-public/statistiques` — « Tableau de bord »

Spec cible : **`e2e/grand-public-chiffres.spec.ts` (nouveau)**.
Composant : `components/chiffres/vue.tsx` (`ChiffresView ecran="grand-public"`),
barre d'édition `components/accueil/tableau-de-bord/barre-edition.tsx`.
Titre du document : **Tableau de bord Grand Public**. Titre de barre :
**Tableau de bord**. Accès : ADMIN, SUPERVISEUR, DIRECTION.
Disposition : `GET/PUT/DELETE /api/v1/tableaux-de-bord/grand-public/disposition`,
et `PUT .../par-defaut` réservé à l'ADMIN.

> **Libellé à corriger dans les autres plans.** La porte d'entrée du mode
> organisation **ne s'appelle pas « Organiser » sur cet écran**.
> `ChiffresView` passe `entryLabel="Composer l’écran"`. Le libellé `Organiser`
> (défaut de `BarreEdition`) et `Organiser les graphiques` valent pour le tableau
> de bord du registre des visites, pas ici. Une fois le mode ouvert, les libellés
> sont communs : `Mode organisation`, `Enregistrer`, `Quitter`,
> `Proposer par défaut` (ADMIN seul).

Autres libellés : `Revenir à l’écran par défaut` (visible seulement si la
disposition vient de l'utilisateur), sélecteur `Téléconseiller regardé` avec
`Toute l’équipe`, état vide
`Cet écran est vide. Ouvrez « Composer l’écran » pour y poser vos chiffres.`,
message d'erreur `Les chiffres n’ont pas pu être calculés. Réessayez.`,
message par carte `Rien sur la période.`
Boîtes de confirmation : `Quitter sans enregistrer` /
`Les changements faits dans ce mode seront perdus.` et
`Fixer la disposition par défaut` /
`Les comptes qui n’ont rien enregistré verront cette organisation.`

| # | Scénario | Prio |
| --- | --- | --- |
| GP-35 | L'écran se charge : `toHaveTitle(/Tableau de bord Grand Public/)`, le bouton `Composer l’écran` est présent, l'indicateur de fraîcheur est monté, aucune erreur. | P1 |
| GP-36 | Ouverture du mode : cliquer `Composer l’écran` → l'étiquette `Mode organisation` apparaît, `Enregistrer` et `Quitter` sont présents, et **le rafraîchissement automatique est mis en pause** (l'indicateur le dit). | P1 |
| GP-37 | Ajouter une carte : ouvrir le tiroir, poser une carte, `Enregistrer` → un `PUT /api/v1/tableaux-de-bord/grand-public/disposition` part avec cette source, le mode se referme, la carte est visible. **Recharger la page** : la carte est toujours là. C'est la preuve de la persistance côté serveur. | P1 |
| GP-38 | Retirer une carte puis `Quitter` avec des changements → la boîte `Quitter sans enregistrer` s'affiche ; confirmer → la disposition **d'avant** est restaurée (la carte retirée est de retour). | P1 |
| GP-39 | `Revenir à l’écran par défaut` : après GP-37, le bouton est visible ; cliquer → `DELETE` part, la disposition revient à celle par défaut, et le bouton disparaît (la source n'est plus `utilisateur`). | P1 |
| GP-40 | Écran vide : retirer toutes les cartes et enregistrer → `Cet écran est vide. Ouvrez « Composer l’écran » pour y poser vos chiffres.` Remettre ensuite la disposition par `DELETE` dans le `afterAll`. | P2 |
| GP-41 | `Proposer par défaut` réservé à l'ADMIN : en mode organisation, le bouton est présent avec l'état ADMIN et **absent** avec SUPERVISEUR et DIRECTION (`toHaveCount(0)`). Confirmé côté API : `DashboardsController.putDefault` est `@Roles(ADMIN)`. **Ne pas cliquer** : cela changerait la disposition de tous les comptes. | P1 |
| GP-42 | Période dans l'URL : changer la période dans `SelecteurPeriode` → l'URL porte les paramètres, un rechargement restitue exactement le même écran et le même libellé de période (`aria-live="polite"`). | P1 |
| GP-43 | Filtre par téléconseiller : choisir une personne dans `Téléconseiller regardé` → l'URL porte `teleconseiller=<id>` et le **déclencheur affiche son NOM**, pas son identifiant. Revenir à `Toute l’équipe` retire le paramètre. | P1 |
| GP-44 | Chiffres en panne : `page.route('**/api/v1/analytics/**', r => r.fulfill({ status: 500 }))` → `Les chiffres n’ont pas pu être calculés. Réessayez.` avec un bouton `Réessayer`, et la barre latérale reste montée. | P2 |
| GP-45 | Montants réservés : le catalogue de cartes est calculé avec `voitLesMontants = role === 'ADMIN' || role === 'DIRECTION'`. Avec l'état SUPERVISEUR, ouvrir le tiroir et vérifier qu'**aucune carte de montant** n'y est proposée. Nommer dans la spec les sources exactes lues dans `components/chiffres/sources.ts`. | P1 |
| GP-46 | 375 px : la grille de cartes passe en une colonne, la barre d'édition ne déborde pas, le bouton `Composer l’écran` reste atteignable. | P2 |
| GP-47 | `/grand-public/tableau-de-bord` renvoie en permanence vers `/grand-public/statistiques` : `page.goto` puis URL finale exacte. | P2 |

**Échoue si :** une disposition enregistrée ne survit pas au rechargement ;
`Quitter` perd une disposition enregistrée ou en garde une abandonnée ; un
SUPERVISEUR peut fixer la disposition par défaut de tout le monde ; un
SUPERVISEUR voit les montants ; le sélecteur d'équipe affiche un UUID ;
la période ne vit pas dans l'URL (l'écran n'est plus partageable par lien).

### 6.7 `/grand-public/campagnes/[id]`

Voir **ROLE-30** (§4.7). Cible mouvante, `Plan.md`. Priorité **P2**.

---

## 7. Espace démo

Spec cible : **`e2e/demo-isolement.spec.ts` (nouveau)**,
`test.describe.configure({ mode: 'serial' })`, état ADMIN.
**Seule spec autorisée à basculer d'espace et à appeler
`POST /api/v1/admin/demo/reset`.**

> Existant : `e2e/workspaces.spec.ts` porte déjà
> « l’espace démo se réinitialise et reste isolé ». **Lire ce test avant
> d'écrire.** Ce qui manque et que ce document demande : l'isolement dans **les
> deux sens**, le contenu attendu après réinitialisation, et le comportement du
> rôle BANQUE_FINANCE en démo.

**Bascule.** Menu de compte (`Compte de <nom complet>`, `components/layout/user-menu.tsx`)
→ entrée `Ouvrir l’espace démo` / `Quitter l’espace démo` ; pendant le
changement, l'entrée affiche `Changement d’espace…` ; en cas d'échec, toast
`Le changement d’espace a échoué. Réessayez.` La bascule appelle
`POST /api/auth/workspace` puis `router.refresh()`.
**Bandeau.** En démo, `components/layout/demo-banner.tsx` rend une région
`role="status"` : `Espace démo` +
`Données fictives. Les e-mails et les exports intégraux sont désactivés.`
**Réinitialisation.** `/admin/parametres`, carte `Espace démo`, bouton
`Réinitialiser l’espace démo` → toast `Espace démo réinitialisé.`

**Contenu attendu après réinitialisation** (`packages/database/src/demo-workspace-factory.ts`,
`DEMO_SEED_VERSION = '3'`) : le schéma `demo` est vidé, dix-sept tables de
référence sont **recopiées depuis `public`** (dont **`users`** — les comptes de
démonstration sont donc les mêmes que ceux de la base publique), puis la fabrique
crée :

| Objet | Quantité | Repère |
| --- | --- | --- |
| Représentants | 8 | `Représentant Démo 01` à `08`, `+221770100001..0008` |
| Prospects | 16 | `Prospect Démo 01` à `16`, `+221770200001..0016` ; les 8 premiers CHUES, les 8 suivants Grand Public (`Grand Public` en prénom, situation `INFORMEL`) |
| Campagnes | 2 | `Campagne de démonstration`, `Campagne Grand Public de démonstration` |
| Dossiers bancaires | 3 | `DEMO-001`, `DEMO-002`, `DEMO-003` |

Les compteurs de la carte `Espace démo` (`DemoService.status`) portent donc
`représentants = 8`, `prospects = 16`, `campagnes = 2`,
`dossiers bancaires = 3`, et `comptes` = le nombre de comptes actifs de la base
publique (variable, à lire par l'API plutôt qu'à figer).

| # | Scénario | Prio |
| --- | --- | --- |
| DEMO-01 | Bascule vers la démo : ouvrir le menu de compte, cliquer `Ouvrir l’espace démo` ; le bandeau `Espace démo` avec sa phrase exacte apparaît en haut de la coque, et l'entrée du menu devient `Quitter l’espace démo`. | P1 |
| DEMO-02 | Retour au public : `Quitter l’espace démo` → le bandeau disparaît (`toHaveCount(0)`) et l'entrée redevient `Ouvrir l’espace démo`. | P1 |
| DEMO-03 | Réinitialisation : en démo, `/admin/parametres`, `Réinitialiser l’espace démo` → toast `Espace démo réinitialisé.` et les compteurs affichent `8`, `16`, `2`, `3` (assertion sur les valeurs exactes, pas sur « un nombre »). | P1 |
| DEMO-04 | Contenu attendu : après réinitialisation, `/grand-public` en démo affiche des lignes `Prospect Démo 09` à `16` avec le prénom `Grand Public`, et `/chues/prospects` affiche `Prospect Démo 01` à `08`. | P1 |
| DEMO-05 | **Isolement, sens démo → public.** En démo, créer un prospect `E2E-DEMO-vers-public` (téléphone `+221781002100`) par le formulaire Grand Public. Quitter la démo. Chercher ce téléphone dans `/grand-public` en public → `Aucun prospect ne correspond à ces filtres.` **et** l'API publique interrogée depuis le contexte de test ne le renvoie pas. | P1 |
| DEMO-06 | **Isolement, sens public → démo.** En public, créer `E2E-DEMO-vers-demo` (téléphone `+221781002101`). Basculer en démo. Chercher ce téléphone → état vide. | P1 |
| DEMO-07 | La réinitialisation n'atteint pas le public : relever le total de prospects publics avant, réinitialiser la démo, relever après → **identique**. C'est le défaut le plus coûteux que ce fichier protège. | P1 |
| DEMO-08 | BANQUE_FINANCE en démo : avec l'état `banque.json`, basculer en démo ; le bandeau s'affiche ; `/chues/banque` et `/chues/dossiers` rendent leur écran avec les trois dossiers `DEMO-001..003` ; les routes fermées à ce rôle restent refusées **en démo comme en public** (rejouer trois routes de ROLE-21). Remettre le compte en public dans le `afterAll`. | P1 |
| DEMO-09 | Export intégral fermé en démo : en démo, la carte `Export intégral de la base` est absente (`database-dump-section.tsx` la retire dans l'espace de démonstration). Assertion `toHaveCount(0)` sur le titre. | P2 |

**Échoue si :** une écriture faite en démo apparaît dans l'espace public, ou
l'inverse ; la réinitialisation touche la base publique ; le bandeau ne s'affiche
pas (l'utilisateur croit travailler sur les vraies données) ; les compteurs
d'après réinitialisation ne correspondent pas à ce que la fabrique crée ; un
agent bancaire gagne des droits en démo.

**Nettoyage obligatoire du `afterAll` :** revenir à l'espace **public** quoi
qu'il arrive, y compris après un échec. Une session laissée en démo empoisonne
toutes les specs suivantes, qui liraient une base vide.

---

## 8. Transversal

Spec cible : **`e2e/transversal.spec.ts` (nouveau)**, état ADMIN sauf mention.

### 8.1 `/notifications` — boîte de réception hors coque

Réservée à ADMIN, DIRECTION, SUPERVISEUR, BANQUE_FINANCE, ACCUEIL
(`INBOX_ROLES`). Le COMMERCIAL en est exclu : ses notifications visent
l'application mobile. L'ADMIN est renvoyé vers
`/admin/notifications?onglet=reception`.
La cloche (`NotificationBell`) n'est montée que pour les rôles à boîte.

| # | Scénario | Prio |
| --- | --- | --- |
| TR-01 | Avec l'état SUPERVISEUR, `/notifications` rend l'onglet `Boîte de réception` **seul** (`Historique` et `Gabarits` à `toHaveCount(0)`) et le bouton `Nouvelle notification` est absent. | P1 |
| TR-02 | Avec l'état COMMERCIAL, `/notifications` rend `Accès refusé` et `Les notifications est réservé à un autre rôle.` **et** la cloche est absente de la barre supérieure. | P1 |
| TR-03 | La cloche est présente pour ADMIN, DIRECTION, SUPERVISEUR, BANQUE_FINANCE, ACCUEIL et son lien mène à `inboxPathFor(role)` : `/admin/notifications?onglet=reception` pour l'ADMIN, `/notifications` pour les autres. | P2 |

**Échoue si :** un COMMERCIAL voit une cloche qui le mène droit sur un refus ;
un rôle à boîte perd son accès ; l'ADMIN se retrouve avec deux boîtes.

### 8.2 Session, panne d'API, 429

| # | Scénario | Prio |
| --- | --- | --- |
| TR-04 | Le jeton reste hors de portée du JavaScript : `document.cookie` ne contient ni `cpi_at` ni `cpi_rt`, et les deux cookies du contexte portent `httpOnly: true`. **Déjà couvert par `e2e/prospects.spec.ts` — ne pas dupliquer, citer.** | — |
| TR-05 | **Expiration en cours de navigation.** Sur `/grand-public`, effacer les cookies de session (`page.context().clearCookies()`), puis déclencher une action qui appelle l'API (changer un filtre). Le relais `/api/v1/*` répond 401 avec `code: 'SESSION_EXPIRED'` et efface les cookies. Assertion : le toast ou l'état d'erreur affiche `Session expirée. Rechargez la page.` (`apiErrorText`, cas 401). Puis un `page.reload()` mène à `/connexion`. **Reposer la session en fin de test :** ce test doit être le dernier de son fichier, ou utiliser un contexte navigateur dédié pour ne pas casser les tests suivants. | P1 |
| TR-06 | **API injoignable.** `page.route('**/api/v1/**', r => r.abort('connectionrefused'))` sur `/grand-public` → l'écran rend `QueryErrorState` avec le titre `Serveur injoignable` et le texte `Serveur injoignable. Vérifiez la connexion, puis réessayez.`, avec un bouton `Réessayer`. La barre latérale et la barre supérieure restent montées. | P1 |
| TR-07 | **429.** `page.route('**/api/v1/prospects*', r => r.fulfill({ status: 429, contentType: 'application/json', body: '{}' }))` → le message `Trop de requêtes. Patientez quelques secondes.` s'affiche. Ne **jamais** provoquer un vrai 429 en martelant l'API. | P1 |
| TR-08 | **500.** Même méthode avec 500 → titre `Erreur serveur` et texte `Erreur serveur (500). Réessayez.`, bouton `Réessayer` présent (les 5xx sont réessayables). | P2 |
| TR-09 | **403 sur une donnée.** Répondre 403 sur une route de données → titre `Accès refusé` dans `QueryErrorState`, **sans** bouton `Réessayer` (non réessayable). | P2 |

**Échoue si :** une session expirée laisse l'écran figé sans rien dire ; une API
éteinte produit une page blanche ou un message anglais ; un 429 est présenté
comme une panne serveur ; un bouton `Réessayer` est proposé sur une erreur qui ne
peut pas se résoudre par un nouvel essai.

### 8.3 404 et page d'erreur de rendu

| # | Scénario | Prio |
| --- | --- | --- |
| TR-10 | 404 : `/comptabilite` → `<h1>Page introuvable</h1>`, texte `Cette adresse ne correspond à aucun écran du panel.`, lien `Revenir aux espaces` vers `/espaces`. **Déjà couvert par `e2e/redirections.spec.ts` — citer, ne pas dupliquer.** Ajouter seulement le cas d'un chemin profond inconnu : `/admin/inexistant/profond`. | P2 |
| TR-11 | **Page d'erreur de rendu.** Provoquer une exception de composant client : sur `/grand-public`, intercepter `GET /api/v1/prospects*` et répondre un JSON **structurellement invalide** pour le composant (par exemple `{"items": null}`), ce qui fait échouer le rendu de la table. Assertion : `Cet écran n’a pas pu s’afficher`, le texte `Rien n’a été perdu et le reste du panneau fonctionne.`, le bouton `Réessayer` et le lien `Revenir aux espaces`. **La barre latérale et la barre supérieure doivent rester montées** (la frontière est posée sous `layout.tsx`) : c'est tout l'intérêt de cette page et c'est ce que l'assertion doit prouver — `getByRole('navigation', { name: 'Navigation principale' })` reste visible. | P1 |
| TR-12 | Si la réponse dégradée ne fait pas tomber le rendu (le composant absorbe le cas), le noter dans le retour et chercher un autre déclencheur documenté plutôt que d'inventer un `page.evaluate(() => { throw … })`, qui n'emprunte pas le même chemin. Ne pas laisser le scénario passer à vide. | P1 |

**Échoue si :** une exception de composant remplace tout le panneau par la page
d'erreur anglaise de Next ; la page d'erreur ne propose aucune sortie ; la
navigation disparaît avec le contenu.

### 8.4 Largeur mobile 375 px

| # | Scénario | Prio |
| --- | --- | --- |
| TR-13 | À 375×812, sur `/admin/commerciaux`, la barre latérale est masquée et le bouton `Ouvrir la navigation` la déploie dans un panneau latéral dont le titre accessible est `Navigation principale` ; un clic sur une entrée le referme et navigue. | P1 |
| TR-14 | À 375 px, sur `/grand-public`, `/admin/parametres` et `/grand-public/statistiques` : aucun débordement horizontal du document (`document.scrollingElement.scrollWidth <= innerWidth + 1`) et le titre de la barre supérieure reste lisible (tronqué, pas superposé). | P2 |

**Échoue si :** un écran déborde horizontalement à 375 px ; le panneau de
navigation ne s'ouvre pas ; un bouton d'action principale sort du cadre.

### 8.5 Accessibilité axe

`e2e/accessibility.spec.ts` existe et balaie une table de routes avec
`@axe-core/playwright`, en forçant le thème clair et en désactivant les
animations.

**Ce qui manque, et qui appartient à ce plan :**

| # | Scénario | Prio |
| --- | --- | --- |
| TR-15 | **Les routes de ce périmètre sont absentes ou périmées dans la table.** La table contient `/tableau-de-bord`, `/statistiques`, `/console`, `/campagnes`, `/commerciaux`… c'est-à-dire les **anciennes** racines, qui passent par la redirection `[ancien]`. Elle ne contient **aucune** route `/grand-public/*`, ni `/admin/referentiels/issues-appel`, ni `/notifications` (hors coque), ni `/espaces` sous un rôle autre qu'ADMIN. Écrire un balayage axe **complémentaire** dans `e2e/accessibility-grand-public.spec.ts` sur : `/grand-public`, `/grand-public/nouveau`, `/grand-public/<uuid>`, `/grand-public/console`, `/grand-public/rappels`, `/grand-public/statistiques`, `/admin/referentiels/issues-appel`. Ne pas modifier le fichier existant. | P1 |
| TR-16 | **Aucun état modal n'est analysé.** Ouvrir puis analyser : la boîte `Nouvel utilisateur`, la boîte de désactivation d'un référentiel, la popup `Version publiée`, le composeur `Nouvelle notification`. Les boîtes de dialogue sont la source classique de pièges de focus et de nom accessible. | P1 |
| TR-17 | **Le mode organisation de `/grand-public/statistiques` n'est pas analysé.** Le test existant analyse celui du registre des visites (`/accueil/tableau-de-bord`, bouton `Organiser`). Faire le même sur `Composer l’écran` : les poignées de glisser-déposer sont la source classique de violations `aria-*`. | P1 |
| TR-18 | **Aucun rôle autre qu'ADMIN n'est analysé.** Analyser `/espaces` avec l'état ACCUEIL (trois tuiles grisées : le contraste du gris est justement le risque) et la page `Accès refusé` avec l'état COMMERCIAL sur `/admin/parametres`. | P2 |
| TR-19 | **Le thème sombre n'est jamais analysé.** Le test existant force `colorScheme: 'light'` et vérifie `html.light`. Rejouer un sous-ensemble (trois écrans) en `colorScheme: 'dark'`. Le contraste des jetons sombres est un risque réel, et la barre latérale CHUES en noir est explicitement traitée dans le code (`accent-on-dark`). | P2 |
| TR-20 | **La largeur mobile n'est jamais analysée.** Rejouer trois écrans à 375 px : les cibles tactiles et l'ordre de lecture y changent. | P3 |

**Échoue si :** axe trouve une violation sur un écran du périmètre ; une boîte de
dialogue n'a pas de nom accessible ; les poignées de réorganisation ne sont pas
atteignables au clavier ; un contraste tombe sous le seuil en thème sombre.

---

## 9. Ce que la lecture n'a pas pu trancher

À vérifier dans le navigateur avant d'écrire l'assertion. Chaque point porte la
question exacte à poser à l'écran.

1. **`versionName` réel des fixtures APK.** `cpi-go-v7.apk` porte `versionCode` 7 ;
   le `versionName` est lu dans le manifeste et je ne l'ai pas extrait.
   *Question : que dit exactement le toast `CPI GO <?> publiée.` après la
   publication de `cpi-go-v7.apk` ?* Sans la réponse, asserter sur
   `/CPI GO .+ publiée\./` serait un sélecteur trop large (interdit §0) : lire la
   valeur une fois, la figer en constante nommée dans la spec.
2. **Ordre exact des entrées de la barre pour l'ADMIN dans CHUES.**
   `navSections` filtre puis concatène deux blocs d'entrées ADMIN écrits à des
   endroits différents de `nav-items.ts`. *Question : quelle est la liste
   `nav.getByRole('link').allTextContents()` réellement rendue pour un ADMIN sur
   `/chues`, replis fermés ?* Relever la valeur avant d'écrire l'assertion
   d'ordre du §4.4.
3. **Message de refus du 409 sur un téléphone de prospect déjà pris.**
   `console.spec.ts` parle d'un test « un numéro déjà pris nomme la fiche
   existante », mais le message côté Grand Public n'a pas été relevé.
   *Question : quel texte exact s'affiche après GP-15, et nomme-t-il la fiche
   existante avec un lien ?*
4. **Existence d'un lot d'export à ouvrir.** GP/ROLE-30 suppose qu'un
   `/chues/campagnes/<id>` valide existe en base. *Question : la base amorcée
   contient-elle au moins un lot d'export, ou faut-il en créer un depuis
   `/chues/campagnes` (ce qui sort de mon périmètre et appartient au plan CHUES) ?*
5. **Contrôle de pagination sur `/admin/commerciaux`.** `parseUserFilters` lit
   `page` mais `CommerciauxView` ne rend aucun contrôle.
   *Question : `/admin/commerciaux?page=2` affiche-t-il la deuxième page (donc
   seule l'interface manque) ou ignore-t-il le paramètre (donc la lecture aussi
   est cassée) ?* La réponse décide de la formulation de ADM-USR-17.
6. **Nombre de comptes actifs après réinitialisation de la démo.** Le compteur
   `comptes` recopie les utilisateurs de `public`, dont le nombre dépend de ce que
   les autres specs ont créé. *Question : faut-il figer ce compteur, ou se borner
   à vérifier qu'il est strictement positif et égal au décompte lu par l'API sur
   `public` au même instant ?* Ma recommandation : le second, et le dire dans le
   commentaire du test.
7. **Comportement de la carte `Export intégral de la base`.**
   `DB_DUMP_ENABLED` n'apparaît pas dans `.env.example`.
   *Question : la variable est-elle posée sur l'environnement de test, et la carte
   est-elle rendue ?* ADM-PAR-04 est conditionnel tant que la réponse manque.
8. **Effet réel de `page.context().clearCookies()` sur le rendu serveur.** Le
   `layout.tsx` du panel est `force-dynamic` et lit la session côté serveur.
   *Question : après suppression des cookies, une action cliente rend-elle
   `Session expirée. Rechargez la page.` dans un toast, ou le prochain rendu
   serveur renvoie-t-il directement vers `/connexion` sans que le message
   apparaisse jamais ?* TR-05 doit être ajusté à la réponse observée.
9. **Message affiché quand `/grand-public/<non-uuid>` échoue.** L'API pose un
   `ParseUUIDPipe` (400). *Question : `QueryErrorState` affiche-t-il le titre
   `Requête refusée` ou le repli `Cette fiche n’a pas pu être chargée.` ?*
   Les deux chemins existent dans le code selon que l'erreur est levée au rendu
   serveur ou côté client.
10. **Alignement des mots de passe de fixture** (§2.1). *Question : quelle valeur
    porte réellement `SEED_FIXTURE_PASSWORD` sur l'environnement de test au
    moment de l'exécution ?* Sans la réponse, les cinq états de session non-admin
    ne peuvent pas être posés, et **rien de la matrice des rôles ne tourne**.
    C'est le premier blocage à lever.

---

## 10. Récapitulatif chiffré

### 10.1 Par écran ou domaine

| Domaine | Fichier de spec | P1 | P2 | P3 | Total |
| --- | --- | --- | --- | --- | --- |
| Matrice rôles : atterrissage et tuiles | `roles-matrice.anon.spec.ts` | 6 | 0 | 0 | 6 |
| Matrice rôles : navigation par coque | `roles-matrice.anon.spec.ts` | 10 | 0 | 0 | 10 |
| Matrice rôles : URL interdites | `roles-matrice.anon.spec.ts` | 6 | 0 | 0 | 6 |
| Matrice rôles : redirections | `roles-matrice.anon.spec.ts` | 0 | 5 | 0 | 5 |
| Matrice rôles : trous relevés | `roles-matrice.anon.spec.ts` | 2 | 1 | 0 | 3 |
| `/admin` racine | `admin-parametres.spec.ts` | 0 | 1 | 0 | 1 |
| `/admin/commerciaux` | `admin-utilisateurs.spec.ts` | 9 | 7 | 1 | 17 |
| `/admin/referentiels` | `admin-referentiels.spec.ts` | 6 | 4 | 2 | 12 |
| `/admin/referentiels/issues-appel` | `admin-issues-appel.spec.ts` | 4 | 2 | 1 | 7 |
| `/admin/imports` | `admin-imports.spec.ts` | 4 | 4 | 0 | 8 |
| `/admin/notifications` | `admin-notifications.spec.ts` | 5 | 4 | 1 | 10 |
| `/admin/parametres` hors APK | `admin-parametres.spec.ts` | 3 | 1 | 1 | 5 |
| Publication Android | `android-release.spec.ts` | 12 | 3 | 3 | 18 |
| `/grand-public` liste | `grand-public.spec.ts` | 6 | 6 | 0 | 12 |
| `/grand-public/nouveau` | `grand-public.spec.ts` | 5 | 4 | 0 | 9 |
| `/grand-public/[id]` | `grand-public.spec.ts` | 6 | 1 | 0 | 7 |
| `/grand-public/console` | `grand-public.spec.ts` | 2 | 1 | 0 | 3 |
| `/grand-public/rappels` | `grand-public.spec.ts` | 1 | 2 | 0 | 3 |
| `/grand-public/statistiques` | `grand-public-chiffres.spec.ts` | 8 | 5 | 0 | 13 |
| Espace démo | `demo-isolement.spec.ts` | 8 | 1 | 0 | 9 |
| Transversal : notifications | `transversal.spec.ts` | 2 | 1 | 0 | 3 |
| Transversal : session, panne, 429 | `transversal.spec.ts` | 3 | 2 | 0 | 5 |
| Transversal : 404 et erreur de rendu | `transversal.spec.ts` | 2 | 1 | 0 | 3 |
| Transversal : 375 px | `transversal.spec.ts` | 1 | 1 | 0 | 2 |
| Accessibilité axe | `accessibility-grand-public.spec.ts` | 3 | 2 | 1 | 6 |
| **Total** | **12 fichiers** | **114** | **59** | **10** | **183** |

*(TR-04 et TR-10 renvoient à l'existant et ne sont pas comptés comme scénarios à
écrire.)*

### 10.2 Par priorité

| Priorité | Nombre | Ce que c'est |
| --- | --- | --- |
| **P1 — bloquant** | 114 | Autorisation, isolement des données, publication d'APK, écriture et validation, persistance d'un état partagé, refus lisible. Un rouge ici arrête la livraison. |
| **P2 — important** | 59 | États vides, pannes partielles, filtres dans l'URL, largeur mobile, redirections, pagination. Un rouge ici est un défaut à corriger avant la prochaine livraison. |
| **P3 — confort** | 10 | Accents dans la recherche, notes de version longues, thème sombre analysé, état vide manquant sur un écran d'administration rarement vide. |

### 10.3 Scénarios attendus ROUGES à l'écriture

Cinq scénarios documentent un défaut relevé en lecture. **Ils doivent être écrits
et laissés rouges**, avec un commentaire nommant le fichier fautif :

| Scénario | Fichier applicatif en cause |
| --- | --- |
| ROLE-28 | `apps/web/src/app/(panel)/accueil/page.tsx` — pas de `guardRoles` |
| ROLE-29 / GP-30 | `apps/web/src/components/console/console-view.tsx` — `href` vers `/grand-public/prospects`, route inexistante |
| ADM-USR-17 | `apps/web/src/components/commerciaux/commerciaux-view.tsx` — aucun contrôle de pagination |
| ADM-ISS-07 | `apps/web/src/components/referentiels/call-outcome-reasons-view.tsx` — aucun état vide |
| ROLE-30 | `apps/web/src/app/(panel)/grand-public/campagnes/[id]/page.tsx` — métadonnée « Campagne d’appels » sur un écran de lot d'export (cible mouvante `Plan.md`) |

Et trois fichiers de spec **existants** sont déjà rouges pour cause de libellés
et d'écrans périmés — à signaler, jamais à corriger sans mandat :
`e2e/roles.anon.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/console.spec.ts`
(et partiellement `e2e/prospects.spec.ts`).
