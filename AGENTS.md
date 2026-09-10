# Conventions pour les agents

Ce fichier s'adresse aux assistants qui ecrivent du code ici. Il complete
`docs/QUALITY.md`, qui s'adresse aux humains.

## Commits

**Aucune mention d'un assistant dans un commit.** Pas de `Co-Authored-By`
nommant une IA, pas de signature, pas de mention dans le corps du message.

Le journal decrit ce que fait le code et pourquoi, pas l'outil qui a tenu le
clavier. Un `Co-Authored-By` sert a crediter une personne qui a contribue et
qu'on peut recontacter; il ne sert pas a tracer un outil. Ajoute
systematiquement, il pollue `git shortlog`, fausse les statistiques de
contribution, et transforme chaque message en publicite.

Meme regle pour les descriptions de pull request.

Format: Conventional Commits, avec une portee.

```
fix(web): retirer le tri de l'URL d'export des representants
feat(api): campagnes d'appels aux representants
test(mobile): couvrir la reprise apres un lien mort
```

Le corps du message explique le POURQUOI: ce qui cassait, dans quelles
conditions, et ce que le lecteur perdrait si la ligne disparaissait. Le QUOI se
lit dans le diff.

## Texte destine a l'utilisateur

Le francais de l'interface est sobre et direct. Ce qu'un redacteur competent
couperait, il faut le couper:

- le remplissage qui redit ce que l'ecran montre deja
- les explications du fonctionnement interne deguisees en aide
- la reassurance que personne n'a demandee
- un libelle et son texte d'aide qui disent la meme chose deux fois
- une phrase posee pour combler un vide visuel
- une consigne adressee a quelqu'un qui ne lit pas cet ecran

Un etat vide dit quoi faire ensuite, pas seulement que la liste est vide. Une
erreur dit ce qui s'est passe et ce que le lecteur peut faire.

