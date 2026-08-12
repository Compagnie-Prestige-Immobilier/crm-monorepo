import 'dart:async';

import 'package:drift/drift.dart';

import '../../core/network/refresh_mutex.dart';
import '../../core/sync/clock.dart';
import 'database.dart';

/// Verrou de renouvellement adossé à la base locale.
///
/// **Pourquoi la base et pas un `Mutex` mémoire, un fichier verrouillé ou
/// `IsolateNameServer` :**
///
/// - un verrou mémoire ne franchit pas la frontière d'isolat, c'est précisément
///   le vol unique par instance qui a laissé passer le bug ;
/// - `RandomAccessFile.lock` s'appuie sur `fcntl`, dont les verrous sont **par
///   processus** : les deux isolats vivent dans le même processus et
///   l'obtiendraient tous les deux sans jamais s'attendre ;
/// - la base, elle, est déjà le substrat de coordination inter-isolat de l'app —
///   les baux de l'outbox reposent dessus — et `shareAcrossIsolates: true` fait
///   passer les deux isolats par une seule connexion, donc par des écritures
///   réellement sérialisées.
///
/// **Un bail, pas un verrou tenu.** On n'ouvre pas de transaction pendant
/// l'appel réseau : elle bloquerait toutes les autres écritures pendant un
/// aller-retour HTTP, sur un réseau qu'on sait lent. On pose une date
/// d'expiration, exactement comme `outbox.leaseUntil` : un isolat tué en vol
/// libère son verrou tout seul à l'échéance, au lieu de condamner
/// définitivement le renouvellement.
///
/// La ligne est rangée dans `sync_state`, sous une clé qui ne peut pas entrer en
/// collision avec une collection : le moteur n'y accède que par clé exacte, il
/// n'énumère jamais la table.
class DatabaseRefreshMutex implements RefreshMutex {
  DatabaseRefreshMutex(
    this._db, {
    Clock clock = const SystemClock(),
    this.leaseDuration = const Duration(seconds: 30),
    this.maxWait = const Duration(seconds: 40),
    this.pollInterval = const Duration(milliseconds: 150),
  }) : _clock = clock;

  /// Clé réservée. Le `@` la met hors de l'espace de noms des collections
  /// synchronisées, qui sont toutes des noms simples (`prospects`, …).
  static const String lockKey = '@lock:auth.refresh';

  final AppDatabase _db;
  final Clock _clock;

  /// Durée du bail. Doit couvrir un renouvellement complet sur un réseau lent,
  /// sans immobiliser l'app si l'isolat qui le tient meurt.
  final Duration leaseDuration;

  /// Au-delà, on renonce à attendre et on tente quand même : mieux vaut risquer
  /// un rejeu — dont on sait se relever par une reconnexion — que de bloquer
  /// indéfiniment un commercial derrière un verrou qu'un bug n'aurait pas
  /// libéré.
  final Duration maxWait;

  final Duration pollInterval;

  @override
  Future<T> protect<T>(Future<T> Function() body) async {
    final bool held = await _acquire();
    try {
      return await body();
    } finally {
      if (held) await _release();
    }
  }

  /// Tente de prendre le bail, en attendant celui d'en face au plus [maxWait].
  ///
  /// Renvoie `false` si l'attente a expiré : l'appelant exécute quand même, et
  /// ne devra donc pas libérer un bail qui ne lui appartient pas.
  Future<bool> _acquire() async {
    final DateTime deadline = _clock.now().add(maxWait);
    while (true) {
      if (await _tryAcquire()) return true;
      if (!_clock.now().isBefore(deadline)) return false;
      await Future<void>.delayed(pollInterval);
    }
  }

  /// Compare-et-échange atomique.
  ///
  /// Un seul `UPDATE` : SQLite sérialise les écrivains, donc de deux isolats qui
  /// le tentent ensemble, exactement un voit `1` ligne modifiée. Le test
  /// `lastPulledAt <= maintenant` fait d'un bail périmé un bail libre, sans
  /// balayage de rattrapage.
  Future<bool> _tryAcquire() async {
    final DateTime now = _clock.now();

    // `insertOrIgnore` : la ligne peut ne pas exister au tout premier
    // renouvellement. Un `insertOnConflictUpdate` écraserait le bail d'en face.
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
            .write(
              SyncStateCompanion(
                lastPulledAt: Value<DateTime?>(now.add(leaseDuration)),
              ),
            );
    return changed == 1;
  }

  Future<void> _release() async {
    await (_db.update(_db.syncState)
          ..where((SyncState t) => t.collection.equals(lockKey)))
        .write(const SyncStateCompanion(lastPulledAt: Value<DateTime?>(null)));
  }
}
