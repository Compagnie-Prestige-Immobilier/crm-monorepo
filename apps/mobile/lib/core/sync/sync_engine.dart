import 'dart:convert';
import 'dart:math';

import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart';

import '../../data/local/database.dart';
import '../utils/ids.dart';
import 'api_port.dart';
import 'backoff.dart';
import 'clock.dart';
import 'outbox_status.dart';
import 'phase2_directory_sync.dart' show callAttemptEntity;
import 'token_store.dart';

/// Moteur de synchronisation — **Dart pur**.
///
/// Contrainte d'architecture, pas préférence de style : le worker WorkManager
/// exécute ce code dans un isolat de fond qui n'a **ni arbre de widgets, ni
/// conteneur Riverpod, ni plugins de rendu**. Tout ce qui vit dans
/// `lib/core/sync/` respecte donc une règle unique, vérifiée par un test :
///
/// > aucun `import 'package:flutter/...'`, aucun `import
/// > 'package:flutter_riverpod/...'`.
///
/// Le moteur reçoit ses quatre collaborateurs — [AppDatabase], [ApiPort],
/// [TokenStore], [Clock] — et n'en construit aucun. C'est ce qui permet à
/// l'isolat UI (via Riverpod) et à l'isolat worker (via `buildSyncEngine`)
/// d'assembler exactement le même objet par deux chemins différents.
///
/// ## Ce que garantit la vidange
///
/// 1. **Vol unique.** Deux vidanges concurrentes émettraient le même lot deux
///    fois sous deux clés d'idempotence différentes — le serveur ne pourrait pas
///    les rapprocher.
/// 2. **Bail écrit AVANT la requête.** Si l'app meurt en vol, la ligne reste en
///    `syncing` avec un bail daté ; le cycle suivant le récupère. Écrire le bail
///    après l'envoi laisserait au contraire une opération éternellement
///    `pending` alors qu'elle est peut-être déjà appliquée côté serveur.
/// 3. **Ordre structurel, pas vérifié.** Un prospect partage la `dependencyKey`
///    de son représentant et porte un `seq` supérieur ; un lot n'emporte qu'un
///    **préfixe contigu** d'opérations `pending` par clé. Il n'existe donc aucun
///    chemin par lequel un prospect partirait sans le `create` de son parent —
///    ce n'est pas un contrôle qu'on peut oublier d'écrire, c'est une propriété
///    de la sélection.
/// 4. **Une clé empoisonnée ne bloque qu'elle-même.** Si la tête d'une clé est
///    en `conflict` ou `failed`, la clé entière est ignorée ; les quarante
///    autres représentants continuent de passer (ADR 0001 §2).
class SyncEngine {
  SyncEngine({
    required AppDatabase database,
    required ApiPort api,
    required TokenStore tokens,
    required Clock clock,
    this.maxBatchOps = 200,
    this.maxBatchBytes = 512 * 1024,
    this.maxBatchGroups = 25,
    this.maxAttempts = 8,
    this.leaseDuration = const Duration(minutes: 2),
    Random? random,
  }) : _db = database,
       _api = api,
       _tokens = tokens,
       _clock = clock,
       _backoff = Backoff(random: random ?? Random());

  final AppDatabase _db;
  final ApiPort _api;
  final TokenStore _tokens;
  final Clock _clock;
  final Backoff _backoff;

  /// Version du format de payload actuellement produite.
  ///
  /// Elle voyage avec le lot et est stockée sur chaque ligne d'outbox. Une
  /// opération peut attendre trois semaines dans la file et traverser une mise à
  /// jour de l'app : sans ce numéro, on ne saurait pas dans quel format la
  /// relire.
  static const int payloadVersion = 1;

  /// Plafond d'opérations par lot. 200 est le maximum accepté par le serveur ;
  /// au-delà, la transaction de groupe dépasserait son délai.
  final int maxBatchOps;

  /// Plafond d'octets par lot. Sur un lien 2G, un lot de 512 ko met déjà plus
  /// d'une minute à monter ; au-delà, plus aucun envoi n'aboutit jamais.
  final int maxBatchBytes;

  /// Plafond de **clés de dépendance** par lot. 25, parce que c'est la valeur
  /// exacte que le serveur impose (`SYNC_MAX_DEPENDENCY_GROUPS`) : chaque groupe
  /// y est une transaction, et un lot qui en couvre davantage est refusé **en
  /// bloc, en 400** — donc classé terminal, donc toutes ses opérations partent
  /// en `failed`.
  ///
  /// Ce plafond ne se voyait pas en phase 1 : un commercial saisit rarement plus
  /// de vingt-cinq représentants entre deux synchronisations. La phase 2 le rend
  /// certain — chaque tentative d'appel porte sa propre clé (`prospect:<id>`), et
  /// une matinée hors ligne en produit soixante. Sans ce plafond, la première
  /// synchronisation au retour du réseau condamnerait toute la matinée d'un
  /// coup, définitivement.
  final int maxBatchGroups;

  /// Au-delà, l'opération passe en `failed` et attend une intervention humaine.
  /// Réessayer indéfiniment une opération invalide vide la batterie sans jamais
  /// aboutir.
  final int maxAttempts;

  /// Durée du bail. Assez long pour couvrir un envoi lent (60 s de
  /// `receiveTimeout` + montée), assez court pour qu'un plantage ne fige pas la
  /// file plus de quelques minutes.
  final Duration leaseDuration;

  AppDatabase get database => _db;
  ApiPort get api => _api;
  TokenStore get tokens => _tokens;
  Clock get clock => _clock;
  Backoff get backoff => _backoff;

