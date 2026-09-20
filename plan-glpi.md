# Plan GLPI : signalements persistants et transmission asynchrone

Date : 19 septembre 2026.
Statut : implémenté le 19 septembre 2026, non déployé. Les décisions prises et
les vérifications réellement exécutées sont en section 18.

## 1. Objectif et périmètre

L'utilisateur doit pouvoir envoyer un signalement sans attendre la création du ticket chez GLPI. Le CRM confirme sa réception après conservation durable du texte et de toutes les images acceptées. Il expose ensuite la progression, le numéro GLPI et les éventuels échecs.

La solution minimale comprend PostgreSQL, le stockage durable existant si ses garanties conviennent, un traitement dans le binaire Go et le suivi dans le panneau support existant.

Hors périmètre : Redis, service supplémentaire, moteur générique de synchronisation, application mobile, refonte des écrans, suivi du cycle métier complet des tickets GLPI, notifications par courriel et optimisation générale de l'application.

L'objectif n'est pas de rendre GLPI plus rapide. Il est de retirer ses appels du chemin de réponse du formulaire et de rendre leur exécution fiable et observable. Une garantie de performance « 100 % Go » n'est pas un critère mesurable.

## 2. État actuel vérifié

Fichiers concernés :

- `internal/support/support.go` : routes, client GLPI, création, demandeur, groupe et images.
- `web/src/components/layout/signaler-probleme.tsx` : formulaire et confirmation affichant immédiatement `numero`.
- `web/src/components/layout/pieces-jointes.tsx` : sélection et capture des images.
- `cmd/server/domaines.go` : montage du domaine support.
- `internal/shared/socle/permissions.go` et migrations support : permissions existantes.

Le POST `/api/v1/support/tickets` attend actuellement l'ouverture de session GLPI, la résolution ou création du demandeur, le rattachement éventuel au groupe, puis la création du ticket. Le client HTTP utilise un délai de 60 secondes par requête.

Les images sont lues après création du ticket puis transmises dans une goroutine avec un contexte de deux minutes. Les erreurs sont journalisées. Ce mécanisme ne constitue pas une conservation persistante ni une reprise après arrêt du processus. Une image illisible peut laisser partir une partie seulement des images.

Une modification locale parallélise les lectures du groupe et de ses membres. Elle ne supprime pas la dépendance du POST à la latence GLPI. Ne pas écraser les changements concurrents lors de l'implémentation.

Le GET `/api/v1/support/categories` dépend lui aussi de GLPI. Le navigateur conserve sa réponse en cache pendant sa session, mais une première ouverture pendant une panne peut rester bloquée.

Le chiffre d'environ six secondes par ticket provient de l'audit fourni, sur trois appels. Il n'a pas été remesuré pour ce document et ne permet pas d'attribuer le délai à un appel GLPI particulier.

## 3. Invariants d'acceptation

1. Aucun appel GLPI n'est exécuté par le POST avant sa réponse d'acceptation.
2. Un `202 Accepted` implique que le signalement et ses images acceptées sont durables.
3. Une fermeture de fenêtre ou un redémarrage du serveur ne perd pas un signalement accepté.
4. Un numéro GLPI connu est conservé avant de poursuivre les pièces jointes.
5. Une reprise d'image ne recrée jamais le ticket.
6. Une réponse réseau ambiguë ne déclenche pas aveuglément une nouvelle création distante.
7. L'auteur retrouve son suivi après rechargement, sans stockage local du contenu du signalement.
8. Les erreurs terminales et les situations incertaines restent visibles et peuvent être traitées.
9. Les autorisations, règles de demandeur et règles de groupe actuelles sont conservées.
10. La purge exclut les demandes non résolues et les pièces encore nécessaires.

## 4. Vérifications préalables ciblées

Avant de coder, inspecter les traitements persistants d'import, leur prise en charge, leurs jetons de possession et leur récupération après expiration. Réutiliser les conventions compatibles sans transformer `import_jobs` en stockage de support.

Inspecter le stockage existant : persistance réelle en production, partage entre instances, sauvegarde, restauration, suppression, contrôle d'accès et comportement en cas d'échec partiel. Un répertoire temporaire ou propre à un conteneur ne convient pas.

