# CPI GO, campagne QA : synchronisation, hors ligne, file d'envoi

Date : 2026-08-30
Commit : `e8baacd` (arbre de travail MODIFIÉ, retrait des campagnes en cours par
une autre session ; `apps/mobile/lib/data/local/schema.drift`,
`sync_engine.dart`, `database.dart` et `write_repository.dart` diffèrent du
commit).

Périmètre : moteur de synchronisation, base locale drift, file d'envoi,
idempotence, conflits, pierres tombales, générations, changement de compte.

Environnement de preuve : `fvm flutter test` (Flutter 3.41.7, drift 2.33) et
appels HTTP réels sur `http://localhost:3001` avec les comptes `fixture.awa` et
`fixture.fatou`. Aucun émulateur.

Tests écrits : `apps/mobile/test/qa/qa_sync_preuves.dart`. **Ils affirment le
comportement ATTENDU, donc huit d'entre eux échouent aujourd'hui : c'est la
preuve.** Trois passent et servent à établir un fait ou un contraste. Le fichier
ne se termine pas en `_test.dart` à dessein, pour que `flutter test` reste vert
tant que les défauts sont ouverts ; il se lance explicitement :
`fvm flutter test test/qa/qa_sync_preuves.dart`. Renommer en `_test.dart` une
fois SYN-01 à SYN-07 corrigés.

## Synthèse

| Réf | Sévérité | Composant | Titre |
| --- | --- | --- | --- |
| SYN-01 | bloquant | `sync_engine.dart`, `write_repository.dart` | La clé d'idempotence d'un lot est rejouée sur un contenu différent : refus 422 définitif de toutes les saisies concernées |
| SYN-02 | majeur | `auth_controller.dart`, `sync_engine.dart` | Le curseur keyset survit à la déconnexion : le commercial suivant ne reçoit JAMAIS son portefeuille (complément de SEC-01, même racine) |
| SYN-03 | majeur | `sync_engine.dart` (`_applyPage`) | Un représentant rendu vivant par le serveur reste marqué supprimé sur le téléphone, pour toujours |
| SYN-04 | majeur | `sync_engine.dart` (`_applyPage`) | Une suppression serveur arrivée pendant qu'une saisie attend est écartée, et le curseur avance quand même |
| SYN-05 | majeur | `sync_engine.dart` (`_sendRepCallAttempts`) | Un représentant supprimé côté serveur fait basculer en échec toutes les tentatives d'appel suivantes du lot |
| SYN-06 | majeur | `sync_engine.dart` (`remapEntityId`) | La fusion d'un doublon de représentant efface définitivement son fil de commentaires local |
| SYN-07 | majeur | `sync_engine.dart` (`runOnce`) | Un envoi qui échoue en boucle empêche DÉFINITIVEMENT tout tirage |

## SYN-01, bloquant : clé d'idempotence rejouée sur un contenu différent

### Scénario

1. Trois saisies indépendantes partent dans un même lot, sous la clé `K`.
2. Le serveur répond 200 et juge le lot : deux appliquées, une non jugée
   (`skippedDependencyFailed`, groupe annulé). La troisième est remise en file
   par `_requeueBlocked`, avec un délai de trente secondes au plancher.
3. Trente secondes plus tard, la vidange suivante ne peut prendre QUE cette
   troisième ligne : les deux autres sont acquittées.
4. Le lot repart avec UNE opération, sous la clé `K`.

### Attendu

Un corps différent voyage sous une clé neuve. Le serveur possède déjà une
idempotence PAR OPÉRATION (`sync_operations`, `ON CONFLICT ("opId") DO NOTHING`,
`apps/api/src/modules/sync/sync.service.ts:1287`) : le renvoi partiel serait
correctement traité s'il n'était pas refusé en amont.

### Observé

La même clé repart avec un corps différent. Le serveur répond
`422 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`. Le client classe ce refus
en `FailureKind.terminal` sans opération nommée, et `_applyTerminalRefusal`
bascule TOUTES les lignes du lot en `failed`.

