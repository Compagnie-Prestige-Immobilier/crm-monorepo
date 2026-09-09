# CRM Go : implémentation du poste hors ligne avec Dexie

Statut : spécification d'implémentation, application non modifiée par ce document.
Date : 9 septembre 2026. Cible : `apps/go` du clone courant.

Ce document reprend le plan validé puis précise son exécution. Les comportements
décrits au futur restent à construire. Les constats correspondent au code présent
le 9 septembre, avec de nombreux fichiers modifiés ou non suivis. Revérifier ces
constats avant chaque lot, sans effacer les changements utilisateur.

La qualité attendue est l'absence de perte silencieuse, de doublon métier et
d'écrasement concurrent dans les scénarios validés. **Une fiabilité absolue de
100 % n'est pas démontrable.** Une machine perdue avant transmission, un stockage
supprimé ou un défaut du navigateur peuvent détruire l'unique copie locale.
Les garanties conditionnelles et les mesures sont définies en section 18.

## Sommaire

1. Plan validé et périmètre
2. État du dépôt et adaptations
3. Packages et responsabilités
4. Contrats et matrice des opérations
5. Modèle local Dexie
6. Préparation complète
7. Lectures, filtres et rafraîchissement
8. Saisie locale et dépendances
9. Transmission et erreurs
10. Idempotence PostgreSQL
11. Révisions et audit
12. Résolution visuelle des conflits
13. Notes vocales et fichiers
14. Session et autorisations
15. Cache applicatif et déploiement
16. Lots d'implémentation
17. Vérification réelle
18. Garanties et réception
19. Procédures de reprise
20. Sources et maintenance

## 1. Plan validé et périmètre

### 1.1 Objectif confirmé

Permettre huit heures de travail dans un onglet normal ou une application web
installée, après une préparation en ligne. L'installation sur le bureau reste
facultative. La synchronisation reprend quand le panneau est ouvert avec une
connexion. Aucun engagement d'exécution lorsque le navigateur est fermé.

L'évolution couvre tous les modules métier confirmés et toutes les données
structurées autorisées. Elle ne consiste pas à copier toutes les tables SQL,
ni à rendre tous les boutons exécutables sans réseau.

| Fonction                                                 | Comportement hors ligne                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Fiches et référentiels                                   | Consultation des données autorisées préparées                                   |
| Prospects, représentants, visites et saisie des dossiers | Création et modification locales                                                |
| Appels, rappels                                          | Saisie locale et transmission différée                                          |
| Notes vocales                                            | Conservation locale, dépôt après confirmation de la tentative                   |
| Tableaux de bord et supervision                          | Derniers résultats téléchargés, datés ; aucun recalcul des statistiques serveur |
| Anciennes pièces jointes                                 | Disponibles si téléchargées avant la coupure                                    |
| Nouveaux fichiers des parcours existants                 | Conservés jusqu'à confirmation du dépôt                                         |
| Comptes, droits, purges                                  | Connexion nécessaire                                                            |
| Imports, exports serveur et envois externes              | Connexion nécessaire                                                            |
| Validations Banque & Finance                             | Connexion nécessaire                                                            |
| Fusions, suppressions définitives et réaffectations      | Connexion nécessaire                                                            |
| Réglages des campagnes et référentiels                   | Connexion nécessaire                                                            |

Le poste est personnel, avec un compte actif par navigateur. La cible comprend
Chrome, Edge, Firefox et Safari, sur ordinateur et téléphone lorsqu'ils existent
sur la plateforme. Safari/iPhone nécessite aussi une vérification physique.

Le propriétaire a confirmé `apps/go` de ce clone malgré la consigne antérieure
de worktree séparé, et le retour du hors ligne web précédemment différé. À
l'implémentation, mettre à jour ces deux décisions dans les documents concernés,
sans modifier les autres arbitrages : Go, PostgreSQL, React et abandon de Flutter.

### 1.2 Architecture validée

```text
Écrans et formulaires existants
              |
       Accès métier typés
              |
        Dexie / IndexedDB
        + données serveur
        + saisies en attente
        + fichiers locaux
        + état de préparation
              |
       Une boucle de transmission
              |
        Routes Go existantes
              |
Transaction PostgreSQL : idempotence + métier + audit
```

Dexie utilise IndexedDB : ne pas ajouter une deuxième base navigateur. Le
service worker conserve les ressources de l'application ; Dexie conserve les
données métier. Réutiliser les types générés, formulaires et validations actuels.
Le serveur décide définitivement des droits, de l'unicité et des transitions.

### 1.3 Préparation et persistance validées

Ajouter `GET /api/v1/offline/snapshot`, authentifié, avec transfert progressif
et marqueur final. Réutiliser les restrictions métier et lire les données dans
une transaction PostgreSQL cohérente. Préparer une génération locale distincte
et l'activer seulement après réception complète ; garder la précédente en cas
d'interruption.

Afficher progression, dernière préparation et espace estimé. Demander le stockage
persistant sans affirmer qu'il a été accordé si le navigateur le refuse.
Ne jamais annoncer « Prêt hors ligne » après un téléchargement partiel.

Les entités couvertes utilisent Dexie comme source persistante en ligne et hors
ligne. React Query reste responsable des agrégats et lectures serveur non
couvertes. Séparer version serveur et intentions locales pour qu'un
rafraîchissement ne remplace jamais une saisie.

Sauvegarder les brouillons pendant la saisie. La validation enregistre
atomiquement opération et informations nécessaires à sa projection locale.
Afficher « Enregistré sur cet appareil » seulement après commit local.
Un échec laisse le formulaire ouvert et indique comment reprendre.

### 1.4 File et API validées

Chaque opération conserve identifiant stable, compte propriétaire, type métier,
cible, corps typé, base de révision, date, dépendances et erreur. Les créations
reçoivent un UUID navigateur. Une création précède ses modifications ; une
tentative précède sa note vocale.

Une boucle et Web Locks empêchent deux transmetteurs concurrents entre onglets.
L'ordre d'une fiche est conservé, sans bloquer les fiches indépendantes à cause
d'une correction. Réessayer les erreurs réseau, 429 et 5xx avec espacement.
Suspendre sur 401. Conserver les refus et conflits pour correction.

Après succès, appliquer le résultat canonique et retirer l'opération dans une
même transaction Dexie. Rafraîchir ensuite les lectures sans perdre les saisies
restantes.

Conserver les routes métier : aucun second endpoint d'écriture `/sync/push`.
Ajouter `Idempotency-Key` aux écritures éligibles. Une table PostgreSQL associe
compte, clé, empreinte, route et résultat. Réservation, métier, audit et résultat
sont atomiques. Même clé et même requête rendent le résultat confirmé ; une autre
requête sous la même clé est refusée. Pas d'expiration automatique des clés.

Réutiliser les révisions existantes, compléter les seules entités qui en ont
besoin et contrôler les droits à chaque envoi. Idempotence et concurrence sont
deux protections distinctes.

### 1.5 Conflits, session et UI validés

Montrer « Votre saisie » et « Version serveur », les champs différents, la base
initiale accessible, les auteurs et dates connus. Sur ordinateur, deux colonnes ;
sur téléphone, deux valeurs empilées par champ. Choisir par champ ou reprendre
une version entière. Ne pas inventer le motif d'une modification.

Une résolution crée une nouvelle opération, une nouvelle clé et une
précondition sur la révision consultée. Un nouveau changement serveur rouvre le
conflit. Suppression et retrait de droit ne se résolvent pas par fusion.
Une requête dont l'issue reste incertaine ne change pas de contenu.

Première connexion et préparation en ligne. Un profil local précédemment vérifié
permet le rechargement hors ligne ; aucun cookie ni mot de passe dans IndexedDB.
Vérifier le compte avant transmission. Une déconnexion verrouille les données,
sans supprimer la file du compte. La révocation distante ne peut être connue
pendant la coupure ; elle s'applique au prochain contact.

La barre du panneau montre connexion, opérations restantes et corrections.
Un écran partagé présente erreurs et conflits. Les notes vocales gardent leur
route et leur ID de tentative, avec contrôle d'empreinte et publication de
fichier sans écrasement. La présence HTTP ne se rejoue jamais rétroactivement.

### 1.6 Livraison confirmée

Prévoir plusieurs milliers de lignes et plusieurs dizaines de fichiers touchés
pour tous les domaines. Cette profondeur documentaire ne permet pas d'ajouter
des fonctions hypothétiques. Construire d'abord un parcours prospect complet,
puis réutiliser les mécanismes pour les autres domaines.

Vérifier contre PostgreSQL et vrais navigateurs, sans tests unitaires ni mocks
d'API métier. Couvrir coupures, réponse perdue après commit, redémarrage,
deux onglets, droits, quotas, conflits, mises à jour et parité des filtres.
Faire rougir les nouvelles preuves en retirant temporairement leur protection,
puis restaurer.

Exécuter lint, types, build, intégrations Go, Chromium/Firefox/WebKit et appareils
réels, dont iPhone. Une simulation de huit heures complète un poste réel de huit
heures ; elle ne le remplace pas. Publier pertes, doublons, conflits et opérations
restantes avec dénominateurs. Ne pas annoncer le périmètre complet tant que seuls
les prospects sont intégrés.

L'ancienne phrase sur l'impossibilité d'éditer en mode plan était un état de
session, pas une décision technique. Ce document est une spécification ; il ne
signifie pas que le développement a été effectué.

## 2. État du dépôt et adaptations

Les chemins sont relatifs à la racine du dépôt. Le rangement Go prévu dans
`apps/go/NOTE.md` est réservé à une étape ultérieure ; ne pas le mêler à cette
évolution.

