# ADR 0001 : Synchronisation hors ligne : outbox partitionnée, LWW, pas de CRDT

**Statut** : accepté · **Date** : 2026-08-12

## Contexte

Les commerciaux CPI saisissent sur le terrain, où le réseau est mauvais ou absent. Une app qui
exige une connexion pour enregistrer une ligne perd des données et sera abandonnée. L'écriture
locale doit donc être le chemin normal, pas un mode dégradé.

## Décisions

### 1. Identifiants générés par le client, en UUID v7

Un prospect est créé hors ligne **avant que son représentant n'ait jamais atteint le serveur**.
Si la base attribuait les identifiants, il faudrait un mécanisme de remplacement différé et
toute référence locale deviendrait caduque. UUID v7 donne en prime la localité B-tree sur une
clé primaire Postgres, contrairement à v4.

**Ce que cela ne règle pas.** L'identifiant client supprime la réconciliation d'_identifiant_,
pas celle d'_entité_ : deux commerciaux qui rencontrent le même représentant produisent deux
UUID pour une seule personne. Le téléphone les réunit, et c'est le **seul** remappage
d'identifiant du système. Toute affirmation du type « avec des UUID client il n'y a plus jamais
de réconciliation » est fausse dans ce domaine.

Corollaire : **on ne trie jamais par UUID**. La dérive d'horloge entre appareils rend l'ordre v7
inter-appareils dénué de sens. Localement on trie par `seq`, côté serveur par `createdAt`.

### 2. Outbox partitionnée par représentant, pas FIFO global

`dependencyKey` = l'identifiant du représentant. Ordre strict **à l'intérieur** d'une clé,
indépendance totale **entre** clés : le modèle des partitions Kafka.

Le FIFO global donnerait la garantie d'ordre gratuitement, mais au prix d'un blocage de tête
total : **un seul numéro en doublon fige la synchronisation de tout l'appareil**. Avec le
partitionnement, un représentant empoisonné ne bloque que son propre sous-arbre ; les quarante
autres continuent de passer.

La garantie « un prospect n'atteint jamais le serveur avant son représentant » devient
structurelle plutôt que vérifiée : le prospect a un `seq` supérieur à celui du `create` de son
parent _et_ partage sa `dependencyKey`, et un lot n'emporte qu'un préfixe contigu d'opérations
éligibles par clé.

### 3. Une transaction par groupe, ni par lot ni par opération

- **Par lot** : un 409 sur l'opération 3 sur 200 annule 197 écritures valides. Le client rejoue,
  reproduit le même 409, et l'appareil se coince définitivement sur un mauvais numéro. Sur un
  lien 2G, réémettre 200 opérations pour échouer à l'identique est inacceptable.
- **Par opération** : un prospect atterrit alors que le `create` de son représentant a échoué :
  violation de clé étrangère, ou état incohérent visible par l'utilisateur.
- **Par groupe** : atomicité de l'unité que l'utilisateur a réellement en tête (« ce
  représentant et ses prospects »), domaines de panne indépendants, durée de verrou bornée.

### 4. Idempotence sur deux niveaux

Le niveau lot couvre le cas courant : le serveur a écrit, la réponse s'est perdue, le client
rejoue le lot identique. Il **ne couvre pas** le cas où 3 opérations sur 5 sont passées et où le
client reconstitue un lot _différent_ sous un _nouveau_ `batchId` : seules les clés par opération
rendent ce rejeu sûr.

Le marqueur `IN_PROGRESS` s'insère dans sa **propre transaction, avant** la transaction de
travail. Placé dedans, un rollback l'efface et le rejeu réécrit. C'est l'erreur classique de ce
motif.

Troisième filet : les index uniques partiels sur le téléphone. Même les deux tables corrompues,
la base refuse le doublon.

### 5. Résolution de conflit : dernier écrivain gagne, pas de CRDT

Chaque représentant a un unique commercial propriétaire, les enregistrements sont de la capture
de terrain en ajout, et les modifications après coup sont rares. LWW plus fusion sur clé
naturelle est correct ici et environ deux ordres de grandeur moins cher à construire et à
déboguer qu'un CRDT ou de la transformation opérationnelle.

Exceptions :

- La création d'un représentant n'est **pas** du LWW : on ne peut pas « dernier écrivain gagne »
  une violation d'unicité. C'est premier arrivé, tranché par l'index, et le perdant passe par la
  fusion 409.
- **La suppression l'emporte sur la modification concurrente.**
- Les champs corrigés par un admin depuis le web sont serveur-gagnant inconditionnellement.

### 6. Curseur de pull : keyset, jamais un timestamp nu

Un curseur timestamp perd des lignes de deux façons : deux lignes partageant une milliseconde à
cheval sur une page, et une transaction démarrée avant le curseur mais validée après, dont la
ligne naît déjà derrière le curseur.

Retenu : curseur opaque `{t, id}`, pagination keyset sur `(updatedAt, id)`, lecture avec un
filigrane de 2 secondes. L'hypothèse « aucune transaction d'écriture ne dépasse 2 s » est
**transformée en invariant** par un `statement_timeout = 2s` sur le rôle de synchronisation :
c'est ce qui la rend sûre plutôt qu'optimiste.

Une table `change_log(seq bigserial)` aurait le même défaut : la valeur de séquence est allouée
avant la validation, donc une transaction plus lente valide plus tard avec un `seq` inférieur et
se fait sauter.

## Conséquences

- Le moteur de synchronisation est du Dart pur sous `lib/core/sync/`, sans aucun import de
  `package:flutter` ni de Riverpod : l'isolat WorkManager n'a ni arbre de widgets, ni conteneur
  Riverpod, ni plugins enregistrés. Une règle de lint interdit ces imports dans ce dossier.
- L'état de synchronisation par ligne est **dérivé** d'une vue SQL joignant l'opération de tête
  de l'outbox, jamais dénormalisé sur la ligne métier : une colonne dénormalisée se
  désynchronise au premier chemin de code qui oublie de la mettre à jour.
- La synchronisation en arrière-plan est un **complément**. Android 15 plafonne les services
  `dataSync` à 6 h par 24 h, Android 16 durcit les quotas JobScheduler, et les ROM Transsion et
  Xiaomi : majoritaires au Sénégal : tuent les tâches de fond quoi qu'en dise AOSP. Le chemin
  premier plan est le chemin principal, avec un compteur d'attente visible en permanence.