Pire : le bouton « Réessayer » de l'écran « À corriger » ne peut pas débloquer
la situation, puisque `retryOperation` ne remet pas `batch_id` à NULL et renvoie
donc encore la même clé sur un corps encore plus petit.

### Preuve

Origine, `apps/mobile/lib/core/sync/sync_engine.dart:419` :

```dart
  static String _stableBatchId(List<OutboxData> rows) {
    final String? first = rows.first.batchId;
    if (first == null || first.isEmpty) return Ids.newId();
    for (final OutboxData row in rows) {
      if (row.batchId != first) return Ids.newId();
    }
    return first;
  }
```

Le test ne compare que les `batch_id` PRÉSENTS, jamais ceux qui manquent : un
sous-ensemble strict passe le contrôle. Ni `_requeue`
(`sync_engine.dart:1180`), ni `_requeueBlocked` (`sync_engine.dart:1216`), ni
`WriteRepository.retryOperation`
(`apps/mobile/lib/data/repositories/write_repository.dart:1183`) ne remettent
`batch_id` à NULL. Seul `_amendInPlace`
(`write_repository.dart:1160`) le fait.

Serveur, `apps/api/src/modules/sync/sync.service.ts:220` : l'empreinte
d'idempotence couvre `operations`, donc tout retrait d'opération la change.

Preuve HTTP, contre l'API réelle (script
`docs/qa-mobile/syn01.sh`, compte `fixture.awa`) :

```
== envoi 1 : DEUX operations, cle 146b4c80-db04-41ed-8ce3-6d5088b5e7f7
{"batchId":"146b4c80-...","results":[{"status":"applied",...},{"status":"applied",...}]}
HTTP 200

== envoi 2 : MEME cle, UNE seule operation (renvoi partiel)
{"code":"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
 "message":"Cette clé d’idempotence a déjà servi pour un autre contenu.
 Générez un nouveau clientBatchId.","statusCode":422}
HTTP 422

== envoi 3 : MEME cle, MEME corps (rejeu exact)
HTTP 200   (rejeu du cache d'idempotence, résultats identiques)
```

Preuve côté client, `apps/mobile/test/qa/qa_sync_preuves.dart` :

* « un renvoi partiel garde le batchId du lot complet » : ÉCHOUE.
  `Expected: not '01a0532f-5f96-...' / Actual: '01a0532f-5f96-...'`, avec
  `api.calls[1].operations` de longueur 1 contre 3 au premier envoi.
* « Réessayer depuis À corriger garde aussi le batchId » : ÉCHOUE.
  `Expected: null / Actual: '01a0532f-5fe1-...'`.
* « un 422 de clé réutilisée est classé terminal » : PASSE, et c'est le
  problème (`DioApi.classify` rend `FailureKind.terminal`,
  `rejectedOperations` vide).
* « un refus terminal anonyme condamne TOUT le lot » : PASSE, les deux lignes
  finissent en `failed`.

### Cause

`_stableBatchId` réutilise l'identifiant du lot précédent dès que toutes les
lignes PRÉSENTES le portent, sans vérifier qu'aucune ne manque. La reprise de
clé n'a de sens que sur le chemin « la réponse s'est perdue au retour », où le
lot entier est remis en file d'un bloc par `_handleBatchFailure`.

### Correctif minimal proposé (non appliqué)

1. Remettre `batchId: Value<String?>(null)` dans les écritures individuelles :
   `_requeue`, `_requeueBlocked`, `_markFailed`, et
   `WriteRepository.retryOperation`.
2. Garder la reprise de clé UNIQUEMENT dans `_handleBatchFailure`, seul endroit
   où l'intégralité du lot est remise en file ensemble.
3. Par sécurité, faire échouer `_stableBatchId` sur un lot dont le nombre de
   lignes portant `first` en base diffère de `rows.length`.

## SYN-02, majeur : le curseur de tirage survit à la déconnexion

