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
  /// Ne se supprime pas : le script s'appuie dessus.
  isSystem  Boolean @default(false)
  isActive  Boolean @default(true)
  sortOrder Int     @default(100)

  /// Version de charge utile minimale sachant émettre ce code. Comparé à la
  /// version déclarée par l'appelant SUR LA ROUTE DÉDIÉE : un téléphone ne
  /// reçoit jamais un code qu'il ne sait pas renvoyer, qui finirait en erreur
  /// définitive hors ligne. Ce filtrage n'existe QUE sur cette route ; le
  /// paquet de référentiels du mobile ne connaît aucune notion de version.
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

Un contrôleur DÉDIÉ, `StatutsQualificationController`, dans
`modules/referentiels/`, sur le patron de `CallOutcomeReasonsController`. Pas
une extension de `ReferentielsController`, et pas une entrée du
`ReferentielsBundleDto`.

La raison est mécanique, et elle a été vérifiée dans le code : le filtrage par
`minPayloadVersion` n'existe QUE sur la route dédiée des motifs d'appel
(`call-outcome-reasons.service.ts:51`). `ReferentielQueryDto` ne porte
qu'`activeOnly` (`referentiels/dto.ts:333`) et `ReferentielsService.bundle` ne
filtre sur aucune version. Servir ce référentiel par le paquet reviendrait à
descendre sur tous les téléphones des codes que les anciens ne savent pas
renvoyer, et le commentaire du schéma qui promet le contraire serait un
mensonge.

| Route                                            | Rôle             |
| ------------------------------------------------ | ---------------- |
| `GET /v1/statuts-qualification?payloadVersion=N` | tout authentifié |
| `GET /v1/statuts-qualification/administration`   | ADMIN            |
| `POST /v1/statuts-qualification`                 | ADMIN            |
| `PATCH /v1/statuts-qualification/:id`            | ADMIN            |
| `POST /v1/statuts-qualification/:id/active`      | ADMIN            |

La route de saisie ne rend que les statuts actifs dont `minPayloadVersion` ne
dépasse pas la version déclarée. L'écran d'administration les rend tous.

Ajouté par ailleurs :

