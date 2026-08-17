import '../../data/local/database.dart';
import 'api_port.dart';
import 'clock.dart';
import 'sync_engine.dart';
import 'token_store.dart';

SyncEngine buildSyncEngine({
  required AppDatabase database,
  required ApiPort api,
  required TokenStore tokens,
  Clock clock = const SystemClock(),
  int maxBatchOps = 200,
  int maxBatchBytes = 512 * 1024,
  int maxAttempts = 8,
}) {
  return SyncEngine(
    database: database,
    api: api,
    tokens: tokens,
    clock: clock,
    maxBatchOps: maxBatchOps,
    maxBatchBytes: maxBatchBytes,
    maxAttempts: maxAttempts,
  );
}