> **Recouvrement assumé.** `docs/qa-mobile/securite-session.md` SEC-01 décrit la
> même racine (aucune purge de la base locale) sous l'angle de la
> confidentialité et de l'imputation des saisies, et cite `sync_state` dans sa
> liste. La fiche ci-dessous n'ajoute qu'une chose, mesurée : la CONSÉQUENCE du
> curseur keyset, qui est une perte de données et non une fuite. Si le
> mainteneur ne compte qu'un défaut, retenir SEC-01 ; le correctif est le même.

### Scénario

Le commercial Awa se déconnecte sur un téléphone partagé. Fatou se connecte sur
le même appareil.

### Attendu

Un compte neuf voit un appareil vierge : aucune fiche d'Awa, aucune saisie non
partie d'Awa, et un curseur de tirage remis à zéro pour que Fatou reçoive tout
son portefeuille.

### Observé

`AuthController.signOut` ne purge que la boîte de notifications et l'annuaire de
phase 2. Restent en base : `prospects`, `representants`,
`representant_comments`, `visites`, `call_attempts` encore en file, `outbox`, et
surtout `sync_state.collection = 'all'`, le curseur keyset.

Conséquence propre à cette fiche : Fatou reprend la pagination là où Awa l'a
laissée. Le curseur est un keyset `(updatedAt, id)` GLOBAL, pas un marqueur par
compte : tout ce dont l'`updatedAt` est antérieur ne redescendra jamais. Fatou
travaille donc sur un portefeuille vide, sans aucun message, et rien dans
l'application ne permet de remettre ce curseur à zéro.

(L'imputation des saisies d'Awa au compte de Fatou est traitée par SEC-01.)

### Preuve

`apps/mobile/lib/features/auth/auth_controller.dart:118` :

```dart
  Future<void> signOut() async {
    await ref.read(pushInboxStoreProvider).purge();
    await ref.read(phase2DirectoryProvider).purge();
```

`Phase2DirectorySync.purge` (`phase2_directory_sync.dart:226`) n'efface que
`phase2_directory`, les `call_attempt` acquittés et le curseur
`phase2_directory`. Aucun autre appel n'efface `sync_state` : recherche
exhaustive sur `lib/`, seules occurrences en écriture dans
`sync_engine.dart:2036` et `2048`.

Preuve HTTP (script `docs/qa-mobile/syn02.sh`) : Awa rattrape tout, puis Fatou tire
deux fois, avec et sans le curseur d'Awa.

```
== fatou, sans curseur (appareil vierge)
prospects=31 representants=58 suppressions=5 hasMore=False

== fatou, avec le curseur laisse par awa sur le MEME telephone
prospects=0 representants=0 suppressions=0 hasMore=False
```

Preuve côté client, `qa_sync_preuves.dart`, « ce que signOut efface laisse la base
du commercial précédent » : ÉCHOUE,
`Expected: null / Actual: 'curseur-de-awa'`.

### Cause

Aucune purge de la base drift n'est branchée sur la déconnexion ni sur la
connexion d'un utilisateur différent.

### Correctif minimal proposé (non appliqué)

Dans `signOut`, et surtout dans `signIn` quand `tokens.userId` diffère de
l'identité déjà enregistrée, exécuter une purge locale dans UNE transaction :
`DELETE FROM sync_state`, `outbox`, `prospects`, `prospect_journeys`,
`representants`, `representant_comments`, `call_attempts`,
`rep_callback_reminders`, `visites`, `form_drafts`. Purger à la CONNEXION plutôt
qu'à la déconnexion couvre aussi l'appareil dont la session a expiré sans
déconnexion explicite.

## SYN-03, majeur : le représentant rendu vivant reste supprimé

### Scénario

1. Un représentant est supprimé côté serveur. Le téléphone reçoit la pierre
   tombale et pose `deleted_at`.
2. Le serveur le rend vivant : soit un `create` hors ligne portant le même
   identifiant (`sync.service.ts:656`, `deletedAt: null`), soit une
   restauration. Sa `rev` et son `updatedAt` bougent.
