# Plan de tests navigateur du panel web CPI CRM

Document unique d'exécution. Il fusionne les trois plans de travail
(`E2E-accueil.md`, `E2E-chues.md`, `E2E-admin.md`) en une seule source de
vérité, destinée à des dizaines d'agents indépendants qui écriront chacun un
fichier de spec Playwright sans se voir.

Racine du dépôt : `/Users/cheikh/Workspace/CPI/Projects/crm-monorepo`.
Pile visée : API NestJS sur `http://localhost:3001`, web Next sur
`http://localhost:3000`, PostgreSQL migré et amorcé.
Outil : Playwright, navigateur réel. Aucun test unitaire ici, aucun test qui
simule `fetch`.

Ce document ne contient aucun test écrit : ce sont des contrats à traduire en
Playwright.

---

## 0. Comment utiliser ce document quand on est un agent parmi des dizaines

### 0.1 Votre unité d'attribution

**Un agent reçoit un et un seul fichier de spec de la carte du §5.** Ce fichier
est votre périmètre entier : les scénarios qui y sont listés, tous, et rien
d'autre. Vous ne voyez pas les autres agents, vous n'attendez rien d'eux, et
vous ne devinez pas ce qu'ils font.

Si votre consigne d'affectation ne nomme pas un fichier de la carte du §5,
c'est une consigne incomplète : réclamez-la avant d'écrire une ligne.

### 0.2 Ce que vous lisez avant d'écrire, dans cet ordre

1. **§1 Défauts déjà constatés** : si l'un d'eux touche votre écran, votre test
   doit rester rouge et vous ne corrigez rien.
2. **§2 Cible mouvante** : si vos scénarios y figurent, vous n'écrivez pas.
3. **§3 Travaux du mainteneur central** : si un prérequis n'est pas livré, vos
   scénarios sont déclarés non écrits, pas improvisés.
4. **§4 Règles impératives** : elles priment sur toute habitude personnelle.
5. **§5 Carte des fichiers** : votre ligne donne votre session, votre préfixe de
   données et votre plage de téléphones réservés.
6. **§6 Conventions communes** : libellés partagés, pièges de sélecteur déjà
   payés par d'autres, grille composable.
7. **Vos scénarios au §7**, du premier au dernier.
8. **§8 Questions ouvertes** : si l'une bloque un de vos scénarios, relevez la
   réponse en navigateur et inscrivez-la dans votre retour.
9. Le code source cité par vos scénarios, pour recopier les libellés au
   caractère près (§4.5).

### 0.3 Ce que vous rendez

1. La commande exacte exécutée et sa **sortie brute**, non résumée :
   `pnpm --filter @crm/web exec playwright test e2e/<votre-fichier> --reporter=list`.
2. Le nombre exact de tests passés et de tests rouges.
3. Pour chaque rouge, la cause tranchée : **bug applicatif** (fichier et ligne
   fautive, libellé attendu, libellé obtenu) ou **test à corriger** (ce que vous
   avez corrigé, avec la nouvelle sortie).
4. La liste des scénarios non écrits, avec leur identifiant et leur raison.
5. Les données laissées en base après votre passage.
6. Les besoins d'infrastructure que vous n'avez pas pu couvrir seul.
7. Les réponses observées aux questions du §8 que vous avez levées.

« Tout passe » sans sortie de commande n'est pas accepté.
**Un test rouge sur un vrai bug est un livrable réussi.** C'est le but : un
scénario qui ne peut pas échouer ne vaut rien.

### 0.4 Ce qui vous est interdit, en une phrase chacun

- Écrire dans un autre fichier que le vôtre, quel qu'il soit.
- Toucher à `playwright.config.ts`, `e2e/fixtures.ts`, `e2e/auth.setup.ts`,
  `e2e/global-setup.ts`, `e2e/xlsx.ts`.
- Toucher au code applicatif (`apps/web/src`, `apps/api`, `packages/**`).
- Supprimer, renommer ou désactiver un test existant.
- Réduire le périmètre assigné pour finir vite.
- Assouplir une assertion pour verdir un écran faux.

Le détail et la justification de chacune de ces interdictions sont au §4.

### 0.5 Comment signaler un blocage sans le contourner

Un blocage se déclare, il ne se contourne pas. Trois formes admises :

1. **Prérequis manquant** (état de session absent, variable d'environnement non
   posée, volumétrie insuffisante) : le scénario est déclaré **non écrit**, avec
   son identifiant, le prérequis manquant et le destinataire (§3). Vous ne
   fabriquez pas le prérequis vous-même.
2. **Libellé introuvable à l'écran** : le test reste **rouge**, avec le libellé
   attendu et le libellé obtenu dans le retour. Vous n'élargissez pas le
   sélecteur.
3. **Comportement non déterminé par la lecture** (§8) : vous l'observez en
   navigateur, vous écrivez l'assertion sur ce que vous avez observé, et vous
   inscrivez l'observation dans votre retour. Vous ne devinez pas.

Ce qui n'est jamais admis : un `test.skip` silencieux, un scénario supprimé de
la liste, une assertion vidée de son contenu, une connexion improvisée, une
modification d'un fichier partagé.

---

## 1. Défauts déjà constatés par lecture

Ces défauts sont connus **avant** l'écriture. Le scénario qui les attrape doit
être écrit et **rester rouge**. On ne corrige ni l'application, ni le test, ni
l'assertion. Le retour de l'agent nomme le fichier fautif.

La mention **vérifié** signifie : constaté dans le code source au moment de la
rédaction de ce document. La mention **à confirmer en navigateur** signifie :
déduit de la lecture, jamais observé à l'écran.

### 1.1 `GET /v1/supervision/activite` répond 500 (virgule SQL) : vérifié

- `apps/api/src/modules/analytics/supervision.service.ts`, ligne 259 :
  `COUNT(DISTINCT f.representant)::int  AS representants,` suivi directement de
  `FROM faits f`. La virgule de trop rend la requête invalide.
- Symptôme observable : `/chues/statistiques` et `/chues/supervision` tombent
  sur `QueryErrorState` ; la route répond 500.
- Attrapé par : **CHU-CHF-01** à **CHU-CHF-21**, **CHU-DSP-01** à
  **CHU-DSP-12**, **CHU-SUP-01** à **CHU-SUP-07**, **CHU-TRV-03**,
  **CHU-TRV-04**.
- Consigne : ces scénarios sont **attendus rouges**. Aucun test unitaire ne peut
  attraper ce défaut, la requête étant un gabarit de chaîne jamais analysé hors
  base. C'est exactement pourquoi ces scénarios existent.

### 1.2 Mots de passe des comptes de fixture discordants : vérifié

- `packages/database/src/seed.ts` fait un `upsert` qui **réécrit** le mot de
  passe de tous les comptes `fixture.*` à chaque exécution, avec
  `SEED_FIXTURE_PASSWORD` (défaut `ChangeMoi123456`, valeur de `.env` et
  `.env.example`).
- La version **committée** de `apps/web/e2e/fixtures.ts` déclare
  `FIXTURE_PASSWORD = 'REDACTED'` : après un `pnpm db:seed`, toute
  connexion en fixture échoue en 401.
- État de l'arbre de travail au moment de la rédaction : `e2e/fixtures.ts` et
  `e2e/auth.setup.ts` sont **modifiés et non committés** ; les deux lisent
  désormais `process.env.SEED_FIXTURE_PASSWORD ?? 'ChangeMoi123456'`.
- Symptôme observable si l'écart revient : **toutes** les specs de rôle
  échouent d'un bloc, dès la préparation.
- Attrapé par : le projet `setup` lui-même, qui doit échouer en **nommant le
  compte** et le message rendu par le formulaire.
- Consigne : c'est la **première chose** que le mainteneur central vérifie (§3).
  Aucun agent ne modifie ces deux fichiers, ni n'écrit un mot de passe en dur.

### 1.3 `auth.anon.spec.ts` attend `/chues` là où l'atterrissage vaut `/chues/statistiques` : vérifié

- `apps/web/e2e/auth.anon.spec.ts` ligne 52 : `await page.waitForURL('**/chues')`.
- Symptôme observable : le parcours de connexion existant échoue si le compte
  utilisé atterrit sur `/chues/statistiques` (encadrement) et non sur `/chues`.
- Attrapé par : **ROL-01** à **ROL-06** (destination exacte de chaque tuile).
- Consigne : `auth.anon.spec.ts` est un fichier **existant**. Aucun agent ne le
  modifie ; l'écart est signalé au mainteneur central.

### 1.4 `/accueil` ne pose aucun `guardRoles` : vérifié

- `apps/web/src/app/(panel)/accueil/page.tsx` rend `<RegistreView />` sans appeler
  `guardRoles`, alors que ses trois sous-routes le font.
- Symptôme observable : un COMMERCIAL ou un BANQUE_FINANCE qui tape `/accueil`
  obtient la coquille du registre, l'API répond 403 sur les visites, et l'écran
  affiche un état d'erreur de chargement au lieu d'un refus lisible.
- Attrapé par : **ROL-28**.
- Consigne : le test attend « Accès refusé » et **reste rouge**. Le retour
  nomme `apps/web/src/app/(panel)/accueil/page.tsx` et l'absence de
  `guardRoles(['ADMIN','DIRECTION','ACCUEIL'])`.

### 1.5 Lien mort « Ouvrir l'annuaire » vers `/grand-public/prospects` : vérifié

- `apps/web/src/components/console/console-view.tsx` ligne 9 :
  `const href = projet === 'GRAND_PUBLIC' ? '/grand-public/prospects' : '/chues/prospects';`
  Aucune route `grand-public/prospects/page.tsx` n'existe : le chemin est capté
  par le segment dynamique `/grand-public/[id]` avec `id = "prospects"`,
  `fetchProspect('prospects')` échoue sur le `ParseUUIDPipe` de l'API et l'écran
  rend « Cette fiche n'a pas pu être chargée. ». La liste vit à `/grand-public`.
- Attrapé par : **ROL-29**.
- Consigne : l'assertion vise `/grand-public` et **reste rouge**.

### 1.6 Specs existants déjà rouges sur des libellés périmés : à confirmer en navigateur

Déduit de la comparaison entre les fichiers de test et
`apps/web/src/components/layout/nav-items.ts`, qui écrit aujourd'hui
« Qualifier un représentant », « Ajouter un prospect », « Convertir un
prospect », « Représentants », « Tableau de bord », « Lots d'export ».

| Fichier existant | Libellés attendus, périmés | Lignes |
| --- | --- | --- |
| `e2e/roles.anon.spec.ts` | « 1 · Appeler les représentants », « 2 · Noter un prospect », « 3 · Appeler les prospects », « Mes représentants », « Chiffres », « Campagnes » | 195, 301 à 303, 312, 321, 322 |
| `e2e/accessibility.spec.ts` | table de routes sur les **anciennes** racines ; `/console` → « Appeler les prospects » et « Carte clavier » ; `/campagnes` → « Campagnes » | 27, 28, 32 à 35 |
| `e2e/prospects.spec.ts` | « Chiffres » niveau 1 ; `/console` → « Appeler les prospects » ; `/campagnes` → « Campagnes » | 30, 119, 122, 126, 127 |
| `e2e/console.spec.ts` | parcours d'appel au clavier sur un `ConsoleView` qui a été vidé | tout le fichier |

- Consigne : **aucun agent ne corrige ces fichiers.** Ils sont signalés au
  mainteneur central (§3.6), qui seul décide de leur mise à jour. Un agent qui
  les voit rouges dans une exécution large le mentionne dans son retour et
  n'y touche pas.

### 1.7 Cartes de taux sans signe pourcent, et `null` rendu `0` : à confirmer en navigateur

- `renderMark` passe `detail={marque === 'tuile' ? undefined : libelle}` et
  `TuileWidget` rend `formatNumber(valeur)` : les trois cartes de taux ont
  `tuile` pour marque d'usine, donc « Représentants joints » afficherait `50`
  sans « % », la phrase « 50,0 % des appels aboutissent » n'existant qu'en
  `sr-only`.
- `scalaireTaux` fait `valeur ?? 0` : le `null` du serveur devient `0` dans la
  tuile alors que `taux(null)` produit « Sans objet ». « Personne appelé »
  devient indistinguable de « personne joint », ce que le contrat de
  `SupervisionActivityCountsDto` interdit explicitement.
- Attrapé par : **CHU-CHF-13**, **CHU-CHF-17**.
- Consigne : **CHU-CHF-17 est attendu rouge.** L'agent relève d'abord la réponse
  aux questions **Q-01** et **Q-02** du §8, puis écrit l'assertion sur ce qu'il a
  observé, et rapporte l'écart entre le chiffre affiché et le texte accessible.

### 1.8 Carte « Reste à appeler » incohérente avec sa donnée : à confirmer en navigateur

- L'extraction de la carte titrée « Reste à appeler » lit
  `activite.totals.calls` avec la légende « appels consignés sur la période ».
  Le titre annonce un reste, la donnée compte des actes déjà faits.
- Attrapé par : **CHU-CHF-01** (présence de la carte) et **CHU-DSP-04** (elle est
  retirée puis reproposée par le tiroir).
- Consigne : l'agent relève la valeur affichée, la compare au total d'appels de
  la même période, et rapporte l'écart titre/donnée. `Plan.md` prévoit de
  supprimer la carte (§D3) : voir §2.

### 1.9 « Composer l'écran » contre « Organiser les graphiques » : à confirmer en navigateur

Deux plans d'origine se contredisaient. Lecture du code : `BarreEdition` a pour
valeur par défaut `entryLabel = 'Organiser les graphiques'`, et `ChiffresView`
passe `entryLabel="Composer l'écran"`. Les deux libellés coexistent donc, un par
écran :

| Écran | Entrée du mode | Retour à la disposition d'origine |
| --- | --- | --- |
| `/accueil/tableau-de-bord` | « Organiser les graphiques » | « Revenir à la disposition par défaut » |
| `/chues/statistiques` | « Composer l'écran » | « Revenir à l'écran par défaut » |
| `/grand-public/statistiques` | « Composer l'écran » | « Revenir à l'écran par défaut » |

- Consigne : ce n'est **pas** un défaut applicatif mais un piège de rédaction.
  Un agent qui écrit « Organiser » sur un écran `ChiffresView` produit un rouge
  qui n'apprend rien. Chaque scénario du §7 nomme le libellé de **son** écran.
  Relever la valeur réelle avant d'écrire reste obligatoire.

### 1.10 `/admin/commerciaux` filtré sur COMMERCIAL, sans pagination : à confirmer en navigateur

- `apps/web/src/lib/user-filters.ts` : `EMPTY_USER_FILTERS.role = 'COMMERCIAL'`.
  La liste s'ouvre filtrée sur les téléconseillers : un compte créé avec un
  autre rôle **n'apparaît pas** après création tant que le filtre « Rôle » n'est
  pas changé.
- `parseUserFilters` lit `page`, mais `CommerciauxView` ne rend **aucun**
  contrôle de pagination.
- Attrapé par : **ADM-USR-04** (le filtre par défaut) et **ADM-USR-17** (la
  pagination absente).
- Consigne : **ADM-USR-17 est attendu rouge** et documente l'absence de
  pagination. ADM-USR-04, lui, doit passer : il fige un comportement voulu.

### 1.11 Absence d'état vide sur les issues d'appel : à confirmer en navigateur

- `apps/web/src/components/referentiels/call-outcome-reasons-view.tsx` rend
  `query.data.map(...)` sans vérifier `length` : une liste vide produit un
  tableau à en-têtes sans corps, sans phrase d'explication.
- Attrapé par : **ADM-ISS-07**.
- Consigne : **attendu rouge**.

### 1.12 « Proposer par défaut » et la bascule démo, effets de bord partagés : à confirmer en navigateur

- « Proposer par défaut » (`PUT …/disposition/par-defaut`, ADMIN) fixe la
  disposition de **tous** les comptes qui n'en ont pas enregistré. Le geste
  n'est **jamais exécuté**, à aucun rôle, dans aucune spec.
- La bascule d'espace (`POST /api/auth/workspace`) est un état **de session
  globale** : une session laissée en démo fait échouer tout ce qui suit, dans un
  autre fichier, pour une raison illisible.
- Attrapé par : **ACC-TDB-13**, **CHU-DSP-01**, **CHU-DSP-02**, **GP-38**
  (présence et absence du bouton, jamais son effet) et **DEMO-01** à **DEMO-09**
  (bascule, dans le seul fichier propriétaire).
- Consigne : voir §4.3.4 et §4.3.5. La confirmation de « Proposer par défaut »
  n'est jamais cliquée ; la démo se quitte dans un `afterAll` inconditionnel.

### 1.13 Listes rendues deux fois : cartes en dessous de `lg`, tableau au-dessus : à confirmer en navigateur

Plusieurs listes du panel rendent **deux fois** le même jeu de données : un
empilement de cartes masqué au-delà d'un point de rupture (`lg:hidden`) et un
tableau. Un sélecteur non borné trouve donc deux occurrences du même texte et
viole le mode strict, ou compte double.

- Consigne générale, valable partout dans ce document : viser
  `page.getByRole('table')` puis les lignes (`getByRole('row')`), ou borner
  explicitement au conteneur du tableau. Ne jamais compter des occurrences de
  texte à la racine de la page pour dénombrer des lignes. Un
  `toHaveCount(1)` sur un nom de fiche est presque toujours faux pour cette
  raison.
- Attrapé par : tous les scénarios de liste (**ACC-REG-04**, **CHU-PRO-01**,
  **GP-05**, **ADM-USR-01**, entre autres). Un agent qui bute dessus le rapporte
  comme piège de sélecteur, pas comme bug applicatif.

---

## 2. Cible mouvante

Une autre session de travail retire les listes d'appel et les campagnes, et
refond les trois étapes du projet CHUES (`Plan.md` à la racine, section
« Retrait des listes d'appel : la campagne devient un lot d'export »).
L'arbre de travail est à mi-chemin.

### 2.1 Ce qui est déjà constaté dans l'arbre

- `nav-items.ts` écrit « Lots d'export » et non plus « Campagnes » ; l'URL
  `/chues/campagnes` est conservée par `Plan.md` §D5.
- `apps/web/src/app/(panel)/chues/campagnes/representants/` est **supprimé**.
- `apps/web/src/app/(panel)/grand-public/campagnes/page.tsx` est **supprimé** ;
  `grand-public/campagnes/[id]/` subsiste et réexporte la page CHUES, devenue
  `LotExportDetailPage`.
- `apps/web/src/components/console/console-view.tsx` a été vidé : `/chues/console`
  ne rend plus qu'un titre « Rechercher une fiche » et un lien « Ouvrir
  l'annuaire ». Le paramètre `?fiche=<id>` n'est plus lu.
- `apps/web/src/components/lots-export/` est **ajouté** : composants provisoires,
  `<select>` brut sans nom accessible, aucun état vide, aucun aperçu chiffré
  avant création, là où `Plan.md` décrit un écran nettement plus complet.

### 2.2 Scénarios concernés, par identifiant

| Lot | Scénarios | État |
| --- | --- | --- |
| Étape 3, `/chues/console` | **CHU-ET3-01** à **CHU-ET3-06** | CHU-ET3-01 écrivable aujourd'hui et **attendu rouge** ; les cinq autres décrivent la cible de `Plan.md` §4.2.3 |
| Lots d'export | **CHU-LOT-01** à **CHU-LOT-09** | CHU-LOT-01 et CHU-LOT-02 écrivables aujourd'hui pour verrouiller l'existant ; les sept autres décrivent la cible de `Plan.md` §4.2.4 |
| Campagne Grand Public | **ROL-30** | écrit sur la cible : détail de lot, aucune notion d'assignation |
| Rappels vers la console | **CHU-RAP-04**, **CHU-RAP-08** | écrivables, **attendus rouges** tant que la console est un talon |
| Pastille « À faire maintenant » | **CHU-HUB-06** | `Plan.md` prévoit de la supprimer ; si elle a disparu, rouge et rapport |
| Carte « Reste à appeler » | **CHU-CHF-01**, **CHU-DSP-04** | `Plan.md` §D3 prévoit de la supprimer |
| Entrée « Lots d'export » de la barre | **ROL-08**, **ROL-09**, **ROL-10**, **ACC-COQ-04** | l'entrée peut disparaître entièrement |

### 2.3 Consignes, sans exception

1. **On n'écrit pas un scénario de cible mouvante tant que le lot web n'est pas
   livré**, sauf ceux explicitement marqués « écrivable aujourd'hui » ci-dessus.
   Un scénario non écrit est déclaré non écrit, avec son identifiant.
2. **On ne touche jamais à un fichier apparaissant comme modifié (`M`),
   ajouté (`A`) ou supprimé (`D`) dans `git status`.** C'est le périmètre d'une
   autre session ; y écrire produit un conflit que personne ne saura démêler.
3. Si l'écran a changé sous vos yeux, le test reste **rouge** et vous rapportez
   l'écart. Vous ne réécrivez pas l'attente sans instruction du mainteneur
   central.
4. `ACC-COQ-04` utilise « Contacts recommandés » comme repère principal de la
   section « Plus », **jamais** « Lots d'export », précisément parce que cette
   entrée est susceptible de disparaître.

---

## 3. Travaux du mainteneur central, avant toute distribution

Le **mainteneur central** est une seule personne, ou un seul agent nommé comme
tel. Il est le seul à toucher aux fichiers d'infrastructure de test et aux specs
existants. Tant que les points §3.1 à §3.4 ne sont pas livrés et vérifiés,
**aucun fichier de spec n'est distribué**.

### 3.1 Aligner le mot de passe des comptes de fixture (bloquant absolu)

Sans cela, les cinq états de session non-admin ne se posent pas, et rien de la
matrice des rôles ne tourne.

1. Vérifier la valeur réelle de `SEED_FIXTURE_PASSWORD` dans le `.env` de
   l'environnement de test.
2. Vérifier que `e2e/fixtures.ts` et `e2e/auth.setup.ts` la lisent bien
   (`process.env.SEED_FIXTURE_PASSWORD ?? 'ChangeMoi123456'` dans l'arbre de
   travail au moment de la rédaction) et **committer** cet alignement, qui est
   aujourd'hui une modification non enregistrée.
3. Vérifier par une connexion manuelle que `fixture.accueil@cpi.sn` se connecte
   et atterrit sur `/espaces` (§8, **Q-11**).
4. Aucun mot de passe n'est écrit en dur dans un fichier versionné.

### 3.2 Poser les six états de session

Un seul projet `setup`, un seul fichier `e2e/auth.setup.ts`, six connexions
séquentielles dans un même passage, sous le plafond de dix par minute.

| Rôle | Compte | Fichier d'état |
| --- | --- | --- |
| ADMIN | `admin@cpi.sn` | `e2e/.auth/admin.json` |
| ACCUEIL | `fixture.accueil@cpi.sn` | `e2e/.auth/accueil.json` |
| SUPERVISEUR | `fixture.superviseur@cpi.sn` | `e2e/.auth/superviseur.json` |
| DIRECTION | `fixture.direction@cpi.sn` | `e2e/.auth/direction.json` |
| COMMERCIAL | `fixture.awa@cpi.sn` | `e2e/.auth/commercial.json` |
| BANQUE_FINANCE | `fixture.banque@cpi.sn` | `e2e/.auth/banque.json` |

Contraintes :

- Les six connexions sont **séquentielles**, jamais six passages parallèles.
- Un état encore valide est réutilisé tel quel : la préparation ne dépense
  aucune connexion si les fichiers sont frais.
- Une connexion qui échoue fait **échouer la préparation en nommant le compte**
  et le message rendu par le formulaire. Elle ne rend jamais la main en silence.
- Il n'existe **pas** de fichier `e2e/roles.setup.ts`. Un des trois plans
  d'origine en demandait un : la fonction est déjà dans `auth.setup.ts`.

**Septième état, décision du mainteneur.** `CHU-PRO-02` exige une session pour
`fixture.fatou@cpi.sn` (COMMERCIAL numéro deux, `e2e/.auth/commercial2.json`).
Sept connexions restent sous le plafond de dix. Tant que cet état n'est pas
posé, `CHU-PRO-02` est déclaré non écrit et l'agent ne se connecte pas lui-même.

### 3.3 Trancher la stratégie de projet Playwright

`playwright.config.ts` ne déclare aujourd'hui que `setup`, `chromium`
(`storageState: e2e/.auth/admin.json`, `testIgnore: /\.anon\.spec\.ts/`) et
`chromium-anonyme` (`testMatch: /\.anon\.spec\.ts/`).

**Décision retenue pour tout ce document** : on n'ajoute **aucun** projet
`chromium-<role>`. Chaque spec pose sa session au niveau du fichier :

```ts
test.use({ storageState: 'e2e/.auth/superviseur.json' });
```

Conséquences, à faire respecter :

- Les suffixes de nom de fichier (`.commercial.spec.ts`, `.banque.spec.ts`,
  `.superviseur.spec.ts`) sont **de la documentation**, pas un `testMatch`. Ils
  disent à l'agent quelle session poser.
- Le suffixe `.anon.spec.ts` est **réservé** aux specs qui doivent partir d'un
  navigateur vierge. Un fichier qui pose un `storageState` ne s'appelle jamais
  `.anon.spec.ts` : il tournerait dans le projet anonyme. Un des trois plans
  d'origine nommait la matrice des rôles `roles-matrice.anon.spec.ts` alors
  qu'elle consomme six états de session : ce nom est **abandonné** (§5.2).
- Un fichier peut poser plusieurs sessions par `test.describe` ou par
  `browser.newContext({ storageState })` : les six états sont sur disque, aucun
  contexte supplémentaire ne coûte une connexion.

### 3.4 Poser les préconditions d'environnement

1. Base migrée et amorcée (`pnpm db:migrate && pnpm db:seed`), quatre listes du
   registre présentes : entreprises `CPI`, `SANTARGILE`, `MAKE-UP ADDICTION` ;
   17 directions dont `COMMERCIALE` ; 16 destinataires dont
   `MME. NDOYE (RESP. COMM.)` et `AUTRE` ; 16 objets dont `SUIVI DE DOSSIER` et
   `ACHAT TERRAIN`.
2. API lancée avec
   `APK_SIGNER_SHA256=9434b1f9594e7f5d20bda74d047e40affdc8003f51d89421d4b79456ad7f3909`.
   Sans cette variable, `AppUpdatesService.expectedSigner()` prend le signataire
   de la première release publiée et **ADM-APK-06** n'est pas reproductible.
3. Statuer sur `DB_DUMP_ENABLED` (§8, **Q-16**) : la carte « Export intégral de
   la base » n'est rendue que si la variable est posée.
4. Relever la volumétrie du registre des visites (§8, **Q-06**) et décider s'il
   faut un semis dédié. Aucun agent ne fabrique des milliers de visites
   indestructibles de sa propre initiative.
5. Relever le nombre de prospects CHUES en base (§8, **Q-07**) pour
   **CHU-PRO-07**.

### 3.5 Fixer l'ordre d'exécution

- `demo-isolement.spec.ts` bascule la session d'espace et réinitialise la démo :
  il tourne **en dernier**, seul, ou dans une exécution séparée.
- `workspaces.spec.ts` (existant) réinitialise déjà la démo. Deux
  réinitialisations dans une même exécution sont longues mais sans danger ; le
  mainteneur vérifie qu'elles ne s'entrelacent pas.
- `android-release.spec.ts` impose un `versionCode` strictement croissant : il
  tourne d'un bloc, `mode: 'serial'`, sans qu'une autre spec publie entre-temps.

### 3.6 Traiter les specs existants déjà rouges

Le mainteneur, et lui seul, décide du sort de ces fichiers (§1.6) :

- `e2e/roles.anon.spec.ts` : libellés de navigation périmés. Décider s'il est
  mis à jour ou remplacé par les scénarios **ROL-07** à **ROL-16**, qui portent
  les libellés réels. Décider aussi s'il bascule sur les états de session, ce
  qui libérerait les lignes déjà couvertes de **ROL-04** et **ROL-06**.
- `e2e/accessibility.spec.ts` : table de routes sur les anciennes racines.
- `e2e/prospects.spec.ts` : parcours « chaque écran du panel se charge sans état
  d'erreur » dont la table contient encore `/console` → « Appeler les prospects »
  et `/campagnes` → « Campagnes ». C'est le porteur de **CHU-TRV-02**.
- `e2e/console.spec.ts` : parcours d'appel au clavier sur un écran vidé.

### 3.7 Ce que le mainteneur central se réserve, en une liste

`playwright.config.ts`, `e2e/fixtures.ts`, `e2e/auth.setup.ts`,
`e2e/global-setup.ts`, `e2e/xlsx.ts`, tout fichier de spec **existant**, l'ordre
d'exécution, les variables d'environnement, les décisions du §8 qui lui sont
adressées, et l'arbitrage de tout besoin d'infrastructure remonté par un agent.

---

## 4. Règles impératives pour l'agent qui écrit un test

Ces règles priment sur toute habitude personnelle. Un livrable qui les enfreint
est refusé, même s'il est vert.

### 4.1 Posture : un test doit pouvoir échouer

Le but d'un test n'est pas de montrer que l'écran marche : c'est **de rendre
rouge le défaut nommé dans sa ligne « Échoue si »**. Un scénario dont aucune
régression plausible ne ferait rougir l'assertion ne vaut rien et ne doit pas
être écrit tel quel : l'agent le signale.

Ce qui compte comme assertion valable :

- un libellé français **exact** relevé dans le code, apostrophe typographique
  comprise ;
- une URL complète et ancrée : `toHaveURL(/\/admin\/commerciaux$/)`, jamais
  `/commerciaux/` ;
- le **titre du document** (`toHaveTitle`) quand le titre de niveau 1 vient de la
  barre supérieure et non de la page (§6.1) ;
- un compte d'éléments, `toHaveCount(0)` pour prouver une absence ;
- une **requête réseau observée** (`waitForResponse`, `page.on('response')`)
  pour prouver qu'un écran interdit n'a chargé aucune donnée, ou qu'aucun envoi
  n'est parti ;
- un fichier téléchargé, avec sa signature binaire et sa taille ;
- l'état réel en base, relu par l'API **après** le geste navigateur.

### 4.2 Propriété des fichiers

1. Un agent n'écrit que dans **le fichier de spec qui lui est assigné** (§5).
2. Il ne modifie **jamais** `apps/web/playwright.config.ts`,
   `apps/web/e2e/fixtures.ts`, `apps/web/e2e/auth.setup.ts`,
   `apps/web/e2e/global-setup.ts`, `apps/web/e2e/xlsx.ts`, ni **aucune autre
   spec**, existante ou nouvelle. Un besoin d'état de session, d'aide partagée,
   de variable d'environnement ou de réglage de projet se **décrit dans le
   retour** ; le mainteneur central l'intègre.
3. Il ne supprime, ne renomme et ne désactive **aucun test existant**, même
   redondant, même déjà rouge. Les fichiers `auth.anon.spec.ts`,
   `redirections.spec.ts`, `roles.anon.spec.ts`, `prospects.spec.ts`,
   `accessibility.spec.ts`, `workspaces.spec.ts`, `console.spec.ts`,
   `representants-import.spec.ts` restent intacts.
4. Il ne touche **jamais** au code applicatif : `apps/web/src`, `apps/api`,
   `packages/**`. **Si un test révèle un bug, le test reste ROUGE** et le bug est
   rapporté. On ne corrige pas l'application pour verdir un test, et on
   n'assouplit pas le test pour verdir une application fausse.
5. Il ne crée ni page object, ni classe de base, ni DSL, ni aide partagée pour
   un seul spec. Il ne crée pas de fichier de rapport, de résumé ni d'analyse :
   le retour se fait dans le message final.
6. Il n'ajoute **aucune dépendance npm**. La pile installée
   (`@playwright/test`, `@axe-core/playwright`) suffit.
7. Il ne touche à aucun fichier apparaissant comme modifié, ajouté ou supprimé
   dans `git status` (§2.3).

### 4.3 Propriété des données

1. Toute donnée créée porte **le préfixe du fichier** et, s'il y a lieu, sa
   **plage de téléphones réservés** (§5). L'agent ne lit, ne modifie et ne
   supprime que ce qui les porte.
2. Une assertion du type « la liste contient 3 lignes » sans filtre sur son
   propre préfixe est **interdite** : la base est partagée et grossit.
3. **Comptes** : l'agent crée les siens (`E2E-ADM-USR-…`,
   `e2e-adm-usr-*@cpi.test`). Il ne désactive, ne renomme, ne supprime et ne
   change le mot de passe que des siens. Jamais `admin@cpi.sn`, jamais un
   `fixture.*`, jamais un compte préexistant.
4. **« Proposer par défaut » n'est jamais confirmé**, à aucun rôle, dans aucune
   spec : le geste fixe la disposition de tous les comptes qui n'en ont pas
   enregistré. Les scénarios prouvent sa présence ou son absence, jamais son
   effet.
5. **Espace démo** : `POST /api/v1/admin/demo/reset` et la bascule d'espace sont
   la propriété exclusive de `demo-isolement.spec.ts`, en coordination avec
   `workspaces.spec.ts` (existant) qui réinitialise déjà. Toute spec qui bascule
   en démo la **remet en public** dans un `afterAll` inconditionnel : une session
   laissée en démo fait échouer tout ce qui suit, dans un autre fichier, pour une
   raison illisible.
6. **Référentiels partagés interdits** : banques, syndicats, régions,
   départements, IEF, professions, revenus, offres, motifs d'issue système,
   étapes de dossier bancaire, et les entrées « Classeur d'origine » des quatre
   listes du registre (`CPI`, `SANTARGILE`, `MAKE-UP ADDICTION`, `COMMERCIALE`,
   `MME. NDOYE (RESP. COMM.)`, `AUTRE`, `SUIVI DE DOSSIER`…). On ne les renomme
   pas, on ne les désactive pas, on ne les déplace pas.
7. **Données d'autres specs interdites** : les trente prospects
   `+221781001000..1029`, le représentant « Ibrahima Fixture »
   (`+221781000001`), le client bancaire `+221781001000`, les numéros de rafale
   `+221 78 100 90 0x`, la fiche importée par `representants-import.spec.ts`, le
   jeu de démonstration `+2217701000xx` et `+2217702000xx`. Ils se **lisent**,
   ils ne se modifient jamais.
8. **Base** : jamais `pnpm db:seed`, `pnpm db:reset`, une migration, un
   `TRUNCATE`, un accès direct à Postgres, `DELETE /api/v1/admin/purge`, ni
   l'export intégral de la base.
9. **Versions Android** : l'agent ne retire que les versions publiées par son
   test, dans la plage de `versionCode` 900 000 à 999 999 quand il en fabrique,
   et il nomme dans son retour ce qu'il laisse en base.
10. La base est laissée dans l'état trouvé, aux données de l'agent près, et la
    spec doit pouvoir être relancée immédiatement.

### 4.4 Ressources partagées

1. **Aucune connexion supplémentaire.** Le limiteur accorde **10 connexions par
   minute et par IP** pour toute la machine. Les six états de session sont posés
   une fois par le projet `setup`. Un `page.goto('/connexion')` suivi d'un
   remplissage de formulaire, hors de `accueil-connexion.anon.spec.ts` qui en
   est le sujet et qui en dépense au plus trois, casse la suite entière pour
   tout le monde.
2. **300 requêtes par minute**, toutes sources confondues. Un écran du panel
   émet une dizaine d'appels : un balayage de trente routes coûte le quota d'une
   minute. On n'enchaîne pas deux balayages larges dans le même fichier, et un
   `beforeAll` vise moins de trente requêtes.
3. **Téléchargement d'APK : 10 par heure** (`APK_DOWNLOAD_RATE_LIMIT`). Un
   scénario qui télécharge un APK ne le fait qu'une fois, jamais en boucle, et
   le dit dans son retour.
4. `workers: 1`, `fullyParallel: false`, `retries: 0`, `timeout: 60 000`,
   `expect.timeout: 10 000`, locale `fr-FR`, fuseau `Africa/Dakar` : ces réglages
   sont la condition de validité de tout ce document. Aucun agent ne les change,
   ni globalement, ni par `test.describe.parallel`, ni par un allongement local
   de délai.
5. Un seul état de session par rôle, partagé par tous les fichiers. Aucun agent
   ne modifie un compte de session, ne le désactive, ne change son rôle ni son
   mot de passe.
6. Le cookie de repli de la barre latérale, la disposition de tableau de bord et
   l'espace de travail sont des **états partagés** : la spec qui les modifie les
   remet dans l'état trouvé avant de finir.

### 4.5 Interdictions de rédaction

Interdit, sans exception :

- **assertions molles** : `toBeVisible()` sur un conteneur générique (`main`,
  une `div`, une carte entière), `expect(true).toBe(true)`,
  `expect(x).toBeDefined()` seul, `toBeTruthy()` sur un objet toujours présent,
  `toHaveCount(n)` sans filtre sur ses propres données ;
- `page.waitForTimeout(...)` et tout `sleep`. On attend une **condition** :
  `expect(...).toHaveText/toHaveURL/toHaveCount`, `waitForURL`,
  `waitForResponse`, `waitForEvent('download')`. Un délai posé sur le **réseau**
  (`page.route` qui retarde une réponse) est légitime ; une attente fixe dans le
  test ne l'est pas ;
- `test.skip(...)` et `test.fixme(...)` sans numéro de ticket et sans
  justification écrite dans le retour ; ignorer un test parce qu'il est rouge ;
- `retries`, `test.retry`, `test.describe.configure({ retries: n })`, toute
  boucle de réessai maison ;
- `try { … } catch { }` qui avale un échec, `.catch(() => false)` autour d'une
  attente ou d'une précondition ;
- **sélecteurs CSS fragiles** : `nth-child`, classes Tailwind (`.bg-card`,
  `.text-muted-foreground`, `.flex`), `locator('div > div > span')`,
  `[class*="…"]`, et l'ajout d'un `data-testid` au code applicatif, interdit par
  §4.2.4 ;
- **regex trop large** pour masquer un écart de libellé : `getByText(/visite/i)`
  à la place de `getByRole('heading', { name: '1 visite aujourd’hui' })` est un
  refus de constater le bug. Les expressions régulières sont autorisées
  **ancrées** (`/^Accueil/`, `/^cpi-registre-visites-\d{4}-\d{2}-\d{2}\.xlsx$/`),
  jamais ouvertes ;
- **remplacer un clic par un appel API**. L'API sert à **préparer** une
  précondition qu'aucun écran du périmètre ne pose, et à **vérifier** un effet
  que l'écran ne montre pas. Elle ne remplace jamais le geste qui est l'objet du
  test ;
- fabriquer un état par injection dans `localStorage` ou par exécution de
  JavaScript dans la page quand un geste utilisateur existe ;
- **fusionner des scénarios** : dix scénarios dans un `test()` font que la
  première assertion cassée masque les neuf autres. Un échec doit nommer un
  défaut, pas un chapitre ;
- réduire le périmètre pour finir vite. Un scénario non écrit est **déclaré** non
  écrit, avec son identifiant et sa raison.

Autorisé et recommandé : `getByRole`, `getByLabel`, `getByPlaceholder`,
`getByText` avec libellé exact, `filter({ hasText })`, `exact: true` dès qu'un
libellé est le préfixe d'un autre, et un message d'assertion nommant le cas
quand le scénario est paramétré :
`expect(…, \`${route} devrait être refusé à ${role}\`)`.

### 4.6 Preuve de livraison

Voir §0.3. En résumé : sortie brute de
`pnpm --filter @crm/web exec playwright test e2e/<fichier> --reporter=list`,
comptes exacts de verts et de rouges, cause tranchée de chaque rouge, données
laissées en base, scénarios non écrits. **Un rouge sur un vrai bug est un
succès.**

---

## 5. Carte des fichiers de spec

Un fichier, un agent, un propriétaire. La session se pose au niveau du fichier
ou d'un `test.describe` par `test.use({ storageState: 'e2e/.auth/<role>.json' })`
(§3.3), jamais au niveau du projet.

Colonne « Ordre » : `serial` signifie
`test.describe.configure({ mode: 'serial' })` obligatoire, les scénarios du
fichier se suivant sur une même donnée.

### 5.1 Conventions de nommage et d'idempotence

**Identifiant d'exécution.** Une spec dont les données **ne peuvent pas être
supprimées** (visites, entrées de référentiel, releases APK) calcule une fois,
au niveau du module :

```
const RUN = String(Date.now()).slice(-8);
```

et l'inclut dans toute donnée créée. Deux exécutions ne se voient jamais, et une
assertion « exactement une ligne » reste vraie à la centième relance.

**Suffixe stable.** Une spec dont les données **peuvent** être supprimées
(comptes, prospects, représentants, dossiers) utilise au contraire un suffixe
**stable par scénario** (`E2E-ADM-USR-creation`, `E2E-ADM-USR-doublon`) et un
`beforeAll` qui **supprime d'abord** ses fiches par leur préfixe ou leur
téléphone réservé, puis les recrée. Un identifiant aléatoire empêcherait le
nettoyage de la fois suivante de savoir ce qu'il ramasse.

C'est la seule règle qui tranche entre les deux conventions des plans d'origine :
`RUN` quand la suppression est impossible, suffixe stable quand elle est
possible. Le nettoyage se fait **en début** de parcours, pas en fin : un
`afterAll` ne tourne pas après un échec dur, et le reliquat sert au diagnostic.
Un `afterAll` ne porte jamais d'assertion.

**Codes de référentiel.** `CODE_PATTERN` côté API n'accepte que `[A-Z0-9_]` :
`E2E_ACC_LST_12345678_ENT`, jamais `E2E-ACC-LST-…`.

**E-mails de test** : `e2e-adm-usr-<n>@cpi.test`. Le domaine `.test` est réservé
(RFC 2606) : aucun e-mail réel n'y partira jamais.

### 5.2 Plages de téléphones : allocation unique

Réservé et **intouchable**, propriété des specs existantes :

| Plage | Propriétaire |
| --- | --- |
| `+221781000001` | représentant « Ibrahima Fixture », `e2e/fixtures.ts` |
| `+221781001000` à `+221781001029` | trente prospects de `e2e/fixtures.ts`, dont le client bancaire `+221781001000` |
| `+221 78 100 90 0x` | rafale de `e2e/console.spec.ts` |
| `+2217701000xx` et `+2217702000xx` | jeu de démonstration |

Alloué aux nouvelles specs, sans recouvrement :

| Plage | Fichier |
| --- | --- |
| `+221 78 100 40 01` à `40 09` | `chues-chiffres-taux.superviseur.spec.ts` |
| `+221 78 100 41 01` à `41 09` | `chues-etape1.commercial.spec.ts` |
| `+221 78 100 42 01` à `42 09` | `chues-etape2.commercial.spec.ts` |
| `+221 78 100 43 01` à `43 09` | `chues-representants.commercial.spec.ts` |
| `+221 78 100 44 01` à `44 29` | `chues-prospects.commercial.spec.ts` |
| `+221 78 100 45 01` à `45 09` | `chues-suggestions.commercial.spec.ts` |
| `+221 78 100 46 01` à `46 09` | `chues-rappels.commercial.spec.ts` |
| `+221 78 100 47 01` à `47 09` | `chues-import.spec.ts` |
| `+221 78 100 48 01` à `48 09` | `chues-lots-export.spec.ts` |
| `+221 78 100 49 01` à `49 09` | `chues-demandes.banque.spec.ts` |
| `+221 78 100 50 01` à `50 09` | specs de l'espace Accueil, si un numéro unique devient nécessaire |
| `+221781002000` à `+221781002019` | `grand-public-liste.spec.ts` |
| `+221781002020` à `+221781002039` | `grand-public-saisie.spec.ts` |
| `+221781002040` à `+221781002059` | `grand-public-fiche.spec.ts` |
| `+221781002060` à `+221781002079` | `grand-public-rappels.spec.ts` |
| `+221781002100` à `+221781002119` | `demo-isolement.spec.ts` |
| `+221781002200` à `+221781002219` | `admin-utilisateurs.spec.ts` |
| `+221781002220` à `+221781002229` | `admin-notifications.spec.ts` |

Le registre des visites n'impose **aucune unicité** sur le champ `TELEPHONES` :
les specs de l'espace Accueil gardent la valeur littérale `78 454 44 66` des
scénarios, sans consommer de plage.

### 5.3 Matrice des rôles

| Fichier | Session | Scénarios | Ordre | Données | État |
| --- | --- | --- | --- | --- | --- |
| `roles-espaces.spec.ts` | les six, un `test` par rôle | ROL-01 à ROL-06 | libre | aucune | nouveau |
| `roles-navigation.spec.ts` | les six | ROL-07 à ROL-16 | libre | aucune | nouveau |
| `roles-refus.spec.ts` | les six | ROL-17 à ROL-22 | libre | aucune | nouveau |
| `roles-renvois.spec.ts` | admin, direction, superviseur, accueil, banque, commercial | ROL-23 à ROL-27 | libre | aucune | nouveau |
| `roles-trous.spec.ts` | commercial, banque, admin | ROL-28 à ROL-30 | libre | aucune | nouveau |

Aucun de ces cinq fichiers ne s'appelle `.anon.spec.ts` : ils consomment des
états de session (§3.3).

### 5.4 Espace Accueil, connexion, hub et coque

| Fichier | Session | Scénarios | Ordre | Préfixe de données | État |
| --- | --- | --- | --- | --- | --- |
| `accueil-connexion.anon.spec.ts` | aucune, projet `chromium-anonyme` | ACC-CNX-01 à ACC-CNX-09 | libre | aucune | nouveau |
| `accueil-session.spec.ts` | admin, accueil | ACC-CNX-10 à ACC-CNX-14 | libre | aucune | nouveau |
| `accueil-espaces.spec.ts` | admin, accueil | ACC-HUB-01 à ACC-HUB-05 | libre | aucune | nouveau |
| `accueil-coque.spec.ts` | admin, accueil, commercial | ACC-COQ-01 à ACC-COQ-12 | libre | aucune | nouveau |
| `accueil-registre.spec.ts` | accueil | ACC-REG-01 à ACC-REG-18 | serial | `E2E-ACC-REG-<RUN>` | nouveau |
| `accueil-impression.spec.ts` | accueil | ACC-IMP-01 à ACC-IMP-07 | libre | `E2E-ACC-IMP-<RUN>` | nouveau |
| `accueil-tableau-de-bord.spec.ts` | accueil | ACC-TDB-01 à ACC-TDB-14 | serial | disposition du compte ACCUEIL | nouveau |
| `accueil-listes.spec.ts` | direction | ACC-LST-01 à ACC-LST-12 | serial | code `E2E_ACC_LST_<RUN>_<KIND>`, libellé `E2E ACC LST <RUN> …` | nouveau |
| `accueil-import.spec.ts` | direction | ACC-XLS-01 à ACC-XLS-12 | serial | `E2E-ACC-XLS-<RUN>` | nouveau |

### 5.5 Espace Projet CHUES

| Fichier | Session | Scénarios | Ordre | Préfixe de données | État |
| --- | --- | --- | --- | --- | --- |
| `chues-hub.commercial.spec.ts` | commercial | CHU-HUB-01 à 06, CHU-HUB-08, CHU-TRV-01, CHU-TRV-05 | libre | aucune | nouveau |
| `chues-hub.banque.spec.ts` | banque | CHU-HUB-07 | libre | aucune | nouveau |
| `chues-etape1.commercial.spec.ts` | commercial | CHU-ET1-01 à CHU-ET1-13 | serial | `E2E-CHUES-ET1 ` | nouveau |
| `chues-etape1.banque.spec.ts` | banque | CHU-ET1-14 | libre | aucune | nouveau |
| `chues-etape2.commercial.spec.ts` | commercial | CHU-ET2-01 à CHU-ET2-09 | libre | `E2E-CHUES-ET2 ` | nouveau |
| `chues-etape3.commercial.spec.ts` | commercial | CHU-ET3-01 à CHU-ET3-06 | libre | aucune | nouveau, cible mouvante |
| `chues-chiffres.superviseur.spec.ts` | superviseur | CHU-CHF-01, 05 à 12, 20, 21 ; CHU-TDB-01 ; CHU-TRV-03, 04, 06 | libre | aucune | nouveau |
| `chues-chiffres.direction.spec.ts` | direction | CHU-CHF-02 | libre | aucune | nouveau |
| `chues-chiffres.commercial.spec.ts` | commercial | CHU-CHF-03 | libre | aucune | nouveau |
| `chues-chiffres.banque.spec.ts` | banque | CHU-CHF-04 | libre | aucune | nouveau |
| `chues-chiffres-taux.superviseur.spec.ts` | superviseur, préparation en admin | CHU-CHF-13 à CHU-CHF-19 | serial | `E2E-CHUES-TAUX ` | nouveau |
| `chues-disposition.superviseur.spec.ts` | superviseur, lecture en direction | CHU-DSP-01, 03 à 12 | serial | disposition du compte SUPERVISEUR | nouveau |
| `chues-disposition.spec.ts` | admin | CHU-DSP-02 | libre | aucune | nouveau |
| `chues-supervision.superviseur.spec.ts` | superviseur | CHU-SUP-01 à CHU-SUP-07 | libre | aucune | nouveau |
| `chues-supervision.commercial.spec.ts` | commercial | CHU-SUP-08 | libre | aucune | nouveau |
| `chues-rappels.commercial.spec.ts` | commercial | CHU-RAP-01 à 06, CHU-RAP-08 | serial | `E2E-CHUES-RAP ` | nouveau |
| `chues-rappels.superviseur.spec.ts` | superviseur | CHU-RAP-07 | libre | aucune | nouveau |
| `chues-representants.commercial.spec.ts` | commercial | CHU-REP-01 à 05, CHU-REPD-01 à 05 | libre | `E2E-CHUES-REP ` | nouveau |
| `chues-representants.superviseur.spec.ts` | superviseur | CHU-REP-06 | libre | aucune | nouveau |
| `chues-representants.spec.ts` | admin | CHU-REP-07 | libre | aucune | nouveau |
| `chues-import.spec.ts` | admin | CHU-IMP-02 à CHU-IMP-05 | libre | `E2E-CHUES-IMP ` | nouveau |
| `chues-import.roles.spec.ts` | commercial, superviseur, direction, banque | CHU-IMP-01 | libre | aucune | nouveau |
| `chues-prospects.commercial.spec.ts` | commercial | CHU-PRO-01, 04 à 08 | libre | `E2E-CHUES-PRO ` | nouveau |
| `chues-prospects.commercial2.spec.ts` | commercial2 (`fixture.fatou`) | CHU-PRO-02 | libre | lecture seule | nouveau, **bloqué** §3.2 |
| `chues-prospects.superviseur.spec.ts` | superviseur | CHU-PRO-03 | libre | aucune | nouveau |
| `chues-suggestions.commercial.spec.ts` | commercial | CHU-SUG-01 à CHU-SUG-05 | serial | `E2E-CHUES-SUG ` | nouveau |
| `chues-suggestions.superviseur.spec.ts` | superviseur | CHU-SUG-06 | libre | aucune | nouveau |
| `chues-dossiers.banque.spec.ts` | banque | CHU-DOS-02 à 06, CHU-DOSN-01 à 05, CHU-DOSD-01 à 07, CHU-DOSX-01, CHU-DOSX-02 | serial | `E2E-CHUES-DOS-<horodatage>` | nouveau |
| `chues-dossiers.roles.spec.ts` | commercial, superviseur, direction, banque | CHU-DOS-01, CHU-DOSE-02, CHU-DOSX-03, CHU-BQ-04, CHU-DMC-02 | libre | aucune | nouveau |
| `chues-dossiers-etapes.spec.ts` | admin | CHU-DOSE-01, 03, 04 | serial | aucune, référentiel remis dans son ordre | nouveau |
| `chues-banque.banque.spec.ts` | banque | CHU-BQ-01, 02, 03, 05 | libre | aucune | nouveau |
| `chues-demandes.banque.spec.ts` | banque, arbitrage en admin | CHU-DMC-01, 03, 04 | serial | `E2E-CHUES-DMC ` | nouveau |
| `chues-demandes.spec.ts` | admin | CHU-DMC-05, CHU-DMC-06 | libre | aucune | nouveau |
| `chues-lots-export.spec.ts` | admin | CHU-LOT-01, 03 à 09 | serial | `E2E-CHUES-LOT ` | nouveau, cible mouvante |
| `chues-lots-export.roles.spec.ts` | commercial, banque | CHU-LOT-02 | libre | aucune | nouveau, cible mouvante |
| `chues-accessibilite.spec.ts` | commercial, superviseur | CHU-TRV-07 | libre | aucune | nouveau |
| `prospects.spec.ts` | admin | CHU-TRV-02 | libre | aucune | **existant, mainteneur central** |

### 5.6 Espace Admin

| Fichier | Session | Scénarios | Ordre | Préfixe de données | État |
| --- | --- | --- | --- | --- | --- |
| `admin-utilisateurs.spec.ts` | admin | ADM-USR-01 à ADM-USR-17 | serial | `E2E-ADM-USR-`, `e2e-adm-usr-*@cpi.test` | nouveau |
| `admin-referentiels.spec.ts` | admin | ADM-REF-01 à ADM-REF-12 | serial | `E2E-ADM-REF-`, abréviation `E2EREF` | nouveau |
| `admin-issues-appel.spec.ts` | admin | ADM-ISS-01 à ADM-ISS-07 | serial | `E2E-ADM-ISS-`, code `E2EISS` | nouveau |
| `admin-imports.spec.ts` | admin | ADM-IMP-01 à ADM-IMP-08 | libre | `E2E-ADM-IMP-` (fichiers déposés, aucune ligne appliquée) | nouveau |
| `admin-notifications.spec.ts` | admin | ADM-NOT-01 à ADM-NOT-10 | serial | `E2E-ADM-NOT-` | nouveau |
| `admin-parametres.spec.ts` | admin, plus les cinq autres pour ADM-PAR-05 | ADM-ROOT-01, ADM-PAR-01 à ADM-PAR-05 | libre | aucune | nouveau |
| `android-release.spec.ts` | admin | ADM-APK-01 à ADM-APK-18 | serial | `E2E-APK-`, `versionCode` 900 000 à 999 999 | nouveau |

### 5.7 Espace Projet Grand Public

| Fichier | Session | Scénarios | Ordre | Préfixe de données | État |
| --- | --- | --- | --- | --- | --- |
| `grand-public-liste.spec.ts` | admin, superviseur, direction | GP-01 à GP-12 | libre | `E2E-GP-LST-` | nouveau |
| `grand-public-saisie.spec.ts` | admin, commercial, superviseur | GP-13 à GP-21 | serial | `E2E-GP-SAI-` | nouveau |
| `grand-public-fiche.spec.ts` | admin, superviseur | GP-22 à GP-28 | serial | `E2E-GP-FIC-` | nouveau |
| `grand-public-console.spec.ts` | commercial, superviseur, direction | GP-29, GP-30 | libre | aucune | nouveau |
| `grand-public-rappels.spec.ts` | commercial, superviseur | GP-31 à GP-33 | libre | `E2E-GP-RAP-` | nouveau |
| `grand-public-chiffres.spec.ts` | admin, superviseur, direction | GP-34 à GP-45 | serial | `E2E-GPC-`, dispositions du compte | nouveau |

### 5.8 Espace démo et transversal

| Fichier | Session | Scénarios | Ordre | Préfixe de données | État |
| --- | --- | --- | --- | --- | --- |
| `demo-isolement.spec.ts` | admin, banque | DEMO-01 à DEMO-09 | serial, **exécuté en dernier** | `E2E-DEMO-` | nouveau, seul propriétaire de l'espace démo |
| `transversal-notifications.spec.ts` | les six | TRA-01 à TRA-03 | libre | aucune | nouveau |
| `transversal-pannes.spec.ts` | admin, contexte jetable pour TRA-04 | TRA-04 à TRA-08 | serial | aucune | nouveau |
| `transversal-erreurs.spec.ts` | admin | TRA-09, TRA-10 | libre | aucune | nouveau |
| `transversal-mobile.spec.ts` | admin | TRA-11, TRA-12 | libre | aucune | nouveau |
| `accessibilite-grand-public.spec.ts` | admin | TRA-13 | libre | aucune | nouveau |
| `accessibilite-modales.spec.ts` | admin, superviseur | TRA-14, TRA-15 | libre | aucune | nouveau |
| `accessibilite-roles-themes.spec.ts` | accueil, commercial, admin | TRA-16 à TRA-18 | libre | aucune | nouveau |

### 5.9 Collisions résolues

| Collision | Résolution |
| --- | --- |
| Deux fichiers propriétaires de l'espace démo (`accueil-demo-isolation.spec.ts` et `demo-isolement.spec.ts`) | Un seul : `demo-isolement.spec.ts`. Les scénarios d'isolement de l'espace Accueil sont fusionnés dans DEMO-05, DEMO-06 et DEMO-07 |
| Deux fichiers propriétaires de l'atterrissage par rôle (`accueil-espaces-roles.spec.ts` et la matrice) | Un seul : `roles-espaces.spec.ts` pour ROL-01 à ROL-06. `accueil-espaces.spec.ts` garde le comportement propre au hub (paramètre `retour`, rechargement, boucle, clavier) |
| `roles-matrice.anon.spec.ts` avec `storageState` | Nom abandonné : le suffixe `.anon` réserve le projet anonyme. Cinq fichiers `roles-*.spec.ts` |
| Projets `chromium-<role>` contre `test.use({ storageState })` | `test.use({ storageState })` ; aucun projet supplémentaire (§3.3) |
| `e2e/roles.setup.ts` contre `e2e/auth.setup.ts` | Un seul fichier, `e2e/auth.setup.ts`, déjà porteur des six sessions |
| Préfixe `E2E-GP-` pour cinq fichiers Grand Public | Sous-préfixes `E2E-GP-LST-`, `E2E-GP-SAI-`, `E2E-GP-FIC-`, `E2E-GP-RAP-`, `E2E-GPC-` |
| Préfixe `E2E-ACC-DEMO-` contre `E2E-DEMO-` | Un seul : `E2E-DEMO-`, avec la variante `E2E-DEMO-VIS-` pour la visite écrite en démo |
| `RUN` horodaté contre suffixe stable | `RUN` quand la donnée ne peut pas être supprimée, suffixe stable quand elle peut l'être (§5.1) |
| Téléphones `+221781002100` et `+221781002101` de l'espace démo contre la plage des comptes admin | La plage démo reste `2100..2119` ; les comptes de `admin-utilisateurs` prennent `2200..2219` |

---

## 6. Conventions communes

### 6.1 Le titre de niveau 1 ne prouve rien

Le titre de niveau 1 de la plupart des écrans est rendu par la **barre
supérieure** (`components/layout/topbar.tsx`, `navTitle(role, pathname)`), pas
par la page. Un `<h1>` correct ne prouve donc pas que la page a rendu quoi que
ce soit. Pour ces écrans : `toHaveTitle(...)`, posé par la page via
`export const metadata`, **et** un repère propre à l'écran.

Exceptions qui rendent leur **propre** `<h1>` : `/espaces`, `/grand-public`,
`/grand-public/nouveau`, `/grand-public/[id]`, `/grand-public/console`,
`/chues/console` et la page 404. Sur ces routes il y a **deux `<h1>`** dans le
document : `getByRole('heading', { level: 1 })` viole le mode strict. Viser le
titre par son nom exact, ou
`page.getByRole('main').getByRole('heading', { level: 1 })`.

### 6.2 Apostrophes et espaces

Le code utilise l'apostrophe typographique `’` (U+2019) dans presque tous les
libellés : « Nouvel utilisateur », « Réinitialiser l’espace démo »,
« Cet écran n’a pas pu s’afficher ». Certains libellés portent une espace
insécable (« Prospects affichés : », « Code à communiquer : »).
**Copier-coller le libellé depuis le fichier source cité, ne pas le retaper.**
Une apostrophe droite fait échouer le sélecteur pour une raison qui n'a rien à
voir avec le défaut cherché.

### 6.3 Pièges de sélecteur déjà payés dans ce dépôt

- `getByRole('alert')` seul attrape aussi le *route-announcer* de Next et la
  région vide du `Toaster` de Sonner. Filtrer :
  `page.locator('form').getByRole('alert')` ou
  `page.getByRole('alert').filter({ hasText: '…' })`.
- `getByRole('status')` seul attrape la région `aria-live` de Sonner. Filtrer sur
  le texte attendu.
- Un en-tête de colonne triable et un filtre portent parfois le même nom
  accessible : distinguer par le rôle (`button` contre `combobox`).
- `FilterCombobox` compose son nom accessible avec le libellé **et** la valeur
  affichée, plus le mot « Obligatoire » quand le champ est requis : le nom d'un
  champ entreprise vide et requis est `ENTREPRISE Obligatoire Choisir`. Les
  options du menu portent le rôle `option`. Voir §8, **Q-09**.
- Les listes sont rendues deux fois, en cartes puis en tableau selon le point de
  rupture (§1.13) : viser `getByRole('table')`.

### 6.4 Libellés du refus d'accès

`apps/web/src/components/permission-denied.tsx` rend un `<h2>Accès refusé</h2>`,
puis « … est réservé à un autre rôle. Rôle en cours : <libellé>. », puis un lien
« Retour à l’accueil » vers `/espaces`.

`ROLE_LABELS` (`apps/web/src/lib/types.ts`) : ADMIN → **Administrateur**,
COMMERCIAL → **Téléconseiller**, BANQUE_FINANCE → **Banque & Finance**,
SUPERVISEUR → **Supervision**, DIRECTION → **Direction**, ACCUEIL → **Accueil**.

### 6.5 Les deux sens de chaque cellule d'autorisation

**Sens autorisé** : l'écran a rendu **son** contenu, pas seulement la coque.
Titre de document, repère propre à l'écran, et `toHaveCount(0)` sur le titre
« Accès refusé ».

**Sens interdit** : deux assertions, jamais une.

1. Le refus est **lisible** : `heading` niveau 2 « Accès refusé », l'alerte
   contient le libellé du rôle en cours, le lien « Retour à l’accueil » porte
   `href="/espaces"`.
2. **Aucune donnée métier n'a été chargée**, prouvé par le réseau : poser
   l'écouteur `page.on('response')` **avant** le `goto`, collecter les chemins
   `/api/v1/…` de statut inférieur à 400, et exiger que la famille de routes de
   l'écran soit vide.

Le second point distingue « l'écran affiche un refus » de « l'écran a chargé les
données puis affiché un refus par-dessus ». C'est le défaut qui compte.

### 6.6 La grille composable, commune à trois écrans

Trois écrans partagent la grille de cartes et sa barre d'édition
(`components/accueil/tableau-de-bord/*`) : `/accueil/tableau-de-bord`,
`/chues/statistiques` et `/grand-public/statistiques`. Ils ne partagent **ni**
leur catalogue de cartes, **ni** leur endpoint de disposition
(`/api/v1/tableaux-de-bord/{visites|chues|grand-public}/disposition`), **ni**
leurs rôles, **ni** le libellé d'entrée du mode (§1.9).

Leurs scénarios restent donc **séparés par écran** : une régression peut toucher
l'un sans les autres, et CHU-DSP-12 prouve précisément que les dispositions ne
se mélangent pas.

Libellés communs, une fois le mode ouvert : « Mode organisation »,
« Ajouter un graphique », « Enregistrer », « Quitter », « Proposer par défaut »
(ADMIN seul), boîte « Quitter sans enregistrer » avec la description
« Les changements faits dans ce mode seront perdus. », tiroir
« Ajouter un graphique » avec la description « Choisissez ce que vous voulez
suivre. L’image montre la forme conseillée. », et
« Toutes les sources sont déjà placées. » quand tout est posé.

### 6.7 Ce que l'API a le droit de faire dans un test

Uniquement deux choses : **poser une précondition** qu'aucun écran du périmètre
ne pose, et **vérifier après coup** un effet que l'écran ne montre pas.

`APIRequestContext` se construit avec le `storageState` du rôle, comme
`adminApi()` dans `e2e/fixtures.ts`, et vise le **relais web**
`http://localhost:3000/api/v1/…`, jamais l'API directement : c'est le relais qui
porte le cookie `httpOnly`.

### 6.8 Priorités

**P1** bloquant : autorisation, isolement des données, perte de données, écran
inutilisable, publication d'APK, persistance d'un état partagé, refus lisible.
Un rouge ici arrête la livraison.
**P2** important : règle métier, message faux, état vide, panne partielle,
filtre dans l'URL, redirection, pagination, largeur mobile.
**P3** confort.

---

## 7. Scénarios

Format de chaque entrée :

```
ID | priorité | intitulé
Route     : la ou les routes visées
Session   : l'état de session à poser
Fichier   : la cible d'écriture, unique
Données   : ce qu'il faut avant, et qui le pose
Gestes    : les gestes navigateur, dans l'ordre
Assertions: ce qui est vérifié, avec le libellé exact
Échoue si : le défaut concret que l'assertion attrape
Origine   : les identifiants des plans fusionnés
```

Les mentions **cible mouvante**, **attendu rouge** et **déjà couvert** sont
portées sur les scénarios concernés.

### 7.1 Matrice des rôles

#### 7.1.1 Atterrissage et tuiles du hub

Tous les rôles atterrissent sur `/espaces` (`homePathForRole`). Le hub montre
**quatre tuiles, toujours** : celles hors de portée sont grisées, sans lien, et
portent « Réservé à d’autres profils ». Les destinations sont calculées par
`coqueHomePath(role, coque)`, première entrée non repliée de la barre : elles se
vérifient **par un clic sur la tuile**, jamais en tapant l'URL, puisque c'est le
lien de la tuile qui porte le calcul.

| Rôle | Tuiles ouvertes | Tuiles grisées | Destination et repère d'arrivée |
| --- | --- | --- | --- |
| ADMIN | Accueil, Projet CHUES, Projet Grand Public, Admin | aucune | `/accueil` (bouton « Ajouter une visite ») · `/chues/statistiques` (titre du document contenant « Chiffres ») · `/grand-public/statistiques` (bouton « Composer l’écran ») · `/admin/commerciaux` (titre du document « Téléconseillers ») |
| DIRECTION | Accueil, Projet CHUES, Projet Grand Public | Admin | `/accueil` · `/chues/statistiques` · `/grand-public/statistiques`, mêmes repères |
| SUPERVISEUR | Projet CHUES, Projet Grand Public | Accueil, Admin | `/chues/statistiques` · `/grand-public/statistiques` |
| COMMERCIAL | Projet CHUES, Projet Grand Public | Accueil, Admin | `/chues` (texte « Trois étapes, dans l’ordre. ») · `/grand-public/console` (titre de page « Rechercher une fiche ») |
| ACCUEIL | Accueil | CHUES, Grand Public, Admin | `/accueil` (bouton « Ajouter une visite ») |
| BANQUE_FINANCE | Projet CHUES | Accueil, Grand Public, Admin | `/chues/banque` (titre du document contenant « Tableau de bord bancaire ») |

Assertions communes aux six scénarios :

- `toHaveURL(/\/espaces$/)` ;
- `getByRole('heading', { name: 'Choisissez un espace', level: 1 })` visible ;
- dans `main`, quatre `listitem` ;
- pour chaque tuile **ouverte** : un lien, nommé par une regex ancrée
  (`/^Accueil/`, `/^Projet CHUES/`, `/^Projet Grand Public/`, `/^Admin/`), la
  tuile portant aussi sa description ;
- pour chaque tuile **grisée** : `getByRole('listitem').filter({ hasText: '<libellé>' })`
  contient « Réservé à d’autres profils » **et** `getByRole('link')` y compte 0 ;
- clic sur chaque tuile ouverte : URL **exacte** du tableau, repère d'arrivée
  visible, et aucun titre « Accès refusé », « Serveur injoignable » ni
  « Chargement impossible » sur l'écran d'arrivée.

**ROL-01 | P1 | un administrateur voit quatre tuiles ouvertes et chacune mène où il faut**
Route : `/espaces`. Session : ADMIN. Fichier : `roles-espaces.spec.ts`.
Données : aucune.
Gestes : ouvrir `/espaces` ; cliquer les quatre tuiles, une par une, en revenant
au hub entre chaque.
Assertions : les assertions communes ci-dessus ; aucune tuile ne contient
« Réservé à d’autres profils » ; les quatre descriptions sont exactes :
« Registre des visites du comptoir », « Enrôlement des enseignants syndiqués »,
« Vente hors syndicat, en préparation »,
« Comptes, listes de référence, imports et paramètres ».
Échoue si : une tuile perd sa description ; une cinquième coque apparaît sans
que ce document la connaisse ; `coqueHomePath(role, 'accueil')` change et fait
atterrir sur un onglet secondaire ; une tuile pointe une route qui rend une
coquille vide.
Origine : ADM ROLE-01 + ACC B1 + ACC B2 + ligne ADMIN de ACC B7.

**ROL-02 | P1 | la Direction ouvre Accueil, CHUES et Grand Public, jamais l'Admin**
Route : `/espaces`. Session : DIRECTION. Fichier : `roles-espaces.spec.ts`.
Gestes : ouvrir `/espaces` ; cliquer les trois tuiles ouvertes.
Assertions : assertions communes ; la tuile « Admin » est grisée avec
« Réservé à d’autres profils » et zéro lien.
Échoue si : la coque Admin s'ouvre à la Direction alors que `/admin/parametres`
refuse toujours côté serveur : une tuile qui mène à un refus est un défaut de
conception, pas une protection.
Origine : ADM ROLE-02 + ACC B6 + ligne DIRECTION de ACC B7.

**ROL-03 | P1 | la supervision n'ouvre que CHUES et Grand Public**
Route : `/espaces`. Session : SUPERVISEUR. Fichier : `roles-espaces.spec.ts`.
Assertions : assertions communes ; « Accueil » et « Admin » grisées ; la tuile
Grand Public mène à `/grand-public/statistiques`, **pas** à `/grand-public`.
Échoue si : la tuile Grand Public d'un superviseur mène à la liste au lieu du
tableau de bord ; la tuile Accueil devient cliquable alors que le registre lui
est fermé.
Origine : ADM ROLE-03 + ligne SUPERVISEUR de ACC B7.

**ROL-04 | P1 | un téléconseiller atterrit sur ses trois étapes et sur la file Grand Public**
Route : `/espaces`. Session : COMMERCIAL. Fichier : `roles-espaces.spec.ts`.
Assertions : assertions communes ; la tuile CHUES mène à `/chues` et le texte
« Trois étapes, dans l’ordre. » est visible ; la tuile Grand Public mène à
`/grand-public/console`.
Échoue si : `coqueHomePath` renvoie le téléconseiller sur un écran interdit à son
rôle, la première seconde d'utilisation se soldant par un « Accès refusé », ce
que `nav-items.test.ts` ne peut pas voir puisqu'il ne connaît pas la garde
serveur.
Origine : ADM ROLE-04 + ligne COMMERCIAL de ACC B7. Déjà partiellement couvert
par `roles.anon.spec.ts`, au prix d'une connexion par test (§3.6).

**ROL-05 | P1 | un agent d'accueil ne voit qu'une tuile ouverte**
Route : `/espaces`. Session : ACCUEIL. Fichier : `roles-espaces.spec.ts`.
Assertions : assertions communes ; les tuiles « Projet CHUES », « Projet Grand
Public » et « Admin » contiennent « Réservé à d’autres profils » et n'ont
**aucun** lien ; la tuile « Accueil » mène à `/accueil` et le bouton « Ajouter une
visite » y est visible.
Échoue si : `COQUES[].roles` s'élargit par accident et un compte de comptoir se
voit proposer l'administration, où l'API le refusera ensuite.
Origine : ADM ROLE-05 + ACC B5 + ligne ACCUEIL de ACC B7.

**ROL-06 | P1 | un agent Banque & Finance atterrit sur le tableau de bord bancaire**
Route : `/espaces`. Session : BANQUE_FINANCE. Fichier : `roles-espaces.spec.ts`.
Assertions : assertions communes ; la tuile CHUES mène à `/chues/banque` et le
titre du document contient « Tableau de bord bancaire ».
Échoue si : la tuile CHUES d'un agent bancaire mène au tableau de bord des
prospects, où l'API répond 403 immédiatement.
Origine : ADM ROLE-06 + ligne BANQUE_FINANCE de ACC B7. Déjà partiellement
couvert par `roles.anon.spec.ts` (§3.6).

#### 7.1.2 Entrées de navigation, par rôle et par coque

Source de vérité : `apps/web/src/components/layout/nav-items.ts`. La barre est
`getByRole('navigation', { name: 'Navigation principale' })`. Les entrées
`secondary: true` sont sous un repli `<details>` dont le résumé est « Plus »
(`getByText('Plus', { exact: true })`). Les entrées `hidden: true` ne sont
**jamais** dans la barre.

**Coque CHUES**

| Rôle | Barre principale, dans l'ordre | Sous « Plus » | Absentes |
| --- | --- | --- | --- |
| COMMERCIAL | Mon travail, Qualifier un représentant, Ajouter un prospect, Convertir un prospect, Rappels promis | Contacts recommandés, Représentants, Prospects | Tableau de bord, Mon équipe, Lots d’export, Dossiers bancaires, Utilisateurs, Listes de référence, Paramètres |
| SUPERVISEUR | Tableau de bord, Qualifier un représentant, Ajouter un prospect, Convertir un prospect, Rappels promis, Mon équipe | Contacts recommandés, Représentants, Prospects, Lots d’export | Mon travail, Dossiers bancaires, Utilisateurs, Listes de référence, Paramètres, Créations de client à valider |
| DIRECTION | identique à SUPERVISEUR | identique | identique |
| ADMIN | Tableau de bord, Prospects, Représentants, Lots d’export, Dossiers bancaires | Les trois étapes, Équipes, Rappels, Contacts recommandés, Vue d’ensemble bancaire, Créations de client à valider, Exporter les dossiers, Étapes des dossiers | Mon travail, Mes demandes de création |
| BANQUE_FINANCE | Vue d’ensemble, Dossiers bancaires, Ouvrir un dossier, Mes demandes de création | Exporter les dossiers | tout le reste |
| ACCUEIL | coque fermée | sans objet | sans objet |

**Coque Grand Public**

| Rôle | Barre principale | Sous « Plus » | Absentes |
| --- | --- | --- | --- |
| COMMERCIAL | Appeler les prospects, Rappels promis, Noter un prospect | Mes prospects | Tableau de bord |
| SUPERVISEUR | Tableau de bord, Prospects | Rappels | Noter un prospect, Appeler les prospects |
| DIRECTION | identique à SUPERVISEUR | identique | identique |
| ADMIN | Tableau de bord, Prospects | Rappels, Appeler les prospects, Noter un prospect | aucune |
| ACCUEIL, BANQUE_FINANCE | coque fermée | sans objet | sans objet |

**Coque Admin** : ADMIN seul. Utilisateurs, Listes de référence, Importer un
fichier Excel, Envoyer une notification, Paramètres. Aucun repli.

**Coque Accueil** : ADMIN, DIRECTION, ACCUEIL. Une seule entrée visible,
« Registre des visites ». Les trois autres (« Tableau de bord », « Listes »,
« Import du registre ») sont `hidden: true` : elles ne sont **pas** dans la
barre, même pour un ADMIN, et s'atteignent par les onglets du registre.

Assertions communes aux dix scénarios :

- chaque entrée de la barre principale :
  `nav.getByRole('link', { name: '<libellé>', exact: true })` visible ;
- **l'ordre** : `nav.getByRole('link').allTextContents()` commence par la liste
  attendue ; c'est ce qui prouve que « Tableau de bord » est bien la **première**
  entrée de l'encadrement ;
- chaque entrée « Plus » : `toHaveCount(0)` **avant** le clic sur « Plus »,
  visible **après** ;
- chaque entrée absente : `toHaveCount(0)` avec `exact: true` obligatoire ;
- « Mon travail » : présent pour COMMERCIAL, `toHaveCount(0)` pour tous les
  autres.

Échoue si, pour les dix : « Tableau de bord » n'est plus en tête pour
SUPERVISEUR, DIRECTION ou ADMIN ; « Mon travail » apparaît pour un rôle autre que
COMMERCIAL ; une entrée d'administration apparaît dans la barre d'un
SUPERVISEUR ; une entrée repliée remonte dans la barre principale et allonge la
liste du matin ; une entrée `hidden` apparaît dans la barre ; un libellé change
sans que ce document soit mis à jour.

**ROL-07 | P1 | barre CHUES d'un téléconseiller** · route `/chues` · session
COMMERCIAL · fichier `roles-navigation.spec.ts` · table ci-dessus.
Origine : ADM ROLE-07.

**ROL-08 | P1 | barre CHUES de l'encadrement** · route `/chues/statistiques` ·
sessions SUPERVISEUR et DIRECTION, paramétrées dans un même `test.describe` avec
une table, **un `test` par rôle** · fichier `roles-navigation.spec.ts`.
**Cible mouvante** : l'entrée « Lots d’export » (`/chues/campagnes`) peut
disparaître ; si c'est le cas, le test reste rouge et l'agent le rapporte.
Origine : ADM ROLE-08.

**ROL-09 | P1 | barre CHUES d'un administrateur** · route `/chues/statistiques` ·
session ADMIN · fichier `roles-navigation.spec.ts`.
Précondition : relever d'abord la liste réelle
`nav.getByRole('link').allTextContents()` (§8, **Q-13**) : `navSections` filtre
puis concatène deux blocs d'entrées ADMIN écrits à des endroits différents de
`nav-items.ts`, et l'ordre n'a pas pu être déterminé par lecture.
**Cible mouvante** sur « Lots d’export ».
Origine : ADM ROLE-09.

**ROL-10 | P1 | barre CHUES d'un agent bancaire** · route `/chues/banque` ·
session BANQUE_FINANCE · fichier `roles-navigation.spec.ts`.
Origine : ADM ROLE-10.

**ROL-11 | P1 | barre Grand Public d'un téléconseiller** · route
`/grand-public/console` · session COMMERCIAL · fichier
`roles-navigation.spec.ts`.
Origine : ADM ROLE-11.

**ROL-12 | P1 | barre Grand Public de l'encadrement** · route
`/grand-public/statistiques` · sessions SUPERVISEUR et DIRECTION · fichier
`roles-navigation.spec.ts`.
Origine : ADM ROLE-12.

**ROL-13 | P1 | barre Grand Public d'un administrateur** · route
`/grand-public/statistiques` · session ADMIN · fichier
`roles-navigation.spec.ts`.
Origine : ADM ROLE-13.

**ROL-14 | P1 | barre Admin** · route `/admin/commerciaux` · session ADMIN ·
fichier `roles-navigation.spec.ts`.
Assertions : les cinq entrées dans l'ordre, aucun repli « Plus »
(`getByText('Plus', { exact: true })` a un compte de 0).
Origine : ADM ROLE-14.

**ROL-15 | P1 | barre Accueil d'un administrateur et d'une direction** · route
`/accueil` · sessions ADMIN et DIRECTION · fichier `roles-navigation.spec.ts`.
Assertions : une seule entrée, « Registre des visites » ; « Tableau de bord »,
« Listes » et « Import du registre » ont un compte de 0 **même pour un ADMIN**.
Origine : ADM ROLE-15.

**ROL-16 | P1 | la barre d'un agent d'accueil ne montre qu'une entrée** · route
`/accueil` · session ACCUEIL · fichier `roles-navigation.spec.ts`.
Assertions : dans la navigation « Navigation principale », le lien
« Registre des visites » (exact) est visible et porte `aria-current="page"` ;
**aucun** lien nommé « Tableau de bord », « Listes », « Import du registre »,
« Prospects », « Utilisateurs », « Paramètres » (compte de 0, `exact: true`) ;
aucune section « Plus » n'est rendue.
Échoue si : une entrée `hidden` réapparaît dans la barre et double le chemin
déjà offert par les onglets ; une entrée d'un autre espace fuit dans la coque
Accueil.
Origine : ADM ROLE-16 + ACC C1.

#### 7.1.3 Balayage des routes interdites

Relevé exhaustif de `guardRoles([...])` dans chaque `page.tsx`.
`A` = ADMIN, `D` = DIRECTION, `S` = SUPERVISEUR, `C` = COMMERCIAL,
`Ac` = ACCUEIL, `B` = BANQUE_FINANCE.

| Route | Autorisés | Refusés | Comportement du refus |
| --- | --- | --- | --- |
| `/espaces` | tous | aucun | sans objet |
| `/accueil` | **aucune garde** | sans objet | voir ROL-28 |
| `/accueil/tableau-de-bord` | A, D, Ac | S, C, B | Accès refusé |
| `/accueil/listes` | A, D | S, C, B, Ac | Accès refusé, « La gestion des listes du registre » |
| `/accueil/import` | A, D | S, C, B, Ac | Accès refusé, « L’import du registre des visites » |
| `/admin` | A | autres | renvoi vers `coqueHomePath` du rôle |
| `/admin/commerciaux` | A | D, S, C, Ac, B | Accès refusé, « La gestion des comptes » |
| `/admin/imports` | A | autres | Accès refusé, « Les imports de masse » |
| `/admin/notifications` | A | autres | D, S, Ac, B **renvoyés** vers `/notifications` ; C : Accès refusé |
| `/admin/parametres` | A | autres | Accès refusé, « Les paramètres de la plateforme » |
| `/admin/referentiels` | A | autres | Accès refusé, « La gestion des référentiels » |
| `/admin/referentiels/issues-appel` | A | autres | Accès refusé, « Le référentiel des issues d’appel » |
| `/chues` | A, C, S, D, B | Ac | B **renvoyé** vers `/chues/banque` ; Ac : Accès refusé |
| `/chues/appels-representants` | A, C, S, D | Ac, B | Accès refusé, « Les appels aux représentants » |
| `/chues/banque` | A, B | D, S, C, Ac | Accès refusé, « Le tableau de bord bancaire » |
| `/chues/campagnes` et `/chues/campagnes/[id]` | A, S, D | C, Ac, B | **renvoi vers `/chues`** |
| `/chues/console` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/demandes-clients` | A, B | D, S, C, Ac | Accès refusé, « Le suivi des demandes de création » |
| `/chues/dossiers` | A, B | D, S, C, Ac | Accès refusé, « Le suivi des dossiers bancaires » |
| `/chues/dossiers/[id]` | A, B | autres | Accès refusé |
| `/chues/dossiers/etapes` | A | autres | Accès refusé, « La configuration du flux bancaire » |
| `/chues/dossiers/export` | A, B | autres | Accès refusé, « L’export des dossiers bancaires » |
| `/chues/dossiers/nouveau` | A, B | autres | Accès refusé |
| `/chues/prospects` et `/chues/prospects/nouveau` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/rappels` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/representants` et `/chues/representants/[id]` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/representants/import` | A | autres | Accès refusé, « L’import de représentants » |
| `/chues/statistiques` | A, S, D | C, Ac, B | Accès refusé, « Les chiffres du projet CHUES » |
| `/chues/suggestions` | A, C, S, D | Ac, B | Accès refusé |
| `/chues/supervision` | A, S, D | C, Ac, B | Accès refusé, « La supervision » |
| `/chues/tableau-de-bord` | sans objet | sans objet | `permanentRedirect` vers `/chues/statistiques` |
| `/grand-public` | A, D, S, C | Ac, B | Accès refusé, « Le projet Grand Public » |
| `/grand-public/[id]` | A, D, S, C | Ac, B | Accès refusé, « La fiche d’un prospect » |
| `/grand-public/campagnes/[id]` | A, S, D | C, Ac, B | **renvoi vers `/chues`** |
| `/grand-public/console` | A, C | D, S, Ac, B | Accès refusé, « La file d’appel Grand Public » |
| `/grand-public/nouveau` | A, C | D, S, Ac, B | Accès refusé, « La saisie d’un prospect Grand Public » |
| `/grand-public/rappels` | A, C, S, D | Ac, B | Accès refusé, « La file des rappels » |
| `/grand-public/statistiques` | A, S, D | C, Ac, B | Accès refusé, « Les chiffres du projet Grand Public » |
| `/grand-public/tableau-de-bord` | sans objet | sans objet | `permanentRedirect` vers `/grand-public/statistiques` |
| `/notifications` | A, D, S, B, Ac | C | A **renvoyé** vers `/admin/notifications?onglet=reception` ; C : Accès refusé |

**ROL-17 à ROL-21 | P1 | balayage des URL interdites, un scénario par rôle**
Fichier : `roles-refus.spec.ts`. Un `test()` par rôle, table paramétrée
`for (const route of ROUTES_REFUSEES[role])`, message d'assertion nommant la
route.

| Identifiant | Session |
| --- | --- |
| ROL-17 | DIRECTION |
| ROL-18 | SUPERVISEUR |
| ROL-19 | COMMERCIAL |
| ROL-20 | ACCUEIL |
| ROL-21 | BANQUE_FINANCE |

Assertions, pour **chaque** route : les deux sens du §6.5, c'est-à-dire le refus
lisible (« Accès refusé » niveau 2, l'alerte contient le libellé du rôle en
cours, le lien « Retour à l’accueil » porte `href="/espaces"`) **et** la preuve
réseau qu'aucune donnée métier n'a été chargée.
Découper en deux `test()` par rôle si le balayage dépasse une trentaine de
routes (§4.4.2) : un pour la coque Admin, un pour le reste.
Échoue si : une route interdite rend son écran ; une route interdite charge des
données avant de refuser ; un refus rend une page blanche, une erreur anglaise
de Next ou une boucle de redirection (le `waitForURL` expire) ; le refus ne nomme
pas le rôle en cours ; le lien de sortie ne pointe pas vers `/espaces`.
Origine : ADM ROLE-17 à ROLE-21 + CHU TRV-3.

**ROL-22 | P1 | aucune route du tableau n'est refusée à un administrateur**
Route : toutes celles du tableau. Session : ADMIN. Fichier :
`roles-refus.spec.ts`.
Assertions : pour chaque route, `getByRole('heading', { name: 'Accès refusé' })`
a un compte de 0, et l'écran rend son repère propre (titre du document).
Découper en deux `test()` pour rester sous le quota d'appels.
Échoue si : une garde se referme sur l'administrateur et un écran devient
inatteignable pour tout le monde.
Origine : ADM ROLE-22.

#### 7.1.4 Renvois plutôt que refus

**ROL-23 | P2 | `/admin/notifications` renvoie les non-administrateurs vers leur boîte**
Route : `/admin/notifications`. Sessions : DIRECTION, SUPERVISEUR, ACCUEIL,
BANQUE_FINANCE. Fichier : `roles-renvois.spec.ts`.
Assertions : `waitForURL('**/notifications')` ; l'onglet « Boîte de réception »
rend son contenu ; aucun titre « Accès refusé ».
Échoue si : le renvoi devient un refus et un rôle à boîte perd l'accès à ses
notifications ; ou le renvoi boucle et le `waitForURL` expire.
Origine : ADM ROLE-23.

**ROL-24 | P2 | `/notifications` renvoie l'administrateur vers le composeur**
Route : `/notifications`. Session : ADMIN. Fichier : `roles-renvois.spec.ts`.
Assertions : `waitForURL(/\/admin\/notifications\?onglet=reception$/)` ; l'onglet
« Boîte de réception » est actif.
Échoue si : l'administrateur se retrouve avec deux écrans de boîte de réception,
ou le renvoi perd le paramètre `onglet` et ouvre le composeur au lieu de la
réception.
Origine : ADM ROLE-24 + complément ADMIN de ACC A13.

**ROL-25 | P2 | un agent Banque & Finance est renvoyé de `/chues` vers son tableau de bord**
Route : `/chues`. Session : BANQUE_FINANCE. Fichier : `roles-renvois.spec.ts`.
Assertions : `waitForURL('**/chues/banque')` ; le titre du document correspond à
`/Tableau de bord bancaire/` ; aucun titre « Accès refusé ».
Échoue si : le renvoi est remplacé par un refus, ce qui casse la tuile « Projet
CHUES » du hub pour ce rôle (couvert côté navigation par `roles.anon.spec.ts`,
jamais par l'URL directe).
Origine : ADM ROLE-25 + CHU HUB-7 (le scénario CHU-HUB-07 garde la vérification
côté coque CHUES ; celui-ci la porte dans la matrice).

**ROL-26 | P2 | les deux anciennes routes de tableau de bord renvoient en permanence**
Routes : `/chues/tableau-de-bord`, `/grand-public/tableau-de-bord`.
Sessions : SUPERVISEUR (les deux routes lui sont ouvertes). Fichier :
`roles-renvois.spec.ts`.
Assertions : URL finale exactement `/chues/statistiques` puis
`/grand-public/statistiques` ; sur chaque écran d'arrivée, un repère de la page
est rendu (au moins le titre de carte « Par téléconseiller » côté CHUES, le
bouton « Composer l’écran » côté Grand Public).
Échoue si : le renvoi est retiré et les notifications déjà envoyées en base, qui
portent ces adresses, tombent en 404 ; ou l'URL finale garde l'ancienne adresse
et le lien partagé n'ouvre pas l'écran attendu.
Origine : ADM ROLE-26 + ADM GP-47 + CHU TDB-1.

**ROL-27 | P2 | un téléconseiller sur une route de campagne est renvoyé vers `/chues`, sans un mot**
Routes : `/chues/campagnes`, `/chues/campagnes/<uuid>`,
`/grand-public/campagnes/<uuid>`. Session : COMMERCIAL. Fichier :
`roles-renvois.spec.ts`.
Données : l'identifiant d'un lot existant (§8, **Q-15**).
Assertions : URL finale `/chues` dans les trois cas.
Échoue si : un rôle non autorisé atteint la liste des lots, ou le renvoi boucle.
Commentaire obligatoire dans la spec : renvoyer un COMMERCIAL vers `/chues` sans
rien dire est une **incohérence assumée par le code** (`redirect('/chues')` au
lieu de `PermissionDenied`). Le scénario fige le comportement actuel ; le retour
le nomme comme un écart de traitement du refus, à trancher par le propriétaire
produit.
Origine : ADM ROLE-27.

#### 7.1.5 Trous relevés en lecture

**ROL-28 | P1 | `/accueil` refuse les rôles sans droit sur le registre** · **attendu rouge**
Route : `/accueil`. Sessions : COMMERCIAL puis BANQUE_FINANCE. Fichier :
`roles-trous.spec.ts`.
Gestes : `page.goto('/accueil')` avec chaque session.
Assertions : `getByRole('heading', { name: 'Accès refusé', level: 2 })` est
visible.
Échoue si : un rôle sans droit sur le registre voit autre chose qu'un refus. En
l'état, l'écran rend la coquille du registre et un état d'erreur de chargement,
l'API répondant 403 sur les visites : **le test reste rouge** et le retour nomme
`apps/web/src/app/(panel)/accueil/page.tsx`, qui ne pose pas
`guardRoles(['ADMIN','DIRECTION','ACCUEIL'])` comme ses trois sous-routes.
Origine : ADM ROLE-28. Voir §1.4.

**ROL-29 | P1 | « Ouvrir l'annuaire » mène à la liste Grand Public** · **attendu rouge**
Route : `/grand-public/console`. Session : COMMERCIAL. Fichier :
`roles-trous.spec.ts`.
Gestes : ouvrir `/grand-public/console`, cliquer « Ouvrir l’annuaire ».
Assertions : `toHaveURL(/\/grand-public$/)`.
Échoue si : le lien de l'annuaire Grand Public mène ailleurs que sur la liste
Grand Public. En l'état il pointe `/grand-public/prospects`, route inexistante
captée par `/grand-public/[id]`, et l'écran rend « Cette fiche n’a pas pu être
chargée. » : **le test reste rouge** et le retour nomme
`apps/web/src/components/console/console-view.tsx` ligne 9.
Origine : ADM ROLE-29 + ADM GP-30 (doublon interne au plan Admin : GP-30
renvoyait explicitement à ROLE-29). Voir §1.5.

**ROL-30 | P2 | `/grand-public/campagnes/[id]` rend un détail de lot d'export** · **cible mouvante**
Route : `/grand-public/campagnes/<id d'un lot existant>`. Session : ADMIN.
Fichier : `roles-trous.spec.ts`.
Données : l'identifiant d'un lot (§8, **Q-15**).
Assertions : l'écran rend le détail du lot (nombre de fiches, auteur, date,
boutons d'export) ; aucune notion d'assignation, de tâche, de file ni de reste à
faire : `expect(page.getByText(/assign|tâche|à appeler|reste à faire/i)).toHaveCount(0)`
(seule regex large tolérée de ce document, parce qu'elle prouve une **absence**).
Marquer le `test()` d'un commentaire `// CIBLE MOUVANTE - Plan.md §0.1`.
Échoue si : l'écran affiche encore une répartition par téléconseiller, une liste
d'appel ou un compteur de tâches ; ou la route Grand Public affiche un titre de
document (« Campagne d’appels Grand Public ») qui ne correspond pas à ce qu'elle
rend.
Origine : ADM ROLE-30.

### 7.2 Connexion, session, hub, coque du panel

#### 7.2.1 Connexion et redirections

Routes : `/connexion`, `/`, `/[ancien]/[[...segments]]`, gardes de
`(panel)/layout.tsx` et `(hub)/layout.tsx`. Précondition ACC-CNX-01 à
ACC-CNX-09 : navigateur vierge, projet `chromium-anonyme`, au plus trois
connexions dépensées dans tout le fichier.

**ACC-CNX-01 | P1 | le champ identifiant vide refuse l'envoi et nomme le champ**
Route : `/connexion`. Session : anonyme. Fichier :
`accueil-connexion.anon.spec.ts`.
Gestes : laisser « E-mail ou identifiant » vide, saisir un mot de passe de 12
caractères, cliquer « Se connecter ».
Assertions : l'URL reste sur `/connexion` ; le paragraphe `#identifier-error`
affiche exactement `E-mail ou identifiant obligatoire.` ; le champ porte
`aria-invalid="true"` ; **aucune requête n'est partie** vers `/api/auth/login`
(interception par `page.route` ou `waitForRequest` avec borne courte, jamais un
`waitForTimeout`).
Échoue si : la validation zod côté client est retirée et le formulaire consomme
une tentative sur un quota de dix par minute ; ou le message change sans que ce
document soit mis à jour.
Origine : ACC A1.

**ACC-CNX-02 | P2 | un mot de passe trop court est refusé avant l'envoi**
Route : `/connexion`. Session : anonyme. Fichier :
`accueil-connexion.anon.spec.ts`.
Gestes : identifiant `admin@cpi.sn`, mot de passe `court`, envoyer.
Assertions : `#password-error` affiche
`Le mot de passe compte au moins 8 caractères.`
Échoue si : la borne `min(8)` disparaît du schéma et chaque frappe malheureuse
brûle une tentative de connexion.
Origine : ACC A2.

**ACC-CNX-03 | P3 | un identifiant refusé ne révèle pas si le compte existe** · **déjà couvert**
Route : `/connexion`. Fichier : `auth.anon.spec.ts` (**existant**).
Consigne : ne pas réécrire. Vérifier seulement, à la relecture, que le message
générique attendu est bien `Identifiants incorrects ou compte non autorisé.`
(route `/api/auth/login`, statut 401), et le signaler s'il a changé.
Échoue si : le message distingue « compte inconnu » de « mot de passe faux » et
livre une liste de comptes valides à qui essaie.
Origine : ACC A3.

**ACC-CNX-04 | P1 | un agent d'accueil se connecte et atterrit sur le hub**
Route : `/connexion`. Session : anonyme, compte `fixture.accueil@cpi.sn`, mot de
passe lu dans `SEED_FIXTURE_PASSWORD`. Fichier :
`accueil-connexion.anon.spec.ts`.
Gestes : remplir et envoyer.
Assertions : `waitForURL(/\/espaces$/)` ; le titre de niveau 1 est
`Choisissez un espace` ; les cookies du contexte contiennent `cpi_at` et
`cpi_rt` ; `document.cookie` **ne** les contient **pas**.
Échoue si : `homePathForRole` cesse de renvoyer tout le monde sur le hub et
envoie l'accueil sur un écran qu'il n'a pas le droit d'ouvrir ; ou un cookie de
session devient lisible en JavaScript, ce qui rendrait une XSS suffisante pour
voler la session.
Origine : ACC A4.

**ACC-CNX-05 | P1 | la connexion respecte la destination demandée**
Route : `/connexion?suite=%2Faccueil%2Ftableau-de-bord`. Session : anonyme,
compte ACCUEIL. Fichier : `accueil-connexion.anon.spec.ts`.
Assertions : l'URL finale est `/accueil/tableau-de-bord`, et non `/espaces` ; le
titre du document contient `Tableau de bord des visites`.
Échoue si : le paramètre `suite` est ignoré et un utilisateur dont la session a
expiré au milieu d'un écran est renvoyé au hub, perdant son contexte.
Origine : ACC A5.

**ACC-CNX-06 | P1 | une destination externe déguisée est ignorée** · sécurité
Routes : `/connexion?suite=//evil.example.com`, `/connexion?suite=/\evil`.
Session : anonyme, compte ACCUEIL. Fichier : `accueil-connexion.anon.spec.ts`.
Assertions : dans les deux cas, l'URL finale reste sur `localhost:3000` et vaut
`/espaces` ; à aucun moment `page.url()` ne quitte l'origine.
Échoue si : le motif `^\/(?!\/)[^\\]*$` de `connexion/page.tsx` est relâché et le
panel devient un tremplin de redirection ouverte.
Origine : ACC A6.

**ACC-CNX-07 | P2 | une session expirée l'annonce sur l'écran de connexion**
Route : `/connexion?session=expiree`. Session : anonyme. Fichier :
`accueil-connexion.anon.spec.ts`.
Assertions : un élément `role="status"` contient exactement
`Session expirée. Reconnectez-vous.`
Échoue si : `SESSION_EXPIRED_PARAM` change côté client sans que la page le
suive, et l'utilisateur déconnecté en pleine saisie ne comprend pas pourquoi il
est revenu à la connexion.
Origine : ACC A7.

**ACC-CNX-08 | P1 | la racine anonyme mène à la connexion**
Route : `/`. Session : anonyme. Fichier : `accueil-connexion.anon.spec.ts`.
Assertions : `waitForURL(/\/connexion/)` ; le titre de niveau 1 est `Connexion`.
Échoue si : `RootPage` cesse de lire la session et rend le hub à un visiteur non
authentifié.
Origine : ACC A8.

**ACC-CNX-09 | P1 | les écrans de l'accueil sont verrouillés aux anonymes**
Routes : `/accueil`, `/accueil/tableau-de-bord`, `/accueil/listes`,
`/accueil/import`. Session : anonyme. Fichier :
`accueil-connexion.anon.spec.ts`.
Assertions : pour chacune, l'URL finale est `/connexion` ; le titre `Connexion`
est rendu ; le corps de la page ne contient ni le mot `Registre` ni le bouton
`Ajouter une visite` (aucune fuite avant redirection).
Échoue si : un `guardRoles` disparaît d'une page ou le layout `(panel)` cesse de
rediriger : le registre des visites d'une société devient public.
Origine : ACC A9.

**ACC-CNX-10 | P2 | la connexion est refusée à qui a déjà une session**
Route : `/connexion`. Session : ADMIN. Fichier : `accueil-session.spec.ts`.
Assertions : renvoi vers `/espaces`, titre `Choisissez un espace`.
Échoue si : la garde de `connexion/page.tsx` saute et un utilisateur connecté
peut se reconnecter, brûlant le quota de dix par minute.
Origine : ACC A10.

**ACC-CNX-11 | P2 | la déconnexion depuis le hub reverrouille tout l'accueil**
Route : `/espaces` puis `/accueil`. Session : ADMIN, **dans un contexte
jetable**. Fichier : `accueil-session.spec.ts`.
Gestes : ouvrir un contexte
`browser.newContext({ storageState: 'e2e/.auth/admin.json' })` créé dans le test
et fermé après ; depuis `/espaces`, ouvrir le menu `Compte de Administrateur CPI`,
cliquer `Se déconnecter` ; puis aller sur `/accueil`.
Assertions : URL `/connexion` ; les cookies `cpi_at` et `cpi_rt` ont disparu du
contexte ; `/accueil` ne rend pas le registre.
Contrainte de sûreté : **jamais** sur la `page` partagée. Effacer les cookies du
contexte partagé ferait tomber tous les tests suivants.
Échoue si : `/api/auth/logout` cesse d'effacer les cookies et une session reste
ouverte sur un poste partagé du comptoir d'accueil.
Origine : ACC A11.

**ACC-CNX-12 | P2 | les cookies de session restent hors de portée du JavaScript sur un écran de l'accueil**
Route : `/accueil`. Session : ADMIN. Fichier : `accueil-session.spec.ts`.
Gestes : ouvrir `/accueil`, attendre le bouton `Ajouter une visite`.
Assertions : `document.cookie` ne contient ni `cpi_at` ni `cpi_rt` ;
`context.cookies()` les donne avec `httpOnly === true`.
Référence : `prospects.spec.ts` fait la même preuve sur `/tableau-de-bord` ; la
valeur ajoutée ici est la coque Accueil, servie par un autre layout.
Échoue si : la session passe un jour en cookie lisible pour simplifier un appel
client.
Origine : ACC A12.

**ACC-CNX-13 | P2 | `/notifications` est un écran, pas une ancienne adresse**
Route : `/notifications`. Session : ACCUEIL. Fichier : `accueil-session.spec.ts`.
Assertions : l'URL **reste** `/notifications` (le segment statique gagne sur
l'attrape-tout `[ancien]`, qui renverrait vers `/admin/notifications`) ; le titre
de niveau 1 de la barre supérieure est `Notifications` ; aucun titre
`Accès refusé` n'est rendu.
Le complément ADMIN (renvoi vers `/admin/notifications?onglet=reception`) est
porté par **ROL-24** : ne pas le rejouer ici.
Échoue si : l'ordre de résolution des routes change et un agent d'accueil est
envoyé sur le composeur d'administration, où il récolte un « Accès refusé ».
Origine : ACC A13.

**ACC-CNX-14 | P3 | une adresse qui n'a jamais existé reste introuvable**
Route : `/accueils` (faute de frappe volontaire, racine inconnue de
`MOVED_ROUTES`). Session : ADMIN. Fichier : `accueil-session.spec.ts`.
Assertions : titre de niveau 1 `Page introuvable` ; texte
`Cette adresse ne correspond à aucun écran du panel.` ; un lien
`Revenir aux espaces` pointant sur `/espaces`.
Référence : `redirections.spec.ts` couvre déjà `/comptabilite` ; ce scénario
ajoute la **proximité avec un segment réel** (`/accueils` contre `/accueil`).
Échoue si : `[ancien]` avale une racine inconnue et rend une page vide au lieu du
404, ou le segment statique `/accueil` capture `/accueils`.
Origine : ACC A14.

#### 7.2.2 Hub « Choisissez un espace »

L'atterrissage et les tuiles par rôle sont portés par **ROL-01** à **ROL-06**.
Ce fichier garde le comportement propre au hub.

**ACC-HUB-01 | P2 | le hub porte l'état de retour et propose de revenir**
Route : `/espaces?retour=%2Faccueil%2Flistes`. Session : ADMIN. Fichier :
`accueil-espaces.spec.ts`.
Assertions : le titre de niveau 1 devient `Changer d’espace`, et non
« Choisissez un espace » ; un bouton-lien `Retour` porte
`href="/accueil/listes"` ; le cliquer ramène sur `/accueil/listes`.
Échoue si : le paramètre `retour` est ignoré, et le lien « Espaces » de la barre
supérieure devient une impasse d'où l'on ne revient qu'en arrière.
Origine : ACC B3.

**ACC-HUB-02 | P1 | un retour hostile est neutralisé** · sécurité
Routes : `/espaces?retour=//evil.example.com`, `?retour=/\evil`,
`?retour=/espaces`. Session : ADMIN. Fichier : `accueil-espaces.spec.ts`.
Assertions : dans les trois cas, le titre reste `Choisissez un espace` et
**aucun** bouton ni lien `Retour` n'est rendu
(`getByRole('button', { name: 'Retour', exact: true })` et l'équivalent `link`
ont un compte de 0).
Échoue si : le filtre de `espaces/page.tsx` est relâché (redirection ouverte), ou
`?retour=/espaces` produit une boucle sur lui-même.
Origine : ACC B4.

**ACC-HUB-03 | P3 | le hub survit à un rechargement dur**
Route : `/espaces`. Session : ACCUEIL. Fichier : `accueil-espaces.spec.ts`.
Gestes : ouvrir `/espaces`, `page.reload()`.
Assertions : le titre `Choisissez un espace` est de nouveau rendu et la tuile
`Accueil` reste la seule cliquable.
Échoue si : `dynamic = 'force-dynamic'` disparaît du layout du hub et une page
mise en cache montre les tuiles d'un autre rôle.
Origine : ACC B8.

**ACC-HUB-04 | P1 | aucune boucle de redirection entre `/`, `/connexion` et `/espaces`**
Routes : `/` puis `/connexion`. Session : ACCUEIL. Fichier :
`accueil-espaces.spec.ts`.
Assertions : à chaque fois, `waitForURL('**/espaces')` aboutit et le titre
`Choisissez un espace` est rendu.
Référence : `roles.anon.spec.ts` fait la même preuve pour le téléconseiller ;
ici c'est le rôle ACCUEIL, dont la seule coque ouverte est celle du registre, le
cas le plus exposé à une boucle.
Échoue si : une redirection s'ajoute et le navigateur oscille jusqu'au délai
dépassé ; seul `waitForURL` le nomme.
Origine : ACC B9.

**ACC-HUB-05 | P3 | le hub reste utilisable au clavier**
Route : `/espaces`. Session : ACCUEIL. Fichier : `accueil-espaces.spec.ts`.
Gestes : `page.keyboard.press('Tab')` jusqu'à ce que la tuile `Accueil` ait le
focus (`toBeFocused()`), puis `Enter`.
Assertions : URL `/accueil`.
Échoue si : la tuile devient un `div` cliquable et sort de l'ordre de
tabulation : l'agent d'accueil qui travaille au clavier ne peut plus entrer dans
son espace.
Origine : ACC B10.

#### 7.2.3 Coque du panel

Routes : toutes les routes `(panel)`. La liste des entrées de barre par rôle est
portée par **ROL-07** à **ROL-16** : ce fichier couvre le **comportement** de la
coque.

**ACC-COQ-01 | P1 | les onglets du registre sont le seul chemin vers ses trois écrans**
Route : `/accueil`. Session : ADMIN. Fichier : `accueil-coque.spec.ts`.
Assertions : la navigation `Visites`
(`getByRole('navigation', { name: 'Visites' })`) contient quatre liens exacts,
dans cet ordre : `Liste`, `Tableau de bord`, `Listes`, `Import` ; `Liste` porte
`aria-current="page"` ; cliquer `Tableau de bord` mène à
`/accueil/tableau-de-bord` et c'est **lui** qui porte alors `aria-current="page"`.
Échoue si : `aria-current` est posé sur le mauvais onglet, ou un onglet pointe
une route inexistante, le seul chemin vers l'écran étant rompu.
Origine : ACC C2.

**ACC-COQ-02 | P1 | un agent d'accueil ne voit que deux onglets**
Route : `/accueil`. Session : ACCUEIL. Fichier : `accueil-coque.spec.ts`.
Assertions : la navigation `Visites` contient exactement `Liste` et
`Tableau de bord` ; `Listes` et `Import` ont un compte de 0.
Échoue si : le filtre par rôle de `visites-tabs.tsx` saute et le comptoir se voit
proposer la gestion des listes, qu'il n'a pas le droit d'ouvrir.
Origine : ACC C3.

**ACC-COQ-03 | P1 | une URL interdite rend un refus lisible, jamais une page cassée**
Routes : `/accueil/listes` puis `/accueil/import`. Session : ACCUEIL. Fichier :
`accueil-coque.spec.ts`.
Assertions, pour chacune : un titre `Accès refusé` de niveau 2 ; l'alerte
correspondante (`getByRole('alert').filter({ hasText: 'Accès refusé' })`)
contient `Rôle en cours :` et `Accueil` ; pour `/accueil/listes` elle contient
`La gestion des listes du registre`, pour `/accueil/import`
`L’import du registre des visites` ; un lien `Retour à l’accueil` porte
`href="/espaces"`.
Échoue si : `guardRoles` est retiré d'une page et un agent de comptoir peut
renommer les listes du registre ou réécrire le registre en masse ; ou le refus
n'annonce plus le rôle en cours, laissant l'utilisateur sans rien à demander à
son administrateur.
Origine : ACC C4. Recouvrement assumé avec **ROL-20**, qui balaie la même route
sans asserter le libellé « quoi ».

**ACC-COQ-04 | P2 | la section « Plus » se déplie et retient son état**
Route : `/chues` (la coque Accueil n'a qu'une entrée, elle n'a pas de repli).
Session : ADMIN. Fichier : `accueil-coque.spec.ts`.
Gestes : cliquer le résumé `Plus` ; recharger ; replier ; recharger.
Assertions : avant le clic, `Contacts recommandés` a un compte de 0 ; après, il
est visible ; après `page.reload()`, il est **encore** visible (le cookie
`sidebar-more` a été posé) ; replié puis rechargé, il est de nouveau à 0.
**Cible mouvante** : utiliser `Contacts recommandés` comme repère, **jamais**
`Lots d’export` (§2.2).
Échoue si : la préférence de repli n'est pas persistée et l'utilisateur redéplie
« Plus » à chaque navigation ; ou un écran replié qui est l'écran courant reste
caché, sa surbrillance devenant invisible.
Origine : ACC C5.

**ACC-COQ-05 | P2 | la barre latérale se réduit et se souvient**
Route : `/accueil`. Session : ADMIN. Fichier : `accueil-coque.spec.ts`.
Gestes : cliquer `Réduire la navigation` ; recharger ; redéployer.
Assertions : le bouton porte le nom accessible `Déployer la navigation` et
`aria-expanded="false"` ; le lien `Registre des visites` reste atteignable (son
libellé passe en `sr-only`, `getByRole('link', { name: 'Registre des visites' })`
le trouve toujours) ; après `page.reload()`, la barre est **toujours** réduite
(cookie lu côté serveur) ; le redéploiement ramène `aria-expanded="true"`.
**Nettoyage obligatoire** : le cookie de repli est partagé ; le test remet la
barre déployée avant de finir.
Échoue si : l'état de repli n'est plus lu côté serveur et la barre saute d'une
largeur à l'autre à l'hydratation ; ou le libellé disparaît de l'arbre
d'accessibilité en mode réduit, rendant la navigation muette au lecteur d'écran.
Origine : ACC C6.

**ACC-COQ-06 | P2 | en 375 px, la navigation passe dans un tiroir**
Route : `/accueil`. Session : ACCUEIL. Fichier : `accueil-coque.spec.ts`.
Gestes : `setViewportSize({ width: 375, height: 812 })`, ouvrir `/accueil`,
cliquer `Ouvrir la navigation`, cliquer `Registre des visites`.
Assertions : le bouton `Ouvrir la navigation` est visible ; le panneau ouvert a
pour titre accessible `Navigation principale` ; après le clic, le panneau se
referme (compte de 0 sur le lien) et l'URL reste `/accueil`.
Échoue si : le tiroir ne se referme pas après navigation et masque l'écran sur
lequel on vient d'arriver ; ou la barre fixe reste affichée sous 768 px et vole
la moitié de l'écran du comptoir.
Origine : ACC C7.

**ACC-COQ-07 | P2 | le lien « Espaces » de la barre supérieure porte le retour**
Route : `/accueil/tableau-de-bord`. Session : ADMIN. Fichier :
`accueil-coque.spec.ts`.
Gestes : cliquer le lien `Espaces`, puis le bouton `Retour`.
Assertions : l'URL est `/espaces?retour=%2Faccueil%2Ftableau-de-bord` ; le titre
est `Changer d’espace` ; le bouton `Retour` ramène exactement à
`/accueil/tableau-de-bord`.
Échoue si : l'encodage du retour se perd et l'aller-retour vers le hub coûte une
navigation en arrière.
Origine : ACC C8.

**ACC-COQ-08 | P2 | le titre de la barre supérieure suit la route, préfixe le plus long**
Routes : `/accueil` → `Registre des visites` ; `/accueil/tableau-de-bord` →
`Tableau de bord` ; `/accueil/listes` → `Listes` ; `/accueil/import` →
`Import du registre`. Session : ADMIN. Fichier : `accueil-coque.spec.ts`.
Assertions : `getByRole('heading', { level: 1, name: <attendu>, exact: true })`,
un `test` par ligne.
Échoue si : la règle du préfixe le plus long casse et les quatre écrans affichent
tous « Registre des visites », rendant la barre inutile pour savoir où l'on est.
Origine : ACC C9.

**ACC-COQ-09 | P2 | la cloche s'ouvre et mène à la boîte de réception**
Route : `/accueil` puis `/notifications`. Session : ACCUEIL. Fichier :
`accueil-coque.spec.ts`.
Gestes : cliquer le bouton de la cloche. **Relever le libellé exact en navigateur
avant d'écrire** (§8, **Q-10**) : il vient de `bellLabel(unreadCount)`.
Assertions : le panneau contient le titre `Notifications` ; il contient soit une
liste, soit l'état vide `Aucune annonce` accompagné de
`Les rappels et les demandes à traiter apparaîtront ici.` ; le lien `Tout voir`
mène à `/notifications` et l'écran rendu porte le titre de niveau 1
`Notifications`.
Échoue si : la cloche est montrée à un rôle sans boîte de réception et
« Tout voir » aboutit sur un refus de permission ; ou l'état vide manque et le
panneau reste blanc, indistinguable d'un chargement raté.
Origine : ACC C10. La présence de la cloche par rôle est portée par **TRA-03**.

**ACC-COQ-10 | P1 | API injoignable : la coque le dit au lieu de blanchir**
Route : `/accueil`. Session : ADMIN. Fichier : `accueil-coque.spec.ts`.
Gestes : `page.route('**/api/v1/**', route => route.abort('failed'))` **avant** la
navigation, puis ouvrir `/accueil`. Variante : ne couper que
`**/api/v1/visites**` après chargement de la coque, puis recharger.
Assertions : un titre `Serveur injoignable` **ou**
`Session non vérifiée. Réessayez dans un instant.` est rendu dans un
`role="alert"` ; la page ne reste pas vide ; aucun texte anglais de Next
n'apparaît. Dans la variante, la coque (barre latérale, barre supérieure)
**reste** rendue tandis que le corps affiche
`Le registre n’a pas pu être chargé.` avec un bouton `Réessayer`.
Échoue si : une panne d'API produit un écran blanc sans message, ce qui au
comptoir se traduit par « l'ordinateur ne marche plus » sans plus de diagnostic ;
ou l'erreur d'une requête emporte toute la coque.
Origine : ACC C12.

**ACC-COQ-11 | P2 | « Réessayer » relance vraiment la requête**
Route : `/accueil`. Session : ADMIN. Fichier : `accueil-coque.spec.ts`.
Gestes : couper `**/api/v1/visites?**` (abort), ouvrir `/accueil`, constater
`Le registre n’a pas pu être chargé.` ; rétablir la route (`page.unroute`),
cliquer `Réessayer`.
Assertions : le message d'erreur disparaît ; le tableau du registre ou l'état
vide est rendu ; `page.reload()` est **interdit** ici, le but étant de prouver le
bouton.
Échoue si : le bouton est décoratif et n'appelle pas `refetch`, obligeant
l'utilisateur à recharger pour sortir d'une erreur passagère.
Origine : ACC C13.

**ACC-COQ-12 | P2 | une erreur de rendu montre l'écran « Cet écran n'a pas pu s'afficher »**
Route : `/accueil/tableau-de-bord`. Session : ADMIN. Fichier :
`accueil-coque.spec.ts`.
Gestes : provoquer une exception de rendu **sans toucher au code applicatif**, en
servant une réponse structurellement invalide sur une route lue par un composant
client :
`page.route('**/api/v1/tableaux-de-bord/visites/disposition', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"widgets":"pas-un-tableau","preset":"essentiel","source":"usine","updatedAt":null}' }))`,
puis ouvrir l'écran.
Assertions : un `role="alert"` contenant le titre `Cet écran n’a pas pu s’afficher`,
le texte `Rien n’a été perdu et le reste du panneau fonctionne.`, un bouton
`Réessayer` et un lien `Revenir aux espaces`.
Si la charge falsifiée ne déclenche aucune erreur, l'agent **ne force pas** : il
rapporte que la frontière d'erreur n'a pas pu être atteinte par ce moyen, laisse
le scénario non écrit avec sa raison, et ne modifie pas l'application (§8,
**Q-12**).
Échoue si : une exception de composant client remplace tout le panneau par la
page d'erreur générique de Next, en anglais et sans issue.
Origine : ACC C14. Voir aussi **TRA-10**, même frontière sur `/grand-public`.

### 7.3 Espace Accueil

#### 7.3.1 Registre des visites

Route : `/accueil`. Rôles autorisés côté API (`VISITE_REGISTRE_ROLES`) : ADMIN,
DIRECTION, ACCUEIL. Session de travail : **ACCUEIL**, le rôle qui vit sur cet
écran et le seul qu'aucune autre spec de ce bloc ne partage.
Données : visites `E2E-ACC-REG-<RUN> …`. **Le registre n'a aucune route de
suppression** : `VisitesController` n'expose que `GET`, `POST` et `PATCH`. Une
visite créée par un test reste en base pour toujours ; d'où le `RUN` (§5.1). On
n'annonce jamais un nettoyage qui n'existe pas.

**ACC-REG-01 | P1 | l'écran s'ouvre sur la journée, sans état d'erreur**
Gestes : ouvrir `/accueil`.
Assertions : le bouton `Ajouter une visite` est visible ; le groupe `Période`
contient deux bascules, `Aujourd’hui` avec `aria-pressed="true"` et
`Tout le registre` avec `aria-pressed="false"` ; un titre de niveau 2 se termine
par `aujourd’hui` ; aucun titre `Serveur injoignable`, `Chargement impossible`
ni `Accès refusé`.
Échoue si : la période par défaut bascule sur tout le registre et le comptoir se
retrouve devant des milliers de lignes au lieu de sa journée.
Origine : ACC D1.

**ACC-REG-02 | P2 | les deux états vides ne se confondent pas**
Gestes : ouvrir `Rechercher`, poser `Du` = `Au` = une date passée où le registre
est vide (le 1er janvier de l'année précédente ; à défaut, une date vérifiée par
appel API en précondition) ; puis retirer les dates et revenir sur `Aujourd’hui`
**avant** toute création.
Assertions : sur la recherche vide, le titre `Aucune visite pour cette recherche`
et la description `Élargissez la période ou retirez un filtre.` ; sur la journée
vide, le titre `Aucune visite enregistrée aujourd’hui`, la description
`Enregistrez la première ou consultez les visites précédentes.` et un bouton
`Voir tout le registre` qui bascule sur `periode=tout`.
Échoue si : les deux états vides sont confondus et le bouton « Voir tout le
registre » s'affiche sur une recherche filtrée, où il efface silencieusement les
critères de l'utilisateur.
Origine : ACC D2.

**ACC-REG-03 | P1 | enregistrer une visite, la file d'attente conserve l'entreprise**
Gestes : cliquer `Ajouter une visite` ; remplir `PRENOM ET NOMS` =
`E2E-ACC-REG-<RUN> Awa Diop`, `TELEPHONES` = `78 454 44 66`, `ENTREPRISE` = `CPI`,
`OBJET VISITE` = `SUIVI DE DOSSIER`, `COMMENTAIRES / NOTES` =
`E2E premiere ligne` ; laisser `DATE VISITE` et `HEURE VISITE` préremplis ;
cliquer `Enregistrer la visite`.
Assertions : le dialogue a pour titre `Enregistrer une visite` et le formulaire
le même nom accessible ; un toast correspond à
`/^Visite V-\d{4}-\d{6} enregistrée\.$/` ; **le dialogue reste ouvert** ; le champ
`PRENOM ET NOMS` est vide et a le focus ; `ENTREPRISE` affiche toujours `CPI` ;
`OBJET VISITE` est revenu à `Choisir` ; le commentaire est vide.
Échoue si : le dialogue se referme après enregistrement, et trois visiteurs de la
même société ne peuvent plus être saisis d'affilée, ce qui est le geste quotidien
du comptoir ; ou l'entreprise est réinitialisée avec le reste.
Origine : ACC D3.

**ACC-REG-04 | P1 | la nouvelle visite apparaît en tête du registre**
Suite sérielle de ACC-REG-03.
Gestes : fermer le dialogue (`Escape` ou le bouton de fermeture), rechercher
`E2E-ACC-REG-<RUN>` dans le champ `Recherche` du bloc `Rechercher`.
Assertions : dans `getByRole('table')` (§1.13), **exactement une** ligne ; sa
cellule `PRENOM ET NOMS` vaut `E2E-ACC-REG-<RUN> Awa Diop` ; sa cellule
`N° REGISTRE` correspond à la référence annoncée par le toast précédent ; les
colonnes `ENTREPRISE` et `OBJET VISITE` valent `CPI` et `SUIVI DE DOSSIER`.
Échoue si : l'invalidation de la requête `['visites']` est perdue et la visite
n'apparaît qu'après un rechargement manuel : l'accueil croit avoir perdu la
saisie, la refait, et crée un doublon.
Origine : ACC D4.

**ACC-REG-05 | P1 | le nom vide est refusé, champ par champ**
Gestes : ouvrir le dialogue, cliquer directement `Enregistrer la visite`.
Assertions : trois messages, chacun dans un `role="alert"` : `À renseigner.` sous
`PRENOM ET NOMS`, `À choisir dans la liste.` sous `ENTREPRISE` et sous
`OBJET VISITE` ; aucune requête `POST /api/v1/visites` n'est partie ; le dialogue
reste ouvert.
Échoue si : le bouton envoie quand même et l'API répond un 400 qui ne nomme aucun
champ ; l'accueil reste devant un visiteur sans savoir quoi corriger.
Origine : ACC D5.

**ACC-REG-06 | P2 | un nom d'un seul caractère est refusé**
Gestes : saisir `A` dans `PRENOM ET NOMS`, quitter le champ.
Assertions : `Au moins deux caractères.`
Échoue si : la borne client s'écarte de `@MinLength(2)` de `CreateVisiteDto` et
la seule barrière devient un 400 opaque.
Origine : ACC D6.

**ACC-REG-07 | P1 | la date effacée est signalée**
Gestes : ouvrir le dialogue, effacer la date par la croix du sélecteur
`DATE VISITE`, remplir le reste correctement, envoyer.
Assertions : un `role="alert"` `À renseigner.` sous la date ; le dialogue reste
ouvert ; aucun `POST` n'est parti.
Échoue si : le bouton ne fait rien sans message ; c'est le défaut nommé en
commentaire dans `visite-form.tsx`, et il doit rester corrigé.
Origine : ACC D7.

**ACC-REG-08 | P3 | le commentaire compte ses caractères et s'arrête à 2000**
Gestes : saisir 10 caractères dans `COMMENTAIRES / NOTES` ; puis coller 2100
caractères.
Assertions : la description du champ affiche `10 / 2000 caractères` ; après le
collage, le champ contient 2000 caractères (`maxLength`), la description affiche
`2000 / 2000 caractères`, et aucun message d'erreur n'apparaît.
Échoue si : le compteur ment ou le plafond disparaît, et l'API rejette la saisie
après coup.
Origine : ACC D8.

**ACC-REG-09 | P2 | les caractères spéciaux et les accents traversent le tour complet**
Gestes : créer une visite nommée `E2E-ACC-REG-<RUN> Ndèye O’Brien-Sy «ç»` avec le
commentaire `Accents : é à ù — «guillemets» & <balise>` ; rechercher le préfixe.
Assertions : le toast annonce la référence ; la cellule `PRENOM ET NOMS` affiche
**exactement** la chaîne saisie et la cellule `COMMENTAIRES / NOTES`
**exactement** le commentaire ; la page ne contient aucun `&lt;balise&gt;` visible
ni balise injectée.
Échoue si : un échappement double s'installe (`O&#39;Brien`) ou une chaîne est
tronquée à la première apostrophe.
Origine : ACC D9.

**ACC-REG-10 | P1 | les filtres vivent dans l'URL et survivent au rechargement**
Gestes : ouvrir `Rechercher`, saisir `E2E-ACC-REG-<RUN>`, déplier
`Filtres avancés`, choisir `ENTREPRISE` = `CPI`, recharger.
Assertions : l'URL contient `search=E2E-ACC-REG-<RUN>` et `entrepriseId=<uuid>` ;
après `page.reload()`, l'URL est identique, le champ de recherche contient
toujours la valeur, le filtre entreprise affiche `CPI`, et le tableau montre le
même nombre de lignes qu'avant le rechargement (comparaison de la valeur lue,
jamais d'un nombre écrit en dur).
Échoue si : l'état quitte l'URL : le lien devient impartageable et l'impression
ne peut plus s'aligner sur ce qui est affiché.
Origine : ACC D10.

**ACC-REG-11 | P2 | une recherche d'un seul caractère n'est pas envoyée**
Gestes : saisir `E` seul dans la recherche.
Assertions : aucune requête `GET /api/v1/visites` ne part avec un paramètre
`search` (interception et lecture de l'URL des requêtes) ; le tableau n'affiche
pas d'erreur.
Échoue si : `SEARCH_MIN_LENGTH` est contourné, l'API répond 400 sur chaque
frappe, et l'écran se couvre d'erreurs pendant la saisie.
Origine : ACC D11.

**ACC-REG-12 | P2 | la bascule « Tout le registre » élargit et se voit dans l'URL**
Gestes : cliquer `Tout le registre`.
Assertions : `aria-pressed="true"` sur ce bouton et `false` sur `Aujourd’hui` ;
l'URL contient `periode=tout` ; le titre de niveau 2 se termine par `au registre`
et non `aujourd’hui` ; le nombre annoncé est supérieur ou égal à celui de la
journée.
Échoue si : la bascule change l'affichage sans changer l'URL, et un rechargement
ramène l'utilisateur à la journée sans prévenir.
Origine : ACC D12.

**ACC-REG-13 | P2 | « Retirer les filtres » remet l'écran à zéro**
Gestes : avec une recherche et un filtre entreprise actifs, cliquer
`Retirer les filtres`.
Assertions : l'URL n'a plus ni `search` ni `entrepriseId` ; le champ de recherche
est vide ; le filtre entreprise affiche de nouveau `Toutes` ; la bascule
`Aujourd’hui` est de nouveau pressée.
Échoue si : le bouton ne retire qu'une partie des critères, et le compteur
affiché contredit ce que l'écran montre.
Origine : ACC D13.

**ACC-REG-14 | P1 | corriger une visite : la date est montrée, jamais modifiable**
Suite sérielle de ACC-REG-03.
Gestes : rechercher son préfixe, cliquer
`Modifier la visite de E2E-ACC-REG-<RUN> Awa Diop` ; changer `DESTINATAIRES` pour
`MME. NDOYE (RESP. COMM.)` ; enregistrer.
Assertions : la ligne devient un formulaire de nom accessible
`Corriger la visite` ; `DATE VISITE` est un **texte**, pas un sélecteur
(`getByRole('button', { name: /DATE VISITE/ })` a un compte de 0 dans ce
formulaire) ; les boutons sont `Enregistrer la correction` et `Annuler` ; après
enregistrement, un toast `Visite V-…-…… corrigée.`, la ligne revient en lecture,
sa cellule `DESTINATAIRES` affiche `MME. NDOYE (RESP. COMM.)` et sa cellule
`N° REGISTRE` est inchangée.
Échoue si : la date redevient modifiable, alors que l'API refuse de déplacer une
ligne d'un jour à l'autre, et l'écran promettrait une correction impossible ; ou
la correction renvoie tous les champs et échoue dès qu'une entrée de référentiel
a été retirée depuis.
Origine : ACC D14.

**ACC-REG-15 | P2 | « Annuler » une correction ne modifie rien**
Gestes : ouvrir la correction, changer le nom, cliquer `Annuler`.
Assertions : la ligne revient en lecture avec **l'ancien** nom ; aucune requête
`PATCH /api/v1/visites/*` n'est partie.
Échoue si : le bouton enregistre au lieu d'abandonner, et une correction entamée
puis abandonnée écrase la ligne du registre.
Origine : ACC D15.

**ACC-REG-16 | P2 | le tri par colonne change l'URL et l'ordre**
Gestes : sur `Tout le registre`, cliquer l'en-tête `PRENOM ET NOMS`, puis le
recliquer.
Assertions : l'URL contient `sortBy=visitorName` et `sortDir=asc` ; l'en-tête
porte `aria-sort="ascending"` ; le second clic donne `sortDir=desc` et
`aria-sort="descending"` ; la première cellule de nom change entre les deux
états.
Échoue si : le re-tri client « le plus récent en haut » écrase le classement du
serveur sur un tri par nom, et l'écran ment sur son ordre.
Origine : ACC D16.

**ACC-REG-17 | P2 | la pagination annonce ce qu'elle montre**
Précondition : plus de 100 visites au registre (`VISITE_PAGE_SIZE = 100`). À
défaut, le scénario est déclaré **non joué** dans le retour, avec le nombre réel
constaté ; il n'est **pas** rendu vert par un `skip` silencieux (§8, **Q-06**).
Gestes : sur `Tout le registre`, lire la ligne `role="status"` de pagination,
cliquer `Page suivante`.
Assertions : la ligne contient le texte caché `Visites affichées : ` et une plage
`1–100 sur <total>` ; `Page précédente` est désactivé ; après le clic, l'URL porte
`page=2`, la plage devient `101–…` et le compteur central passe de `1 / N` à
`2 / N`.
Échoue si : la plage affichée ne correspond pas à la page servie, et l'accueil
croit avoir imprimé tout le registre alors qu'il n'en a qu'une page.
Origine : ACC D17.

**ACC-REG-18 | P3 | le bouton « Imprimer » est désactivé quand il n'y a rien à imprimer**
Gestes : se placer sur une recherche sans résultat (voir ACC-REG-02).
Assertions : le bouton `Imprimer` est désactivé (`toBeDisabled()`).
Échoue si : on peut ouvrir le dialogue d'impression sur zéro ligne et produire
une feuille vide au visiteur qui attend.
Origine : ACC D18.

#### 7.3.2 Registre, dialogue d'impression

Route : `/accueil`. Session : ACCUEIL. Fichier : `accueil-impression.spec.ts`.
Précondition commune : au moins une visite `E2E-ACC-IMP-<RUN>` créée par ce spec,
la recherche filtrée sur son préfixe.

**Avertissement d'environnement.** `window.print()` en Chromium headless ne
produit pas de boîte de dialogue et ne déclenche pas forcément `afterprint`. Les
scénarios ci-dessous n'attendent **jamais** l'événement d'impression : ils
vérifient le DOM et les media queries (§8, **Q-14**).

**ACC-IMP-01 | P2 | le dialogue s'ouvre et annonce la portée**
Gestes : cliquer `Imprimer`.
Assertions : titre `Préparer l’impression` ; description
`Les filtres et la période affichés seront conservés.` ; trois groupes de champs,
légendes `Quoi imprimer`, `Orientation`, `Colonnes` ; l'option
`La page affichée` est cochée par défaut et sa ligne secondaire annonce
`<n> visites, environ <p> pages`, où `<n>` est le nombre de lignes réellement
affichées.
Échoue si : le décompte annoncé ne correspond pas au tableau et l'utilisateur
imprime un volume qu'il n'attendait pas.
Origine : ACC E1.

**ACC-IMP-02 | P1 | les deux colonnes d'identité ne peuvent pas être décochées**
Gestes : dans le groupe `Colonnes`, tenter de décocher `DATE VISITE` puis
`PRENOM ET NOMS`, puis décocher les autres.
Assertions : les deux cases sont **désactivées** (`toBeDisabled()`) et restent
cochées ; les autres (`N° REGISTRE`, `HEURE VISITE`, `TELEPHONES`, `ENTREPRISE`,
`DIRECTION`, `DESTINATAIRES`, `OBJET VISITE`, `COMMENTAIRES / NOTES`) se
décochent.
Échoue si : `IMPRESSION_COLONNES_VERROUILLEES` est vidé, la feuille imprimée
n'identifie plus ni le jour ni la personne, et ce n'est plus un registre.
Origine : ACC E2.

**ACC-IMP-03 | P2 | décocher une colonne la retire de la feuille**
Gestes : décocher `COMMENTAIRES / NOTES`, fermer le dialogue par `Annuler`, puis
`page.emulateMedia({ media: 'print' })`.
Assertions : en média `print`, la cellule de commentaire de la ligne
`E2E-ACC-IMP-<RUN>` n'est pas visible, tandis que sa cellule `PRENOM ET NOMS`
l'est ; revenir en média `screen` les rend toutes les deux visibles.
Échoue si : la classe `print:hidden` cesse d'être posée et l'accueil imprime des
notes internes qu'il voulait masquer.
Origine : ACC E3.

**ACC-IMP-04 | P3 | l'orientation choisie est écrite dans la règle `@page`**
Gestes : choisir `Portrait`, fermer par `Annuler` ; recommencer avec `Paysage`.
Assertions : l'élément `style[media="print"]` de la page contient
`size: portrait`, puis `size: landscape`.
Échoue si : le choix d'orientation n'a aucun effet et le registre à onze colonnes
s'imprime tronqué en portrait.
Origine : ACC E4.

**ACC-IMP-05 | P2 | l'écran d'impression masque ce qui n'est pas le registre**
Gestes : `page.emulateMedia({ media: 'print' })` sur `/accueil`.
Assertions : le bouton `Ajouter une visite`, la section
`Rechercher dans le registre`, la navigation `Visites` et la colonne `CORRIGER`
ne sont pas visibles ; le tableau des visites l'est.
Échoue si : la feuille imprimée sort avec les boutons de l'interface, ce qui la
rend inutilisable comme registre papier.
Origine : ACC E5.

**ACC-IMP-06 | P2 | « Tout le résultat filtré » charge toutes les pages avant d'imprimer**
Précondition : plus de 200 lignes dans le filtre courant
(`TAILLE_PAGE_IMPRESSION = 200`). À défaut, scénario **non joué**, déclaré comme
tel avec le nombre constaté.
Gestes : choisir `Tout le résultat filtré`, cliquer `Ouvrir l’impression`.
Assertions : pendant le chargement, un `role="progressbar"` est rendu avec
`aria-valuemax` égal au nombre de pages et le texte
`Chargement des visites… page X sur Y` ; à la fin, le bloc d'impression caché
contient `Registre des visites : ` suivi du libellé de période, et autant de
lignes que le total annoncé.
Échoue si : `window.print()` est appelé avant que React ait commité le tableau
complet : la feuille ne contient alors que la page affichée, sans erreur ni
indice.
Origine : ACC E6.

**ACC-IMP-07 | P2 | au-delà de 3000 visites, l'impression totale est refusée**
Précondition : `PLAFOND_IMPRESSION_TOTALE = 3000` dépassé sur `Tout le registre`.
Sinon **non joué**, déclaré.
Assertions : l'option `Tout le résultat filtré` est désactivée ; un
`role="alert"` affiche
`<n> visites : trop pour une impression. Réduisez la période, ou exportez en Excel.`
Échoue si : le plafond saute et le navigateur se fige en chargeant quinze pages
de deux cents lignes.
Origine : ACC E7.

#### 7.3.3 Tableau de bord des visites

Route : `/accueil/tableau-de-bord`. Rôles autorisés : ADMIN, DIRECTION, ACCUEIL
(garde de page ; l'API `tableaux-de-bord` ouvre en plus au SUPERVISEUR, mais
l'écran lui est fermé). Session de travail : **ACCUEIL**, dont la disposition
n'est lue par aucune autre spec. `accessibility.spec.ts` visite cet écran en
session **ADMIN** : ne jamais enregistrer de disposition sur le compte admin.
Libellés de cet écran : « Organiser les graphiques » et
« Revenir à la disposition par défaut » (§1.9).

**ACC-TDB-01 | P1 | l'écran se charge sur le mois en cours**
Assertions : titre de niveau 1 `Tableau de bord` ; dans le groupe
`Période affichée`, le bouton `Ce mois-ci` porte `aria-pressed="true"` ; la ligne
`aria-live="polite"` affiche `Ce mois-ci` ; les boutons
`Organiser les graphiques` et `Exporter le détail` sont visibles ; aucun titre
d'erreur.
Échoue si : le préréglage par défaut change sans que le libellé annoncé suive, et
l'utilisateur lit des chiffres d'une autre période que celle qu'il croit.
Origine : ACC F1.

**ACC-TDB-02 | P2 | les six préréglages écrivent la période dans l'URL**
Gestes : table paramétrée, un `test` par bouton : `Ce mois-ci` → `periode=ce-mois`,
`Mois dernier` → `mois-dernier`, `3 derniers mois` → `trois-mois`,
`12 derniers mois` → `douze-mois`, `Cette année` → `cette-annee`,
`Année dernière` → `annee-derniere`.
Assertions : l'URL contient le paramètre attendu ; la ligne `aria-live` affiche
le libellé du bouton ; `aria-pressed` est vrai sur lui seul.
Échoue si : deux boutons produisent la même plage, ou l'URL ne suit pas et le
rechargement ramène au mois en cours.
Origine : ACC F2.

**ACC-TDB-03 | P2 | une plage libre survit au rechargement**
Gestes : ouvrir `Plage libre`, poser `Du` et `Au` sur deux dates du mois
précédent, recharger.
Assertions : l'URL contient `periode=libre&du=<iso>&au=<iso>` ; la ligne
`aria-live` affiche `<jj mmm aaaa> – <jj mmm aaaa>` en français (`dd MMM yyyy`,
locale `fr`) ; après `page.reload()`, l'URL et le libellé sont identiques.
Échoue si : la plage libre est perdue au rechargement, ou le libellé s'affiche en
anglais malgré la locale.
Origine : ACC F3.

**ACC-TDB-04 | P1 | une plage de plus de 400 jours est refusée avant l'appel**
Gestes : poser une plage libre de 500 jours.
Assertions : un `role="alert"` affiche
`Cette plage dépasse 400 jours (500 jours) : revenez à une période plus courte.` ;
**aucune** requête `GET /api/v1/visites/statistiques` n'est partie avec ces
bornes (la requête est désactivée par `enabled: !tropLarge`).
Échoue si : la garde client saute et l'API répond `VISITE_STATS_RANGE_TOO_WIDE` :
l'écran affiche une erreur brute là où il devait guider.
Origine : ACC F4.

**ACC-TDB-05 | P3 | le sélecteur de comparaison change l'URL**
Gestes : ouvrir `Comparer à`, choisir `Comparer à : période précédente`, puis
`Comparer à : rien`.
Assertions : l'URL contient `comparaison=precedente`, puis le paramètre
disparaît.
Échoue si : la comparaison n'est pas partageable par lien, ou l'option choisie
n'est pas celle affichée.
Origine : ACC F5.

**ACC-TDB-06 | P1 | le mode Organiser s'ouvre et annonce son état**
Gestes : cliquer `Organiser les graphiques`.
Assertions : le texte `Mode organisation` est rendu ; les boutons
`Ajouter un graphique`, `Quitter` et `Enregistrer` sont visibles ;
`Exporter le détail` et `Organiser les graphiques` ne le sont plus ; le bouton
`Proposer par défaut` est **absent** pour un compte ACCUEIL.
Recouvrement : `accessibility.spec.ts` entre déjà dans ce mode pour l'audit axe,
en session ADMIN. Ne pas réauditer axe ici.
Échoue si : un compte non administrateur se voit proposer de fixer la disposition
par défaut de tous les comptes.
Origine : ACC F6.

**ACC-TDB-07 | P1 | ajouter un graphique depuis le tiroir des sources**
Gestes : en mode Organiser, cliquer `Ajouter un graphique`, choisir une source
absente de la disposition, par exemple `Par heure`.
Assertions : le tiroir a pour titre `Ajouter un graphique` et pour description
`Choisissez ce que vous voulez suivre. L’image montre la forme conseillée.` ;
après le choix, le tiroir se ferme, une carte titrée `Par heure` apparaît dans la
grille et **reçoit le focus** ; le bouton `Enregistrer` est actif.
Échoue si : la source ajoutée n'est ni défilée ni focalisée et disparaît hors de
l'écran, l'utilisateur croyant que le clic n'a rien fait ; ou une source déjà
placée reste proposée, ce que l'API refuse (contrainte d'unicité des sources).
Origine : ACC F7.

**ACC-TDB-08 | P1 | la disposition enregistrée survit à un rechargement**
Suite sérielle de ACC-TDB-07.
Gestes : cliquer `Enregistrer`, puis `page.reload()`.
Assertions : le mode se ferme (`Mode organisation` a un compte de 0) ; le bouton
`Revenir à la disposition par défaut` **apparaît** ; après rechargement, la carte
`Par heure` est toujours présente ; contre-preuve par l'API :
`GET /api/v1/tableaux-de-bord/visites/disposition` renvoie `source: "utilisateur"`
et une liste de `widgets` contenant `par-heure`.
Échoue si : la disposition sauvegardée n'est pas rechargée et l'utilisateur
réorganise son écran à chaque ouverture ; ou `serializeWidget` laisse fuir la clé
cliente `id`, que `forbidNonWhitelisted` rejette en 400 silencieux.
Origine : ACC F8.

**ACC-TDB-09 | P2 | retirer un graphique et enregistrer**
Suite sérielle de ACC-TDB-08.
Gestes : rentrer en mode Organiser, cliquer `Retirer Par heure`, `Enregistrer`,
recharger.
Assertions : la carte `Par heure` disparaît ; après rechargement elle est
toujours absente ; l'API ne la renvoie plus.
Échoue si : le retrait n'est visuel que jusqu'au rechargement.
Origine : ACC F9.

**ACC-TDB-10 | P1 | quitter sans enregistrer demande confirmation et rétablit**
Gestes : entrer en mode Organiser, ajouter une source, cliquer `Quitter`,
confirmer. Contre-épreuve : entrer en mode Organiser **sans rien modifier** et
cliquer `Quitter`.
Assertions : une boîte titrée `Quitter sans enregistrer`, description
`Les changements faits dans ce mode seront perdus.`, bouton
`Quitter sans enregistrer` ; après confirmation, la grille revient à son état
antérieur ; aucun `PUT /tableaux-de-bord/visites/disposition` n'est parti. Dans
la contre-épreuve, aucune confirmation, sortie directe.
Échoue si : la confirmation s'affiche alors que rien n'a changé (elle devient un
réflexe qu'on clique sans lire), ou n'apparaît pas quand du travail serait perdu.
Origine : ACC F10.

**ACC-TDB-11 | P2 | « Revenir à la disposition par défaut » efface la sienne**
**Ce scénario est le dernier du fichier** : il remet le compte ACCUEIL dans son
état d'origine.
Gestes : cliquer `Revenir à la disposition par défaut`, recharger.
Assertions : le bouton disparaît ; l'API renvoie `source: "defaut"` ou
`"usine"` ; après rechargement, la grille correspond à cette disposition.
Échoue si : la remise à zéro ne supprime que l'affichage et la disposition
personnelle réapparaît au rechargement suivant.
Origine : ACC F11.

**ACC-TDB-12 | P2 | l'export CSV du détail produit un vrai fichier**
Gestes : cliquer `Exporter le détail` en attendant l'événement `download`.
Assertions : le nom du fichier correspond à
`/^cpi-visites-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/` ; le fichier commence
par la ligne `Visites du <du> au <au>` et contient une ligne `Total`.
Échoue si : le bouton n'attache rien, ou produit un CSV vide quand la période ne
contient aucune visite (le fichier doit exister, avec `Total,0`).
Origine : ACC F12.

**ACC-TDB-13 | P2 | « Proposer par défaut » est réservé à l'administrateur**
Gestes : en mode Organiser, compter les boutons `Proposer par défaut`.
Assertions : compte de **0**.
**Le geste lui-même n'est jamais exécuté**, à aucun rôle (§4.3.4). Le scénario
prouve seulement son absence pour un non-administrateur.
Échoue si : le bouton apparaît à un rôle non administrateur ; l'API le
refuserait, mais l'écran aurait promis un geste impossible.
Origine : ACC F13.

**ACC-TDB-14 | P3 | l'écran est utilisable en 375 px**
Gestes : `setViewportSize({ width: 375, height: 812 })`, recharger.
Assertions : chaque bouton du groupe `Période affichée` est visible (ils passent
à la ligne, ils ne sont pas coupés) ; `Organiser les graphiques` est visible et
cliquable ; aucune barre de défilement horizontale sur le document
(`document.documentElement.scrollWidth <= clientWidth`).
Échoue si : la grille déborde et une carte devient inatteignable sur le téléphone
du comptoir.
Origine : ACC F14.

#### 7.3.4 Listes du registre

Route : `/accueil/listes`. Rôles autorisés : ADMIN et DIRECTION seulement
(`LISTES_ROLES` côté API, `guardRoles(['ADMIN','DIRECTION'])` côté page).
Session de travail : **DIRECTION**. Données : une entrée par liste, code
`E2E_ACC_LST_<RUN>_<KIND>`, libellé `E2E ACC LST <RUN> …`.
Nettoyage réellement possible : **désactiver** l'entrée créée en fin de spec
(`POST /visites/referentiels/{kind}/{id}/active` avec `{ isActive: false }`) pour
qu'elle cesse de polluer les listes déroulantes des autres specs. Elle reste en
base : c'est le contrat produit.

**ACC-LST-01 | P1 | l'écran ouvre sur les entreprises**
Assertions : titre du document `Listes du registre des visites` ; texte
d'introduction
`Les quatre listes proposées à la saisie du registre. Une entrée retirée reste lisible sur les visites déjà enregistrées, et disparaît de la saisie.` ;
quatre onglets `Entreprises`, `Directions`, `Destinataires`, `Objets de visite` ;
l'onglet `Entreprises` est sélectionné ; le titre de niveau 2 est `Entreprises`
avec la description `La société ou l’organisme visité.` ; un bouton
`Nouvelle entreprise`.
Échoue si : un onglet manque, ou l'onglet par défaut change sans que l'URL le
reflète.
Origine : ACC G1.

**ACC-LST-02 | P2 | changer d'onglet écrit l'URL et accorde les libellés**
Gestes : table paramétrée sur les quatre onglets.
Assertions : `Entreprises` → aucun paramètre `onglet`, bouton
`Nouvelle entreprise` ; `Directions` → `?onglet=directions`, bouton
`Nouvelle direction`, description
`Le service concerné par la visite, quand il est connu.` ; `Destinataires` →
`?onglet=destinataires`, bouton `Nouveau destinataire`, description
`La personne demandée par le visiteur.` ; `Objets de visite` → `?onglet=objets`,
bouton `Nouvel objet`, description `Le motif de la visite.`
Échoue si : un accord de genre est faux (« Nouveau entreprise »), ou l'URL ne
suit pas l'onglet, rendant le lien impartageable.
Origine : ACC G2.

**ACC-LST-03 | P1 | créer une entrée : le code est obligatoire et normalisé**
Gestes : cliquer `Nouvelle entreprise` ; cliquer `Enregistrer` sans rien saisir ;
puis saisir le code en minuscules `e2e_acc_lst_<RUN>_ent` et le libellé
`E2E ACC LST <RUN> Entreprise`, enregistrer.
Assertions : dialogue titré `Nouvelle entreprise`, description
`Le code est définitif, utile pour l’export.` ; sur l'envoi à vide,
`Le code est obligatoire.` sous `Code` et `Le libellé est obligatoire.` sous
`Libellé`, aucune requête `POST` partie ; après l'envoi valide, toast
`E2E ACC LST <RUN> Entreprise ajouté.`, le dialogue se ferme, la ligne apparaît
avec le texte `Code E2E_ACC_LST_<RUN>_ENT` (mis en majuscules par le schéma).
Échoue si : la normalisation en majuscules disparaît et l'API refuse en 400 sur
`CODE_PATTERN`, sans que l'écran dise quoi corriger.
Origine : ACC G3.

**ACC-LST-04 | P2 | un code invalide est refusé avec sa règle**
Gestes : saisir le code `E2E-ACC` (tiret interdit), libellé valide, enregistrer.
Assertions : `Majuscules, chiffres et tirets bas seulement.`
Échoue si : la règle client s'écarte de `CODE_PATTERN` côté serveur.
Origine : ACC G4.

**ACC-LST-05 | P1 | un code déjà pris est signalé par un message, pas par un silence**
Suite sérielle de ACC-LST-03.
Gestes : recréer une entrée avec **le même code**.
Assertions : un toast d'erreur est affiché, portant le message du serveur (409
`VISITE_REFERENTIEL_CODE_CONFLICT`) ou, à défaut,
`Un enregistrement existe déjà avec ces valeurs.` ; le dialogue **reste ouvert** ;
la liste ne contient toujours qu'**une** entrée portant ce code.
Échoue si : le toast dit succès alors que l'API a répondu 409, et la Direction
croit avoir ajouté une entrée qui n'existe pas ; ou le dialogue se ferme en
effaçant la saisie.
Origine : ACC G5.

**ACC-LST-06 | P2 | renommer une entrée sans toucher au code**
Suite sérielle de ACC-LST-03.
Gestes : cliquer `Modifier E2E ACC LST <RUN> Entreprise`, renommer en
`E2E ACC LST <RUN> Entreprise bis`, enregistrer.
Assertions : titre `Renommer « E2E ACC LST <RUN> Entreprise »` ; description
`Le code reste inchangé : les visites déjà enregistrées le désignent.` ; le champ
`Code` **n'est pas rendu** (compte de 0) ; après enregistrement, toast
`E2E ACC LST <RUN> Entreprise bis enregistré.`, la ligne affiche le nouveau
libellé et **toujours** `Code E2E_ACC_LST_<RUN>_ENT`.
Échoue si : le code devient modifiable et les visites déjà enregistrées qui le
désignent perdent leur référence.
Origine : ACC G6.

**ACC-LST-07 | P2 | la recherche filtre sans accent ni casse**
Gestes : saisir `e2e acc lst <RUN>` dans le champ `Rechercher` (placeholder
`Nom ou code…`) ; puis un terme sans résultat.
Assertions : l'URL contient `recherche=…` ; la liste ne contient que les entrées
du test ; le terme sans résultat affiche
`Aucune entrée ne correspond à cette recherche.`
Échoue si : la recherche est sensible aux accents et la Direction ne retrouve pas
`FINANCE & COMPTABILITE` en tapant « comptabilité ».
Origine : ACC G7.

**ACC-LST-08 | P2 | la recherche désactive le glisser-déposer**
Gestes : avec une recherche active, viser la poignée
`Réordonner <libellé> par glisser-déposer`.
Assertions : elle est désactivée (`toBeDisabled()`).
Échoue si : on peut réordonner une liste filtrée et l'ordre enregistré ne
correspond plus à ce qu'on croyait déplacer.
Origine : ACC G8.

**ACC-LST-09 | P1 | monter et descendre une entrée au clavier**
Suite sérielle de ACC-LST-03.
Gestes : sans recherche active, relever la position de l'entrée du test, cliquer
`Monter <libellé>`, recharger, puis la redescendre.
Assertions : l'entrée est passée avant sa voisine précédente (comparaison de
l'ordre des textes de la liste `ol` avant et après) ; après `page.reload()`,
l'ordre est conservé ; l'entrée en première position a son bouton `Monter …`
désactivé, la dernière son bouton `Descendre …` désactivé.
Contrainte de données : ne déplacer **que** l'entrée du test, et la redescendre
en fin de scénario. Ne jamais déplacer une entrée `Classeur d’origine`.
Échoue si : le réordonnancement n'est pas persisté (l'API `reorder` n'est pas
appelée, ou son erreur est avalée) et la liste retrouve son ordre au
rechargement.
Origine : ACC G9.

**ACC-LST-10 | P1 | désactiver une entrée exige le décompte et le montre**
Gestes : cliquer `Désactiver <libellé du test>`, puis confirmer.
Assertions : titre `Désactiver « <libellé> » ?` ; description
`Retirée des listes de saisie. Reste disponible en filtre et en export.` ; un
encart chiffré `0 visites référencent cette entreprise.` (au singulier :
`1 visite référence cette entreprise.`) ; l'encart d'information
`Aucune visite n’est supprimée.` ; les boutons `Annuler` et `Désactiver` ; après
confirmation, toast `<libellé> désactivé.`, la ligne porte le badge `Retirée` et
son bouton d'action s'appelle désormais `Réactiver <libellé>`.
Échoue si : le décompte affiche `0` alors que l'appel a échoué (le composant doit
alors afficher `Le nombre de fiches concernées n’a pas pu être lu.` et remplacer
le bouton par `Réessayer le décompte`) : une Direction retirerait d'un clic une
entrée portée par des milliers de visites.
Origine : ACC G10.

**ACC-LST-11 | P1 | le décompte indisponible bloque la désactivation**
Gestes :
`page.route('**/api/v1/visites/referentiels/usage', route => route.abort('failed'))`,
recharger, ouvrir la désactivation d'une entrée du test.
Assertions : le `role="alert"` contient
`Le nombre de fiches concernées n’a pas pu être lu.` ; le bouton `Désactiver` a
un compte de **0** ; un bouton `Réessayer le décompte` est proposé.
Échoue si : l'écran affiche `0` par défaut quand le décompte manque, ce qui est
exactement le défaut que le commentaire du composant dit avoir corrigé.
Origine : ACC G11.

**ACC-LST-12 | P1 | une entrée retirée disparaît de la saisie mais reste lisible**
Suite sérielle de ACC-LST-10.
Gestes : aller sur `/accueil`, ouvrir `Ajouter une visite`, ouvrir le champ
`ENTREPRISE` ; puis ouvrir le filtre `ENTREPRISE` du bloc `Filtres avancés` du
registre.
Assertions : l'option `E2E ACC LST <RUN> Entreprise bis` a un compte de **0**
dans les options du formulaire de saisie. Pour le filtre : relever le
comportement réel (§8, **Q-05**), les deux composants tirant le même
`GET /visites/referentiels` avec `activeOnly=true` par défaut. Si l'entrée
disparaît aussi du filtre, c'est un écart avec la promesse du dialogue de
désactivation (« Reste disponible en filtre et en export ») : le rapporter comme
bug.
Échoue si : une entrée retirée reste proposée à la saisie ; la désactivation ne
sert alors à rien.
Origine : ACC G12.

#### 7.3.5 Import du registre

Route : `/accueil/import`. Rôles autorisés : ADMIN, DIRECTION. Session :
**DIRECTION**. `POST /visites/import` est limité à **5 dépôts par minute** : ce
fichier n'en fait pas plus de trois.

**Fabrication du classeur.** Le lecteur d'import commence à la **ligne 3**
(`FIRST_DATA_ROW = 3`) :

```
ligne 1 : les 11 en-têtes, dans l'ordre
          N° REGISTRE, DATE VISITE, HEURE VISITE, PRENOM ET NOMS, TELEPHONES,
          ENTREPRISE, DIRECTION, DESTINATAIRES, OBJET VISITE,
          COMMENTAIRES / NOTES, SAISIE LE
ligne 2 : une ligne de remplissage (le vrai export y met un rappel)
ligne 3+ : les données
```

Nom de feuille : `Registre` (motif `/^Registre/i`). `buildXlsx` (`e2e/xlsx.ts`)
suffit ; **ne pas le modifier** (§4.2.2).

**ACC-XLS-01 | P1 | l'écran présente ses quatre temps**
Assertions : titre du document `Import du registre des visites` ; cartes
`1. Exporter le registre` et `2. Déposer le classeur corrigé` ; la zone de dépôt
annonce `Glissez le classeur ici, ou choisissez un fichier` et
`Format .xlsx, 25 Mo au maximum.` ; un bouton `Exporter le registre filtré` ;
**aucune** carte `3. Analyse` ni `4. Revue` avant dépôt.
Échoue si : l'écran affiche un panneau d'analyse vide au chargement, ou perd la
promesse « rien n'est écrit tant que vous n'avez pas confirmé ».
Origine : ACC H1.

**ACC-XLS-02 | P1 | l'export filtré produit un vrai classeur**
Gestes : poser `Du` et `Au` sur le jour courant, cliquer
`Exporter le registre filtré` en attendant l'événement `download`.
Assertions : le nom du fichier correspond à
`/^cpi-registre-visites-\d{4}-\d{2}-\d{2}\.xlsx$/` ; sa taille dépasse 1 000
octets ; ses quatre premiers octets sont `50 4B 03 04` (signature ZIP) ; un toast
`Fichier généré.` est affiché.
Échoue si : un 502 relayé tel quel est téléchargé sous le nom `.xlsx`, ce que
seule la signature binaire distingue d'un vrai classeur.
Origine : ACC H2.

**ACC-XLS-03 | P2 | un fichier trop lourd est refusé avant l'envoi**
Gestes : déposer via `setInputFiles` un tampon de 26 Mo nommé `gros.xlsx`.
Assertions : un toast `Fichier trop volumineux : 25 Mo au maximum.` ; **aucune**
requête `POST /api/v1/visites/import` n'est partie.
Échoue si : le garde client saute et l'API répond 413 après un envoi de 26 Mo,
sur une connexion de comptoir.
Origine : ACC H3.

**ACC-XLS-04 | P2 | un classeur identique au registre ne propose rien à appliquer**
Précondition : au moins une visite `E2E-ACC-XLS-<RUN>` créée par appel API, puis
exportée.
Gestes : déposer le classeur exporté **sans le modifier**.
Assertions : la carte `3. Analyse · déposé le <date>` apparaît avec le badge
`Simulation` ; pendant le travail, `Lecture du fichier…` ; à la fin,
`Analyse terminée, le <date>.` ; les quatre chiffres `À créer`, `À corriger`,
`Inchangées`, `Refusées` sont rendus, avec `À créer` = 0 et `À corriger` = 0 ; le
texte `Votre classeur est identique au registre. Rien à appliquer.` est
affiché ; **aucune** carte `4. Revue`.
Échoue si : un aller-retour sans modification produit des différences, signe que
l'export et le lecteur d'import ne s'accordent pas sur un format (date, heure,
libellé), et que la Direction s'apprête à réécrire tout son registre.
Origine : ACC H4.

**ACC-XLS-05 | P1 | une création se détecte, se revoit et s'applique**
Gestes : fabriquer un classeur d'**une** ligne de données, `N° REGISTRE` vide,
date du jour, `PRENOM ET NOMS` = `E2E-ACC-XLS-<RUN> Fatou Sarr`, `ENTREPRISE` =
`CPI`, `OBJET VISITE` = `SUIVI DE DOSSIER` ; déposer ; **avant de confirmer**,
vérifier sur `/accueil` que la ligne n'existe pas encore ; revenir, cliquer le
bouton d'application, confirmer ; puis rechercher le préfixe sur `/accueil`.
Assertions : après analyse, `À créer` = 1 ; la carte `4. Revue` apparaît avec la
description `1 différence · 0 correction · 1 création` ; la ligne de revue porte
le libellé `E2E-ACC-XLS-<RUN> Fatou Sarr, <jj/mm/aaaa>`, un badge `Création`, le
texte `ligne 3` et une case **cochée** ; le bouton s'intitule
`Appliquer 1 création` ; le dialogue est titré `Appliquer 1 création ?` avec la
description `Cette action écrit les visites cochées en base et ne s’annule pas.`
et un encart `1 visite créée à partir de « <nom du fichier> ».` ; après
confirmation, toast `Application lancée. L’écran suit son avancement.` puis
l'encart de succès `1 visite créée, 0 corrigée.` ; sur `/accueil`, **une** ligne
portant ce nom et un `N° REGISTRE` non vide.
Échoue si : la simulation écrit en base, ce qui ruine la promesse centrale de
l'écran ; ou l'application ne crée rien alors que l'écran annonce un succès.
Origine : ACC H5.

**ACC-XLS-06 | P2 | une correction montre l'avant et l'après**
Suite sérielle de ACC-XLS-05.
Gestes : réexporter le registre filtré sur le préfixe du test, modifier dans le
classeur fabriqué la colonne `COMMENTAIRES / NOTES` de la ligne créée (en
conservant son `N° REGISTRE`), redéposer.
Assertions : `À corriger` = 1, `À créer` = 0 ; la ligne de revue porte le badge
`Correction` et une ligne de détail
`COMMENTAIRES / NOTES : « <avant> » → « <après> »` ; le bouton s'intitule
`Appliquer 1 correction`.
Échoue si : le différentiel affiche l'avant et l'après inversés, ou nomme une
colonne qui n'a pas changé : la Direction valide alors une correction qu'elle n'a
pas voulue.
Origine : ACC H6.

**ACC-XLS-07 | P1 | un numéro de registre inconnu est refusé, pas replié en création**
Gestes : déposer un classeur d'une ligne avec `N° REGISTRE` = `V-1999-000001`
(inexistant).
Assertions : `Refusées` = 1 et `À créer` = 0 ; le bloc `Lignes refusées` apparaît
avec le tableau `Ligne` / `Colonne` / `Motif` ; la ligne 3 y figure ; la colonne
citée est `N° REGISTRE`.
Échoue si : une coquille sur un numéro produit une visite fantôme que personne ne
cherchait.
Origine : ACC H7.

**ACC-XLS-08 | P2 | décocher une ligne change le libellé du bouton**
Gestes : sur une revue à deux différences (une création, une correction),
décocher la création, puis tout décocher.
Assertions : le bouton passe de `Appliquer 1 correction et 1 création` à
`Appliquer 1 correction` ; tout décocher donne `Rien à appliquer` et le bouton est
**désactivé**.
Échoue si : le bouton annonce un nombre qui ne correspond pas à ce qui sera
écrit ; l'écran ment sur une action irréversible.
Origine : ACC H8.

**ACC-XLS-09 | P2 | « Tout cocher » et « Tout décocher » portent sur toutes les pages**
Précondition : plus de 50 différences (`VISITES_IMPORT_REVUE_PAGE_SIZE = 50`) ;
sinon **non joué**, déclaré.
Gestes : cliquer `Tout décocher` puis `Tout cocher`.
Assertions : après « Tout décocher », le bouton d'application affiche
`Rien à appliquer` ; après « Tout cocher », il affiche le total exact des
différences ; la page 2 de la revue montre les mêmes cases que la page 1.
Échoue si : la sélection ne porte que sur la page affichée et la Direction
applique 50 lignes en croyant en appliquer 300.
Origine : ACC H9.

**ACC-XLS-10 | P3 | la revue se pagine**
Précondition : identique à ACC-XLS-09.
Gestes : cliquer `Page suivante`.
Assertions : le compteur passe de `1 / N` à `2 / N` ; `Page précédente` devient
actif ; le `role="status"` annonce `<total> différences`.
Échoue si : la pagination affiche toujours la première page et les différences
au-delà de la cinquantième sont invisibles.
Origine : ACC H10.

**ACC-XLS-11 | P3 | « Déposer un autre fichier » remet l'écran à zéro**
Gestes : après une analyse, cliquer `Déposer un autre fichier`.
Assertions : les cartes `3. Analyse` et `4. Revue` disparaissent ; le champ de
fichier reprend le focus ; les cartes 1 et 2 restent.
Échoue si : l'écran garde le travail précédent et la Direction croit analyser son
nouveau fichier alors qu'elle lit l'ancien.
Origine : ACC H11.

**ACC-XLS-12 | P2 | un dépôt refusé par le serveur le dit**
Gestes :
`page.route('**/api/v1/visites/import', route => route.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"Feuille Registre introuvable."}' }))`,
puis déposer un classeur valide.
Assertions : un toast d'erreur contenant `Feuille Registre introuvable.`, le
message du serveur et non le repli ; aucune carte `3. Analyse` n'apparaît.
Échoue si : le message du serveur est écrasé par le repli
`Le classeur n’a pas pu être déposé.` et la Direction ne sait pas quoi corriger
dans son fichier.
Origine : ACC H12.

### 7.4 Espace Projet CHUES

#### 7.4.1 `/chues`, Mon travail

Composant : `components/chues/hub-view.tsx`. Rôles autorisés : ADMIN, COMMERCIAL,
SUPERVISEUR, DIRECTION. BANQUE_FINANCE est **renvoyé** vers `/chues/banque`.

**CHU-HUB-01 | P1 | l'écran d'ouverture nomme le téléconseiller et ses trois étapes**
Route : `/chues`. Session : COMMERCIAL. Fichier :
`chues-hub.commercial.spec.ts`. Données : aucune.
Assertions : `heading` niveau 1 contenant « Projet CHUES » ; texte exact
« Bonjour Awa. Trois étapes, dans l’ordre. » ; trois `heading` niveau 2 :
« Qualifier un représentant », « Ajouter un prospect », « Convertir un
prospect » ; le titre du document correspond à `/Projet CHUES/`.
Échoue si : le prénom n'est pas extrait du nom complet (« Bonjour Awa
Fixture ») ; une étape disparaît ; l'ordre des étapes change ; ou seule la
coquille du layout est rendue sans la page.
Origine : CHU HUB-1.

**CHU-HUB-02 | P1 | chaque étape mène à sa route**
Route : `/chues`. Session : COMMERCIAL. Fichier :
`chues-hub.commercial.spec.ts`.
Gestes : cliquer « Qualifier un représentant », revenir, cliquer « Ajouter un
prospect », revenir, cliquer « Convertir un prospect ».
Assertions : les URL atteintes sont exactement `/chues/appels-representants`,
`/chues/prospects/nouveau`, `/chues/console`.
Échoue si : un geste pointe encore sur une ancienne route (`/console`,
`/appels-representants`) et n'arrive qu'après un renvoi, ou pointe sur l'étape
voisine.
Origine : CHU HUB-2.

**CHU-HUB-03 | P1 | les trois gestes sont des liens, pas des boutons**
Route : `/chues`. Session : COMMERCIAL. Fichier :
`chues-hub.commercial.spec.ts`.
Assertions : `getByRole('link', { name: 'Qualifier un représentant' })` porte un
`href` valant `/chues/appels-representants` ; idem pour les deux autres ;
`getByRole('button', { name: 'Qualifier un représentant' })` a un compte de 0.
Échoue si : une primitive Base UI repose `role="button"` sur le `<a>`, ce qui
supprime l'ouverture dans un nouvel onglet et le menu contextuel.
Origine : CHU HUB-3.

**CHU-HUB-04 | P2 | un compteur ne montre jamais un zéro provisoire**
Route : `/chues`. Session : COMMERCIAL. Fichier :
`chues-hub.commercial.spec.ts`.
Gestes : intercepter `GET /api/v1/representants**` et retarder la réponse (délai
posé sur le **réseau**, jamais un `waitForTimeout` dans le test), puis ouvrir
`/chues`.
Assertions : pendant l'attente, aucun texte `0 pas encore appelés` n'est
présent ; après réponse, la légende « pas encore appelés » est visible avec un
nombre.
Échoue si : le squelette est retiré et un `0` provisoire s'affiche, ce qui fait
fermer l'écran à un téléconseiller qui a trois cents fiches.
Origine : CHU HUB-4.

**CHU-HUB-05 | P2 | un compteur en erreur affiche un tiret, pas un zéro**
Route : `/chues`. Session : COMMERCIAL. Fichier :
`chues-hub.commercial.spec.ts`.
Gestes : intercepter `GET /api/v1/representants**` et répondre 500.
Assertions : la légende « pas encore appelés » est visible et le chiffre qui la
précède est le tiret demi-cadratin `–` ; l'écran ne rend aucun `heading`
« Serveur injoignable » ni « Chargement impossible ».
Échoue si : une erreur de compteur fait tomber tout l'écran d'ouverture, ou
affiche `0` là où la donnée est inconnue.
Origine : CHU HUB-5.

**CHU-HUB-06 | P2 | la pastille « À faire maintenant » désigne la première étape qui a du travail** · **cible mouvante**
Route : `/chues`. Session : COMMERCIAL. Fichier :
`chues-hub.commercial.spec.ts`.
Données : au moins un représentant `relationStatus = INCONNU` visible du compte.
Assertions : exactement une occurrence du texte « À faire maintenant » ; elle est
dans l'élément de liste qui contient « Qualifier un représentant ».
Échoue si : la pastille apparaît sur deux étapes à la fois, ou sur l'étape 3
alors que l'étape 1 a des fiches à appeler.
Note : `Plan.md` prévoit de **supprimer** cette pastille. Si elle a disparu, le
test est rouge et l'agent le rapporte comme « comportement retiré
volontairement, scénario à retirer », sans le supprimer lui-même.
Origine : CHU HUB-6.

**CHU-HUB-07 | P1 | un agent Banque & Finance est renvoyé, pas refusé**
Route : `/chues`. Session : BANQUE_FINANCE. Fichier :
`chues-hub.banque.spec.ts`.
Assertions : l'URL finale est `/chues/banque` ; le titre du document correspond à
`/Tableau de bord bancaire/` ; aucun `heading` « Accès refusé ».
Échoue si : le renvoi est remplacé par un refus, ce qui casse la tuile « Projet
CHUES » du hub des espaces pour ce rôle.
Origine : CHU HUB-7. Recouvrement assumé avec **ROL-25**, qui porte la même
preuve dans la matrice ; celui-ci la porte dans la coque.

**CHU-HUB-08 | P3 | l'écran tient sur 375 px**
Route : `/chues`. Session : COMMERCIAL. Fichier :
`chues-hub.commercial.spec.ts`.
Gestes : viewport 375 × 812.
Assertions : les trois `heading` niveau 2 sont visibles ; les trois liens d'étape
sont visibles et cliquables ; `document.documentElement.scrollWidth` ne dépasse
pas 375.
Échoue si : la grille `md:grid-cols-3` fuit horizontalement, ou une carte passe
sous le pli sans être atteignable.
Origine : CHU HUB-8.

#### 7.4.2 Étape 1, qualification

Route : `/chues/appels-representants`. Composant :
`components/console/rep-script.tsx`. Session : COMMERCIAL.
Données : représentants `E2E-CHUES-ET1 ` sur `+221 78 100 41 0x`, et leurs
tentatives d'appel. Ordre `serial` : la fiche créée est celle que les scénarios
suivants requalifient.

**CHU-ET1-01 | P1 | l'écran ouvre sur la recherche, focalisée, et ne choisit personne**
Données : au moins un représentant en base.
Assertions : le champ nommé « Qui avez-vous appelé ? » est visible, porte le
texte de remplacement « Chercher un représentant : nom ou numéro » et **a le
focus** ; le texte « Choisissez qui vous venez d’appeler. » est visible ; aucune
fiche n'est ouverte (aucun bouton « Copier », aucun texte « Étape 1 sur 2 »).
Échoue si : l'écran ouvre directement une fiche, ou le focus n'est pas posé et le
téléconseiller doit cliquer avant de taper.
Origine : CHU ET1-1.

**CHU-ET1-02 | P1 | la recherche par nom resserre la liste**
Données : représentant `E2E-CHUES-ET1 Awa Diop`, `+221781004101`.
Gestes : taper `E2E-CHUES-ET1 Awa` dans « Qui avez-vous appelé ? ».
Assertions : la liste (`listitem` sous la `ol`) contient exactement une entrée
portant le texte `E2E-CHUES-ET1 Awa Diop` ; le numéro affiché est
`+221 78 100 41 01` (format de `formatPhone`).
Échoue si : le débounce ne part jamais ; la recherche est faite côté client sur
une page déjà chargée ; ou le numéro est rendu brut `+221781004101`.
Origine : CHU ET1-2.

**CHU-ET1-03 | P1 | la recherche par numéro trouve la même fiche que la recherche par nom**
Gestes : taper `781004101`, relever le nom trouvé ; effacer, taper
`78 100 41 01`, relever le nom trouvé.
Assertions : les deux relevés valent `E2E-CHUES-ET1 Awa Diop` et la liste a un
seul élément dans les deux cas.
Échoue si : la recherche compare la chaîne brute au lieu des seuls chiffres, et
« 78 100 41 01 » ne trouve rien.
Origine : CHU ET1-3.

**CHU-ET1-04 | P2 | une recherche sans résultat le dit**
Gestes : taper `E2E-CHUES-ET1-INTROUVABLE-ZZZ`.
Assertions : texte exact « Aucun résultat. Vérifiez le nom ou le numéro. » ;
aucun `listitem` dans la liste.
Échoue si : l'écran laisse un squelette permanent, ou affiche la liste précédente
en gardant l'ancien résultat par `placeholderData`.
Origine : CHU ET1-4.

**CHU-ET1-05 | P1 | ouvrir une fiche montre le numéro en grand et sépare les deux étapes**
Données : `E2E-CHUES-ET1 Awa Diop`, relation `INCONNU`.
Gestes : chercher, cliquer l'entrée de liste.
Assertions : `heading` niveau 2 = `E2E-CHUES-ET1 Awa Diop` ; le numéro
`+221 78 100 41 01` est visible ; bouton « Copier » présent ; texte
« Étape 1 sur 2 · Comment s’est passé l’appel ? » ; les trois choix
« Joignable », « À rappeler », « Injoignable » sont des boutons avec
`aria-pressed="false"`.
Échoue si : la fiche s'ouvre sur l'étape 2, ou une quatrième issue (« Mauvais
numéro ») réapparaît alors que seules trois sont admises.
Origine : CHU ET1-5.

**CHU-ET1-06 | P1 | tant qu'il manque une réponse, « Continuer » est verrouillé et dit ce qui manque**
Gestes : fiche ouverte, ne rien choisir ; puis « Joignable » ; puis « Oui » ; puis
« Non » à WhatsApp ; puis saisir `77 123 45 67`.
Assertions : bouton « Continuer » désactivé, phrase « Choisissez d’abord le
résultat » visible ; après « Joignable », le bouton reste désactivé et la phrase
devient « Dites s’il est représentant CPI CHUES » ; après « Oui », « Dites s’il a
WhatsApp sur ce numéro » ; après « Non », « Écrivez le numéro WhatsApp » et le
champ « Numéro WhatsApp » apparaît ; après la saisie, « Continuer » devient
actif.
Échoue si : le verrou saute et une tentative part sans son statut de relation, ce
qu'une contrainte de base refuserait plus tard ; ou la phrase de blocage
disparaît et l'agent ne sait pas ce qui manque.
Origine : CHU ET1-6.

**CHU-ET1-07 | P1 | « À rappeler » exige une échéance et l'écrit dans le récapitulatif**
Gestes : fiche ouverte, choisir « À rappeler », choisir le premier créneau
proposé, passer à l'étape 2.
Assertions : le groupe « Quand rappeler ? » apparaît ; « Continuer » est
désactivé avec « Choisissez quand rappeler » ; après le choix il devient actif ;
à l'étape 2, la liste de définitions contient l'intitulé « Rappel » avec une
valeur non vide.
Échoue si : l'échéance devient facultative et une tentative `CALLBACK` part sans
`callbackAt`, que le serveur refuse.
Origine : CHU ET1-7.

**CHU-ET1-08 | P2 | « Choisir une date » propose un jour puis ses demi-heures**
Gestes : « À rappeler », cliquer « Choisir une date », saisir dans « Quel
jour ? » la date de demain, choisir la première heure.
Assertions : le titre « À quelle heure ? » apparaît et au moins un bouton d'heure
est proposé ; après le choix, le bouton du calendrier porte l'échéance formatée
au lieu de « Choisir une date ».
Échoue si : le champ de date accepte une date passée (`min` retiré), ou aucune
demi-heure n'est proposée pour un jour ouvré à venir.
Origine : CHU ET1-8.

**CHU-ET1-09 | P1 | l'enregistrement consigne une seule tentative et revient à la liste**
Données : `E2E-CHUES-ET1 Awa Diop` en relation `INCONNU`.
Gestes : fiche ouverte, « Joignable », « Oui », « Oui », « Continuer », écrire un
commentaire, « Enregistrer ». Compter les requêtes
`POST /api/v1/rep-campaigns/attempts` par `page.on('request')`.
Assertions : exactement **une** requête `POST` sur cette route ; retour à la
liste ; texte `role="status"` exact
« Appel enregistré pour E2E-CHUES-ET1 Awa Diop. » ; une notification `sonner`
portant la même phrase ; en relisant `GET /api/v1/representants?search=…`, la
fiche porte `relationStatus = AMBASSADEUR`.
Échoue si : chaque réponse part au fil de l'eau (plusieurs `POST`), ce qui
empêche de revenir sur une réponse ; ou le statut de relation n'est pas posé.
Origine : CHU ET1-9.

**CHU-ET1-10 | P1 | une relation déjà tranchée demande confirmation avant tout**
Données : `E2E-CHUES-ET1 Awa Diop` déjà en `AMBASSADEUR` (état laissé par
CHU-ET1-09, ou posé par l'API dans le `beforeAll`).
Gestes : chercher la fiche, cliquer ; « Revenir à la liste » ; rouvrir ;
« Continuer ».
Assertions : un `dialog` s'ouvre, titre exact « Cette personne a déjà accepté
d’être représentant CPI CHUES. », description « Voulez-vous quand même consigner
un nouvel appel ? » ; ni le nom, ni le numéro, ni la première question ne sont
visibles derrière ; « Revenir à la liste » ramène à la liste sans rien écrire ;
après « Continuer », la question « Comment s’est passé l’appel ? » s'affiche.
Échoue si : la garde est retirée et une requalification silencieuse écrase un
« oui » déjà obtenu.
Origine : CHU ET1-10.

**CHU-ET1-11 | P2 | le même dialogue pour un refus déjà enregistré**
Données : `E2E-CHUES-ET1 Ousmane Fall`, `+221781004102`, relation `REFUS`.
Assertions : titre du `dialog` exact « Cette personne a déjà refusé. ».
Échoue si : les deux cas partagent un titre générique et l'agent ne sait pas
lequel il a sous les yeux.
Origine : CHU ET1-11.

**CHU-ET1-12 | P2 | un refus permet de proposer quelqu'un d'autre, et le numéro devient obligatoire dès qu'on commence**
Gestes : fiche `INCONNU`, « Joignable » puis « Non » ; écrire seulement dans
« Son nom et prénom » ; puis écrire `77 123 45 68` dans « Son numéro ».
Assertions : le groupe « Il propose quelqu’un d’autre ? (facultatif) » apparaît
avec les champs « Son numéro », « Son nom et prénom », « Sa remarque » ;
« Continuer » est actif tant que les trois sont vides ; après la saisie du seul
nom, « Continuer » se verrouille avec « Écrivez le numéro de la personne
proposée » ; après la saisie du numéro, il redevient actif.
Échoue si : la suggestion commencée est effacée en silence à l'envoi, ou le
serveur refuse la tentative entière pour un numéro manquant sans que l'écran
l'ait dit.
Origine : CHU ET1-12.

**CHU-ET1-13 | P2 | les raccourcis clavier documentés font ce qu'ils annoncent**
Gestes : fiche ouverte, déplier `Carte clavier` ; presser `e` ; fermer ; presser
`Échap` sur l'étape 1 ; passer à l'étape 2 et presser `Échap`.
Assertions : la liste de définitions contient exactement les trois lignes `C` →
« Copier le numéro », `E` → « Corriger la fiche », `Échap` → « Revenir en
arrière » ; `e` ouvre le dialogue de correction de fiche ; `Échap` sur l'étape 1
revient à la liste ; depuis l'étape 2, `Échap` revient à l'étape 1 et non à la
liste.
Échoue si : la carte clavier annonce une touche qui n'existe plus (les flèches ou
l'espace, retirés), ou `Échap` saute l'étape intermédiaire et perd les réponses
saisies.
Origine : CHU ET1-13.

**CHU-ET1-14 | P1 | l'écran est refusé à un agent Banque & Finance**
Route : `/chues/appels-representants`. Session : BANQUE_FINANCE. Fichier :
`chues-etape1.banque.spec.ts`.
Assertions : `heading` niveau 2 « Accès refusé » ; l'alerte contient « Les appels
aux représentants est réservé à un autre rôle. » et « Banque & Finance » ; le
lien « Retour à l’accueil » porte `href="/espaces"`.
Échoue si : la garde serveur est retirée et l'écran se rend, l'API renvoyant
alors des 403 en cascade.
Origine : CHU ET1-14. Recouvrement assumé avec **ROL-21**, qui balaie la route
sans asserter le libellé « quoi ».

#### 7.4.3 Étape 2, saisie d'un prospect

Route : `/chues/prospects/nouveau`. Composant :
`components/prospects/prospect-create-form.tsx`. Session : COMMERCIAL.
Déjà couvert par `console.spec.ts` : la saisie en rafale qui garde la banque et
le syndicat, et le numéro déjà pris qui nomme la fiche existante. **Ne pas les
réécrire.**

**CHU-ET2-01 | P1 | la validation nomme chaque champ manquant**
Gestes : cliquer « Enregistrer ce prospect » sans rien saisir.
Assertions : les alertes portent exactement « Le prénom est obligatoire. »,
« Le nom est obligatoire. », « Le numéro est obligatoire. »,
« Choisissez un représentant. » ; aucune requête `POST /api/v1/prospects` n'est
partie (compter par `page.on('request')`).
Échoue si : le formulaire part quand même et le serveur rend une erreur
générique, ou une seule erreur globale remplace les quatre messages nommés.
Origine : CHU ET2-1.

**CHU-ET2-02 | P1 | un numéro invalide pour le pays choisi est refusé côté écran**
Gestes : choisir un représentant, saisir prénom et nom, saisir `123` dans
« Téléphone », enregistrer.
Assertions : alerte « Numéro invalide pour le pays choisi. » ; aucune requête
`POST /api/v1/prospects`.
Échoue si : le contrôle est retiré et un numéro inexploitable atteint la base ;
ou l'écran affiche « Le numéro est obligatoire. » pour un champ rempli.
Origine : CHU ET2-2.

**CHU-ET2-03 | P1 | l'indicatif du pays change le numéro envoyé**
Gestes : ouvrir le sélecteur nommé « Pays », choisir un pays autre que le
Sénégal, saisir un numéro local valide de ce pays, enregistrer, intercepter le
corps de `POST /api/v1/prospects`.
Assertions : le champ `phone` du corps commence par l'indicatif choisi, pas par
`+221`.
Échoue si : l'indicatif est ignoré et toute saisie est normalisée en `+221`, ce
qui crée des doublons invisibles.
Origine : CHU ET2-3.

**CHU-ET2-04 | P2 | la cascade région resserre les départements, dans le dialogue de création**
Déjà couvert par `console.spec.ts` **sur `/chues/representants`** : ne pas
dupliquer. Ce qui manque est le même resserrement dans le dialogue de création
de représentant ouvert depuis ce formulaire.
Gestes : dans le champ « Représentant », taper un nom inconnu
`E2E-CHUES-ET2 Nouveau`, cliquer la proposition de création.
Assertions : le dialogue de fiche s'ouvre avec le champ nom pré-rempli à
`E2E-CHUES-ET2 Nouveau` ; s'il porte les listes Région et Département, le choix
d'une région réduit strictement le nombre d'options de département.
Échoue si : la saisie déjà tapée est perdue à l'ouverture du dialogue, ce qui
oblige à la retaper.
Origine : CHU ET2-4.

**CHU-ET2-05 | P2 | la saisie tapée pré-remplit le bon champ selon lettres ou chiffres**
Gestes : taper `781004201` (que des chiffres) dans « Représentant », déclencher la
création ; recommencer avec `E2E-CHUES-ET2 Fatou`.
Assertions : dans le premier cas, le dialogue pré-remplit le champ **téléphone**
et laisse le nom vide ; dans le second, c'est le **nom** qui est pré-rempli et le
téléphone qui reste vide.
Échoue si : la répartition lettres/chiffres est inversée, et un numéro atterrit
dans le champ nom.
Origine : CHU ET2-5.

**CHU-ET2-06 | P2 | `Ctrl + Entrée` enregistre et enchaîne**
Données : plage `+221 78 100 42 0x` vidée en `beforeAll`.
Gestes : remplir représentant, banque, syndicat, prénom, nom, téléphone
`78 100 42 01`, presser `Control+Enter`.
Assertions : le texte d'aide « Ctrl + Entrée enregistre et enchaîne. » est visible
avant le geste ; après, le compteur passe de « Aucun prospect noté pour
l’instant. » à « 1 prospect noté pour <nom du représentant> aujourd’hui » ; les
champs prénom, nom et téléphone sont vides ; le focus est revenu sur « Prénom ».
Échoue si : le raccourci disparaît, ou il enregistre sans vider l'identité et la
fiche suivante hérite du nom précédent.
Origine : CHU ET2-6.

**CHU-ET2-07 | P2 | le lien de sortie ramène au projet**
Assertions : le lien « Terminé, revenir au projet » porte `href="/chues"` ; le
cliquer amène à `/chues`.
Échoue si : le lien pointe encore sur une route d'avant le découpage en coques.
Origine : CHU ET2-7.

**CHU-ET2-08 | P2 | `?rep=<id>` verrouille le représentant**
Données : identifiant d'un représentant `E2E-CHUES-ET2`.
Gestes : ouvrir `/chues/prospects/nouveau?rep=<id>`, enregistrer une fiche
valide.
Assertions : le champ « Représentant » n'est **pas** rendu ; le corps de
`POST /api/v1/prospects` porte `representantId` égal à l'identifiant de l'URL.
Échoue si : le paramètre est ignoré et le téléconseiller doit rechoisir le
représentant qu'il vient de quitter ; ou la fiche est rattachée au mauvais.
Origine : CHU ET2-8.

**CHU-ET2-09 | P3 | l'écran tient sur 375 px**
Gestes : viewport 375 × 812.
Assertions : les champs « Prénom », « Nom », « Téléphone » sont visibles ; le
bouton « Enregistrer ce prospect » est visible sans défilement horizontal
(`scrollWidth <= 375`).
Échoue si : la grille `sm:grid-cols-2` fuit et le bouton d'enregistrement sort de
l'écran.
Origine : CHU ET2-9.

#### 7.4.4 Étape 3, conversion · **cible mouvante**

Route : `/chues/console`. Session : COMMERCIAL. Fichier :
`chues-etape3.commercial.spec.ts`. L'écran a été vidé (§2.1). Seul CHU-ET3-01 est
écrivable aujourd'hui, et il est **attendu rouge**. Les cinq autres décrivent la
cible de `Plan.md` §4.2.3 et **ne s'écrivent qu'après livraison du lot web**.

**CHU-ET3-01 | P1 | l'écran n'est plus un talon** · **attendu rouge**
Assertions écrivables aujourd'hui : le `heading` niveau 1 de la page vaut
« Rechercher une fiche » et un lien « Ouvrir l’annuaire » pointe sur
`/chues/prospects`. Attention : la barre supérieure rend elle aussi un `h1`
(« Convertir un prospect ») ; il y a donc deux `h1` (§6.1 et §8, **Q-04**).
Assertions à terme : champ « Quel prospect avez-vous appelé ? » autofocalisé ;
sans saisie, jusqu'à vingt fiches récentes du projet CHUES.
Échoue si : rien ne change, ce qui est le résultat attendu tant que le lot n'est
pas livré ; ou si un troisième état intermédiaire apparaît.
Origine : CHU ET3-1.

**CHU-ET3-02 | P1 | `?fiche=<id>` ouvre directement la fiche visée** · **cible mouvante**
Cible : lecture par identifiant (`GET /api/v1/prospects/{id}`), plus de recherche
dans une file chargée, disparition de l'avertissement « n’est pas dans cette
file ».
Échoue si : le paramètre est ignoré, ce qui casse le seul chemin depuis
`/chues/rappels` (« Ouvrir dans la console »).
Origine : CHU ET3-2.

**CHU-ET3-03 | P1 | les issues au clavier consignent l'appel attendu** · **cible mouvante**
Cible : `1`, `2`, `3`, `9` méthode obtenue ; `5` à rappeler ; `4` injoignable ;
`6` refus ; `7` mauvais numéro ; `8` autre.
Échoue si : une touche est réaffectée et consigne une issue pour une autre.
Origine : CHU ET3-3.

**CHU-ET3-04 | P1 | après enregistrement, retour à la liste avec « Appel enregistré pour X »** · **cible mouvante**
Cible : plus de « Personne suivante », plus d'enchaînement automatique.
Échoue si : l'enchaînement automatique subsiste et l'agent perd la fiche qu'il
vient de traiter.
Origine : CHU ET3-4.

**CHU-ET3-05 | P2 | la carte clavier ne mentionne plus « ↑ ↓ » ni « Espace »** · **cible mouvante**
Échoue si : la carte annonce des touches retirées.
Origine : CHU ET3-5.

**CHU-ET3-06 | P2 | une fiche déjà close refuse un nouvel appel en le disant** · **cible mouvante**
Cible : garde `PHASE2_ALREADY_COMPLETED` rendue lisible à l'écran.
Échoue si : le refus n'est pas montré et l'agent croit avoir consigné.
Origine : CHU ET3-6.

Note pour le mainteneur : le parcours existant « la console traite un appel au
clavier, et la fiche suivante s'ouvre seule » de `console.spec.ts` porte sur
l'ancien écran et **sera rouge**. Aucun agent ne le supprime (§3.6).

#### 7.4.5 Chiffres du projet CHUES

Route : `/chues/statistiques`. Composants : `components/chiffres/vue.tsx`,
`sources.ts`, `filtres.ts`, et la grille partagée
`components/accueil/tableau-de-bord/*`. Rôles autorisés : ADMIN, SUPERVISEUR,
DIRECTION. Endpoints : `GET /api/v1/supervision/activite`,
`GET|PUT|DELETE /api/v1/tableaux-de-bord/chues/disposition`.
Libellés de cet écran : « Composer l’écran » et « Revenir à l’écran par défaut »
(§1.9).

**Tous les scénarios CHU-CHF-\* et CHU-DSP-\* sont attendus rouges** tant que la
virgule de trop de `supervision.service.ts` ligne 259 n'est pas retirée (§1.1).
C'est précisément ce qu'ils doivent prouver.

**Jeu de données des taux, calculé à la main.** Posé par
`chues-chiffres-taux.superviseur.spec.ts` et par lui seul. Journée d'observation
figée : `2026-02-03` (§8, **Q-03**). URL utilisée :
`/chues/statistiques?periode=libre&du=2026-02-03&au=2026-02-03&teleconseiller=<id de fixture.superviseur>`.

Cinq représentants créés en session ADMIN (`POST /api/v1/representants`) :

| Fiche | Nom complet | Téléphone |
| --- | --- | --- |
| R1 | `E2E-CHUES-TAUX Rep Un` | `+221781004001` |
| R2 | `E2E-CHUES-TAUX Rep Deux` | `+221781004002` |
| R3 | `E2E-CHUES-TAUX Rep Trois` | `+221781004003` |
| R4 | `E2E-CHUES-TAUX Rep Quatre` | `+221781004004` |
| R5 | `E2E-CHUES-TAUX Rep Cinq` | `+221781004005` |

Cinq tentatives envoyées **en session SUPERVISEUR** sur
`POST /api/v1/rep-campaigns/attempts`, avec des `id` UUID v7 **constants, écrits
en dur dans le spec** : le champ est la clé d'idempotence, donc une relance ne
double aucun compteur.

| Sur | `outcome` | `clientCreatedAt` | Compté |
| --- | --- | --- | --- |
| R1 | `REACHED` (+ `relationStatus: AMBASSADEUR`) | `2026-02-03T10:00:00.000Z` | oui |
| R2 | `REFUSED` (+ `relationStatus: REFUS`) | `2026-02-03T11:00:00.000Z` | oui |
| R3 | `CALLBACK` (+ `callbackAt` J+1) | `2026-02-03T12:00:00.000Z` | oui |
| R4 | `UNREACHABLE` | `2026-02-03T23:59:59.999Z` | oui, borne haute incluse |
| R5 | `UNREACHABLE` | `2026-02-04T00:00:00.000Z` | **non**, hors fenêtre |

Résultats attendus, dérivés de `supervision.service.ts` et `pilotage.sql.ts`
(`REP_LIVE_OUTCOMES = REACHED, REFUSED, CALLBACK, UNREACHABLE`,
`REP_ANSWERED_OUTCOMES = REACHED, REFUSED`, `rate(v, t) = null si t = 0, sinon
arrondi à 0,1 %`) :

| Champ | Calcul | Valeur |
| --- | --- | --- |
| `repCalls` | R1+R2+R3+R4 | 4 |
| `repReached` | R1+R2 | 2 |
| `repCallback` | R3 | 1 |
| `repUnreachable` | R4 | 1 |
| `repContactRate` | 2/4 | 50, soit « 50,0 % » |
| `repCallbackRate` | 1/4 | 25, soit « 25,0 % » |
| `repQuestioned` | représentants distincts dont la dernière réponse de la fenêtre est REACHED ou REFUSED : R1, R2 | 2 |
| `repQualified` | parmi eux, dernière réponse REACHED : R1 | 1 |
| `repQualificationRate` | 1/2 | 50, soit « 50,0 % » |
| `calls` | aucun appel de prospect ce jour-là | 0 |
| `prospectsCreated` | aucune saisie ce jour-là | 0 |
| `methodObtained` | aucune | 0 |
| `reachRate` | `rate(0, 0)` | `null`, soit « Sans objet » attendu |

Rendu attendu sur les cartes d'usine (marques de `dashboard-layout.ts`) :

| Carte | Titre affiché | Marque | Chiffre | Détail |
| --- | --- | --- | --- | --- |
| `appels-de-qualification` | « Appels aux représentants » | `tuile-courbe` | 4 | « dont 2 ont répondu » |
| `taux-de-contact` | « Représentants joints » | `tuile` | 50 | aucun (§8, **Q-01**) |
| `a-rappeler` | « Rappels promis » | `tuile` | 1 | aucun |
| `taux-de-qualification` | « Représentants qui acceptent » | `tuile` | 50 | aucun |
| `prospects-notes` | « Prospects notés » | `tuile-courbe` | 0 | « fiches saisies sur la période » |
| `adhesions` | « Adhésions obtenues » | `tuile` | 0 | aucun |
| `reste-a-appeler` | « Reste à appeler » | `tuile` | 0 | aucun (§1.8) |
| `par-teleconseiller` | « Par téléconseiller » | `tableau` | ligne « Superviseur Fixture » : 4, 2, 0, 0 | colonnes « Appels », « Joints », « Prospects notés », « Adhésions » |

La colonne « Appels » du tableau vaut `repCalls + calls` = 4 + 0 = 4 : elle
mélange volontairement les deux familles d'appels, et c'est ce contrat qu'il faut
fixer.

**CHU-CHF-01 | P1 | l'écran d'usine pose ses huit cartes pour un superviseur**
Session : SUPERVISEUR. Fichier : `chues-chiffres.superviseur.spec.ts`.
Assertions : les titres de carte exacts « Appels aux représentants »,
« Représentants joints », « Rappels promis », « Représentants qui acceptent »,
« Prospects notés », « Adhésions obtenues », « Reste à appeler », « Par
téléconseiller » sont visibles ; « Encaissé » et « De l’appel à l’encaissement »
ont un compte de 0 ; aucun `heading` « Chargement impossible », « Serveur
injoignable » ni « Accès refusé ».
Échoue si : `GET /supervision/activite` répond 500 (§1.1) ; une carte d'usine
disparaît ; ou les montants s'ouvrent à la supervision.
Origine : CHU CHF-1.

**CHU-CHF-02 | P1 | la direction voit en plus les deux cartes de montants**
Session : DIRECTION. Fichier : `chues-chiffres.direction.spec.ts`.
Assertions : en plus des huit, les titres « Encaissé » et « De l’appel à
l’encaissement » sont visibles ; le contenu de « Encaissé » contient « FCFA ».
Échoue si : la règle `VOIT_LES_MONTANTS` du contrôleur et le catalogue client
divergent, et un superviseur se voit proposer la recette.
Origine : CHU CHF-2.

**CHU-CHF-03 | P1 | l'écran est refusé à un téléconseiller**
Session : COMMERCIAL. Fichier : `chues-chiffres.commercial.spec.ts`.
Assertions : `heading` niveau 2 « Accès refusé » ; l'alerte contient « Les
chiffres du projet CHUES est réservé à un autre rôle. » et « Téléconseiller ».
Échoue si : la garde tombe et un téléconseiller lit l'activité de ses collègues.
Origine : CHU CHF-3.

**CHU-CHF-04 | P1 | l'écran est refusé à un agent Banque & Finance**
Session : BANQUE_FINANCE. Fichier : `chues-chiffres.banque.spec.ts`.
Assertions : « Accès refusé » et « Banque & Finance ».
Échoue si : la garde tombe sur un rôle qui n'a aucun périmètre CHUES commercial.
Origine : CHU CHF-4.

**CHU-CHF-05 | P1 | les six pastilles de période changent l'écran et l'URL**
Session : SUPERVISEUR. Fichier : `chues-chiffres.superviseur.spec.ts`.
Gestes : cliquer successivement « Ce mois-ci », « Mois dernier », « 3 derniers
mois », « 12 derniers mois », « Cette année », « Année dernière ».
Assertions : la pastille cliquée porte `aria-pressed="true"` et les cinq autres
`"false"` ; l'URL porte `periode=<clé>` (`ce-mois`, `mois-dernier`,
`trois-mois`, `douze-mois`, `cette-annee`, `annee-derniere`) ; la ligne
`aria-live="polite"` sous les pastilles affiche exactement le libellé cliqué.
Échoue si : la période n'entre pas dans l'URL, donc l'adresse partagée à un
collègue n'ouvre pas le même écran ; ou deux pastilles restent enfoncées.
Origine : CHU CHF-5.

**CHU-CHF-06 | P2 | la plage libre écrit ses deux bornes dans l'URL et les réaffiche**
Gestes : cliquer « Plage libre », saisir `Du` = `2026-02-01`, `Au` = `2026-02-28`.
Assertions : l'URL porte `periode=libre&du=2026-02-01&au=2026-02-28` ; la ligne
`aria-live` affiche `01 févr. 2026 – 28 févr. 2026` ; le champ `Du` porte
`max=2026-02-28` et le champ `Au` porte `min=2026-02-01`.
Échoue si : les bornes ne se contraignent pas mutuellement et une plage inversée
est acceptée ; ou l'affichage retombe sur le libellé d'un préréglage.
Origine : CHU CHF-6.

**CHU-CHF-07 | P2 | une plage de plus de 400 jours est refusée par un message, pas par un écran vide**
Gestes : ouvrir `/chues/statistiques?periode=libre&du=2024-01-01&au=2026-08-27`.
Assertions : un élément `role="alert"` contient « Cette plage dépasse 400 jours »
et le nombre de jours calculé.
Échoue si : la garde disparaît et le serveur est interrogé sur trois ans ; ou le
message n'annonce pas le seuil et l'utilisateur ne sait pas quoi raccourcir.
Origine : CHU CHF-7.

**CHU-CHF-08 | P2 | le sélecteur « Comparer à » garde ses trois choix et l'URL**
Gestes : ouvrir le `combobox` nommé « Comparer à », choisir « Comparer à :
période précédente », puis « Comparer à : rien ».
Assertions : l'URL porte `comparaison=precedente` ; le déclencheur affiche le
libellé complet et non la valeur `precedente` ; « Comparer à : rien » ne pose
aucun paramètre dans l'URL.
Échoue si : Base UI rend la valeur brute au lieu du libellé, comme il le faisait
pour le sélecteur de téléconseiller.
Origine : CHU CHF-8.

**CHU-CHF-09 | P1 | la liste des téléconseillers inclut l'encadrement et exclut la banque**
Données : les comptes de fixture existent.
Gestes : ouvrir le `combobox` nommé « Téléconseiller regardé ».
Assertions : les options contiennent « Toute l’équipe », « Awa Fixture »,
« Fatou Fixture », « Superviseur Fixture », « Direction Fixture » ; aucune option
ne porte « Moussa Fixture » (BANQUE_FINANCE) ni le nom complet du compte ADMIN.
Échoue si : la constante `TELECONSEIL_ROLES` de `supervision.service.ts` est
resserrée au seul `COMMERCIAL` et les appels passés par l'encadrement
disparaissent de l'écran ; ou un compte d'administration entre dans le plateau.
Origine : CHU CHF-9.

**CHU-CHF-10 | P1 | le sélecteur affiche le nom, jamais l'identifiant**
Gestes : ouvrir
`/chues/statistiques?teleconseiller=<id de fixture.direction>`.
Assertions : le déclencheur « Téléconseiller regardé » affiche exactement
« Direction Fixture » ; son texte ne contient aucun fragment de l'UUID (par
exemple les huit premiers caractères de l'identifiant).
Échoue si : la fonction de rendu de `SelectValue` est retirée et Base UI rend la
valeur de l'item, c'est-à-dire l'UUID en clair : régression déjà survenue, fixée
en unitaire par `vue.test.tsx`, jamais éprouvée dans un vrai navigateur.
Origine : CHU CHF-10.

**CHU-CHF-11 | P2 | sans choix, le sélecteur annonce « Toute l'équipe » et l'URL reste propre**
Gestes : ouvrir `/chues/statistiques`, choisir un téléconseiller, puis rechoisir
« Toute l’équipe ».
Assertions : au départ le déclencheur affiche « Toute l’équipe » et l'URL ne
porte pas `teleconseiller` ; après le choix, l'URL porte `teleconseiller=<uuid>` ;
après le retour, le paramètre a disparu de l'URL.
Échoue si : `tous` finit écrit dans l'URL comme un identifiant et le serveur
répond 400 sur un UUID invalide.
Origine : CHU CHF-11.

**CHU-CHF-12 | P1 | le tableau « Par téléconseiller » nomme tout le plateau, même sans acte**
Gestes : période « Ce mois-ci », sans filtre de téléconseiller.
Assertions : le tableau de la carte « Par téléconseiller » a pour en-têtes exacts
« Téléconseiller », « Appels », « Joints », « Prospects notés », « Adhésions » ;
il contient une ligne d'en-tête de rang pour « Awa Fixture », « Fatou Fixture »,
« Superviseur Fixture », « Direction Fixture » ; il ne contient pas « Moussa
Fixture ».
Échoue si : la liste est construite à partir des seules lignes d'activité au lieu
du référentiel `teleconseillers`, et un agent sans acte disparaît du tableau, ce
qui masque exactement ce qu'un superviseur cherche.
Origine : CHU CHF-12.

**CHU-CHF-13 | P1 | le taux de contact vaut exactement 50 % sur 2 joints pour 4 appels**
Session : SUPERVISEUR. Fichier : `chues-chiffres-taux.superviseur.spec.ts`.
Données : R1 à R5 et les cinq tentatives ci-dessus.
Assertions : la carte « Appels aux représentants » affiche le chiffre `4` et le
détail « dont 2 ont répondu » ; la carte « Représentants joints » affiche le
chiffre `50` ; le texte accessible de cette carte (`sr-only`) contient exactement
« 50,0 % des appels aboutissent ». Relever d'abord la réponse à **Q-01**.
Échoue si : `REP_LIVE_OUTCOMES` change et le rappel promis ou l'injoignable
sortent du dénominateur (le taux passerait à 100 % ou 66,7 %) ; un `CALLBACK` est
compté comme joint (75 %) ; la borne haute `23:59:59.999` est exclusive et R4
disparaît (4 appels deviendraient 3, taux 66,7 %) ; ou la tentative hors fenêtre
R5 est comptée (5 appels, 40 %).
Origine : CHU CHF-13.

**CHU-CHF-14 | P1 | le taux de rappel vaut exactement 25 % sur 1 rappel pour 4 appels**
Assertions : la carte « Rappels promis » affiche le chiffre `1` ; son texte
accessible contient « 25,0 % des appels ».
Échoue si : `repCallbackRate` est calculé sur les seuls appels joints (1/2 =
50 %) au lieu de tous les appels vivants.
Origine : CHU CHF-14.

**CHU-CHF-15 | P1 | le taux de qualification vaut exactement 50 % sur 1 accepté pour 2 interrogés**
Assertions : la carte « Représentants qui acceptent » affiche le chiffre `50` ;
son texte accessible contient exactement « 1 sur 2 interrogés ».
Échoue si : le dénominateur devient le nombre d'appels (1/4 = 25 %) au lieu des
représentants distincts ayant répondu ; ou le « dernier gagnant » n'est plus
appliqué et un représentant rappelé compte deux fois.
Origine : CHU CHF-15.

**CHU-CHF-16 | P1 | la ligne d'équipe du tableau porte 4, 2, 0, 0**
Assertions : dans la carte « Par téléconseiller », la ligne dont l'en-tête de
rang vaut « Superviseur Fixture » porte, dans l'ordre, les cellules `4`, `2`,
`0`, `0`.
Échoue si : la colonne « Appels » cesse de sommer `repCalls + calls` et n'affiche
plus que les appels de prospects (0) ; ou le filtre par téléconseiller ne borne
pas le tableau et d'autres lignes apparaissent.
Origine : CHU CHF-16.

**CHU-CHF-17 | P2 | une journée sans aucun appel ne se lit pas « 0 % »** · **attendu rouge**
Données : aucune tentative le `2026-02-05` pour ce compte.
Gestes : ouvrir
`/chues/statistiques?periode=libre&du=2026-02-05&au=2026-02-05&teleconseiller=<id superviseur>`.
Assertions : la carte « Représentants joints » affiche le chiffre `0` ; son texte
accessible contient « Sans objet », **pas** « 0,0 % ».
Échoue si : le repli `valeur ?? 0` de `scalaireTaux` masque le `null` du serveur
et « personne appelé » devient indistinguable de « personne joint », ce que le
contrat de `SupervisionActivityCountsDto` interdit explicitement.
Note : à la lecture, le texte accessible rend bien « Sans objet » mais le chiffre
affiché reste `0` (§1.7, §8 **Q-02**). C'est le défaut à rapporter.
Origine : CHU CHF-17.

**CHU-CHF-18 | P2 | le filtre par téléconseiller borne réellement les chiffres**
Gestes : sur la même journée `2026-02-03`, comparer l'écran filtré sur
`fixture.superviseur` et l'écran filtré sur `fixture.awa`.
Assertions : filtré sur `fixture.awa`, la carte « Appels aux représentants »
affiche `0` et le tableau « Par téléconseiller » ne contient qu'une ligne, celle
d'« Awa Fixture ».
Échoue si : `commercialId` n'est pas transmis, ou n'est appliqué qu'aux lignes et
pas aux totaux, et les chiffres d'un agent portent le travail de l'équipe.
Origine : CHU CHF-18.

**CHU-CHF-19 | P2 | un rechargement complet rend exactement le même écran**
Gestes : ouvrir l'URL du jeu de données, relever le chiffre des quatre cartes de
taux, `page.reload()`.
Assertions : l'URL est inchangée ; les quatre chiffres relevés sont identiques.
Échoue si : les filtres ne vivent pas dans l'URL et un rechargement retombe sur
« Ce mois-ci » et « Toute l'équipe ».
Origine : CHU CHF-19.

**CHU-CHF-20 | P2 | l'écran en erreur propose de réessayer, il ne reste pas blanc**
Session : SUPERVISEUR. Fichier : `chues-chiffres.superviseur.spec.ts`.
Gestes : intercepter `GET /api/v1/supervision/activite**` et répondre 500, ouvrir
`/chues/statistiques` ; puis lever l'interception et cliquer « Réessayer ».
Assertions : un `heading` parmi « Chargement impossible » ou « Serveur
injoignable » est visible, avec le texte de repli « Les chiffres n’ont pas pu
être calculés. Réessayez. » et un bouton « Réessayer » ; après le clic, les
cartes s'affichent.
Échoue si : l'erreur laisse un squelette permanent, ou le bouton « Réessayer » ne
relance ni les requêtes de jeux ni celle de disposition.
Origine : CHU CHF-20.

**CHU-CHF-21 | P3 | l'écran tient sur 375 px**
Gestes : viewport 375 × 812.
Assertions : les huit titres de carte sont atteignables ; le tableau « Par
téléconseiller » défile horizontalement dans son propre conteneur, la page non
(`document.documentElement.scrollWidth <= 375`).
Échoue si : le tableau d'équipe pousse la page entière et rend la navigation
impossible au pouce.
Origine : CHU CHF-21.

#### 7.4.6 Mode de composition et disposition sauvegardée, côté CHUES

Fichier : `chues-disposition.superviseur.spec.ts`, `serial`, sauf CHU-DSP-02.
Entrée du mode : **« Composer l’écran »**. Retour : **« Revenir à l’écran par
défaut »**.

**CHU-DSP-01 | P1 | « Composer l'écran » ouvre le mode et le nomme**
Session : SUPERVISEUR.
Assertions : le texte « Mode organisation » est visible ; les boutons « Ajouter
un graphique », « Quitter » et « Enregistrer » sont visibles ; le bouton
« Composer l’écran » a disparu ; « Proposer par défaut » a un compte de 0 pour un
SUPERVISEUR.
Échoue si : « Proposer par défaut » s'ouvre à un non-ADMIN et un superviseur
impose sa disposition à toute l'entreprise.
Origine : CHU DSP-1.

**CHU-DSP-02 | P1 | « Proposer par défaut » n'existe que pour l'ADMIN et demande confirmation**
Session : ADMIN. Fichier : `chues-disposition.spec.ts`.
Gestes : « Composer l’écran », cliquer « Proposer par défaut », **fermer sans
confirmer**.
Assertions : un `dialog` titré « Fixer la disposition par défaut », description
« Les comptes qui n’ont rien enregistré verront cette organisation. », bouton de
confirmation « Proposer par défaut ».
Contrainte : ce scénario **ne confirme jamais**. Aucun agent n'appelle
`PUT …/disposition/par-defaut` (§4.3.4).
Échoue si : la confirmation saute et un clic accidentel change l'écran de tous
les comptes.
Origine : CHU DSP-2.

**CHU-DSP-03 | P1 | retirer une carte, enregistrer, recharger : elle reste absente**
Gestes : « Composer l’écran », cliquer « Retirer Reste à appeler »,
« Enregistrer », attendre la fin du
`PUT /api/v1/tableaux-de-bord/chues/disposition`, puis `page.reload()`.
Assertions : après l'enregistrement, le mode est refermé (« Composer l’écran » de
nouveau visible) ; le titre « Reste à appeler » a un compte de 0 ; après le
rechargement complet, il a toujours un compte de 0 ; le bouton « Revenir à
l’écran par défaut » est désormais visible (la disposition est
`source: 'utilisateur'`).
Échoue si : la disposition n'est pas persistée et la carte revient après
rechargement ; ou elle est persistée mais l'écran ne la relit pas et affiche
encore l'usine.
Origine : CHU DSP-3.

**CHU-DSP-04 | P1 | ajouter une carte depuis le tiroir**
Gestes : mode composition, cliquer « Ajouter un graphique », choisir « Reste à
appeler », « Enregistrer ».
Assertions : le tiroir est titré « Ajouter un graphique » avec la description
« Choisissez ce que vous voulez suivre. L’image montre la forme conseillée. » ; il
propose « Reste à appeler » (retirée en CHU-DSP-03) et **ne propose pas** une
carte déjà posée, par exemple « Prospects notés » ; après le choix, le tiroir se
ferme et la carte réapparaît dans la grille.
Échoue si : le tiroir propose une source déjà placée et l'enregistrement crée un
doublon que le serveur déduplique en silence.
Origine : CHU DSP-4.

**CHU-DSP-05 | P2 | le tiroir dit quand tout est placé**
Gestes : mode composition avec toutes les sources posées.
Assertions : le tiroir affiche « Toutes les sources sont déjà placées. » et aucune
vignette de choix.
Échoue si : le tiroir s'ouvre vide sans rien dire, et l'utilisateur croit qu'il
est cassé.
Origine : CHU DSP-5.

**CHU-DSP-06 | P1 | l'ordre se change au clavier, sans glisser-déposer, et il est sauvegardé**
Gestes : mode composition ; relever l'ordre des titres de carte ; cliquer le
bouton nommé « Descendre Appels aux représentants » ; « Enregistrer » ;
`page.reload()`.
Assertions : après le clic, la première carte n'est plus « Appels aux
représentants » ; le bouton « Monter » de la première carte de la grille est
désactivé et le bouton « Descendre » de la dernière l'est aussi ; après le
rechargement, l'ordre relevé est identique à celui d'après le clic.
Échoue si : le réordonnancement n'est possible qu'à la souris, ce qui exclut le
clavier ; ou l'ordre n'est pas sérialisé et revient à l'usine après un
rechargement.
Origine : CHU DSP-6.

**CHU-DSP-07 | P2 | la marque d'une carte se change et survit au rechargement**
Gestes : mode composition, cliquer « Changer la présentation de Représentants
joints », choisir « Jauge », « Enregistrer », `page.reload()`.
Assertions : la carte « Représentants joints » rend un graphique de jauge et non
la tuile ; après rechargement, c'est toujours le cas.
Échoue si : `sanitize` du serveur retombe sur la marque d'usine parce que la
marque choisie n'est pas dans `compatibles`, et le choix de l'utilisateur
disparaît sans message.
Origine : CHU DSP-7.

**CHU-DSP-08 | P1 | « Revenir à l'écran par défaut » efface la disposition personnelle**
**Ce scénario est le nettoyage du fichier : il reste le dernier.**
Gestes : cliquer « Revenir à l’écran par défaut », attendre le
`DELETE /api/v1/tableaux-de-bord/chues/disposition`, `page.reload()`.
Assertions : les huit cartes d'usine sont de nouveau présentes dans l'ordre
d'usine (« Appels aux représentants » en tête, « Par téléconseiller » en queue) ;
le bouton « Revenir à l’écran par défaut » a disparu (la source est redevenue
`usine` ou `defaut`).
Échoue si : la remise à zéro laisse la disposition personnelle en base et l'écran
ne change pas ; ou elle efface aussi la disposition **par défaut** de
l'entreprise.
Origine : CHU DSP-8.

**CHU-DSP-09 | P2 | « Quitter » avec des changements demande confirmation**
Gestes : mode composition, retirer une carte, cliquer « Quitter », confirmer.
Assertions : un `dialog` titré « Quitter sans enregistrer », description
« Les changements faits dans ce mode seront perdus. », bouton « Quitter sans
enregistrer » ; après confirmation, la carte retirée est de nouveau là.
Échoue si : la confirmation ne s'affiche pas et une composition longue est perdue
d'un clic ; ou elle s'affiche même sans changement.
Origine : CHU DSP-9.

**CHU-DSP-10 | P2 | « Quitter » sans changement ne demande rien**
Gestes : mode composition, ne rien modifier, cliquer « Quitter ».
Assertions : aucun `dialog` n'apparaît ; le bouton « Composer l’écran » est de
nouveau visible.
Échoue si : la détection de modification compare des objets par référence et juge
tout écran modifié.
Origine : CHU DSP-10.

**CHU-DSP-11 | P2 | la disposition est propre à chaque compte**
Gestes : en SUPERVISEUR, retirer « Adhésions obtenues » et enregistrer ; dans un
contexte séparé porteur de l'état DIRECTION (aucune connexion supplémentaire,
les deux états sont sur disque), ouvrir `/chues/statistiques`.
Assertions : chez la DIRECTION, la carte « Adhésions obtenues » est **toujours
présente**.
Nettoyage : remettre la disposition du SUPERVISEUR à l'usine en fin de test par
« Revenir à l’écran par défaut », geste utilisateur et non appel d'API.
Échoue si : la disposition est enregistrée globalement au lieu d'être rattachée
au compte, et un superviseur modifie l'écran de la direction.
Origine : CHU DSP-11.

**CHU-DSP-12 | P2 | la disposition est propre à chaque écran**
Gestes : en SUPERVISEUR, retirer une carte sur `/chues/statistiques`,
enregistrer, puis ouvrir `/grand-public/statistiques` (**lecture seule**, aucune
modification).
Assertions : l'écran Grand Public garde ses cartes d'usine (`prospects-notes`,
`adhesions`, `reste-a-appeler`, `par-teleconseiller`) ; la carte retirée côté
CHUES n'existe de toute façon pas là-bas.
Échoue si : le segment `ecran` du chemin est ignoré et les deux écrans partagent
une disposition.
Origine : CHU DSP-12.

#### 7.4.7 Ancienne route de tableau de bord

**CHU-TDB-01 | P2 | les anciennes adresses hors coque arrivent aussi**
Routes : `/tableau-de-bord` puis `/statistiques`. Session : SUPERVISEUR.
Fichier : `chues-chiffres.superviseur.spec.ts`.
Assertions : les deux atterrissent sous `/chues/statistiques` ou
`/accueil/tableau-de-bord` selon la table de renvois, sans page « Page
introuvable ».
Échoue si : l'attrape-tout de renvoi est cassé pour ces deux racines.
Note : la table complète est déjà fixée en unitaire
(`src/app/moved-routes.test.ts`) et son câblage par `e2e/redirections.spec.ts`.
Ne pas balayer les dix-sept racines ici.
Origine : CHU TDB-2. Le renvoi `/chues/tableau-de-bord` lui-même est porté par
**ROL-26**.

#### 7.4.8 Supervision, pilotage

Route : `/chues/supervision`. Composants : `supervision-tabs.tsx`,
`activity-view.tsx`, `supervision-view.tsx`. Même endpoint cassé qu'au §7.4.5 :
**scénarios attendus rouges** (§1.1).

**CHU-SUP-01 | P1 | les deux volets existent et l'onglet vit dans l'URL**
Session : SUPERVISEUR. Fichier : `chues-supervision.superviseur.spec.ts`.
Gestes : ouvrir `/chues/supervision`, cliquer « Comptes », recharger.
Assertions : deux `tab` nommés « Activité » et « Comptes » ; « Activité » est
sélectionné par défaut et l'URL ne porte pas `volet` ; le clic pose
`volet=comptes` dans l'URL ; le rechargement garde « Comptes » sélectionné.
Échoue si : l'onglet n'est pas dans l'URL et un lien partagé ouvre toujours le
mauvais volet ; ou les deux volets sont montés en même temps et le volet Comptes
se rafraîchit en boucle derrière l'Activité.
Origine : CHU SUP-1.

**CHU-SUP-02 | P1 | le tableau d'activité porte ses neuf colonnes**
Assertions : les en-têtes de colonne exactes « Appels », « Méthodes »,
« NRP / injoignables », « Faux numéros », « Refus », « À rappeler »,
« Joignabilité », « Prospects saisis », « Représentants contactés » sont
présentes ; les colonnes « Tâches closes » et « Reste à faire » ont un compte
de 0 (retirées par le chantier en cours).
Échoue si : une colonne de campagne réapparaît alors que les tâches n'existent
plus, ou une colonne d'appel disparaît.
Origine : CHU SUP-2.

**CHU-SUP-03 | P2 | les trois périodes changent la requête**
Gestes : cliquer « Aujourd’hui », « Cette semaine », « 7 derniers jours »
(libellés de `PERIOD_LABELS`, à relire dans `lib/data/admin.ts` ; §8, **Q-17**).
Assertions : la pastille cliquée porte `aria-pressed="true"` ; la requête
`GET /api/v1/supervision/activite` repart avec de nouvelles bornes `actFrom` et
`actTo` (interception).
Échoue si : la clé de cache n'inclut pas la plage et l'écran affiche les chiffres
de la période précédente.
Origine : CHU SUP-3.

**CHU-SUP-04 | P2 | le tri par colonne bascule et se voit**
Gestes : cliquer l'en-tête « Appels » deux fois, en relevant les noms de lignes
avant et après.
Assertions : le premier clic trie en décroissant, le second en croissant ;
l'ordre des lignes s'inverse effectivement.
Échoue si : le tri est purement décoratif et l'ordre des lignes ne change pas.
Origine : CHU SUP-4.

**CHU-SUP-05 | P2 | l'export CSV produit un vrai fichier**
Gestes : cliquer le bouton de téléchargement du volet Activité.
Assertions : `download.suggestedFilename()` correspond à
`/^cpi-supervision-activite-\d{4}-\d{2}-\d{2}(_\d{4}-\d{2}-\d{2})?\.csv$/` ; le
fichier fait plus de 100 octets ; sa première ligne contient les mêmes intitulés
de colonne que le tableau.
Échoue si : le fichier téléchargé est une réponse JSON d'erreur renommée en
`.csv`, ou ses colonnes ont dérivé de celles de l'écran.
Origine : CHU SUP-5.

**CHU-SUP-06 | P2 | sans aucun compte de plateau, l'écran le dit**
Gestes : intercepter `GET /api/v1/supervision/activite**` et répondre un corps
valide avec `items: []` et `teleconseillers: []`.
Assertions : texte exact « Aucun compte téléconseiller. Créez-en un depuis les
comptes. ».
Échoue si : un tableau vide sans message laisse croire à un écran cassé.
Origine : CHU SUP-6.

**CHU-SUP-07 | P2 | le volet Comptes montre la présence**
Gestes : onglet « Comptes ».
Assertions : le texte « Présence et dernière activité des comptes. » est visible ;
les sections vides annoncent « Aucun compte téléconseiller. » et « Aucun compte
au pôle Banque & Finance. » quand elles le sont.
Échoue si : le volet est monté vide sans message d'état.
Origine : CHU SUP-7.

**CHU-SUP-08 | P1 | l'écran est refusé à un téléconseiller**
Session : COMMERCIAL. Fichier : `chues-supervision.commercial.spec.ts`.
Assertions : « Accès refusé » et l'alerte contient « La supervision est réservé à
un autre rôle. » et « Téléconseiller ».
Échoue si : un téléconseiller lit l'activité nominative de ses collègues.
Origine : CHU SUP-8. Recouvrement assumé avec **ROL-19** : ne pas dupliquer la
boucle, ce scénario y ajoute le libellé de l'écran refusé.

#### 7.4.9 Rappels promis

Route : `/chues/rappels`. Composant : `components/rappels/rappels-view.tsx`.
Données : `E2E-CHUES-RAP `, plage `+221 78 100 46 0x`.

**CHU-RAP-01 | P1 | les trois onglets et le compteur de retards**
Session : COMMERCIAL. Fichier : `chues-rappels.commercial.spec.ts`.
Assertions : trois `tab` nommés « En retard », « Aujourd’hui », « Cette
semaine » ; une région `role="status"` affiche un nombre suivi de « rappel en
retard » ou « rappels en retard » ; l'accord du pluriel est correct pour le
nombre affiché.
Échoue si : le compteur se lit « 1 rappels » ou « 2 rappel », ou la région n'est
pas annoncée.
Origine : CHU RAP-1.

**CHU-RAP-02 | P1 | un rappel promis apparaît dans « Cette semaine »**
Données : une fiche `E2E-CHUES-RAP` avec un rappel posé à J+1, via l'étape 1 ou
`POST /api/v1/rep-campaigns/attempts`.
Assertions : une seule `row` contient le numéro de la fiche ; les colonnes
attendues sont « Prospect », « Échéance », « Retard », « Commentaire »,
« Téléconseiller » (ce dernier seulement pour un rôle qui peut filtrer), et une
colonne d'actions dont l'intitulé est masqué (`sr-only` « Actions »).
Échoue si : la file des rappels n'inclut pas les rappels du projet CHUES, ou la
colonne « Téléconseiller » apparaît pour un COMMERCIAL, qui ne doit voir que les
siens.
Origine : CHU RAP-2.

**CHU-RAP-03 | P1 | un rappel à l'heure n'est pas marqué en retard**
Assertions : sur la ligne d'un rappel à venir, la cellule « Retard » affiche
exactement « Sans objet » et non un badge rouge.
Échoue si : `overdue` est calculé sur l'horloge du navigateur au lieu du
`serverTime` renvoyé, et un décalage de fuseau marque en retard un rappel
d'aujourd'hui.
Origine : CHU RAP-3.

**CHU-RAP-04 | P1 | « Ouvrir dans la console » ouvre bien la fiche** · **attendu rouge**
Gestes : cliquer « Ouvrir dans la console » sur une ligne.
Assertions : l'URL contient `fiche=<id du prospect>` **et** l'écran d'arrivée
ouvre cette fiche (nom du prospect visible).
Échoue si : l'écran d'arrivée est le talon actuel « Rechercher une fiche », qui
ignore `?fiche=` : le seul chemin de la file des rappels vers la consignation est
alors rompu (§2.1).
Origine : CHU RAP-4.

**CHU-RAP-05 | P2 | « Annuler » retire le rappel et le dit**
Gestes : cliquer « Annuler » sur une ligne posée par ce spec.
Assertions : une notification « Rappel annulé. » apparaît ; la ligne disparaît de
l'onglet courant après invalidation, sans rechargement manuel.
Contrainte : n'annuler que les rappels posés par ce spec sur ses propres fiches.
Échoue si : l'annulation aboutit côté serveur mais la liste n'est pas invalidée,
et l'agent annule deux fois.
Origine : CHU RAP-5.

**CHU-RAP-06 | P2 | l'état vide de chaque onglet a son propre texte**
Données : un compte sans aucun rappel, ou interception rendant `items: []`.
Assertions : onglet « En retard » → « Aucun rappel en retard » ; « Aujourd’hui »
→ « Aucun rappel aujourd’hui » ; « Cette semaine » → « Aucun rappel cette
semaine ».
Échoue si : les trois onglets partagent un état vide générique et l'agent ne sait
pas lequel il regarde.
Origine : CHU RAP-6.

**CHU-RAP-07 | P2 | le filtre par téléconseiller n'existe que pour l'encadrement**
Sessions : COMMERCIAL puis SUPERVISEUR. Fichiers :
`chues-rappels.superviseur.spec.ts` porte l'assertion SUPERVISEUR ;
`chues-rappels.commercial.spec.ts` porte l'assertion COMMERCIAL. Les deux agents
écrivent chacun la moitié qui relève de leur session.
Assertions : en COMMERCIAL, aucun champ nommé « Téléconseiller » et aucune
colonne « Téléconseiller » ; en SUPERVISEUR, le champ existe avec le texte de
remplacement « Tous les téléconseillers » et la colonne apparaît.
Échoue si : un téléconseiller peut filtrer sur ses collègues, ou l'encadrement
perd le filtre dont il vit.
Origine : CHU RAP-7. Voir aussi §8, **Q-19**.

**CHU-RAP-08 | P3 | la copie de l'état vide ne parle plus d'une touche qui n'existe plus** · **attendu rouge**
Assertions : le texte de l'état vide de « Aujourd’hui » ne contient pas
« touche 5 » si l'étape 3 n'a plus de raccourci numéroté.
Échoue si : la copie promet un geste que l'écran ne propose plus.
Note : à la lecture, ce texte dit encore « Une échéance se promet depuis la
console d’appel : touche 5, puis le chiffre de l’heure. ». Attendu rouge jusqu'à
la livraison du lot console (§2.2).
Origine : CHU RAP-8.

#### 7.4.10 Représentants, liste et fiche

Routes : `/chues/representants`, `/chues/representants/[id]`. Données :
`E2E-CHUES-REP `, plage `+221 78 100 43 0x`.

**CHU-REP-01 | P1 | la liste se rend avec sa recherche et son décompte**
Session : COMMERCIAL. Fichier : `chues-representants.commercial.spec.ts`.
Assertions : `heading` niveau 1 « Représentants » ; un champ nommé
« Recherche » ; une région `role="status"` portant un décompte ou « Aucun
résultat ».
Échoue si : le décompte est absent et l'utilisateur ne sait pas si le filtre a
rendu zéro ligne ou si la page n'a pas chargé.
Origine : CHU REP-1.

**CHU-REP-02 | P1 | la recherche filtre par nom et par numéro**
Données : `E2E-CHUES-REP Mariama Sy`, `+221781004301`.
Gestes : saisir `E2E-CHUES-REP Mariama` puis `781004301`.
Assertions : dans les deux cas, une seule ligne contenant ce nom, comptée dans
`getByRole('table')` (§1.13).
Échoue si : la recherche par chiffres n'atteint pas le téléphone normalisé.
Origine : CHU REP-2.

**CHU-REP-03 | P2 | la cascade région et département vit bien sur la route de coque** · **déjà couvert**
Déjà couvert par `console.spec.ts` (« la cascade région resserre la liste des
départements »). **Ne pas réécrire.** Ce document demande seulement de vérifier
que la cascade est bien atteinte sur `/chues/representants` et non sur l'ancienne
route `/representants` : si `console.spec.ts` navigue encore vers
`/representants`, il passe par un renvoi.
Échoue si : le parcours existant ne teste plus la route réellement servie aux
utilisateurs, et une régression de la route de coque passe inaperçue.
Consigne : à signaler au mainteneur, jamais à corriger.
Origine : CHU REP-3.

**CHU-REP-04 | P2 | un filtre sans résultat le dit avec les bons mots**
Gestes : saisir `E2E-CHUES-REP-INTROUVABLE`.
Assertions : texte exact « Aucun représentant ne correspond à ces critères. », et
non « Aucun représentant enregistré. », réservé à la base vide.
Échoue si : les deux états vides sont confondus, et l'utilisateur croit la base
vide alors que son filtre est trop étroit.
Origine : CHU REP-4.

**CHU-REP-05 | P2 | la pagination avance et recule**
Données : plus d'une page de représentants.
Gestes : cliquer « Page suivante » puis « Page précédente ».
Assertions : le décompte `role="status"` change entre les deux pages ; le bouton
« Page précédente » est désactivé sur la première page.
Échoue si : les deux boutons restent actifs en butée et un clic sort de la plage.
Origine : CHU REP-5.

**CHU-REP-06 | P2 | un rôle en lecture seule ne voit aucun geste d'écriture**
Session : SUPERVISEUR. Fichier : `chues-representants.superviseur.spec.ts`.
Assertions : aucun bouton dont le nom commence par « Modifier la fiche de » ;
aucun bouton de création de représentant.
Échoue si : l'écran propose un geste que l'API refusera, ce qui est un défaut de
conception assumé comme tel dans le dépôt.
Origine : CHU REP-6.

**CHU-REP-07 | P2 | l'export du registre produit un vrai classeur**
Session : ADMIN. Fichier : `chues-representants.spec.ts`.
Gestes : déclencher l'export depuis `/chues/representants`.
Assertions : le fichier téléchargé commence par la signature ZIP `50 4B 03 04` et
pèse plus de 1 000 octets.
Échoue si : un 502 relayé tel quel est enregistré sous une extension `.xlsx`.
Origine : CHU REP-7.

**CHU-REPD-01 | P1 | la fiche s'ouvre depuis la liste et porte son histoire**
Session : COMMERCIAL. Fichier : `chues-representants.commercial.spec.ts`.
Gestes : depuis `/chues/representants`, cliquer le lien du nom d'une fiche
`E2E-CHUES-REP`.
Assertions : l'URL correspond à `/chues/representants/<uuid>` ; le texte
« Histoire de la relation » est visible.
Échoue si : le lien de la ligne pointe encore sur `/representants/<id>` et
n'arrive qu'après un renvoi ; ou la fiche rend une coquille sans son historique.
Origine : CHU REPD-1.

**CHU-REPD-02 | P2 | une fiche sans prospect le dit**
Données : `E2E-CHUES-REP Sans Prospect`, sans aucune fiche rattachée.
Assertions : le texte « Aucune fiche remise pour l’instant. » est visible.
Échoue si : la section reste vide sans message et l'agent croit à un défaut de
chargement.
Origine : CHU REPD-2.

**CHU-REPD-03 | P2 | une relation jamais tranchée le dit aussi**
Assertions : le texte « Aucune bascule enregistrée. » est visible sur une fiche
en `INCONNU`.
Échoue si : l'historique vide se lit comme un historique perdu.
Origine : CHU REPD-3.

**CHU-REPD-04 | P2 | un identifiant inconnu rend une page introuvable, pas une erreur serveur**
Gestes : ouvrir `/chues/representants/00000000-0000-7000-8000-000000000000`.
Assertions : la page « Page introuvable » est rendue, ou un état d'erreur
explicite ; aucune exception non rattrapée dans la console du navigateur
(`page.on('pageerror')` ne relève rien).
Échoue si : `unstable_rethrow` laisse passer une erreur de préchargement et la
route rend une page blanche.
Origine : CHU REPD-4.

**CHU-REPD-05 | P3 | la fiche tient sur 375 px**
Assertions : le nom, le numéro et la section « Histoire de la relation » sont
visibles sans défilement horizontal de la page.
Échoue si : la chronologie déborde à droite.
Origine : CHU REPD-5.

#### 7.4.11 Import Excel des représentants

Route : `/chues/representants/import`. ADMIN seulement.
**Déjà couvert par `e2e/representants-import.spec.ts`** : téléchargement du
modèle, simulation puis application, redépôt sans doublon. **Ne réécrire aucun
des trois.**

**CHU-IMP-01 | P1 | l'écran est refusé à tout rôle autre qu'ADMIN**
Sessions : COMMERCIAL, SUPERVISEUR, DIRECTION, BANQUE_FINANCE, un `test` par
rôle. Fichier : `chues-import.roles.spec.ts`.
Assertions : chacune rend « Accès refusé » ; l'alerte contient « L’import de
représentants est réservé à un autre rôle. » et le libellé du rôle en cours
(« Téléconseiller », « Supervision », « Direction », « Banque & Finance »).
Échoue si : la garde `guardRoles(['ADMIN'])` s'élargit et un superviseur écrit en
masse dans le registre.
Origine : CHU IMP-1. `roles.anon.spec.ts` couvre déjà le refus pour
BANQUE_FINANCE et COMMERCIAL ; ce scénario ajoute SUPERVISEUR et DIRECTION.

**CHU-IMP-02 | P2 | un fichier qui n'est pas un classeur est refusé avec un motif**
Session : ADMIN. Fichier : `chues-import.spec.ts`.
Gestes : déposer un fichier `.txt` renommé `.xlsx` contenant du texte.
Assertions : un message d'erreur nommé apparaît ; le cadran « Lignes lues »
n'apparaît pas ; aucune fiche n'est créée (recompte par l'API).
Échoue si : le lecteur plante sans message, ou compte des lignes fantômes.
Origine : CHU IMP-2.

**CHU-IMP-03 | P2 | un classeur sans aucune ligne de données rend un rapport à zéro**
Gestes : déposer un classeur ne contenant que la ligne d'en-têtes et la ligne
d'exemple.
Assertions : « Lignes lues » vaut `0` ; le bouton d'application affiche
« Créer 0 représentant » et est désactivé.
Échoue si : le bouton disparaît et l'écran semble cassé, ou l'application part
sur zéro ligne.
Origine : CHU IMP-3.

**CHU-IMP-04 | P2 | un nom avec caractères spéciaux survit à l'aller-retour**
Gestes : déposer un classeur avec `E2E-CHUES-IMP Ndèye Coumba N’Diaye-Sy`,
appliquer, puis chercher ce nom dans `/chues/representants`.
Assertions : la fiche trouvée porte exactement ce nom, apostrophe et accents
compris.
Échoue si : l'encodage du classeur ou la normalisation serveur ampute
l'apostrophe ou les accents.
Origine : CHU IMP-4.

**CHU-IMP-05 | P3 | l'écran d'import tient sur 375 px**
Assertions : la zone de dépôt et le bouton « Télécharger le modèle Excel » sont
visibles sans défilement horizontal.
Échoue si : le tableau du rapport pousse la page.
Origine : CHU IMP-5.

#### 7.4.12 Prospects CHUES, liste

Route : `/chues/prospects`. **Déjà couvert** : `prospects.spec.ts` (filtrage par
statut, URL, rechargement, export xlsx) et `workspaces.spec.ts` (filtres de
conversion, double export, colonnes de conversion). **Ne pas réécrire.**

**CHU-PRO-01 | P1 | l'écran est borné au projet CHUES**
Session : COMMERCIAL. Fichier : `chues-prospects.commercial.spec.ts`.
Gestes : intercepter `GET /api/v1/prospects**`.
Assertions : la requête porte `projet=CHUES` ; aucune fiche Grand Public
n'apparaît (vérifier par une fiche Grand Public connue si l'environnement en a
une ; sinon l'assertion porte sur le paramètre de requête seul).
Échoue si : la ligne `filters.projet = 'CHUES'` de la page saute et les deux
projets se mélangent dans une même liste.
Origine : CHU PRO-1.

**CHU-PRO-02 | P1 | un téléconseiller ne voit que son périmètre** · **bloqué**
Données : une fiche `E2E-CHUES-PRO` créée par `fixture.awa`.
Session : `fixture.fatou`. Fichier : `chues-prospects.commercial2.spec.ts`.
Assertions : la ligne n'apparaît pas ; le décompte affiche « Aucun résultat ».
Échoue si : `scope.ts` cesse de borner la liste et un téléconseiller lit le
portefeuille d'un collègue.
Contrainte : ce scénario exige un septième état de session (§3.2). Tant qu'il
n'est pas posé, l'agent le déclare non écrit et **ne se connecte pas lui-même**.
Origine : CHU PRO-2.

**CHU-PRO-03 | P2 | un rôle en lecture seule n'a ni fusion, ni réaffectation, ni suppression**
Session : SUPERVISEUR. Fichier : `chues-prospects.superviseur.spec.ts`.
Assertions : aucun bouton de fusion, de réaffectation ou de suppression n'est
rendu ; l'export reste proposé.
Échoue si : l'écran propose un geste que l'API refuse.
Origine : CHU PRO-3.

**CHU-PRO-04 | P2 | une recherche sans résultat le dit et n'efface pas les filtres**
Gestes : filtrer sur un statut, puis chercher `E2E-CHUES-PRO-INTROUVABLE`.
Assertions : le décompte annonce zéro ; l'URL garde le paramètre de statut ; le
tableau n'affiche pas les lignes de la recherche précédente.
Échoue si : `keepPreviousData` laisse l'ancien tableau et l'utilisateur croit que
son filtre n'a rien changé.
Origine : CHU PRO-4.

**CHU-PRO-05 | P2 | un caractère spécial dans la recherche ne casse pas l'URL**
Gestes : chercher `N'Diaye & Cie / 100 %`, recharger.
Assertions : l'URL porte la valeur encodée ; le rechargement restitue le même
terme dans le champ de recherche.
Échoue si : l'encodage est perdu et le rechargement rend une recherche tronquée,
ou l'application rend une erreur de routage.
Origine : CHU PRO-5.

**CHU-PRO-06 | P2 | l'export suit le filtre affiché**
Gestes : filtrer sur `segment=BDD1`, exporter la vue filtrée, relever la taille du
fichier ; retirer le filtre, réexporter.
Assertions : les deux fichiers sont de vrais classeurs (signature ZIP) et leurs
tailles diffèrent.
Échoue si : l'export ignore les filtres et rend toujours la base entière, ce que
`prospects.spec.ts` ne prouve pas puisqu'il n'exporte qu'une seule fois.
Origine : CHU PRO-6.

**CHU-PRO-07 | P2 | une grande volumétrie n'écroule pas l'écran**
Données : au moins deux cents prospects CHUES en base (§8, **Q-07**). À défaut,
scénario **non joué**, déclaré avec le nombre constaté.
Gestes : ouvrir `/chues/prospects?pageSize=100`.
Assertions : le tableau est rendu dans le délai d'attente par défaut ; le
décompte est cohérent avec le nombre de lignes affichées.
Échoue si : la pagination est ignorée et le navigateur rend des milliers de
lignes.
Origine : CHU PRO-7.

**CHU-PRO-08 | P3 | le tableau reste utilisable sur 375 px**
Assertions : le décompte et au moins la colonne du nom sont visibles ; le
défilement horizontal est confiné au tableau.
Échoue si : la page entière défile latéralement.
Origine : CHU PRO-8.

#### 7.4.13 Contacts recommandés

Route : `/chues/suggestions`. Données : `E2E-CHUES-SUG `, plage
`+221 78 100 45 0x`. Ordre `serial`.

**CHU-SUG-01 | P1 | l'écran explique d'où viennent les numéros**
Session : COMMERCIAL. Fichier : `chues-suggestions.commercial.spec.ts`.
Assertions : texte exact « Numéros donnés par un représentant qui décline, pour
qu’un collègue soit appelé à sa place. » ; un groupe nommé « Filtrer par statut »
avec au moins le bouton « Tous ».
Échoue si : la phrase d'explication disparaît et l'écran devient une liste sans
contexte.
Origine : CHU SUG-1.

**CHU-SUG-02 | P1 | une suggestion posée à l'étape 1 arrive ici**
Données : représentant `E2E-CHUES-SUG Refus`, `+221781004501` ; une tentative
`REFUSED` portant `suggestedPhone = 77 123 45 90` et
`suggestedName = E2E-CHUES-SUG Contact`.
Assertions : une carte de la liste « Numéros suggérés » porte le numéro formaté
`+221 77 123 45 90` et le nom `E2E-CHUES-SUG Contact` ; elle mentionne « Donné
par le représentant » suivi du code court de la fiche source, et « recueilli
par » suivi du nom du compte qui a consigné.
Échoue si : la suggestion est perdue à l'envoi de la tentative, ou la provenance
n'est pas rendue et l'écran ne dit plus qui a proposé qui.
Origine : CHU SUG-2.

**CHU-SUG-03 | P2 | marquer appelé change le statut et le dit**
Gestes : sur la carte du spec, cliquer « Marquer appelé ».
Assertions : notification « Numéro marqué « Appelé ». » (libellé exact issu de
`SUGGESTION_STATUS_LABELS`, à relire dans `lib/data/suggestions.ts` ; §8,
**Q-18**) ; la carte porte désormais le badge du nouveau statut ; les boutons
« Marquer appelé » et « Abandonner » ont disparu de cette carte.
Échoue si : le statut est écrit côté serveur mais la liste n'est pas invalidée,
et l'agent rejoue le geste.
Origine : CHU SUG-3.

**CHU-SUG-04 | P2 | chaque filtre a son propre état vide**
Gestes : choisir un statut sans aucune suggestion.
Assertions : texte `Aucun numéro « <libellé du statut> ».` et la phrase « Retirez
le filtre pour voir les autres numéros. » ; sans filtre et sans donnée, le texte
est « Aucun numéro suggéré pour l’instant. » avec la phrase d'explication qui
nomme la console d'appel et le mobile.
Échoue si : les deux états vides sont confondus.
Origine : CHU SUG-4.

**CHU-SUG-05 | P2 | « Créer la fiche » pré-remplit avec le numéro suggéré**
Gestes : cliquer « Créer la fiche » sur la carte du spec. **Ne pas confirmer la
création.**
Assertions : le dialogue de fiche représentant s'ouvre avec le nom et le numéro
de la suggestion déjà saisis.
Contrainte : n'utiliser que des suggestions dont le nom porte déjà
`E2E-CHUES-SUG`, faute de quoi une fiche créée sortirait du préfixe du spec.
Échoue si : le pré-remplissage est perdu, ce qui oblige à recopier le numéro à la
main.
Origine : CHU SUG-5.

**CHU-SUG-06 | P2 | un rôle en lecture seule ne voit aucun geste**
Session : SUPERVISEUR. Fichier : `chues-suggestions.superviseur.spec.ts`.
Assertions : aucun bouton « Marquer appelé », « Abandonner » ni « Créer la
fiche » ; les cartes restent lisibles.
Échoue si : `readsOnly` cesse d'être appliqué et l'écran propose un geste refusé
par l'API.
Origine : CHU SUG-6.

#### 7.4.14 Dossiers bancaires

Routes : `/chues/dossiers`, `/chues/dossiers/nouveau`, `/chues/dossiers/[id]`,
`/chues/dossiers/etapes`, `/chues/dossiers/export`.
**Déjà couvert par `workspaces.spec.ts`** : la liste et ses vues rapides avec
export, la recherche de client et l'ouverture d'un dossier, la référence
dupliquée signalée au flou, le cycle jusqu'à l'encaissement, le rejet motivé, le
motif « Autre » exigeant une précision, et les butées du réordonnancement
d'étapes. **Ne pas réécrire ces points.**
Données : référence `E2E-CHUES-DOS-<horodatage>`, sur le client bancaire
`+221781001000` en lecture seule côté prospect.

**CHU-DOS-01 | P1 | l'écran est refusé à un téléconseiller et à la supervision**
Sessions : COMMERCIAL puis SUPERVISEUR. Fichier :
`chues-dossiers.roles.spec.ts`.
Assertions : « Accès refusé » et l'alerte contient « Le suivi des dossiers
bancaires est réservé à un autre rôle. ».
Échoue si : la garde `['ADMIN', 'BANQUE_FINANCE']` s'élargit et un téléconseiller
lit les montants encaissés.
Origine : CHU DOS-1.

**CHU-DOS-02 | P1 | un agent bancaire voit la liste**
Session : BANQUE_FINANCE. Fichier : `chues-dossiers.banque.spec.ts`.
Assertions : `heading` niveau 1 « Dossiers bancaires » ; une région
`role="status"` portant « Dossiers affichés » ou « Aucun résultat ».
Échoue si : le rôle propriétaire de l'écran s'en voit refuser l'accès.
Origine : CHU DOS-2.

**CHU-DOS-03 | P2 | les deux états vides sont distincts**
Gestes : filtrer sur un critère sans résultat.
Assertions : texte « Aucun dossier ne correspond à ces filtres », et non « Aucun
dossier bancaire », réservé à la liste totalement vide.
Échoue si : les deux se confondent et l'agent croit la base vide.
Origine : CHU DOS-3.

**CHU-DOS-04 | P2 | les vues rapides vivent dans l'URL et survivent au rechargement**
Gestes : cliquer « Encaissés » puis recharger.
Assertions : l'URL porte `stageType=CASHED` avant et après le rechargement ; le
décompte est identique.
Échoue si : la vue rapide n'est qu'un état local et le lien partagé n'ouvre pas
la même liste. Le parcours existant vérifie l'URL mais **pas** le rechargement.
Origine : CHU DOS-4.

**CHU-DOS-05 | P2 | la pagination**
Gestes : « Page suivante » puis « Page précédente ».
Assertions : le décompte change ; « Page précédente » est désactivé en première
page.
Échoue si : la butée n'est pas gardée et un clic sort de la plage.
Origine : CHU DOS-5.

**CHU-DOS-06 | P3 | la liste tient sur 375 px**
Assertions : le décompte et la référence du premier dossier sont visibles sans
défilement horizontal de la page.
Échoue si : le tableau pousse la page.
Origine : CHU DOS-6.

**CHU-DOSN-01 | P1 | seules les fiches « méthode obtenue » sont proposées**
Données : un prospect `E2E-CHUES-PRO` en statut `PENDING`.
Gestes : session BANQUE_FINANCE, `/chues/dossiers/nouveau`, chercher ce prospect
par son numéro.
Assertions : le texte « Aucun client ne correspond. » est visible ; aucun bouton
de résultat portant le numéro cherché.
Échoue si : le filtre de statut saute et un dossier s'ouvre sur une fiche qui n'a
pas encore adhéré, ce qui ne se découvre qu'à l'encaissement.
Origine : CHU DOSN-1.

**CHU-DOSN-02 | P1 | l'ouverture exige une référence bancaire**
Gestes : choisir un client éligible, laisser « Référence bancaire » vide, cliquer
« Ouvrir le dossier ».
Assertions : le dossier n'est pas créé (l'URL reste `/chues/dossiers/nouveau`) ;
un message nomme le champ manquant.
Échoue si : un dossier sans référence atteint la base et devient introuvable pour
la banque.
Origine : CHU DOSN-2.

**CHU-DOSN-03 | P2 | la recherche par nom et par numéro donne le même client**
Gestes : chercher le client éligible par son numéro `+221781001000` puis par son
nom.
Assertions : les deux recherches proposent la même fiche (même texte de
résultat).
Échoue si : la répartition nom/téléphone selon la proportion de chiffres du terme
est cassée, piège déjà rencontré et documenté dans `workspaces.spec.ts`.
Origine : CHU DOSN-3.

**CHU-DOSN-04 | P2 | le contrôle de doublon part au flou, pas à la frappe**
Gestes : saisir une référence existante caractère par caractère, sans quitter le
champ, puis quitter le champ.
Assertions : aucune alerte « existe déjà » tant que le champ garde le focus ; elle
apparaît après le `blur`.
Échoue si : le contrôle part à chaque frappe et sature l'API, limitée à 300
requêtes par minute.
Origine : CHU DOSN-4.

**CHU-DOSN-05 | P2 | un caractère spécial dans la référence est accepté ou refusé, jamais ignoré**
Gestes : saisir `E2E-CHUES-DOS/2026-#1`.
Assertions : soit le dossier est créé et la référence est rendue à l'identique
sur le détail, soit un message nomme le caractère refusé.
Échoue si : la référence est tronquée en silence et la banque ne retrouve pas son
dossier.
Origine : CHU DOSN-5.

**CHU-DOSD-01 | P1 | un montant à zéro est refusé**
Gestes : sur un dossier ouvert par ce spec, « Déclarer l’encaissement », saisir
`0`.
Assertions : le bouton « Confirmer l’encaissement » reste désactivé.
Échoue si : un encaissement à zéro est accepté et fausse la recette.
Origine : CHU DOSD-1. Voir §8, **Q-20**.

**CHU-DOSD-02 | P1 | un montant non numérique ou négatif est refusé**
Gestes : saisir `abc` puis `-5000` dans « Montant encaissé ».
Assertions : le bouton de confirmation reste désactivé dans les deux cas.
Échoue si : un montant négatif atteint la base.
Origine : CHU DOSD-2.

**CHU-DOSD-03 | P2 | un très gros montant reste lisible**
Gestes : saisir `999999999999`.
Assertions : l'aperçu `role="status"` affiche le montant groupé et l'unité
« FCFA » ; il ne déborde pas de la boîte de dialogue à 375 px.
Échoue si : le regroupement des milliers est perdu et « 12000000 » se confond
avec « 1200000 », défaut que l'aperçu existe précisément pour éviter.
Origine : CHU DOSD-3.

**CHU-DOSD-04 | P1 | un dossier encaissé ne propose plus aucun geste**
Gestes : mener un dossier jusqu'à l'encaissement.
Assertions : « Étape terminale » visible ; les boutons « Rejeter le dossier »,
« Déclarer l’encaissement » et tout bouton commençant par « Passer à » ont un
compte de 0.
Échoue si : le verrou saute et un dossier terminal est rouvert, ce qui fausse
l'historique.
Origine : CHU DOSD-4.

**CHU-DOSD-05 | P2 | un rechargement rend le même état**
Gestes : après une transition, `page.reload()`.
Assertions : l'étape courante affichée est la même ; l'historique porte le même
nombre d'entrées.
Échoue si : l'état n'est qu'en mémoire et un rechargement rend un dossier à
l'étape précédente.
Origine : CHU DOSD-5.

**CHU-DOSD-06 | P2 | un identifiant inconnu ne rend pas une page blanche**
Gestes : ouvrir `/chues/dossiers/00000000-0000-7000-8000-000000000000`.
Assertions : page « Page introuvable » ou état d'erreur nommé ; aucun
`pageerror`.
Échoue si : le préchargement lève une erreur non rattrapée.
Origine : CHU DOSD-6.

**CHU-DOSD-07 | P2 | une transition concurrente est refusée proprement**
Gestes : ouvrir le même dossier dans deux onglets du **même** contexte, avancer
d'une étape dans l'onglet A, puis avancer dans l'onglet B qui affiche encore
l'ancienne étape.
Assertions : l'onglet B rend un message d'erreur nommé et ne saute pas deux
étapes ; après rechargement, le dossier est à l'étape suivant A d'un seul cran.
Échoue si : la concurrence fait sauter deux étapes ou écrase la première
transition.
Origine : CHU DOSD-7. Voir §8, **Q-21**.

**CHU-DOSE-01 | P1 | le réordonnancement des étapes est possible au clavier seul**
Session : ADMIN. Fichier : `chues-dossiers-etapes.spec.ts`.
Gestes : atteindre par `Tab` le bouton « Descendre « … » » d'une étape
modifiable, l'actionner par `Entrée`, puis **remettre l'ordre initial par le
geste inverse avant de finir** : le référentiel des étapes est partagé.
Assertions : l'ordre des éléments de liste change ; l'étape déplacée porte le
focus après le geste.
Échoue si : le geste n'existe qu'à la souris ; ou le focus est renvoyé en tête de
liste et l'utilisateur au clavier doit tout retraverser à chaque déplacement.
Origine : CHU DOSE-1.

**CHU-DOSE-02 | P1 | l'écran est refusé à un agent bancaire**
Session : BANQUE_FINANCE. Fichier : `chues-dossiers.roles.spec.ts`.
Assertions : « Accès refusé » et l'alerte contient « La configuration du flux
bancaire est réservé à un autre rôle. ».
Échoue si : une banque réordonne le flux de toutes les banques.
Origine : CHU DOSE-2.

**CHU-DOSE-03 | P2 | la butée haute et la butée basse sont gardées**
Assertions : le bouton « Monter » de la première étape modifiable est désactivé
et le bouton « Descendre » de la dernière l'est aussi.
Échoue si : le clic en butée envoie une requête que l'API refuse.
Origine : CHU DOSE-3.

**CHU-DOSE-04 | P3 | l'écran tient sur 375 px**
Assertions : les boutons de déplacement restent atteignables au pouce (hauteur
minimale de 44 px).
Échoue si : les boutons se chevauchent sur petit écran.
Origine : CHU DOSE-4.

**CHU-DOSX-01 | P1 | l'export des dossiers produit un vrai classeur**
Session : BANQUE_FINANCE. Fichier : `chues-dossiers.banque.spec.ts`.
Gestes : depuis `/chues/dossiers/export`, déclencher l'export.
Assertions : le fichier commence par `50 4B 03 04` et pèse plus de 1 000 octets ;
le nom du fichier est daté.
Échoue si : un JSON d'erreur est relayé sous l'extension `.xlsx`.
Origine : CHU DOSX-1.

**CHU-DOSX-02 | P2 | l'écran annonce le périmètre de l'export**
Gestes : ouvrir l'écran sans aucun filtre.
Assertions : texte exact « Aucun filtre : tous les dossiers. ».
Échoue si : l'utilisateur exporte la base entière en croyant exporter sa vue.
Origine : CHU DOSX-2.

**CHU-DOSX-03 | P2 | l'export est refusé à un téléconseiller**
Session : COMMERCIAL. Fichier : `chues-dossiers.roles.spec.ts`.
Assertions : « Accès refusé » et « L’export des dossiers bancaires est réservé à
un autre rôle. ».
Échoue si : la garde s'élargit et un téléconseiller exporte les montants.
Origine : CHU DOSX-3.

#### 7.4.15 Tableau de bord bancaire

Route : `/chues/banque`. **Déjà couvert par `workspaces.spec.ts`** : présence de
« Taux de rejet », « Délai moyen », « Dossiers par étape », montants en FCFA,
sous session ADMIN. **Ne pas réécrire.**

**CHU-BQ-01 | P1 | un agent bancaire y atterrit et le titre du document le confirme**
Session : BANQUE_FINANCE. Fichier : `chues-banque.banque.spec.ts`.
Assertions : le titre du document correspond à `/Tableau de bord bancaire/` ;
« Taux de rejet » et « Délai moyen » sont visibles ; aucun état d'erreur.
Échoue si : l'écran d'atterrissage du rôle rend un refus ou une coquille vide, ce
que le seul titre de niveau 1, dérivé de la route, ne prouverait pas.
Origine : CHU BQ-1.

**CHU-BQ-02 | P2 | chaque graphique a son état vide nommé**
Gestes : filtrer sur une période sans dossier.
Assertions : les messages exacts « Aucun dossier rejeté sur la période
filtrée. », « Aucune activité d’agent sur la période filtrée. », « Aucun dossier
clos. » apparaissent selon le graphique.
Échoue si : un graphique vide se rend comme un canevas blanc et se lit comme une
panne.
Origine : CHU BQ-2.

**CHU-BQ-03 | P2 | un montant nul se lit « 0 FCFA », jamais vide**
Assertions : la tuile de montant affiche « 0 FCFA » et non une chaîne vide.
Échoue si : le repli de `MoneyText` est retiré et un montant absent devient
indistinguable d'un écran qui n'a pas chargé.
Origine : CHU BQ-3.

**CHU-BQ-04 | P2 | l'écran est refusé à un téléconseiller et à la supervision**
Sessions : COMMERCIAL et SUPERVISEUR. Fichier : `chues-dossiers.roles.spec.ts`.
Assertions : « Accès refusé » et « Le tableau de bord bancaire est réservé à un
autre rôle. ».
Échoue si : la garde `['ADMIN', 'BANQUE_FINANCE']` s'élargit.
Origine : CHU BQ-4.

**CHU-BQ-05 | P3 | l'écran tient sur 375 px**
Assertions : les trois indicateurs de tête sont visibles ; aucun défilement
horizontal de la page.
Échoue si : la grille de graphiques déborde.
Origine : CHU BQ-5.

#### 7.4.16 Demandes de création de client

Route : `/chues/demandes-clients`. **Déjà couvert par `workspaces.spec.ts`** : le
parcours complet dépôt bancaire, arbitrage administrateur, prospect créé avec
provenance, retour côté banque. **Ne pas réécrire ce parcours.**
Données : `E2E-CHUES-DMC `, plage `+221 78 100 49 0x`.

**CHU-DMC-01 | P1 | les deux rôles voient deux titres différents**
Sessions : BANQUE_FINANCE puis ADMIN, deux contextes dans un seul test, aucune
connexion supplémentaire. Fichier : `chues-demandes.banque.spec.ts`.
Assertions : en BANQUE_FINANCE, `heading` niveau 1 « Mes demandes de création » ;
en ADMIN, « Créations de client à valider ».
Échoue si : les deux rôles partagent un titre et l'agent bancaire croit pouvoir
arbitrer.
Origine : CHU DMC-1.

**CHU-DMC-02 | P1 | l'écran est refusé à un téléconseiller, à la supervision et à la direction**
Sessions : COMMERCIAL, SUPERVISEUR, DIRECTION. Fichier :
`chues-dossiers.roles.spec.ts`.
Assertions : « Accès refusé » et « Le suivi des demandes de création est réservé à
un autre rôle. ».
Échoue si : la garde `['ADMIN', 'BANQUE_FINANCE']` s'élargit.
Origine : CHU DMC-2.

**CHU-DMC-03 | P1 | le dépôt refuse une demande incomplète**
Session : BANQUE_FINANCE. Fichier : `chues-demandes.banque.spec.ts`.
Gestes : depuis `/chues/dossiers/nouveau`, chercher un nom inconnu, « Demander la
création du client », laisser le téléphone vide, tenter d'envoyer.
Assertions : le bouton « Envoyer la demande » est désactivé, ou l'envoi rend un
message nommant le champ manquant ; aucune demande n'apparaît ensuite dans
« Mes demandes de création ».
Échoue si : une demande sans numéro atteint l'arbitrage et l'administration ne
peut rien en faire.
Origine : CHU DMC-3.

**CHU-DMC-04 | P2 | le refus d'une demande est motivé et visible des deux côtés**
Données : une demande `E2E-CHUES-DMC ` déposée par ce spec.
Gestes : en session ADMIN (second contexte), refuser la demande avec un motif ;
puis en session BANQUE_FINANCE, ouvrir « Mes demandes de création », onglet des
refusées.
Assertions : la carte porte le motif saisi ; l'agent bancaire ne voit aucun
bouton d'arbitrage.
Échoue si : le motif n'est pas transmis et la banque redépose la même demande.
Origine : CHU DMC-4.

**CHU-DMC-05 | P2 | l'état vide de chaque filtre**
Session : ADMIN. Fichier : `chues-demandes.spec.ts`.
Assertions : sans aucune demande, « Aucune demande en attente » ; avec un filtre
sans résultat, « Aucune demande ne correspond à ces filtres ».
Échoue si : les deux se confondent et l'administrateur croit la file vide alors
que son filtre est trop étroit.
Origine : CHU DMC-5.

**CHU-DMC-06 | P2 | la pagination et le décompte**
Assertions : la région `role="status"` porte le texte masqué « Demandes
affichées : » suivi d'un nombre ; les boutons « Page précédente » et « Page
suivante » sont gardés en butée.
Échoue si : le décompte est absent et l'utilisateur ne sait pas s'il voit tout.
Origine : CHU DMC-6.

#### 7.4.17 Lots d'export · **cible mouvante**

Routes : `/chues/campagnes`, `/chues/campagnes/[id]`. Les composants actuels
(`components/lots-export/*`) sont provisoires ; `Plan.md` §4.2.4 décrit la cible.
**Seuls CHU-LOT-01 et CHU-LOT-02 s'écrivent aujourd'hui** ; les sept autres
attendent la livraison du lot web (§2.3).

**CHU-LOT-01 | P1 | la route rend la liste des lots et non l'ancien écran de campagnes**
Session : ADMIN. Fichier : `chues-lots-export.spec.ts`.
Assertions : `heading` niveau 1 « Lots d’export » ; sous-titre « Fiches figées
pour Excel, impression ou terrain. » ; aucun texte « Distribuer les appels aux
téléconseillers », « Répartition en tourniquet » ni « Lancer la campagne ».
Échoue si : la migration est partiellement déployée et l'ancien écran revient sur
une route ; ou l'entrée de menu « Lots d’export » mène encore à une campagne.
Origine : CHU LOT-1.

**CHU-LOT-02 | P1 | l'écran est refusé à un téléconseiller et à un agent bancaire**
Sessions : COMMERCIAL et BANQUE_FINANCE. Fichier :
`chues-lots-export.roles.spec.ts`.
Assertions : la page actuelle fait `redirect('/chues')` au lieu de rendre
`PermissionDenied` : l'URL finale est `/chues` pour un COMMERCIAL, et
`/chues/banque` pour un agent bancaire (double renvoi).
Échoue si : un rôle non autorisé atteint la liste des lots, ou le renvoi boucle.
Origine : CHU LOT-2. Recouvrement assumé avec **ROL-27**, qui fige le même renvoi
dans la matrice.

**CHU-LOT-03 | P1 | la création annonce le nombre de fiches avant de créer** · **cible mouvante**
Cible `Plan.md` : « 340 fiches seront exportées », donné par
`GET /api/v1/lots-export/apercu`, jamais estimé localement.
Échoue si : l'aperçu est calculé côté client et diverge du tirage réel ; ou le lot
est créé sans que l'utilisateur ait vu ce qu'il fige.
Origine : CHU LOT-3.

**CHU-LOT-04 | P1 | un nom de moins de trois caractères est refusé** · **cible mouvante**
Échoue si : un lot sans nom utilisable est créé et devient introuvable.
Origine : CHU LOT-4.

**CHU-LOT-05 | P1 | le classeur Excel du lot est un vrai classeur** · **cible mouvante**
Cible : `GET /api/v1/lots-export/{id}/export.xlsx`. Assertions : signature ZIP
`50 4B 03 04`, taille supérieure à 1 000 octets, nom de fichier daté.
Échoue si : un JSON d'erreur est relayé sous l'extension `.xlsx`, seul défaut que
la taille et le nom ne révèlent pas.
Note : aujourd'hui le lien porte un `href` et non un bouton de téléchargement ;
`waitForEvent('download')` peut ne pas se déclencher si le serveur ne pose pas
`Content-Disposition` (§8, **Q-22**).
Origine : CHU LOT-5.

**CHU-LOT-06 | P1 | l'archive ZIP des fiches PDF est une vraie archive** · **cible mouvante**
Cible : `GET /api/v1/lots-export/{id}/fiches.zip`. Assertions : signature ZIP ;
plus d'un fichier à l'intérieur si le lot compte plus d'une fiche.
Échoue si : l'archive est vide, ou contient un seul PDF pour un lot de 340
fiches.
Origine : CHU LOT-6.

**CHU-LOT-07 | P2 | une fiche PDF isolée est un vrai PDF** · **cible mouvante**
Cible : `GET /api/v1/lots-export/{id}/fiches/{itemId}.pdf`. Assertions : les
quatre premiers octets valent `%PDF`.
Échoue si : la route rend du HTML d'erreur.
Origine : CHU LOT-7.

**CHU-LOT-08 | P2 | le suivi compte les appels postérieurs à la création** · **cible mouvante**
Cible : « 128 appels sur 340 fiches » ; un appel antérieur à la création ou
portant sur une fiche hors lot ne compte pas.
Données à poser : créer le lot, consigner un appel sur une fiche du lot, relire
le détail.
Échoue si : `callsSince` compte tous les appels de la base, ce qui rend le
chiffre inutile.
Origine : CHU LOT-8.

**CHU-LOT-09 | P2 | le lot est figé : une fiche créée après lui n'y entre pas** · **cible mouvante**
Données : créer un lot sur un périmètre, puis créer une fiche `E2E-CHUES-LOT `
dans ce périmètre, puis rouvrir le détail.
Assertions : `itemCount` est inchangé ; la nouvelle fiche n'est pas dans le
classeur exporté.
Échoue si : le lot est recalculé à chaque lecture et le terrain reçoit un document
différent de celui qu'on lui avait annoncé.
Origine : CHU LOT-9.

#### 7.4.18 Transverse CHUES

**CHU-TRV-01 | P1 | le jeton de session reste hors de portée du JavaScript sur un écran CHUES**
Route : `/chues`. Session : COMMERCIAL. Fichier :
`chues-hub.commercial.spec.ts`.
Assertions : `document.cookie` ne contient ni `cpi_at` ni `cpi_rt` ; les deux
cookies existent dans le contexte avec `httpOnly: true`.
Échoue si : le relais cesse de poser des cookies `httpOnly` et une XSS repart
avec la base de prospects.
Note : `prospects.spec.ts` le vérifie déjà sur `/tableau-de-bord` en ADMIN ; ce
scénario le refait sur une session COMMERCIAL, jamais couverte.
Origine : CHU TRV-1.

**CHU-TRV-02 | P1 | tous les écrans CHUES d'un ADMIN se chargent sans état d'erreur** · **mainteneur central**
Route : balayage des routes du §7.1.3 accessibles à un ADMIN. Session : ADMIN.
Fichier : `prospects.spec.ts` (**existant**), parcours « chaque écran du panel se
charge sans état d'erreur ».
Assertions : pour chaque route, le repère propre à l'écran est visible et aucun
`heading` parmi « Serveur injoignable », « Chargement impossible », « Le serveur
CPI a rencontré une erreur », « Accès refusé » n'est rendu.
Échoue si : une route rend une coquille de layout au-dessus d'une page qui n'a
rien rendu ; le titre de niveau 1 venant de la barre supérieure ne le prouverait
pas.
Consigne : la table de ce parcours contient encore `/console` → « Appeler les
prospects » et `/campagnes` → « Campagnes », deux titres qui n'existent plus.
**Aucun agent ne modifie ce fichier** : la mise à jour appartient au mainteneur
central (§3.6).
Origine : CHU TRV-2.

**CHU-TRV-03 | P2 | hors ligne, l'écran le dit au lieu de rester figé**
Route : `/chues/statistiques`. Session : SUPERVISEUR. Fichier :
`chues-chiffres.superviseur.spec.ts`.
Gestes : ouvrir l'écran, `context.setOffline(true)`, déclencher un
rafraîchissement en changeant de période ; puis rétablir le réseau et cliquer
« Réessayer ».
Assertions : un `heading` « Serveur injoignable » apparaît avec un bouton
« Réessayer » ; après rétablissement et clic, les cartes reviennent.
Échoue si : l'écran garde silencieusement les données périmées et le superviseur
prend une décision sur des chiffres d'il y a une heure.
Origine : CHU TRV-4.

**CHU-TRV-04 | P2 | une API en 429 ne se lit pas comme une erreur de données**
Route : `/chues/statistiques`. Session : SUPERVISEUR. Fichier :
`chues-chiffres.superviseur.spec.ts`.
Gestes : intercepter une requête de l'écran et répondre 429 (**jamais** provoquer
un vrai 429 en martelant l'API).
Assertions : un état d'erreur distinct est rendu, avec un bouton « Réessayer » ;
l'écran ne rejoue pas la requête en boucle (compter les requêtes en attendant une
condition, sans attente fixe).
Échoue si : un `refetchInterval` continue de marteler une API déjà limitée.
Origine : CHU TRV-5.

**CHU-TRV-05 | P2 | la navigation d'un téléconseiller nomme les trois étapes telles qu'elles s'appellent**
Route : `/chues`. Session : COMMERCIAL. Fichier :
`chues-hub.commercial.spec.ts`.
Assertions : dans la navigation « Navigation principale », les liens exacts « Mon
travail », « Qualifier un représentant », « Ajouter un prospect », « Convertir un
prospect », « Rappels promis » sont visibles ; « Tableau de bord », « Lots
d’export », « Mon équipe » ont un compte de 0.
Échoue si : la navigation et les écrans divergent, comme aujourd'hui entre
`nav-items.ts` et `roles.anon.spec.ts` (§1.6).
Note : `roles.anon.spec.ts` couvre déjà ce point avec les **anciens** libellés :
signaler l'écart, ne pas modifier ce fichier. Recouvrement assumé avec
**ROL-07**.
Origine : CHU TRV-6.

**CHU-TRV-06 | P2 | la navigation de l'encadrement ouvre sur les chiffres**
Route : `/espaces` puis coque CHUES. Session : SUPERVISEUR. Fichier :
`chues-chiffres.superviseur.spec.ts`.
Assertions : l'URL atteinte est `/chues/statistiques` ; les liens « Tableau de
bord », « Mon équipe », « Lots d’export » sont présents.
Échoue si : l'encadrement atterrit sur l'écran des trois étapes et doit chercher
ses chiffres.
Origine : CHU TRV-7. Recouvrement assumé avec **ROL-03** et **ROL-08**.

**CHU-TRV-07 | P3 | aucune violation axe sur les écrans CHUES nouvellement couverts**
Routes : `/chues/appels-representants` en session COMMERCIAL sur une fiche
ouverte à l'étape 2 ; `/chues/statistiques` en mode composition, session
SUPERVISEUR. Fichier : `chues-accessibilite.spec.ts`.
Assertions : `AxeBuilder().analyze()` ne rend aucune violation.
Échoue si : les poignées de réorganisation du mode composition posent des
attributs `aria-*` invalides, source classique de violations, non couverte par
`accessibility.spec.ts` qui n'analyse que le mode « Organiser » du tableau de bord
des visites.
Contrainte : ne pas rebalayer les routes déjà analysées par
`accessibility.spec.ts` (quota d'appels, §4.4.2).
Origine : CHU TRV-8.

### 7.5 Espace Admin

#### 7.5.1 Racine de la coque

Il n'existe **aucun tableau de bord ni écran de supervision sous `/admin`** : la
supervision vit à `/chues/supervision`.

**ADM-ROOT-01 | P2 | `/admin` renvoie sur la première entrée de la barre Admin**
Route : `/admin`. Session : ADMIN. Fichier : `admin-parametres.spec.ts`.
Gestes : `page.goto('/admin')`.
Assertions : `waitForURL(/\/admin\/commerciaux$/)` puis
`toHaveTitle(/Téléconseillers/)`.
Échoue si : `/admin` rend une page vide, boucle, ou renvoie ailleurs que sur la
première entrée de la barre Admin.
Origine : ADM ADM-ROOT-01.

#### 7.5.2 Comptes utilisateurs

Route : `/admin/commerciaux`. Session : ADMIN. Fichier :
`admin-utilisateurs.spec.ts`, `serial`. Composants :
`components/commerciaux/commerciaux-view.tsx`, `user-form-dialog.tsx`,
`deactivate-user-dialog.tsx`, `password-dialog.tsx`.
Titre du document : **Téléconseillers**. Titre de barre : **Utilisateurs**.
Données autorisées : comptes `E2E-ADM-USR-*` / `e2e-adm-usr-*@cpi.test`.
Interdits : `admin@cpi.sn`, tous les `fixture.*`, tout compte préexistant.
**Piège de filtre par défaut** : la liste s'ouvre filtrée sur `COMMERCIAL`
(§1.10).

| Élément | Libellé exact |
| --- | --- |
| Bouton de création | `Nouvel utilisateur` |
| Champ de recherche | label `Recherche`, placeholder `Nom, e-mail, identifiant…` |
| Filtre rôle | label `Rôle` : `Tous les rôles`, `Administrateur`, `Téléconseiller`, `Banque & Finance`, `Supervision`, `Direction`, `Accueil` |
| Filtre état | label `État du compte` : `Tous`, `Actifs`, `Désactivés` |
| Colonnes | `Utilisateur`, `Identifiants`, `Département`, `Prospects`, `Dernière connexion` |
| État vide | `Aucun compte ne correspond à ces critères.` puis `Élargissez la recherche ou créez un compte.` |
| Menu de ligne | `Actions pour <nom complet>` |
| Entrées du menu | `Modifier`, `Réinitialiser le mot de passe`, `Désactiver le compte` ou `Réactiver le compte` |
| Badges | `Désactivé`, `Jamais connecté` |
| Erreur de liste | `Liste des comptes non chargée.` |

Dialogue de création : titre `Nouvel utilisateur`, description
`Le rôle décide de ce que le compte pourra consulter.`, champs `Nom complet`,
`Adresse e-mail`, `Identifiant` (description
`Utilisé pour la connexion, avec l’e-mail.`), `Téléphone` (description
`Format libre.`), `Rôle`, `Département`, `Mot de passe` (description
`12 caractères minimum.`), boutons `Annuler` et `Créer le compte`. En
modification : titre `Modifier le compte`, description
`Le mot de passe n’est pas modifiable ici.`, bouton `Enregistrer`.

Validation (`apps/web/src/lib/schemas.ts`) : `Le nom complet est obligatoire.` ·
`Adresse e-mail invalide.` · `L'identifiant compte au moins 3 caractères.` ·
`Lettres, chiffres, point et tiret bas uniquement, sans espace ni accent.` ·
`Le mot de passe compte au moins 12 caractères.` · `Choisissez le rôle du compte.`

Toasts : `Compte de <nom> créé.` · `Compte de <nom> mis à jour.` ·
`<nom> désactivé. Ses prospects et représentants sont conservés.` ·
`<nom> réactivé.` · `Mot de passe réinitialisé. <nom> est déconnecté.`
Conflit 409 relayé tel quel : `Cette adresse e-mail est déjà utilisée.` ou
`Ce nom d’utilisateur est déjà utilisé.` (code `USER_IDENTIFIER_TAKEN`).

**ADM-USR-01 | P1 | création d'un téléconseiller**
Gestes : ouvrir `Nouvel utilisateur`, remplir les six champs (nom complet
`E2E-ADM-USR-creation`), `Créer le compte`.
Assertions : toast `Compte de E2E-ADM-USR-creation créé.` ; la ligne apparaît
dans `getByRole('table')` avec son e-mail et son `@identifiant`, le badge
`Jamais connecté` et `0` prospect.
Échoue si : la création n'écrit pas ; ou la ligne n'apparaît qu'après un
rechargement manuel, l'invalidation de la liste étant perdue.
Origine : ADM ADM-USR-01.

**ADM-USR-02 | P1 | formulaire vide**
Gestes : cliquer `Créer le compte` sans rien saisir.
Assertions : les cinq messages de validation s'affichent **et** aucune requête
`POST /api/v1/users` n'est partie (`page.on('request')`).
Échoue si : le formulaire part quand même et le serveur rend une erreur générique
qui ne nomme aucun champ.
Origine : ADM ADM-USR-02.

**ADM-USR-03 | P1 | e-mail déjà pris**
Gestes : rejouer ADM-USR-01 avec le même e-mail et un identifiant différent.
Assertions : toast d'erreur `Cette adresse e-mail est déjà utilisée.` ; la boîte
**reste ouverte** ; aucune seconde ligne dans le tableau.
Échoue si : le 409 est avalé et la boîte se ferme comme si tout allait bien ; ou
le message du serveur est remplacé par un texte générique ; ou un doublon est
réellement créé.
Origine : ADM ADM-USR-03.

**ADM-USR-04 | P1 | un compte non-COMMERCIAL est invisible sous le filtre par défaut**
Gestes : créer un compte `Banque & Finance`, chercher sa ligne, puis changer le
filtre `Rôle` sur `Banque & Finance`.
Assertions : après création, la ligne **n'est pas** dans la liste par défaut ;
après le changement de filtre, elle apparaît et l'URL porte
`?role=BANQUE_FINANCE`.
Échoue si : un compte créé avec un rôle non-COMMERCIAL est introuvable et rien ne
l'explique ; ou le filtre ne vit pas dans l'URL.
Origine : ADM ADM-USR-04. Voir §1.10.

**ADM-USR-05 | P2 | identifiant invalide**
Gestes : saisir `e2e adm usr` (avec espaces).
Assertions : `Lettres, chiffres, point et tiret bas uniquement, sans espace ni accent.`
Échoue si : la règle client s'écarte de celle du serveur et l'identifiant est
refusé en 400 sans explication.
Origine : ADM ADM-USR-05.

**ADM-USR-06 | P2 | mot de passe trop court**
Gestes : saisir 11 caractères.
Assertions : `Le mot de passe compte au moins 12 caractères.`
Échoue si : la borne disparaît et un compte est créé avec un mot de passe que le
serveur refusera à la connexion.
Origine : ADM ADM-USR-06.

**ADM-USR-07 | P1 | modification du rôle**
Gestes : passer le compte de ADM-USR-01 de `Téléconseiller` à `Supervision`,
`Enregistrer`.
Assertions : toast `Compte de … mis à jour.` ; la ligne disparaît du filtre par
défaut et réapparaît sous `Supervision`.
Échoue si : le changement de rôle n'est pas écrit, ou la liste n'est pas
invalidée et affiche encore l'ancien rôle.
Origine : ADM ADM-USR-07.

**ADM-USR-08 | P1 | recherche temporisée et partageable**
Gestes : taper `E2E-ADM-USR` dans `Recherche`, attendre la temporisation,
recharger la page.
Assertions : l'URL porte `?search=E2E-ADM-USR` ; le tableau ne montre que les
lignes du préfixe ; le rechargement complet restitue le même écran.
Échoue si : le filtre de recherche ne survit pas à un rechargement et le lien
partagé ramène la liste entière sans rien signaler.
Origine : ADM ADM-USR-08.

**ADM-USR-09 | P2 | recherche sans résultat**
Gestes : taper `E2E-ADM-USR-inexistant`.
Assertions : l'état vide s'affiche avec ses deux phrases exactes.
Échoue si : le tableau reste vide sans message et l'administrateur croit à une
panne de chargement.
Origine : ADM ADM-USR-09.

**ADM-USR-10 | P2 | caractères spéciaux**
Gestes : créer un compte dont le nom complet est
`E2E-ADM-USR-Ndèye O’Brien & Cie`, puis chercher `Ndèye`.
Assertions : la ligne l'affiche à l'identique ; la recherche le retrouve.
Échoue si : un échappement double s'installe, ou la chaîne est tronquée à
l'apostrophe.
Origine : ADM ADM-USR-10.

**ADM-USR-11 | P1 | désactivation sans portefeuille**
Gestes : menu de ligne, `Désactiver le compte`, confirmer.
Assertions : la boîte annonce `Désactiver le compte de <nom> ?`, le compteur
`0 prospects sont rattachés à ce compte.`, **aucun champ de repreneur**, et
`Rien n’est supprimé.` ; après confirmation, toast
`<nom> désactivé. Ses prospects et représentants sont conservés.` et badge
`Désactivé` sur la ligne.
Échoue si : la boîte propose un repreneur alors qu'il n'y a rien à reprendre, ou
la désactivation n'est pas reflétée dans la liste.
Origine : ADM ADM-USR-11.

**ADM-USR-12 | P1 | désactivation avec portefeuille**
Données : donner au compte un prospect, par l'API, en préparation.
Gestes : rouvrir la boîte, confirmer **sans** choisir de repreneur ; puis choisir
un repreneur et confirmer.
Assertions : message d'erreur dans le champ
`Désignez le téléconseiller qui reprend le portefeuille.` **et** aucune requête
`PATCH .../active` partie ; après le choix du repreneur, succès.
Échoue si : la désactivation d'un compte porteur de fiches passe sans repreneur
et le portefeuille gèle.
Origine : ADM ADM-USR-12.

**ADM-USR-13 | P2 | réactivation**
Gestes : menu du compte désactivé, `Réactiver le compte`.
Assertions : toast `<nom> réactivé.` ; le badge disparaît.
Échoue si : la réactivation aboutit côté serveur mais la ligne garde son badge,
et l'administrateur rejoue le geste.
Origine : ADM ADM-USR-13.

**ADM-USR-14 | P1 | auto-protection de l'administrateur connecté**
Gestes : ouvrir le menu de la ligne d'`admin@cpi.sn`, le compte de la session.
Assertions : l'entrée `Désactiver le compte` est **désactivée**
(`toBeDisabled()` ou `aria-disabled`). Aucun clic, aucune requête.
Échoue si : l'ADMIN peut se désactiver lui-même et se ferme la porte de sa propre
console.
Origine : ADM ADM-USR-14.

**ADM-USR-15 | P1 | réinitialisation de mot de passe**
Gestes : menu, `Réinitialiser le mot de passe` ; saisir deux valeurs différentes ;
puis deux fois la même, d'au moins 12 caractères.
Assertions : la description nomme le compte et son e-mail ; deux valeurs
différentes donnent `Les deux mots de passe diffèrent.` ; deux valeurs identiques
donnent le toast `Mot de passe réinitialisé. <nom> est déconnecté.`
Le mot de passe posé est une constante de la spec, jamais un secret réel, et il
ne vise qu'un compte `E2E-ADM-USR-*`.
Échoue si : la confirmation n'est pas comparée et un mot de passe inconnu est
posé sur un compte ; ou le geste est proposé sur un compte qui n'appartient pas
au test.
Origine : ADM ADM-USR-15.

**ADM-USR-16 | P2 | largeur 375 px**
Gestes : `setViewportSize({ width: 375, height: 812 })`.
Assertions : la barre latérale est repliée derrière `Ouvrir la navigation` ; le
tableau défile horizontalement sans que le bouton `Nouvel utilisateur` sorte du
cadre ; le menu `Actions pour <nom>` s'ouvre et ses trois entrées sont
atteignables.
Échoue si : à 375 px un geste devient inatteignable.
Origine : ADM ADM-USR-16.

**ADM-USR-17 | P2 | la pagination par URL** · **attendu rouge**
Gestes : ouvrir `/admin/commerciaux?page=2`.
Assertions : écrire l'assertion sur la **présence d'un contrôle de page**
(`Page suivante` ou équivalent).
Échoue si : la vue ne rend aucun contrôle de pagination alors que
`parseUserFilters` lit `page` : au-delà de la première page, des comptes
deviennent invisibles sans que rien ne le dise. **Le test reste rouge** et
documente l'absence (§1.10). Relever d'abord la réponse à **Q-24** : la deuxième
page s'affiche-t-elle, ou le paramètre est-il ignoré ?
Origine : ADM ADM-USR-17.

#### 7.5.3 Listes de référence

Route : `/admin/referentiels`. Session : ADMIN. Fichier :
`admin-referentiels.spec.ts`, `serial`. Composant :
`components/referentiels/referentiels-view.tsx`, dialogues
`referentiel-form-dialog.tsx` et `deactivate-dialog.tsx`.
Titre du document : **Référentiels**. Titre de barre : **Listes de référence**.
Six onglets : `Banques`, `Syndicats`, `Départements`, `Professions`, `Revenus`,
`Offres`. L'onglet vit dans l'URL (`?onglet=syndicats`), la recherche aussi
(`?recherche=…`), et l'onglet `banques` n'écrit pas de paramètre. Lien en tête :
`Issues d’appel` vers `/admin/referentiels/issues-appel`.

| Onglet | Titre | Description | Création | Placeholder | États vides |
| --- | --- | --- | --- | --- | --- |
| Banques | `Banques` | `Domiciliation bancaire du prospect.` | `Nouvelle banque` | `Abréviation ou nom complet…` | `Aucune banque enregistrée.` / `Aucune banque ne correspond à cette recherche.` |
| Syndicats | `Syndicats` | `Appartenance syndicale du prospect.` | `Nouveau syndicat` | `Sigle, nom ou secteur…` | `Aucun syndicat enregistré.` / `Aucun syndicat ne correspond à cette recherche.` |
| Départements | `Départements` | `Triés par région, puis par nom.` | `Nouveau département` | `Département, code ou région…` | `Aucun département enregistré.` / `Aucun département ne correspond à cette recherche.` |

Validation : `Le nom est obligatoire.`, `L'abréviation est obligatoire.`,
`Le sigle est obligatoire.`, `Le code est obligatoire.`,
`La région est obligatoire.`, `L'ordre est un nombre entier.`,
`L'ordre ne peut pas être négatif.`, `Ordre trop grand.`
Actions de ligne : `Monter <abréviation>`, `Descendre <abréviation>`,
`Modifier <abréviation>`. Toasts : `<sigle> réactivé.`, `<sigle> désactivé.`,
`Réordonnancement impossible. Réessayez.`
Boîte de désactivation : titre `Désactiver « <libellé> » ?`, description
`Retirée des listes de saisie. Reste disponible en filtre et en export.`,
compteur `<n> prospects référencent cette banque.`, encart
`Aucun prospect n’est supprimé.` avec la mention du suffixe `(retiré)`, boutons
`Annuler` et `Désactiver`. Si le décompte n'est pas revenu : alerte
`Le nombre de fiches concernées n’a pas pu être lu.` et bouton
`Réessayer le décompte` **à la place** du bouton `Désactiver`.

**ADM-REF-01 | P1 | les six onglets se chargent**
Gestes : cliquer chaque onglet.
Assertions : l'URL porte `?onglet=<clé>` sauf pour `banques` ; le titre de
niveau 2 et la description exacte apparaissent ; aucun `Chargement impossible`.
Échoue si : l'onglet ne vit pas dans l'URL et le lien partagé n'ouvre pas la même
liste ; ou un onglet rend une erreur de chargement.
Origine : ADM ADM-REF-01.

**ADM-REF-02 | P1 | création d'une banque**
Gestes : `Nouvelle banque`, nom `E2E-ADM-REF Banque Témoin`, abréviation
`E2EREF`, ordre `9000`, `Enregistrer`.
Assertions : la ligne apparaît en fin de liste.
Échoue si : la création n'écrit pas, ou la ligne n'apparaît qu'après un
rechargement manuel.
Origine : ADM ADM-REF-02.

**ADM-REF-03 | P1 | formulaire vide**
Gestes : `Enregistrer` sans rien saisir.
Assertions : `Le nom est obligatoire.` **et** `L'abréviation est obligatoire.` ;
aucune requête `POST`.
Échoue si : le formulaire part quand même et l'API rend une erreur qui ne nomme
aucun champ.
Origine : ADM ADM-REF-03.

**ADM-REF-04 | P1 | doublon d'abréviation**
Gestes : recréer `E2EREF`.
Assertions : toast portant exactement `Cette valeur existe déjà.` (409
`UNIQUE_CONSTRAINT_VIOLATION`, remonté par le filtre Prisma :
`referentiels.service.ts` appelle `prisma.banque.create` sans capter le conflit) ;
la boîte reste ouverte.
Échoue si : un doublon d'abréviation crée une seconde banque, ou le 409 est avalé
et la boîte se ferme comme si l'entrée avait été créée.
Origine : ADM ADM-REF-04.

**ADM-REF-05 | P2 | ordre invalide**
Gestes : saisir `-1`, puis `abc`.
Assertions : `L'ordre ne peut pas être négatif.` puis
`L'ordre est un nombre entier.`
Échoue si : un ordre négatif ou non entier atteint l'API et casse le tri de la
liste de saisie.
Origine : ADM ADM-REF-05.

**ADM-REF-06 | P1 | tri au clavier**
Gestes : donner le focus au bouton `Monter E2EREF` par `Tab`, presser `Enter`,
puis recharger la page.
Assertions : la ligne remonte d'un rang **dans le DOM** (comparer
`allTextContents()` avant et après) ; après rechargement, l'ordre est conservé.
Échoue si : le tri au clavier est impossible, ou l'ordre n'est pas persisté.
Origine : ADM ADM-REF-06.

**ADM-REF-07 | P1 | désactivation avec décompte**
Gestes : ouvrir la boîte sur `E2E-ADM-REF Banque Témoin` (0 fiche), lire le
décompte, confirmer `Désactiver`.
Assertions : `0 prospect référence cette banque.` ; après confirmation, la ligne
porte le suffixe `(retiré)` dans les listes de saisie et reste visible ici.
Échoue si : la désactivation ne retire pas l'entrée des listes de saisie, ou la
fait disparaître de l'écran d'administration où elle doit rester réactivable.
Origine : ADM ADM-REF-07.

**ADM-REF-08 | P1 | décompte indisponible**
Gestes : intercepter `GET /api/v1/referentiels/usage` et répondre 500, ouvrir la
boîte.
Assertions : l'alerte `Le nombre de fiches concernées n’a pas pu être lu.`
s'affiche ; le bouton `Désactiver` est **absent** (`toHaveCount(0)`) et
`Réessayer le décompte` est présent.
Échoue si : la désactivation est proposée alors que le décompte a échoué. C'est
le défaut nommé dans le code : afficher `0` quand l'appel a échoué faisait
retirer d'un clic une banque portée par des milliers de fiches.
Origine : ADM ADM-REF-08.

**ADM-REF-09 | P2 | recherche dans l'URL**
Gestes : taper `E2E-ADM-REF` dans `Rechercher`, recharger.
Assertions : l'URL porte `?recherche=E2E-ADM-REF` ; le rechargement restitue le
filtre et la même ligne unique.
Échoue si : la recherche ne vit pas dans l'URL et le lien partagé rend la liste
entière.
Origine : ADM ADM-REF-09.

**ADM-REF-10 | P3 | recherche insensible aux accents**
Gestes : chercher `temoin`, sans accent.
Assertions : `Banque Témoin` est retrouvée (`normalize` retire les diacritiques).
Échoue si : la recherche est sensible aux accents et l'administrateur ne retrouve
pas une entrée qu'il voit à l'écran.
Origine : ADM ADM-REF-10.

**ADM-REF-11 | P3 | changer d'onglet vide la recherche**
Gestes : chercher dans `Banques`, puis cliquer `Syndicats`.
Assertions : l'URL ne porte plus `recherche`.
Échoue si : un critère invisible reste appliqué sur le nouvel onglet et la liste
paraît incomplète.
Origine : ADM ADM-REF-11.

**ADM-REF-12 | P2 | largeur 375 px**
Assertions : les six onglets restent atteignables (défilement horizontal de la
`TabsList`) ; la boîte de création reste utilisable et son bouton `Enregistrer`
visible sans zoom.
Échoue si : un onglet ou le bouton d'enregistrement sort du cadre à 375 px.
Origine : ADM ADM-REF-12.

#### 7.5.4 Issues d'appel

Route : `/admin/referentiels/issues-appel`. Session : ADMIN. Fichier :
`admin-issues-appel.spec.ts`, `serial`. Composant :
`components/referentiels/call-outcome-reasons-view.tsx`.
Titre du document : **Issues d’appel** ; le titre de barre est hérité de
« Listes de référence », donc utiliser `toHaveTitle(/Issues d’appel/)`.
Introduction : `Issues proposées au téléconseiller à la fin d’un appel.`
Bouton : `Nouveau motif`. Colonnes : `Code`, `Libellé`, `Effet sur le prospect`,
`Couleur`, `Saisie exigée`, `Sur les téléphones`, `Actions`. Dialogue :
`Nouveau motif d’issue` / `Modifier le motif`, champs `Code` (placeholder `NRP`),
`Libellé` (placeholder `Ne répond pas`), couleur `Aucune`.
Toasts : `<libellé> ajouté. Il atteindra les téléphones après la mise à jour de l’application.`,
`<libellé> enregistré.`, `<libellé> retiré.`, `<libellé> remis en service.`
Conflits serveur : `Le code « <code> » est déjà utilisé par le motif « <libellé> ».`,
`Le libellé « <libellé> » est déjà porté par le motif « <code> ».`,
`« <libellé> » est un motif système : sa règle est compilée dans l’application de terrain et ne se reconfigure pas ici.`,
`Seul l’effet SCHEDULE_CALLBACK planifie un rappel : « <effet> » ne peut pas en exiger la date.`

**ADM-ISS-01 | P1 | l'écran se charge**
Assertions : `toHaveTitle(/Issues d’appel/)` ; les sept en-têtes de colonne sont
présents ; aucun `Chargement impossible`.
Échoue si : l'écran rend une coquille sans son tableau, ou une colonne disparaît.
Origine : ADM ADM-ISS-01.

**ADM-ISS-02 | P1 | création d'un motif**
Gestes : `Nouveau motif`, code `E2EISS`, libellé `E2E-ADM-ISS Motif témoin`,
effet neutre, `Enregistrer`.
Assertions : toast exact avec la phrase sur les téléphones ; la ligne apparaît.
Échoue si : un motif créé n'apparaît pas dans la liste après invalidation du
cache, et l'administrateur le recrée.
Origine : ADM ADM-ISS-02.

**ADM-ISS-03 | P1 | code en doublon**
Gestes : recréer `E2EISS`.
Assertions : toast
`Le code « E2EISS » est déjà utilisé par le motif « E2E-ADM-ISS Motif témoin ».` ;
la boîte reste ouverte ; aucune seconde ligne.
Échoue si : un code en doublon crée un second motif, et les téléphones reçoivent
deux règles pour un même code.
Origine : ADM ADM-ISS-03.

**ADM-ISS-04 | P2 | libellé en doublon avec un autre code**
Assertions : toast `Le libellé « … » est déjà porté par le motif « … ».`
Échoue si : deux motifs portent le même libellé et le téléconseiller ne sait plus
lequel il choisit.
Origine : ADM ADM-ISS-04.

**ADM-ISS-05 | P1 | motif système non modifiable**
Gestes : tenter de modifier un motif du seed, par exemple `NRP`.
Assertions : toast contenant `est un motif système` ; le changement n'est pas
persisté (relire la ligne).
Échoue si : un motif système devient modifiable et les téléphones en place
cassent, leur règle étant compilée dans l'application de terrain.
Origine : ADM ADM-ISS-05.

**ADM-ISS-06 | P2 | retrait puis remise en service**
Gestes : retirer `E2EISS`, puis le remettre en service.
Assertions : les deux toasts exacts ; la colonne `Sur les téléphones` reflète
l'état.
Échoue si : la colonne n'est pas rafraîchie et l'administrateur ne sait pas ce
que le terrain reçoit.
Origine : ADM ADM-ISS-06.

**ADM-ISS-07 | P3 | état vide absent** · **attendu rouge**
Gestes : filtrer à vide.
Assertions : écrire l'assertion sur la présence d'un état vide
(`Aucun motif d’issue`).
Échoue si : la vue rend `query.data.map(...)` sans vérifier `length`, et une
liste vide produit un tableau à en-têtes sans corps ni explication. **Le test
reste rouge** et documente l'absence (§1.11).
Origine : ADM ADM-ISS-07.

#### 7.5.5 Imports de masse

Route : `/admin/imports`. Session : ADMIN. Fichier : `admin-imports.spec.ts`.
Composant : `components/imports/imports-view.tsx`. Titre du document et de barre :
**Importer un fichier Excel**. Repère propre à l'écran : `Déposer un classeur`.
Entités du sélecteur `Entité à importer` : `Prospects CHUES`,
`Prospects Grand Public`, `Représentants`, `Visites`. Description :
`Le fichier est d’abord simulé. Rien n’est écrit tant que vous n’avez pas confirmé l’application.`
Bouton `Télécharger le modèle`. Plafond 25 Mo, message
`Fichier trop volumineux : 25 Mo au maximum.` Extension acceptée : `.xlsx`.
Repli d'historique `Imports précédents` ; état vide, titre `Aucun import`,
description
`Déposez un classeur ci-dessus : les travaux apparaîtront ici avec leur rapport.` ;
colonnes `Fichier`, `Entité`, `État`, `Créées`, `Ignorées`, `Erreurs`,
`Déposé le` ; pagination `Page précédente` / `Page suivante` ; note
`Un travail « échu » n’a pas échoué : son classeur et son rapport ont passé leur échéance.`
Après simulation : badge `Simulation`, `Déposer un autre fichier`,
`Aucune ligne à créer : tout le fichier est soit déjà en base, soit refusé.`
Toast d'application : `Application lancée. L’écran suit son avancement.`
**Déjà couvert** par `representants-import.spec.ts` pour l'entité Représentants
(modèle, simulation, application, redépôt) : **ne pas dupliquer**.

**ADM-IMP-01 | P1 | l'écran se charge**
Assertions : `toHaveTitle(/Importer un fichier Excel/)` ; `Déposer un classeur`
visible ; les quatre entités présentes dans le sélecteur ; aucun état d'erreur.
Échoue si : une entité disparaît du sélecteur et un classeur ne peut plus être
déposé pour ce domaine.
Origine : ADM ADM-IMP-01.

**ADM-IMP-02 | P2 | le sélecteur d'entité change le texte d'aide**
Gestes : passer sur `Prospects Grand Public`.
Assertions : `Seuls le nom et le téléphone sont exigés` apparaît, avec le plafond
de lignes de cette entité.
Échoue si : l'aide reste celle de l'entité précédente et l'administrateur prépare
son classeur au mauvais format.
Origine : ADM ADM-IMP-02.

**ADM-IMP-03 | P1 | modèle Grand Public**
Gestes : sélectionner `Prospects Grand Public`, cliquer `Télécharger le modèle`,
capturer le `download`.
Assertions : extension `.xlsx` et signature ZIP `50 4B 03 04`.
Échoue si : un JSON d'erreur est relayé sous l'extension `.xlsx`, ce que seule la
signature binaire distingue.
Origine : ADM ADM-IMP-03.

**ADM-IMP-04 | P1 | fichier de mauvaise extension**
Gestes : déposer un `.txt` via `setInputFiles`.
Assertions : le dépôt est refusé ; aucune requête `POST /api/v1/imports` ne part.
Échoue si : un fichier hors `.xlsx` part vers l'API.
Origine : ADM ADM-IMP-04.

**ADM-IMP-05 | P1 | fichier trop gros**
Gestes : fabriquer en mémoire un tampon de 26 Mo nommé
`E2E-ADM-IMP-trop-gros.xlsx`, le déposer.
Assertions : toast `Fichier trop volumineux : 25 Mo au maximum.` et **aucune
requête** ne part, le contrôle étant côté navigateur.
Échoue si : un fichier de plus de 25 Mo est envoyé et occupe la bande passante
avant d'être refusé côté serveur.
Origine : ADM ADM-IMP-05.

**ADM-IMP-06 | P2 | historique**
Gestes : déplier `Imports précédents`.
Assertions : si des travaux existent, les sept en-têtes sont présents et la ligne
la plus récente porte l'entité et l'état ; sinon l'état vide affiche
`Aucun import` et sa phrase exacte.
Échoue si : l'historique rend un tableau sans corps ni message et l'utilisateur
ne sait pas s'il a chargé.
Origine : ADM ADM-IMP-06.

**ADM-IMP-07 | P2 | pagination de l'historique**
Assertions : `Page suivante` est désactivée quand il n'y a qu'une page ; s'il y en
a plusieurs, un clic change les lignes affichées et le compteur
`Travaux d’import` (région `status`) change de texte.
Échoue si : la butée n'est pas gardée, ou le compteur ne suit pas la page servie.
Origine : ADM ADM-IMP-07.

**ADM-IMP-08 | P2 | historique en panne**
Gestes : `page.route('**/api/v1/imports*', r => r.fulfill({ status: 500 }))`,
recharger, déplier.
Assertions : le message en ligne
`L’historique des imports n’a pas pu être chargé.` s'affiche avec `Réessayer`, et
le **reste de l'écran, dont le dépôt, reste utilisable**.
Échoue si : l'historique en panne fait tomber toute la page au lieu du seul bloc.
Origine : ADM ADM-IMP-08.

#### 7.5.6 Notifications

Route : `/admin/notifications`. Session : ADMIN. Fichier :
`admin-notifications.spec.ts`, `serial`. Composants :
`notifications-view.tsx`, `notification-composer.tsx`, `inbox-view.tsx`,
`template-manager.tsx`. Titre du document et de barre : **Notifications**.
Trois onglets pour l'ADMIN : `Boîte de réception`, `Historique`, `Gabarits`.
Composeur : `Nouvelle notification` puis `Confirmer l’envoi` ; descriptions
`Envoi push aux destinataires choisis.` puis `L’envoi est irréversible.` ; champs
`Gabarit` (placeholder `Aucun gabarit`), `Titre` (120 caractères), `Message`
(500), `Catégorie`, `Lien profond` (description `Route interne ouverte au tap.`,
placeholder `/phase2`), `Destinataires`, `Rôle`, `Département`,
`Identifiants des comptes` (description `Un identifiant par ligne.`), `Quand`
avec `Envoyer maintenant` / `Programmer`, `Date et heure`.
Toasts : `Envoyée à <n> destinataire(s).`,
`Notification programmée. Annulable jusqu’au départ.`, `Envoi annulé.`
Historique vide : `Aucune notification envoyée` /
`Un envoi part en push vers les destinataires choisis, et reste dans leur boîte de réception.`
avec le bouton `Composer la première` ; avec filtres :
`Aucun envoi ne correspond à ces critères` / `Changez d’état ou de catégorie.`
Filtres : `État`, `Catégorie`, bouton `Tout effacer`. Annulation : boîte
`Annuler l’envoi « <titre> » ?`. Erreur :
`L’historique des notifications n’a pas pu être chargé.`

**Contrainte de données.** Une notification envoyée part réellement en push et
reste dans la boîte de réception des destinataires. Les scénarios d'envoi réel
visent l'audience **la plus étroite possible** : audience `USERS` avec le seul
identifiant d'un compte `E2E-ADM-USR-*` créé pour l'occasion, jamais
`Tous les comptes` ni un rôle entier. Titres préfixés `E2E-ADM-NOT-`.

**ADM-NOT-01 | P1 | les trois onglets et l'URL**
Assertions : les trois onglets s'affichent pour un ADMIN ; l'onglet vit dans
l'URL (`?onglet=historique`) ; un rechargement le restitue.
Échoue si : l'onglet ne vit pas dans l'URL et le lien partagé ouvre le mauvais
volet.
Origine : ADM ADM-NOT-01.

**ADM-NOT-02 | P1 | envoi ciblé**
Gestes : `Nouvelle notification`, titre `E2E-ADM-NOT envoi témoin`, message
court, destinataires `Comptes désignés` avec l'identifiant du compte témoin,
`Envoyer maintenant`, confirmer.
Assertions : l'étape `Confirmer l’envoi` s'affiche avant tout envoi ; puis toast
`Envoyée à 1 destinataire(s).` ; la ligne apparaît en tête de l'`Historique`.
Échoue si : un envoi part sans confirmation ; ou un envoi de test atteint une
audience plus large que le compte témoin.
Origine : ADM ADM-NOT-02.

**ADM-NOT-03 | P1 | formulaire vide**
Gestes : ouvrir le composeur et tenter d'avancer.
Assertions : les erreurs de champ obligatoire s'affichent ; **aucune requête
`POST /api/v1/notifications`** ne part.
Échoue si : un envoi incomplet atteint l'API et part vers des téléphones.
Origine : ADM ADM-NOT-03.

**ADM-NOT-04 | P2 | titre au-delà de 120 caractères**
Assertions : le champ tronque ou refuse ; le compteur ou le message le dit ;
l'envoi ne part pas avec un titre plus long.
Échoue si : un titre trop long est envoyé et se retrouve coupé sur les téléphones
sans que l'administrateur l'ait vu.
Origine : ADM ADM-NOT-04.

**ADM-NOT-05 | P1 | programmation**
Gestes : choisir `Programmer`, poser une date **passée**, puis une date à J+1.
Assertions : la date passée donne une erreur de champ ; la date à J+1 donne le
toast `Notification programmée. Annulable jusqu’au départ.`
Échoue si : une notification programmée dans le passé est acceptée et part
immédiatement.
Origine : ADM ADM-NOT-05.

**ADM-NOT-06 | P1 | annulation d'un envoi programmé**
Gestes : dans l'`Historique`, ouvrir l'annulation, confirmer.
Assertions : boîte `Annuler l’envoi « E2E-ADM-NOT … » ?` ; toast `Envoi annulé.` ;
l'état de la ligne change.
Échoue si : l'annulation ne change pas l'état de la ligne et l'envoi part quand
même.
Origine : ADM ADM-NOT-06.

**ADM-NOT-07 | P2 | filtres d'historique**
Gestes : choisir un `État` puis une `Catégorie`, puis `Tout effacer`.
Assertions : l'URL porte les deux paramètres ; `Tout effacer` les retire ; sans
résultat, l'état vide affiche `Aucun envoi ne correspond à ces critères`.
Échoue si : les filtres ne vivent pas dans l'URL, ou l'état vide filtré est
confondu avec l'état vide initial.
Origine : ADM ADM-NOT-07.

**ADM-NOT-08 | P2 | détail d'un envoi**
Gestes : ouvrir une ligne.
Assertions : la boîte porte le **titre de la notification**, et non
`Détail de l’envoi`, qui n'est que le repli.
Échoue si : le détail n'identifie pas l'envoi ouvert et l'administrateur annule le
mauvais.
Origine : ADM ADM-NOT-08.

**ADM-NOT-09 | P3 | lien profond**
Gestes : saisir `/chemin-inexistant`, puis une route de la liste `cpi-routes`.
Assertions : le champ signale la route inconnue (`routeIssue`) ; la route connue
ne produit aucune erreur.
Échoue si : un lien profond invalide part vers les téléphones et le tap ne mène
nulle part.
Origine : ADM ADM-NOT-09.

**ADM-NOT-10 | P2 | largeur 375 px**
Assertions : le composeur (`sm:max-w-4xl`, `max-h-[92vh] overflow-y-auto`) reste
défilable ; le bouton d'envoi est atteignable ; aucun champ n'est coupé.
Échoue si : un champ obligatoire devient inatteignable à 375 px et l'envoi ne peut
pas être complété.
Origine : ADM ADM-NOT-10.

#### 7.5.7 Paramètres, hors publication Android

Route : `/admin/parametres`. Session : ADMIN. Fichier :
`admin-parametres.spec.ts`. Titre du document et de barre : **Paramètres**.
Introduction : `Ces actions portent sur les données de tous les utilisateurs.`
Cartes, dans l'ordre : `Espace démo`, `Version Android`,
`Historique des versions`, `Suppression des données`,
`Export intégral de la base` (cette dernière seulement si `DB_DUMP_ENABLED`).

**ADM-PAR-01 | P1 | l'écran compose ses cartes dans l'ordre**
Assertions : assertion sur l'**ordre réel** des titres
(`getByRole('heading').allTextContents()`), pas sur leur simple présence :
`Espace démo`, `Version Android`, `Historique des versions`,
`Suppression des données`.
Échoue si : une carte disparaît de l'écran, ou l'ordre change au point de mettre
la purge ou l'export intégral en avant.
Origine : ADM ADM-PAR-01.

**ADM-PAR-02 | P1 | carte « Espace démo »**
Assertions : la description
`Le jeu est reconstruit par la factory à partir des référentiels et comptes actuels.`
est visible ; les cinq compteurs (`comptes`, `représentants`, `prospects`,
`campagnes`, `dossiers bancaires`) portent un nombre ; le bouton
`Réinitialiser l’espace démo` est présent. **Ne pas cliquer** : la
réinitialisation appartient à `demo-isolement.spec.ts` (§4.3.5).
Échoue si : les compteurs affichent `—` ou restent en squelette, et
l'administrateur ne sait pas ce que contient l'espace de démonstration.
Origine : ADM ADM-PAR-02.

**ADM-PAR-03 | P1 | carte « Suppression des données »**
Assertions : le badge `Irréversible` est présent et la description
`Sélection par domaine. La suppression est définitive.` s'affiche.
**Aucun clic sur un geste de purge, jamais.**
Échoue si : le badge `Irréversible` disparaît et un geste définitif se présente
comme ordinaire.
Origine : ADM ADM-PAR-03.

**ADM-PAR-04 | P3 | carte « Export intégral de la base »** · assertion conditionnelle
Assertions : si la carte est rendue, la description
`Structure et contenu complets, dans une archive compressée. Réservé aux sauvegardes et aux migrations.`
s'affiche. **Ne pas déclencher l'export.** Si elle est absente, vérifier que
`DB_DUMP_ENABLED` n'est pas posé et ne pas échouer sur son absence : l'assertion
est conditionnelle et documentée (§8, **Q-16**).
Échoue si : la carte est rendue alors que la variable n'est pas posée, ou
l'inverse, et l'écran ne reflète pas la configuration du serveur.
Origine : ADM ADM-PAR-04.

**ADM-PAR-05 | P2 | refus des paramètres aux cinq autres rôles**
Sessions : DIRECTION, SUPERVISEUR, COMMERCIAL, ACCUEIL, BANQUE_FINANCE.
Assertions : `Accès refusé` et le texte
`Les paramètres de la plateforme est réservé à un autre rôle.`
Échoue si : un rôle non administrateur atteint les paramètres, où il peut
réinitialiser la démo ou purger des données.
Origine : ADM ADM-PAR-05. Recouvrement assumé avec **ROL-17** à **ROL-21** ; ce
scénario garde l'assertion sur le libellé « quoi ».

#### 7.5.8 Publication d'une version Android

Route : `/admin/parametres`, carte `Version Android`. Session : ADMIN. Fichier :
`android-release.spec.ts`, `serial`. Composants :
`components/settings/android-release-card.tsx`, `android-release-upload.ts`,
`android-release-upload-toast.tsx`. Relais :
`apps/web/src/app/api/app-updates/android/route.ts`. API :
`apps/api/src/modules/app-updates/**`.

**Fixtures binaires, déjà versionnées et petites**, dans
`apps/api/src/modules/app-updates/fixtures/` :

| Fichier | Taille | Ce qu'il éprouve |
| --- | --- | --- |
| `cpi-go-v7.apk` | 8,1 Ko | APK valide, paquet `sn.cpi.go`, clé de test `9434b1f9…f3909` |
| `cpi-go-v12.apk` | 8,1 Ko | même clé, `versionCode` supérieur |
| `cpi-go-v12-autre-cle.apk` | 8,1 Ko | autre clé (`3a22ee16…928a6`), `APK_SIGNER_MISMATCH` |
| `cpi-go-v7-non-signe.apk` | 683 o | aucun bloc de signature v2/v3, `APK_UNSIGNED` |
| `autre-editeur-v99.apk` | 691 o | paquet étranger, `APK_FOREIGN_PACKAGE` |
| `manifeste-illisible.apk` | 199 o | manifeste illisible, `APK_MANIFEST_UNREADABLE` |

**Ne pas fabriquer de nouvel APK** : générer un keystore ajouterait une
dépendance sur `apksigner` et les build-tools Android sur la machine de test.
Chemin depuis la spec web :
`resolve(__dirname, '../../api/src/modules/app-updates/fixtures/cpi-go-v7.apk')`.
Une copie sous `apps/web/e2e/fixtures/apk/` relève du mainteneur central, pas de
l'agent.

**Préconditions.** `APK_SIGNER_SHA256` doit être posée (§3.4) ; sans elle,
`expectedSigner()` prend le signataire de la première release publiée et
ADM-APK-06 n'est pas reproductible. Plage de `versionCode` réservée aux tests :
900 000 à 999 999 ; les fixtures portent 7 et 12, elles ne peuvent donc pas être
publiées si une release de la plage haute existe déjà. Ordre : publier d'abord
les fixtures basses (7 puis 12), puis les cas d'erreur. Le `afterAll` retire les
versions du test **sauf si elles sont les dernières en ligne**
(`APK_LAST_RELEASE`), et le retour de l'agent nomme ce qui reste.

**Libellés exacts de la carte.** Description :
`Le fichier est vérifié par le serveur avant d’être distribué. La version et le numéro de build sont lus dans l’APK.`
Bandeau : `En ligne : ` + `CPI GO <versionName> · build <versionCode>` ou
`aucune version publiée` ; `Plancher obligatoire : ` + `build <n>` ou `aucun`.
Zone de dépôt : bouton-label `Choisir un fichier APK`, aide
`ou glissez le fichier ici. Seuls les fichiers .apk sont acceptés.` Champ
`Notes de version (facultatif)`, placeholder `Corrections et nouveautés…`, 2 000
caractères. Bouton `Publier` ; pendant l'envoi `Envoi en cours…` (désactivé) et
`L’envoi continue en bas de l’écran, même si vous changez de page.` Refus local :
`Déposez un fichier .apk.`
Barre de progression (toast persistant `android-release-upload`, monté à côté du
`Toaster`, vivant sur **tous** les écrans) : nom du fichier, `<n> %`, une
`Progress` d'aria-label `Envoi de <nom du fichier>`,
`<taille envoyée> sur <taille totale>`, bouton `Annuler`. Tailles : `<n> Ko` sous
1 Mo, `<n,n> Mo` au-delà.
Popup de fin : titre `Version publiée`, description
`Voici ce que le serveur a lu dans le fichier. Rien n’a été saisi à la main.`,
liste `Version`, `Build`, `Taille`, `Empreinte`, `Signataire` (empreintes
raccourcies `8 premiers…8 derniers`), encart `Rendre obligatoire` /
`Les téléphones en dessous de cette version devront l’installer pour continuer.`
ou `Cette version est déjà une mise à jour obligatoire.`, boutons `Fermer` et
`Rendre obligatoire`. Toast parallèle : `CPI GO <versionName> publiée.` Toast
d'annulation : `Envoi annulé.` Toast d'échec : le message du serveur, sinon
`La publication a échoué.`
Historique : carte `Historique des versions`, description
`Les versions retirées restent listées : elles ne sont plus distribuées.`,
colonnes `Build`, `Version`, `Publiée le`, `Par`, `Taille`, `Obligatoire`,
`État`, actions ; badges `Mise à jour obligatoire` / `Non`, `Retirée` /
`En ligne` ; actions `Rendre obligatoire`, `Retirer` ; état vide
`Aucune version publiée.` ; erreur
`L’historique des versions Android n’a pas pu être lu.` Boîte de retrait : titre
`Retirer CPI GO <versionName> ?`, description
`Le retrait arrête la distribution de cette version et abaisse le plancher. Il ne désinstalle rien sur les téléphones qui l’ont déjà.`,
encart `Build <n> · Signataire <empreinte courte>`, bouton `Retirer`. Toasts :
`CPI GO <versionName> retirée.`,
`CPI GO <versionName> est maintenant obligatoire.`, `Le retrait a échoué.`,
`La version n’a pas pu être rendue obligatoire.`

Messages d'erreur serveur, relayés tels quels par `apiErrorText` :

| Code | Extrait à asserter |
| --- | --- |
| `APK_MANIFEST_UNREADABLE` (400) | `Le manifeste de cet APK est illisible` |
| `APK_FOREIGN_PACKAGE` (422) | `et non « sn.cpi.go »` |
| `APK_VERSION_NOT_GREATER` (422) | `Une publication doit être STRICTEMENT supérieure` |
| `APK_UNSIGNED` (422) | `ne porte pas de bloc de signature v2/v3 lisible` |
| `APK_SIGNER_MISMATCH` (422) | `Android refuse une mise à jour signée par une autre clé` |
| `APK_RELEASE_UNKNOWN` (404) | `Aucune release en ligne ne porte le versionCode` |
| `APK_LAST_RELEASE` (409) | `C’est la seule release en ligne` |

Existant : `android-release-card.test.tsx` couvre déjà en Vitest la progression,
la fenêtre de confirmation, le refus de signataire, l'annulation, la survie de la
barre au démontage de la carte, l'historique, le passage en obligatoire et le
retrait. **Ce que le Vitest ne peut pas prouver, et que ces scénarios doivent
prouver** : le flux réel de 8 Ko traverse `XMLHttpRequest`, le relais Next
`duplex: 'half'`, le multipart Fastify, la lecture du manifeste et du bloc de
signature sur disque, et la barre survit à une **vraie** navigation de page.

**ADM-APK-01 | P1 | publication réussie de `cpi-go-v7.apk`**
Gestes : `setInputFiles` sur l'entrée `.apk`, puis `Publier`.
Assertions : le nom du fichier et sa taille (`8 Ko`) s'affichent sous la zone de
dépôt ; la barre apparaît avec `Envoi de cpi-go-v7.apk` ; à la fin, toast
`CPI GO <versionName> publiée.` (constante nommée dans la spec, relevée une fois,
§8 **Q-23**) et la popup `Version publiée` s'ouvre.
Échoue si : la publication n'aboutit pas alors que le fichier est valide, ou la
barre de progression n'apparaît jamais et l'administrateur ne sait pas si l'envoi
est parti.
Origine : ADM APK-01.

**ADM-APK-02 | P1 | la popup dit ce que le serveur a lu**
Assertions : `Version`, `Build`, `Taille`, `Empreinte`, `Signataire` sont
renseignés ; le `Signataire` affiché correspond au raccourci de
`9434b1f9…ad7f3909` ; aucune valeur n'est vide ni `—`.
Échoue si : une valeur est saisie côté client au lieu d'être lue dans l'APK, ou
manque, et l'administrateur publie sans savoir ce qu'il distribue.
Origine : ADM APK-02.

**ADM-APK-03 | P1 | publier et rendre obligatoire sont deux gestes**
Gestes : à l'ouverture de la popup, lire le bandeau ; puis cliquer
`Rendre obligatoire`.
Assertions : l'encart `Rendre obligatoire` est une proposition, pas un fait : le
bandeau de la carte affiche encore `Plancher obligatoire : aucun` ou l'ancien
plancher ; après le clic, toast
`CPI GO <version> est maintenant obligatoire.` et le bandeau passe à `build <n>`.
Échoue si : « publier » rend automatiquement obligatoire, et tout le parc est
bloqué en mise à jour forcée sans décision.
Origine : ADM APK-03.

**ADM-APK-04 | P1 | l'envoi ne bloque pas la navigation**
Gestes : ralentir le relais côté **réseau**
(`page.route('**/api/app-updates/android', …)` avec un délai avant
`route.continue()`, ce qui est légitime, contrairement à un `waitForTimeout` dans
le test) ; pendant l'envoi, naviguer vers `/admin/commerciaux` par un clic dans
la barre latérale.
Assertions : pendant l'envoi, la barre est visible, le bouton `Publier` est
désactivé et le message
`L’envoi continue en bas de l’écran, même si vous changez de page.` est rendu ;
après la navigation, la barre **reste visible** et le toast de succès apparaît
alors qu'on est sur un autre écran.
Échoue si : l'envoi bloque la navigation, ou la barre de progression disparaît
quand on quitte `/admin/parametres`, et l'administrateur croit son envoi perdu.
Origine : ADM APK-04.

**ADM-APK-05 | P1 | annulation**
Gestes : pendant l'envoi ralenti, cliquer `Annuler` dans la barre.
Assertions : toast `Envoi annulé.` ; la barre disparaît ; **aucune nouvelle ligne
dans l'historique** (relire `GET /api/v1/app-updates/android/releases` par l'API
et comparer le nombre d'éléments).
Échoue si : l'annulation est visuelle et la release est publiée quand même.
Origine : ADM APK-05.

**ADM-APK-06 | P1 | `APK_SIGNER_MISMATCH`**
Gestes : déposer `cpi-go-v12-autre-cle.apk`.
Assertions : toast contenant
`Android refuse une mise à jour signée par une autre clé` ; aucune ligne ajoutée
à l'historique.
Échoue si : un APK signé d'une autre clé est publié : le parc devrait
désinstaller l'application pour accepter la mise à jour, en perdant les saisies
non synchronisées.
Origine : ADM APK-06.

**ADM-APK-07 | P1 | `APK_UNSIGNED`**
Gestes : déposer `cpi-go-v7-non-signe.apk`.
Assertions : toast contenant `ne porte pas de bloc de signature v2/v3 lisible`.
Échoue si : un APK non signé est accepté et distribué au parc.
Origine : ADM APK-07.

**ADM-APK-08 | P1 | `APK_FOREIGN_PACKAGE`**
Gestes : déposer `autre-editeur-v99.apk`.
Assertions : toast contenant `et non « sn.cpi.go »`.
Échoue si : un APK d'un autre éditeur est publié sous le nom de l'application.
Origine : ADM APK-08.

**ADM-APK-09 | P1 | `APK_MANIFEST_UNREADABLE`**
Gestes : déposer `manifeste-illisible.apk`.
Assertions : toast contenant `Le manifeste de cet APK est illisible`.
Échoue si : un fichier dont le manifeste ne se lit pas est publié avec une
version et un build inventés.
Origine : ADM APK-09.

**ADM-APK-10 | P1 | `APK_VERSION_NOT_GREATER`**
Gestes : republier `cpi-go-v7.apk` alors que la 7 ou plus est en ligne.
Assertions : toast contenant
`Une publication doit être STRICTEMENT supérieure`.
Échoue si : un `versionCode` inférieur ou égal est publié et le parc reçoit une
version plus ancienne que la sienne.
Origine : ADM APK-10.

**ADM-APK-11 | P1 | fichier non-APK**
Gestes : `setInputFiles` avec un `.txt` sans extension `.apk`.
Assertions : toast local `Déposez un fichier .apk.` et **aucune requête** vers
`/api/app-updates/android`.
Échoue si : un fichier quelconque est envoyé au serveur, qui doit alors le
refuser après transfert.
Origine : ADM APK-11.

**ADM-APK-12 | P1 | `APK_LAST_RELEASE`**
Gestes : quand une seule version est en ligne, cliquer `Retirer` puis confirmer.
Assertions : toast contenant `C’est la seule release en ligne` ; la ligne reste
`En ligne`.
Si plusieurs versions sont en ligne au moment du test, publier d'abord
`cpi-go-v12.apk` puis retirer la 7 ; **ne pas jouer ce scénario** sur une version
qu'on n'a pas publiée, et le noter dans le retour.
Échoue si : le retrait de la dernière version en ligne passe et le parc n'a plus
rien à télécharger.
Origine : ADM APK-12.

**ADM-APK-13 | P1 | retrait normal**
Gestes : avec deux versions en ligne, `Retirer` la plus ancienne, confirmer.
Assertions : la boîte affiche `Retirer CPI GO <version> ?`, la phrase
`Il ne désinstalle rien sur les téléphones qui l’ont déjà.` et l'encart
`Build <n> · Signataire <empreinte courte>` ; après confirmation, toast
`CPI GO <version> retirée.`, la ligne passe au badge `Retirée` et perd ses
boutons d'action.
Échoue si : une version retirée reste distribuée, ou disparaît de l'historique au
lieu d'y rester listée.
Origine : ADM APK-13.

**ADM-APK-14 | P1 | le plancher redescend après un retrait**
Gestes : rendre la version 7 obligatoire, publier la 12, retirer la 7.
Assertions : le bandeau `Plancher obligatoire` **redescend** (`aucun` ou le build
obligatoire encore en ligne). L'assertion porte sur le bandeau, pas sur l'API.
Échoue si : le plancher ne redescend pas après un retrait, et le parc reste
bloqué sur une version qui n'est plus distribuée, donc plus téléchargeable.
Origine : ADM APK-14.

**ADM-APK-15 | P2 | l'historique**
Assertions : les huit en-têtes sont présents ; la ligne la plus récente porte le
`Build`, la `Version`, la taille formatée (`8 Ko`), le nom du publieur (`Par`) et
le badge `En ligne` ; une version retirée reste listée.
Échoue si : l'historique perd une colonne ou une version retirée, et la trace de
ce qui a été distribué disparaît.
Origine : ADM APK-15.

**ADM-APK-16 | P2 | historique en panne**
Gestes :
`page.route('**/api/v1/app-updates/android/releases', r => r.fulfill({ status: 500 }))`.
Assertions : la carte affiche
`L’historique des versions Android n’a pas pu être lu.` avec un bouton
`Réessayer` ; le reste de `/admin/parametres` (carte `Espace démo`, carte de
suppression) reste rendu.
Échoue si : la panne d'un bloc fait tomber tout l'écran des paramètres.
Origine : ADM APK-16.

**ADM-APK-17 | P3 | notes de version**
Gestes : publier `cpi-go-v12.apk` avec une note `E2E-APK note de version` ; puis
coller 2 100 caractères dans le champ.
Assertions : la note est enregistrée (relecture par l'API
`GET .../releases`, champ `notes`) ; le champ tronque à 2 000 caractères.
Échoue si : la note est perdue à la publication, ou le plafond saute et l'API
rejette la publication entière pour un champ trop long.
Origine : ADM APK-17.

**ADM-APK-18 | P3 | l'envoi survit à une navigation dure**
Gestes : pendant l'envoi ralenti, tenter `page.goto('/')`.
Assertions : l'assertion réelle porte sur l'après : la barre est toujours montée
et l'envoi se termine. Les dialogues `beforeunload` étant auto-acceptés par
Playwright, l'avertissement de fermeture lui-même n'est pas observable.
Échoue si : une navigation dure interrompt l'envoi sans rien dire, et une
publication partielle atteint le serveur.
Origine : ADM APK-18.

**Ne pas faire** : télécharger l'APK depuis
`GET /api/v1/app-updates/android/download` en boucle. Le limiteur est de dix par
heure et il est partagé avec les autres specs. Un seul téléchargement, si
vraiment nécessaire, et le dire dans le retour.

### 7.6 Espace Projet Grand Public

#### 7.6.1 Liste des prospects

Route : `/grand-public`. Composant :
`components/grand-public/prospects-view.tsx`. Fichier :
`grand-public-liste.spec.ts`. Session : ADMIN, sauf mention. Titre du document :
**Prospects Grand Public** ; la page rend **son propre `<h1>`**, il y a donc deux
`<h1>` (§6.1). Sous-titre :
`Les particuliers démarchés hors syndicat. Les fiches CHUES ne figurent pas ici.`
Filtres : `Rechercher` (placeholder `Nom, prénom ou téléphone`), bouton `Filtres`
(avec `(<n>)` quand des critères sont actifs), `Canal de provenance`
(placeholder `Tous les canaux`), groupes `Situation` et `Statut` (boutons
`aria-pressed`), `Saisi à partir du`, `Saisi jusqu’au`, `Tout effacer`.
Colonnes : `Nom`, `Statut`, `Situation`, `Profession`, `Canal`, `Banque`,
`Segment`, `Téléconseiller`, `Saisi le`. Compteur (région `status`) :
`Prospects affichés : ` puis `<premier>–<dernier> sur <total>` ou
`Aucun résultat`. Pagination : `Lignes`, `Page précédente`, `Page suivante`,
`<n> / <n>`. État vide sans filtre :
`Aucun prospect Grand Public n’a encore été saisi.` /
`La première fiche se crée depuis « Nouveau prospect ».` avec le bouton
`Nouveau prospect`. État vide filtré :
`Aucun prospect ne correspond à ces filtres.` /
`Élargissez la période ou retirez un critère.` Erreur :
`La liste des prospects Grand Public n’a pas pu être chargée.` Erreur partielle
des canaux :
`La liste des canaux de provenance n’a pas pu être chargée. Les autres filtres restent utilisables.`
Bouton de création `Nouveau prospect`, visible seulement si
`canCreate = !readsOnly(role)`, donc **pas** pour SUPERVISEUR ni DIRECTION.

**GP-01 | P1 | l'écran se charge**
Assertions : `toHaveTitle(/Prospects Grand Public/)` ; le sous-titre exact ; les
neuf en-têtes de colonne ; le compteur non vide ; aucun état d'erreur.
Échoue si : l'écran rend la coque au-dessus d'une page qui n'a rien rendu, ce que
le seul `<h1>` ne prouverait pas.
Origine : ADM GP-01.

**GP-02 | P1 | filtre de statut, jusqu'au rechargement**
Gestes : déplier `Filtres`, cliquer `Nouveau` dans le groupe `Statut`, recharger.
Assertions : le bouton porte `aria-pressed="true"` ; l'URL porte
`statut=NOUVEAU` ; le compteur change ; **un rechargement complet restitue le même
compteur et le même bouton pressé**.
Échoue si : un filtre ne survit pas au rechargement et le lien partagé ramène la
liste entière sans rien signaler.
Origine : ADM GP-02.

**GP-03 | P2 | le bouton « Filtres » compte les critères actifs**
Assertions : `Filtres (2)` après un statut et une date.
Échoue si : le compteur ne suit pas et l'utilisateur ne voit pas qu'un critère
invisible borne sa liste.
Origine : ADM GP-03.

**GP-04 | P2 | « Tout effacer »**
Assertions : les critères sont retirés ; l'URL redevient `/grand-public` sans
paramètre (sauf `pageSize` si modifié) ; le compteur revient au total.
Échoue si : le bouton ne retire qu'une partie des critères et le compteur
contredit ce que l'écran montre.
Origine : ADM GP-04.

**GP-05 | P1 | recherche**
Données : un prospect `E2E-GP-LST-*` créé en préparation.
Gestes : taper son téléphone.
Assertions : une seule ligne dans `getByRole('table')` (§1.13) ; son nom affiché
en `<prénom> <nom>`.
Échoue si : la recherche par téléphone n'atteint pas le numéro normalisé, ou rend
plusieurs lignes pour un numéro unique.
Origine : ADM GP-05.

**GP-06 | P1 | état vide filtré**
Gestes : chercher `E2E-GP-inexistant-zzz`.
Assertions : `Aucun prospect ne correspond à ces filtres.` et
`Élargissez la période ou retirez un critère.`
Échoue si : l'état vide filtré est confondu avec l'état vide initial et
l'utilisateur croit la base vide.
Origine : ADM GP-06.

**GP-07 | P1 | pagination**
Gestes : passer `Lignes` à la plus petite valeur, cliquer `Page suivante`.
Assertions : le compteur `<a>–<b> sur <total>` change et l'URL porte `page=2` ;
`Page précédente` est désactivée sur la page 1, `Page suivante` sur la dernière.
Échoue si : la plage affichée ne correspond pas à la page servie, ou les butées
ne sont pas gardées.
Origine : ADM GP-07.

**GP-08 | P2 | grande volumétrie**
Gestes : `pageSize` au maximum.
Assertions : le tableau rend ses lignes dans le délai d'attente par défaut ; le
compteur affiche le total exact renvoyé par `GET /api/v1/prospects` (comparaison
avec l'API).
Échoue si : le compteur ment sur le total et l'utilisateur croit avoir tout vu.
Origine : ADM GP-08.

**GP-09 | P1 | rôle lecteur**
Sessions : SUPERVISEUR puis DIRECTION.
Assertions : l'écran se charge **et** le bouton `Nouveau prospect` est absent
(`toHaveCount(0)`), en haut de page comme dans l'état vide.
Échoue si : un SUPERVISEUR ou une DIRECTION se voit proposer une création que
l'API refusera.
Origine : ADM GP-09.

**GP-10 | P2 | canaux en panne**
Gestes :
`page.route('**/api/v1/referentiels/canaux-provenance*', r => r.fulfill({ status: 500 }))`.
Assertions : le message de panne partielle s'affiche **et** le tableau des
prospects reste rendu.
Échoue si : une panne du référentiel des canaux fait tomber toute la liste.
Origine : ADM GP-10.

**GP-11 | P2 | largeur 375 px**
Assertions : le tableau défile horizontalement (`overflow-x-auto`) ; le compteur
et la pagination restent visibles ; le bouton `Nouveau prospect` reste
atteignable.
Échoue si : la page entière défile latéralement et un geste sort du cadre.
Origine : ADM GP-11.

**GP-12 | P1 | ouverture d'une fiche**
Gestes : cliquer le nom d'une ligne.
Assertions : `waitForURL(/\/grand-public\/[0-9a-f-]{36}$/)` ; la fiche rend le nom
et le téléphone.
Échoue si : le lien de la ligne mène ailleurs, ou la fiche rend une coquille
vide.
Origine : ADM GP-12.

#### 7.6.2 Saisie d'un prospect Grand Public

Route : `/grand-public/nouveau`. Composant :
`components/grand-public/prospect-form.tsx`. Fichier :
`grand-public-saisie.spec.ts`, `serial`. Accès : ADMIN et COMMERCIAL seulement.
Titre du document : **Nouveau prospect Grand Public** ; `<h1>` de page identique,
sous-titre
`Le nom, le prénom et le téléphone suffisent. Le reste se complète plus tard.`
Champs : `Prénom` et `Nom` (obligatoires), téléphone, `Profession` (placeholder
`Rechercher une profession`), groupe `Situation`, `Banque de domiciliation`
(`Choisir une banque`), `Syndicat` (`Choisir un syndicat`), `Revenu mensuel`
(`Choisir une tranche`), `Paiement` (`Comptant`, `Échelonné`),
`Durée de remboursement`, `Canal de provenance` (`Choisir un canal`). Aide :
`Ctrl + Entrée enregistre et enchaîne. Le canal et la durée restent en place.`
Après une saisie : `<n> prospect(s) enregistré(s). Dernier : <nom>.` Boutons :
`Enregistrer et ouvrir la fiche` et `Enregistrer et suivant`
(`Enregistrement…` pendant l'envoi). Toast : `<prénom> <nom> enregistré.`
Le même formulaire est monté **en boîte** depuis la liste, sous le titre
`Nouveau prospect Grand Public` et la description
`Le nom, le prénom et le téléphone suffisent.`, sans le `<h1>`.

**GP-13 | P1 | saisie minimale**
Gestes : prénom `E2E-GP-SAI`, nom `Temoin01`, téléphone `+221781002020`,
`Enregistrer et suivant`.
Assertions : toast `E2E-GP-SAI Temoin01 enregistré.` ; le formulaire se vide
**sauf** le canal et la durée ; le compteur passe à
`1 prospect enregistré. Dernier : …`.
Échoue si : le canal et la durée sont perdus entre deux saisies en rafale, alors
que le formulaire est conçu pour l'enchaînement.
Origine : ADM GP-13.

**GP-14 | P1 | champs vides**
Gestes : `Enregistrer et suivant` sans rien saisir.
Assertions : les messages d'obligation s'affichent sur `Prénom`, `Nom` et le
téléphone ; **aucune requête `POST /api/v1/prospects`** ne part.
Échoue si : un prospect est créé sans nom ou sans téléphone.
Origine : ADM GP-14.

**GP-15 | P1 | numéro déjà pris**
Gestes : rejouer GP-13 avec le même téléphone.
Assertions : le refus du serveur (409) est affiché et **nomme la fiche
existante** ; aucun second prospect créé (recompte par l'API). Relever le texte
exact (§8, **Q-25**).
Échoue si : un doublon de téléphone crée une seconde fiche, ou le refus est muet
et l'utilisateur ressaisit.
Origine : ADM GP-15.

**GP-16 | P2 | raccourci clavier**
Gestes : remplir puis `page.keyboard.press('Control+Enter')`, pas un clic.
Assertions : même comportement que `Enregistrer et suivant`.
Échoue si : le raccourci annoncé par l'aide ne fait rien.
Origine : ADM GP-16.

**GP-17 | P1 | « Enregistrer et ouvrir la fiche »**
Assertions : le navigateur arrive sur `/grand-public/<uuid>` et la fiche porte le
nom saisi.
Échoue si : le bouton enregistre sans ouvrir, ou ouvre une fiche qui n'est pas
celle qui vient d'être créée.
Origine : ADM GP-17.

**GP-18 | P1 | saisie depuis la boîte de la liste**
Gestes : depuis `/grand-public`, cliquer `Nouveau prospect`, enregistrer.
Assertions : la boîte est titrée `Nouveau prospect Grand Public` avec la
description courte ; l'enregistrement ferme la boîte et la nouvelle ligne
apparaît dans le tableau **sans rechargement**.
Échoue si : la boîte de la liste ne rafraîchit pas le tableau et l'utilisateur
croit sa saisie perdue.
Origine : ADM GP-18.

**GP-19 | P2 | caractères spéciaux**
Gestes : prénom `E2E-GP-SAI Ndèye-Awa`, nom `O’Brien`.
Assertions : la fiche et la liste les affichent à l'identique.
Échoue si : un échappement double s'installe ou la chaîne est tronquée à
l'apostrophe.
Origine : ADM GP-19.

**GP-20 | P1 | refus de rôle**
Session : SUPERVISEUR.
Assertions : `/grand-public/nouveau` rend `Accès refusé` et
`La saisie d’un prospect Grand Public est réservé à un autre rôle.`
Échoue si : la garde s'élargit et un rôle en lecture seule écrit des fiches.
Origine : ADM GP-20.

**GP-21 | P2 | largeur 375 px**
Assertions : la grille `sm:grid-cols-2` passe en une colonne ; les deux boutons
d'enregistrement restent atteignables sans défilement horizontal.
Échoue si : un bouton d'enregistrement sort du cadre.
Origine : ADM GP-21.

#### 7.6.3 Fiche d'un prospect Grand Public

Route : `/grand-public/[id]`. Composant :
`components/grand-public/prospect-detail.tsx`. Fichier :
`grand-public-fiche.spec.ts`, `serial`. Titre du document : **Fiche Grand
Public** ; `<h1>` de page : le nom du prospect. Lien de retour :
`Prospects Grand Public` vers `/grand-public`. Cartes : `Le prospect`
(`Situation`, `Profession`, `Canal de provenance`, `Durée du système`),
`Rattachements` (`Banque de domiciliation`, `Syndicat`, `Représentant`,
`Segment`), `Suivi` (`Téléconseiller`, `Saisi le`, `Dernier appel`). Absences
nommées : `Question non posée`, `Non renseignée`, `Aucun`, `Jamais appelé`.
Gestes disponibles si `canEdit` (ADMIN ou COMMERCIAL, statut différent de
`CONVERTI`) : `Intéressé`, `Refusé`, puis `Confirmer la conversion`. Toasts :
`Consentement enregistré.`, `Conversion confirmée.` Boîte de conversion : titre
`Confirmer la conversion`, champ `Offre`. Fiche d'un autre projet :
`Cette fiche relève du projet CHUES`,
`Les deux projets ne partagent aucun écran. Elle se consulte depuis le suivi CHUES.`,
lien `Ouvrir le suivi CHUES` vers `/chues/prospects`. Chargement impossible :
`Cette fiche n’a pas pu être chargée.`

**GP-22 | P1 | fiche complète**
Assertions : les trois cartes rendent leurs libellés ; le téléphone est un lien
`tel:` cliquable ; le badge de statut correspond au statut de la liste.
Échoue si : la fiche rend des libellés sans valeurs, ou un statut différent de
celui que la liste annonce.
Origine : ADM GP-22.

**GP-23 | P1 | les absences sont nommées**
Données : une fiche saisie au minimum.
Assertions : `Situation` affiche `Question non posée` ; `Durée du système`,
`Non renseignée` ; `Segment`, `Aucun` ; `Dernier appel`, `Jamais appelé`.
Échoue si : une absence est rendue par un tiret muet, et l'utilisateur ne sait pas
si la question n'a pas été posée ou si la donnée n'a pas chargé.
Origine : ADM GP-23.

**GP-24 | P1 | consentement**
Gestes : cliquer `Intéressé`, puis `Refusé`.
Assertions : toast `Consentement enregistré.` et le bouton
`Confirmer la conversion` apparaît ; après `Refusé`, le consentement bascule et le
bouton de conversion disparaît.
Échoue si : le consentement est écrit sans que l'écran suive, ou la conversion
reste proposée sur une fiche qui a refusé.
Origine : ADM GP-24.

**GP-25 | P1 | conversion**
Gestes : depuis `Intéressé`, `Confirmer la conversion`, choisir une `Offre`,
confirmer.
Assertions : boîte titrée `Confirmer la conversion` ; toast
`Conversion confirmée.` ; le badge passe à `Converti` et **les trois boutons de
consentement disparaissent**.
Échoue si : une fiche convertie reste modifiable et le consentement est rejoué
après coup.
Origine : ADM GP-25.

**GP-26 | P1 | fiche CHUES ouverte depuis Grand Public**
Gestes : ouvrir `/grand-public/<id d'un prospect CHUES>`.
Assertions : `Cette fiche relève du projet CHUES` et le lien
`Ouvrir le suivi CHUES` pointe sur `/chues/prospects`.
Échoue si : une fiche CHUES est éditable depuis l'écran Grand Public.
Origine : ADM GP-26.

**GP-27 | P1 | identifiant invalide**
Gestes : ouvrir `/grand-public/pas-un-uuid`.
Assertions : l'écran rend un état d'erreur lisible en français, pas une trace ni
une page blanche : `Cette fiche n’a pas pu être chargée.` ou le titre
`Requête refusée` de `QueryErrorState` (§8, **Q-26**).
Échoue si : un identifiant invalide casse l'écran ou rend un message anglais.
Origine : ADM GP-27.

**GP-28 | P1 | rôle lecteur**
Session : SUPERVISEUR.
Assertions : la fiche se charge, mais `Intéressé`, `Refusé` et
`Confirmer la conversion` sont **absents** (`toHaveCount(0)`).
Échoue si : un rôle en lecture seule se voit proposer un geste que l'API
refusera.
Origine : ADM GP-28.

#### 7.6.4 Console Grand Public

Route : `/grand-public/console`. Composant :
`components/console/console-view.tsx`, **écran devenu un renvoi**. Fichier :
`grand-public-console.spec.ts`. Titre du document : **Appeler les prospects** ;
`<h1>` de page : `Rechercher une fiche` ; texte
`Les fiches sont consultées librement. Ouvrez l’annuaire pour chercher un prospect et consigner l’appel.` ;
bouton `Ouvrir l’annuaire`.

**GP-29 | P1 | l'écran se charge**
Session : COMMERCIAL.
Assertions : `toHaveTitle(/Appeler les prospects/)` ; le `<h1>` de page
`Rechercher une fiche` et le texte exact ; aucune file d'appels, aucune carte
clavier.
Échoue si : l'ancien écran de file d'appel revient sur cette route, ou la page ne
rend que la coque.
Origine : ADM GP-29.

**GP-30 | P2 | refus aux rôles d'encadrement**
Sessions : SUPERVISEUR et DIRECTION.
Assertions : `Accès refusé` et
`La file d’appel Grand Public est réservé à un autre rôle.`
Échoue si : la garde `['ADMIN','COMMERCIAL']` s'élargit.
Origine : ADM GP-31.
Le lien mort « Ouvrir l’annuaire » est porté par **ROL-29** (fusion de ADM GP-30
et ADM ROLE-29, qui décrivaient le même scénario).

#### 7.6.5 Rappels Grand Public

Route : `/grand-public/rappels`. La page réexporte la page CHUES ;
`rappels-view.tsx` lit le projet dans l'URL
(`pathname.startsWith('/grand-public') ? 'GRAND_PUBLIC' : 'CHUES'`). Fichier :
`grand-public-rappels.spec.ts`. Titre du document : **Rappels**. Onglets :
`En retard`, `Aujourd’hui`, semaine. États vides : `Aucun rappel en retard`,
`Aucun rappel aujourd’hui`, `Aucun rappel cette semaine`. Filtre par
téléconseiller seulement si le rôle n'est pas COMMERCIAL.

**GP-31 | P1 | les requêtes portent bien le projet Grand Public**
Session : COMMERCIAL.
Gestes : intercepter `GET /api/v1/callbacks*`.
Assertions : le paramètre de projet vaut `GRAND_PUBLIC`.
Échoue si : la file Grand Public affiche des rappels CHUES sous une étiquette
Grand Public. C'est la seule preuve que la page réexportée ne sert pas l'autre
file.
Origine : ADM GP-32.

**GP-32 | P2 | les trois portées et leurs états vides**
Assertions : chaque portée sélectionnée affiche l'état vide correspondant, avec
son libellé exact, quand il n'y a rien.
Échoue si : un état vide est rendu par un tableau sans corps, ou les trois
onglets partagent un texte générique.
Origine : ADM GP-33.

**GP-33 | P2 | le filtre par téléconseiller n'existe que pour l'encadrement**
Sessions : COMMERCIAL puis SUPERVISEUR.
Assertions : absent en COMMERCIAL, présent en SUPERVISEUR.
Échoue si : un téléconseiller peut regarder la file d'un autre.
Origine : ADM GP-34.

#### 7.6.6 Chiffres Grand Public

Route : `/grand-public/statistiques`. Fichier :
`grand-public-chiffres.spec.ts`, `serial`. Composant
`components/chiffres/vue.tsx` (`ChiffresView ecran="grand-public"`), barre
`components/accueil/tableau-de-bord/barre-edition.tsx`. Titre du document :
**Tableau de bord Grand Public** ; titre de barre : **Tableau de bord**. Accès :
ADMIN, SUPERVISEUR, DIRECTION. Disposition :
`GET|PUT|DELETE /api/v1/tableaux-de-bord/grand-public/disposition`, et
`PUT …/par-defaut` réservé à l'ADMIN.
Libellés de cet écran : **« Composer l’écran »** et **« Revenir à l’écran par
défaut »** (§1.9) ; état vide
`Cet écran est vide. Ouvrez « Composer l’écran » pour y poser vos chiffres.` ;
erreur `Les chiffres n’ont pas pu être calculés. Réessayez.` ; message par carte
`Rien sur la période.` ; sélecteur `Téléconseiller regardé` avec
`Toute l’équipe`.

**GP-34 | P1 | l'écran se charge**
Assertions : `toHaveTitle(/Tableau de bord Grand Public/)` ; le bouton
`Composer l’écran` est présent ; l'indicateur de fraîcheur est monté ; aucune
erreur.
Échoue si : l'écran rend la coque sans sa page, ou porte le libellé
« Organiser », qui appartient au tableau de bord des visites.
Origine : ADM GP-35.

**GP-35 | P1 | ouverture du mode**
Gestes : cliquer `Composer l’écran`.
Assertions : l'étiquette `Mode organisation` apparaît ; `Enregistrer` et
`Quitter` sont présents ; **le rafraîchissement automatique est mis en pause**,
et l'indicateur le dit.
Échoue si : le rafraîchissement continue pendant la composition et remplace la
grille en cours d'édition.
Origine : ADM GP-36.

**GP-36 | P1 | ajouter une carte et la retrouver après rechargement**
Gestes : ouvrir le tiroir, poser une carte, `Enregistrer`, recharger.
Assertions : un `PUT /api/v1/tableaux-de-bord/grand-public/disposition` part avec
cette source ; le mode se referme ; la carte est visible ; après rechargement,
elle est toujours là.
Échoue si : une disposition enregistrée ne survit pas au rechargement.
Origine : ADM GP-37.

**GP-37 | P1 | quitter avec des changements**
Gestes : retirer une carte, cliquer `Quitter`, confirmer.
Assertions : la boîte `Quitter sans enregistrer` s'affiche ; après confirmation,
la disposition **d'avant** est restaurée, la carte retirée est de retour.
Échoue si : `Quitter` perd une disposition enregistrée, ou en garde une
abandonnée.
Origine : ADM GP-38.

**GP-38 | P1 | « Proposer par défaut » réservé à l'ADMIN**
Sessions : ADMIN, puis SUPERVISEUR et DIRECTION.
Assertions : en mode organisation, le bouton est présent avec l'état ADMIN et
**absent** (`toHaveCount(0)`) avec SUPERVISEUR et DIRECTION.
**Ne pas cliquer** : cela changerait la disposition de tous les comptes
(§4.3.4). Confirmé côté API : `DashboardsController.putDefault` est
`@Roles(ADMIN)`.
Échoue si : un SUPERVISEUR peut fixer la disposition par défaut de tout le monde.
Origine : ADM GP-41.

**GP-39 | P1 | « Revenir à l'écran par défaut »**
Gestes : après GP-36, cliquer le bouton.
Assertions : il est visible tant que la disposition vient de l'utilisateur ; le
clic envoie un `DELETE` ; la disposition revient à celle par défaut ; le bouton
disparaît.
Échoue si : la remise à zéro n'efface que l'affichage et la disposition
personnelle réapparaît au rechargement.
Origine : ADM GP-39.

**GP-40 | P2 | écran vide**
Gestes : retirer toutes les cartes et enregistrer.
Assertions :
`Cet écran est vide. Ouvrez « Composer l’écran » pour y poser vos chiffres.`
Nettoyage : remettre la disposition par `DELETE` dans le `afterAll`.
Échoue si : un écran sans carte se rend vide et muet, indistinguable d'un
chargement raté.
Origine : ADM GP-40.

**GP-41 | P1 | la période vit dans l'URL**
Gestes : changer la période dans `SelecteurPeriode`, recharger.
Assertions : l'URL porte les paramètres ; le rechargement restitue exactement le
même écran et le même libellé de période (`aria-live="polite"`).
Échoue si : la période ne vit pas dans l'URL et l'écran n'est plus partageable
par lien.
Origine : ADM GP-42.

**GP-42 | P1 | filtre par téléconseiller**
Gestes : choisir une personne dans `Téléconseiller regardé`, puis revenir à
`Toute l’équipe`.
Assertions : l'URL porte `teleconseiller=<id>` et le **déclencheur affiche son
nom**, pas son identifiant ; le retour retire le paramètre.
Échoue si : le sélecteur d'équipe affiche un UUID en clair.
Origine : ADM GP-43.

**GP-43 | P2 | chiffres en panne**
Gestes :
`page.route('**/api/v1/analytics/**', r => r.fulfill({ status: 500 }))`.
Assertions : `Les chiffres n’ont pas pu être calculés. Réessayez.` avec un bouton
`Réessayer` ; la barre latérale reste montée.
Échoue si : la panne des chiffres emporte toute la coque.
Origine : ADM GP-44.

**GP-44 | P1 | montants réservés**
Session : SUPERVISEUR.
Gestes : ouvrir le tiroir des sources.
Assertions : **aucune carte de montant** n'y est proposée. Nommer dans la spec
les sources exactes lues dans `components/chiffres/sources.ts` ; le catalogue est
calculé avec `voitLesMontants = role === 'ADMIN' || role === 'DIRECTION'`.
Échoue si : un SUPERVISEUR voit les montants.
Origine : ADM GP-45.

**GP-45 | P2 | largeur 375 px**
Assertions : la grille de cartes passe en une colonne ; la barre d'édition ne
déborde pas ; le bouton `Composer l’écran` reste atteignable.
Échoue si : la barre d'édition sort du cadre et le mode devient inaccessible au
pouce.
Origine : ADM GP-46.
Le renvoi `/grand-public/tableau-de-bord` est porté par **ROL-26** (fusion de ADM
GP-47, ADM ROLE-26 et CHU TDB-1).

### 7.7 Espace démo

Fichier : `demo-isolement.spec.ts`, `serial`, **exécuté en dernier**. Sessions :
ADMIN, et BANQUE_FINANCE pour DEMO-08. **Seule spec autorisée à basculer d'espace
et à appeler `POST /api/v1/admin/demo/reset`** (§4.3.5).
Existant : `workspaces.spec.ts` porte déjà « l'espace démo se réinitialise et
reste isolé ». **Lire ce test avant d'écrire.** Ce qui manque, et que ce document
demande : l'isolement dans **les deux sens**, le contenu attendu après
réinitialisation, et le comportement du rôle BANQUE_FINANCE en démo.

**Bascule.** Menu de compte (`Compte de <nom complet>`,
`components/layout/user-menu.tsx`), entrée `Ouvrir l’espace démo` /
`Quitter l’espace démo` ; pendant le changement, l'entrée affiche
`Changement d’espace…` ; en cas d'échec, toast
`Le changement d’espace a échoué. Réessayez.` La bascule appelle
`POST /api/auth/workspace` puis `router.refresh()`.
**Bandeau.** `components/layout/demo-banner.tsx` rend une région `role="status"` :
`Espace démo` et
`Données fictives. Les e-mails et les exports intégraux sont désactivés.`
**Réinitialisation.** `/admin/parametres`, carte `Espace démo`, bouton
`Réinitialiser l’espace démo`, toast `Espace démo réinitialisé.` La
réinitialisation est longue : `workspaces.spec.ts` lui accorde 90 secondes.

**Contenu attendu après réinitialisation**
(`packages/database/src/demo-workspace-factory.ts`, `DEMO_SEED_VERSION = '3'`) :
le schéma `demo` est vidé, dix-sept tables de référence sont recopiées depuis
`public` (dont `users` : les comptes de démonstration sont donc les mêmes que
ceux de la base publique), puis la fabrique crée :

| Objet | Quantité | Repère |
| --- | --- | --- |
| Représentants | 8 | `Représentant Démo 01` à `08`, `+221770100001..0008` |
| Prospects | 16 | `Prospect Démo 01` à `16`, `+221770200001..0016` ; les 8 premiers CHUES, les 8 suivants Grand Public (prénom `Grand Public`, situation `INFORMEL`) |
| Campagnes | 2 | `Campagne de démonstration`, `Campagne Grand Public de démonstration` |
| Dossiers bancaires | 3 | `DEMO-001`, `DEMO-002`, `DEMO-003` |

Les compteurs de la carte `Espace démo` portent donc `représentants = 8`,
`prospects = 16`, `campagnes = 2`, `dossiers bancaires = 3`, et `comptes` = le
nombre de comptes actifs de la base publique, variable : le lire par l'API au
même instant plutôt que le figer (§8, **Q-27**).

**Nettoyage obligatoire** : revenir à l'espace **public** dans un `afterAll`
inconditionnel, y compris après un échec. Une session laissée en démo empoisonne
toutes les specs suivantes, qui liraient une base vide.

**DEMO-01 | P1 | bascule vers la démo**
Gestes : ouvrir le menu de compte, cliquer `Ouvrir l’espace démo`.
Assertions : le bandeau `Espace démo` avec sa phrase exacte apparaît en haut de
la coque ; l'entrée du menu devient `Quitter l’espace démo`.
Échoue si : le bandeau ne s'affiche pas et l'utilisateur croit travailler sur les
vraies données.
Origine : ADM DEMO-01.

**DEMO-02 | P1 | retour au public**
Gestes : `Quitter l’espace démo`.
Assertions : le bandeau disparaît (`toHaveCount(0)`) et l'entrée redevient
`Ouvrir l’espace démo`.
Échoue si : la sortie est visuelle mais la session reste en démo, et tout ce qui
suit lit une base fictive.
Origine : ADM DEMO-02.

**DEMO-03 | P1 | réinitialisation**
Gestes : en démo, aller sur `/admin/parametres`, cliquer
`Réinitialiser l’espace démo`, attendre le toast (borne large : la
réinitialisation est longue).
Assertions : toast `Espace démo réinitialisé.` ; les compteurs affichent
exactement `8`, `16`, `2`, `3`, valeurs exactes et non « un nombre ».
Échoue si : les compteurs d'après réinitialisation ne correspondent pas à ce que
la fabrique crée, signe que le jeu de démonstration a dérivé de son contrat.
Origine : ADM DEMO-03.

**DEMO-04 | P1 | contenu attendu**
Gestes : après réinitialisation, ouvrir `/grand-public` puis `/chues/prospects`
en démo.
Assertions : `/grand-public` affiche des lignes `Prospect Démo 09` à `16` avec le
prénom `Grand Public` ; `/chues/prospects` affiche `Prospect Démo 01` à `08`.
Échoue si : les deux projets se mélangent dans le jeu de démonstration, ce qui
donnerait une démonstration fausse au client.
Origine : ADM DEMO-04.

**DEMO-05 | P1 | isolement, sens démo vers public**
Gestes : en démo, créer une visite `E2E-DEMO-VIS-<RUN> Visiteur Demo` par le
formulaire du registre (`/accueil`, entreprise et objet choisis parmi les entrées
actives du schéma `demo`, §8 **Q-28**) **et** un prospect `E2E-DEMO-vers-public`
(téléphone `+221781002100`) par le formulaire Grand Public ; quitter la démo ;
chercher les deux en public.
Assertions : en démo, chaque recherche sur son préfixe renvoie exactement une
ligne ; en public, `/accueil` sur `Tout le registre` renvoie **zéro** ligne pour
le préfixe de visite et rend `Aucune visite pour cette recherche`, et
`/grand-public` rend `Aucun prospect ne correspond à ces filtres.` ; l'API
publique interrogée depuis le contexte de test ne renvoie ni l'un ni l'autre.
Échoue si : le schéma `demo` fuit dans `public`. C'est exactement la régression
corrigée récemment, et rien d'autre ne la surveille.
Origine : ADM DEMO-05 + ACC I1 (fusion : même défaut, union des deux écrans
d'écriture).

**DEMO-06 | P1 | isolement, sens public vers démo**
Gestes : en public, créer une visite `E2E-DEMO-VIS-<RUN> Visiteur Public` et un
prospect `E2E-DEMO-vers-demo` (`+221781002101`) ; basculer en démo ; chercher les
deux préfixes.
Assertions : zéro ligne dans les deux écrans, en démo.
Échoue si : l'isolement ne fonctionne que dans un sens. Le cas le plus dangereux
est celui-ci : des données réelles visibles dans un espace présenté comme
fictif.
Origine : ADM DEMO-06 + ACC I2 (fusion).

**DEMO-07 | P1 | la réinitialisation n'atteint pas le public**
Gestes : en public, relever le total de prospects publics **et** la visite créée
en DEMO-06 avec sa référence ; réinitialiser la démo ; relever de nouveau.
Assertions : le total de prospects publics est **identique** avant et après ; la
visite de DEMO-06 est **toujours** là, avec la même référence.
Échoue si : `POST /admin/demo/reset` touche le schéma `public` : perte de données
irréversible en production. C'est le défaut le plus coûteux que ce fichier
protège.
Origine : ADM DEMO-07 + ACC I3 (fusion).

**DEMO-08 | P1 | un agent bancaire ne gagne aucun droit en démo**
Session : BANQUE_FINANCE, contexte porteur de `e2e/.auth/banque.json`.
Gestes : basculer en démo ; ouvrir `/chues/banque` et `/chues/dossiers` ; rejouer
trois routes refusées de **ROL-21** ; remettre le compte en public dans le
`afterAll`.
Assertions : le bandeau s'affiche ; les deux écrans rendent leur contenu avec les
trois dossiers `DEMO-001` à `DEMO-003` ; les routes fermées à ce rôle restent
refusées **en démo comme en public**.
Échoue si : un agent bancaire gagne des droits en démo, l'espace de démonstration
devenant un contournement d'autorisation.
Origine : ADM DEMO-08.

**DEMO-09 | P2 | l'export intégral est fermé en démo**
Gestes : en démo, ouvrir `/admin/parametres`.
Assertions : la carte `Export intégral de la base` est absente
(`toHaveCount(0)` sur le titre) ; `database-dump-section.tsx` la retire dans
l'espace de démonstration.
Échoue si : l'export intégral est proposé en démo, alors que le bandeau annonce
que les exports intégraux sont désactivés.
Origine : ADM DEMO-09.

### 7.8 Transversal

#### 7.8.1 Boîte de réception hors coque

Route : `/notifications`. Réservée à ADMIN, DIRECTION, SUPERVISEUR,
BANQUE_FINANCE, ACCUEIL (`INBOX_ROLES`). Le COMMERCIAL en est exclu : ses
notifications visent l'application mobile. L'ADMIN est renvoyé vers
`/admin/notifications?onglet=reception` (**ROL-24**). Fichier :
`transversal-notifications.spec.ts`.

**TRA-01 | P1 | un rôle à boîte ne voit que sa boîte**
Session : SUPERVISEUR.
Assertions : `/notifications` rend l'onglet `Boîte de réception` **seul**
(`Historique` et `Gabarits` à `toHaveCount(0)`) ; le bouton
`Nouvelle notification` est absent.
Échoue si : un rôle sans droit de composition se voit proposer l'envoi, que l'API
refusera.
Origine : ADM TR-01.

**TRA-02 | P1 | un téléconseiller n'a ni boîte ni cloche**
Session : COMMERCIAL.
Assertions : `/notifications` rend `Accès refusé` et
`Les notifications est réservé à un autre rôle.` **et** la cloche est absente de
la barre supérieure.
Échoue si : un COMMERCIAL voit une cloche qui le mène droit sur un refus.
Origine : ADM TR-02.

**TRA-03 | P2 | la cloche par rôle, et sa destination**
Sessions : ADMIN, DIRECTION, SUPERVISEUR, BANQUE_FINANCE, ACCUEIL, et COMMERCIAL
en contre-épreuve.
Assertions : la cloche est présente pour les cinq rôles à boîte, avec un compte
de **1** ; elle est absente (compte de 0) pour le COMMERCIAL ; son lien mène à
`inboxPathFor(role)` : `/admin/notifications?onglet=reception` pour l'ADMIN,
`/notifications` pour les autres.
Échoue si : `INBOX_ROLES` change et un rôle sans boîte se voit proposer une
cloche morte ; ou un rôle à boîte perd son accès ; ou l'ADMIN se retrouve avec
deux boîtes.
Origine : ADM TR-03 + ACC C11 (fusion : même preuve, union des six rôles et de la
destination du lien).

Note : le scénario « le jeton reste hors de portée du JavaScript » du plan Admin
(TR-04) **n'est pas repris** : il est déjà couvert par `e2e/prospects.spec.ts` en
session ADMIN, et par **ACC-CNX-12** (coque Accueil) et **CHU-TRV-01** (session
COMMERCIAL). Ne pas le dupliquer une quatrième fois.

#### 7.8.2 Session, panne d'API, codes d'erreur

Fichier : `transversal-pannes.spec.ts`, `serial`. Session : ADMIN.

**TRA-04 | P1 | expiration en cours de navigation**
Gestes : sur `/grand-public`, effacer les cookies de session
(`page.context().clearCookies()`), puis déclencher une action qui appelle l'API
(changer un filtre) ; puis `page.reload()`.
Assertions : le relais `/api/v1/*` répond 401 avec `code: 'SESSION_EXPIRED'` et
efface les cookies ; le toast ou l'état d'erreur affiche
`Session expirée. Rechargez la page.` ; le rechargement mène à `/connexion`.
Contrainte : **ce test est le dernier de son fichier**, ou il utilise un contexte
navigateur dédié, pour ne pas casser les tests suivants. Ajuster l'assertion à ce
qui est réellement observé (§8, **Q-29**).
Échoue si : une session expirée laisse l'écran figé sans rien dire.
Origine : ADM TR-05.

**TRA-05 | P1 | API injoignable**
Gestes : `page.route('**/api/v1/**', r => r.abort('connectionrefused'))` sur
`/grand-public`.
Assertions : `QueryErrorState` rend le titre `Serveur injoignable` et le texte
`Serveur injoignable. Vérifiez la connexion, puis réessayez.`, avec un bouton
`Réessayer` ; la barre latérale et la barre supérieure restent montées.
Échoue si : une API éteinte produit une page blanche ou un message anglais.
Origine : ADM TR-06.

**TRA-06 | P1 | 429**
Gestes :
`page.route('**/api/v1/prospects*', r => r.fulfill({ status: 429, contentType: 'application/json', body: '{}' }))`.
**Ne jamais provoquer un vrai 429 en martelant l'API.**
Assertions : le message `Trop de requêtes. Patientez quelques secondes.`
s'affiche.
Échoue si : un 429 est présenté comme une panne serveur et l'utilisateur relance
en boucle, aggravant la limitation.
Origine : ADM TR-07.

**TRA-07 | P2 | 500**
Gestes : même méthode avec 500.
Assertions : titre `Erreur serveur`, texte `Erreur serveur (500). Réessayez.`,
bouton `Réessayer` présent, les 5xx étant réessayables.
Échoue si : une erreur serveur ne propose pas de nouvel essai alors qu'elle peut
se résoudre ainsi.
Origine : ADM TR-08.

**TRA-08 | P2 | 403 sur une donnée**
Gestes : répondre 403 sur une route de données.
Assertions : titre `Accès refusé` dans `QueryErrorState`, **sans** bouton
`Réessayer`, l'erreur n'étant pas réessayable.
Échoue si : un bouton `Réessayer` est proposé sur une erreur qui ne peut pas se
résoudre par un nouvel essai, et l'utilisateur s'acharne.
Origine : ADM TR-09.

#### 7.8.3 404 et page d'erreur de rendu

Fichier : `transversal-erreurs.spec.ts`. Session : ADMIN.

**TRA-09 | P2 | 404 sur un chemin profond inconnu**
Route : `/admin/inexistant/profond`.
Assertions : `<h1>Page introuvable</h1>`, texte
`Cette adresse ne correspond à aucun écran du panel.`, lien
`Revenir aux espaces` vers `/espaces`.
Échoue si : un chemin profond inconnu rend une page vide au lieu du 404, ou est
absorbé par un segment dynamique.
Référence : `/comptabilite` est **déjà couvert** par `e2e/redirections.spec.ts` :
citer, ne pas dupliquer. `/accueils` est couvert par **ACC-CNX-14**.
Origine : ADM TR-10.

**TRA-10 | P1 | page d'erreur de rendu**
Gestes : sur `/grand-public`, intercepter `GET /api/v1/prospects*` et répondre un
JSON structurellement invalide pour le composant (par exemple
`{"items": null}`), ce qui fait échouer le rendu du tableau.
Assertions : `Cet écran n’a pas pu s’afficher`, le texte
`Rien n’a été perdu et le reste du panneau fonctionne.`, le bouton `Réessayer` et
le lien `Revenir aux espaces` ; **la barre latérale et la barre supérieure
restent montées** (`getByRole('navigation', { name: 'Navigation principale' })`
reste visible), la frontière d'erreur étant posée sous `layout.tsx`.
Si la réponse dégradée ne fait pas tomber le rendu, l'agent le note dans son
retour et cherche un autre déclencheur **documenté** ; il n'invente pas un
`page.evaluate(() => { throw … })`, qui n'emprunte pas le même chemin, et il ne
laisse pas le scénario passer à vide (§8, **Q-12**).
Échoue si : une exception de composant remplace tout le panneau par la page
d'erreur anglaise de Next ; la page d'erreur ne propose aucune sortie ; ou la
navigation disparaît avec le contenu.
Origine : ADM TR-11 + ADM TR-12 (fusion : TR-12 était la clause de repli de
TR-11, pas un scénario distinct). Voir aussi **ACC-COQ-12**, même frontière sur
`/accueil/tableau-de-bord`.

#### 7.8.4 Largeur mobile

Fichier : `transversal-mobile.spec.ts`. Session : ADMIN.

**TRA-11 | P1 | le tiroir de navigation à 375 px**
Route : `/admin/commerciaux`, viewport 375 × 812.
Assertions : la barre latérale est masquée ; le bouton `Ouvrir la navigation` la
déploie dans un panneau latéral dont le titre accessible est
`Navigation principale` ; un clic sur une entrée referme le panneau et navigue.
Échoue si : le panneau de navigation ne s'ouvre pas, et le panel devient
inutilisable sur téléphone.
Origine : ADM TR-13.

**TRA-12 | P2 | aucun débordement horizontal**
Routes : `/grand-public`, `/admin/parametres`, `/grand-public/statistiques`, à
375 px.
Assertions : `document.scrollingElement.scrollWidth <= innerWidth + 1` ; le titre
de la barre supérieure reste lisible, tronqué et non superposé.
Échoue si : un écran déborde horizontalement à 375 px et un bouton d'action
principale sort du cadre.
Origine : ADM TR-14.

#### 7.8.5 Accessibilité axe

`e2e/accessibility.spec.ts` existe et balaie une table de routes avec
`@axe-core/playwright`, en forçant le thème clair et en désactivant les
animations. **Aucun agent ne le modifie** (§3.6). Les scénarios ci-dessous sont
**complémentaires** et ne rebalaient pas ce qui l'est déjà (quota d'appels,
§4.4.2).

**TRA-13 | P1 | les routes Grand Public ne sont pas analysées**
Fichier : `accessibilite-grand-public.spec.ts`. Session : ADMIN.
Routes : `/grand-public`, `/grand-public/nouveau`, `/grand-public/<uuid>`,
`/grand-public/console`, `/grand-public/rappels`, `/grand-public/statistiques`,
`/admin/referentiels/issues-appel`.
Assertions : `AxeBuilder().analyze()` ne rend aucune violation, route par route.
Échoue si : axe trouve une violation sur un écran du périmètre, jamais analysé
jusqu'ici : la table existante ne contient que les **anciennes** racines
(`/tableau-de-bord`, `/statistiques`, `/console`, `/campagnes`, `/commerciaux`),
qui passent par le renvoi `[ancien]`.
Origine : ADM TR-15.

**TRA-14 | P1 | aucun état modal n'est analysé**
Fichier : `accessibilite-modales.spec.ts`. Session : ADMIN.
Gestes : ouvrir puis analyser la boîte `Nouvel utilisateur`, la boîte de
désactivation d'un référentiel, la popup `Version publiée`, le composeur
`Nouvelle notification`.
Assertions : aucune violation axe sur chaque état ouvert.
Échoue si : une boîte de dialogue n'a pas de nom accessible, ou piège le focus.
Les boîtes sont la source classique de ces défauts, et aucune n'est analysée
aujourd'hui.
Origine : ADM TR-16.

**TRA-15 | P1 | le mode composition de `/grand-public/statistiques` n'est pas analysé**
Fichier : `accessibilite-modales.spec.ts`. Session : SUPERVISEUR.
Gestes : ouvrir « Composer l’écran », analyser.
Assertions : aucune violation axe.
Échoue si : les poignées de réorganisation posent des attributs `aria-*`
invalides, ou ne sont pas atteignables au clavier. Le test existant n'analyse que
le mode « Organiser » du tableau de bord des visites.
Origine : ADM TR-17.

**TRA-16 | P2 | aucun rôle autre qu'ADMIN n'est analysé**
Fichier : `accessibilite-roles-themes.spec.ts`.
Gestes : analyser `/espaces` avec l'état ACCUEIL (trois tuiles grisées : le
contraste du gris est le risque), et la page `Accès refusé` avec l'état
COMMERCIAL sur `/admin/parametres`.
Assertions : aucune violation axe.
Échoue si : un contraste tombe sous le seuil sur une tuile désactivée, ou la page
de refus n'est pas correctement structurée.
Origine : ADM TR-18.

**TRA-17 | P2 | le thème sombre n'est jamais analysé**
Fichier : `accessibilite-roles-themes.spec.ts`. Session : ADMIN.
Gestes : rejouer trois écrans en `colorScheme: 'dark'` (le test existant force
`colorScheme: 'light'` et vérifie `html.light`).
Assertions : aucune violation axe.
Échoue si : un contraste tombe sous le seuil en thème sombre. La barre latérale
CHUES en noir est explicitement traitée dans le code (`accent-on-dark`), ce qui
en fait un risque réel.
Origine : ADM TR-19.

**TRA-18 | P3 | la largeur mobile n'est jamais analysée**
Fichier : `accessibilite-roles-themes.spec.ts`. Session : ADMIN.
Gestes : rejouer trois écrans à 375 px.
Assertions : aucune violation axe.
Échoue si : une cible tactile passe sous la taille minimale, ou l'ordre de
lecture change au point de rendre l'écran incompréhensible au lecteur d'écran.
Origine : ADM TR-20.

---

## 8. Questions ouvertes

Chacune est une question précise à trancher **avant** d'écrire l'assertion
concernée. L'agent qui la lève inscrit la réponse observée dans son retour. Il
ne devine pas, et il n'élargit pas son sélecteur pour éviter la question.

Colonne « Qui répond » : **navigateur** (l'agent l'observe lui-même avant
d'écrire), **mainteneur** (décision d'infrastructure ou d'environnement),
**produit** (décision du propriétaire produit).

| # | Question exacte | Scénarios bloqués | Qui répond |
| --- | --- | --- | --- |
| **Q-01** | Sur `/chues/statistiques`, la carte « Représentants joints » affiche-t-elle « 50 », « 50 % » ou « 50,0 % » ? La phrase « des appels aboutissent » est-elle visible à l'œil, ou seulement en `sr-only` ? | CHU-CHF-13, CHU-CHF-14, CHU-CHF-15 | navigateur |
| **Q-02** | Sur une période sans aucun appel, la carte « Représentants joints » affiche-t-elle « 0 » ou une mention « Sans objet » ? | CHU-CHF-17 | navigateur, puis **produit** si l'écart est confirmé |
| **Q-03** | Sur une base amorcée, `GET /api/v1/supervision/activite` avec `actFrom=2026-02-03T00:00:00.000Z` et `actTo=2026-02-03T23:59:59.999Z` rend-il des totaux nuls avant que le spec ne pose ses données ? Sinon, quelle journée est libre ? | CHU-CHF-13 à CHU-CHF-19 | navigateur ou API |
| **Q-04** | `/chues/console` porte-t-elle deux `<h1>` (barre supérieure « Convertir un prospect » et page « Rechercher une fiche ») ? Lequel `getByRole('heading', { level: 1 })` trouve-t-il en premier ? | CHU-ET3-01 | navigateur |
| **Q-05** | Après désactivation d'une entrée de liste du registre, apparaît-elle encore dans le combobox `ENTREPRISE` du bloc `Filtres avancés` de `/accueil` ? Les deux composants tirent le même `GET /visites/referentiels` avec `activeOnly=true`. | ACC-LST-12 | navigateur, puis **produit** : le dialogue promet « Reste disponible en filtre et en export » |
| **Q-06** | `GET /api/v1/visites?periode=tout&pageSize=1` renvoie quel `meta.total` sur une base fraîchement amorcée ? | ACC-REG-17, ACC-IMP-06, ACC-IMP-07, ACC-XLS-09, ACC-XLS-10 | **mainteneur** : décider d'un semis dédié ou déclarer ces scénarios non joués |
| **Q-07** | Combien de prospects CHUES la base de développement contient-elle ? | CHU-PRO-07 | **mainteneur** |
| **Q-08** | `GET /api/v1/visites/statistiques?from=2026-12-31&to=2026-01-01` renvoie-t-il 400 avec `VISITE_STATS_RANGE_INVALID`, ou 200 avec un total nul ? | ACC-TDB-04 (portée réelle de la garde) | navigateur ou API |
| **Q-09** | Quel nom accessible Playwright expose-t-il pour un `FilterCombobox` requis ? Le calcul attendu est `ENTREPRISE Obligatoire Choisir`, mais l'espacement dépend du navigateur. | ACC-REG-03, ACC-REG-05, ACC-REG-14 | navigateur |
| **Q-10** | Quel est le nom accessible exact du bouton de la cloche à zéro non-lue, et à au moins une ? Il vient de `bellLabel(unreadCount)` dans `lib/data/inbox.ts`. | ACC-COQ-09, TRA-03 | navigateur |
| **Q-11** | La connexion à `/connexion` avec `fixture.accueil@cpi.sn` et la valeur de `SEED_FIXTURE_PASSWORD` du `.env` aboutit-elle sur `/espaces`, et le compte est-il actif ? | tous les scénarios en session ACCUEIL | **mainteneur** (§3.1) |
| **Q-12** | La charge falsifiée décrite fait-elle apparaître « Cet écran n’a pas pu s’afficher » ? Sinon, quel autre point d'entrée du périmètre lève une exception de rendu ? | ACC-COQ-12, TRA-10 | navigateur |
| **Q-13** | Quelle est la liste `nav.getByRole('link').allTextContents()` réellement rendue pour un ADMIN sur `/chues`, replis fermés ? `navSections` concatène deux blocs écrits à des endroits différents de `nav-items.ts`. | ROL-09 | navigateur |
| **Q-14** | Cliquer `Ouvrir l’impression` avec la portée « La page affichée » laisse-t-il la page interactive, ou la suite du test se bloque-t-elle en Chromium headless ? | ACC-IMP-04, ACC-IMP-06 (repli : `emulateMedia` sans jamais cliquer) | navigateur |
| **Q-15** | La base amorcée contient-elle au moins un lot d'export ouvrable par son identifiant, ou faut-il en créer un ? | ROL-27, ROL-30 | **mainteneur** |
| **Q-16** | `DB_DUMP_ENABLED` est-elle posée sur l'environnement de test, et la carte « Export intégral de la base » est-elle rendue ? | ADM-PAR-04, DEMO-09 | **mainteneur** (§3.4) |
| **Q-17** | Les trois pastilles de période de la supervision s'appellent-elles « Aujourd’hui », « Cette semaine », « 7 derniers jours », et la quatrième « Période personnalisée » ? `PERIOD_LABELS` vit dans `lib/data/admin.ts`. | CHU-SUP-03 | navigateur |
| **Q-18** | `A_APPELER`, `APPELE` et `ABANDONNE` s'affichent-ils « À appeler », « Appelé », « Abandonné » ? `SUGGESTION_STATUS_LABELS` vit dans `lib/data/suggestions.ts`. | CHU-SUG-03, CHU-SUG-04 | navigateur |
| **Q-19** | Un rappel promis par un superviseur apparaît-il dans la file, et son auteur figure-t-il dans le filtre « Téléconseiller » ? `rappels-view.tsx` demande `fetchUsers({ role: 'COMMERCIAL' })` alors que `/chues/statistiques` inclut désormais SUPERVISEUR et DIRECTION dans le plateau. | CHU-RAP-07 | navigateur, puis **produit** : les deux écrans donneraient deux définitions du plateau |
| **Q-20** | « 0 » et « -5000 » laissent-ils le bouton « Confirmer l’encaissement » désactivé ? `workspaces.spec.ts` ne vérifie que le champ vide. | CHU-DOSD-01, CHU-DOSD-02 | navigateur |
| **Q-21** | Deux onglets qui avancent le même dossier produisent quel résultat : deux transitions, un refus nommé, ou un saut d'étape ? Aucune trace d'un jeton de version dans le détail lu. | CHU-DOSD-07 | navigateur, puis **produit** |
| **Q-22** | Cliquer « Excel » sur un lot déclenche-t-il un événement `download` Playwright, ou une navigation ? Le serveur pose-t-il `Content-Disposition: attachment` ? `lots-export-view.tsx` rend un `<a href>` sans attribut `download`. | CHU-LOT-05, CHU-LOT-06, CHU-LOT-07 | navigateur |
| **Q-23** | Que dit exactement le toast `CPI GO <?> publiée.` après la publication de `cpi-go-v7.apk` ? Le `versionName` n'a pas été extrait du manifeste. | ADM-APK-01, ADM-APK-13, ADM-APK-14 | navigateur ; lire la valeur une fois et la figer en constante nommée, jamais un `/CPI GO .+ publiée\./` |
| **Q-24** | `/admin/commerciaux?page=2` affiche-t-il la deuxième page (seule l'interface manque) ou ignore-t-il le paramètre (la lecture aussi est cassée) ? | ADM-USR-17 | navigateur, puis **produit** |
| **Q-25** | Quel texte exact s'affiche quand un téléphone de prospect Grand Public est déjà pris, et nomme-t-il la fiche existante avec un lien ? | GP-15 | navigateur |
| **Q-26** | `/grand-public/<non-uuid>` affiche-t-il le titre `Requête refusée` de `QueryErrorState` ou le repli `Cette fiche n’a pas pu être chargée.` ? Les deux chemins existent selon que l'erreur est levée au rendu serveur ou côté client. | GP-27 | navigateur |
| **Q-27** | Le compteur `comptes` de la carte « Espace démo » doit-il être figé, ou seulement comparé au décompte lu par l'API sur `public` au même instant ? Il recopie les utilisateurs de `public`, dont le nombre dépend de ce que les autres specs ont créé. | DEMO-03 | **mainteneur** ; recommandation : le comparer, ne pas le figer, et le dire en commentaire |
| **Q-28** | Après `POST /admin/demo/reset`, la liste `ENTREPRISE` du formulaire de saisie du registre, en espace démo, est-elle non vide, et quelles sont ses entrées ? | DEMO-05 | navigateur |
| **Q-29** | Après `page.context().clearCookies()`, une action cliente rend-elle `Session expirée. Rechargez la page.` dans un toast, ou le prochain rendu serveur renvoie-t-il directement vers `/connexion` sans que le message apparaisse jamais ? Le layout du panel est `force-dynamic`. | TRA-04 | navigateur |
| **Q-30** | La carte titrée « Reste à appeler » affiche-t-elle le nombre d'appels déjà consignés ? Son extraction lit `activite.totals.calls` avec la légende « appels consignés sur la période ». | CHU-CHF-01, CHU-DSP-04 | navigateur, puis **produit** : `Plan.md` §D3 prévoit de supprimer la carte |
| **Q-31** | `getByRole('combobox', { name: 'Cible' })` trouve-t-il le `<select>` brut de la création de lot, ou faut-il passer par `getByLabel` ? Un audit axe sur cet écran remonte-t-il une violation ? Il est enveloppé dans un `<label>` sans `htmlFor` ni `aria-label`. | CHU-LOT-03, CHU-LOT-04 | navigateur (après livraison du lot web) |
| **Q-32** | Quelle valeur porte réellement `SEED_FIXTURE_PASSWORD` sur l'environnement de test au moment de l'exécution, et l'alignement de `e2e/fixtures.ts` et `e2e/auth.setup.ts` est-il committé ? | **tout** : sans réponse, les cinq états de session non-admin ne se posent pas et rien de la matrice des rôles ne tourne | **mainteneur** (§3.1). C'est le **premier blocage à lever** |

---

## 9. Récapitulatif chiffré

### 9.1 Par domaine et par priorité

| Domaine | Préfixe | P1 | P2 | P3 | Total |
| --- | --- | --- | --- | --- | --- |
| Matrice des rôles | `ROL-` | 24 | 6 | 0 | **30** |
| Connexion, hub, coque, espace Accueil | `ACC-` | 37 | 46 | 11 | **94** |
| Espace Projet CHUES | `CHU-` | 75 | 84 | 11 | **170** |
| Espace Admin | `ADM-` | 43 | 26 | 9 | **78** |
| Espace Projet Grand Public | `GP-` | 27 | 18 | 0 | **45** |
| Espace démo | `DEMO-` | 8 | 1 | 0 | **9** |
| Transversal et accessibilité | `TRA-` | 10 | 7 | 1 | **18** |
| **Total** | | **224** | **188** | **32** | **444** |

### 9.2 Par sous-domaine

| Sous-domaine | Identifiants | Total |
| --- | --- | --- |
| Atterrissage et tuiles | ROL-01 à ROL-06 | 6 |
| Navigation par rôle et coque | ROL-07 à ROL-16 | 10 |
| Balayage des routes interdites | ROL-17 à ROL-22 | 6 |
| Renvois | ROL-23 à ROL-27 | 5 |
| Trous relevés | ROL-28 à ROL-30 | 3 |
| Connexion, session, redirections | ACC-CNX-01 à 14 | 14 |
| Hub des espaces | ACC-HUB-01 à 05 | 5 |
| Coque du panel | ACC-COQ-01 à 12 | 12 |
| Registre des visites | ACC-REG-01 à 18 | 18 |
| Impression du registre | ACC-IMP-01 à 07 | 7 |
| Tableau de bord des visites | ACC-TDB-01 à 14 | 14 |
| Listes du registre | ACC-LST-01 à 12 | 12 |
| Import du registre | ACC-XLS-01 à 12 | 12 |
| Mon travail | CHU-HUB-01 à 08 | 8 |
| Étape 1, qualification | CHU-ET1-01 à 14 | 14 |
| Étape 2, saisie | CHU-ET2-01 à 09 | 9 |
| Étape 3, conversion | CHU-ET3-01 à 06 | 6 |
| Chiffres CHUES | CHU-CHF-01 à 21 | 21 |
| Composition et disposition CHUES | CHU-DSP-01 à 12 | 12 |
| Ancienne route de tableau de bord | CHU-TDB-01 | 1 |
| Supervision | CHU-SUP-01 à 08 | 8 |
| Rappels promis | CHU-RAP-01 à 08 | 8 |
| Représentants, liste | CHU-REP-01 à 07 | 7 |
| Représentants, fiche | CHU-REPD-01 à 05 | 5 |
| Import des représentants | CHU-IMP-01 à 05 | 5 |
| Prospects CHUES | CHU-PRO-01 à 08 | 8 |
| Contacts recommandés | CHU-SUG-01 à 06 | 6 |
| Dossiers, liste | CHU-DOS-01 à 06 | 6 |
| Dossiers, ouverture | CHU-DOSN-01 à 05 | 5 |
| Dossiers, détail | CHU-DOSD-01 à 07 | 7 |
| Dossiers, étapes | CHU-DOSE-01 à 04 | 4 |
| Dossiers, export | CHU-DOSX-01 à 03 | 3 |
| Tableau de bord bancaire | CHU-BQ-01 à 05 | 5 |
| Demandes de création | CHU-DMC-01 à 06 | 6 |
| Lots d'export | CHU-LOT-01 à 09 | 9 |
| Transverse CHUES | CHU-TRV-01 à 07 | 7 |
| Racine Admin | ADM-ROOT-01 | 1 |
| Comptes utilisateurs | ADM-USR-01 à 17 | 17 |
| Listes de référence | ADM-REF-01 à 12 | 12 |
| Issues d'appel | ADM-ISS-01 à 07 | 7 |
| Imports de masse | ADM-IMP-01 à 08 | 8 |
| Notifications | ADM-NOT-01 à 10 | 10 |
| Paramètres | ADM-PAR-01 à 05 | 5 |
| Publication Android | ADM-APK-01 à 18 | 18 |
| Grand Public, liste | GP-01 à 12 | 12 |
| Grand Public, saisie | GP-13 à 21 | 9 |
| Grand Public, fiche | GP-22 à 28 | 7 |
| Grand Public, console | GP-29, GP-30 | 2 |
| Grand Public, rappels | GP-31 à 33 | 3 |
| Grand Public, chiffres | GP-34 à 45 | 12 |
| Espace démo | DEMO-01 à 09 | 9 |
| Notifications hors coque | TRA-01 à 03 | 3 |
| Session, pannes, codes d'erreur | TRA-04 à 08 | 5 |
| 404 et erreur de rendu | TRA-09, TRA-10 | 2 |
| Largeur mobile | TRA-11, TRA-12 | 2 |
| Accessibilité axe | TRA-13 à 18 | 6 |

### 9.3 Par fichier de spec

**72 fichiers**, dont **71 nouveaux** et **1 existant** confié au mainteneur
central (`prospects.spec.ts`, pour CHU-TRV-02).

| Bloc | Fichiers | Scénarios |
| --- | --- | --- |
| Matrice des rôles (§5.3) | 5 | 30 |
| Espace Accueil (§5.4) | 9 | 94 |
| Espace CHUES (§5.5) | 37 | 170 |
| Espace Admin (§5.6) | 7 | 78 |
| Grand Public (§5.7) | 6 | 45 |
| Démo et transversal (§5.8) | 8 | 27 |

Répartition la plus lourde : `chues-dossiers.banque.spec.ts` (19 scénarios),
`admin-utilisateurs.spec.ts` (17), `ADM-APK` dans `android-release.spec.ts` (18),
`accueil-registre.spec.ts` (18), `chues-chiffres.superviseur.spec.ts` (15).
Un agent qui reçoit l'un de ces fichiers reçoit un lot entier : il ne le découpe
pas et ne le rend pas partiellement sans déclarer ce qu'il n'a pas écrit.

### 9.4 Écrivables maintenant contre cible mouvante

| État | Nombre | Détail |
| --- | --- | --- |
| Écrivables maintenant | **432** | tout le reste |
| Cible mouvante, à ne pas écrire tant que le lot web n'est pas livré | **12** | CHU-ET3-02 à CHU-ET3-06 (5), CHU-LOT-03 à CHU-LOT-09 (7) |
| Écrivables aujourd'hui **mais** marqués cible mouvante (l'attente peut changer sous le test) | 6 | CHU-ET3-01, CHU-LOT-01, CHU-LOT-02, ROL-30, CHU-HUB-06, ACC-COQ-04 |
| Bloqués par un prérequis d'infrastructure | 1 | CHU-PRO-02 (septième état de session, §3.2) |
| Conditionnels à la volumétrie, déclarés non joués si le seuil n'est pas atteint | 7 | ACC-REG-17, ACC-IMP-06, ACC-IMP-07, ACC-XLS-09, ACC-XLS-10, CHU-PRO-07, CHU-REP-05 |

### 9.5 Attendus rouges en l'état du dépôt

Ces scénarios doivent être écrits et **laissés rouges**. Un agent qui les rend
verts a soit corrigé l'application (interdit, §4.2.4), soit assoupli son
assertion (interdit, §4.5).

| Cause | Scénarios | Nombre |
| --- | --- | --- |
| Virgule SQL de `supervision.service.ts:259` (§1.1) | CHU-CHF-01, CHU-CHF-02, CHU-CHF-05 à CHU-CHF-21, CHU-DSP-01 à CHU-DSP-12, CHU-SUP-01 à CHU-SUP-07, CHU-TRV-03, CHU-TRV-04, ROL-26 (partie CHUES) | 41 |
| `/accueil` sans `guardRoles` (§1.4) | ROL-28 | 1 |
| Lien mort `/grand-public/prospects` (§1.5) | ROL-29 | 1 |
| Console vidée, `?fiche=` ignoré (§2.1) | CHU-ET3-01, CHU-RAP-04, CHU-RAP-08 | 3 |
| Aucune pagination sur `/admin/commerciaux` (§1.10) | ADM-USR-17 | 1 |
| Aucun état vide sur les issues d'appel (§1.11) | ADM-ISS-07 | 1 |
| **Total attendu rouge** | | **48** |

Les scénarios CHU-CHF-03 et CHU-CHF-04 (refus de rôle) ne touchent pas
l'endpoint cassé : ils doivent passer. CHU-SUP-08 non plus.

Quatre fichiers de spec **existants** sont par ailleurs déjà rouges pour cause de
libellés et d'écrans périmés (§1.6) : `roles.anon.spec.ts`,
`accessibility.spec.ts`, `prospects.spec.ts`, `console.spec.ts`. Aucun agent ne
les corrige ; leur sort appartient au mainteneur central (§3.6).

### 9.6 Traçabilité des fusions

Le total des trois plans d'origine était de **459** scénarios (104 + 172 + 183).
Quinze doublons réels ont été fusionnés, chacun gardant **l'union** des
assertions et des cas limites, jamais leur intersection. Le total final est donc
de **444**.

| Identifiant retenu | Identifiants d'origine fusionnés | Motif |
| --- | --- | --- |
| ROL-01 | ADM ROLE-01 + ACC B1 + ACC B2 | même tuiles, mêmes destinations pour l'ADMIN |
| ROL-02 | ADM ROLE-02 + ACC B6 | idem pour la DIRECTION |
| ROL-05 | ADM ROLE-05 + ACC B5 | idem pour l'ACCUEIL |
| ROL-01 à ROL-06 | ACC B7 réparti sur les six | la table d'atterrissage par rôle est la même que les destinations de tuile |
| ROL-16 | ADM ROLE-16 + ACC C1 | même barre, même rôle, mêmes absences |
| ROL-24 | ADM ROLE-24 + volet ADMIN de ACC A13 | même renvoi `/notifications` vers `/admin/notifications?onglet=reception` |
| ROL-26 | ADM ROLE-26 + ADM GP-47 + CHU TDB-1 | même `permanentRedirect`, deux routes |
| ROL-29 | ADM ROLE-29 + ADM GP-30 | doublon interne au plan Admin, GP-30 renvoyait à ROLE-29 |
| ROL-17 à ROL-21 | ADM ROLE-17 à ROLE-21 + CHU TRV-3 | TRV-3 décrivait exactement le balayage rôle par route interdite |
| DEMO-05 | ADM DEMO-05 + ACC I1 | isolement démo vers public, union des deux écrans d'écriture |
| DEMO-06 | ADM DEMO-06 + ACC I2 | isolement public vers démo, idem |
| DEMO-07 | ADM DEMO-07 + ACC I3 | la réinitialisation n'atteint pas le public, union visites et prospects |
| TRA-03 | ADM TR-03 + ACC C11 | cloche par rôle, union des six rôles et de la destination du lien |
| TRA-10 | ADM TR-11 + ADM TR-12 | TR-12 était la clause de repli de TR-11, pas un scénario |
| non repris | ADM TR-04 | pur renvoi à `prospects.spec.ts` ; déjà couvert par ACC-CNX-12 et CHU-TRV-01 (il n'était pas compté dans les 183) |

**Ce qui n'a pas été fusionné, et pourquoi.** Les trois tableaux de bord
composables (`/accueil/tableau-de-bord`, `/chues/statistiques`,
`/grand-public/statistiques`) restent trois jeux de scénarios distincts : ils ne
partagent ni catalogue de cartes, ni endpoint de disposition, ni rôles, ni
libellé d'entrée du mode, et CHU-DSP-12 prouve précisément qu'une disposition ne
déborde pas d'un écran sur l'autre. Les fusionner aurait réduit la couverture,
ce qu'interdit le §4.5. Le facteur commun est extrait au §6.6.

De même, les scénarios de refus qui portent le libellé « quoi » propre à un écran
(ACC-COQ-03, CHU-ET1-14, CHU-CHF-03, CHU-CHF-04, CHU-SUP-08, CHU-IMP-01,
CHU-DOS-01, CHU-DOSE-02, CHU-DOSX-03, CHU-BQ-04, CHU-DMC-02, CHU-LOT-02,
ADM-PAR-05, GP-20, GP-30) ne sont pas absorbés par le balayage ROL-17 à ROL-21 :
le balayage prouve le refus et l'absence de chargement de données, ces scénarios
prouvent la phrase exacte qui nomme l'écran. Le recouvrement est signalé sur
chaque entrée.












