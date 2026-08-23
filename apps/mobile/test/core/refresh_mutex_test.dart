import 'dart:async';
import 'package:cpi_go/core/network/auth_interceptor.dart';
import 'package:cpi_go/core/network/refresh_mutex.dart';
import 'package:cpi_go/core/network/timeout_profile.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/local/refresh_mutex_db.dart';
import 'package:dio/dio.dart';
// `isNotNull` existe des deux côtés : ici on parle du matcher, pas d'une
// expression SQL.
import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';

/// Le bug que ces tests verrouillent : l'isolat UI et celui de WorkManager
/// présentaient le même jeton de renouvellement en même temps, le serveur y
/// voyait un rejeu et révoquait toute la famille : déconnexion en pleine
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

      expect(
        maxInFlight,
        1,
        reason: 'les deux renouvellements se sont croisés',
      );
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

    test(
      'un bail périmé est repris sans balayage, un bail vivant ne l\'est pas',
      () async {
        // ═══ POURQUOI L'ANCIENNE VERSION NE PROUVAIT RIEN ═══
        //
        // Elle vérifiait seulement que le corps s'exécutait. Or `protect` exécute
        // le corps MÊME QUAND IL N'A PAS OBTENU LE VERROU (`_acquire` rend `null`
        // au bout de `maxWait`, et l'appelant tente quand même). Le test passait
        // donc à l'identique avec une reprise de bail complètement cassée : il
        // aurait simplement attendu 95 s avant de rendre vert.
        //
        // On observe maintenant le BAIL lui-même, qui est la seule chose que la
        // reprise change.
        Future<DateTime?> lease() async {
          final SyncStateData? row =
              await (db.select(db.syncState)..where(
                    (SyncState t) =>
                        t.collection.equals(DatabaseRefreshMutex.lockKey),
                  ))
                  .getSingleOrNull();
          return row?.lastPulledAt;
        }

        // Un bail que personne ne rendra : l'isolat tué en vol. Il est POSÉ (la
        // ligne existe, la date est dans le passé), donc reprenable.
        final DatabaseRefreshMutex owner = DatabaseRefreshMutex(db);
        await owner.protect<void>(() async {});
        await (db.update(db.syncState)..where(
              (SyncState t) =>
                  t.collection.equals(DatabaseRefreshMutex.lockKey),
            ))
            .write(
              SyncStateCompanion(
                lastPulledAt: Value<DateTime?>(
                  DateTime.now().subtract(const Duration(seconds: 5)),
                ),
              ),
            );

        // `maxWait` nul : si la reprise ne marche pas, `_acquire` renonce
        // immédiatement, le corps s'exécute quand même, et le bail périmé reste
        // en place. C'est ce que le test regarde.
        final DatabaseRefreshMutex next = DatabaseRefreshMutex(
          db,
          maxWait: Duration.zero,
        );
        DateTime? insideLease;
        await next.protect<void>(() async => insideLease = await lease());

        expect(
          insideLease,
          isNotNull,
          reason:
              'le bail périmé n\'a pas été repris : rien ne protège l\'appel',
        );
        expect(
          insideLease!.isAfter(
            DateTime.now().subtract(const Duration(seconds: 1)),
          ),
          isTrue,
          reason: 'le bail posé doit être NEUF, pas celui de l\'isolat mort',
        );
        // Rendu en sortie : c'est la contrepartie de la reprise.
        expect(await lease(), isNull);
      },
    );

    test('un bail VIVANT n\'est pas volé', () async {
      final DatabaseRefreshMutex owner = DatabaseRefreshMutex(db);
      await owner.protect<void>(() async {});
      final DateTime aliveUntil = DateTime.now().add(
        const Duration(minutes: 5),
      );
      await (db.update(db.syncState)..where(
            (SyncState t) => t.collection.equals(DatabaseRefreshMutex.lockKey),
          ))
          .write(
            SyncStateCompanion(lastPulledAt: Value<DateTime?>(aliveUntil)),
          );

      final DatabaseRefreshMutex intruder = DatabaseRefreshMutex(
        db,
        maxWait: Duration.zero,
      );
      // ═══ LE CORPS S'EXÉCUTAIT SANS LE VERROU ═══
      //
      // `protect` renonçait au bout de `maxWait` puis appelait le corps quand
      // même : un second renouvellement partait en parallèle de celui d'en
      // face, c'est-à-dire exactement le rejeu que ce verrou existe pour
      // empêcher.
      bool ran = false;
      await expectLater(
        intruder.protect<void>(() async => ran = true),
        throwsA(isA<RefreshLockBusy>()),
      );
      expect(ran, isFalse);

      final SyncStateData? row =
          await (db.select(db.syncState)..where(
                (SyncState t) =>
                    t.collection.equals(DatabaseRefreshMutex.lockKey),
              ))
              .getSingleOrNull();
      expect(
        row?.lastPulledAt,
        aliveUntil,
        reason:
            'ni pris, ni libéré : effacer le bail d\'en face fait repartir un '
            'troisième renouvellement en parallèle, et le serveur révoque toute '
            'la famille de jetons',
      );
    });

    test('un isolat en retard n\'efface pas le bail de son successeur', () async {
      // ═══ LE SCÉNARIO QUI DÉCONNECTAIT EN PLEINE TOURNÉE ═══
      //
      // A prend un bail trop court pour son propre renouvellement (c'était le
      // cas : 30 s de bail pour 75 s de budget réseau). Le bail expire, B le
      // reprend légitimement. Puis le `finally` de A efface `lastPulledAt` sans
      // regarder à qui il appartient : le verrou de B saute, un troisième
      // renouvellement part en parallèle du sien, le serveur voit un rejeu et
      // révoque la famille de jetons.
      final DatabaseRefreshMutex late = DatabaseRefreshMutex(
        db,
        leaseDuration: const Duration(milliseconds: 20),
      );
      final DatabaseRefreshMutex next = DatabaseRefreshMutex(db);

      final Completer<void> bHolds = Completer<void>();
      final Completer<void> bMayFinish = Completer<void>();

      final Future<void> a = late.protect<void>(() async {
        // Le bail de A expire pendant qu'il est encore en vol.
        await Future<void>.delayed(const Duration(milliseconds: 60));
        // B reprend le bail périmé, légitimement.
        unawaited(
          next.protect<void>(() async {
            bHolds.complete();
            await bMayFinish.future;
          }),
        );
        await bHolds.future;
        // … puis A rend la main : son `finally` va s'exécuter.
      });

      await a;

      // Le bail de B doit être INTACT : c'est lui qui empêche un troisième
      // renouvellement de partir en parallèle du sien.
      final SyncStateData row =
          await (db.select(db.syncState)..where(
                (SyncState t) =>
                    t.collection.equals(DatabaseRefreshMutex.lockKey),
              ))
              .getSingle();
      expect(
        row.lastPulledAt,
        isNotNull,
        reason: 'A a effacé un bail qui ne lui appartenait pas',
      );

      bMayFinish.complete();
    });

    test('le bail couvre le pire budget réseau d\'un renouvellement', () {
      // Le renouvellement est maintenant RÉESSAYÉ : le bail doit couvrir toutes
      // les tentatives, sans quoi il expire pendant le renouvellement qu'il
      // protège et fabrique lui-même le rejeu qu'il devait empêcher.
      const TimeoutProfile profile = TimeoutProfile.refresh;
      final Duration perAttempt =
          profile.connect! + profile.send! + profile.receive;
      final AuthInterceptor interceptor = AuthInterceptor(
        tokens: InMemoryTokenStore(refreshToken: 'r'),
        replayDio: Dio(),
        refreshCall: (String _) async =>
            const RefreshedTokens(accessToken: 'a', refreshToken: 'r'),
      );
      Duration budget = perAttempt * interceptor.refreshAttempts;
      for (int attempt = 1; attempt < interceptor.refreshAttempts; attempt++) {
        budget += interceptor.refreshRetryDelay * attempt;
      }

      final DatabaseRefreshMutex mutex = DatabaseRefreshMutex(db);
      expect(mutex.leaseDuration, greaterThan(budget));
      // Renoncer à attendre avant l'expiration du bail d'en face reviendrait à
      // renouveler en parallèle : exactement ce qu'on évite.
      expect(mutex.maxWait, greaterThan(mutex.leaseDuration));
    });

    test('NoRefreshMutex exécute sans verrouiller', () async {
      const NoRefreshMutex mutex = NoRefreshMutex();
      expect(await mutex.protect<int>(() async => 7), 7);
    });
  });
}
