import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart';

import '../../data/local/database.dart';
import 'api_port.dart';
import 'clock.dart';
import 'outbox_status.dart';

class Phase2DirectorySync {
  Phase2DirectorySync({
    required AppDatabase database,
    required ApiPort api,
    Clock clock = const SystemClock(),
    this.pageSize = 2000,
  }) : _db = database,
       _api = api,
       _clock = clock;

  final AppDatabase _db;
  final ApiPort _api;
  final Clock _clock;

  final int pageSize;

  static const String cursorKey = 'phase2_directory';

  bool _pulling = false;

  bool get isPulling => _pulling;

  Future<int> pull({
    int maxPages = 300,
    void Function(int applied, bool hasMore)? onProgress,
  }) async {
    if (_pulling) return 0;
    _pulling = true;
    try {
      int applied = 0;
      String? cursor = await readCursor();

      for (int page = 0; page < maxPages; page++) {
        final Phase2DirectoryPage result = await _api.pullPhase2Directory(
          cursor: cursor,
          limit: pageSize,
        );
        applied += await _applyPage(result.entries);
        cursor = result.nextCursor;
        await writeCursor(cursor);
        onProgress?.call(applied, result.hasMore);
        if (!result.hasMore) break;
        if (result.entries.isEmpty) break;
      }
      return applied;
    } finally {
      _pulling = false;
    }
  }

  Future<int> _applyPage(List<Phase2DirectoryEntry> entries) async {
    if (entries.isEmpty) return 0;
    await _retireShadowed(entries);
    await _db.batch((Batch batch) {
      for (final Phase2DirectoryEntry e in entries) {
        batch.insert(
          _db.phase2Directory,
          Phase2DirectoryCompanion.insert(
            prospectId: e.prospectId,
            phoneE164: e.phoneE164,
            phase2Status: Value<String>(e.phase2Status),
            enrollmentMethod: Value<String?>(e.enrollmentMethod),
            rev: Value<int>(e.rev),
            updatedAt: e.updatedAt,
          ),
          onConflict: DoUpdate<Phase2Directory, Phase2DirectoryData>(
            (Phase2Directory old) => Phase2DirectoryCompanion.custom(
              phoneE164: const CustomExpression<String>('excluded.phone_e164'),
              phase2Status: const CustomExpression<String>(
                'excluded.phase2_status',
              ),
              enrollmentMethod: const CustomExpression<String>(
                'excluded.enrollment_method',
              ),
              rev: const CustomExpression<int>('excluded.rev'),
              updatedAt: const CustomExpression<DateTime>(
                'excluded.updated_at',
              ),
            ),
            where: (Phase2Directory old) => const CustomExpression<int>(
              'excluded.rev',
            ).isBiggerOrEqual(old.rev),
          ),
        );
      }
    });
    return entries.length;
  }

  /// `phase2_directory_phone_unique` n'admet qu'une ligne par numéro. Une base
  /// serveur remontée redescend le même numéro sous un prospect NEUF : sans
  /// cette purge, l'insertion viole l'index, la page entière est perdue et
  /// l'annuaire ne se complète plus jamais. La ligne périmée s'efface : elle ne
  /// porte rien qui ait été saisi ici, seulement l'état que le serveur en avait.
  Future<void> _retireShadowed(List<Phase2DirectoryEntry> entries) async {
    final Map<String, String> byPhone = <String, String>{
      for (final Phase2DirectoryEntry e in entries) e.phoneE164: e.prospectId,
    };
    final List<Phase2DirectoryData> locals =
        await (_db.select(_db.phase2Directory)..where(
              (Phase2Directory t) =>
                  t.phoneE164.isIn(byPhone.keys.toList(growable: false)),
            ))
            .get();
    final List<String> stale = <String>[
      for (final Phase2DirectoryData row in locals)
        if (byPhone[row.phoneE164] != row.prospectId) row.prospectId,
    ];
    if (stale.isEmpty) return;
    await (_db.delete(
      _db.phase2Directory,
    )..where((Phase2Directory t) => t.prospectId.isIn(stale))).go();
  }

