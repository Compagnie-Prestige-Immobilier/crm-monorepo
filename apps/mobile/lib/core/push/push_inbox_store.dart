import 'package:drift/drift.dart';

import '../../data/local/database.dart';
import 'push_message.dart';

/// Boîte de réception LOCALE.
///
/// **Dart pur** — pas de Flutter, pas de Riverpod. Utilisable depuis l'isolat
/// d'arrière-plan comme depuis l'interface, exactement au même titre que
/// `WriteRepository`.
///
/// Pourquoi stocker localement ce que l'API sait déjà rendre : l'application
/// est hors ligne par conception. Un commercial qui ouvre son centre de
/// notifications dans une zone sans réseau doit y trouver ce qu'il a reçu, pas
/// un indicateur de chargement qui tourne. La liste est donc servie depuis
/// SQLite, et l'API ne fait que la compléter quand elle est joignable.
class PushInboxStore {
  const PushInboxStore(this._db);

  final AppDatabase _db;

  /// Enregistre un message reçu.
  ///
  /// `insertOnConflictUpdate` sur la clé primaire : FCM peut remettre le même
  /// message (reprise de connexion, reprise après veille), et deux lignes pour
  /// une notification produiraient un compteur de non-lues faux.
  ///
  /// **`readAt` n'est jamais écrasé** : une notification déjà lue puis remise
  /// par FCM ne doit pas redevenir non lue, sinon la pastille remonte toute
  /// seule et l'utilisateur cesse de lui faire confiance.
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

  /// Remplace la boîte de réception par ce que le serveur en dit.
  ///
  /// Utilisé après un `GET /notifications/mine`. Les lignes locales absentes de
  /// la réponse sont CONSERVÉES : le serveur pagine, et effacer ce qui ne
  /// figure pas dans la page courante viderait l'historique hors ligne.
  Future<void> upsertAll(Iterable<PushMessage> messages, {Map<String, DateTime?>? readStates}) async {
    await _db.transaction(() async {
      for (final PushMessage message in messages) {
        final StoredNotification? existing = await (_db.select(
          _db.notifications,
        )..where((Notifications t) => t.id.equals(message.id))).getSingleOrNull();

        // Le serveur fait autorité sur l'état lu — il agrège les lectures faites
        // depuis d'autres appareils — mais une lecture LOCALE non encore
        // remontée ne doit pas être perdue. On garde donc la plus ancienne des
        // deux, c'est-à-dire la première lecture réelle.
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

  /// Marque une notification lue. Idempotent : la première lecture est la seule
  /// intéressante et n'est jamais réécrite.
  Future<void> markRead(String id, {DateTime? at}) async {
    await (_db.update(_db.notifications)..where(
      (Notifications t) => t.id.equals(id) & t.readAt.isNull(),
    )).write(NotificationsCompanion(readAt: Value<DateTime?>(at ?? DateTime.now().toUtc())));
  }

  Future<void> markAllRead({DateTime? at}) async {
    await (_db.update(_db.notifications)..where((Notifications t) => t.readAt.isNull())).write(
      NotificationsCompanion(readAt: Value<DateTime?>(at ?? DateTime.now().toUtc())),
    );
  }

  /// Flux de la liste, du plus récent au plus ancien.
  Stream<List<StoredNotification>> watchAll() {
    return (_db.select(_db.notifications)..orderBy(<OrderClauseGenerator<Notifications>>[
      (Notifications t) => OrderingTerm.desc(t.createdAt),
    ])).watch();
  }

  /// Flux du nombre de non-lues. Alimente la pastille de l'AppBar.
  Stream<int> watchUnreadCount() {
    return (_db.select(
      _db.notifications,
    )..where((Notifications t) => t.readAt.isNull())).watch().map((List<StoredNotification> rows) => rows.length);
  }

  Future<StoredNotification?> byId(String id) {
    return (_db.select(
      _db.notifications,
    )..where((Notifications t) => t.id.equals(id))).getSingleOrNull();
  }

  /// Purge complète.
  ///
  /// Appelée à la DÉCONNEXION, au même titre que l'annuaire de phase 2 : le
  /// téléphone est personnel, et les notifications d'un commercial — qui
  /// peuvent nommer des prospects — ne doivent pas survivre à son départ.
  Future<void> purge() async {
    await _db.delete(_db.notifications).go();
  }
}