  bool _draining = false;

  /// Vrai tant qu'une vidange est en cours. Lu par l'UI pour griser le bouton
  /// « Synchroniser maintenant ».
  bool get isDraining => _draining;

  // ───────────────────────────────────────────────────────────────────────────
  // Compteurs
  // ───────────────────────────────────────────────────────────────────────────

  Future<int> pendingCount() => _db.countPendingOutbox().getSingle();

  Stream<int> watchPendingCount() => _db.countPendingOutbox().watchSingle();

  // ───────────────────────────────────────────────────────────────────────────
  // Cycle complet
  // ───────────────────────────────────────────────────────────────────────────

  /// Un cycle : pousser ce qui attend, puis tirer les nouveautés.
  ///
  /// L'ordre n'est pas arbitraire. Tirer d'abord écraserait une modification
  /// locale non encore poussée par la version serveur, qui est plus ancienne.
  Future<SyncOutcome> runOnce({bool pull = true}) async {
    if (await _tokens.readRefreshToken() == null) {
      return const SyncOutcome.skipped('no_session');
    }
    int pushed = 0;
    try {
      pushed = await drain();
    } on ApiException catch (e) {
      return SyncOutcome.failed(e.code, kind: e.kind, pushed: pushed);
    }
    if (!pull) return SyncOutcome.ok(pushed: pushed, pulled: 0);
    try {
      final int pulled = await pullChanges();
      return SyncOutcome.ok(pushed: pushed, pulled: pulled);
    } on ApiException catch (e) {
      // Un pull raté n'annule pas un push réussi : ce sont deux directions
      // indépendantes, et effacer le compte poussé ferait croire à l'utilisateur
      // que rien n'est parti.
      return SyncOutcome.failed(e.code, kind: e.kind, pushed: pushed);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Vidange (push)
  // ───────────────────────────────────────────────────────────────────────────

  /// Vide la file jusqu'à épuisement des opérations éligibles.
  ///
  /// Renvoie le nombre d'opérations acquittées par le serveur (quel que soit le
  /// verdict — appliqué, doublon, conflit : elles ont toutes reçu une réponse).
  Future<int> drain() async {
    // Vol unique. Sans ce garde, un déclencheur de connectivité et le minuteur
    // de 60 s peuvent partir dans la même milliseconde et émettre deux fois le
    // même lot, sous deux clés d'idempotence différentes — que le serveur ne
    // peut pas rapprocher.
    if (_draining) return 0;
    _draining = true;
    try {
      int acknowledged = 0;
      // Borne dure : une boucle `while(true)` qui n'avancerait pas (bug de
      // sélection, statut jamais mis à jour) tournerait indéfiniment dans un
      // isolat de fond, invisible, batterie comprise.
      for (int round = 0; round < 50; round++) {
        await reclaimExpiredLeases();
        final List<OutboxData> batch = await selectBatch();
        if (batch.isEmpty) break;

        final _PreparedBatch prepared = await _prepare(batch);
        if (prepared.isEmpty) {
          // Tout le lot était indécodable : les lignes sont déjà passées en
          // `failed`, il n'y a rien à envoyer, mais il reste peut-être du
          // travail derrière.
          continue;
        }

        final bool keepGoing = await _sendBatch(prepared);
        acknowledged += prepared.length;
        if (!keepGoing) break;
      }
      return acknowledged;
    } finally {
      _draining = false;
    }
  }

  /// Récupère les baux des isolats morts en vol.
  ///
  /// Un bail expiré signifie « quelqu'un a pris cette ligne et n'est jamais
  /// revenu ». La remettre en `pending` est sûr : l'envoi porte une clé
  /// d'idempotence, donc un éventuel doublon côté serveur est reconnu et rendu
  /// tel quel.
  Future<int> reclaimExpiredLeases() async {
    final DateTime now = _clock.now();
    final List<OutboxData> stale = await (_db.select(
      _db.outbox,
    )..where((Outbox o) => o.status.equals(OutboxStatus.syncing))).get();
    final List<OutboxData> expired = stale
        .where((OutboxData o) => o.leaseUntil == null || !o.leaseUntil!.isAfter(now))
        .toList(growable: false);
    if (expired.isEmpty) return 0;

    await (_db.update(
      _db.outbox,
    )..where((Outbox o) => o.seq.isIn(expired.map((OutboxData e) => e.seq)))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.pending),
        leaseUntil: const Value<DateTime?>(null),
      ),
    );
    return expired.length;
  }

