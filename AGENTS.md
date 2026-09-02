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

Le vocabulaire est FIGE et garde par `apps/web/src/lib/vocabulaire.test.ts`:
`teleconseiller`, `Banque & Finance`, `campagne d'appels prospects`, `campagne
d'appels representants`. Les mots `commercial` et ses declinaisons sont
interdits dans une chaine affichee.

Pas de tiret cadratin. Il ne se saisit pas au clavier et se lit mal en
terminal.

## Tests

Un test qui passe sur du code casse est PIRE que pas de test: il fabrique une
confiance fausse et fait cesser la verification a la main.

Avant de garder un test, le casser: modifier le code qu'il couvre, verifier
qu'il rougit, remettre. Un test qu'on n'a pas vu rougir n'a rien prouve.

Ce depot en a heberge six qui ne pouvaient pas echouer, retires un par un:
une assertion tautologique, une boucle sur son propre litteral au lieu du
document engendre, un `test.skip` conditionne par une connexion qui echouait
en silence, un `toBeDefined` sur une fonction sans valeur de retour.

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

## Simplicite

La solution la plus simple qui marche. Pas la plus generale, pas la plus
extensible, pas celle qui prevoit un besoin qui n'existe pas.

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