  Future<void> markLocallyClosed({
    required String prospectId,
    required String outcome,
    String? method,
  }) async {
    final String? status = Phase2Statuses.forOutcome(outcome);
    if (status == null) return;
    await (_db.update(
      _db.phase2Directory,
    )..where((Phase2Directory t) => t.prospectId.equals(prospectId))).write(
      Phase2DirectoryCompanion(
        phase2Status: Value<String>(status),
        enrollmentMethod: Value<String?>(
          status == Phase2Statuses.methodObtained ? method : null,
        ),
        updatedAt: Value<DateTime>(_clock.now()),
      ),
    );
  }

  /// L'annuaire d'abord, la fiche locale ensuite.
  ///
  /// Le repli n'est pas un confort : l'annuaire descend PAR PAGES, dans l'ordre
  /// des `updated_at` croissants, et une base fraîchement importée : le Grand
  /// Public en entier : arrive donc en DERNIER. La fiche, elle, est déjà là,
  /// puisque c'est depuis sa liste qu'on vient. Sans ce repli, « Consigner
  /// l'appel » rendait « Ce numéro n'est pas dans la liste » sur une fiche
  /// ouverte deux gestes plus tôt, et rien de ce que le téléconseiller pouvait
  /// faire n'y changeait quoi que ce soit.
  Future<Phase2DirectoryData?> lookupByPhone(String phoneE164) async =>
      await _db.phase2ByPhone(phone: phoneE164).getSingleOrNull() ??
      await _localEntry(phoneE164);

  Future<Phase2DirectoryData?> _localEntry(String phoneE164) async {
    final Prospect? fiche =
        await (_db.select(_db.prospects)
              ..where(
                (Prospects t) =>
                    t.phoneE164.equals(phoneE164) & t.deletedAt.isNull(),
              )
              ..limit(1))
            .getSingleOrNull();
    if (fiche == null) return null;
    // Ce que CE téléphone sait du dossier : une issue terminale déjà saisie ici
    // doit fermer la fiche, sinon la console la rouvrirait à chaque recherche.
    final CallAttempt? dernier =
        await (_db.select(_db.callAttempts)
              ..where((CallAttempts t) => t.prospectId.equals(fiche.id))
              ..orderBy(<OrderClauseGenerator<CallAttempts>>[
                (CallAttempts t) => OrderingTerm.desc(t.clientCreatedAt),
              ])
              ..limit(1))
            .getSingleOrNull();
    return Phase2DirectoryData(
      prospectId: fiche.id,
      phoneE164: fiche.phoneE164,
      phase2Status:
          (dernier == null ? null : CallEffects.phase2Status(dernier.effect)) ??
          Phase2Statuses.pending,
      enrollmentMethod: dernier?.method,
      rev: 0,
      updatedAt: fiche.localUpdatedAt,
    );
  }

  Future<int> count() => _db.countPhase2Directory().getSingle();

  Future<int> countClosed() {
    final Expression<int> total = _db.callAttempts.id.count();
    return (_db.selectOnly(_db.callAttempts)
          ..addColumns(<Expression<Object>>[total])
          ..where(_db.callAttempts.effect.isIn(CallEffects.closing)))
        .map((TypedResult row) => row.read(total) ?? 0)
        .getSingle();
  }

  Stream<int> watchCount() => _db.countPhase2Directory().watchSingle();

  Future<DateTime?> lastPulledAt() async => (await _stateRow())?.lastPulledAt;

  Stream<SyncStateData?> watchState() =>
      (_db.select(_db.syncState)
            ..where((SyncState t) => t.collection.equals(cursorKey)))
          .watchSingleOrNull();

  Future<String?> readCursor() async => (await _stateRow())?.cursor;

  Future<SyncStateData?> _stateRow() => (_db.select(
    _db.syncState,
  )..where((SyncState t) => t.collection.equals(cursorKey))).getSingleOrNull();

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