3. Le téléphone tire la page qui le porte.

### Attendu

`changes.representants` ne contient QUE des représentants vivants
(`sync.service.ts:1178`, `.filter((row) => !row.deletedAt)`). Une fiche qui y
apparaît doit redevenir visible.

### Observé

La `rev` et tous les champs sont appliqués, mais `deleted_at` reste posé : la
fiche est invisible pour toujours. Le prospect, lui, est correctement rouvert.

### Preuve

`apps/mobile/lib/core/sync/sync_engine.dart:1848`, la clause `DoUpdate` des
représentants énumère `fullName, phoneE164, notes, departementId, iefId,
relationStatus, whatsappStatus, whatsappE164, profession, rev, serverUpdatedAt,
localUpdatedAt`. Aucun `deletedAt`.

À comparer avec les prospects, `sync_engine.dart:1949` :

```dart
                  deletedAt: const CustomExpression<DateTime>(
                    'excluded.deleted_at',
                  ),
```

Tests `qa_sync_preuves.dart` :

* « le pull ne rouvre pas un représentant marqué supprimé » : ÉCHOUE,
  `Expected: null / Actual: DateTime:<2026-08-12 09:00:00.000Z>`, alors que
  `rev` vaut bien 9.
* « le prospect, lui, est bien rouvert par le même chemin » : PASSE. L'asymétrie
  est le défaut.

### Cause

`RepresentantDto` ne porte pas de `deletedAt` (le serveur ne sert que les
vivants), et personne n'a écrit l'effacement explicite du drapeau local.

### Correctif minimal proposé (non appliqué)

Ajouter à la clause `DoUpdate` des représentants
`deletedAt: const CustomExpression<DateTime>('NULL')`. Toute ligne présente dans
`changes.representants` est vivante par construction.

## SYN-04, majeur : la pierre tombale écartée n'est jamais rejouée

### Scénario

1. Une correction locale d'un prospect attend son tour : elle est `pending` avec
   un `next_attempt_at` dans le futur, comme après tout 429 ou 5xx.
