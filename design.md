# MacBox

Architecture et plan UX pour un gestionnaire natif de processus macOS isoles.

## Decision

MacBox est une application macOS native en SwiftUI. Elle lance des programmes
macOS prepares pour la sandbox Apple, affiche leur etat et controle leurs
permissions depuis une fenetre unique.

MacBox n'est pas Docker Engine et ne lance pas de conteneurs Linux. Il ne
fournit pas de kernel, de namespaces, de cgroups ni de filesystem macOS
virtuel. L'isolation repose sur App Sandbox, les entitlements, XPC et un
helper signe par la meme equipe de developpement.

La premiere version vise les outils et applications macOS dont le proprietaire
controle le code ou peut accepter une signature MacBox. Un binaire arbitraire
non signe peut etre lance hors isolation garantie, mais MacBox doit le signaler
et ne doit pas le presenter comme un conteneur.

## Objectif produit

L'utilisateur veut lancer un programme macOS dans un espace limite, sans
installer Docker Desktop et sans demarrer de VM, puis comprendre rapidement :

- ce qui tourne ;
- ce qui est autorise ;
- quels fichiers sont partages ;
- si le reseau est ouvert ;
- comment arreter et nettoyer le processus.

## Hors perimetre v1

- Conteneurs Linux ou images OCI.
- VM ou hyperviseur.
- Isolation d'un kernel macOS complet.
- Orchestration, registry, cluster ou execution distante.
- Snapshot et migration d'un processus.
- Dashboard permanent avec statistiques systeme detaillees.
- Support iOS, Windows ou Linux.
- Gestion de binaires non signes comme s'ils etaient fiables.

## Principes UX

1. Une seule fenetre document-style, sans sidebar.
2. Le contenu principal repond a une tache immediate, pas a une hierarchie de
   configuration.
3. Les controles suivent les conventions macOS : toolbar, segmented control,
   table, inspector, sheets, menus, raccourcis clavier et confirmations natives.
4. Les permissions sont visibles avant le lancement et modifiables seulement
   dans une sheet dediee.
5. Un etat vide propose l'action suivante : `Ajouter un programme`.
6. Aucun jargon Linux dans l'interface. Dire `programme`, `fichiers partages`,
   `reseau` et `sandbox`.
7. Une permission dangereuse est expliquee au moment ou elle est demandee,
   pas dans une page d'aide generale.
8. Le rouge est reserve aux erreurs et aux actions destructrices.

## Direction visuelle macOS

MacBox doit ressembler a un outil systeme calme, pas a un tableau de bord SaaS.

- SwiftUI system materials et couleurs semantiques macOS.
- Police systeme `SF Pro` via les styles SwiftUI, sans police embarquee.
- Icones SF Symbols, une famille unique.
- Contraste, focus clavier et Dynamic Type geres par les controles natifs.
- Marges de fenetre macOS standard, contenu lisible a 900 x 600 minimum.
- Pas de gradients, cartes flottantes, badges decoratifs ou illustrations de
  marketing.
- Les actions primaires utilisent les controles de toolbar et les boutons
  macOS, pas des boutons geants.

## Fenetre principale

La fenetre principale est une fenetre unique avec :

```text
┌─────────────────────────────────────────────────────────────┐
│  [Ajouter] [Demarrer] [Arreter]     MacBox   [Vue] [Recherche]│
├─────────────────────────────────────────────────────────────┤
│  [Tous] [En cours] [Arretes]                              │
├─────────────────────────────────────────────────────────────┤
│  Nom                    Etat       Reseau     Derniere activite│
│  Image Processor         En cours   Bloque     il y a 2 min   │
│  Backup Tool             Arrete     Autorise   hier           │
│                                                             │
│                         [Ajouter un programme]              │
└─────────────────────────────────────────────────────────────┘
```

Ce n'est pas une sidebar :

- la navigation courte est un `Picker` en style `segmented` dans la toolbar ;
- la liste est la vue principale ;
- les details apparaissent dans un inspector a droite ou une sheet, selon la
  largeur disponible ;
- l'utilisateur peut tout faire au clavier sans ouvrir un panneau lateral.

## Vues et parcours

### 1. Vue d'accueil

Vue par defaut, une table de programmes geres.

Colonnes :

- nom ;
- etat : `En cours`, `Arrete`, `Erreur`, `Demarrage` ;
- reseau : `Autorise`, `Bloque`, `Partiel` ;
- dernier lancement ;
- activite recente.

Actions :

- `Ajouter` ouvre le selecteur de programme ;
- `Demarrer` lance la selection ;
- `Arreter` termine proprement le processus ;
- clic secondaire : `Afficher les details`, `Ouvrir le dossier`, `Supprimer`.

Etat vide : titre `Aucun programme gere`, bouton `Ajouter un programme` et une
phrase courte `Lancez un programme macOS avec des permissions controlees.`

### 2. Ajouter un programme

Sheet native en trois etapes courtes, avec retour possible.

#### Programme

