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
/// - la base, elle, est déjà le substrat de coordination inter-isolat de l'app :
///   les baux de l'outbox reposent dessus : et `shareAcrossIsolates: true` fait
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
    this.leaseDuration = const Duration(seconds: 90),
    this.maxWait = const Duration(seconds: 95),
    this.pollInterval = const Duration(milliseconds: 150),
  }) : _clock = clock;

  /// Clé réservée. Le `@` la met hors de l'espace de noms des collections
  /// synchronisées, qui sont toutes des noms simples (`prospects`, …).
  static const String lockKey = '@lock:auth.refresh';

  final AppDatabase _db;
  final Clock _clock;

  /// Durée du bail. Doit couvrir **le pire renouvellement possible**, sans quoi
  /// le verrou ne verrouille rien.
  ///
  /// Budget réel d'un `POST /auth/refresh` (voir `dio_factory.dart` et
  /// `timeout_profile.dart`) : 15 s de `connectTimeout` + 30 s de `sendTimeout`
  /// + 30 s de `receiveTimeout`, soit **75 s** dans le pire cas. Le bail était
  /// de 30 s : sur un lien 2G lent, il expirait AVANT la fin du renouvellement
  /// qu'il protégeait, l'autre isolat le trouvait libre, et les deux
  /// présentaient le même jeton au serveur. C'est exactement le rejeu que ce
  /// verrou existe pour empêcher : il le fabriquait.
  final Duration leaseDuration;

  /// Au-delà, on renonce à attendre et on tente quand même.
  ///
  /// Volontairement **supérieur à [leaseDuration]** : un attendant qui
  /// abandonnait avant l'expiration du bail d'en face partait renouveler en
  /// parallèle, c'est-à-dire précisément le rejeu redouté. Au terme de cette
  /// attente, le bail est forcément périmé, donc reprenable proprement.
  final Duration maxWait;

  final Duration pollInterval;

  @override
  Future<T> protect<T>(Future<T> Function() body) async {
    // L'ÉCHÉANCE ÉCRITE, et non un simple booléen « je l'ai eu » : c'est elle
    // qui identifie le bail dont on est propriétaire (voir [_release]).
    final DateTime? mine = await _acquire();
    try {
      return await body();
    } finally {
      if (mine != null) await _release(mine);
    }
  }

  /// Tente de prendre le bail, en attendant celui d'en face au plus [maxWait].
  ///
  /// Renvoie `null` si l'attente a expiré : l'appelant exécute quand même, et ne
  /// devra donc **rien libérer**, puisqu'il ne possède rien.
  Future<DateTime?> _acquire() async {
    final DateTime deadline = _clock.now().add(maxWait);
    while (true) {
      final DateTime? lease = await _tryAcquire();
      if (lease != null) return lease;
      if (!_clock.now().isBefore(deadline)) return null;
      await Future<void>.delayed(pollInterval);
    }
  }

  /// Compare-et-échange atomique. Renvoie l'échéance écrite, ou `null`.
  ///
  /// Un seul `UPDATE` : SQLite sérialise les écrivains, donc de deux isolats qui
  /// le tentent ensemble, exactement un voit `1` ligne modifiée. Le test
  /// `lastPulledAt <= maintenant` fait d'un bail périmé un bail libre, sans
  /// balayage de rattrapage.
  Future<DateTime?> _tryAcquire() async {
    final DateTime now = _clock.now();
    final DateTime expiry = now.add(leaseDuration);

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
                  (t.lastPulledAt.isNull() | t.lastPulledAt.isSmallerOrEqualValue(now)),
            ))
            .write(SyncStateCompanion(lastPulledAt: Value<DateTime?>(expiry)));
    return changed == 1 ? expiry : null;
  }

  /// Libère **son** bail, et uniquement le sien.
  ///
  /// ═══ CE QUE LA VERSION SANS PORTÉE CASSAIT ═══
  ///
  /// `_release` effaçait `lastPulledAt` sans vérifier à qui il appartenait. Sur
  /// un renouvellement plus long que le bail : ce qui arrivait, le bail étant
  /// plus court que le budget réseau : l'isolat B reprenait le verrou pendant
  /// que A était encore en vol ; puis le `finally` de A effaçait le bail DE B.
  /// Un troisième renouvellement partait alors en parallèle de celui de B, le
  /// serveur voyait deux fois le même jeton de renouvellement, révoquait toute
  /// la famille (`REFRESH_TOKEN_REPLAYED`), et le commercial était déconnecté en
  /// pleine tournée.
  ///
  /// La clause `lastPulledAt = <mon échéance>` rend l'opération inoffensive dans
  /// ce cas : zéro ligne modifiée, le bail d'en face reste debout.
  Future<void> _release(DateTime mine) async {
    await (_db.update(_db.syncState)..where(
          (SyncState t) =>
              t.collection.equals(lockKey) & t.lastPulledAt.equals(mine),
        ))
        .write(const SyncStateCompanion(lastPulledAt: Value<DateTime?>(null)));
  }
}