Vérifier la version et les capacités réelles de l'API GLPI sur sa documentation officielle et une instance de test autorisée : référence externe recherchable, recherche exacte, visibilité immédiate, liaison des documents, réponses de création et possibilité de réconciliation après délai dépassé. Ne pas supposer une clé d'idempotence native.

Respecter la règle package-first : examiner d'abord les composants internes et la bibliothèque standard, puis comparer une bibliothèque PostgreSQL maintenue si un ordonnanceur supplémentaire est nécessaire. Documenter version, maintenance, licence, compatibilité pgx, migrations et coût d'intégration. N'ajouter ni package ni moteur maison avant cette comparaison. Ce plan ne sélectionne pas de dépendance non vérifiée.

## 5. Persistance

### Signalement

Créer une table dédiée avec les champs utiles au parcours actuel :

| Donnée                                                   | Utilité                                            |
| -------------------------------------------------------- | -------------------------------------------------- |
| Identifiant CRM                                          | Référence stable, suivi et corrélation GLPI        |
| Auteur                                                   | Autorisation de lecture et attribution             |
| Identifiant de soumission                                | Protection contre les doubles soumissions          |
| Empreinte de la soumission                               | Détection d'une même clé avec un contenu différent |
| Description, contexte, urgence, catégorie                | Données nécessaires à la transmission              |
| Identité nécessaire à l'attribution au moment de l'envoi | Reprise indépendante de la session HTTP            |
| État, étape courante                                     | Progression et récupération sûre                   |
| Numéro GLPI nullable                                     | Ticket distant confirmé                            |
| Nombre de tentatives, prochaine tentative                | Reprises bornées                                   |
| Jeton de possession et expiration                        | Coordination entre processus                       |
| Code d'erreur, diagnostic borné                          | Suivi utilisateur et exploitation                  |
| Dates de création, modification et fin                   | Affichage, mesures et conservation                 |

Définir des contraintes de cohérence et une unicité sur l'auteur et l'identifiant de soumission. Ajouter uniquement les index nécessaires à la sélection des demandes dues et à la lecture des signalements de l'auteur.

Ne pas conserver de jeton de session navigateur ou GLPI dans cette table. Limiter l'instantané d'identité aux champs réellement nécessaires au routage existant et définir le comportement si le compte est supprimé avant transmission.

### Images

Conserver un enregistrement par image : signalement, position, type validé, taille, empreinte, référence durable du fichier, état et identifiant du document GLPI lorsqu'il est connu. Le suivi individuel est nécessaire pour reprendre seulement les images manquantes.

Préférer le stockage durable existant si ses garanties sont suffisantes. Si aucun stockage adapté n'existe, évaluer explicitement le stockage des octets dans PostgreSQL pour ces faibles volumes : simplicité transactionnelle contre coût des sauvegardes et taille des données. Ne pas introduire une nouvelle infrastructure sans justification.

### Acceptation atomique du point de vue utilisateur

Valider tous les champs et fichiers avant de rendre la demande traitable. Conserver les limites existantes, dont cinq images et 40 Mio pour la requête, en vérifiant les limites individuelles déjà appliquées. Vérifier le contenu réel des images côté serveur, pas seulement leur type déclaré.

Avec un stockage externe à PostgreSQL : écrire les fichiers de manière durable, puis valider la transaction créant le signalement et ses références. Si une étape échoue, ne pas retourner `202`. Prévoir le nettoyage des fichiers orphelins, avec un délai de grâce et une vérification des références actives. Le traitement ne voit que les demandes entièrement validées.

Avec des octets en base : enregistrer signalement et images dans la même transaction.

Ne jamais garder une transaction SQL ouverte pendant un appel GLPI.

## 6. Contrat API

### POST `/api/v1/support/tickets`

Conserver les champs multipart actuels. Ajouter un identifiant de soumission généré pour chaque nouvel envoi logique et réutilisé lors des tentatives réseau du même envoi.

Retourner `202 Accepted` après persistance, avec un en-tête `Location` pointant vers le suivi :

```json
{
  "id": "identifiant-crm",
  "etat": "en_attente",
  "numeroGlpi": null
}
```

