# Statut de qualification du représentant

**Statut** : proposé · **Date** : 2026-09-02 · **Branche** : `feat/statut-qualification-representant`

## Contexte

L'étape 1 du parcours CHUES qualifie un représentant au téléphone. Le script
capte aujourd'hui la joignabilité et cinq réponses factuelles (établissement,
numéro, déjà contacté, connaît l'UES, syndicat), puis une issue d'appel choisie
dans une énumération figée : joignable, à rappeler, injoignable.

Il ne capte **nulle part l'intérêt** du représentant. Or les deux dimensions
sont indépendantes : on joint quelqu'un qui refuse, comme on joint quelqu'un de
très demandeur. Le plateau distingue ces cas à l'oral et les perd à la saisie.

Deuxième manque : la liste des issues est figée dans le schéma. Ajouter « très
intéressé » coûte aujourd'hui une migration, un déploiement des trois
applications et une version d'APK sur le terrain.

## Décision

Un référentiel `StatutQualification`, administrable, qui porte le VOCABULAIRE
visible et l'EFFET machine. L'énumération `RepCallOutcome` reste la mécanique
que la base, les statistiques et les alarmes lisent ; elle devient une valeur
**dérivée** du statut choisi.

L'écran ne propose plus que deux issues, joignable et injoignable. « À
rappeler » quitte les issues et devient une ligne du référentiel.

| Ce que voit le téléconseiller | `RepCallOutcome` enregistré |
| ----------------------------- | --------------------------- |
| injoignable                   | `UNREACHABLE`               |
| joignable + À rappeler        | `CALLBACK` + `callbackAt`   |
| joignable + Pas intéressé     | `REFUSED`                   |
| joignable + Intéressé         | `REACHED`                   |
| joignable + Très intéressé    | `REACHED`                   |

### Pourquoi pas remplacer `RepCallOutcome`

Retirer l'énumération obligerait à migrer toutes les tentatives consignées,
`Representant.lastCallOutcome` et son index, les statistiques de joignabilité,
les écrans de rappel et le stockage local du mobile. Une suppression de valeur
d'énumération retire par ailleurs le droit de revenir en arrière sur la version
entière, ce que `docs/migrations-en-attente.md` refuse tant qu'aucune
restauration de sauvegarde n'a été éprouvée. Elle ne l'a toujours pas été.

### Pourquoi pas deux champs indépendants

Un statut purement descriptif, avec un booléen qui arme le rappel de son côté,
produirait une tentative `REACHED` portant une `callbackAt`. C'est l'inverse de
l'invariant posé : `callbackAt` n'est admise que pour une issue qui planifie un
rappel.

### Le précédent suivi

`CallOutcomeReason` fait déjà exactement cela pour les appels aux PROSPECTS :
une ligne administrable qui porte `effect`, `requiresComment`,
`requiresCallback`, `countsAsReached` et `minPayloadVersion`. Le présent travail
en est le pendant pour les REPRÉSENTANTS, et en reprend la forme sans
l'inventer.

## Modèle de données

Migration purement additive, donc rembobinable : la version d'application
précédente ignore ce qu'elle ne connaît pas.

```prisma
model StatutQualification {
  id     String @id @default(uuid(7))
  /// Immuable : l'historique le référence. Voir `CallOutcomeReason.code`.
  code   String @unique
  label  String @unique
  effect StatutQualificationEffect

  /// La date du rappel est exigée par CETTE ligne, jamais par le code.
  requiresCallback Boolean @default(false)
  /// Compte comme un appel abouti dans le taux de joignabilité.
  countsAsReached  Boolean @default(true)
  /// Ne se supprime pas : le script s'appuie dessus.
  isSystem  Boolean @default(false)
  isActive  Boolean @default(true)
  sortOrder Int     @default(100)

  /// Version de charge utile minimale sachant émettre ce code. Un téléphone ne
  /// reçoit jamais un code qu'il ne sait pas renvoyer : il le rejetterait en
  /// erreur définitive, hors ligne, sans possibilité de correction.
  minPayloadVersion Int @default(6)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  representants Representant[]
  attempts      RepCallAttempt[]
}

// Trois effets suffisent : le script n'émet pas `PROSPECTS_PROMISED`, qui vient
// d'un autre geste, ni `WRONG_NUMBER` ni `OTHER`, qui ne sont pas des degrés
// d'intérêt.
enum StatutQualificationEffect {
  REACHED
  REFUSED
  SCHEDULE_CALLBACK
}
```

Deux références, **nullables, sans défaut, sans CHECK** :

| Colonne                                | Rôle                               |
| -------------------------------------- | ---------------------------------- |
| `Representant.statutQualificationId`   | l'état courant de la fiche         |
| `RepCallAttempt.statutQualificationId` | ce qui a été dit pendant CET appel |

Les deux en `onDelete: Restrict`. La nullité n'est pas un détail : les fiches
déjà en production n'ont pas ce champ et doivent rester valides et modifiables.

Index : `Representant.statutQualificationId` pour le filtre de l'annuaire, et
`(statutQualificationId, iefId)` parce que le tirage d'un lot croise les deux et
balaierait la table sans lui.

`callbackAt` reste `DateTime?` et sans contrainte. Une tentative « à rappeler »
sans date s'enregistre : elle vaut trace d'appel, sans rappel planifié.

## API

Extension de `ReferentielsController`, pas de nouveau module.

| Route                                                     | Rôle             |
| --------------------------------------------------------- | ---------------- |
| `GET /referentiels/statuts-qualification?activeOnly=true` | tout authentifié |
| `GET /referentiels/statuts-qualification/administration`  | ADMIN            |
| `POST /referentiels/statuts-qualification`                | ADMIN            |
| `PATCH /referentiels/statuts-qualification/:id`           | ADMIN            |
| `POST /referentiels/statuts-qualification/:id/active`     | ADMIN            |