- selecteur `NSOpenPanel` filtre sur `.app`, `.command` et executables ;
- affichage du nom, chemin et signature ;
- refus explicite si le format est inconnu ou si le chemin est inaccessible.

#### Permissions

Chaque permission de fichier a trois valeurs : `Refuse`, `Lecture`, `Lecture et
ecriture`.

- dossier de donnees prive : toujours actif ;
- dossiers partages : aucun par defaut ;
- reseau : `Non disponible` ou `Autorise par l'application signee` ;
- camera, microphone, USB : non disponibles en v1 sauf entitlement et besoin
  reel du programme.

Le bouton `Continuer` reste actif avec les choix par defaut. Une permission
elevee affiche une phrase d'impact juste sous le controle.

#### Confirmation

Resume compact : programme, signature, dossier prive et permissions. Bouton
principal `Ajouter`.

### 3. Detail d'un programme

Le detail s'ouvre dans un inspector droit de largeur fixe ou une sheet sur une
petite fenetre. Il contient quatre groupes natifs :

- `Etat` : pid, demarrage, duree, dernier code de sortie ;
- `Permissions` : lecture seule quand le processus tourne, bouton `Modifier` ;
- `Fichiers` : dossier prive et partages ;
- `Journal` : dernieres lignes stdout/stderr, bouton `Ouvrir les logs`.

L'inspector ne contient pas de graphique. La v1 montre uniquement les faits
necessaires a la decision.

### 4. Demarrage

Au demarrage, la ligne passe par `Demarrage` puis `En cours` ou `Erreur`.
Les erreurs sont actionnables :

- signature absente : `Ouvrir les reglages de signature` ;
- permission refusee : `Modifier les permissions` ;
- processus termine : `Afficher le journal` ;
- port deja utilise : `Voir le processus concerne`.

### 5. Arret et suppression

`Arreter` envoie d'abord une terminaison propre. Apres un court delai, la
sheet propose `Forcer l'arret` si le processus ne repond pas.

`Supprimer` retire le programme de MacBox mais ne supprime jamais son binaire.
Le dossier de donnees prive est supprime seulement apres confirmation explicite.

## Raccourcis et menus

- `⌘N` : ajouter un programme ;
- `⌘R` : actualiser ;
- `⌘F` : rechercher ;
- `⌘Enter` : demarrer la selection ;
- `⌘.` : arreter ;
- `⌘,` : preferences ;
- `⌘⌫` : supprimer le programme gere apres confirmation.

Menu `Fichier` : `Ajouter`, `Fermer la fenetre`.

Menu `Programme` : `Demarrer`, `Arreter`, `Afficher les details`, `Ouvrir le
dossier de donnees`, `Supprimer`.

Menu `Presentation` : `Tous`, `En cours`, `Arretes`, `Afficher les logs`.

## Architecture technique

```text
MacBox.app
├── SwiftUI presentation
│   ├── MainWindow
│   ├── ProgramTable
│   ├── AddProgramSheet
│   └── ProgramInspector
├── Application state
│   ├── ProgramStore
│   ├── ProcessCoordinator
│   └── LogStore
├── XPC client
└── signed MacBoxRunner helper
    ├── process launch
    ├── sandbox inheritance
    ├── stdout/stderr capture
    ├── termination
    └── status events
```

### MacBox.app

Responsabilites :

- afficher l'interface ;
- valider la configuration ;
- demander les acces utilisateur ;
- persister la liste des programmes geres ;
- ne jamais lancer directement un programme avec plus de privileges que
  l'interface ne l'affiche.

Technologies : Swift 6, SwiftUI, AppKit seulement pour les integrations que
SwiftUI ne couvre pas correctement, `OSLog` pour les logs internes.

### MacBoxRunner

Le runner est un helper signe et installe avec l'application. Il est le seul
composant autorise a lancer ou arreter le programme gere.

Responsabilites :

- recevoir une configuration valide par XPC ;
- verifier le chemin et la signature du programme ;
- creer le dossier prive du programme ;
- lancer le programme avec la sandbox attendue ;
- capturer stdout et stderr ;
- remonter l'etat et le code de sortie ;
- terminer le processus enfant et ses descendants connus.

Le runner ne recoit jamais de shell arbitraire. Il ne construit pas une commande
avec interpolation de chaine et n'utilise pas `sh -c`.

### Communication XPC

Le contrat XPC reste volontairement petit :

```text
registerProgram(configuration)
start(programID)
stop(programID, force)
status(programID)
subscribe(programID)
remove(programID, deleteData)
```

Les messages portent des valeurs codees et typees : identifiant, chemin
resolu, permissions, pid, etat et erreur. Aucun dictionnaire libre ne traverse
la frontiere.

### Persistance

La v1 utilise des fichiers JSON dans le conteneur prive de l'application :

```text
Application Support/MacBox/
├── programs.json
└── logs/<program-id>.log
```

Une base de donnees n'est pas necessaire pour une application locale avec un
petit nombre de programmes. Les ecritures sont atomiques : fichier temporaire,
sync, puis remplacement.

### Modele de donnees minimal

