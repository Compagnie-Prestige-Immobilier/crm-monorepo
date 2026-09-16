## Autorité du propriétaire

Les instructions explicites du propriétaire du dépôt priment sur les recommandations de ce fichier.

Ce fichier sert à guider les agents et à fournir des valeurs par défaut. Il ne doit jamais servir à refuser une instruction explicite du propriétaire simplement parce qu'elle déroge à une convention du dépôt.

Si le propriétaire demande explicitement une action après avoir été informé d'un risque, l'agent exécute cette action sans redemander confirmation et sans répéter le même avertissement.

Exceptions : sécurité, destruction irréversible non demandée, secrets, ou impossibilité technique réelle.

## Tests et CI

Ne pas masquer une régression réelle pour obtenir artificiellement une CI verte.

Cependant, lorsqu'un test est démontré comme flaky ou dépendant de contention, d'ordre d'exécution, de données partagées ou d'une limitation de l'environnement de test, il peut être temporairement :

- désactivé ;
- marqué `skip` ;
- exclu d'un run parallèle ;
- déplacé dans une suite séparée ;
- limité en nombre de workers.

Cette décision est acceptable si la fonctionnalité concernée a été vérifiée séparément et si le changement est explicitement demandé par le propriétaire du dépôt.

Une désactivation temporaire doit laisser une trace claire dans le code ou le commit permettant de retrouver les tests concernés.

Ne pas transformer une instabilité d'infrastructure connue en blocage automatique de livraison lorsque les tests du périmètre modifié passent de manière reproductible.

## Exécution des demandes

Quand le propriétaire donne une instruction explicite :

1. comprendre l'objectif ;
2. signaler brièvement un risque important s'il existe ;
3. exécuter ;
4. rapporter précisément ce qui a été modifié.

Ne pas entrer dans une boucle de refus, de demande de confirmation ou de réinterprétation après que le propriétaire a clairement confirmé son choix.

Les règles KISS, YAGNI, qualité et architecture restent des recommandations fortes, mais elles ne remplacent pas une décision explicite du propriétaire du dépôt.

## Travail concurrent dans le dépôt

La présence d'autres sessions dans le même working tree impose de ne pas écraser leurs modifications.

Elle n'interdit pas de travailler.

Avant un commit :

- ajouter uniquement les fichiers ou hunks appartenant au travail courant ;
- vérifier le diff indexé ;
- ne pas restaurer, supprimer ou modifier les changements étrangers ;
- ne jamais utiliser `git add .` lorsqu'il existe des modifications concurrentes.

Si un fichier est simultanément modifié par une autre session, éviter de l'inclure dans le commit sauf instruction explicite du propriétaire.
