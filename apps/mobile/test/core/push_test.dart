import 'dart:io';

import 'package:cpi_go/core/push/push_inbox_store.dart';
import 'package:cpi_go/core/push/push_message.dart';
import 'package:cpi_go/core/push/push_transport.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';

void main() {
  // ───────────────────────────────────────────────────────────────────────────
  group('pureté de lib/core/push', () {
    // Même contrainte que `lib/core/sync/`, vérifiée mécaniquement plutôt que
    // par revue : le gestionnaire d'arrière-plan de FCM tourne dans un isolat
    // neuf, sans arbre de widgets et sans conteneur Riverpod. Un import Flutter
    // glissé ici ne casserait rien avant la production, sur un téléphone en
    // veille — c'est-à-dire là où personne ne lit les journaux.
    test('aucun fichier n\'importe flutter ni flutter_riverpod', () {
      final Directory dir = Directory('lib/core/push');
      expect(dir.existsSync(), isTrue, reason: 'exécuter depuis apps/mobile');

      final List<String> offenders = <String>[];
      for (final FileSystemEntity entity in dir.listSync(recursive: true)) {
        if (entity is! File || !entity.path.endsWith('.dart')) continue;
        for (final String line in entity.readAsLinesSync()) {
          final String trimmed = line.trim();
          if (!trimmed.startsWith('import ') && !trimmed.startsWith('export ')) {
            continue;
          }
          if (trimmed.contains('package:flutter/') ||
              trimmed.contains('package:flutter_riverpod/') ||
              trimmed.contains('package:flutter_localizations/') ||
              trimmed.contains('package:drift_flutter/') ||
              trimmed.contains('package:flutter_secure_storage/') ||
              trimmed.contains('package:shared_preferences/')) {
            offenders.add('${entity.path}: $trimmed');
          }
        }
      }
      expect(offenders, isEmpty);
    });

    test('le gestionnaire d\'arrière-plan porte son annotation d\'entrée', () {
      // Sans `@pragma('vm:entry-point')`, l'arbre-secoueur AOT supprime la
      // fonction : tout marche en debug et rien ne marche en release, ce qui
      // est le pire mode de défaillance possible.
      final String source = File('lib/core/push/push_background.dart').readAsStringSync();
      expect(source, contains("@pragma('vm:entry-point')"));
      expect(source, contains('DartPluginRegistrant.ensureInitialized()'));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('analyse d’un message', () {
    test('lit l’identifiant, le titre et la route', () {
      final PushMessage? message = PushMessage.fromData(
        <String, String>{
          'notificationId': 'ntf-1',
          'route': '/phase2',
          'category': 'RAPPEL',
        },
        notificationTitle: 'Appels en attente',
        notificationBody: 'Il vous reste 3 fiches.',
      );

      expect(message, isNotNull);
      expect(message!.id, 'ntf-1');
      expect(message.title, 'Appels en attente');
      expect(message.route, '/phase2');
      expect(message.category, 'RAPPEL');
    });

    test('ignore un message sans identifiant', () {
      // Sans identifiant il n'y a rien à dédupliquer ni à marquer lu : une
      // ligne fantôme dans la boîte de réception vaut moins que rien.
      expect(PushMessage.fromData(<String, String>{'route': '/phase2'}), isNull);
      expect(PushMessage.fromData(<String, String>{'notificationId': ''}), isNull);
    });

    test('retombe sur `data` quand le bloc notification est absent', () {
      final PushMessage? message = PushMessage.fromData(<String, String>{
        'notificationId': 'ntf-2',
        'title': 'Depuis data',
        'body': 'Corps',
      });
      expect(message!.title, 'Depuis data');
    });
  });

  group('sûreté des routes', () {
    test('accepte une route interne', () {
      expect(PushMessage.isSafeRoute('/phase2'), isTrue);
      expect(PushMessage.isSafeRoute('/a-corriger'), isTrue);
      expect(PushMessage.isSafeRoute('/phase2?phone=%2B221771234567'), isTrue);
    });

    test('REFUSE une adresse web', () {
      // Une notification porte le nom et l'icône de CPI GO ; l'utilisateur ne
      // peut pas inspecter la destination avant d'appuyer. Laisser passer un
      // `https://` ferait de chaque envoi un vecteur d'hameçonnage crédible.
      expect(PushMessage.isSafeRoute('https://exemple.test/piege'), isFalse);
      expect(PushMessage.isSafeRoute('http://exemple.test'), isFalse);
    });

    test('refuse une URL relative au protocole', () {
      // `//evil.test` est une URL complète pour un navigateur.
      expect(PushMessage.isSafeRoute('//exemple.test'), isFalse);
    });

    test('refuse une route vide, nulle ou sans barre oblique', () {
      expect(PushMessage.isSafeRoute(null), isFalse);
      expect(PushMessage.isSafeRoute(''), isFalse);
      expect(PushMessage.isSafeRoute('phase2'), isFalse);
    });

    test('une route refusée est EFFACÉE, pas conservée', () {
      final PushMessage? message = PushMessage.fromData(<String, String>{
        'notificationId': 'ntf-3',
        'route': 'https://exemple.test',
      });
      // La garder « au cas où » reposerait la question de sa validité à chaque
      // tap, dans un code qui n'a plus le contexte pour y répondre.
      expect(message!.route, isNull);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('boîte de réception locale', () {
    late AppDatabase db;
    late PushInboxStore store;

    setUp(() async {
      db = await openTestDatabase();
      store = PushInboxStore(db);
    });

    tearDown(() async => db.close());

    PushMessage message(String id, {String? route, DateTime? at}) => PushMessage(
      id: id,
      title: 'Titre $id',
      body: 'Corps $id',
      category: 'ANNONCE',
      route: route,
      sentAt: at ?? t0,
    );

    test('enregistre un message et le compte comme non lu', () async {
      await store.upsert(message('ntf-1'));
      expect(await store.watchUnreadCount().first, 1);
    });

    test('une remise en double ne crée QU’UNE ligne', () async {
      // FCM remet volontiers le même message après une reprise de connexion.
      // Deux lignes fausseraient le compteur de non-lues, qui est la seule
      // chose que l'utilisateur regarde.
      await store.upsert(message('ntf-1'));
      await store.upsert(message('ntf-1'));
      expect(await store.watchAll().first, hasLength(1));
      expect(await store.watchUnreadCount().first, 1);
    });

    test(
      'une remise en double NE REND PAS une notification lue à nouveau non lue',
      () async {
        await store.upsert(message('ntf-1'));
        await store.markRead('ntf-1');
        await store.upsert(message('ntf-1'));

        // Sans cette garantie, la pastille remonte toute seule et l'utilisateur
        // cesse de lui faire confiance.
        expect(await store.watchUnreadCount().first, 0);
      },
    );

    test('la lecture est idempotente : la première l’emporte', () async {
      final DateTime first = t0;
      final DateTime later = t0.add(const Duration(hours: 3));

      await store.upsert(message('ntf-1'));
      await store.markRead('ntf-1', at: first);
      await store.markRead('ntf-1', at: later);

      final StoredNotification? row = await store.byId('ntf-1');
      expect(row!.readAt, first);
    });

    test('tout marquer comme lu vide le compteur', () async {
      await store.upsert(message('a'));
      await store.upsert(message('b'));
      await store.markAllRead();
      expect(await store.watchUnreadCount().first, 0);
    });

    test('la liste est ordonnée par date d’ENVOI, pas de réception', () async {
      // Un téléphone éteint reçoit tout d'un coup au rallumage ; l'ordre
      // d'affichage doit rester celui dans lequel les messages ont été émis.
      await store.upsert(message('vieux', at: t0));
      await store.upsert(message('recent', at: t0.add(const Duration(days: 2))));

      final List<StoredNotification> rows = await store.watchAll().first;
      expect(rows.map((StoredNotification r) => r.id), <String>['recent', 'vieux']);
    });

    test('la fusion serveur garde la lecture LOCALE la plus ancienne', () async {
      final DateTime localRead = t0;
      final DateTime serverRead = t0.add(const Duration(hours: 5));

      await store.upsert(message('ntf-1'));
      await store.markRead('ntf-1', at: localRead);

      await store.upsertAll(
        <PushMessage>[message('ntf-1')],
        readStates: <String, DateTime?>{'ntf-1': serverRead},
      );

      expect((await store.byId('ntf-1'))!.readAt, localRead);
    });

    test('la fusion serveur applique une lecture faite ailleurs', () async {
      await store.upsert(message('ntf-1'));
      await store.upsertAll(
        <PushMessage>[message('ntf-1')],
        readStates: <String, DateTime?>{'ntf-1': t0},
      );

      expect(await store.watchUnreadCount().first, 0);
    });

    test('la purge efface tout — le téléphone est personnel', () async {
      await store.upsert(message('a'));
      await store.purge();
      expect(await store.watchAll().first, isEmpty);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('transport de test', () {
    test('le message de lancement n’est consommé qu’UNE fois', () async {
      final FakePushTransport transport = FakePushTransport(
        launchMessage: PushMessage(
          id: 'ntf-1',
          title: 't',
          body: 'b',
          category: 'ANNONCE',
          route: '/phase2',
          sentAt: t0,
        ),
      );

      expect(await transport.initialMessage(), isNotNull);
      // Le rejouer produirait une redirection surprise à chaque reprise.
      expect(await transport.initialMessage(), isNull);
      await transport.dispose();
    });

    test('un transport indisponible ne rend ni jeton ni autorisation', () async {
      final FakePushTransport transport = FakePushTransport(available: false);
      expect(await transport.initialize(), isFalse);
      expect(await transport.token(), isNull);
      expect(await transport.requestPermission(), PushPermission.unavailable);
      await transport.dispose();
    });

    test('le transport inerte ne lève jamais', () async {
      const NullPushTransport transport = NullPushTransport();
      expect(await transport.initialize(), isFalse);
      expect(transport.isAvailable, isFalse);
      expect(await transport.token(), isNull);
      expect(await transport.initialMessage(), isNull);
      expect(await transport.currentPermission(), PushPermission.unavailable);
      await transport.deleteToken();
      expect(await transport.foregroundMessages.isEmpty, isTrue);
    });
  });
}