2. `drain()` ne prend rien (rien n'est dû), ne pose donc pas d'échec, et
   `pullChanges()` s'exécute.
3. La page porte la suppression serveur de ce prospect.

### Attendu

Ou bien la suppression est appliquée, ou bien le curseur ne la dépasse pas.

### Observé

`_applyPage` écarte la suppression parce que le prospect est « gardé », PUIS
`advanceCursor` fait avancer le curseur au-delà. La ligne serveur ne bougera
plus : sa pierre tombale ne redescendra jamais. Le commercial continue
d'appeler une fiche que le serveur a supprimée.

### Preuve

`apps/mobile/lib/core/sync/sync_engine.dart:2006` :

```dart
      for (final SyncDeletionDto d in page.deletions) {
        if (d.entity == SyncEntity.representant) {
          if (guardedRepresentants.contains(d.id)) continue;
```

et `sync_engine.dart:1286` : `_applyPage` puis `advanceCursor`, sans lien entre
ce qui a été écarté et l'avancement.

Test `qa_sync_preuves.dart`, « la suppression est écartée ET le curseur avance » :
ÉCHOUE, `Expected: not null / Actual: <null>` sur `deleted_at`, alors que
`readCursor()` vaut bien `'curseur-apres-suppression'`.

Le flux de suppression existe bel et bien : le tirage réel de `fixture.fatou`
sans curseur rend `suppressions=5`.

### Cause

Le garde `_entitiesWithOpenWrites` protège une modification locale contre
l'écrasement, ce qui est juste, mais la page est consommée comme si tout avait
été appliqué.

### Correctif minimal proposé (non appliqué)

Faire remonter par `_applyPage` la liste des identifiants écartés, et ne pas
appeler `advanceCursor` quand elle n'est pas vide ; ou, moins coûteux,
enregistrer les suppressions écartées dans une table d'attente rejouée à chaque
vidange de la file, jusqu'à ce que plus aucune écriture ne soit ouverte sur
l'entité.

## SYN-05, majeur : un représentant supprimé brûle la file d'appels restante

### Scénario

Trois tentatives d'appel représentant attendent dans la file, chacune sur un
représentant DIFFÉRENT. Le premier représentant a été supprimé côté serveur.

### Attendu

Seule la tentative qui vise le représentant supprimé est refusée. Les deux
autres repartent.

### Observé

Les trois basculent en `failed` et exigent une action humaine.

### Preuve

`apps/api/src/modules/rep-campaigns/errors.ts:6` : `representantNotFound()` est
un `404 REPRESENTANT_NOT_FOUND`. `DioApi.classify` en fait un
`FailureKind.terminal` sans opération nommée.

`apps/mobile/lib/core/sync/sync_engine.dart:647` :

```dart
      } on ApiException catch (error) {
        await _handleBatchFailure(rows.sublist(index), error);
        return _SendReport(acknowledged: acknowledged, keepGoing: false);
      }
```

`_handleBatchFailure` sur `terminal` appelle `_applyTerminalRefusal`, dont la
branche « aucune opération nommée » (`sync_engine.dart:1132`) marque TOUT en
échec.

Contraste interne : le même code serveur, reçu comme VERDICT dans le lot
`/sync/push`, est traité comme bloquant retryable
(`ServerErrorCodes.representantNotFound` figure dans `_blockedCodes`,
`sync_engine.dart:664`). Deux traitements opposés du même fait.

Test `qa_sync_preuves.dart`, « un 404 sur la première condamne les suivantes » :
ÉCHOUE, `Expected: 'pending' / Actual: 'failed'` sur les tentatives B et C.

### Cause

`recordRepCallAttempt` est un envoi UNITAIRE, mais son échec est traité avec la
mécanique d'un lot.

### Correctif minimal proposé (non appliqué)

Dans `_sendRepCallAttempts`, ne passer à `_handleBatchFailure` que
`<OutboxData>[row]` quand `error.kind == FailureKind.terminal` ; laisser
`rows.sublist(index)` aux seules pannes de transport, où l'ensemble du reste est
réellement concerné. Complémentairement, traiter
`REPRESENTANT_NOT_FOUND` par `_requeueBlocked`, comme sur le chemin du lot.

## SYN-06, majeur : la fusion de doublon efface le fil de commentaires

### Scénario

1. Un représentant est créé hors ligne, puis commenté hors ligne.
2. La fiche serveur qui le remplace est DÉJÀ présente en base locale, sous un
   autre identifiant. C'est possible parce que l'index d'unicité du numéro est
   PARTIEL (`schema.drift:209`, `WHERE deleted_at IS NULL`) : une ligne retirée
   par `_retireShadowed` cohabite avec sa remplaçante.
3. La poussée rend l'identifiant serveur, `remapEntityId` fusionne.

### Attendu

Le fil suit la fiche, comme les prospects.

### Observé

Les prospects sont re-pointés, la ligne locale est supprimée, et
`representant_comments.representant_id REFERENCES representants (id) ... ON
DELETE CASCADE` (`schema.drift:299`) efface tout le fil. Aucun tirage ne le
redescend : `representant_comments` n'est écrite QUE localement
(`write_repository.dart:471`) et n'apparaît nulle part dans `_applyPage`. La
perte est définitive sur l'appareil.

### Preuve

`apps/mobile/lib/core/sync/sync_engine.dart:961` :

```dart
      } else {
        await (_db.update(_db.prospects)
              ..where((Prospects t) => t.representantId.equals(localId)))
            .write(ProspectsCompanion(representantId: Value<String>(serverId)));
        await (_db.delete(
          _db.representants,
        )..where((Representants t) => t.id.equals(localId))).go();
      }
```

L'autre branche, le renommage (`sync_engine.dart:957`), préserve le fil grâce à
`ON UPDATE CASCADE`. L'asymétrie entre les deux branches est le défaut.

Test `qa_sync_preuves.dart`, « les commentaires de la fiche locale survivent à la
fusion » : ÉCHOUE, `Expected: an object with length of <1> / Actual: []`.

### Correctif minimal proposé (non appliqué)

Dans la branche `existing != null`, re-pointer `representant_comments` (et
`rep_callback_reminders`, qui ne porte aucune clé étrangère et resterait
orpheline) vers `serverId` AVANT la suppression, exactement comme les prospects.

## SYN-07, majeur : un envoi en panne prive l'appareil de tout tirage

### Scénario

Une opération de la file se heurte à un 5xx ou à un 429 répété : panne serveur,
déploiement, ou groupe qui casse une règle du serveur.

### Attendu

Le tirage, qui est une lecture, continue. Le téléphone doit recevoir les
nouvelles fiches, les référentiels et les listes du registre même quand la
remontée patine.

### Observé

`runOnce` renvoie `failed` dès que `lastPushFailure` est posé et n'appelle
jamais `pullChanges`. Or `runOnce` est le SEUL chemin de tirage de
l'application : recherche exhaustive de `runOnce` et `pullChanges` sur `lib/`,
deux appelants (`background_sync.dart:42`, `sync_coordinator.dart:181`), tous
deux via `runOnce`.

Le blocage est définitif : un refus serveur est explicitement NON épuisable
(`_requeue(..., exhaustible: false)`, `sync_engine.dart:1107-1115`), la ligne ne
bascule donc jamais en `failed` et rien dans l'écran « À corriger » ne permet de
la retirer.

### Preuve

`apps/mobile/lib/core/sync/sync_engine.dart:120` :

```dart
    final ApiException? failure = lastPushFailure;
    if (failure != null) {
      return SyncOutcome.failed(
        failure.code,
        kind: failure.kind,
        pushed: pushed,
      );
    }
    if (!pull) return SyncOutcome.ok(pushed: pushed, pulled: 0);
```

Test `qa_sync_preuves.dart`, « un 500 sur /sync/push empêche le pull du même
passage » : ÉCHOUE, `Expected: empty / Actual: [Instance of 'PullPage']`, la
page servie n'a jamais été consommée ; la ligne reste `pending`.

### Cause

Un seul verdict pour deux directions indépendantes.

### Correctif minimal proposé (non appliqué)

Tirer quand même après un échec de poussée, sauf pour
`FailureKind.sessionExpired`, `appUpdateRequired` et `unreachable`, où le tirage
échouerait de toute façon. Rendre un `SyncOutcome` qui porte les deux verdicts
plutôt qu'un seul.

## Vérifié sans défaut

* **Idempotence par opération côté serveur.** `sync_operations` avec
  `ON CONFLICT ("opId") DO NOTHING` (`sync.service.ts:1287`) : un `opId` déjà
  appliqué rend `duplicate`, jamais une seconde écriture. Rejeu exact d'un lot :
  HTTP 200 et résultats identiques (envoi 3 du script `syn01.sh`).
* **Rejeu exact d'une clé d'idempotence.** Le cache rend la réponse d'origine
  sans réécrire, en-tête `Idempotency-Replayed` compris.
* **Idempotence des tentatives d'appel représentant.** Déduplication par `id`
  client (`rep-campaigns.service.ts:37`), statut `DUPLICATE`.
* **Bail et jeton de possession de l'outbox.** Toutes les écritures
  d'après-envoi sont fenêtrées sur `seq` ET `claim_token` (`_ownedBy`,
  `sync_engine.dart:175`) ; `reclaimExpiredLeases` ne reprend que les baux
  expirés.