Même clé et même contenu : retourner le signalement déjà enregistré, sans créer de nouveau travail. Même clé et contenu différent : conflit explicite. Calculer l'empreinte sur les champs et les empreintes des images, pas sur l'encodage multipart.

Si la réponse est perdue, le formulaire conserve sa clé. Après rechargement, la liste serveur permet de retrouver la réception ; aucune promesse de déduplication entre deux clés indépendantes.

### GET `/api/v1/support/tickets/{id}`

Retourner l'état public, le numéro GLPI éventuel, les dates utiles, l'état synthétique des images et l'action disponible. Ne pas exposer les diagnostics GLPI bruts, jetons ou chemins de stockage.

### GET `/api/v1/support/tickets`

Fournir une liste bornée des signalements de l'auteur, ordonnée du plus récent au plus ancien. Réutiliser la pagination du dépôt. Une vue administrative peut utiliser cette même route avec un filtre autorisé, sans dupliquer le domaine.

### POST `/api/v1/support/tickets/{id}/reprendre`

Permettre la reprise d'un échec identifié et réessayable selon les droits définis. Ne pas permettre de forcer une nouvelle création depuis un état ambigu. La reprise remet en attente le même enregistrement et conserve le numéro GLPI déjà obtenu. Elle ne concurrence pas un traitement actif.

Les contrats sont définis en Go et les types web suivent la génération existante. Aucun contrat TypeScript parallèle ni artefact généré commité.

## 7. États et échecs

| État interne       | Signification                              | Présentation utilisateur |
| ------------------ | ------------------------------------------ | ------------------------ |
| `en_attente`       | Demande durable, prête à traiter           | En cours d'envoi         |
| `en_cours`         | Traitement détenu par un processus         | En cours d'envoi         |
| `reessai_planifie` | Échec temporaire avant reprise sûre        | Envoi retardé            |
| `a_verifier`       | Effet distant possible, résultat incertain | Transmission à vérifier  |
| `echec`            | Échec définitif ou tentatives épuisées     | Échec de transmission    |
| `termine`          | Ticket et toutes les images confirmés      | Ticket n° … créé         |

Le numéro GLPI et les états des images portent la progression partielle : un ticket déjà créé reste affiché même si une image échoue. Ne pas multiplier les états globaux pour chaque combinaison d'images.

Un succès de réception CRM n'est pas un succès GLPI. Une demande n'est pas `termine` tant qu'une pièce acceptée manque.

## 8. Exécution et coordination

Démarrer le traitement avec le cycle de vie du serveur, pas avec le contexte d'une requête utilisateur. Au démarrage, rechercher les demandes dues et les possessions expirées. Un réveil en mémoire peut accélérer l'envoi, mais PostgreSQL reste la source de vérité et la recherche périodique assure la reprise.

Commencer avec un seul traitement simultané, adapté au faible volume observé. Utiliser une prise en charge atomique compatible avec plusieurs instances. Chaque mutation de progression doit vérifier le jeton de possession courant.

Le délai maximal d'un appel distant et celui du traitement doivent être bornés. La durée de possession doit couvrir ces délais, ou être renouvelée avec arrêt du traitement si la possession est perdue. Un jeton SQL empêche une écriture obsolète en base, mais n'annule pas un appel déjà parti chez GLPI : la récupération doit aussi examiner l'étape distante.

Déroulement :

1. Prendre une demande due et enregistrer la possession.
2. Ouvrir une session GLPI avec les secrets de configuration existants.
3. Résoudre le demandeur et le groupe en conservant les règles actuelles.
4. Enregistrer le début de l'étape de création avant l'appel distant.
5. Créer le ticket avec sa référence CRM si GLPI permet sa réconciliation.
6. Enregistrer immédiatement le numéro GLPI et vérifier sa validité.
7. Transmettre les images restantes et persister chaque confirmation.
8. Marquer la demande terminée après confirmation de toutes les pièces.
9. Fermer la session GLPI avec un délai borné ; un échec de fermeture ne remet pas en cause un ticket confirmé.

À l'arrêt du serveur, arrêter les nouvelles prises en charge et laisser un délai borné aux travaux engagés. Toute interruption conserve assez d'information pour une reprise ou une vérification.

