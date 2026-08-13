import 'package:cpi_go/core/network/refresh_mutex.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/local/refresh_mutex_db.dart';
import 'package:drift/drift.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';

/// Le bug que ces tests verrouillent : l'isolat UI et celui de WorkManager
/// présentaient le même jeton de renouvellement en même temps, le serveur y
/// voyait un rejeu et révoquait toute la famille — déconnexion en pleine
/// tournée. Le vol unique de `AuthInterceptor` ne pouvait rien : c'est un champ
/// d'instance, donc un garde par isolat.
void main() {
  group('DatabaseRefreshMutex', () {
    late AppDatabase db;

    setUp(() async => db = await openTestDatabase());
    tearDown(() async => db.close());

    test('sérialise deux renouvellements concurrents', () async {
      final DatabaseRefreshMutex a = DatabaseRefreshMutex(db);
      final DatabaseRefreshMutex b = DatabaseRefreshMutex(db);

      // Le compteur mesure ce qui compte vraiment : deux corps ne doivent
      // JAMAIS être en vol ensemble, puisque c'est cette simultanéité que le
      // serveur lit comme un rejeu.
      int inFlight = 0;
      int maxInFlight = 0;
      final List<String> order = <String>[];

      Future<void> body(String name) async {
        inFlight++;
        maxInFlight = maxInFlight > inFlight ? maxInFlight : inFlight;
        // Un aller-retour réseau, en miniature : c'est pendant cette fenêtre
        // que l'autre isolat passait.
        await Future<void>.delayed(const Duration(milliseconds: 40));
        order.add(name);
        inFlight--;
      }

      await Future.wait<void>(<Future<void>>[
        a.protect(() => body('ui')),
        b.protect(() => body('worker')),
      ]);

      expect(maxInFlight, 1, reason: 'les deux renouvellements se sont croisés');
      expect(order, hasLength(2));
    });

    test('libère le verrou même si le renouvellement échoue', () async {
      final DatabaseRefreshMutex mutex = DatabaseRefreshMutex(db);

      await expectLater(
        mutex.protect<void>(() async => throw const FormatException('réseau')),
        throwsA(isA<FormatException>()),
      );

      // Sans libération en `finally`, un échec réseau ponctuel condamnerait
      // définitivement tout renouvellement ultérieur : session morte jusqu'à
      // réinstallation.
      bool ran = false;
      await mutex.protect<void>(() async => ran = true);
      expect(ran, isTrue);
    });

    test('un bail périmé est repris sans balayage', () async {
      // Bail très court : simule l'isolat tué en vol, qui ne libère jamais.
      final DatabaseRefreshMutex abandoned = DatabaseRefreshMutex(
        db,
        leaseDuration: const Duration(milliseconds: 30),
      );
      final DatabaseRefreshMutex next = DatabaseRefreshMutex(db);

      // On sème la ligne, puis on repose à la main un bail que personne ne
      // rendra — l'isolat tué en vol. API typée et non SQL brut : le format de
      // stockage des dates appartient à drift, pas au test.
      await abandoned.protect<void>(() async {});
      await (db.update(
        db.syncState,
      )..where((SyncState t) => t.collection.equals(DatabaseRefreshMutex.lockKey))).write(
        SyncStateCompanion(
          lastPulledAt: Value<DateTime?>(
            DateTime.now().add(const Duration(milliseconds: 30)),
          ),
        ),
      );

      bool ran = false;
      await next.protect<void>(() async => ran = true);
      expect(ran, isTrue);
    });

    test('NoRefreshMutex exécute sans verrouiller', () async {
      const NoRefreshMutex mutex = NoRefreshMutex();
      expect(await mutex.protect<int>(() async => 7), 7);
    });
  });
}
