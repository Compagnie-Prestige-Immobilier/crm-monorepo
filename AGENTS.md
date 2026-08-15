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

Ils expliquent POURQUOI, jamais QUOI. La densite de ce depot est un choix:
un commentaire porte la raison d'etre d'une decision, ce qui casserait sans
elle, et l'incident qui l'a motivee.

Un commentaire qui surestime sa garantie est un piege. Plusieurs defauts ont
survecu a des relectures ici parce qu'un commentaire affirmait une propriete
que le code n'avait pas.