* **Réparation de dérive d'horloge.** `repairClockDrift`
  (`sync_engine.dart:224`) ramène un `next_attempt_at` ou un `lease_until`
  aberrant, ce qui couvre un téléphone remis à l'heure en arrière.
* **Chaîne empoisonnée.** `claimableOutbox` (`schema.drift:720`) exclut en SQL
  les lignes dont un prédécesseur de même `dependency_key` est `conflict` ou
  `failed` : l'ordre créer-puis-modifier survit, et le travail plus loin dans la
  file reste visible.
* **Palier de schéma 20.** `schemaVersion` est bien passé de 19 à 20, le dump
  doré existe, et `flutter test` rend « All tests passed! » sur 1058 tests, dont
  `v19 -> v20 supprime les tables de campagne et garde les saisies` et
  `v11 -> courant traverse sans créer les tables de campagne`. Aucun défaut de
  migration constaté sur les chemins couverts.
* **Version de format 5.** Le client annonce `payloadVersion = 5`
  (`sync_engine.dart:59`) et le serveur exige `MIN_PULL_PAYLOAD_VERSION = 5`
  (`sync.controller.ts:29`) : la bascule est cohérente, et un client plus ancien
  reçoit `426 APP_UPDATE_REQUIRED`, que `DioApi.classify` traduit en
  `FailureKind.appUpdateRequired` sans user la file.