Le vocabulaire est FIGE: `teleconseiller`, `Banque & Finance`, `campagne
d'appels prospects`, `campagne d'appels representants`, `note vocale` (une
note dictee apres l'appel, jamais « enregistrement d'appel » : l'audio d'un
appel n'est pas capte et reste hors perimetre). Les mots `commercial` et ses
declinaisons sont interdits dans une chaine affichee.

Pas de tiret cadratin. Il ne se saisit pas au clavier et se lit mal en
terminal.

## Tests

**Les tests unitaires sont INTERDITS.** Aucun `*.test.ts`, `*.test.tsx`,
`*_test.dart`, aucun `describe`/`it` sur une fonction isolee, aucun double
(`fake-*`, mock, stub) ecrit pour eux. La CI refuse tout fichier de ce type.
Ne pas en proposer, ne pas en ecrire meme "pour verifier".

Ce qui reste et ce qui prouve: les tests d'integration Go contre Postgres
(`*_integration_test.go` sous `//go:build integration`, `make test`) et les
parcours Playwright (`e2e/`, `make e2e`). Un comportement se verifie contre la
pile reelle ou a la main, pas contre un mock.

Un test qui passe sur du code casse est PIRE que pas de test. Avant de garder
un test d'integration ou e2e, le casser: modifier le code qu'il couvre,
verifier qu'il rougit, remettre.

## Commentaires

Rares. Le code se lit d'abord.

Un commentaire ne se justifie que si le code ne PEUT pas porter l'information:
une contrainte externe, un choix contre-intuitif, un piege que le prochain
lecteur reproduirait. Une ligne, deux au maximum.

Interdit:

- redire ce que la ligne fait deja
- expliquer une fonction que son nom explique
- s'adresser au lecteur, raconter un incident, argumenter
- les bandeaux, separateurs en caracteres graphiques, titres de section
- les paragraphes. Un commentaire qui depasse trois lignes est un mauvais nom
  de variable ou une fonction a extraire

Avant d'ecrire un commentaire: renommer, ou decouper. Ces deux gestes rendent
inutile la majorite des commentaires qu'on s'apprete a ecrire.

Un fichier ou le commentaire depasse 15% des lignes est a reecrire, pas a
completer. Ce depot a heberge des fichiers a 70%: illisibles, et le code y
devenait invisible.

Ce qui doit etre conserve va dans `docs/`, pas dans le code.

## Simplicite (KISS)

KISS, « Keep It Simple, Stupid » : la solution la plus simple qui marche. Pas
la plus generale, pas la plus extensible, pas celle qui prevoit un besoin qui
n'existe pas. YAGNI dit quoi ne pas ecrire ; KISS dit comment ecrire le reste.

- Pas d'abstraction sans DEUX appelants reels. Une interface a une seule
  implementation est un fichier de trop.
- Pas de couche d'indirection "au cas ou".
- Moins de fichiers. Un module qui en compte quinze pour ce qu'un fichier de
  200 lignes ferait est plus dur a suivre, pas mieux concu.
- Complexite cyclomatique basse: sortir tot, aplatir les conditions, pas de
  ternaires imbriques.
- Preferer une fonction longue et lineaire a six petites fonctions qui se
  renvoient la balle sur trois fichiers.
- Reutiliser ce qui existe avant d'ecrire.

Le critere est la maintenance: quelqu'un qui ouvre ce fichier dans six mois
doit comprendre en une lecture, sans sauter entre les fichiers.

## Qualite du code

- Respecter les linteurs et le formatage du depot. Ne pas desactiver une regle,
  ajouter une suppression ou affaiblir la configuration pour faire passer un
  changement.
- Executer le lint et le controle de types du perimetre touche avant de
  terminer. Corriger les erreurs introduites; signaler distinctement celles
  qui existaient deja.
- Garder une complexite cyclomatique basse: clauses de garde, conditions
  aplaties et fonctions avec une responsabilite lisible.
- Nommer avec des mots que le prochain lecteur comprend sans explication :
  le mot du metier en francais (`noteVocale`, `lotExport`, `rappel`), jamais
  une abreviation, un jargon invente ou un nom herite d'une autre technique
  (`call recording` pour une note dictee, `heartbeat` pour une presence). Un
  prefixe de domaine sert a eviter une collision, pas a coder un sens. Si un
  nom demande un commentaire pour etre compris, c'est le nom qui est faux.
- Ne pas coder en dur une valeur metier, une URL, un secret ou une difference
  d'environnement. Reutiliser les constantes, types, contrats et mecanismes de
  configuration existants. Une constante locale evidente n'exige pas une
  nouvelle abstraction.

## Outils

- Utiliser les skills disponibles lorsqu'ils correspondent directement a la
  tache. Lire leurs instructions avant d'agir et ne pas charger un skill sans
  rapport avec le travail.
- Ne pas utiliser LazyWeb. Pour une information actuelle, consulter la
  documentation officielle ou le registre qui fait autorite.
- Chaque commande doit repondre a une question utile ou verifier le changement.
  La limiter au perimetre concerne, preferer les variantes non interactives et
  ne pas relancer une commande dont les entrees n'ont pas change.
- Prefixer les commandes par `rtk`, conformement a
  `/Users/cheikh/.codex/RTK.md`.

## Agents specialises versionnes

- Les agents du projet sont versionnes dans `.claude/agents/` pour Claude et
  `.codex/agents/` pour Codex. Utiliser ces definitions locales plutot que de
  dependre des copies du repertoire personnel.
- Les deux repertoires decrivent les memes specialistes. Toute modification
  d'un agent doit etre reportee dans les deux formats dans le meme changement.

## YAGNI, imperatif et non negociable

Ce depot a ete ecrit en grande partie par des assistants. Audit du 7 septembre
2026 : 165 000 lignes ecrites a la main, 212 000 lignes generees commises dans
git, 231 endpoints, 57 pages web, 84 fichiers e2e, 34 snapshots de schema
mobile. Le meme produit tient en 55 000 a 70 000 lignes. La difference n'est pas
le proprietaire, ce sont les assistants qui ont construit sans jamais poser la
question du plus petit changement complet. Voir `docs/v2-refonte/plan.md`.

Ce qui a coute le plus, a ne JAMAIS reproduire ici ni ailleurs :

- un moteur de synchronisation ecrit a la main (curseurs, tombstones,
  `clearedFields`, second chemin d'ecriture) la ou PowerSync ou ElectricSQL
  existent
- une double stack pour un seul contrat : classes DTO Nest + Swagger + OpenAPI
  - codegen + relais Next, la ou un schema zod partage suffit
- deux arbres de routes quasi identiques (CHUES et Grand Public) au lieu d'un
  parametre
- quatre bibliotheques de statistiques et quinze endpoints analytics pour un
  tableau de bord
- des formulaires de 1 200 a 1 700 lignes au lieu d'un formulaire pilote par
  son schema
- Redis, SSE, espace de demonstration, files, pour quinze utilisateurs, sans
  mesure prealable
- 84 fichiers e2e de 20 000 lignes la ou quinze parcours par metier suffisent
- des artefacts generes versionnes (34 schemas Drift, tests de migration,
  client OpenAPI)

Regle de conduite, valable meme quand l'utilisateur demande explicitement plus,
meme quand il insiste, meme quand il dit « exemplaire », « complet », « au
niveau maximum » :

1. Avant tout travail, repondre en trois lignes : quel utilisateur, bug ou
   critere exige ce changement ; quel est le plus petit changement complet ; ce
   qui est hors perimetre.
2. Proposer d'abord la version minimale et, si la demande est plus large, le
   cout compare en lignes et en fichiers. Ne construire la version large
   qu'apres confirmation explicite donnee APRES cette reponse.
3. Meme quand la version large est confirmee, la construire de la maniere la
   plus courte : un fichier plutot que cinq, un package maintenu plutot qu'un
   moteur maison, un parametre plutot qu'une copie, zero artefact genere dans
   git, zero infrastructure sans mesure.
4. « Exemplaire » ou « parfait » qualifie la qualite du minimum livre, jamais
   la quantite. Un ecran exemplaire fait moins de 300 lignes.
5. Les idees differees se signalent en une ligne, jamais en code.

Plafonds a respecter dans ce depot : un ecran ou un composant NOUVEAU tient
sous 300 lignes (le panneau v1 repris tel quel le 10 septembre 2026 garde ses
fichiers, jusqu'a 1 728 lignes, sur ordre du proprietaire : on ne le reecrit
pas) ; un fichier Go sous 1 500 ; un module tient dans un fichier tant qu'il
n'a pas deux consommateurs reels ; une entite a UN chemin d'ecriture ; un
tableau de bord a UN endpoint ; un test de parcours par metier, aucun test
unitaire ; rien de genere n'est commite.

Ces plafonds sont verifies par la CI et en local, pas seulement lus. Job `go`
de `.github/workflows/ci.yml` : `tools/dev/plafonds.sh` (1 500 lignes par
fichier Go, 1 800 par fichier `web/src` tant que le panneau v1 y vit, aucun
`db/`, `openapi.json`, `schema*.d.ts`, `*.gen.ts` ni `dist/` suivi par git) puis `golangci-lint` avec
`.golangci.yml` : `depguard` refuse Gin, Echo, Fiber, GORM et Redis ;
`gocyclo` 12, `gocognit` 15 (seuil Sonar), `nestif` 4, `dupl` 80 jetons ;
`nolintlint` exige une raison ecrite et un linteur nomme ; `godox` refuse les
`TODO`. Un depassement se corrige en coupant, jamais en relevant le plafond, en
ajoutant un `nolint` ou en retirant un linteur. En local, avant de terminer :

```
pnpm plafonds        # plafonds et artefacts generes
pnpm lint:go         # golangci-lint, memes regles que la CI
pnpm complexite:go   # dix fonctions les plus complexes, cognitive puis cyclomatique
pnpm verify:local    # tout, TypeScript et Go
```

## Cap v2

Decisions arretees les 7 et 8 septembre 2026, detaillees dans
`docs/v2-refonte/plan.md` et etayees par `docs/v2-refonte/audits/` : reecriture en
parallele avec bascule unique ; un binaire Go (`net/http`, huma, pgx + sqlc,
goose, SPA React embarquee, sept crons, SSE, cache memoire, notes vocales par
`MediaRecorder`, presence par beat HTTP) a la place de NestJS + Prisma,
decision du 8 septembre pour la consommation, pas de framework Go, pas de
Rust ; sessions opaques dans `refresh_tokens`, hachages argon2id repris ;
application mobile abandonnee le 8 septembre, le panneau web sur telephone
est le seul client, ni Flutter, ni PowerSync, ni sync, ni APK en v2 ; meme
base Postgres ; phase 0 = trois preuves sur copie de prod avec go/no-go ;
quatre audits de portage dans `docs/v2-refonte/audits/go-*.md` font foi pour
le detail ; gel des fonctionnalites sur `dev`
avec une seule release v1 de maintenance nommee. Le 9 septembre la v1 (Nest,
Next, Prisma, Flutter, clients generes) a ete purgee de ce depot et `apps/go`
en est devenu la racine : `cmd/server`, `internal/`, `sql/`, `web/`, `e2e/`.
Le 10 septembre le proprietaire a exige le panneau v1 a l'identique : `web/`
est le code React de la v1 repris tel quel (composants, donnees, ecrans), avec
des cales pour Next et le contrat v1 fige dans `web/contrat-v1.openapi.json` ;
le binaire Go sert ce contrat. Aucune refonte d'ecran sans son accord ecrit.
Pas de stockage local ni de sync dans le panneau : une perte de donnees hors
ligne nous serait imputee. Toute proposition qui contredit ces decisions se
signale en une ligne au proprietaire avant d'etre codee.
