import 'dart:async';

import 'package:drift/drift.dart';

import '../../core/network/refresh_mutex.dart';
import '../../core/sync/clock.dart';
import 'database.dart';

class DatabaseRefreshMutex implements RefreshMutex {
  DatabaseRefreshMutex(
    this._db, {
    Clock clock = const SystemClock(),
    this.leaseDuration = const Duration(seconds: 90),
    this.maxWait = const Duration(seconds: 95),
    this.pollInterval = const Duration(milliseconds: 150),
  }) : _clock = clock;

  static const String lockKey = '@lock:auth.refresh';

  final AppDatabase _db;
  final Clock _clock;

  final Duration leaseDuration;

  final Duration maxWait;

  final Duration pollInterval;

  @override
  Future<T> protect<T>(Future<T> Function() body) async {
    final DateTime mine = await _acquire() ?? (throw const RefreshLockBusy());
    try {
      return await body();
    } finally {
      await _release(mine);
    }
  }

  Future<DateTime?> _acquire() async {
    final DateTime deadline = _clock.now().add(maxWait);
    while (true) {
      final DateTime? lease = await _tryAcquire();
      if (lease != null) return lease;
      if (!_clock.now().isBefore(deadline)) return null;
      await Future<void>.delayed(pollInterval);
    }
  }

  Future<DateTime?> _tryAcquire() async {
    final DateTime now = _clock.now();
    final DateTime expiry = now.add(leaseDuration);

    await _db
        .into(_db.syncState)
        .insert(
          SyncStateCompanion.insert(collection: lockKey),
          mode: InsertMode.insertOrIgnore,
        );

    final int changed =
        await (_db.update(_db.syncState)..where(
              (SyncState t) =>
                  t.collection.equals(lockKey) &
                  (t.lastPulledAt.isNull() |
                      t.lastPulledAt.isSmallerOrEqualValue(now)),
            ))
            .write(SyncStateCompanion(lastPulledAt: Value<DateTime?>(expiry)));
    return changed == 1 ? expiry : null;
  }

  Future<void> _release(DateTime mine) async {
    await (_db.update(_db.syncState)..where(
          (SyncState t) =>
              t.collection.equals(lockKey) & t.lastPulledAt.equals(mine),
        ))
        .write(const SyncStateCompanion(lastPulledAt: Value<DateTime?>(null)));
  }
}
