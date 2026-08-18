import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/reference_repository.dart';
import 'package:drift/drift.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';

/// La cascade région → département.
///
/// La plainte du terrain : « elle a tapé Tambacounda pour le département, ça
/// devrait montrer la liste des départements DE Tambacounda ». Une liste plate
/// de 46 entrées oblige à connaître le nom exact avant de chercher.
void main() {
  late AppDatabase db;
  late ReferenceRepository repo;

  Future<void> seedDepartement({
    required String id,
    required String name,
    required String regionId,
    String regionName = '',
  }) {
    return db
        .into(db.departements)
        .insert(
          DepartementsCompanion.insert(
            id: id,
            code: id.toUpperCase(),
            name: name,
            regionId: regionId,
            regionName: Value<String>(regionName),
            localUpdatedAt: t0,
          ),
        );
  }

  setUp(() async {
    db = await openTestDatabase();
    repo = ReferenceRepository(db);
    await (db.delete(db.departements)).go();
    await seedDepartement(
      id: 'dep-bakel',
      name: 'Bakel',
      regionId: 'reg-tc',
      regionName: 'Tambacounda',
    );
    await seedDepartement(
      id: 'dep-tamba',
      name: 'Tambacounda',
      regionId: 'reg-tc',
      regionName: 'Tambacounda',
    );
    await seedDepartement(
      id: 'dep-mbour',
      name: 'Mbour',
      regionId: 'reg-th',
      regionName: 'Thiès',
    );
  });
  tearDown(() => db.close());

  test('une région ne paraît qu\'une fois, quel que soit son nombre de '
      'départements', () async {
    final List<Region> regions = await repo.watchRegions().first;

    expect(regions.map((Region r) => r.name), <String>['Tambacounda', 'Thiès']);
    expect(regions.first.id, 'reg-tc');
  });

  test('choisir Tambacounda ne laisse que les départements de Tambacounda', () async {
    final List<Departement> filtres = await repo
        .watchDepartements(regionId: 'reg-tc')
        .first;

    expect(filtres.map((Departement d) => d.name), <String>['Bakel', 'Tambacounda']);
  });

  test('sans région, la liste reste complète', () async {
    final List<Departement> tous = await repo.watchDepartements().first;

    expect(tous, hasLength(3));
  });

  // Un appareil qui n'a pas encore rejoué le pull complet du palier v8 porte des
  // départements sans libellé de région. Les rendre quand même afficherait une
  // ligne vide et un filtre qui ne filtre rien.
  test('un département sans libellé de région ne fabrique pas de région', () async {
    await (db.delete(db.departements)).go();
    await seedDepartement(id: 'dep-1', name: 'Dakar', regionId: 'reg-dk');

    expect(await repo.watchRegions().first, isEmpty);
    expect(await repo.watchDepartements().first, hasLength(1));
  });
}