## 9. Reprises et ambiguïtés distantes

### Échecs temporaires

Proposition initiale : cinq tentatives au total, espacements de 30 secondes, 2 minutes, 10 minutes puis 30 minutes, avec une légère variation pour éviter les reprises simultanées. Respecter un `Retry-After` valide lorsque pertinent. Ces valeurs sont des paramètres techniques à confirmer pendant les essais, pas une garantie de délai.

Une erreur réseau, un délai dépassé ou un HTTP 5xx après une création peuvent être ambigus : ils ne sont pas automatiquement réessayables. La classification dépend de l'étape et de l'effet distant possible.

### Erreurs permanentes

Une configuration absente, une authentification refusée, une permission insuffisante ou une catégorie invalide nécessitent une intervention. Arrêter les répétitions inutiles, conserver la demande et rendre l'erreur visible dans l'exploitation. Après correction, la reprise réutilise le signalement.

### Ticket créé mais réponse perdue

Rechercher une référence CRM exacte, autorisée et validée sur la version GLPI utilisée. Si un ticket unique est retrouvé, enregistrer son numéro et poursuivre les images.

Un résultat vide ne prouve pas nécessairement l'absence de création : tenir compte d'une requête encore en cours ou d'un délai de visibilité. Ne recommencer que si l'absence peut être établie de façon fiable. Plusieurs correspondances ou un résultat non fiable conduisent à `a_verifier`.

Sans mécanisme distant suffisant, prévoir une réconciliation administrative minimale : après recherche humaine, rattacher un numéro GLPI vérifié, ou confirmer explicitement l'absence avant une nouvelle tentative. L'opération doit être autorisée, tracée et valider la correspondance du ticket. Cette capacité est nécessaire si la réconciliation automatique ne peut pas être démontrée.

Le même principe s'applique à la création du compte demandeur, au rattachement au groupe et à l'ajout d'un document. Éviter les doublons d'images en vérifiant les documents déjà liés et leur référence lorsque l'API le permet ; sinon exposer l'incertitude au lieu de renvoyer aveuglément le fichier.

Ne pas annoncer de garantie « exactement une fois » sans support distant démontré.

## 10. Expérience utilisateur

Pendant l'envoi navigateur vers CRM, désactiver les doubles clics et afficher l'activité avec les composants existants. Ne pas simuler un pourcentage de progression.

Après `202`, afficher « Signalement reçu. » et permettre de fermer le panneau. Réinitialiser le formulaire seulement après réception confirmée. Une erreur d'enregistrement conserve le texte, les images et la clé de soumission.

Présenter les signalements récents dans le panneau existant. Chaque ligne affiche la date, une courte description, l'état et le numéro GLPI lorsqu'il est disponible. Le lien vers la plateforme conserve ses permissions actuelles ; ne pas fabriquer de lien direct sans vérifier le routage GLPI.

Actualiser uniquement tant que des demandes sont actives, en réutilisant TanStack Query et les conventions existantes. Proposition : toutes les cinq secondes lorsque le panneau est visible, arrêt lorsque les demandes sont terminales, rafraîchissement à sa réouverture. Le traitement serveur continue quand le panneau est fermé.

Une erreur persistante affiche une action utile : reprendre lorsqu'une reprise est sûre, ou contacter l'administrateur lorsque la situation nécessite une vérification. Un ticket créé avec une image manquante affiche son numéro et l'échec de cette image, sans présenter toute la demande comme absente.

Réutiliser Sheet, Button, les composants d'état, Lucide et les mécanismes de retour existants. Préserver navigation clavier, annonces accessibles des changements d'état et focus après fermeture. Aucun nouveau système de composants ni nouvel écran général de support.

## 11. Catégories pendant une panne GLPI

L'asynchronisme de création ne rend pas le formulaire utilisable si les catégories ne peuvent pas être chargées. Traiter cette dépendance explicitement dans la livraison.

Vérifier s'il existe déjà un référentiel persistant adapté. À défaut, conserver le dernier catalogue validé avec sa date et le rafraîchir hors du POST. Préférer sa représentation minimale, sans moteur générique de référentiels.