| Fichier/zone                          | Constat vérifié                                                                    | Adaptation                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/go/main.go`                     | SPA embarquée, Huma, goose au démarrage                                            | Servir ressources PWA et lecture de préparation                 |
| `apps/go/domaines.go`                 | Routes, gardes et tâches explicitement listées                                     | Monter hors ligne avec garde, aucun cron supplémentaire         |
| `apps/go/middleware.go`               | Session/rôle avant Huma, wrapper HTTP de journalisation                            | Propriétaire attendu, support correct du streaming              |
| `apps/go/web/src/main.tsx`            | React Query avec networkMode always, sans restauration durable                     | Initialiser le poste avant le routeur                           |
| `apps/go/web/src/api/client.ts`       | openapi-fetch typé, ApiError et unwrap                                             | Garder transport réel, pas de faux succès HTTP local            |
| `apps/go/web/src/api/auth.ts`         | me distingue profil, 401 et panne                                                  | Distinguer accès local, session serveur et verrouillage         |
| `apps/go/web/src/routes/_panneau.tsx` | Garde dépendant de me via React Query                                              | Autoriser le profil local préparé sans ôter les gardes          |
| `apps/go/prospects.go`                | ID client déjà accepté et rev disponible, PATCH sans précondition client explicite | Réutiliser ID, ajouter expectedRev et préserver absent/null     |
| `apps/go/representants.go`            | Transactions et rev de modification existantes                                     | Intégrer idempotence sans transactions indépendantes imbriquées |
| `apps/go/qualification.go`            | IDs clients, applied/duplicate, expectedRev prospect facultatif                    | Vérifier empreinte/auteur, renforcer les préconditions          |
| `apps/go/qualification_ouvertures.go` | IDs, brouillons et contrainte de fiche ouverte                                     | Ordre ouverture/brouillon/clôture et conflit métier             |
| `apps/go/qualification_notes.go`      | Temporaire puis rename ; existant accepté sans comparer les octets                 | Publication exclusive et contrôle d'empreinte                   |
| `apps/go/banque.go`                   | bank_cases.rev et expectedRev déjà présents                                        | Réutiliser ; séparer saisie et transition                       |
| `apps/go/accueil.go`                  | Référence visite calculée serveur, pas de rev exposée                              | ID client, rev et référence dans la transaction commune         |
| `apps/go/audit.go`                    | Auteur, avant/après dans la transaction appelante                                  | Compléter les écritures non auditées et le motif de résolution  |
| `apps/go/e2e/pannes.spec.ts`          | L'ancien test refuse un profil si me échoue                                        | Garder cas non préparé, ajouter accès local préparé             |

Versions constatées : Go 1.26.2, Huma 2.39.1, pgx 5.11.0, goose 3.28.0,
React 19.2.7, Vite 8.2.2 et Base UI 1.7.0. Aucune montée de version de cette
stack n'est nécessaire au seul motif du hors ligne.

Avant de coder, relever le statut Git et les diffs concernés. Les fichiers
non suivis présents appartiennent aussi à l'utilisateur. Ne pas éditer les
sorties SQLC, OpenAPI ou le build. La carte doit être adaptée si le dépôt évolue,
sans réinitialiser le travail en cours.

## 3. Packages et responsabilités

### 3.1 Dépendances retenues

Versions interrogées sur npm le 9 septembre 2026 ; aucune n'a été installée pour
rédiger ce document.

| Besoin                       | Package/primitives                                                | Justification                                                      |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| Base locale                  | dexie 4.4.5, Apache-2.0                                           | Transactions et migrations IndexedDB, sans sync REST automatique   |
| Réactivité                   | dexie-react-hooks 4.4.0, Apache-2.0                               | Compatibilité déclarée Dexie 4.x et React >=16                     |
| Cache du panneau             | vite-plugin-pwa 1.3.0, MIT                                        | Compatible Vite 8, Workbox et confirmation de mise à jour          |
| JSON progressif              | @streamparser/json-whatwg 0.0.26, MIT                             | Streams UTF-8 navigateur, sans parseur incrémental maison          |
| Validation des lots          | ajv 8.20.0 et ajv-formats 3.0.1, MIT, à la construction           | Valideurs autonomes dérivés des schémas Huma, sans eval navigateur |
| Verrous/transport/empreintes | Web Locks, Fetch, Web Crypto, encoding/json, crypto/sha256 et pgx | Primitives natives et dépendances existantes                       |
| Interface                    | Base UI et composants existants, Lucide                           | Pas de nouvelle bibliothèque d'éditeur de diff                     |

### 3.1.1 Ce que Dexie fait et ne fait pas

Dexie est la persistance locale, pas l'adaptateur réseau. Le partage des
responsabilités reste explicite :

| Couche | Responsabilité | Ne pas lui demander |
| ------ | -------------- | ------------------- |
| Dexie | IndexedDB, transactions locales, migrations, opérations et brouillons | Appeler l'API, décider d'un conflit ou garantir une livraison serveur |
| Adaptateur web | Sceller l'intention, transmettre, classer l'issue et reprendre la file | Remplacer les règles métier ou la transaction PostgreSQL |
| Go/PostgreSQL | Autorisation, idempotence, métier, révision, audit et reçu rejouable | Dépendre de l'état mémoire du navigateur |

Une transaction Dexie réussie doit toujours précéder l'appel réseau. Le réseau
et IndexedDB ne forment pas une transaction distribuée : `Promise.all()` ne
garantit donc pas une double écriture atomique. En cas de réponse perdue, le
rejeu de la même clé et des mêmes octets est la garantie, pas l'absence de
réémission HTTP.

Vérifier scripts publiés, transitives et avis de sécurité lors de l'installation.
Ajouter versions au catalogue pnpm et utiliser `catalog:`. La taille npm
décompressée de Dexie est environ 3,2 Mo ; elle inclut plusieurs distributions
et ne représente pas le JS servi. Mesurer le bundle construit.

Dexie Cloud, PowerSync et RxDB ont été considérés : leurs services ou protocoles
de réplication changent l'intégration confirmée. Ils ne sont pas intrinsèquement
moins fiables. Le choix explicite de Dexie préserve les routes Go et limite
l'infrastructure ; le projet assume la maintenance de sa file métier.
PowerSync ajouterait un service de synchronisation ; Dexie Cloud déplacerait la
source synchronisée vers son modèle. Aucun des deux n'est requis pour cet
adaptateur et aucun ne doit être ajouté en dépendance transitive « par sécurité ».

TanStack Query persistant ne fournit pas seul les transactions associant
intentions, fichiers et dépendances. p-retry, examiné en version 8.0.1, traite
des essais de promesses sans persister les intentions et dates entre redémarrages.
Ne pas l'ajouter pour doubler une reprise durable : la formule de délai est
triviale et le classement des erreurs appartient au protocole actuel.

### 3.2 Frontières

Trois mécanismes communs : préparer, enregistrer une intention, transmettre.
Les adaptations métier restent dans les modules de données et formulaires
existants, avec leurs types. Aucun framework de plugins, registre découvert par
réflexion, repository supplémentaire, CRDT, Redis, worker serveur ou nouveau cron.

La préparation est complète : pas de curseur de réplication persistant,
tombstones synchronisés ou second journal de changements. Les lots du transfert
sont un découpage mémoire, pas un moteur différentiel.

Le validateur autonome provient du contrat Huma déjà généré. Ne pas recopier tous
les DTO dans des schémas Zod. Zod conserve le rôle des formulaires actuels.
La génération doit échouer sur un schéma non supporté ; ne pas désactiver
globalement les contrôles ni ajouter unsafe-eval à la CSP.

## 4. Contrats et matrice des opérations

### 4.1 En-têtes et préconditions

Ajouter aux seules écritures éligibles :

| En-tête            | Règle                                                               |
| ------------------ | ------------------------------------------------------------------- |
| Idempotency-Key    | UUID d'opération créé une fois, stable jusqu'à issue définitive     |
| X-Offline-User     | UUID propriétaire de la file, égal au principal authentifié serveur |
| X-Offline-Protocol | Entier 1 ; version non reconnue refusée explicitement               |

Ces valeurs ne donnent aucun droit. Le propriétaire attendu empêche qu'une
opération du compte A soit exécutée sous le cookie du compte B, changé entre me
et l'envoi. Comparer côté serveur avant tout effet. Une clé fournie à une route
non éligible ne la transforme pas en opération hors ligne.

Conserver les noms publics des révisions : `rev` pour le PATCH représentant,
`expectedRev` là où il existe. Ajouter expectedRev aux autres modifications
concernées. Le nouvel appelant le fournit impérativement avant son premier envoi.
Ne pas superposer timestamp, ETag et compteur pour la même précondition.

Les dates sur le fil sont UTC ISO ; affichage et jours métier utilisent le
réglage existant, Africa/Dakar par défaut. clientCreatedAt indique la saisie,
l'heure de commit indique l'acceptation serveur. L'ordre local utilise une
séquence transactionnelle, pas seulement l'horloge modifiable du poste.

### 4.2 Liste fermée des écritures

Les chemins commencent par `/api/v1`. Chaque variante de l'union TypeScript
associe corps généré, route existante, cible d'ordre et résultat typé.

| Opération                               | Route                                                    | Dépendance/précondition                                    |
| --------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Créer prospect                          | POST /prospects                                          | ID client, représentant local éventuel                     |
| Modifier prospect                       | PATCH /prospects/{id}                                    | Cible prospect, expectedRev                                |
| Consentement Grand Public               | PATCH /prospects/{id}/parcours/grand-public/consentement | Même cible et révision parent                              |
| Conversion Grand Public                 | POST /prospects/{id}/parcours/grand-public/conversion    | Même cible, règles actuelles                               |
| Créer représentant                      | POST /representants                                      | ID client, unicité téléphone serveur                       |
| Modifier représentant                   | PATCH /representants/{id}                                | Cible représentant, rev existant                           |
| Ajouter commentaire représentant        | POST /representants/{id}/comments                        | ID client, création du parent confirmée                    |
| Ouvrir fiche                            | POST /ouvertures                                         | ID client, chaîne des ouvertures du compte                 |
| Sauver brouillon d'ouverture            | PUT /ouvertures/{id}/brouillon                           | Ouverture confirmée, ordre des versions                    |
| Tentative prospect                      | POST /phase2/call-attempts                               | ID existant, prospect, ouverture, expectedRev              |
| Tentative représentant                  | POST /rep-campaigns/attempts                             | ID existant, représentant, ouverture, précondition ajoutée |
| Annuler rappel                          | POST /phase2/callbacks/{id}/cancel                       | ID résolu après sa tentative source, état contrôlé         |
| Créer visite                            | POST /visites                                            | ID client, référence définitive serveur                    |
| Corriger visite                         | PATCH /visites/{id}                                      | Révision ajoutée                                           |
| Saisir dossier                          | POST /bank-cases                                         | ID client, qualification locale préalablement confirmée    |
| Modifier référence/banque de traitement | PATCH /bank-cases/{id}                                   | expectedRev existant ; aucune transition                   |
| Déposer demande client                  | POST /client-requests                                    | ID client ajouté, approbation en ligne                     |
| Déposer note vocale                     | POST /phase2/call-attempts/{id}/note-vocale              | Tentative confirmée, empreinte binaire                     |

Un rappel créé par une tentative reste un effet de cette tentative. Aucun
endpoint de création supplémentaire. Compléter le résultat de la tentative
avec l'ID du rappel produit, afin de résoudre une annulation saisie avant envoi.
Avant cela, l'annulation référence localement l'opération source.

Transitions/corrections d'étape bancaire, approbations/refus, revue administrative,
résolutions de suggestions et réglages restent en ligne. Le commentaire
représentant est ajoutable hors ligne, supprimable seulement en ligne.
Le formulaire public à jeton n'appartient pas au poste authentifié.

### 4.3 Résultat local et résultat HTTP

Une saisie retourne `enregistre-localement`, avec ID d'opération et ID de fiche.
Le transmetteur reçoit ensuite un résultat serveur. Ne pas fabriquer une réponse
HTTP 200 ni un DTO définitif pour conserver artificiellement une signature.

Adapter les callbacks de formulaire : navigation vers fiche locale permise,
badge « En attente d'envoi », aucune annonce de validation serveur. Une référence
calculée serveur affiche « Attribuée après envoi », pas un numéro officiel inventé.

Pour un 204, traiter le statut attendu explicitement. L'absence de data n'est pas
une erreur universelle. Un 2xx non décodable reste une issue incertaine et interdit
la suppression de l'opération.

## 5. Modèle local Dexie

### 5.1 Stores et isolation

Une base par compte, avec préfixe d'application et UUID. L'origine distingue
les environnements. Une petite base de poste conserve seulement compte actif,
verrouillage et génération de session locale ; aucun secret.

| Store      | Clé/index utile                               | Contenu                                                    |
| ---------- | --------------------------------------------- | ---------------------------------------------------------- |
| etat       | clé fixe                                      | Protocole, profil, génération active, dates et préparation |
| donnees    | [generation+domaine+id], [generation+domaine] | DTO serveur discriminé par domaine                         |
| operations | id, séquence unique, état, cible              | Intention puis requête scellée                             |
| brouillons | clé métier du formulaire                      | Valeurs, base initiale, date, version de sauvegarde        |
| fichiers   | ID local, opération source                    | Blob, MIME, taille, empreinte                              |
| lectures   | clé complète de requête                       | Agrégats et lectures annexes datés                         |
| erreurs    | id, état, date                                | Erreurs locales expurgées à transmettre au support          |

Le store donnees est commun physiquement mais typé par union discriminée,
pas par Record<string, any>. Les modules métier n'accèdent qu'à leurs variantes.

La projection locale se calcule depuis le DTO serveur et les intentions
ordonnées. Ne pas persister une seconde copie de chaque fiche optimiste :
l'intention contient déjà les informations nécessaires. Les brouillons non
validés restent distincts de ces projections.

### 5.2 Structure de l'opération

| Champ                     | Sens                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| id                        | UUID stable de l'intention, clé d'idempotence                             |
| sequence                  | Compteur attribué transactionnellement                                    |
| proprietaireId            | Propriétaire des données et de la file                                    |
| type                      | Variante fermée de la matrice                                             |
| cible                     | Domaine et ID de la fiche ordonnée                                        |
| dependances               | IDs d'opérations précédentes nécessaires                                  |
| base                      | Valeurs éditables visibles et révision connue lors de la saisie           |
| modifications             | Intention typée, distinguant absent/null/valeur                           |
| creeLe                    | Date locale déclarée                                                      |
| requete                   | Nulle avant scellement ; ensuite méthode, URL relative, octets, protocole |
| etat                      | attente, a_verifier, conflit, refusee                                     |
| essais et prochainEssaiLe | Reprise espacée durable                                                   |
| erreur                    | Code/statut/message/requestId et conflit autorisé éventuel                |

L'état en cours est un état d'interface du détenteur du verrou, pas un verrou
persistant qui abandonne une opération après crash. a_verifier signifie qu'une
requête a pu atteindre le serveur, mais que l'issue n'est pas confirmée.

### 5.3 Transactions et migration locale

Une transaction couvre séquence, ajout d'opération, consommation du brouillon
et liens aux fichiers. Une autre couvre résultat serveur, résolution des
dépendances et suppression de l'opération confirmée.

Ne pas attendre Fetch, Web Crypto, timer ou interaction utilisateur dans une
transaction Dexie. Calculer les empreintes avant, écrire ensuite. Laisser
remonter les erreurs qui doivent annuler. Ces contraintes proviennent du cycle
de vie IndexedDB décrit par [Dexie](https://dexie.org/docs/Tutorial/Best-Practices).

Une base qui ne s'ouvre pas n'est jamais effacée automatiquement. Une migration
incompatible présente un écran de reprise et conserve les octets. Une migration
peut reconstruire des copies serveur récupérables, jamais des intentions uniques.
Le code d'une nouvelle version doit savoir lire les opérations de la précédente
avant toute activation du service worker.

## 6. Préparation complète

### 6.1 Format du flux

GET /api/v1/offline/snapshot, comptes internes authentifiés, protocole 1,
réponse application/x-ndjson et Cache-Control private, no-store.

Trois variantes définies dans Huma :

```json
{"type":"debut","protocol":1,"snapshotId":"UUID","userId":"UUID","serverTime":"ISO","collections":[{"domaine":"prospects","total":120}]}
{"type":"lot","snapshotId":"UUID","sequence":1,"domaine":"prospects","items":[]}
{"type":"fin","snapshotId":"UUID","lastSequence":1,"counts":{"prospects":120}}
```

Ces nombres illustrent le format, pas une mesure. items est typé selon domaine.
Une collection interdite est absente ; une collection autorisée vide a un total
zéro. Les lots ont des séquences strictement croissantes sans trou.

Utiliser le parseur retenu avec séparateur nouvelle ligne et émission des
valeurs racines. Valeurs techniques initiales : 100 objets et 1 Mio maximum par
ligne ; scinder avant émission si nécessaire. Une entité indivisible trop grosse
fait échouer la préparation, sans omission silencieuse.

Le validateur autonome est produit depuis les composants Huma/OpenAPI et leurs
références, avec le dialecte JSON Schema déclaré. Enregistrer explicitement les
annotations OpenAPI sans effet de validation ; garder les contrôles stricts.
Les formats UUID/date utilisés sont validés par ajv-formats 3.0.1, dont la
compatibilité déclarée est Ajv 8.x. Ne pas inventer des validateurs de formats.

La sortie de construction des validateurs est ignorée par git et intégrée à
la même commande de génération que les types. Pas de serveur de schémas à
consulter au démarrage hors ligne, ni de compilation dynamique dans le navigateur.

### 6.2 Lectures serveur cohérentes

Ouvrir REPEATABLE READ READ ONLY. Tous les lecteurs, compteurs et lots utilisent
la même connexion transactionnelle. Ne pas exécuter simultanément plusieurs
requêtes pgx sur cette connexion, ni appeler s.pool pour une partie des données.

Extraire les lecteurs réutilisés par leur route et la préparation avec paramètres
d'autorisation explicites. Les lectures SQL manuelles existantes, notamment
visites, reçoivent le DBTX généré par sqlc quand il convient. Aucun repository
additionnel. Des appels HTTP internes aux routes ne partageraient pas le snapshot.

Les gardes de rôle ne suffisent pas : appliquer les filtres de ligne et de champ
des endpoints. Réutiliser propriété, affectations, projet et visibilité Banque &
Finance. Ne pas exposer directement les modèles db, même pour un administrateur.

Ensembles requis :

- prospects et leurs parcours, données nécessaires aux filtres et détails ;
- représentants, commentaires, historiques de fiche et de relation autorisés ;
- tentatives, rappels, ouvertures pertinentes et brouillons propres au compte ;
- campagnes/lots et lignes d'affectation autorisées nécessaires à leurs écrans ;
- visites et référentiels du registre ;
- dossiers et détails bancaires autorisés, demandes clients ;
- référentiels et réglages lisibles nécessaires aux formulaires ;
- notifications, listes administratives et autres données structurées exposées
  par les écrans autorisés, avec les mêmes restrictions de DTO.

Ne pas inclure les tables brutes, sessions, mots de passe, secrets, URLs signées
ou liens à jeton. Ne pas exporter tout audit_logs : seulement les historiques
autorisés par fiche. Les résultats d'agrégats déjà consultés gardent leurs dates
propres, distinctes de la photographie transactionnelle.

Prévoir un budget initial de cinq minutes et annuler sur déconnexion client.
Mesurer le plus grand périmètre autorisé avant livraison. Un dépassement échoue
sans activation ; corriger la lecture d'après les mesures avant d'ajouter une
infrastructure ou d'augmenter arbitrairement les limites.

Envoyer fin seulement après lecture complète et commit réussi. Une erreur après
premiers octets ferme le flux sans fin ; ne pas ajouter un deuxième document
d'erreur HTTP dans une réponse déjà commencée.

Le wrapper reponse du middleware doit exposer Unwrap pour ResponseController.
Flusher les lots et tester le proxy de staging : un tamponnement du proxy peut
empêcher la progression visible même si Go appelle Flush.

### 6.3 Activation locale

1. Vérifier identité, protocole, IndexedDB et contrôle du service worker.
2. Prendre le verrou d'entretien du poste, partagé avec le transmetteur.
3. Créer une génération de préparation sans remplacer le pointeur actif.
4. Valider message, snapshotId, séquence et domaine déclaré.
5. Écrire chaque lot dans une transaction courte ; refuser les IDs dupliqués.
6. Vérifier fin, compteurs et fin effective du flux sans contenu supplémentaire.
7. Revérifier l'identité serveur et le numéro de session locale après transfert.
8. Basculer génération active et date dans une transaction.
9. Relâcher le verrou, reprendre la file puis nettoyer la génération précédente.

Les écritures locales restent possibles pendant le transfert : brouillons et
intentions ne dépendent pas des générations. La transmission et les actualisations
serveur attendent le verrou. Un changement de compte invalide l'activation
d'une ancienne promesse de préparation.

Un refus ou une interruption conserve la précédente photographie si son accès
reste autorisé. Un 401/403 explicite verrouille ; ne pas considérer un refus
de droit comme une simple panne. Une entité disparue de la nouvelle génération
n'est plus consultable ; ses intentions restent conservées et seront refusées
ou corrigées, jamais appliquées à une autre fiche ressemblante.

### 6.4 Espace et progression

Appeler storage.estimate avant, en prévoyant deux générations simultanées.
L'estimation ne réserve pas d'espace : gérer les erreurs réelles de chaque
transaction. Un quota annule uniquement la génération incomplète de ce transfert,
jamais opérations, brouillons et fichiers non confirmés.

Montrer objets reçus/totaux, pas un faux pourcentage d'octets lorsque la longueur
est inconnue. Prêt hors ligne signifie précache applicatif disponible et dernière
préparation complète ; cela ne signifie ni fraîcheur permanente ni garantie
matérielle.

## 7. Lectures, filtres et rafraîchissement

### 7.1 Source par écran

Les listes et détails convertis utilisent des hooks Dexie ; préserver composants
visuels et paramètres d'URL. Le transport actualise les DTO, il n'est pas une
seconde source concurrente. Ne pas monter useQuery et useLiveQuery sur la même
fiche en sélectionnant opportunément le résultat le plus récent.

Pour les agrégats, persister la dernière réponse réussie avec compte, route et
paramètres complets. Hors ligne, dater le résultat. Une période jamais préparée
demande une connexion. Ne pas calculer un chiffre global depuis une base locale
partielle en le présentant comme le résultat serveur.

### 7.2 Fidélité des listes

Adapter les prédicats de présentation dans les modules métier ; l'autorisation
reste appliquée lors de la préparation et de l'envoi. Vérifier particulièrement :

- les parcours CHUES/Grand Public d'un prospect, distincts de son projet d'origine ;
- affectations et campagnes d'après les lignes préparées ;
- appelé par d'après les auteurs d'appels, distinct du dernier appelant ;
- segments Banque/Syndicat avec les constantes métier existantes ;
- bornes de jours, nulls, critères de tri et ordre secondaire ;
- pagination après filtrage, total sur toutes les données locales du domaine ;
- téléphone avec libphonenumber-js et normalisation existante.

La collation JavaScript n'est pas celle de PostgreSQL par hypothèse. Inclure
dans la préparation les clés de recherche normalisées nécessaires lorsque SQL
utilise immutable_unaccent. Inclure les rangs de tri serveur pour les champs
textuels réellement exposés, afin d'éviter une reproduction générale de collation.

Les fiches locales en attente peuvent apparaître dans une section distincte
jusqu'à normalisation serveur. Montrer leurs valeurs modifiées sans fabriquer une
position de tri dite identique au serveur. Tester la parité des listes confirmées
avec accents, ligatures, égalités de noms, nulls et parcours multiples.

Un filtre nécessaire non implémenté est un domaine incomplet, pas un filtre à
ignorer silencieusement quand la connexion tombe.

### 7.3 Actualisation

Réutiliser SSE comme indication de fraîcheur, pas journal garanti. Un événement
précis relit le DTO autorisé et actualise la base serveur locale ; un événement
large marque l'ensemble à rafraîchir. Conserver les intentions superposées.

Après reconnexion et drainage des opérations disponibles, refaire une préparation
complète. À l'ouverture d'un écran en ligne, actualiser ses données sans déclencher
une photographie globale à chaque navigation. Regrouper les demandes simultanées.

Préparation, application des résultats et actualisations ciblées utilisent le
même verrou d'entretien : une ancienne photographie ne doit pas remplacer un
résultat confirmé plus récent. Les saisies locales restent indépendantes.

## 8. Saisie locale et dépendances

### 8.1 Brouillon, intention et requête scellée

Distinguer trois états :

1. Brouillon : ce que l'utilisateur tape, encore annulable.
2. Intention : validation locale effectuée, attente éventuelle d'un parent ou d'une révision.
3. Requête scellée : octets et préconditions définitifs, envoi éventuellement déjà effectué.

Sauvegarder les brouillons après temporisation de 300 ms et à la sortie de champ,
avec compteur croissant pour empêcher une ancienne sauvegarde de remplacer une
nouvelle. La validation attend la sauvegarde et écrit l'intention atomiquement.
Une navigation interne attend les écritures locales lancées. beforeunload ne
sert que d'avertissement éventuel, pas de sauvegarde garantie sur téléphone.

Persister seulement les champs réellement modifiés d'un PATCH. undefined
signifie absent, null signifie effacer ; une chaîne vide garde le sens du
formulaire. Ne pas envoyer un DTO complet pour changer une profession.

### 8.2 Modifications successives d'une fiche

Exemple à implémenter et tester : fiche serveur en révision 7, modification
locale du téléphone, puis de la profession.

- La première intention est scellée avec révision 7.
- Son succès conserve la révision 8 renvoyée.
- La seconde connaît les valeurs visibles lors de sa saisie et ne modifie que la profession.
- Avant son premier envoi, la comparer au résultat canonique précédent.
- Si aucun tiers n'a modifié ses champs, la sceller avec la révision 8.
- Si le serveur a changé un de ses champs édités, demander une résolution.

Conserver la base originale de saisie pour expliquer les changements. La base
d'envoi peut être ajustée seulement avant scellement. Une requête scellée ne
reçoit jamais une autre révision ou un autre corps sous la même clé.
Un refus définitif exige une nouvelle opération après correction.

Même sans tiers, le serveur peut normaliser téléphone ou autres valeurs. Cette
normalisation n'est pas une modification utilisateur concurrente à appliquer en
sens inverse. La seconde intention porte ses champs touchés, pas l'intégralité
de la projection cliente de la première.

### 8.3 Dépendances limitées

Les dépendances vont uniquement vers des séquences antérieures : création
parente, précédente opération de fiche, ouverture et tentative source.
Les dossiers peuvent dépendre d'une conversion ; les notes dépendent d'un appel ;
les annulations dépendent de l'ID réel d'un rappel source.

La transaction d'accusé réception résout ces références et retire la dépendance
avant de supprimer le parent. Ne pas conserver une chaîne d'IDs supprimés
impossible à distinguer d'une opération manquante. Une dépendance inconnue
est une erreur locale visible, jamais une permission d'envoyer dans le désordre.

Les ouvertures ont également un ordre par compte : l'ouverture suivante attend
la clôture de la précédente. Un verrou serveur occupé n'est pas libéré
automatiquement pour débloquer la file. L'utilisateur reprend le parcours
existant ou une personne autorisée libère la fiche selon les règles existantes.

Un poste hors ligne ne réserve pas mondialement une fiche. Le serveur peut
réaffecter ou clôturer une campagne durant la coupure ; conserver les saisies
refusées. Ne pas fabriquer de bail distribué pour éviter cette possibilité.

### 8.4 Annulation

Un brouillon ou une intention jamais scellée peut être annulé explicitement,
avec information sur les descendants. La suppression de sa création laisse
ses descendants à corriger ou à abandonner explicitement, sans les rattacher
à une fiche ayant le même nom.

Une opération d'issue incertaine ne peut pas être supprimée pour annuler son
effet serveur. Résoudre d'abord l'issue par rejeu. Utiliser ensuite l'action
métier de correction lorsqu'elle existe ; aucune annulation serveur générique.

## 9. Transmission et erreurs

### 9.1 Boucle unique

Déclencheurs : nouvelle intention, événement online, retour visible, ouverture
du panneau, bouton de reprise. navigator.onLine est indicatif ; seule l'API
établit joignabilité et identité.

L'événement `online` ne fait que réveiller la boucle. Il ne valide ni l'accès
au domaine ni l'authentification ; une requête réelle tranche. Le service worker
et Background Sync améliorent éventuellement la reprise, mais ne portent pas la
garantie : Background Sync reste à disponibilité limitée selon les navigateurs.

La transaction qui ajoute ou modifie l'opération et passe son état à
`a_verifier` doit être terminée avant `fetch`. Le `operationId` reste stable ;
`requestId` est nouveau à chaque tentative. Ne jamais faire le réseau et la
transaction Dexie en parallèle en prétendant qu'ils sont atomiques.

Sous le verrou exclusif `cpi-poste:<compte>`, vérifier identité et numéro de
session locale, puis choisir la plus ancienne opération éligible :

1. Résoudre dépendances et préconditions locales.
2. Si nécessaire, préparer les octets d'envoi et les sceller dans Dexie.
3. Persister a_verifier avant l'appel réseau.
4. Envoyer par le transport existant, same-origin et en-têtes du protocole.
5. Valider le statut et le résultat attendu.
6. Sur confirmation, appliquer DTO canonique, résoudre dépendants et retirer l'opération atomiquement.
7. Continuer les opérations éligibles puis rafraîchir les lectures.

Un reçu rejoué peut porter une révision plus ancienne que le DTO déjà lu depuis
le serveur. Retirer l'intention confirmée, mais n'appliquer le DTO du reçu que
s'il ne fait pas régresser la révision locale. Les descendants utilisent la
version canonique la plus récente connue et leurs seuls champs touchés.
Pour une donnée sans révision, ne pas remplacer un snapshot récent par un vieux
reçu ; confirmer l'opération puis relire sa donnée par la route autorisée.

La fermeture libère Web Locks. Au redémarrage, a_verifier implique rejeu exact,
pas un nouveau UUID. Ne pas implémenter un verrou à expiration localStorage.
Si IndexedDB ou Web Locks manque, le poste hors ligne est indisponible et
l'interface l'indique ; ne pas présenter une implémentation dégradée comme
équivalente.

La méthode de transport appelée par la boucle doit être celle qui envoie
effectivement l'HTTP. Ne pas repasser par la fonction publique de saisie qui
ajoute à la file, sous peine de réinsérer indéfiniment l'opération.

### 9.2 Classification

| Résultat                             | État/action                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| 2xx conforme                         | Appliquer et retirer atomiquement                                                 |
| Timeout, coupure, corps tronqué      | a_verifier, mêmes octets et clé                                                   |
| 2xx non conforme au contrat          | a_verifier, incompatibilité visible                                               |
| 401                                  | Suspendre tout, reconnexion du même compte                                        |
| Compte différent                     | Verrouiller, aucun envoi sous une autre identité                                  |
| 403                                  | Saisie conservée, droits refusés ; ne pas exposer de nouvelles données interdites |
| 404/410                              | Inaccessible/supprimé, aucune recréation automatique                              |
| 409 de révision                      | Comparaison puis résolution                                                       |
| 409 d'unicité, d'ouverture ou d'état | Correction métier adaptée, pas fusion JSON automatique                            |
| 409 de clé réutilisée                | Défaut de protocole, ne pas créer une autre clé en secret                         |
| 400/413/415/422                      | Corriger après issue définitive, nouvelle intention                               |
| 429                                  | Attendre au moins Retry-After                                                     |
| 5xx                                  | a_verifier, un proxy peut échouer après un commit                                 |

`fetch` ne rejette pas une promesse pour un statut HTTP 4xx ou 5xx : le
transport doit inspecter explicitement le statut et la forme de la réponse.
Un timeout ou une interruption après l'envoi est une issue incertaine, même si
le navigateur la présente comme une erreur réseau ; garder exactement les mêmes
octets et la même clé.

Classifier les codes existants, dont REV_CONFLICT et les codes Banque & Finance,
pas uniquement la classe HTTP. Un 403 ne prouve pas qu'une précédente requête
incertaine n'a rien écrit. Conserver alors l'issue à vérifier même si l'accès
courant interdit un nouveau replay.

### 9.3 Reprises

Valeurs initiales : 30 secondes pour JSON ; upload audio et préparation selon
leurs limites serveur. Backoff 1, 2, 4, 8 secondes, puis plafond 60 secondes,
avec aléa de 0 à 20 %. Retry-After prévaut s'il impose une attente plus longue.

Persister prochain essai. Les erreurs répétées deviennent visibles sans
suppression. Réessayer manuellement ne contourne ni délai serveur ni refus
métier. Une panne générale suspend la file ; un conflit bloque seulement la
cible et ses descendants.

La première version garde un transmetteur séquentiel. Un upload lent retarde
donc momentanément les opérations indépendantes, dans sa limite de durée.
Ne pas créer un pool de workers ou une priorité configurable sans mesure.

### 9.4 Diagnostic utilisable par le support

La console seule ne constitue pas une procédure de support : elle est souvent
fermée avant que l'équipe n'arrive. Pour chaque opération en attente, à vérifier,
en conflit ou refusée, le panneau doit afficher un détail copiable contenant,
sans corps métier ni secret :

- nom affiché, identifiant de connexion et compte authentifiés côté serveur ;
- `operationId`, type, cible non sensible, écran et date de création ;
- état, nombre d'essais, dernier essai, prochain essai et dépendance bloquante ;
- catégorie, code interne, statut HTTP éventuel, message court et `requestId` du dernier essai ;
- version du protocole, version de l'application et navigateur ;
- prochaine action : attendre le réseau, se reconnecter, résoudre, corriger ou contacter le support.

Le bouton « Copier le diagnostic » produit un texte ou JSON borné. Il peut
inclure l'identité interne authentifiée et le contexte technique nécessaires au
support, mais jamais le payload métier, les cookies, les jetons, les numéros de
téléphone, les noms de personnes dans les fiches ou les notes vocales. Le
support recherche `operationId` et `requestId` dans les journaux Go ; une panne
avant émission HTTP est expliquée par l'état et l'erreur locale Dexie. Aucun
nouveau service d'observabilité ni envoi automatique de données CRM n'est
nécessaire.

Une opération ne doit jamais disparaître de l'interface sans résultat final,
abandon explicite ou export du diagnostic. Un message générique comme « une
erreur est survenue » est insuffisant pour l'acceptation.

### 9.5 Remontée de toutes les erreurs applicatives

Toutes les erreurs opérationnelles doivent rejoindre l'administrateur dès
qu'une connexion authentifiée revient, sans attendre une nouvelle saisie. Cela
couvre au minimum :

- Dexie, IndexedDB, quota, migration et service worker ;
- Fetch, timeout, coupure, réponse illisible et reprise ;
- API 4xx/5xx, session, autorisation, conflit et validation serveur ;
- erreur de formulaire, route, React, exception non traitée et promesse rejetée.

Le store Dexie `erreurs` conserve uniquement les erreurs, pas les succès ni une
copie du payload métier. Chaque erreur reçoit un `id` stable ; elle reste locale
jusqu'à un accusé HTTP 2xx de la route de remontée. Les erreurs attendues de
validation sont classées séparément des défauts techniques afin de ne pas
masquer une panne sous du bruit.

La route unique `POST /api/v1/client-errors` accepte un petit lot borné. Le
serveur déduit `userId` de la session, sans faire confiance à un utilisateur
envoyé par le navigateur. Si le compte a changé, l'erreur reste bloquée et ne
doit pas être envoyée sous l'identité du nouveau compte. Une erreur créée avant
la reconnexion est donc envoyée après authentification du même compte.

Le corps autorisé est limité à : `errorId`, `operationId` éventuel,
`requestId` éventuel, catégorie, code interne, source (`dexie`, `transport`,
`api`, `session`, `react`, `runtime`, `service-worker`), route et écran,
statut HTTP éventuel, horodatage, numéro d'essai, version de l'application,
navigateur, message et stack expurgés. Le serveur ajoute le nom affiché et
l'identifiant du téléconseiller depuis la session authentifiée. Tronquer les
messages et stacks ; refuser payload, cookies, jetons, numéros de téléphone,
noms de fiches, notes vocales et contenu métier.

Le serveur écrit le rapport dans une table PostgreSQL `client_error_reports`
avec une contrainte unique `(user_id, error_id)`, puis le journalise avec son
`requestId`. Le rejeu après une réponse perdue devient un doublon sans effet.
Une plateforme externe de logs ou un nouveau conteneur n'est pas nécessaire.

L'écran admin est une liste filtrable par date, téléconseiller, identifiant,
catégorie, code, écran, `operationId` et `requestId`, avec un panneau de détail
et un bouton de copie du diagnostic. Il montre directement qui a eu le
problème, où, quand, pourquoi, combien de fois et la prochaine action. Les
erreurs critiques sont distinguées des refus métier attendus ; il ne montre
jamais le payload CRM. L'accès suit les rôles admin existants et chaque
consultation reste soumise aux règles d'accès.

Déclencher la remontée à l'ouverture, au retour de visibilité, à l'événement
`online` et après reconnexion réussie. L'événement réseau ne prouve pas la
joignabilité : conserver la même reprise que pour les opérations. Une panne de
la route de diagnostic ne doit jamais bloquer la file métier.

Installer un filet de sécurité `window.onerror`, `unhandledrejection`, les
error boundaries React et les erreurs du service worker. Le reporter doit
ignorer ses propres erreurs, limiter la taille et le débit, dédupliquer un même
événement et ne jamais bloquer l'interface.

## 10. Idempotence PostgreSQL

### 10.1 Table des résultats

Créer une migration goose additive pour `operations_hors_ligne`.

| Colonne             | Type                                    | Sens                     |
| ------------------- | --------------------------------------- | ------------------------ |
| utilisateur_id      | text, convention actuelle des IDs users | Propriétaire             |
| cle                 | uuid                                    | Clé stable               |
| protocole           | integer                                 | Version                  |
| methode, cible_http | text                                    | Action et cible relative |
| empreinte           | bytea                                   | SHA-256 calculé serveur  |
| statut_http         | integer                                 | Résultat définitif       |
| reponse             | jsonb                                   | Corps métier sérialisé   |
| cree_le             | timestamptz                             | Date serveur             |

Clé primaire (utilisateur_id, cle). Aucun index anticipé. Ne pas stocker une
seconde copie du corps privé complet : l'empreinte suffit. Ne pas conserver
cookies, secrets ou en-têtes de session dans les reçus.

La réservation peut être incomplète pendant sa transaction, jamais après commit.
Le helper unique possède finalisation/commit/rollback. Les intégrations vérifient
qu'aucune réservation partielle n'est visible après les pannes. Une contrainte
différée PostgreSQL vérifie statut et corps finalisés à la fin de transaction ;
un résultat 204 utilise JSON null comme valeur explicite. Ainsi même un appelant
qui oublie la finalisation ne peut pas commiter une réservation orpheline.

Pas de suppression en cascade ou de nettoyage temporel qui rende une ancienne
opération rejouable après restauration d'un compte. Une politique future de
minimisation devra conserver au moins la preuve de consommation des clés ;
aucune purge de reçus n'est ajoutée ici.

### 10.2 Empreinte

Couvrir protocole, méthode, cible relative et paramètres significatifs,
type de contenu et octets du corps. Séparer les composants sans ambiguïté
par encodage structuré ou longueurs. Exclure cookies, requestId, compteur
d'essais et dates techniques de transmission.

Le client conserve les octets scellés ; le serveur calcule son empreinte depuis
les octets réellement reçus. Une empreinte annoncée par le navigateur ne fait
pas foi. La capture du corps est bornée selon la route, avec les primitives
HTTP standard ; rendre les mêmes octets au décodage Huma.

Ce contrat est strict : des octets différents sous la même clé sont refusés,
même s'ils semblent sémantiquement équivalents. Cela évite une normalisation
générique complexe. La correction utilise une autre clé.

### 10.3 Transaction commune

Le helper reçoit identité/empreinte, garde ressource et fonction métier utilisant
la transaction. Un middleware qui appelle un handler déjà transactionnel,
laisse commiter le métier, puis enregistre la réponse est interdit : sa fenêtre
entre commits permet des doublons.

Dans READ COMMITTED :

1. Réserver par INSERT ON CONFLICT DO NOTHING RETURNING.
2. Si la clé existe, attendre la fin de la transaction concurrente puis relire le reçu.
3. Vérifier empreinte, protocole, méthode et cible.
4. Vérifier le droit actuel à recevoir ce résultat.
5. Restituer le reçu accessible sans réexécuter le métier.
6. Pour une nouvelle clé, créer un savepoint après réservation.
7. Exécuter gardes et métier sur la transaction ; produire DTO canonique et audit.
8. Sur refus métier définitif, revenir au savepoint et finaliser le reçu avec ce refus.
9. Sur erreur interne/transitoire, rollback complet ; aucun résultat confirmé.
10. Finaliser puis commit ; répondre et publier les invalidations existantes après succès.

Le savepoint évite un effet partiel si le métier refuse après une écriture.
Les erreurs de validation Huma avant la transaction ne créent pas de reçu :
la requête est structurellement invalide, une correction reçoit une autre clé.

Avec READ COMMITTED, une nouvelle lecture après ON CONFLICT peut voir le reçu
concurrent. Ne pas supposer qu'un CTE unique voit obligatoirement cette ligne
dans le snapshot du statement initial.

Un Commit d'issue inconnue conserve l'incertitude. Rejouer la même clé résout
l'issue, sans prétendre un rollback ou un succès non confirmé.

### 10.4 Réponses, refus et droits

Mémoriser aussi les conflits métier définitifs pour qu'un retry retardé de
l'ancienne clé ne s'applique pas après création d'une résolution. La fiche jointe
à un vieux refus peut être périmée ; relire avant une nouvelle décision.

Conserver code HTTP et corps métier. Le requestId de transport est celui du
nouvel essai, pas une preuve d'une nouvelle écriture. Les réponses rejouées ne
publient pas un deuxième audit ou un deuxième événement métier.

Un droit retiré peut empêcher la divulgation du reçu avant même sa lecture.
Ne pas exposer un ancien DTO sensible pour confirmer la synchronisation.
Afficher résultat à vérifier avec accès retiré et conserver la saisie.
Une personne autorisée peut consulter le reçu ; aucun effacement de la file
fondé sur l'hypothèse qu'un 403 annule le passé.

## 11. Révisions et audit

### 11.1 Périmètre des révisions

La révision appartient à la fiche éditable : prospect, représentant, visite,
dossier. Un appel/commentaire append-only garde son ID ; s'il modifie la fiche,
il vérifie aussi la révision du parent.

bank_cases a déjà rev : pas de offlineRev. Ajouter `rev integer NOT NULL
DEFAULT 1` aux visites et exposer sa valeur. Les demandes clients seulement
créées hors ligne ne nécessitent pas un compteur supplémentaire. Annuler un
rappel vérifie état, auteur et tentative source ; cela n'impose pas un compteur
sur toutes les tables.

Inventorier toutes les écritures de ces fiches, y compris les routes restées en
ligne et les traitements serveur. Tout changement d'état éditable incrémente
la révision. Une écriture oubliée invalide la détection de conflit. Ne pas
ajouter un trigger qui incrémente deux fois un compteur déjà géré par SQL.

### 11.2 Contrôle atomique

Utiliser UPDATE WHERE rev attendu avec incrément et résultat, ou verrou de ligne
pour une opération complexe. SELECT puis UPDATE sans précondition est insuffisant.
Verrouiller le parent avant d'insérer tentative, rappel ou audit dans les
opérations qui changent ensemble leur état.

qualificationTx, prospectTx, transactionBanque et les Begin directs sont des
points à adapter, pas des transactions à superposer. Le métier intégré reçoit
le q transactionnel du helper et ne réouvre pas s.pool.Begin.

Un précontrôle avant transaction peut améliorer le message mais sa condition
autoritative doit être vérifiée dans la transaction. Produire le DTO du résultat
depuis cette transaction, pas avec une lecture du pool après commit qui pourrait
retourner une modification concurrente suivante.

### 11.3 Particularités métier

Prospects : réutiliser l'ID déjà accepté. Préserver prospectOptionnel pour absent
et null. Protéger PATCH, consentement et conversion. Le conflit de téléphone
est un conflit d'identité ; ne pas fusionner automatiquement deux personnes.

Représentants : réutiliser rev et historique. L'appel peut changer téléphone,
relation, établissement ; il protège le parent comme le PATCH. Un ID d'appel
connu ne rend pas acceptable un autre auteur ou un contenu différent.

Visites : accepter ID client et créer la référence officielle dans la transaction.
La boucle actuelle sur erreur 23505 ne peut continuer dans une transaction
avortée : utiliser un savepoint par essai de référence ou une insertion
conflict-aware. Ne pas relancer hors de la transaction commune.

Banque & Finance : l'identité client est copiée du prospect au moment où le
serveur accepte le dossier. Préserver cet invariant, ne pas lui substituer
l'identité non vérifiée de la copie locale. La qualification locale doit être
acceptée auparavant. Montants, étapes et décisions restent sur les routes en
ligne ; référence et banque de traitement restent dans le PATCH prévu.

Rappels : une date passée pendant la coupure conserve son sens et apparaît en
retard. Ne pas réécrire la date utilisateur pour satisfaire une validation.
Si un paramètre a changé et refuse la saisie, conserver pour correction.

### 11.4 Métadonnées d'audit

Réutiliser audit_logs, auteur, avant et après. Ajouter seulement les métadonnées
nécessaires à la résolution : operationId et resolutionReason facultatifs.
Pas de deuxième historique et pas d'usage du champ operationId comme
déduplication parallèle.

Le motif est facultatif, borné selon les limites actuelles de commentaire.
Le serveur choisit auteur et date d'acceptation ; la date locale est étiquetée
comme telle. Les écritures hors ligne qui n'auditent pas encore leurs champs
doivent le faire dans la transaction.

Ne pas inventer l'auteur historique d'une valeur. Les détails accessibles de
l'audit prouvent qui a changé quel champ ; sinon montrer auteur inconnu.
Une entrée de dernier auteur de fiche n'est pas automatiquement l'auteur de
chaque champ du conflit.

## 12. Résolution visuelle des conflits

### 12.1 Données et comparaison

Le conflit typé contient type de fiche, ID, DTO courant, révision et métadonnées
autorisées d'audit. La base et la saisie locale proviennent de l'intention.
La variante de domaine guide le formulaire, sans casts vers un objet arbitraire.

Un conflit peut être consulté hors ligne. Le choix est sauvegardé comme brouillon ;
avant envoi, relire le serveur et vérifier que la comparaison reste actuelle.
Une lecture impossible laisse la résolution en attente, sans annoncer qu'elle
compare la toute dernière version.

Pour chaque champ, comparer B (base), L (local) et S (serveur) :

| Condition                           | Proposition                 |
| ----------------------------------- | --------------------------- |
| L = B et S = B                      | Inchangé, masqué par défaut |
| L = B, S différent                  | Garder S                    |
| S = B, L différent                  | Proposer L                  |
| L = S                               | Valeur commune              |
| L et S différents entre eux et de B | Choix obligatoire           |

La proposition remplit un formulaire de résultat ; elle n'envoie pas une fusion
silencieuse. Une qualification implique aussi une décision métier, pas seulement
des valeurs JSON.

Comparer IDs référentiels, afficher libellés. Préserver absent/null. Traiter
les tableaux comme valeurs atomiques sauf règle métier existante. Numéros,
dates et montants utilisent les représentations canoniques ; pas de float
pour comparer des montants déjà représentés par chaînes.

### 12.2 Composition

Utiliser le Sheet existant pour la liste des opérations et un écran du panneau
pour résoudre une fiche. Réutiliser champs, boutons, radios natives avec
fieldset/legend et labels, contrôles de formulaire et Lucide. Pas d'éditeur
Git/Monaco pour comparer un numéro de téléphone.

Ordinateur : deux colonnes alignées, Votre saisie à gauche, Version serveur à
droite. Chaque ligne montre nom du champ, valeurs, choix actif et informations
de modification réellement disponibles. La base initiale est dépliable.
Le résultat proposé est éditable avec le formulaire métier.

Téléphone : un bloc par champ, deux valeurs successives et mêmes commandes.
Aucun défilement horizontal obligatoire. Ni couleur seule ni ordre de lecture
incohérent. Afficher les dates avec les fonctions du panneau.

Actions : Garder ma saisie, Garder la version serveur, Modifier et Enregistrer
la résolution. Les actions globales sont possibles mais l'abandon de toute la
saisie nécessite confirmation. Motif facultatif, « Motif non renseigné » et
« Auteur non disponible » quand l'information manque.

Le bouton final reste indisponible si des choix conflictuels manquent ou si le
formulaire est invalide. Sauvegarder les choix, annoncer les erreurs, déplacer
le focus vers le premier problème et restaurer le focus au retour à la liste.
Tout fonctionne au clavier, en lecture assistée et avec animations réduites.

### 12.3 Nouvelle opération

Créer la nouvelle intention et remplacer l'ancienne atomiquement seulement
lorsque le refus définitif de l'ancienne est connu. Mettre à jour ses dépendants
si leur sens reste valide. Une création abandonnée ne transfère pas ses
descendants à un autre ID choisi par ressemblance.

Toujours nouvelle clé, toujours précondition récente. Si le serveur change
encore, conserver les choix comme brouillon et signaler les nouvelles différences.
Pas de bouton Forcer ni de contournement de garde ajouté pour résoudre un conflit.

## 13. Notes vocales et fichiers

### 13.1 Enregistrement local

Le dépôt actuel concerne MediaRecorder et les notes dictées après appel.
Réutiliser la détection de formats supportés et les conteneurs autorisés au
serveur. Aucune capture de l'audio d'appel.

Conserver Blob, taille, MIME, ID de tentative et SHA-256. Pas de base64 JSON.
Attendre l'événement de fin du recorder et le commit IndexedDB avant confirmation.
Des morceaux reçus pendant l'enregistrement peuvent être sauvegardés pour réduire
la perte d'une fermeture, mais un conteneur tronqué non lisible n'est pas présenté
comme une note récupérée.

Réutiliser NOTE_VOCALE_MAX_SIZE_BYTES, actuellement 25 Mo par défaut, et exposer
la limite dans la préparation. Ne pas coder une limite différente dans le client.
Mesurer le volume réel de notes d'un poste ; huit heures de poste ne signifient
pas huit heures d'audio.

### 13.2 Publication serveur

Confirmer la tentative avant le dépôt. Vérifier l'accès auteur même si le
fichier existe. Même tentative et mêmes octets : même résultat. Octets différents :
conflit explicite, jamais remplacement.

Écrire dans un temporaire du même répertoire, avec taille bornée et conteneur
validé. Synchroniser le fichier puis publier atomiquement sans remplacement.
Sur le volume Linux cible, un lien dur exclusif du temporaire vers le nom final
permet EEXIST au lieu d'un écrasement par rename ; vérifier ce support sur le
volume de staging. Nettoyer uniquement le temporaire de cette opération.
Synchroniser le répertoire avant confirmation lorsque supporté.

Si le final existe, comparer les empreintes. Un crash après publication avant
réponse devient un rejeu sans remplacement. L'effet filesystem ne partage pas
la transaction SQL : l'immuabilité du fichier protège la reprise, puis le
reçu SQL conserve l'issue. Si la finalisation du reçu échoue, le fichier existant
sert à reprendre ; ne pas publier un contenu différent.

La purge existante doit distinguer les dépôts confirmés des fichiers publiés
dont le reçu n'a pas encore été finalisé. Ne pas purger ces derniers sur la
seule ancienneté : la reprise doit pouvoir vérifier leur contenu avant de
finaliser le reçu. Un fichier orphelin de cette étape exige vérification de
l'issue, pas une suppression automatique suivie d'une recréation au retry.

La rétention actuelle, 48 heures par défaut, peut retirer un fichier confirmé.
Ce retrait est distinct d'un échec de transmission. Garder le reçu pour empêcher
un ancien retry de recréer un audio purgé. Ne pas affirmer fichier disponible
sur la seule présence du reçu ; vérifier disponibilité et expiration.

### 13.3 Anciennes pièces et périmètre

Les anciens fichiers se téléchargent explicitement avant coupure. Conserver
disponibilité et expiration ; réutiliser la route d'accès autorisée. Nettoyer
en priorité les copies serveur retéléchargeables, jamais les saisies non envoyées.

N'ajouter aucun système générique de pièces jointes à un domaine qui n'en a pas.
La mention nouveaux fichiers couvre les dépôts actuels réellement découverts
dans les parcours. Un nouveau type de fichier métier exige son propre besoin,
son endpoint et ses limites.

## 14. Session et autorisations

### 14.1 Initialisation

Initialiser le poste avant le routeur. Sans préparation ni profil vérifié,
connexion en ligne obligatoire. Avec profil préparé non verrouillé, permettre
la navigation hors ligne après rechargement. Ce profil décrit l'accès à une
copie locale ; il ne prouve pas la validité actuelle de la session serveur.

En ligne, me doit réussir avant transmission. Une panne réseau autorise le
repli local préparé ; un 401/403 explicite verrouille jusqu'à reconnexion.
Ne pas transformer toutes les erreurs en anonyme, ni toutes en mode hors ligne.

Le TTL Go reste celui du projet, actuellement 30 jours par défaut. Pas de
mot de passe local, JWT local ou secret persisté pour ce poste de huit heures.
Le cloisonnement IndexedDB n'est pas un chiffrement contre une personne qui
contrôle le navigateur. Le poste personnel doit disposer du verrouillage et de
la protection disque du système ; ne pas présenter la session locale comme
une authentification cryptographique hors ligne.

### 14.2 Changement de compte

Un verrou d'identité commun à l'origine et un numéro de session locale protègent
le changement. Fermer abonnements, suspendre les envois, incrémenter ce numéro,
vider les caches en mémoire puis ouvrir la base du nouveau compte.
Une réponse tardive ne peut écrire dans la base désormais active.

Le contrôle serveur X-Offline-User empêche l'exécution sous le mauvais cookie.
Les verrous navigateurs ne suffisent pas si une autre page change la session
avant que l'onglet ne reçoive l'événement.

Déconnexion hors ligne : verrouiller immédiatement les données et suspendre
la file. On ne peut pas révoquer le cookie HttpOnly sans réseau. Conserver une
intention de révocation propre à l'ancienne identité ; au retour réseau,
vérifier l'identité avant logout pour ne pas déconnecter le nouveau compte
connecté ailleurs. Finir cette révocation avant toute reprise de l'ancien compte.

Un poste explicitement déconnecté ne se déverrouille pas automatiquement parce
que me retrouve encore un cookie valide. Exiger une connexion en ligne explicite
pour réouvrir ses données. Le changement de compte ne supprime aucune file.

Un effacement local, s'il est demandé, présente le nombre de saisies non envoyées
et exige confirmation spécifique. Jamais comme dépannage automatique.
Les données interdites sont retirées de la consultation au prochain contact,
sans transférer leurs intentions à un autre utilisateur.

### 14.3 Révocation et confidentialité

Réévaluer droits de rôle et ressource à la transmission, dans la transaction.
Les permissions locales servent à l'interface ; elles n'autorisent pas SQL.
La préparation et les détails de conflit appliquent aussi les restrictions
de champs.

Une révocation pendant la coupure n'est pas instantanément observable. L'appliquer
dès le prochain contact ; conserver une issue incertaine comme telle. Les
résultats en cache et notifications ne doivent pas divulguer à un compte courant
des données provenant d'un compte précédent.

Aucun token de formulaire public, cookie, URL signée, secret ou hash dans le
snapshot. Les logs de reprise contiennent IDs techniques, codes et durées,
jamais les notes, numéros ou corps complets.

## 15. Cache applicatif et déploiement

### 15.1 Ressources et routes

Configurer vite-plugin-pwa en génération Workbox avec confirmation de mise à
jour. Précacher HTML, modules dynamiques de toutes les routes, CSS, polices et
icônes locales. Réutiliser le manifeste et les assets existants quand présents.

Le repli de navigation rend le panneau pour ses routes, jamais pour /api ou
/health. Un fichier JS inexistant répond 404, pas index.html sous un faux type.
Le serveur embarqué actuel replie largement : distinguer navigation HTML et
ressources statiques dans servirPanneau.

Le service worker est servi à la racine, scope /, type MIME correct, en-têtes
permettant sa revérification. Les modules hashés peuvent être conservés durablement.
Vérifier le précache des chunks TanStack Router et ses limites réelles de taille.
Un asset absent ou trop gros bloque l'état prêt, pas une erreur ignorée dans
la console.

La CSP autorise précisément worker same-origin, audio blob et les ressources
locales nécessaires. Aucun connect-src universel ni unsafe-eval. Déploiement
HTTPS ; les particularités localhost servent seulement au développement/test.

### 15.2 Onglet normal

Préparer le poste attend un service worker actif et un précache terminé.
Au premier chargement sans contrôleur, attendre le contrôle ou demander un
rechargement explicite avant d'annoncer prêt. Le test doit ouvrir ensuite une
route jamais visitée en mode avion, sans installation PWA.

Installer l'application n'est pas une garantie supplémentaire des écritures.
Si une API de stockage requise est refusée, notamment en navigation privée,
expliquer que le hors ligne est indisponible. Préserver la consultation en
ligne existante sans prétendre offrir la même persistance.

### 15.3 Mises à jour

Ne pas activer une nouvelle version pendant envoi, saisie non sauvegardée ou
résolution non enregistrée. Vérifier l'état de tous les onglets sous les verrous
communs avant confirmation. Différer l'activation lorsque la file ne peut pas
être traitée ; les migrations compatibles conservent ses octets.

Une requête scellée garde son protocole après déploiement. La première version
implémente uniquement 1 ; ne pas construire un framework multi-versions.
Une évolution incompatible ultérieure doit conserver le lecteur précédent tant
que des postes peuvent avoir saisi des opérations sous cette version.
Huit heures n'est pas une date d'expiration autorisant à jeter ces opérations.

Déployer API et migrations additives avant le panneau. Vérifier l'ancien
panneau contre l'API augmentée. Un rollback ne supprime ni reçus ni révisions,
et ne relance pas une version qui ignore les protections devenues nécessaires.
Préférer une correction en avant lorsque le downgrade rendrait la file dangereuse.

Tester cache, flush et cookies derrière le proxy de staging, pas seulement
Vite. Cette spécification n'autorise aucune publication en production.

## 16. Lots d'implémentation

### 16.1 Carte des surfaces

Les chemins suivants sont relatifs à apps/go ; les nouveaux fichiers sont une
cible, pas des fichiers déjà créés.

| Surface            | Cible                                         | Responsabilité                             |
| ------------------ | --------------------------------------------- | ------------------------------------------ |
| Base locale        | web/src/lib/hors-ligne/base.ts                | Stores, version, transactions et poste     |
| Préparation        | web/src/lib/hors-ligne/preparation.ts         | Flux, générations et activation            |
| File               | web/src/lib/hors-ligne/file.ts                | Ordre, scellement, transmission et accusés |
| Comparaison        | web/src/lib/hors-ligne/conflits.ts            | Champs autorisés et résolution             |
| UI                 | web/src/components/hors-ligne/                | État, liste, écran de comparaison          |
| Adaptations métier | web/src/lib/data/ et formulaires actuels      | Projections et accès typés par domaine     |
| Préparation Go     | hors_ligne.go                                 | Lecteurs partagés, protocole et gardes     |
| Idempotence Go     | idempotence.go                                | Empreinte, transaction et résultat         |
| SQL                | sql/queries/hors_ligne.sql et migration goose | Reçus et seules colonnes requises          |
| Vérification       | intégrations Go et e2e/                       | Preuves contre la pile réelle              |

Ne pas créer toutes ces coquilles au début. Les 300 lignes concernent aussi
les fichiers TypeScript de support. Les adaptations métier ne s'empilent pas
dans file.ts : garder les corps et projections dans leurs domaines actuels.
Extraire selon responsabilité et plafond, sans interfaces inutiles.
Pas de déplacement global vers internal/ dans ces lots.

### 16.2 Lot 0 : baseline

Relever diff utilisateur, versions et emplacement réel des modules. Inventorier
routes, lecteurs de préparation, droits et toutes les écritures de révision.
Mesurer volumes DTO et fichiers sur une copie anonymisée, pour le rôle ayant
le plus de données autorisées. Relever les checks déjà rouges.

Livrable : courte liste d'écarts, volumes mesurés et baseline. Ne pas écrire une
infrastructure de benchmark ; utiliser les commandes et copies existantes.

### 16.3 Lot 1 : parcours prospect vertical

Installer les dépendances utiles au lot. Ajouter base locale, cache applicatif,
préparation prospect/référentiels/historique et table d'idempotence. Le manifeste
intermédiaire ne prétend pas que tous les domaines sont préparés.

Intégrer création, modification, ouverture, brouillon, tentative et rappel.
Adapter session, routeur et reprise après rechargement. Construire le résolveur
sur un vrai conflit de prospect avec révision et audit.

Sortie : création/modification hors ligne, qualification, réponse perdue après
commit et conflit prouvés. Inclure deux modifications successives avec révisions
correctes. Ne pas généraliser un socle non vérifié.

### 16.4 Lot 2 : Grand Public, représentants, audio

Réutiliser les prospects avec paramètre projet. Ajouter consentement/conversion,
sans copie de l'arbre CHUES. Brancher formulaires représentants, commentaires,
appels et historique sur les mêmes mécanismes.

Compléter l'ordre d'ouvertures par compte. Tester avec un autre poste du même
compte et avec réaffectation serveur. Ajouter Blobs et publication exclusive des
notes ; vérifier formats Firefox et Safari. Les confirmations appel et fichier
restent distinctes.

### 16.5 Lot 3 : accueil et Banque & Finance

Adapter visite, UUID, référence, rev, audit, référentiels et filtres. Tester
collision de référence dans la transaction commune, et effacement par null.

Intégrer saisie de dossier, PATCH référence/banque et dépôt de demande client.
Maintenir transitions/validations administratives en ligne. Vérifier la chaîne
prospect local, qualification acceptée, dossier puis refus de doublon métier.

### 16.6 Lot 4 : complétude et réception

Compléter toutes les collections autorisées, relations, historiques et lectures
annexes. Brancher agrégats datés, rafraîchissements et préparation à reconnexion.
Vérifier quotas, changement de compte, actualisation simultanée, compatibilité
entre deux builds et rollback sûr.

À la livraison de code, mettre à jour les décisions de hors ligne/worktree dans
plan.md et consignes, ainsi que le README Go. Ne pas modifier les autres choix
de v2. Exécuter la matrice et un poste physique de huit heures.

Le périmètre complet n'est pas livré si un seul parcours passe. Chaque domaine
confirmé a son test et ses limites consignées.

### 16.7 Handoff

Une tâche confiée à un exécutant contient lot, objectif, fichiers exacts,
comportement actuel, contrats de ce document, invariants, modifications présentes,
commandes et actions externes non autorisées. Un propriétaire par surface,
aucun « continue » sans contexte.

L'intégrateur inspecte les diffs et preuves, vérifie les contrats React/Go/SQL
et exécute le parcours assemblé. Une synthèse d'exécutant ne prouve pas un commit
atomique ni une reprise réussie.

## 17. Vérification réelle

### 17.1 Environnement

Utiliser les intégrations Go existantes sous tag integration, contre une base
PostgreSQL dédiée. Identifier explicitement la base avant toute migration ou
préparation de fixtures. Ne pas déduire une base production d'une variable
par défaut.

Le harnais Playwright lance ../cpi-go et peut réutiliser un serveur existant :
vérifier le binaire testé, désactiver la réutilisation d'un serveur inconnu en
CI. Utiliser les comptes fixtures réels, pas route.fulfill pour simuler le métier.

Une injection de panne peut abandonner une vraie réponse après exécution API.
Observer le commit PostgreSQL avant l'abandon. route.fetch puis route.abort est
utilisable seulement si cette route n'est pas interceptée par le service worker
et si l'interception est effectivement vérifiée. Aucune réponse métier inventée.

### 17.2 Intégrations API

| ID     | Scénario                                              | Preuve                                                 |
| ------ | ----------------------------------------------------- | ------------------------------------------------------ |
| API-01 | Même compte/clé/octets, envois concurrents            | Un effet, un audit, réponses équivalentes              |
| API-02 | Clé identique et corps différent                      | Refus sans effet supplémentaire                        |
| API-03 | Clé identique, compte différent                       | Aucune lecture d'un reçu privé, gardes effectives      |
| API-04 | Panne entre métier et commit                          | Aucune mutation/audit/réservation partielle visible    |
| API-05 | Commit puis réponse perdue                            | Rejeu sans double effet                                |
| API-06 | Refus après effet SQL intermédiaire                   | Savepoint annule l'effet, refus mémorisé               |
| API-07 | Deux clés, même révision                              | Une mise à jour, un conflit                            |
| API-08 | Ancienne clé après résolution                         | Ancien refus définitif, aucune écriture tardive        |
| API-09 | Droits/affectation retirés                            | Snapshot et file ne contournent pas la restriction     |
| API-10 | Compte changé entre me et envoi                       | Refus du propriétaire attendu avant effet              |
| API-11 | Snapshot pendant écritures concurrentes               | Relations et compteurs cohérents                       |
| API-12 | Flux coupé ou erreur SQL                              | Aucun marqueur final                                   |
| API-13 | Référence visite concurrente                          | Deux références uniques, aucun doublon                 |
| API-14 | Dépôts audio concurrents identiques/différents        | Identique accepté, différent refusé sans écrasement    |
| API-15 | Écritures en ligne d'entités couvertes                | Révisions maintenues par tous les chemins              |
| API-16 | Tentative de commit d'une réservation incomplète      | Contrainte différée refuse le commit                   |
| API-17 | Ancien reçu après lecture d'une révision plus récente | Opération confirmée, aucune régression de fiche locale |

### 17.3 Parcours navigateur

Regrouper par métier et paramétrer par navigateur ; les lignes suivantes
n'exigent pas chacune un nouveau fichier.

| ID     | Scénario                                          | Preuve                                               |
| ------ | ------------------------------------------------- | ---------------------------------------------------- |
| WEB-01 | Accès neuf sans réseau                            | Préparation/connexion exigée                         |
| WEB-02 | Préparation puis route jamais ouverte hors ligne  | Shell, fiche, référentiels disponibles               |
| WEB-03 | Rechargement profond et réouverture du navigateur | Brouillons, données et file conservés                |
| WEB-04 | Création puis deux modifications                  | IDs stables, révisions correctes, toutes les valeurs |
| WEB-05 | Ouverture/appel/rappel/note                       | Ordre et états distincts                             |
| WEB-06 | Résolution puis nouveau changement serveur        | Nouveau conflit, choix conservés                     |
| WEB-07 | Suppression ou droit retiré                       | Saisie conservée, aucune recréation automatique      |
| WEB-08 | Deux onglets                                      | Un transmetteur, pas de verrou orphelin              |
| WEB-09 | Autre compte connecté                             | Aucun mélange ni résultat tardif appliqué            |
| WEB-10 | Quota/persistance refusée                         | Message exact et saisies conservées                  |
| WEB-11 | Lot invalide ou préparation coupée                | Ancienne génération, pas de faux prêt                |
| WEB-12 | Préparation demandée pendant confirmation         | Pas de régression après bascule                      |
| WEB-13 | Mise à jour avec file/conflit                     | Activation différée, données intactes                |
| WEB-14 | Filtres/accents/nulls/tris                        | Parité des données confirmées avec l'API             |
| WEB-15 | Fiche indépendante après refus                    | Elle est transmise                                   |
| WEB-16 | Déconnexion hors ligne puis reconnexion réseau    | Verrouillage, révocation cohérente                   |
| WEB-17 | Agrégat et filtre jamais consulté                 | Date affichée, indisponibilité expliquée             |
| WEB-18 | Huit heures, session expirée                      | Travail conservé, reprise après authentification     |

Un refus de persistance injecté ne prouve pas une éviction réelle. Le test quota
provoque une erreur réelle IndexedDB dans un profil jetable, ou reste marqué
non exécuté. Ne pas remplir le disque du développeur.

### 17.4 Navigateurs et appareils

Ajouter Chromium, Firefox et WebKit dans Playwright. Garder les parcours
paramétrés et les tests responsive existants. Un storageState ne prouve pas seul
la conservation du service worker et de tous les stores : utiliser des profils
persistants pour les scénarios de vrai redémarrage.

Les cookies __Host- et secure contexts doivent fonctionner comme en production.
Si HTTP localhost ne le reproduit pas sur un moteur, utiliser HTTPS local du
harnais, sans affaiblir les cookies du produit.

Réception physique : Chrome Android, Safari iPhone/macOS, Edge Windows et
Firefox/Chrome ordinateur ciblés. Consigner version, OS, mode onglet/installé,
date et résultat. Un appareil indisponible est un test manquant.

### 17.5 Tests qui détectent les défauts

Dans une copie contrôlée, retirer temporairement réservation atomique,
précondition ou exigence du marqueur final. Vérifier que le scénario concerné
rougit pour la bonne raison ; restaurer exactement et confirmer le vert.
Conserver commandes et résultats, pas les modifications volontairement cassées.

Aucune mutation de production et aucune restauration Git destructive de
changements utilisateur. Un test encore vert après retrait de sa protection
doit être corrigé avant de devenir une preuve.

### 17.6 Couverture réelle de l'adaptateur Dexie

La cible n'est pas de tester l'implémentation interne de Dexie. La cible est de
couvrir 100 % des opérations et branches de l'adaptateur que le produit utilise,
contre IndexedDB réel dans un navigateur :

| Surface | Scénarios obligatoires | Preuve attendue |
| ------- | ---------------------- | --------------- |
| Transaction locale | ajout données + opération, modification, brouillon, dépendance | commit atomique et état affiché |
| Échec local | transaction avortée, quota, base fermée, migration bloquée | aucun faux « enregistré », erreur classée |
| Reprise | reload, fermeture, redémarrage, `a_verifier`, délai écoulé | mêmes octets et même `operationId` |
| Réponse réseau | succès, timeout, coupure avant réponse, corps illisible | attente conservée ou confirmation correcte |
| HTTP | 2xx, 401, 403, 404, 409, 422, 429, 5xx | classification et action attendues |
| Idempotence | doublon concurrent, rejeu après commit, corps différent | un seul effet, reçu rejouable |
| Onglets | deux onglets, verrou libéré après crash, changement de compte | un transmetteur et aucune fuite d'identité |
| Erreurs applicatives | Dexie, Fetch, API, session, React, promesse non traitée, service worker | une erreur bornée, liée à l'identité et visible admin |
| Remontée | erreur hors ligne, reconnexion, réponse perdue du rapport | une ligne admin, aucun payload métier |
| Nettoyage | succès, refus définitif, abandon explicite | aucune opération orpheline ou supprimée en silence |

Ces scénarios utilisent les transactions IndexedDB et la pile Go/PostgreSQL
réelles. Playwright peut provoquer une réponse perdue avec une requête réellement
envoyée puis abandonnée ; il ne doit pas fabriquer une réponse métier avec
`route.fulfill`. Chaque scénario est paramétré sur Chromium, Firefox et WebKit,
avec profil persistant pour prouver la conservation après fermeture. Le test
de quota utilise un profil jetable et une erreur réelle ; s'il est impossible
sur un moteur, il reste explicitement non vérifié et ne devient pas vert par
simulation.

Le rapport de réception publie, par navigateur et scénario, le nombre de
saisies locales, confirmées, en attente, en correction, abandonnées et perdues.
Une couverture de branches TypeScript peut compléter ces preuves, mais ne les
remplace pas ; aucun pourcentage de couverture ne permet de déclarer Dexie ou
le navigateur infaillible.

### 17.7 Commandes

Depuis la racine, commandes de référence pour le développement :

```sh
rtk git status --short
rtk proxy make -C apps/go gen
rtk proxy pnpm --dir apps/go/web typecheck
rtk proxy pnpm --dir apps/go/web lint
rtk proxy make -C apps/go lint
rtk proxy make -C apps/go test
rtk proxy make -C apps/go build
rtk proxy pnpm --dir apps/go/e2e typecheck
rtk proxy pnpm --dir apps/go/e2e lint
rtk proxy pnpm --dir apps/go/e2e test
rtk git diff --check
```

Ces commandes ne sont pas des résultats de cette rédaction. Exécuter d'abord
le test ciblé du lot, puis les suites pertinentes après intégration. Vérifier
que SQLC, OpenAPI, validateurs et build ne sont pas ajoutés à git.

Préserver plafonds et linteurs : Go sous 1 500 lignes, panneau sous 300,
pas de suppression de règle ni nolint pour cacher la complexité. Distinguer
erreurs introduites et baseline.

## 18. Garanties et réception

### 18.1 Garanties conditionnelles

| Propriété                      | Garantie visée                      | Conditions/limites                                       |
| ------------------------------ | ----------------------------------- | -------------------------------------------------------- |
| Sauvegarde locale              | Aucun succès avant commit IndexedDB | N'empêche pas éviction, effacement ou panne du support   |
| Commit SQL avec réponse perdue | Rejeu sans second effet             | Même clé/octets, reçu conservé, transaction commune      |
| Concurrence                    | Pas d'écrasement silencieux         | Tous les chemins maintiennent la révision                |
| Préparation interrompue        | Ancienne génération intacte         | Stockage accessible et autorisations respectées          |
| Reprise                        | Traitement des opérations éligibles | Application exécutée, API disponible, compte autorisé    |
| Fichier confirmé               | Rejeu du même contenu               | Publication immuable, stockage sain, rétention respectée |
| Droits                         | Contrôle serveur à chaque envoi     | Révocation inconnue pendant la coupure                   |

Les requêtes réseau peuvent être envoyées plusieurs fois. L'effet métier est
dédupliqué ; ce n'est pas une livraison réseau exactement une fois.
L'audio, les effets externes et la rétention ont leurs limites propres.

### 18.2 Mesures

La population est constituée des IDs d'intentions validées localement.
À la fin, chaque opération appartient à exactement une catégorie : confirmée
serveur, conservée en attente, conservée en correction, abandonnée explicitement,
ou perdue.

Une perte est une intention annoncée sauvegardée, non abandonnée, dont ni le
serveur ni le poste ne possèdent une version récupérable. Un doublon est
plusieurs effets métier pour un ID, pas plusieurs requêtes HTTP.

Noter N population, C confirmées, A attente, R corrections, X abandons, P pertes,
D effets dupliqués. Vérifier N = C + A + R + X + P, sans chevauchement.
Publier P/N et D/N avec plateforme, dates, volume et limites.
Une opération conflictuelle n'est pas synchronisée pour embellir le chiffre.

Zéro échec sur 10 000 essais prouve seulement zéro échec observé. Sous hypothèses
binomiales indépendantes, la borne unilatérale à 95 % est
`1 - 0,05^(1/N)`, environ 0,03 % pour N = 10 000. Les pannes navigateur
et réseau sont souvent corrélées : ce calcul ne garantit pas la production et
ne justifie pas 0,00001 %.

### 18.3 Acceptation

- Tous les parcours confirmés fonctionnent sur données préparées.
- Les preuves API/navigateur pertinentes passent et détectent les protections retirées.
- Aucune perte ni duplication observée dans les populations testées, aucun refus caché.
- Chaque opération restante est visible, attribuée et récupérable.
- Chaque opération en erreur fournit un diagnostic copiable et corrélable aux logs Go.
- Identités, droits, révisions, transactions et audits sont contrôlés aux frontières réelles.
- Le plus grand périmètre mesuré tient sur les appareils cibles ou la préparation refuse clairement.
- Les parcours en ligne et contrats anciens restent compatibles.
- Types, lint, génération, build et plafonds sont conformes.
- Un poste réel de huit heures a été réalisé et distingué de la simulation.
- Les validations physiques manquantes restent signalées, sans succès fictif.

### 18.4 Rapport

Le rapport liste fichiers, migrations, packages, commandes, résultats,
populations, captures du résolveur et essais physiques. Distinguer implémenté,
testé automatiquement, vérifié manuellement et non vérifié.

Les logs actuels suffisent : operationId, requestId, code, statut et durée,
sans corps métier. Chaque tentative ajoute aussi événement, type d'opération,
route, numéro d'essai, résultat, classe d'erreur et âge de la file. Côté client,
le dernier échec et le prochain essai restent dans `operations` jusqu'à issue
définitive ; côté Go, `slog` garde la trace structurée de la requête reçue.
Ne pas journaliser corps, cookies, jetons, téléphones et autres données CRM.
Une panne avant émission HTTP ne peut pas être écrite dans le journal serveur :
elle doit rester diagnostiquable par les métadonnées locales de l'opération.
Aucune nouvelle plateforme d'observabilité ni tableau de bord de sync anticipé.

## 19. Procédures de reprise

| Symptôme                          | Action                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Réseau absent                     | Continuer sur données préparées, attendre la reconnexion                        |
| Session expirée                   | Reconnexion du même compte puis mêmes clés                                      |
| Fiche modifiée ailleurs           | Comparer, relire la version autorisée, nouvelle résolution                      |
| Téléphone/référence déjà utilisés | Correction métier, aucune fusion ou nouvelle clé silencieuse                    |
| Résultat inconnu                  | Garder, rejouer exactement, vérifier le reçu si besoin                          |
| Accès retiré                      | Garder l'issue et transmettre requestId à une personne autorisée                |
| Espace insuffisant                | Libérer de l'espace ou copies confirmées, préserver les saisies uniques         |
| Mise à jour bloquée               | Traiter les opérations/corrections, conserver l'ancien contrat                  |
| Base illisible                    | Ne pas vider le stockage ; analyser une copie autorisée avec version compatible |

Ne jamais conseiller de vider IndexedDB comme premier dépannage. Le cache du
panneau est retéléchargeable ; la file peut être l'unique copie du travail.
Toute extraction de diagnostic contenant des données CRM requiert le traitement
approprié du propriétaire, sans export automatique vers un service externe.

Après défaut d'idempotence prouvé, arrêter les transmissions de la version
concernée, corriger puis rejouer les clés existantes. Changer toutes les clés
pour débloquer créerait précisément le risque de duplication.
Un défaut de lecture locale peut justifier de reconstruire la seule génération
serveur depuis une préparation validée, sans effacer la file.

## 20. Sources et maintenance

Les décisions métier proviennent du périmètre confirmé. Ces sources décrivent
les outils et ne prouvent aucun taux de fiabilité du CRM.

- [Dexie : transactions](https://dexie.org/docs/Tutorial/Best-Practices) : cycle de vie et propagation d'erreurs.
- [Dexie : `transaction()`](https://dexie.org/docs/Dexie/Dexie.transaction%28%29) : résolution après commit et portée des tables.
- [Dexie : `PrematureCommitError`](https://dexie.org/docs/DexieErrors/Dexie.PrematureCommitError) : ne pas attendre Fetch dans une transaction locale.
- [Dexie 4.4.5](https://www.npmjs.com/package/dexie/v/4.4.5) et [hooks React](https://www.npmjs.com/package/dexie-react-hooks) : versions/compatibilités.
- [Vite PWA : mises à jour](https://vite-pwa-org.netlify.app/guide/prompt-for-update) et [package](https://www.npmjs.com/package/vite-plugin-pwa) : précache et compatibilité Vite.
- [Streamparser JSON](https://github.com/juanjoDiaz/streamparser-json) : parsing progressif WHATWG.
- [Ajv autonome](https://ajv.js.org/standalone.html) : génération des validateurs.
- [PostgreSQL : isolation](https://www.postgresql.org/docs/current/transaction-iso.html) : visibilité des transactions.
- [Huma : streaming](https://huma.rocks/features/response-streaming/) : intégration du flux.
- [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) : coordination entre onglets.
- [`navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) : indicateur réseau non fiable, jamais preuve de joignabilité.
- [Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) : amélioration facultative à disponibilité limitée.
- [Quotas et éviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) : limites navigateur.

Maintenir matrice d'opérations, règles de compatibilité et scénarios en même
temps que le code. Ne pas étendre le protocole pour un consommateur hypothétique.
Tout champ, package ou endpoint supplémentaire doit répondre à une obligation
actuelle identifiée.

Idées différées : réplication différentielle, transmission application fermée,
nouveaux types de pièces jointes et chiffrement applicatif avec gestion de clés.
