import 'package:drift/drift.dart';

import '../../data/local/database.dart';
import 'push_message.dart';

class PushInboxStore {
  const PushInboxStore(this._db);

  final AppDatabase _db;

  Future<void> upsert(PushMessage message) async {
    await _db.transaction(() async {
      final StoredNotification? existing = await (_db.select(
        _db.notifications,
      )..where((Notifications t) => t.id.equals(message.id))).getSingleOrNull();

      await _db
          .into(_db.notifications)
          .insertOnConflictUpdate(
            NotificationsCompanion.insert(
              id: message.id,
              title: message.title,
              body: message.body,
              category: Value<String>(message.category),
              route: Value<String?>(message.route),
              payload: Value<String?>(message.payload),
              readAt: Value<DateTime?>(existing?.readAt),
              createdAt: message.sentAt,
              receivedAt: DateTime.now().toUtc(),
            ),
          );
    });
  }

  Future<void> upsertAll(
    Iterable<PushMessage> messages, {
    Map<String, DateTime?>? readStates,
  }) async {
    await _db.transaction(() async {
      for (final PushMessage message in messages) {
        final StoredNotification? existing =
            await (_db.select(_db.notifications)
                  ..where((Notifications t) => t.id.equals(message.id)))
                .getSingleOrNull();

        final DateTime? serverRead = readStates?[message.id];
        final DateTime? localRead = existing?.readAt;
        final DateTime? readAt = _earliest(serverRead, localRead);

        await _db
            .into(_db.notifications)
            .insertOnConflictUpdate(
              NotificationsCompanion.insert(
                id: message.id,
                title: message.title,
                body: message.body,
                category: Value<String>(message.category),
                route: Value<String?>(message.route),
                payload: Value<String?>(message.payload),
                readAt: Value<DateTime?>(readAt),
                createdAt: message.sentAt,
                receivedAt: existing?.receivedAt ?? DateTime.now().toUtc(),
              ),
            );
      }
    });
  }

  static DateTime? _earliest(DateTime? a, DateTime? b) {
    if (a == null) return b;
    if (b == null) return a;
    return a.isBefore(b) ? a : b;
  }

  Future<void> markRead(String id, {DateTime? at}) async {
    await (_db.update(
      _db.notifications,
    )..where((Notifications t) => t.id.equals(id) & t.readAt.isNull())).write(
      NotificationsCompanion(
        readAt: Value<DateTime?>(at ?? DateTime.now().toUtc()),
      ),
    );
  }

  Future<void> markAllRead({DateTime? at}) async {
    await (_db.update(
      _db.notifications,
    )..where((Notifications t) => t.readAt.isNull())).write(
      NotificationsCompanion(
        readAt: Value<DateTime?>(at ?? DateTime.now().toUtc()),
      ),
    );
  }

  Stream<List<StoredNotification>> watchAll() {
    return (_db.select(_db.notifications)
          ..orderBy(<OrderClauseGenerator<Notifications>>[
            (Notifications t) => OrderingTerm.desc(t.createdAt),
          ]))
        .watch();
  }

  Stream<int> watchUnreadCount() {
    return (_db.select(_db.notifications)
          ..where((Notifications t) => t.readAt.isNull()))
        .watch()
        .map((List<StoredNotification> rows) => rows.length);
  }

  Future<StoredNotification?> byId(String id) {
    return (_db.select(
      _db.notifications,
    )..where((Notifications t) => t.id.equals(id))).getSingleOrNull();
  }

  Future<void> purge() async {
    await _db.delete(_db.notifications).go();
  }
}