```swift
struct ManagedProgram: Codable, Identifiable {
    let id: UUID
    var name: String
    var executableURL: URL
    var dataDirectoryURL: URL
    var fileGrants: [FileGrant]
    var network: NetworkPolicy
    var createdAt: Date
}

enum NetworkPolicy: String, Codable {
    case blocked
    case outbound
    case inboundAndOutbound
}
```

Le modele ne contient pas de metriques historiques, de tags, de profils
generiques ou de champs d'orchestration sans consommateur v1.

## Isolation et securite

### Ce que MacBox garantit

- le programme gere utilise un dossier prive dedie ;
- les acces declares sont visibles dans l'interface ;
- le runner verifie l'identite du programme avant le lancement ;
- les erreurs de lancement ne sont pas masquees ;
- l'arret et la suppression sont journalises localement ;
- aucune commande shell fournie par l'utilisateur n'est executee par defaut.

### Ce que MacBox ne garantit pas

- un kernel distinct ;
- une protection contre une vulnerabilite macOS ;
- l'invisibilite du processus dans Activity Monitor ;
- l'isolation d'un programme non signe ou explicitement autorise avec des
  permissions trop larges ;
- la limitation exacte de toute ressource CPU ou memoire comme avec cgroups.

### Signature et sandbox

Les programmes pris en charge doivent etre signes selon la strategie retenue
par le produit. Le runner et ses helpers utilisent App Sandbox et les
entitlements strictement necessaires. Toute extension de permission est une
decision de build et de signature, pas une chaine envoyee a l'execution.

App Sandbox limite les fichiers, le reseau et certaines ressources systeme au
niveau du systeme. Les acces fichiers choisis par l'utilisateur passent par des
security-scoped bookmarks. Les entitlements de signature determinent les
capacites globales de l'application ; ils ne constituent pas un firewall
dynamique configurable par programme dans l'interface.

En consequence, la v1 ne promet pas de bloquer selectivement chaque connexion
sortante. Elle propose seulement les deux etats que la signature peut garantir :
aucun acces reseau ou acces reseau declare par le programme. Un filtrage par
processus demanderait une preuve separee avec Network Extension et ne fait pas
partie du MVP.

XPC sert a separer l'interface du composant qui lance les processus. Endpoint
Security n'est pas requis pour le MVP ; il pourra servir a la supervision si un
besoin concret apparait.

## Etats du processus

```text
Arrete → Demarrage → En cours → Arret demande → Arrete
              └────→ Erreur
En cours ────────→ Termine
```

Chaque transition est emise par le runner, puis refletee par le store SwiftUI.
L'interface ne deduit pas un processus vivant d'un simple enregistrement dans
`programs.json`.

## Gestion des erreurs

Chaque erreur comprend :

- un titre court ;
- la cause connue ;
- une action possible ;
- un identifiant dans le journal technique.

Exemple : `Le programme n'a pas demarre. La signature du helper est absente.`
Action : `Afficher les details`.

Les logs utilisateur ne contiennent pas de secret, de token ou de contenu de
fichier. Les chemins sont affiches selon les permissions disponibles.

## Accessibilite

- tous les controles ont un label VoiceOver ;
- chaque action clavier a un equivalent visible ;
- le focus initial arrive sur la table ou le bouton d'ajout si elle est vide ;
- aucune information ne depend uniquement de la couleur ;
- les etats utilisent texte et icone ;
- Dynamic Type et contraste eleve restent fonctionnels ;
- les animations sont decoratives et respectent Reduce Motion.

## Plan de livraison

### Phase 1 : preuve native

- application SwiftUI vide ;
- fenetre principale sans sidebar ;
- ajout d'un programme signe ;
- lancement et arret du runner ;
- affichage de l'etat et des logs.

### Phase 2 : sandbox minimale

- dossier prive ;
- permissions de fichiers en lecture ou lecture-ecriture ;
- capacite reseau conforme aux entitlements signes ;
- erreurs de signature et d'acces ;
- persistance JSON atomique.

### Phase 3 : finition macOS

- menus et raccourcis ;
- inspector adaptatif ;
- restauration de la fenetre ;
- VoiceOver, clavier et Reduce Motion ;
- packaging, signature et notarisation.

## Verification

La verification doit se faire avec de vrais programmes macOS, sans tests
unitaires isoles :

1. programme qui lit son dossier prive ;
2. programme qui tente de lire un dossier interdit ;
3. programme reseau avec capacite conforme aux entitlements signes ;
4. arret propre puis arret force ;
5. programme qui termine avec une erreur ;
6. relance de MacBox avec une configuration persistante.

Chaque parcours doit etre verifie sur un Mac reel avec la signature et les
entitlements de distribution. Un mock de sandbox ne prouve pas l'isolation.

## Decisions differees

- Limitation CPU/memoire : seulement apres un besoin mesure.
- Endpoint Security : seulement si App Sandbox ne couvre pas un parcours reel.
- Import d'images ou de bundles : seulement apres definition d'un format
  d'application MacBox stable.
