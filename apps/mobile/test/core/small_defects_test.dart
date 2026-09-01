import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/utils/relative_time.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/reference_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../support/db_fixture.dart';

void main() {
  setUpAll(() => initializeDateFormatting('fr'));

  group('temps relatif : une seule copie, et jamais de delta négatif', () {
    final DateTime now = DateTime.utc(2026, 8, 12, 12);

    test('un horodatage FUTUR ne rend plus « il y a -180 min »', () {
      // Le cas réel : l'horodatage vient du SERVEUR, dont l'horloge n'est pas
      // celle du téléphone. Trois heures d'avance suffisaient à afficher un
      // nombre négatif dans les réglages et sur l'écran de phase 2.
      final String label = relativeTime(
        now.add(const Duration(hours: 3)),
        now: now,
      );
      expect(label, 'à l\'instant');
      expect(label, isNot(contains('-')));
    });

    test('les paliers normaux sont inchangés', () {
      expect(
        relativeTime(now.subtract(const Duration(seconds: 20)), now: now),
        'à l\'instant',
      );
      expect(
        relativeTime(now.subtract(const Duration(minutes: 5)), now: now),
        'il y a 5 min',
      );
      expect(
        relativeTime(now.subtract(const Duration(hours: 3)), now: now),
        'il y a 3 h',
      );
      expect(
        relativeTime(now.subtract(const Duration(days: 4)), now: now),
        startsWith('le '),
      );
    });
  });

  group('double appui : un geste, un écran', () {
    setUp(SinglePush.reset);
    tearDown(() => SinglePush.now = DateTime.now);

    test('deux appuis dans la fenêtre ne comptent que pour un', () {
      DateTime clock = DateTime.utc(2026, 8, 12, 9);
      SinglePush.now = () => clock;

      expect(SinglePush.shouldNavigate('/representants'), isTrue);
      // Sur un appareil lent, l'écran ne bouge pas pendant 200 à 400 ms :
      // l'utilisateur réappuie, et `context.push` empilait deux fois la même
      // route. Sur un formulaire, cela ouvrait aussi deux brouillons.
      clock = clock.add(const Duration(milliseconds: 120));
      expect(SinglePush.shouldNavigate('/representants'), isFalse);
    });

    test('deux destinations différentes passent toutes les deux', () {
      DateTime clock = DateTime.utc(2026, 8, 12, 9);
      SinglePush.now = () => clock;

      expect(SinglePush.shouldNavigate('/representants'), isTrue);
      clock = clock.add(const Duration(milliseconds: 50));
      expect(SinglePush.shouldNavigate('/phase2'), isTrue);
    });

    test('passé la fenêtre, la navigation délibérée repart', () {
      DateTime clock = DateTime.utc(2026, 8, 12, 9);
      SinglePush.now = () => clock;

      expect(SinglePush.shouldNavigate('/phase2'), isTrue);
      clock = clock.add(SinglePush.cooldown * 2);
      expect(SinglePush.shouldNavigate('/phase2'), isTrue);
    });

    test('on n\'empile jamais l\'écran déjà ouvert', () {
      expect(
        SinglePush.shouldNavigate('/phase2', currentLocation: '/phase2'),
        isFalse,
      );
    });
  });

  group('flux des représentants : vide tant qu\'on n\'a pas cherché', () {
    late AppDatabase db;
    late ReferenceRepository repo;

    setUp(() async {
      db = await openTestDatabase();
      repo = ReferenceRepository(db);
    });
    tearDown(() => db.close());

    test('sans recherche, la liste est vide même avec des fiches', () async {
      for (int i = 0; i < 12; i++) {
        await insertRepresentant(db, id: 'r$i', phone: '+2217700${1000 + i}');
      }

      final List<RepresentantSyncViewData> vide = await repo
          .watchRepresentants()
          .first;

      expect(vide, isEmpty);
    });

    test('la recherche atteint n\'importe quelle fiche', () async {
      for (int i = 0; i < 12; i++) {
        await insertRepresentant(
          db,
          id: 'r$i',
          phone: '+2217700${1000 + i}',
          fullName: 'Représentant $i',
        );
      }

      final List<RepresentantSyncViewData> found = await repo
          .watchRepresentants(search: 'Représentant 11')
          .first;

      expect(found.map((RepresentantSyncViewData r) => r.id), <String>['r11']);
    });
  });
}