* **Retrait des campagnes.** `SyncChangesDto` n'expose plus `callCampaigns`,
  `callTasks`, `repCallCampaigns`, `repCallTasks` ni côté serveur, ni dans
  `packages/api-client-dart` : le retrait est cohérent de bout en bout.
* **Ce que protégeaient les deux tests supprimés.** `sync_generations_test.dart`
  couvrait le miroir des référentiels et le retrait des lignes fantômes :
  `mirrorReferentiels`, `_mirrorKind` et `_retireShadowed` sont toujours en
  place, et `sync_engine_test.dart` en garde des cas. Les seuls cas orphelins
  sont ceux des files d'appels, dont les tables ont disparu.

## Non vérifié

* **Taille et tenue de la base au-delà de 10 000 lignes** : demande un émulateur,
  occupé par un autre testeur.
* **Deux isolats réellement concurrents sur le même fichier de base**
  (WorkManager plus interface). Le test supprimé `sync_ownership_test.dart`
  couvrait ces entrelacements ; je n'ai pas rejoué sa matrice, faute de temps.
  À reprendre en priorité, c'est le seul endroit du moteur où le garde
  `_draining` ne protège rien.
* **Migrations exécutées avec les pragmas de PRODUCTION.** `connection.dart:10`
  branche `AppDatabase.applyPragmas`, donc `PRAGMA foreign_keys = ON` pendant
  `onUpgrade` ; `migration_test.dart` ouvre ses bases sans ce `setup`, donc
  clés étrangères DÉSACTIVÉES. La chaîne actuelle ne recrée aucune table PARENT
  après la création de son enfant en cascade, donc je n'ai constaté aucun dégât
  et je ne compte pas ceci comme un défaut. C'est un angle mort du test doré :
  la première recopie future de `prospects` viderait `prospect_journeys` en
  production sans que le test s'en aperçoive.
* **Horloge locale en avance.** `clientDate` (`sync.service.ts:1385`) ne borne
  pas `clientCreatedAt`, et les listes du téléphone trient sur
  `client_created_at DESC` : un téléphone en avance épinglerait sa fiche en tête
  de liste. Effet cosmétique constaté par lecture, non reproduit.
* **Résurrection d'un prospect supprimé par une modification hors ligne**
  (`sync.service.ts:912`, `deletedAt: null`, sans `assertRev`). Comportement
  serveur possiblement voulu ; je n'ai pas trouvé de décision écrite et je ne
  l'ai donc pas compté.
* **Troncature de champs, encodage des numéros, notes vocales** : non éprouvés.

## Commandes exécutées

```sh
git rev-parse --short HEAD                       # e8baacd
cd apps/mobile && fvm flutter test                # 1058 tests, All tests passed!
cd apps/mobile && fvm flutter test test/qa/qa_sync_preuves.dart   # 3 passent, 8 échouent
sh docs/qa-mobile/syn01.sh                            # 200, puis 422, puis 200
sh docs/qa-mobile/syn02.sh                            # 31/58/5 sans curseur, 0/0/0 avec
```