`activeOnly` vaut `true` par défaut : la saisie ne propose que les statuts
actifs. L'écran d'administration les demande tous.

Ajouté par ailleurs :

- `ReferentielsBundleDto`, que le mobile miroite ;
- `CreateRepCallAttemptDto` et le `push` de synchronisation ;
- `RepresentantExportQueryDto`, qui sert À LA FOIS au filtre de l'annuaire et au
  périmètre d'un lot d'appels : le statut y devient un axe de tirage, au même
  titre que l'IEF.

### Dérivation de l'issue

Le service qui enregistre une tentative lit `effect` sur la ligne référencée et
en déduit `RepCallOutcome`. La correspondance est écrite UNE fois, côté serveur.

### Ce qui est refusé, et ce qui ne l'est pas

Refusé : un statut inconnu, un statut inactif à la création, une `callbackAt`
sur un statut dont l'effet ne planifie pas de rappel, une `callbackAt` absente
sur un statut portant `requiresCallback`.

**Non refusé** : l'absence de statut. Un APK déjà installé ne connaît pas ce
champ ; un refus mettrait toutes ses qualifications en échec définitif à la
remontée, et le lot entier avec. L'obligation vit dans le formulaire des deux
clients, pas dans le contrat.

La règle existante de `rep-campaigns.service.ts` (issue `CALLBACK` sans date
refusée) reste en place comme filet pour les clients actuels.

## Web

- `/admin/referentiels` : un onglet, monté sur `OpenReferentialTab`, le
  composant générique qui sert déjà quatre référentiels. Un statut `isSystem`
  se désactive mais ne se supprime pas.
- `console/rep-script.tsx` : le sélecteur d'issue perd « À rappeler » et ne
  garde que joignable et injoignable. Une liste déroulante de statuts apparaît
  quand l'appel a abouti, alimentée par les statuts actifs. Le sélecteur de date
  s'affiche quand le statut choisi porte `requiresCallback`.
- `representants-filters-bar.tsx` : un critère de plus, sélection simple, comme
  le filtre de relation.
- `representant-detail-view.tsx` et l'aperçu de périmètre d'un lot : la valeur
  affichée.

Aucun composant nouveau : `Select`, `Dialog`, `Table` et `Button` existants.

## Mobile

- Table drift, `schemaVersion` 23 vers 24, avec son instantané de migration.
- `_upsertStatutQualification` branché dans `mirrorReferentiels` et `_applyPage`.
- Un provider, et la liste dans `representant_qualification_screen.dart`, en
  `CpiChoiceGroup` et widgets ForUI du kit.
- Le champ porté dans l'outbox par `write_repository`.
- `payloadVersion` passe de 5 à **6** : c'est lui que `minPayloadVersion`
  compare pour décider qu'un téléphone sait renvoyer un statut. Sans ce
  passage, aucun appareil ne recevrait jamais les nouveaux codes.

## Données de départ

| code             | label          | effect              | requiresCallback | countsAsReached | isSystem |
| ---------------- | -------------- | ------------------- | ---------------- | --------------- | -------- |
| `TRES_INTERESSE` | Très intéressé | `REACHED`           | non              | oui             | oui      |
| `INTERESSE`      | Intéressé      | `REACHED`           | non              | oui             | oui      |
| `A_RAPPELER`     | À rappeler     | `SCHEDULE_CALLBACK` | oui              | oui             | oui      |
| `PAS_INTERESSE`  | Pas intéressé  | `REFUSED`           | non              | oui             | oui      |

Les quatre sont `isSystem` : le script s'appuie dessus, les désactiver toutes
laisserait un écran sans issue possible. L'admin peut en ajouter d'autres, qui
se désactivent comme les quatre.

Aucun référentiel du dépôt n'expose de suppression : une ligne se désactive, et
les fiches des années passées continuent de la désigner. Celui-ci ne fait pas
exception.

Aucune reprise des fiches existantes : leur statut reste nul, et c'est exact.
Personne ne leur a posé la question.

## Compatibilité

| Cas                                                 | Comportement                                  |
| --------------------------------------------------- | --------------------------------------------- |
| APK ancien qui pousse une qualification             | accepté, statut nul, aucune régression        |
| APK ancien qui choisit « à rappeler »               | issue `CALLBACK` avec date, comme aujourd'hui |
| APK récent hors ligne, statuts non miroités         | la liste est vide, la saisie reste possible   |
| Statut désactivé après avoir été posé sur une fiche | reste lisible, disparaît des listes de saisie |

## Tests

Chaque test sera vu ROUGE avant d'être gardé, conformément à `AGENTS.md`.

- Service API : `activeOnly` par défaut, unicité du code, dérivation de l'issue
  pour les trois effets, refus d'une `callbackAt` sur un effet qui n'en admet
  pas, refus d'une absence de date sur `requiresCallback`, acceptation d'une
  tentative sans statut.
- Balayage d'autorisation : les cinq routes portent leur `@Roles`.
- Inventaire de rôles : les nouvelles routes d'administration n'ouvrent à
  personne d'autre que l'ADMIN.
- Migration drift v23 vers v24.
- Écran de qualification mobile : le sélecteur de date n'apparaît que sur un
  statut qui l'exige.
- Barre de filtres web et périmètre de lot.
- Vocabulaire : les libellés ne contiennent pas le mot proscrit.

## Hors périmètre

- La qualification des PROSPECTS (phase 2), qui a déjà son `CallOutcomeReason`.
- Le remplacement de `RepresentantRelation`, qui reste pilotée par l'issue.
- Une sélection multiple dans les filtres, à ouvrir si le besoin se confirme.
