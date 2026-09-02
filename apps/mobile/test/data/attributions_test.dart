import 'package:cpi_go/core/sync/api_port.dart' show attributionBorne;
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/reference_repository.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';

/// Le périmètre d'appel : le pull de synchronisation est GLOBAL, c'est le
/// téléphone qui borne ce qu'un téléconseiller voit.
void main() {
  late AppDatabase db;
  late ReferenceRepository repo;

  setUp(() async {
    db = await openTestDatabase();
    repo = ReferenceRepository(db);
    await insertRepresentant(
      db,
      id: 'rep-moi',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
      createdById: 'u-1',
    );
    await insertRepresentant(
      db,
      id: 'rep-attribue',
      phone: '+221770000002',
      fullName: 'Fatou Fall',
      createdById: 'u-2',
    );
    await insertRepresentant(
      db,
      id: 'rep-collegue',
      phone: '+221770000003',
      fullName: 'Aminata Fall',
      createdById: 'u-2',
    );
  });

  tearDown(() => db.close());

  Future<void> borner({List<String> representants = const <String>[]}) async {
    await db
        .into(db.attributions)
        .insert(AttributionsCompanion.insert(kind: attributionBorne, id: '1'));
    for (final String id in representants) {
      await db
          .into(db.attributions)
          .insert(AttributionsCompanion.insert(kind: 'representant', id: id));
    }
  }

  Future<List<String>> chercher() async {
    final List<RepresentantSyncViewData> rows = await repo
        .watchRepresentants(search: 'Fall', moi: 'u-1')
        .first;
    return rows.map((RepresentantSyncViewData r) => r.id).toList()..sort();
  }

  test('sans marqueur, rien n\'est filtré', () async {
    expect(await chercher(), <String>[
      'rep-attribue',
      'rep-collegue',
      'rep-moi',
    ]);
  });

  test('borné, je vois mes fiches et celles qu\'on m\'attribue', () async {
    await borner(representants: <String>['rep-attribue']);

    expect(await chercher(), <String>['rep-attribue', 'rep-moi']);
  });

  // L'encadrement ne pose pas le marqueur : le filtre n'existe alors pas.
  test('sans le marqueur, une attribution vide ne cache rien', () async {
    await db
        .into(db.attributions)
        .insert(
          AttributionsCompanion.insert(kind: 'representant', id: 'rep-moi'),
        );

    expect(await chercher(), <String>[
      'rep-attribue',
      'rep-collegue',
      'rep-moi',
    ]);
  });

  test('le même périmètre borne les prospects du Grand Public', () async {
    for (final (String id, String phone, String par)
        in <(String, String, String)>[
          ('pro-moi', '+221780000001', 'u-1'),
          ('pro-attribue', '+221780000002', 'u-2'),
          ('pro-collegue', '+221780000003', 'u-2'),
        ]) {
      await db
          .into(db.prospects)
          .insert(
            ProspectsCompanion.insert(
              id: id,
              nom: 'Sarr',
              prenom: 'Awa',
              phoneE164: phone,
              projet: const Value<String>('GRAND_PUBLIC'),
              createdById: par,
              clientCreatedAt: t0,
              localUpdatedAt: t0,
            ),
          );
      await db
          .into(db.prospectJourneys)
          .insert(
            ProspectJourneysCompanion.insert(
              prospectId: id,
              projet: 'GRAND_PUBLIC',
            ),
          );
    }
    await db
        .into(db.attributions)
        .insert(AttributionsCompanion.insert(kind: attributionBorne, id: '1'));
    await db
        .into(db.attributions)
        .insert(
          AttributionsCompanion.insert(kind: 'prospect', id: 'pro-attribue'),
        );

    final List<ProspectSyncViewData> rows = await repo
        .watchAllProspects(projet: 'GRAND_PUBLIC', moi: 'u-1')
        .first;

    expect(
      (rows.map((ProspectSyncViewData p) => p.id).toList()..sort()),
      <String>['pro-attribue', 'pro-moi'],
    );
  });
}