Un catalogue déjà disponible reste utilisable pendant une indisponibilité temporaire. Sans aucun catalogue connu, afficher l'erreur et permettre de réessayer ; ne pas inventer de catégorie par défaut. Si une catégorie disparaît après acceptation, conserver le signalement et exposer une erreur nécessitant une correction autorisée avant reprise.

Le cache navigateur seul ne garantit pas ce comportement après rechargement ou pour un nouvel utilisateur. Chiffrer ce stockage complémentaire dans l'implémentation.

## 12. Autorisations, confidentialité et conservation

Conserver `support.signaler` pour la création et appliquer un contrôle de propriété à chaque lecture et reprise. La permission d'ouvrir la plateforme GLPI ne donne pas implicitement accès à tous les signalements CRM. Définir l'accès administratif avec les conventions actuelles du dépôt.

Protéger les images au même niveau que le signalement. Ne pas exposer de lien public, chemin interne ou secret dans le suivi. Limiter et assainir les diagnostics enregistrés ; ne pas journaliser le contenu complet des formulaires, images ou réponses GLPI sensibles. Examiner les paramètres d'URL du contexte collecté pour éviter de conserver des secrets.

Réutiliser les protections existantes contre les requêtes abusives et borner le volume accepté. Vérifier les règles de catégorie et urgence localement à partir des données disponibles ; le serveur ne fait pas confiance au navigateur.

Définir la conservation dans la politique existante avant activation de la purge. Ne pas recopier automatiquement une durée de 180 jours d'un autre domaine. Purger seulement les demandes terminées arrivées à échéance ; conserver les demandes en échec ou à vérifier jusqu'à résolution. Maintenir la preuve de déduplication pendant la durée de reprise annoncée.

Vérifier la restauration conjointe de PostgreSQL et des images. Une sauvegarde de métadonnées sans les fichiers n'assure pas la récupération des signalements.

## 13. Exploitation et mesures

Réutiliser l'écran Exploitation et les métriques existantes pour montrer le nombre de demandes en attente, l'ancienneté de la plus ancienne, les échecs et les demandes à vérifier. Éviter un nouveau tableau de bord.

Mesurer séparément :

- acceptation CRM, avec et sans images ;
- attente avant prise en charge ;
- création GLPI ;
- transmission des pièces ;
- délai jusqu'à fin et nombre de reprises.

Relier les journaux par identifiant de signalement et numéro GLPI. Les erreurs de fermeture de session et les erreurs de transmission ne doivent pas être confondues.

Cible initiale à vérifier : P95 inférieur à 500 ms pour l'acceptation sans image dans l'environnement représentatif. Pour les images, mesurer séparément transfert navigateur et persistance. Aucun engagement sur le temps total de transfert d'un fichier ou sur le délai de disponibilité de GLPI.

La preuve décisive est qu'un GLPI lent ou indisponible n'allonge pas le POST au-delà du travail de validation et de persistance CRM.

## 14. Vérification

Respecter le dépôt : intégration Go contre PostgreSQL et parcours Playwright, aucun test unitaire ou faux client GLPI ajouté pour ces tests. Utiliser une instance GLPI de test autorisée pour les échanges réels. Si elle manque, distinguer les vérifications locales réussies des garanties distantes non démontrées.

| Scénario                                  | Résultat attendu                                                 |
| ----------------------------------------- | ---------------------------------------------------------------- |
| Création sans image                       | `202`, suivi durable, numéro GLPI puis fin                       |
| Création avec cinq images                 | Chaque image confirmée individuellement                          |
| Fichier invalide ou stockage indisponible | Pas de `202`, formulaire conservé                                |
| Double soumission concurrente             | Un seul signalement                                              |
| Même clé avec contenu différent           | Conflit sans mutation du premier signalement                     |
| Réponse CRM perdue                        | Même clé retrouve la réception existante                         |
| GLPI indisponible avant envoi             | Acceptation rapide, reprise planifiée                            |
| Erreur de droits GLPI                     | Échec visible, absence de répétition inutile                     |
| Arrêt après acceptation                   | Demande retrouvée au redémarrage                                 |
| Arrêt pendant création distante           | Réconciliation ou `a_verifier`, pas de création aveugle          |
| Arrêt après numéro enregistré             | Reprise limitée aux pièces restantes                             |
| Réponse de document perdue                | Vérification distante ou incertitude explicite                   |
| Deux instances concurrentes               | Une possession valide, progression protégée                      |
| Possession expirée pendant appel          | Aucun effet distant répété sans vérification                     |
| Rechargement et fermeture du panneau      | Suivi retrouvé côté serveur                                      |
| Accès par un autre auteur                 | Refus sans fuite de contenu                                      |
| Catalogue indisponible                    | Dernier catalogue utilisable, ou erreur explicite si aucun connu |
| Purge et restauration                     | Demandes non résolues conservées, pièces récupérables            |

