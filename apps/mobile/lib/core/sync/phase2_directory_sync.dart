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
              phase2Status: const CustomExpression<String>('excluded.phase2_status'),
              enrollmentMethod: const CustomExpression<String>(
                'excluded.enrollment_method',
              ),
              rev: const CustomExpression<int>('excluded.rev'),
              updatedAt: const CustomExpression<DateTime>('excluded.updated_at'),
            ),
            where: (Phase2Directory old) =>
                const CustomExpression<int>('excluded.rev').isBiggerOrEqual(old.rev),
          ),
        );
      }
    });
    return entries.length;
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

  Future<Phase2DirectoryData?> lookupByPhone(String phoneE164) =>
      _db.phase2ByPhone(phone: phoneE164).getSingleOrNull();

  Future<int> count() => _db.countPhase2Directory().getSingle();

  Future<int> countClosed() {
    final Expression<int> total = _db.callAttempts.id.count();
    return (_db.selectOnly(_db.callAttempts)
          ..addColumns(<Expression<Object>>[total])
          ..where(_db.callAttempts.outcome.isIn(CallOutcomes.terminal)))
        .map((TypedResult row) => row.read(total) ?? 0)
        .getSingle();
  }

  Stream<int> watchCount() => _db.countPhase2Directory().watchSingle();

  Future<DateTime?> lastPulledAt() async => (await _stateRow())?.lastPulledAt;

  Stream<SyncStateData?> watchState() => (_db.select(
    _db.syncState,
  )..where((SyncState t) => t.collection.equals(cursorKey))).watchSingleOrNull();

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

  static final Set<String> terminal = Phase2Statuses.all
      .where((String s) => s != Phase2Statuses.pending)
      .toSet();
}

abstract final class EnrollmentMethods {
  static const String platform = 'PLATFORM';
  static const String physical = 'PHYSICAL';
  static const String voiceOrElectronicMessaging = 'VOICE_OR_ELECTRONIC_MESSAGING';

  static final List<String> all = EnrollmentMethod.values
      .where((EnrollmentMethod m) => m != EnrollmentMethod.unknownDefaultOpenApi)
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
