import 'dart:convert';

import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/telephonie/appels_crm.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/core/telephonie/telephonie_port.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Le journal du téléphone porte tous les appels : ceux du CRM, ceux du
/// téléconseiller, et ceux de n'importe qui. Le balayage n'en retient que ce
/// qui touche une fiche déjà en base, et il ne le retient qu'une fois.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AppDatabase db;
  late SharedPreferences prefs;
  late List<MethodCall> appels;
  List<Map<String, Object?>>? journal;

  final DateTime appelRep = t0.subtract(const Duration(hours: 2));
  final DateTime appelProspect = t0.subtract(const Duration(hours: 1));

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    prefs = await SharedPreferences.getInstance();
    db = await openTestDatabase();
    appels = <MethodCall>[];
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221771234567',
      fullName: 'Awa Diop',
    );
    await insertProspect(
      db,
      id: 'pros-1',
      representantId: 'rep-1',
      phone: '+221780000002',
    );
    journal = <Map<String, Object?>>[
      <String, Object?>{
        'type': 'sortant',
        'at': appelRep.millisecondsSinceEpoch,
        'dureeSecondes': 92,
        // Tel que le journal le rend : composé à la main, sans indicatif.
        'numero': '77 123 45 67',
      },
      <String, Object?>{
        'type': 'entrant',
        'at': appelProspect.millisecondsSinceEpoch,
        'dureeSecondes': 41,
        'numero': '+221780000002',
      },
      <String, Object?>{
        'type': 'manque',
        'at': t0.subtract(const Duration(minutes: 30)).millisecondsSinceEpoch,
        'dureeSecondes': 0,
        'numero': '+221709999999',
      },
    ];

    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(Telephonie.canalParDefaut, (
          MethodCall call,
        ) async {
          appels.add(call);
          return call.method == 'journal' ? journal : null;
        });
  });

  tearDown(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(Telephonie.canalParDefaut, null);
    await db.close();
  });

  ProviderContainer conteneur() {
    final ProviderContainer container = ProviderContainer(
      overrides: <Override>[
        appDatabaseProvider.overrideWithValue(db),
        sharedPreferencesProvider.overrideWithValue(prefs),
        clockProvider.overrideWithValue(FakeClock(t0)),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  Future<int> balayer() =>
      conteneur().read(appelsCrmProvider.notifier).balayerJournal();

  Future<List<PreuvesAppelData>> preuves() => db.select(db.preuvesAppel).get();

  test('deux fiches retrouvées, le numéro inconnu ne laisse rien', () async {
    expect(await balayer(), 2);

    final List<PreuvesAppelData> lignes = await preuves();
    expect(lignes.length, 2);
    expect(lignes.map((PreuvesAppelData p) => p.mode).toSet(), <String>{
      'detecte',
    });
    expect(lignes.map((PreuvesAppelData p) => p.entityId).toSet(), <String>{
      'rep-1',
      'pros-1',
    });
    // L'appel n'a pas été lancé d'ici : son départ est celui du journal, et
    // c'est ce que `preuveAConsommer` lira.
    final PreuvesAppelData rep = lignes.firstWhere(
      (PreuvesAppelData p) => p.kind == 'representant',
    );
    expect(rep.lanceAt, appelRep);
    expect(rep.journalAt, appelRep);
    expect(rep.journalType, 'sortant');
    expect(rep.journalDureeS, 92);
    expect(rep.rapprocheAt, t0);
    expect(rep.attemptId, isNull);
    expect(rep.signaleAt, isNull);

    // Le numéro sans fiche ne laisse AUCUNE trace : ni preuve, ni opération.
    expect(
      lignes.every((PreuvesAppelData p) => p.phoneE164 != '+221709999999'),
      isTrue,
    );
  });

  test('chaque appel retrouvé part au serveur avec son entité', () async {
    await balayer();

    final List<OutboxData> file = (await allOutbox(
      db,
    )).where((OutboxData o) => o.entityType == 'appel_detecte').toList();
    expect(file.length, 2);

    final List<PreuvesAppelData> lignes = await preuves();
    expect(
      file.map((OutboxData o) => o.entityId).toSet(),
      lignes.map((PreuvesAppelData p) => p.id).toSet(),
      reason: 'l\'opération porte l\'identifiant de la preuve',
    );

    final Map<String, Object?> pourRep = file
        .map((OutboxData o) => jsonDecode(o.payload) as Map<String, Object?>)
        .firstWhere((Map<String, Object?> p) => p['representantId'] != null);
    expect(pourRep['representantId'], 'rep-1');
    expect(pourRep['deviceCallType'], 'sortant');
    expect(pourRep['deviceCallDurationSeconds'], 92);
    expect(pourRep['deviceCallAt'], appelRep.toIso8601String());
    expect(pourRep['detectedAt'], t0.toIso8601String());
    expect(pourRep.containsKey('prospectId'), isFalse);

    final OutboxData opProspect = file.firstWhere(
      (OutboxData o) =>
          (jsonDecode(o.payload) as Map<String, Object?>)['prospectId'] != null,
    );
    expect(opProspect.op, 'create');
    expect(
      opProspect.dependencyKey,
      'phase2:pros-1',
      reason: 'la même partition que la tentative du prospect',
    );
    expect(
      (await allOutbox(db))
          .where((OutboxData o) => o.entityType == 'appel_detecte')
          .every((OutboxData o) => o.payloadVersion > 0),
      isTrue,
    );
  });

  // Le DTO engendré est le vrai goulot : une entité que le moteur ne sait pas
  // traduire fait échouer le LOT, et l'appel détecté n'arrive jamais au
  // superviseur.
  test('la file part sur la route de synchronisation ordinaire', () async {
    await balayer();
    final FakeApi api = FakeApi();
    await SyncEngine(
      database: db,
      api: api,
      tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
      clock: FakeClock(t0),
    ).drain();

    final List<SyncOperationDto> envoyees = api.calls
        .expand((PushCall c) => c.operations)
        .where((SyncOperationDto o) => o.entity == SyncEntity.appelDetecte)
        .toList();
    expect(envoyees.length, 2);

    final SyncOperationDto rep = envoyees.firstWhere(
      (SyncOperationDto o) => o.data?.representantId != null,
    );
    expect(rep.op, SyncOp.create);
    expect(rep.data?.deviceCallType?.value, 'sortant');
    expect(rep.data?.deviceCallDurationSeconds, 92);
    expect(rep.data?.deviceCallAt, appelRep);
    expect(rep.data?.detectedAt, t0);
    expect(
      envoyees.any((SyncOperationDto o) => o.data?.prospectId == 'pros-1'),
      isTrue,
    );
  });

  test('un second balayage ne retrouve pas les mêmes appels', () async {
    expect(await balayer(), 2);
    expect(await balayer(), 0);
    expect((await preuves()).length, 2);
  });

  // Le téléconseiller a déjà consigné cet appel à la main : la feuille ne doit
  // pas le lui redemander.
  test('un appel déjà consigné sur la fiche est laissé de côté', () async {
    await (db.update(
      db.representants,
    )..where((Representants t) => t.id.equals('rep-1'))).write(
      RepresentantsCompanion(
        lastCallAt: Value<DateTime?>(appelRep.add(const Duration(minutes: 20))),
      ),
    );

    expect(await balayer(), 1);
    expect(
      (await preuves()).single.entityId,
      'pros-1',
      reason: 'seul le prospect reste à consigner',
    );
  });

  test('une tentative saisie couvre l\'appel du prospect', () async {
    await db
        .into(db.callAttempts)
        .insert(
          CallAttemptsCompanion.insert(
            id: 'att-1',
            prospectId: 'pros-1',
            outcome: 'UNREACHABLE',
            clientCreatedAt: appelProspect.add(const Duration(minutes: 3)),
            createdById: 'me',
          ),
        );

    expect(await balayer(), 1);
    expect((await preuves()).single.entityId, 'rep-1');
  });

  // Sans l'autorisation le canal rend une liste vide : rien ne se passe, et
  // surtout rien ne casse.
  test('sans autorisation sur le journal, le balayage ne fait rien', () async {
    journal = null;

    expect(await balayer(), 0);
    expect(await preuves(), isEmpty);
    expect(await allOutbox(db), isEmpty);
    expect(
      appels.map((MethodCall c) => c.method),
      contains('journal'),
      reason: 'le canal est bien sollicité',
    );
  });

  test('le balayage demande tout le journal, pas un numéro', () async {
    await balayer();

    final MethodCall demande = appels.firstWhere(
      (MethodCall c) => c.method == 'journal',
    );
    final Map<Object?, Object?> args =
        demande.arguments as Map<Object?, Object?>;
    expect(args.containsKey('e164'), isFalse);
    expect(
      args['depuisMillis'],
      t0.subtract(const Duration(days: 7)).millisecondsSinceEpoch,
    );
  });
}
