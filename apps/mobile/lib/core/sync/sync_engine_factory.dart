import '../../data/local/database.dart';
import 'api_port.dart';
import 'clock.dart';
import 'sync_engine.dart';
import 'token_store.dart';

/// Fabrique **partagée** du moteur de synchronisation. Dart pur.
///
/// Deux appelants, un seul assemblage :
///
/// * l'isolat UI, où un provider Riverpod appelle cette fonction et expose le
///   résultat à l'arbre de widgets ;
/// * l'isolat WorkManager, qui n'a ni Riverpod ni widgets et appelle la même
///   fonction directement.
///
/// C'est la seule façon de garantir qu'ils synchronisent avec la même
/// configuration. Deux constructions séparées divergeraient au premier
/// paramètre ajouté, et la divergence ne se verrait qu'en production, sur un
/// appareil hors ligne, chez un commercial.
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