Les coupures réseau et arrêts forcés se font uniquement sur la pile de test isolée. Aucun ticket créé en production pour mesurer la correction.

Ajouter un parcours Playwright couvrant réception et consultation du suivi, puis les scénarios d'intégration nécessaires aux transitions et à la reprise. Conformément aux conventions, vérifier que les nouveaux tests échouent lorsque le comportement couvert est temporairement cassé, sur les seules modifications appartenant à cette tâche.

Commandes indicatives, à ajuster aux fichiers effectivement créés :

```sh
rtk go test -tags=integration ./cmd/server -run 'TestSupport'
rtk pnpm --dir e2e test support.spec.ts
rtk pnpm --dir web typecheck
rtk pnpm plafonds
rtk pnpm lint:go
rtk pnpm complexite:go
```

Exécuter le lint web ciblé selon les scripts du dépôt et les vérifications finales prescrites lorsque le périmètre est vert. Ne pas modifier le nombre de workers Playwright. Signaler distinctement les erreurs dues aux changements concurrents.

## 15. Ordre d'implémentation et fichiers

1. Vérifier stockage, traitement existant, droits et capacités de réconciliation GLPI. Écrire les décisions concrètes dans ce document.
2. Ajouter une migration additive et les requêtes de persistance selon les conventions SQL du dépôt.
3. Adapter `internal/support/support.go` à l'acceptation durable et au suivi ; isoler le traitement dans un fichier du même domaine seulement si sa taille et sa responsabilité le justifient.
4. Raccorder le démarrage et l'arrêt du traitement au cycle de vie existant du serveur.
5. Remplacer la goroutine d'images par la progression persistante et implémenter reprises et réconciliation.
6. Adapter le formulaire et ajouter le suivi compact, en réutilisant les composants existants.
7. Couvrir le catalogue de catégories et le suivi d'exploitation minimal.
8. Vérifier les scénarios, inspecter le diff et mettre à jour ce plan avec les mesures obtenues.

Fichiers attendus : migration SQL, requêtes SQL selon conventions, domaine support, branchement serveur, formulaire/suivi web et tests ciblés. Les fichiers de stockage et d'exploitation ne sont modifiés que si l'intégration l'exige.

L'estimation précédente de 6 à 10 fichiers et 400 à 800 lignes est un ordre de grandeur, pas un plafond garanti. La persistance des images, le catalogue et la réconciliation distante peuvent l'augmenter. Réestimer après les vérifications préalables et privilégier les mécanismes existants. Respecter les plafonds du dépôt ; ne pas construire une plateforme de tâches pour ce seul besoin.

## 16. Livraison et retour arrière

Appliquer la migration additive avant le binaire et livrer ensemble API et panneau généré. Ne pas supprimer de données existantes. Vérifier la gestion d'un ancien onglet encore chargé : le changement de réponse `numero` vers un reçu asynchrone doit conduire à un rafraîchissement explicite selon le mécanisme de version du projet, jamais à une fausse confirmation avec un numéro absent.

Au déploiement, contrôler le démarrage du traitement, l'accès au stockage, les permissions et l'absence de demandes bloquées. Les premières vérifications en production portent sur les signalements réels et les métriques ; aucun test destructif.

Un retour à l'ancien binaire peut arrêter le traitement des demandes déjà acceptées. Il ne faut donc ni supprimer les tables ni lancer une migration descendante destructive. En cas d'incident, conserver les données, identifier les demandes restantes et rétablir un traitement compatible. Le retour arrière doit explicitement prendre en charge ce stock avant d'être déclaré terminé.

## 17. Définition de terminé