  /// Sélectionne le prochain lot : préfixe contigu `pending` et dû, par clé.
  ///
  /// Les trois règles, dans l'ordre où elles s'appliquent :
  ///
  /// * la **tête** d'une clé — l'opération ouverte de plus petit `seq` — doit
  ///   être `pending` et due. Si elle est `conflict` ou `failed`, la clé est
  ///   empoisonnée et on l'ignore entièrement ; si elle est `syncing`, un autre
  ///   envoi la porte déjà ;
  /// * on prend ensuite le **préfixe contigu** d'opérations `pending` et dues.
  ///   Contigu : à la première opération non éligible, on s'arrête, même si les
  ///   suivantes le seraient. C'est ce qui rend l'ordre structurel ;
  /// * on s'arrête à [maxBatchOps] opérations, [maxBatchBytes] octets ou
  ///   [maxBatchGroups] clés de dépendance.
  ///
  /// Le lot est en outre **homogène en famille de transport** : ou bien il ne
  /// contient que des tentatives d'appel, ou bien il n'en contient aucune. Ce
  /// n'est pas une règle métier, c'est la conséquence du décalage du client
  /// généré : les deux familles empruntent aujourd'hui deux méthodes d'envoi
  /// différentes ([ApiPort.push] typée, [ApiPort.pushRaw] brute), et un lot
  /// mixte n'aurait aucun chemin. Les deux familles ne partagent jamais de clé
  /// de dépendance — une tentative d'appel est groupée sur son prospect, qui
  /// existe déjà côté serveur — donc les séparer ne casse aucun ordre.
  ///
  /// TODO(generated-client): supprimer l'homogénéité dès que `call_attempt`
  /// entrera dans `SyncEntity`.
  Future<List<OutboxData>> selectBatch() async {
    final DateTime now = _clock.now();

    // Toutes les opérations ouvertes, dans l'ordre d'émission. Le tri par `seq`
    // et jamais par identifiant : la dérive d'horloge entre appareils rend
    // l'ordre d'un UUID v7 inter-appareils dénué de sens (ADR 0001 §1).
    final List<OutboxData> open =
        await (_db.select(_db.outbox)
              ..where((Outbox o) => o.status.isIn(OutboxStatus.open))
              ..orderBy(<OrderClauseGenerator<Outbox>>[
                (Outbox o) => OrderingTerm.asc(o.seq),
              ])
              ..limit(2000))
            .get();

    final Map<String, List<OutboxData>> byKey = <String, List<OutboxData>>{};
    for (final OutboxData row in open) {
      // Une opération sans clé est sa propre partition : elle ne dépend de rien
      // et rien ne dépend d'elle.
      byKey
          .putIfAbsent(row.dependencyKey ?? 'op:${row.id}', () => <OutboxData>[])
          .add(row);
    }

    final List<OutboxData> batch = <OutboxData>[];
    int bytes = 0;
    int groups = 0;
    bool? phase2Batch;

    for (final List<OutboxData> chain in byKey.values) {
      final OutboxData head = chain.first;
      if (head.status != OutboxStatus.pending) continue;
      if (head.nextAttemptAt.isAfter(now)) continue;

      final bool isPhase2 = head.entityType == callAttemptEntity;
      // Première clé retenue : elle fixe la famille du lot. Les suivantes d'une
      // autre famille attendront le lot d'après — la vidange boucle, elles ne
      // sont pas perdues.
      phase2Batch ??= isPhase2;
      if (isPhase2 != phase2Batch) continue;

      if (batch.isNotEmpty && groups >= maxBatchGroups) return batch;
      groups++;

      for (final OutboxData row in chain) {
        if (row.status != OutboxStatus.pending) break;
        if (row.nextAttemptAt.isAfter(now)) break;
        final int size = row.payload.length + 256;
        if (batch.isNotEmpty &&
            (batch.length >= maxBatchOps || bytes + size > maxBatchBytes)) {
          return batch;
        }
        batch.add(row);
        bytes += size;
      }
    }
    return batch;
  }