- `CreateRepCallAttemptDto`, et le `push` de synchronisation ;
- `RepresentantExportQueryDto`, qui sert À LA FOIS au filtre de l'annuaire
  (`RepresentantQueryDto` l'étend, `representants/dto.ts:350`) et au périmètre
  d'un lot d'appels (`lots-export/dto.ts:79`). Le statut y devient un axe de
  tirage au même titre que l'IEF.

### Dérivation de l'issue, et laquelle gagne

`CreateRepCallAttemptDto.outcome` reste OBLIGATOIRE et accepte les sept valeurs.
Le contrat porte donc deux sources possibles, et il faut dire laquelle tranche.

**Le statut gagne quand il est présent.** Le serveur lit `effect` sur la ligne
référencée, en déduit l'issue, et REFUSE une issue envoyée qui la contredit
(`REP_OUTCOME_STATUT_MISMATCH`). Un client correct calcule la même chose que le
serveur, donc ce refus ne peut viser qu'un client fautif. Sans statut, l'issue
envoyée fait foi, comme aujourd'hui.

Écrire la correspondance une seule fois, côté serveur, est ce qui empêche les
deux clients de diverger.

### Le taux de joignabilité ne change pas

`REP_ANSWERED_OUTCOMES` vaut `('REACHED', 'REFUSED')` (`pilotage.sql.ts:24`) :
une issue `CALLBACK` ne compte pas comme un appel abouti. C'est déjà le cas
aujourd'hui, et cette version ne le change pas.

C'est pourquoi le modèle ne porte PAS de colonne `countsAsReached`, que la
première rédaction lui donnait : aucune requête ne la lirait, et une colonne
morte qui a l'air d'une règle est pire qu'une règle absente. Le jour où le
métier veut compter « à rappeler » comme joint, il faudra réécrire
`pilotage.sql.ts` en jointure sur le référentiel, et c'est un autre travail.

### Ce qui est refusé, et ce qui ne l'est pas

Refusé : un statut inconnu, un statut inactif à la création, une `callbackAt`
sur un statut dont l'effet ne planifie pas de rappel, une `callbackAt` absente
sur un statut portant `requiresCallback`, une issue qui contredit le statut.

**Non refusé** : l'absence de statut. Un APK déjà installé ne connaît pas ce
champ ; un refus mettrait toutes ses qualifications en échec définitif à la
remontée, et le lot entier avec. L'obligation vit dans le formulaire des deux
clients, pas dans le contrat.

La règle existante de `rep-campaigns.service.ts:202` (issue `CALLBACK` sans date
refusée) reste en place comme filet pour les clients actuels.

## Web

Un ÉCRAN DÉDIÉ, `/admin/referentiels/statuts-qualification`, calqué sur
`CallOutcomeReasonsView`, avec son entrée de navigation.

`OpenReferentialTab` ne peut pas le porter, et c'est vérifié : son `Kind` est
une union fermée de quatre valeurs dont chaque comportement est un `if` en dur
en six endroits ; il écrit `isActive` DANS la même mutation que le reste
(`open-referential-tab.tsx:121`), alors que l'activation passe ici par une route
séparée ; il laisse le `code` éditable en modification (`:246`), alors que le
code est immuable puisque l'historique le référence ; et il ne sait rendre ni un
effet, ni une ligne système, ni une version minimale. `CallOutcomeReason` a son
propre écran pour ces raisons exactement, et il n'est même pas monté en onglet
mais sur sa propre route (`admin/referentiels/issues-appel/page.tsx`).

L'écran reprend de `CallOutcomeReasonsView` : le badge `isSystem`, le bouton
d'activation masqué sur les lignes système, le `fieldset` verrouillé sur les
règles d'une ligne système, le couplage effet vers `requiresCallback`, et la
colonne qui dit ce que le parc installé sait recevoir.

Le reste :

- `console/rep-script.tsx` : le sélecteur d'issue perd « À rappeler » et ne
  garde que joignable et injoignable. Une liste déroulante de statuts apparaît
  quand l'appel a abouti. Le sélecteur de date s'affiche quand le statut choisi
  porte `requiresCallback`.
- `representants-filters-bar.tsx` : un critère de plus, sélection simple.
- `representant-detail-view.tsx` et l'aperçu de périmètre d'un lot : la valeur
  affichée.

Les primitives restent celles du dépôt : `Select`, `Dialog`, `Table`, `Button`.
Le seul composant nouveau est l'écran d'administration lui-même.

## Mobile

Le référentiel suit le chemin DÉDIÉ du motif d'appel, pas celui du paquet :

- table drift à clé `code`, sans `deleted_at`, sur le patron
  `call_outcome_reasons` (`schema.drift:218`) ;
- `schemaVersion` 23 vers 24, son palier dans `MigrationStrategy.onUpgrade`, et
  son instantané `test/data/generated_migrations/schema_v24.dart` ;
- `pullStatutsQualification()`, calqué sur `pullCallOutcomeReasons()`
  (`sync_engine.dart:1339`), hors curseur keyset, hors `_mirrorKind`, hors
  `_applyPage` ;
- un provider, et la liste dans `representant_qualification_screen.dart` en
  `CpiChoiceGroup` et widgets ForUI du kit ;
- le champ porté dans l'outbox par `write_repository`.

`SyncEngine.payloadVersion` passe de 5 à **6**, et c'est le seul levier utile.
Trois nombres portent ce nom et ne font pas la même chose :

| Où                                              | Rôle                                           |
| ----------------------------------------------- | ---------------------------------------------- |
| `SyncPushDto.payloadVersion`                    | empreinte d'idempotence, rien d'autre          |
| en-tête du pull, `MIN_PULL_PAYLOAD_VERSION = 5` | plancher : en dessous, 426 APP_UPDATE_REQUIRED |
| query de la route dédiée                        | comparé à `minPayloadVersion` de chaque ligne  |

`MIN_PULL_PAYLOAD_VERSION` NE BOUGE PAS : le passer à 6 renverrait 426 à tout
le parc installé. C'est le troisième nombre qui fait le travail, et il n'opère
que parce que le référentiel est servi par une route dédiée. Un statut créé
demain porte `minPayloadVersion = 6` et reste invisible aux téléphones en 5,
qui continuent de qualifier sans lui.

### Le point aveugle des tests

`migration_test.dart` casse si `schemaVersion` bouge sans instantané, et si
`schema.drift` change sans nouveau dump. **Aucun test ne casse** si on oublie de
brancher le pull ou le provider. C'est le seul endroit de ce travail où
l'oubli est silencieux, et c'est là qu'il faut un test écrit exprès.

## Données de départ

| code             | label          | effect              | requiresCallback | isSystem |
| ---------------- | -------------- | ------------------- | ---------------- | -------- |
| `TRES_INTERESSE` | Très intéressé | `REACHED`           | non              | oui      |
| `INTERESSE`      | Intéressé      | `REACHED`           | non              | oui      |
| `A_RAPPELER`     | À rappeler     | `SCHEDULE_CALLBACK` | oui              | oui      |
| `PAS_INTERESSE`  | Pas intéressé  | `REFUSED`           | non              | oui      |

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
- Issue contredisant le statut : refus `REP_OUTCOME_STATUT_MISMATCH`.
- Un statut `minPayloadVersion = 6` n'est pas servi à un appelant en 5.
- Le pull mobile du référentiel : test écrit exprès, puisque rien ne casse
  automatiquement si on oublie de le brancher.
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