Le travail est terminé lorsque les invariants sont vérifiés, les demandes survivent aux interruptions, les cas ambigus aboutissent à une réconciliation utilisable, le suivi et les droits sont vérifiés, les mesures d'acceptation sont publiées et les limites de GLPI sont documentées.

Le rapport final distingue ce qui a été compilé, testé contre PostgreSQL, testé contre GLPI, mesuré et déployé. Un test de compilation seul ne prouve ni la reprise ni le gain utilisateur.

## 18. Décisions prises et vérifications exécutées (19 septembre 2026)

### Décisions des vérifications préalables (§4)

- **Stockage des images : `bytea` dans PostgreSQL**, comme
  `courriels."pieceJointe"` et `ventes."contenu"`. Un volume Dokploy serait
  possible et reste le mauvais choix ici : la seule sauvegarde du produit est
  `pg_dump --schema=public` (`admin_dump.go:340`), donc un fichier hors base ne
  serait dans aucune sauvegarde et §12 ne serait pas tenu ; l'acceptation
  atomique tiendrait alors en deux écritures plus un nettoyage des orphelins au
  lieu d'une transaction ; et un volume est lié à un hôte quand la base est
  déjà l'état partagé. Cinq images de 8 Mio au plus par signalement, quelques
  signalements par semaine : le coût en base est négligeable.
- **Traitement** : aucun ordonnanceur ajouté. Le planificateur `gocron` du
  serveur porte la tâche `cpi.support.transmission` chaque minute, et le POST
  réveille la transmission par une goroutine, exactement comme
  `imports.BalayerImports`. Jeton de possession et bail expirant repris de
  `ClaimImportJob`. Aucune dépendance nouvelle : la comparaison avec un
  ordonnanceur PostgreSQL (River, gue) est sans objet tant que la tâche
  planifiée existante fait le travail.
- **Réconciliation GLPI** : la référence `CRM-<id>` est inscrite dans le
  contenu du ticket et recherchée par `/search/Ticket` sur l'option 21
  (contenu). Un seul résultat autorise la reprise du numéro ; zéro ou
  plusieurs mènent à `a_verifier`. **Non vérifié contre une instance GLPI** :
  aucune instance d'essai autorisée n'était disponible. Le chemin administratif
  `POST /tickets/{id}/rattacher` existe précisément pour ce cas.
- **Déduplication distante** : aucune clé d'idempotence native supposée. La
  déduplication est locale (clé de soumission unique par auteur). Les documents
  déjà liés au ticket sont relus avant un nouvel envoi.

### Ce qui a été construit

Migration `20260919120000_support_signalements.sql` (trois tables),
`sql/queries/support.sql`, `internal/support/support.go` (API et acceptation),
`internal/support/support_transmission.go` (transmission, reprises,
réconciliation, catalogue), `internal/support/support_glpi.go` (client GLPI
déplacé et étendu), branchement des tâches et de la purge dans
`cmd/server/domaines.go`, bloc d'exploitation dans
`internal/admin/admin_exploitation.go`, panneau
(`web/src/lib/data/support.ts`, `suivi-signalements.tsx`,
`signaler-probleme.tsx`, écran Exploitation).

Conservation : 90 jours après la fin, demandes terminées seulement. Les états
`echec` et `a_verifier` ne sont jamais purgés.

### Vérifications exécutées

| Vérification                                                     | Résultat                             |
| ---------------------------------------------------------------- | ------------------------------------ |
| `go test -tags=integration ./...`                                | 228 tests verts                      |
| `go test -tags=integration ./cmd/server -run TestSupport`        | 3 tests verts                        |
| `pnpm --dir e2e test support.spec.ts`                            | vert                                 |
| `pnpm lint`, `pnpm typecheck`, `pnpm plafonds`, `pnpm dead-code` | verts                                |
| `pnpm lint:go`                                                   | vert sur le périmètre support        |
| Acceptation du POST avec deux images, GLPI injoignable           | 7 ms mesurés dans le journal du test |

Tests cassés volontairement puis rétablis, conformément aux conventions :
contrôle de propriété (le refus 404 devient 200), conflit de clé (le 409
devient 202), suivi du panneau (la liste vide fait rougir le parcours
Playwright). Chaque mutation a fait rougir le test attendu.