  /// Réhydrate les payloads et pose le bail.
  ///
  /// Le payload est stocké en **JSON brut**, pas en objet typé sérialisé. Une
  /// opération peut rester en file à travers une mise à jour de l'app : un
  /// graphe d'objets typé deviendrait indécodable au premier champ renommé,
  /// alors qu'un JSON se relit toujours — quitte à échouer proprement.
  ///
  /// Si `fromJson` lève, l'opération part en `failed` avec
  /// [ClientErrorCodes.payloadSchemaMismatch] et remonte dans « À corriger ».
  /// **C'est le point du dispositif** : un échec visible et réparable, jamais une
  /// exception non rattrapée dans un isolat de fond, où personne ne la verrait.
  Future<_PreparedBatch> _prepare(List<OutboxData> rows) async {
    final String batchId = Ids.newId();
    final List<SyncOperationDto> operations = <SyncOperationDto>[];
    final List<Map<String, Object?>> rawOperations = <Map<String, Object?>>[];
    final List<OutboxData> accepted = <OutboxData>[];
    final List<OutboxData> undecodable = <OutboxData>[];

    for (final OutboxData row in rows) {
      try {
        if (row.entityType == callAttemptEntity) {
          rawOperations.add(_toRawOperation(row));
        } else {
          operations.add(_toOperation(row));
        }
        accepted.add(row);
      } on Object catch (e) {
        undecodable.add(row);
        await _markFailed(
          row,
          ClientErrorCodes.payloadSchemaMismatch,
          'Cette saisie a été enregistrée par une version antérieure de '
          'l\'application et n\'est plus lisible. ($e)',
        );
      }
    }
    if (undecodable.isNotEmpty && accepted.isEmpty) {
      return _PreparedBatch(
        batchId: batchId,
        rows: const <OutboxData>[],
        operations: const <SyncOperationDto>[],
        rawOperations: const <Map<String, Object?>>[],
      );
    }

    // BAIL COMMITÉ AVANT LA REQUÊTE. C'est l'ordre qui compte, pas l'écriture
    // elle-même : un plantage entre les deux laisse un bail expirable, donc une
    // ligne récupérable. L'inverse laisserait une ligne `pending` déjà appliquée
    // côté serveur.
    final DateTime now = _clock.now();
    await (_db.update(
      _db.outbox,
    )..where((Outbox o) => o.seq.isIn(accepted.map((OutboxData e) => e.seq)))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.syncing),
        leaseUntil: Value<DateTime?>(now.add(leaseDuration)),
        batchId: Value<String?>(batchId),
      ),
    );

    return _PreparedBatch(
      batchId: batchId,
      rows: accepted,
      operations: operations,
      rawOperations: rawOperations,
    );
  }

  /// Une tentative d'appel, en JSON brut.
  ///
  /// TODO(generated-client): remplacer par [_toOperation] quand `SyncEntity`
  /// connaîtra `call_attempt` et que `SyncEntityDataDto` portera `prospectId`,
  /// `outcome`, `method` et `comment`. Aujourd'hui, y passer serait pire que
  /// tout : le modèle généré est produit avec `disallowUnrecognizedKeys: false`,
  /// donc il **laisserait tomber ces quatre champs en silence** et enverrait un
  /// `data` vide que le serveur refuserait en `CALL_ATTEMPT_INCOMPLETE`.
  ///
  /// Le payload est validé ici plutôt que recopié aveuglément : les trois champs
  /// obligatoires du serveur sont vérifiés, et leur absence lève — ce qui fait
  /// partir la ligne en `failed` avec [ClientErrorCodes.payloadSchemaMismatch],
  /// c'est-à-dire dans « À corriger », visible, plutôt qu'en refus serveur
  /// incompréhensible trois semaines plus tard.
  Map<String, Object?> _toRawOperation(OutboxData row) {
    final Object? decoded = jsonDecode(row.payload);
    if (decoded is! Map<String, dynamic>) {
      throw FormatException('payload non objet', row.payload);
    }
    for (final String required in const <String>[
      'prospectId',
      'outcome',
      'clientCreatedAt',
    ]) {
      if (decoded[required] is! String) {
        throw FormatException('tentative d\'appel sans $required', row.payload);
      }
    }
    return <String, Object?>{
      'opId': row.id,
      'seq': row.seq,
      'entity': callAttemptEntity,
      'op': row.op,
      // L'identifiant de la TENTATIVE, pas celui du prospect : c'est lui que le
      // serveur retient comme clé d'idempotence.
      'entityId': row.entityId,
      'clientUpdatedAt': row.createdAt.toUtc().toIso8601String(),
      'data': decoded,
    };
  }

  SyncOperationDto _toOperation(OutboxData row) {
    final Object? decoded = jsonDecode(row.payload);
    if (decoded is! Map<String, dynamic>) {
      throw FormatException('payload non objet', row.payload);
    }
    return SyncOperationDto(
      opId: row.id,
      seq: row.seq,
      entity: row.entityType == 'representant'
          ? SyncEntity.representant
          : SyncEntity.prospect,
      op: switch (row.op) {
        'create' => SyncOp.create,
        'update' => SyncOp.update,
        'delete' => SyncOp.delete,
        _ => throw FormatException('opération inconnue', row.op),
      },
      entityId: row.entityId,
      clientUpdatedAt: row.createdAt,
      baseRev: row.baseRev,
      // `delete` n'a pas de corps : le serveur n'a besoin que de l'identifiant,
      // et lui envoyer un `data` vide ferait échouer la validation de champs
      // requis sur certaines routes.
      data: row.op == 'delete' ? null : SyncEntityDataDto.fromJson(decoded),
    );
  }

  /// Envoie le lot et applique les verdicts. Renvoie `false` s'il faut arrêter
  /// la vidange (session morte, throttling, lot en cours côté serveur).
  Future<bool> _sendBatch(_PreparedBatch prepared) async {
    final PushResult result;
    try {
      // Le lot est homogène (voir `selectBatch`) : une seule des deux listes est
      // non vide, donc un seul des deux transports est emprunté.
      result = prepared.rawOperations.isEmpty
          ? await _api.push(
              batchId: prepared.batchId,
              payloadVersion: payloadVersion,
              operations: prepared.operations,
            )
          : await _api.pushRaw(
              batchId: prepared.batchId,
              payloadVersion: payloadVersion,
              operations: prepared.rawOperations,
            );
    } on ApiException catch (e) {
      await _handleBatchFailure(prepared.rows, e);
      // Seul un échec vraiment transitoire justifie d'enchaîner : sur une
      // session morte ou un throttling, insister aggrave la situation.
      return false;
    }

    final Map<String, SyncOperationResultDto> byOpId = <String, SyncOperationResultDto>{
      for (final SyncOperationResultDto r in result.results) r.opId: r,
    };

    for (final OutboxData row in prepared.rows) {
      final SyncOperationResultDto? verdict = byOpId[row.id];
      if (verdict == null) {
        await _requeue(row, incrementAttempt: true, code: ClientErrorCodes.noResult);
        continue;
      }
      await _applyVerdict(row, verdict);
    }
    return true;
  }

  Future<void> _applyVerdict(OutboxData row, SyncOperationResultDto verdict) async {
    switch (verdict.status) {
      case SyncOpStatus.applied:
      case SyncOpStatus.duplicate:
        await _markDone(row, verdict);
      case SyncOpStatus.conflict:
        await _handleConflict(row, verdict);
      case SyncOpStatus.invalid:
        await _markFailed(
          row,
          verdict.errorCode ?? 'INVALID',
          verdict.error ?? 'Le serveur a refusé cette saisie.',
        );
      case SyncOpStatus.skippedDependencyFailed:
      case SyncOpStatus.unknownDefaultOpenApi:
        // Le parent n'est pas passé. Réessayer *cette* opération ne sert à rien
        // tant que le parent n'est pas résolu — et la sélection l'empêchera
        // toute seule, puisque la tête de la clé est maintenant en conflit. On
        // la remet donc en file **sans compter de tentative** : la faute n'est
        // pas la sienne, et lui brûler ses huit essais la tuerait pour un
        // problème qui n'est pas le sien.
        await _requeue(
          row,
          incrementAttempt: false,
          code: verdict.errorCode ?? ServerErrorCodes.parentRepresentantFailed,
          message: verdict.error,
        );
    }
  }

  Future<void> _markDone(OutboxData row, SyncOperationResultDto verdict) async {
    final String? serverId = verdict.entityId;
    // Remappage d'identifiant : le serveur a réuni deux fiches sur le téléphone.
    // C'est le SEUL remappage du système (ADR 0001 §1).
    if (serverId != null &&
        serverId != row.entityId &&
        row.entityType == 'representant') {
      await remapEntityId(row.entityId, serverId);
    }
    await _db.transaction(() async {
      await (_db.update(_db.outbox)..where((Outbox o) => o.seq.equals(row.seq))).write(
        OutboxCompanion(
          status: const Value(OutboxStatus.done),
          leaseUntil: const Value<DateTime?>(null),
          lastErrorCode: const Value<String?>(null),
          lastErrorMsg: const Value<String?>(null),
        ),
      );
      await _stampServerState(
        entityType: row.entityType,
        entityId: serverId ?? row.entityId,
        rev: verdict.rev?.toInt(),
        serverUpdatedAt: verdict.serverUpdatedAt,
      );
    });
  }

  Future<void> _stampServerState({
    required String entityType,
    required String entityId,
    int? rev,
    DateTime? serverUpdatedAt,
  }) async {
    if (rev == null && serverUpdatedAt == null) return;
    // Une tentative d'appel n'a rien à estampiller : la ligne locale est un
    // journal immuable, et la `rev` que le serveur renvoie est celle du
    // PROSPECT, pas de la tentative. L'écrire sur `phase2_directory` serait
    // tentant et faux — elle y arriverait sans le statut correspondant, et le
    // pull suivant, voyant une `rev` déjà à jour, ne corrigerait plus rien.
    if (entityType == callAttemptEntity) return;
    if (entityType == 'representant') {
      await (_db.update(
        _db.representants,
      )..where((Representants t) => t.id.equals(entityId))).write(
        RepresentantsCompanion(
          rev: rev == null ? const Value.absent() : Value<int>(rev),
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
        ),
      );
    } else {
      await (_db.update(
        _db.prospects,
      )..where((Prospects t) => t.id.equals(entityId))).write(
        ProspectsCompanion(
          rev: rev == null ? const Value.absent() : Value<int>(rev),
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
        ),
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Conflits
  // ───────────────────────────────────────────────────────────────────────────

  /// Un 409 sur le téléphone d'un représentant.
  ///
  /// **Si la fiche existante est la mienne, on fusionne sans rien demander.** Le
  /// commercial a ressaisi un représentant qu'il avait déjà enregistré depuis un
  /// autre appareil, ou avant une réinstallation : lui poser la question serait
  /// lui demander d'arbitrer un problème qu'il n'a pas et dont il ne peut rien
  /// savoir. On remappe l'identifiant local vers celui du serveur et ses
  /// prospects suivent.
  ///
  /// **Si elle appartient à un autre commercial, on ne fusionne JAMAIS
  /// automatiquement.** L'attribution d'un représentant détermine la commission.
  /// Rattacher en silence les prospects d'Awa à Moussa, ou l'inverse, se
  /// traduirait par une paie fausse à la fin du mois — et personne ne remonterait
  /// jusqu'à une fusion automatique faite six semaines plus tôt. L'opération
  /// passe en `conflict` et l'écran « À corriger » nomme le propriétaire.
  Future<void> _handleConflict(OutboxData row, SyncOperationResultDto verdict) async {
    final bool mergeable =
        verdict.errorCode == ServerErrorCodes.representantPhoneConflict &&
        row.entityType == 'representant' &&
        row.op == 'create';

    if (mergeable) {
      final String? resolved = await _autoMergeRepresentant(row);
      if (resolved != null) {
        await remapEntityId(row.entityId, resolved);
        await (_db.update(_db.outbox)..where((Outbox o) => o.seq.equals(row.seq))).write(
          OutboxCompanion(
            status: const Value(OutboxStatus.done),
            leaseUntil: const Value<DateTime?>(null),
            lastErrorCode: const Value<String?>(null),
            lastErrorMsg: const Value<String?>(null),
          ),
        );
        return;
      }
    }

    await (_db.update(_db.outbox)..where((Outbox o) => o.seq.equals(row.seq))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.conflict),
        leaseUntil: const Value<DateTime?>(null),
        lastErrorCode: Value<String?>(verdict.errorCode),
        lastErrorMsg: Value<String?>(verdict.error),
      ),
    );
  }

  /// Renvoie l'identifiant serveur si la fusion automatique est légitime.
  Future<String?> _autoMergeRepresentant(OutboxData row) async {
    final String? me = await _tokens.readUserId();
    if (me == null) return null;

    final String? phone = _phoneOf(row.payload);
    if (phone == null) return null;

    final RepresentantLookup lookup;
    try {
      lookup = await _api.lookupRepresentantByPhone(phone);
    } on ApiException {
      // Le lookup a échoué (réseau, serveur). On ne fusionne pas à l'aveugle :
      // sans savoir à qui appartient la fiche, la fusion automatique est
      // exactement l'opération qu'il ne faut pas tenter.
      return null;
    }
    if (!lookup.found || lookup.representant == null) return null;
    if (lookup.ownedByCommercialId != me) return null;
    return lookup.representant!.id;
  }

  static String? _phoneOf(String payload) {
    try {
      final Object? decoded = jsonDecode(payload);
      if (decoded is Map && decoded['phone'] is String) {
        return decoded['phone'] as String;
      }
    } on FormatException {
      return null;
    }
    return null;
  }

  /// Réécrit un identifiant local en identifiant serveur, **en une transaction**.
  ///
  /// Cinq écritures qui doivent être atomiques ; interrompues au milieu, elles
  /// laisseraient des prospects orphelins ou des opérations pointant vers un
  /// identifiant qui n'existe plus :
  ///
  /// 1. l'identifiant du représentant — `ON UPDATE CASCADE` fait suivre tous les
  ///    prospects rattachés en une seule instruction, au lieu d'une boucle de
  ///    rattrapage manuelle ;
  /// 2. `outbox.entityId` des opérations visant ce représentant ;
  /// 3. `outbox.dependencyKey`, sans quoi les prospects se retrouveraient dans
  ///    une partition orpheline et ne partiraient jamais ;
  /// 4. le `representantId` **à l'intérieur de chaque payload en attente** — le
  ///    payload est du JSON figé, aucune cascade SQL ne l'atteint ;
  /// 5. les brouillons de formulaire en cours qui pointent vers l'ancien parent.
  ///
  /// Cas particulier traité explicitement : la fiche serveur peut **déjà** être
  /// présente localement (un pull l'a ramenée entre-temps). Renommer
  /// l'identifiant violerait alors la clé primaire ; on repointe les prospects
  /// puis on supprime le doublon local. `ON DELETE RESTRICT` impose cet ordre.
  Future<void> remapEntityId(String localId, String serverId) async {
    if (localId == serverId) return;
    await _db.transaction(() async {
      final Representant? existing = await (_db.select(
        _db.representants,
      )..where((Representants t) => t.id.equals(serverId))).getSingleOrNull();

      if (existing == null) {
        await _db.customStatement(
          'UPDATE representants SET id = ? WHERE id = ?',
          <Object?>[serverId, localId],
        );
      } else {
        await (_db.update(_db.prospects)
              ..where((Prospects t) => t.representantId.equals(localId)))
            .write(ProspectsCompanion(representantId: Value<String>(serverId)));
        await (_db.delete(
          _db.representants,
        )..where((Representants t) => t.id.equals(localId))).go();
      }

      await (_db.update(_db.outbox)..where(
            (Outbox o) =>
                o.entityType.equals('representant') & o.entityId.equals(localId),
          ))
          .write(OutboxCompanion(entityId: Value<String>(serverId)));

      await (_db.update(_db.outbox)..where((Outbox o) => o.dependencyKey.equals(localId)))
          .write(OutboxCompanion(dependencyKey: Value<String?>(serverId)));

      final List<OutboxData> open = await (_db.select(
        _db.outbox,
      )..where((Outbox o) => o.status.isIn(OutboxStatus.open))).get();
      for (final OutboxData row in open) {
        final String? rewritten = _rewriteRepresentantId(row.payload, localId, serverId);
        if (rewritten == null) continue;
        await (_db.update(_db.outbox)..where((Outbox o) => o.seq.equals(row.seq))).write(
          OutboxCompanion(payload: Value<String>(rewritten)),
        );
      }

      final List<FormDraft> drafts = await _db.select(_db.formDrafts).get();
      for (final FormDraft draft in drafts) {
        final String? rewritten = _rewriteRepresentantId(
          draft.payload,
          localId,
          serverId,
        );
        final bool parentMoved = draft.parentId == localId;
        if (rewritten == null && !parentMoved) continue;
        await (_db.update(
          _db.formDrafts,
        )..where((FormDrafts t) => t.draftId.equals(draft.draftId))).write(
          FormDraftsCompanion(
            payload: rewritten == null ? const Value.absent() : Value<String>(rewritten),
            parentId: parentMoved ? Value<String?>(serverId) : const Value.absent(),
          ),
        );
      }
    });
  }

  /// Renvoie le JSON réécrit, ou `null` s'il n'y avait rien à changer.
  static String? _rewriteRepresentantId(String payload, String from, String to) {
    final Object? decoded;
    try {
      decoded = jsonDecode(payload);
    } on FormatException {
      return null;
    }
    if (decoded is! Map) return null;
    if (decoded['representantId'] != from) return null;
    return jsonEncode(<String, Object?>{
      ...decoded.cast<String, Object?>(),
      'representantId': to,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Échecs de lot
  // ───────────────────────────────────────────────────────────────────────────

  Future<void> _handleBatchFailure(List<OutboxData> rows, ApiException error) async {
    switch (error.kind) {
      case FailureKind.idempotencyInProgress:
        // Un autre appel traite déjà exactement ce lot ; il va aboutir. On
        // repasse dans 2 s **sans compter la tentative** : ce n'est pas un
        // échec, c'est une file d'attente. Le compter ferait mourir en `failed`
        // une opération parfaitement saine au bout de huit collisions.
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: false,
            delay: const Duration(seconds: 2),
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.sessionExpired:
        // La session est morte : aucune tentative n'aurait pu réussir, donc
        // aucune ne se compte. Les lignes repartiront telles quelles après
        // reconnexion.
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: false,
            delay: Duration.zero,
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.throttled:
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: true,
            delay: error.retryAfter ?? _backoff.nextDelay(row.attempts + 1),
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.retryable:
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: true,
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.terminal:
        for (final OutboxData row in rows) {
          await _markFailed(row, error.code, error.message);
        }
    }
  }

  /// Remet une ligne en file. [delay] par défaut : back-off à gigue complète.
  Future<void> _requeue(
    OutboxData row, {
    required bool incrementAttempt,
    Duration? delay,
    String? code,
    String? message,
  }) async {
    final int attempts = incrementAttempt ? row.attempts + 1 : row.attempts;
    if (incrementAttempt && attempts >= maxAttempts) {
      await _markFailed(
        row,
        code ?? ClientErrorCodes.attemptsExhausted,
        message ??
            'Envoi impossible après $maxAttempts tentatives. '
                'Vérifiez la saisie ou réessayez plus tard.',
        attempts: attempts,
      );
      return;
    }
    final Duration wait = delay ?? _backoff.nextDelay(attempts);
    await (_db.update(_db.outbox)..where((Outbox o) => o.seq.equals(row.seq))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.pending),
        attempts: Value<int>(attempts),
        nextAttemptAt: Value<DateTime>(_clock.now().add(wait)),
        leaseUntil: const Value<DateTime?>(null),
        lastErrorCode: Value<String?>(code),
        lastErrorMsg: Value<String?>(message),
      ),
    );
  }

  Future<void> _markFailed(
    OutboxData row,
    String code,
    String? message, {
    int? attempts,
  }) async {
    await (_db.update(_db.outbox)..where((Outbox o) => o.seq.equals(row.seq))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.failed),
        attempts: attempts == null ? const Value.absent() : Value<int>(attempts),
        leaseUntil: const Value<DateTime?>(null),
        lastErrorCode: Value<String?>(code),
        lastErrorMsg: Value<String?>(message),
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Pull
  // ───────────────────────────────────────────────────────────────────────────

  /// Curseur unique, stocké sous cette clé dans `sync_state`.
  static const String cursorKey = 'all';

  /// Tire les changements depuis le curseur et les applique en LWW par `rev`.
  ///
  /// L'écriture est un `INSERT … ON CONFLICT DO UPDATE … WHERE excluded.rev >
  /// rev`. Le `WHERE` porte tout : sans lui, une page rejouée (curseur non
  /// avancé après une coupure) réécrirait une ligne plus récente avec une
  /// version plus ancienne, et la modification de l'utilisateur disparaîtrait
  /// sans trace.
  Future<int> pullChanges({int maxPages = 20}) async {
    int applied = 0;
    String? cursor = await readCursor();

    for (int page = 0; page < maxPages; page++) {
      final PullPage result = await _api.pull(cursor: cursor, limit: 200);
      applied += await _applyPage(result);
      cursor = result.nextCursor;
      await writeCursor(cursor);
      if (!result.hasMore) break;
    }
    return applied;
  }

  Future<int> _applyPage(PullPage page) async {
    int count = 0;
    await _db.transaction(() async {
      for (final DepartementDto d in page.changes.departements) {
        await _db
            .into(_db.departements)
            .insert(
              DepartementsCompanion.insert(
                id: d.id,
                code: d.code,
                name: d.name,
                regionId: d.regionId,
                isActive: Value<bool>(d.isActive),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(d.updatedAt),
              ),
              onConflict: DoUpdate<Departements, Departement>(
                (Departements old) => DepartementsCompanion.custom(
                  code: const CustomExpression<String>('excluded.code'),
                  name: const CustomExpression<String>('excluded.name'),
                  regionId: const CustomExpression<String>('excluded.region_id'),
                  isActive: const CustomExpression<bool>('excluded.is_active'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                ),
              ),
            );
        count++;
      }
      for (final BanqueDto b in page.changes.banques) {
        await _db
            .into(_db.banques)
            .insert(
              BanquesCompanion.insert(
                id: b.id,
                name: b.name,
                shortName: b.shortName,
                isActive: Value<bool>(b.isActive),
                sortOrder: Value<int>(b.sortOrder.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(b.updatedAt),
              ),
              onConflict: DoUpdate<Banques, Banque>(
                (Banques old) => BanquesCompanion.custom(
                  name: const CustomExpression<String>('excluded.name'),
                  shortName: const CustomExpression<String>('excluded.short_name'),
                  isActive: const CustomExpression<bool>('excluded.is_active'),
                  sortOrder: const CustomExpression<int>('excluded.sort_order'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                ),
              ),
            );
        count++;
      }
      for (final SyndicatDto s in page.changes.syndicats) {
        await _db
            .into(_db.syndicats)
            .insert(
              SyndicatsCompanion.insert(
                id: s.id,
                name: s.name,
                sigle: s.sigle,
                secteur: Value<String?>(s.secteur),
                isActive: Value<bool>(s.isActive),
                sortOrder: Value<int>(s.sortOrder.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(s.updatedAt),
              ),
              onConflict: DoUpdate<Syndicats, Syndicat>(
                (Syndicats old) => SyndicatsCompanion.custom(
                  name: const CustomExpression<String>('excluded.name'),
                  sigle: const CustomExpression<String>('excluded.sigle'),
                  secteur: const CustomExpression<String>('excluded.secteur'),
                  isActive: const CustomExpression<bool>('excluded.is_active'),
                  sortOrder: const CustomExpression<int>('excluded.sort_order'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                ),
              ),
            );
        count++;
      }
      for (final RepresentantDto r in page.changes.representants) {
        await _db
            .into(_db.representants)
            .insert(
              RepresentantsCompanion.insert(
                id: r.id,
                fullName: r.fullName,
                phoneE164: r.phoneE164,
                notes: Value<String?>(r.notes),
                departementId: r.departementId,
                createdById: r.createdById,
                clientCreatedAt: r.clientCreatedAt,
                rev: Value<int>(r.rev.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(r.updatedAt),
              ),
              onConflict: DoUpdate<Representants, Representant>(
                (Representants old) => RepresentantsCompanion.custom(
                  fullName: const CustomExpression<String>('excluded.full_name'),
                  phoneE164: const CustomExpression<String>('excluded.phone_e164'),
                  notes: const CustomExpression<String>('excluded.notes'),
                  departementId: const CustomExpression<String>(
                    'excluded.departement_id',
                  ),
                  rev: const CustomExpression<int>('excluded.rev'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                ),
                // LWW par révision serveur. Une page rejouée n'écrase rien.
                where: (Representants old) =>
                    const CustomExpression<int>('excluded.rev').isBiggerThan(old.rev),
              ),
            );
        count++;
      }
      for (final ProspectDto p in page.changes.prospects) {
        await _db
            .into(_db.prospects)
            .insert(
              ProspectsCompanion.insert(
                id: p.id,
                nom: p.nom,
                prenom: p.prenom,
                phoneE164: p.phoneE164,
                banqueId: p.banqueId,
                syndicatId: p.syndicatId,
                representantId: p.representantId,
                createdById: p.ownedByCommercialId,
                statut: Value<String>(p.statut.value),
                clientCreatedAt: p.clientCreatedAt,
                rev: Value<int>(p.rev.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(p.updatedAt),
                deletedAt: Value<DateTime?>(p.deletedAt),
              ),
              onConflict: DoUpdate<Prospects, Prospect>(
                (Prospects old) => ProspectsCompanion.custom(
                  nom: const CustomExpression<String>('excluded.nom'),
                  prenom: const CustomExpression<String>('excluded.prenom'),
                  phoneE164: const CustomExpression<String>('excluded.phone_e164'),
                  banqueId: const CustomExpression<String>('excluded.banque_id'),
                  syndicatId: const CustomExpression<String>('excluded.syndicat_id'),
                  representantId: const CustomExpression<String>(
                    'excluded.representant_id',
                  ),
                  statut: const CustomExpression<String>('excluded.statut'),
                  rev: const CustomExpression<int>('excluded.rev'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                  deletedAt: const CustomExpression<DateTime>('excluded.deleted_at'),
                ),
                where: (Prospects old) =>
                    const CustomExpression<int>('excluded.rev').isBiggerThan(old.rev),
              ),
            );
        count++;
      }

      // Suppressions : logiques, jamais physiques. Une ligne effacée pour de bon
      // reviendrait au prochain pull complet, puisque le serveur ne la renvoie
      // plus mais que rien ne dit localement qu'elle a existé.
      for (final SyncDeletionDto d in page.deletions) {
        if (d.entity == SyncEntity.representant) {
          await (_db.update(_db.representants)
                ..where((Representants t) => t.id.equals(d.id)))
              .write(RepresentantsCompanion(deletedAt: Value<DateTime?>(d.deletedAt)));
        } else {
          await (_db.update(_db.prospects)..where((Prospects t) => t.id.equals(d.id)))
              .write(ProspectsCompanion(deletedAt: Value<DateTime?>(d.deletedAt)));
        }
        count++;
      }
    });
    return count;
  }

  Future<String?> readCursor() async {
    final SyncStateData? row = await (_db.select(
      _db.syncState,
    )..where((SyncState t) => t.collection.equals(cursorKey))).getSingleOrNull();
    return row?.cursor;
  }

  Future<void> writeCursor(String? cursor) async {
    await _db
        .into(_db.syncState)
        .insertOnConflictUpdate(
          SyncStateCompanion.insert(
            collection: cursorKey,
            cursor: Value<String?>(cursor),
            lastPulledAt: Value<DateTime?>(_clock.now()),
          ),
        );
  }

  Future<void> dispose() => _db.close();
}

class _PreparedBatch {
  const _PreparedBatch({
    required this.batchId,
    required this.rows,
    required this.operations,
    required this.rawOperations,
  });

  final String batchId;
  final List<OutboxData> rows;

  /// Opérations typées — représentants et prospects.
  final List<SyncOperationDto> operations;

  /// Opérations en JSON brut — tentatives d'appel.
  ///
  /// TODO(generated-client): champ à supprimer avec [ApiPort.pushRaw].
  final List<Map<String, Object?>> rawOperations;

  /// Le lot est homogène : une seule des deux listes est peuplée. On compte donc
  /// les deux, et `isEmpty` interroge les deux. Tester `operations.isEmpty` seul
  /// ferait silencieusement sauter **tous** les lots de phase 2 — la file se
  /// remplirait sans que rien ne parte et sans la moindre erreur.
  int get length => operations.length + rawOperations.length;

  bool get isEmpty => length == 0;
}

/// Résultat d'un cycle, volontairement sans exception qui remonte : le worker
/// doit pouvoir décider d'un `Result.retry()` sans attraper d'erreur.
class SyncOutcome {
  const SyncOutcome.ok({required this.pushed, required this.pulled})
    : status = SyncRunStatus.ok,
      reason = null,
      kind = null;

  const SyncOutcome.skipped(this.reason)
    : status = SyncRunStatus.skipped,
      pushed = 0,
      pulled = 0,
      kind = null;

  const SyncOutcome.failed(this.reason, {required this.kind, this.pushed = 0})
    : status = SyncRunStatus.failed,
      pulled = 0;

  final SyncRunStatus status;
  final int pushed;
  final int pulled;
  final String? reason;
  final FailureKind? kind;

  bool get isOk => status == SyncRunStatus.ok;

  /// Le worker doit-il redemander à être rappelé ?
  bool get shouldRetry =>
      status == SyncRunStatus.failed &&
      kind != FailureKind.terminal &&
      kind != FailureKind.sessionExpired;
}

enum SyncRunStatus { ok, skipped, failed }
