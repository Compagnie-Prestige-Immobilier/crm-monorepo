import 'package:cpi_go/core/contacts/contacts_systeme.dart';
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/reference_repository.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Le nom à la sonnerie : le portefeuille du téléconseiller connecté est recopié
/// dans le répertoire du téléphone, et le dialer natif résout le numéro entrant.
///
/// Ce qui se vérifie ici est la frontière Dart : QUOI part vers le canal, et
/// QUAND. La pose du lot `ContentProviderOperation`, l'existence du compte et sa
/// suppression par le fournisseur de contacts ne se prouvent que sur un
/// appareil.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const MethodChannel canal = MethodChannel(ContactsSysteme.canal);
  late AppDatabase db;
  late List<MethodCall> appels;
  bool permission = true;

  setUp(() async {
    db = await openTestDatabase();
    appels = <MethodCall>[];
    permission = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canal, (MethodCall call) async {
          appels.add(call);
          return switch (call.method) {
            'hasPermission' || 'requestPermission' => permission,
            'write' => 12,
            _ => null,
          };
        });
  });

  tearDown(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canal, null);
    await db.close();
  });

  ContactsSysteme build() =>
      ContactsSysteme(database: db, reference: ReferenceRepository(db));

  List<Object?> lotsEcrits() => appels
      .where((MethodCall call) => call.method == 'write')
      .map(
        (MethodCall call) =>
            (call.arguments as Map<Object?, Object?>)['contacts'],
      )
      .toList();

  Future<void> insertProspectDe(
    String createdById, {
    required String id,
    required String phone,
    String nom = 'Sarr',
    String prenom = 'Awa',
  }) {
    return db
        .into(db.prospects)
        .insert(
          ProspectsCompanion.insert(
            id: id,
            nom: nom,
            prenom: prenom,
            phoneE164: phone,
            createdById: createdById,
            clientCreatedAt: t0,
            localUpdatedAt: t0,
          ),
        );
  }

  test('le lot porte le nom et le numéro de la base', () async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
      createdById: 'u-1',
    );
    await insertProspectDe('u-1', id: 'pro-1', phone: '+221780000001');

    await build().rafraichir('u-1');

    expect(lotsEcrits(), <Object>[
      <Object>[
        <String, String>{
          'id': 'rep-1',
          'nom': 'Ousmane Fall',
          'tel': '+221770000001',
        },
        <String, String>{
          'id': 'pro-1',
          'nom': 'Awa Sarr',
          'tel': '+221780000001',
        },
      ],
    ]);
  });

  test('hors périmètre, la fiche d\'un collègue ne part pas', () async {
    await insertRepresentant(
      db,
      id: 'rep-moi',
      phone: '+221770000001',
      createdById: 'u-1',
    );
    await insertRepresentant(
      db,
      id: 'rep-collegue',
      phone: '+221770000002',
      createdById: 'u-2',
    );
    await db
        .into(db.attributions)
        .insert(AttributionsCompanion.insert(kind: 'borne', id: '1'));

    await build().rafraichir('u-1');

    final List<Object?> lot = lotsEcrits().single! as List<Object?>;
    expect(
      lot
          .map((Object? fiche) => (fiche! as Map<Object?, Object?>)['id'])
          .toList(),
      <String>['rep-moi'],
    );
  });

  test('une fiche supprimée quitte le répertoire', () async {
    await insertRepresentant(
      db,
      id: 'rep-parti',
      phone: '+221770000001',
      createdById: 'u-1',
      deletedAt: t0,
    );

    await build().rafraichir('u-1');

    expect(lotsEcrits(), <Object>[<Object>[]]);
  });

  test('sans la permission, rien n\'est écrit', () async {
    permission = false;
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      createdById: 'u-1',
    );

    await build().rafraichir('u-1', demanderLaPermission: true);

    expect(lotsEcrits(), isEmpty);
    expect(
      appels.map((MethodCall call) => call.method),
      <String>['hasPermission', 'requestPermission'],
    );
  });

  test('un portefeuille inchangé n\'est pas réécrit', () async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
      createdById: 'u-1',
    );
    final ContactsSysteme contacts = build();

    await contacts.rafraichir('u-1');
    await contacts.rafraichir('u-1');
    expect(lotsEcrits(), hasLength(1));

    await (db.update(db.representants)
          ..where((Representants t) => t.id.equals('rep-1')))
        .write(
          const RepresentantsCompanion(fullName: Value<String>('Ousmane Faal')),
        );
    await contacts.rafraichir('u-1');

    expect(lotsEcrits(), hasLength(2));
  });

  test('la déconnexion retire le compte du répertoire', () async {
    final ProviderContainer container = ProviderContainer(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(FakeApi()),
        tokenStoreProvider.overrideWithValue(
          InMemoryTokenStore(refreshToken: 'jeton', userId: 'u-1'),
        ),
        clockProvider.overrideWithValue(const SystemClock()),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).signOut();

    expect(
      appels.map((MethodCall call) => call.method),
      contains('clear'),
    );
  });
}