### Support non relié à GLPI : divergence supprimée

Le POST n'exige plus la configuration GLPI. Le signalement est accepté et
conservé ; la transmission échoue avec `SUPPORT_NON_CONFIGURE`, classée erreur
permanente donc sans répétition, et l'administrateur la reprend après
correction. `GET /support/categories` sert le dernier catalogue connu même sans
configuration, et ne rend 503 que si aucun catalogue n'a jamais été relevé.
Couvert par `TestSupportConserveLeSignalementQuandGlpiNEstPasRelie`.

### Vérification contre le GLPI réel (20 septembre 2026)

`https://glpi.cpi-chues.com`, jeton de l'application Dokploy `cpi-go`, profil
Super-Admin, entité 0. **Aucune écriture : aucun ticket, compte, groupe ou
document créé.**

| Appel                                       | Résultat                                         |
| ------------------------------------------- | ------------------------------------------------ |
| `initSession` / `killSession`               | 200                                              |
| `GET /ITILCategory?range=0-500`             | 200, 18 catégories visibles helpdesk et incident |
| `GET /User?searchText[name]=^pilotage$`     | 200, compte `pilotage` id 8 présent              |
| `GET /Group?searchText[name]=^Commerciaux$` | 200, groupe id 3, 4 membres                      |
| `GET /User/{id}/Group_User`                 | 200                                              |
| `GET /Ticket/{id}/Document_Item`            | 200                                              |
| `GET /search/Ticket` champ 21 `contains`    | 206, l'option 21 est bien le contenu             |

Précision de la réconciliation, le seul inconnu réel du plan :

| Chaîne cherchée                                | `totalcount`  | Lecture                                                    |
| ---------------------------------------------- | ------------- | ---------------------------------------------------------- |
| référence CRM inexistante (forme `CRM-<uuid>`) | 0             | aucun faux positif : on n'adopte jamais un ticket étranger |
| chaîne présente dans un seul ticket            | 1, id correct | un ticket unique est bien retrouvé et adopté               |
| `Référence CRM`                                | 0             | attendu, aucun ticket ne la porte encore                   |

La recherche accepte la forme à tirets d'un UUID v7 sans erreur. La référence
cherchée est `CRM-<uuid>`, ASCII pur : `html.EscapeString` ne la transforme pas,
aucun risque d'entité HTML.

### Le chemin d'écriture n'est pas nouveau

Six tickets créés par le CRM existent déjà dans cette instance (ids 237 à 244).
Le diff contre `HEAD` montre que les charges utiles émises sont **identiques
octet pour octet** à celles de ce code déjà en production :

- `POST /Ticket` : mêmes champs JSON, seuls les types Go passent de `int` à
  `int32`, le JSON est le même ;
- `POST /User` : mêmes champs, alimentés par l'instantané d'identité au lieu de
  la session ;
- `GET /User?searchText`, `GET /Group?searchText`, `GET /User/{id}/Group_User` :
  URL identiques, `plageGlpi` étant la constante `"range"` ;
- `POST /Group_User` : même corps ;
- `POST /Document` : même manifeste, mêmes parties ; seule la réponse est
  désormais décodée pour retenir l'identifiant du document.

Les deux seuls appels distants nouveaux sont `search/Ticket` et
`Ticket/{id}/Document_Item` : tous deux vérifiés ci-dessus contre l'instance
réelle. La seule addition au contenu du ticket est un paragraphe
`Référence CRM : CRM-<id>`.

### Ce qui reste non démontré

- Aucune écriture n'a été exercée pendant cette vérification. Le risque est
  faible pour les raisons ci-dessus, pas nul. Confirmation au déploiement : un
  signalement envoyé depuis le panneau avec une image, contrôle du demandeur,
  du groupe, de la catégorie, du document et de la référence dans GLPI, puis
  suppression du ticket.
- Le délai d'indexation de la recherche GLPI après création n'est pas mesuré.
  C'est précisément pourquoi un résultat vide mène à `a_verifier` et jamais à
  une seconde création.
- Aucune mesure en production. La seule latence mesurée est celle du banc
  local : 7 ms pour l'acceptation avec deux images.
