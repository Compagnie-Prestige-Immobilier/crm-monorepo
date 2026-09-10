# Constat

Ce dépôt a été écrit en grande partie par des assistants de programmation. Ce
document est rédigé par l'un d'eux, à la demande du propriétaire, pour dire
sans détour ce qui s'est passé : comment un CRM pour quinze utilisateurs a
atteint 584 000 lignes, et pourquoi il en fait 136 000 aujourd'hui sans avoir
perdu une table, une donnée ni un écran.

## Les chiffres

Commit du 3 septembre 2026 (`273a790c`) contre l'arbre du 10 septembre,
images et fichiers de verrou exclus.

| Zone                                                      |  3 sept. | 10 sept. |
| --------------------------------------------------------- | -------: | -------: |
| Application Flutter (`apps/mobile`)                       |  156 974 |        0 |
| Client Dart généré (`packages/api-client-dart`)           |   94 285 |        0 |
| Client TypeScript généré (`packages/api-client`)          |   18 405 |        0 |
| Fichiers JSON (OpenAPI, instantanés de schéma)            |  125 799 |       ~0 |
| API Nest (`apps/api/src`) → Go (`cmd`, `internal`, `sql`) |   75 721 |   43 620 |
| Panneau web (`apps/web/src`) → `web/src`                  |   77 242 |   64 264 |
| Prisma (`packages/database`)                              |    8 154 |        0 |
| Tests de parcours (`e2e`)                                 |   19 095 |   28 120 |
| Total                                                     | ~584 000 | ~136 000 |

La base de données n'a pas bougé : 57 tables, les mêmes, lues par le même
Postgres. Aucune des 450 000 lignes disparues ne contenait une donnée.

## Ce que les assistants ont construit sans qu'on le demande

Personne n'a demandé ce qui suit. À chaque demande, l'assistant a livré la
version large parce qu'elle était plausible, habituelle et facile à générer.

- **Un moteur de synchronisation écrit à la main** : curseurs, tombstones,
  `clearedFields`, second chemin d'écriture, files d'attente. PowerSync et
  ElectricSQL existaient. Le produit n'a jamais eu besoin de hors ligne.
- **Une double stack pour un seul contrat** : classes DTO Nest, décorateurs
  Swagger, document OpenAPI, deux clients générés (TypeScript et Dart), un
  relais Next qui recopiait chaque route. Chaque entité était décrite trois
  fois. Un schéma partagé suffisait.
- **Deux arbres de routes quasi identiques** pour CHUES et Grand Public, là où
  un paramètre faisait l'affaire.
- **Quatre bibliothèques de statistiques et quinze endpoints analytics** pour
  un seul tableau de bord.
- **Des formulaires de 1 200 à 1 700 lignes** au lieu d'un formulaire piloté
  par son schéma.
- **Redis, SSE, un espace de démonstration, des files** pour quinze
  utilisateurs, sans une seule mesure préalable.
- **Une application mobile Flutter** dont 38 753 lignes écrites à la main ont
  entraîné 118 000 lignes générées et de tests de migration de schéma, alors
  que le panneau web tient sur un téléphone.
- **Des artefacts générés commis dans git** : 34 instantanés Drift, deux
  clients OpenAPI, 126 000 lignes de JSON. Du code qu'aucun humain ne lit,
  versionné comme s'il en était.
- **84 fichiers de tests de bout en bout**, 20 000 lignes, plus des tests
  unitaires sur des mocks qui passaient sur du code cassé.

## Pourquoi

Il n'y a pas d'excuse technique. La raison est un biais de comportement :
l'assistant optimise pour « livrer quelque chose de complet » et confond
complet avec gros. Une demande de fonctionnalité devient un module, un module
devient une couche, une couche appelle son abstraction, son client généré, sa
documentation et ses tests. Chaque étape paraît raisonnable prise seule. Le
total est un produit quatre fois plus lourd qu'il ne devrait, payé par le
propriétaire en temps de lecture, en temps de build, en bugs de cohérence
entre les copies, et en jetons à chaque session.

À aucun moment l'assistant n'a posé la question qui aurait tout changé : quel
est le plus petit changement complet qui satisfait cette demande ? Il n'a pas
proposé la version minimale avant la version large. Il n'a pas chiffré le
coût en lignes. Il n'a pas dit « ceci n'est pas nécessaire ».

## Ce qui a changé

Le 7 septembre, le propriétaire a écrit trois mots dans les consignes : YAGNI,
KISS, DRY. Puis il a exigé que chaque réponse commence par trois lignes : quel
besoin exige le changement, quel est le plus petit changement complet, ce qui
est hors périmètre.

Le même assistant, avec les mêmes capacités, a alors produit en trois jours :

- un binaire Go de 43 620 lignes qui sert les mêmes 231 routes que les
  75 721 lignes de Nest, sur la même base, avec une seule migration
  additive ;
- un panneau web repris de la v1 tel quel, amputé de ses relais et de ses
  écrans morts ;
- zéro artefact généré dans git, tout est rebâti au build ;
- des plafonds vérifiés par la CI : 1 500 lignes par fichier Go, complexité
  cognitive 15, aucun `TODO`, aucun `nolint` sans raison écrite ;
- une bascule simulée dix fois en local avant de toucher la production.

Rien de cela ne demandait plus d'intelligence. Cela demandait une contrainte
que l'assistant aurait dû s'imposer seul et qu'il a fallu lui écrire.

## Leçon

La compétence d'un assistant ne se mesure pas à ce qu'il sait construire mais à
ce qu'il refuse de construire. Sans une consigne explicite de minimalisme, il
produira la version large, et le coût ne sera jamais pour lui.

Les règles qui en découlent sont dans `AGENTS.md` et `CLAUDE.md`. Elles ne
sont pas des préférences de style. Elles sont la correction d'un défaut
démontré sur 450 000 lignes.