  Future<void> purge() async {
    await _db.transaction(() async {
      await _db.delete(_db.phase2Directory).go();

      await (_db.delete(_db.outbox)..where(
            (Outbox o) =>
                o.entityType.equals(callAttemptEntity) &
                o.status.isIn(OutboxStatus.open).not(),
          ))
          .go();

      await _db.customStatement(
        'DELETE FROM call_attempts WHERE id NOT IN ('
        'SELECT entity_id FROM outbox WHERE entity_type = ? AND status IN '
        '(${List<String>.filled(OutboxStatus.open.length, '?').join(', ')}))',
        <Object?>[callAttemptEntity, ...OutboxStatus.open],
      );

      await (_db.delete(
        _db.syncState,
      )..where((SyncState t) => t.collection.equals(cursorKey))).go();
    });
  }
}

const String callAttemptEntity = 'call_attempt';

abstract final class CallOutcomes {
  static const String methodObtained = 'METHOD_OBTAINED';
  static const String unreachable = 'UNREACHABLE';
  static const String callback = 'CALLBACK';
  static const String refused = 'REFUSED';
  static const String wrongNumber = 'WRONG_NUMBER';
  static const String other = 'OTHER';

  static final List<String> all = CallOutcome.values
      .where((CallOutcome o) => o != CallOutcome.unknownDefaultOpenApi)
      .map((CallOutcome o) => o.value)
      .toList(growable: false);
}

/// Effets d'un motif d'issue : ce que la tentative FAIT au dossier. C'est la
/// seule part du vocabulaire d'appel qui reste compilée, parce qu'elle porte des
/// conséquences que l'application doit savoir appliquer hors ligne. Les motifs,
/// eux, viennent du serveur et s'ajoutent sans nouvelle version.
abstract final class CallEffects {
  static const String closeMethod = 'CLOSE_METHOD';
  static const String closeRefused = 'CLOSE_REFUSED';
  static const String closeWrongNumber = 'CLOSE_WRONG_NUMBER';
  static const String keepOpen = 'KEEP_OPEN';
  static const String scheduleCallback = 'SCHEDULE_CALLBACK';

  static final List<String> all = CallOutcomeEffect.values
      .where(
        (CallOutcomeEffect e) => e != CallOutcomeEffect.unknownDefaultOpenApi,
      )
      .map((CallOutcomeEffect e) => e.value)
      .toList(growable: false);

  static const List<String> closing = <String>[
    closeMethod,
    closeRefused,
    closeWrongNumber,
  ];

  /// L'issue historique qu'un effet porte sur le fil. `outcome` reste une
  /// énumération FERMÉE du contrat : un motif neuf voyage dans `reasonCode`, et
  /// son effet dit quelle issue connue le serveur doit lire à sa place.
  static const Map<String, String> outcome = <String, String>{
    closeMethod: CallOutcomes.methodObtained,
    closeRefused: CallOutcomes.refused,
    closeWrongNumber: CallOutcomes.wrongNumber,
    scheduleCallback: CallOutcomes.callback,
    keepOpen: CallOutcomes.unreachable,
  };

  static String? phase2Status(String effect) => switch (effect) {
    closeMethod => Phase2Statuses.methodObtained,
    closeRefused => Phase2Statuses.refused,
    closeWrongNumber => Phase2Statuses.wrongNumber,
    _ => null,
  };
}

/// Un motif d'issue, qu'il vienne de la table locale ou du repli compilé.
class CallReason {
  const CallReason({
    required this.code,
    required this.label,
    required this.effect,
    this.requiresComment = false,
    this.requiresCallback = false,
    this.countsAsReached = false,
    this.sortOrder = 100,
    this.color,
  });

  factory CallReason.fromRow(CallOutcomeReason row) => CallReason(
    code: row.code,
    label: row.label,
    effect: row.effect,
    requiresComment: row.requiresComment,
    requiresCallback: row.requiresCallback,
    countsAsReached: row.countsAsReached,
    sortOrder: row.sortOrder,
    color: row.color,
  );

  final String code;
  final String label;
  final String effect;
  final bool requiresComment;
  final bool requiresCallback;
  final bool countsAsReached;
  final int sortOrder;
  final String? color;

  /// Un motif système porte le code de son issue ; un motif ajouté par le client
  /// emprunte celle de son effet.
  String get outcome => CallOutcomes.all.contains(code)
      ? code
      : (CallEffects.outcome[effect] ?? CallOutcomes.unreachable);

  bool get closes => CallEffects.closing.contains(effect);

  @override
  bool operator ==(Object other) =>
      identical(this, other) || (other is CallReason && other.code == code);

  @override
  int get hashCode => code.hashCode;
}

/// Repli tant que la table locale est vide : au premier lancement, la saisie ne
/// peut pas attendre la première synchronisation. Ce sont les six motifs
/// SYSTÈME, dont le serveur garantit que le code ne bouge jamais.
abstract final class SystemCallReasons {
  static const List<CallReason> all = <CallReason>[
    CallReason(
      code: CallOutcomes.methodObtained,
      label: 'Méthode obtenue',
      effect: CallEffects.closeMethod,
      countsAsReached: true,
      sortOrder: 10,
    ),
    CallReason(
      code: CallOutcomes.unreachable,
      label: 'Injoignable',
      effect: CallEffects.keepOpen,
      sortOrder: 20,
    ),
    CallReason(
      code: CallOutcomes.callback,
      label: 'À rappeler',
      effect: CallEffects.scheduleCallback,
      countsAsReached: true,
      sortOrder: 30,
    ),
    CallReason(
      code: CallOutcomes.refused,
      label: 'Refus',
      effect: CallEffects.closeRefused,
      countsAsReached: true,
      sortOrder: 40,
    ),
    CallReason(
      code: CallOutcomes.wrongNumber,
      label: 'Mauvais numéro',
      effect: CallEffects.closeWrongNumber,
      sortOrder: 50,
    ),
    CallReason(
      code: CallOutcomes.other,
      label: 'Autre',
      effect: CallEffects.keepOpen,
      requiresComment: true,
      countsAsReached: true,
      sortOrder: 60,
    ),
  ];

  static final Map<String, CallReason> byCode = <String, CallReason>{
    for (final CallReason r in all) r.code: r,
  };
}

/// Tous les motifs connus de cet appareil, ACTIFS OU NON : une tentative mise en
/// file avant qu'un motif ne soit désactivé doit encore pouvoir partir.
Future<Map<String, CallReason>> loadCallReasons(AppDatabase db) async {
  final List<CallOutcomeReason> rows = await db
      .select(db.callOutcomeReasons)
      .get();
  return <String, CallReason>{
    ...SystemCallReasons.byCode,
    for (final CallOutcomeReason row in rows) row.code: CallReason.fromRow(row),
  };
}

Future<CallReason?> resolveCallReason(AppDatabase db, String code) async {
  final CallOutcomeReason? row = await (db.select(
    db.callOutcomeReasons,
  )..where((CallOutcomeReasons t) => t.code.equals(code))).getSingleOrNull();
  return row == null ? SystemCallReasons.byCode[code] : CallReason.fromRow(row);
}

abstract final class EnrollmentMethods {
  static const String platform = 'PLATFORM';
  static const String physical = 'PHYSICAL';
  static const String voiceOrElectronicMessaging =
      'VOICE_OR_ELECTRONIC_MESSAGING';

  /// La seule méthode qui exige une date : le serveur refuse l'opération sans
  /// `rendezVousAt`, et la refuse sur toutes les autres.
  static const String appointment = 'APPOINTMENT';

  static const String whatsapp = 'WHATSAPP';

  static final List<String> all = EnrollmentMethod.values
      .where(
        (EnrollmentMethod m) => m != EnrollmentMethod.unknownDefaultOpenApi,
      )
      .map((EnrollmentMethod m) => m.value)
      .toList(growable: false);
}

abstract final class Phase2Statuses {
  static const String pending = 'PENDING';
  static const String methodObtained = 'METHOD_OBTAINED';
  static const String refused = 'REFUSED';
  static const String wrongNumber = 'WRONG_NUMBER';

  static final List<String> all = Phase2Status.values
      .where((Phase2Status s) => s != Phase2Status.unknownDefaultOpenApi)
      .map((Phase2Status s) => s.value)
      .toList(growable: false);

  static String? forOutcome(String outcome) {
    if (outcome == pending) return null;
    return all.contains(outcome) ? outcome : null;
  }
}
