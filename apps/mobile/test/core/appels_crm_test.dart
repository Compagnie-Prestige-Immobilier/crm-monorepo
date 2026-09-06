import 'dart:convert';

import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/telephonie/appels_crm.dart';
import 'package:cpi_go/core/telephonie/telephonie_port.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';

/// L'appel lancé depuis une fiche laisse une trace, et cette trace n'est PAS le
/// témoignage du téléconseiller : c'est ce que le journal du téléphone a
/// inscrit. Ces tests tiennent les deux bouts, du bouton jusqu'aux clés du
/// payload envoyé au serveur.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AppDatabase db;
  late List<MethodCall> appels;
  late List<String> presses;
  String mode = 'call';
  List<Map<String, Object?>> journal = <Map<String, Object?>>[];

  setUp(() async {
    db = await openTestDatabase();
    appels = <MethodCall>[];
    presses = <String>[];
    mode = 'call';
    journal = <Map<String, Object?>>[];

    await insertRepresentant(db, id: 'rep-1', phone: '+221771234567');
    await insertProspect(
      db,
      id: 'pros-1',
      representantId: 'rep-1',
      phone: '+221780000002',
    );

    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(Telephonie.canalParDefaut, (
          MethodCall call,
        ) async {
          appels.add(call);
          return switch (call.method) {
            'appeler' => mode,
            'journal' => journal,
            _ => null,
          };
        });
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (
          MethodCall call,
        ) async {
          if (call.method == 'Clipboard.setData') {
            presses.add(
              (call.arguments as Map<Object?, Object?>)['text']! as String,
            );
          }
          return null;
        });
  });

  tearDown(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      ..setMockMethodCallHandler(Telephonie.canalParDefaut, null)
      ..setMockMethodCallHandler(SystemChannels.platform, null);
    await db.close();
  });

  /// Monte de quoi appeler : un contexte pour le repli presse-papiers, et le
  /// `ref` qui porte le notifier.
  Future<({BuildContext context, WidgetRef ref})> monter(
    WidgetTester tester,
  ) async {
    late BuildContext contexte;
    late WidgetRef reference;
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          appDatabaseProvider.overrideWithValue(db),
          clockProvider.overrideWithValue(FakeClock(t0)),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: Consumer(
              builder: (BuildContext c, WidgetRef r, Widget? _) {
                contexte = c;
                reference = r;
                return const SizedBox();
              },
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    return (context: contexte, ref: reference);
  }

  Future<PreuvesAppelData?> preuve() =>
      db.select(db.preuvesAppel).getSingleOrNull();

  Map<String, Object?> dernierPayload(List<OutboxData> file) =>
      jsonDecode(file.last.payload) as Map<String, Object?>;

  testWidgets('le composeur du téléphone laisse la même trace qu\'un appel', (
    WidgetTester tester,
  ) async {
    mode = 'dial';
    final ({BuildContext context, WidgetRef ref}) monte = await monter(tester);

    await monte.ref
        .read(appelsCrmProvider.notifier)
        .lancer(
          monte.context,
          kind: 'representant',
          id: 'rep-1',
          e164: '+221771234567',
        );

    expect(
      appels.map((MethodCall c) => c.method),
      contains('appeler'),
      reason: 'le canal natif est sollicité',
    );
    final PreuvesAppelData ligne = (await preuve())!;
    expect(ligne.mode, 'dial');
    expect(ligne.kind, 'representant');
    expect(ligne.entityId, 'rep-1');
    expect(ligne.lanceAt, t0);
    expect(ligne.journalAt, isNull);
    expect(presses, isEmpty);
  });

  // Sans application capable de composer, un bouton qui ne fait rien vaut moins
  // qu'un numéro dans le presse-papiers.
  testWidgets('aucun composeur : le numéro part au presse-papiers', (
    WidgetTester tester,
  ) async {
    mode = 'aucun';
    final ({BuildContext context, WidgetRef ref}) monte = await monter(tester);

    await monte.ref
        .read(appelsCrmProvider.notifier)
        .lancer(
          monte.context,
          kind: 'prospect',
          id: 'pros-1',
          e164: '+221780000002',
        );

    expect(presses, <String>['+221780000002']);
    expect((await preuve())!.mode, 'aucun');
  });

  testWidgets('le journal du téléphone confirme l\'appel lancé', (
    WidgetTester tester,
  ) async {
    journal = <Map<String, Object?>>[
      <String, Object?>{
        'type': 'sortant',
        'at': t0.add(const Duration(minutes: 1)).millisecondsSinceEpoch,
        'dureeSecondes': 92,
        'numero': '771234567',
      },
    ];
    final ({BuildContext context, WidgetRef ref}) monte = await monter(tester);
    final AppelsCrm appelsCrm = monte.ref.read(appelsCrmProvider.notifier);

    await appelsCrm.lancer(
      monte.context,
      kind: 'representant',
      id: 'rep-1',
      e164: '+221771234567',
    );
    await appelsCrm.rapprocherEnAttente();

    final PreuvesAppelData ligne = (await preuve())!;
    expect(ligne.journalType, 'sortant');
    expect(ligne.journalDureeS, 92);
    expect(ligne.journalAt, t0.add(const Duration(minutes: 1)));
    expect(ligne.rapprocheAt, t0);
  });

  // Le journal rend aussi les appels que le téléconseiller passe pour lui : ils
  // ne doivent NI confirmer une fiche, NI laisser de ligne en base.
  testWidgets('un appel vers un autre numéro ne confirme rien', (
    WidgetTester tester,
  ) async {
    journal = <Map<String, Object?>>[
      <String, Object?>{
        'type': 'sortant',
        'at': t0.add(const Duration(minutes: 1)).millisecondsSinceEpoch,
        'dureeSecondes': 300,
        'numero': '+221709999999',
      },
    ];
    final ({BuildContext context, WidgetRef ref}) monte = await monter(tester);
    final AppelsCrm appelsCrm = monte.ref.read(appelsCrmProvider.notifier);

    await appelsCrm.lancer(
      monte.context,
      kind: 'representant',
      id: 'rep-1',
      e164: '+221771234567',
    );
    await appelsCrm.rapprocherEnAttente();

    final List<PreuvesAppelData> lignes = await db
        .select(db.preuvesAppel)
        .get();
    expect(lignes.length, 1);
    expect(lignes.single.journalType, isNull);
    expect(lignes.single.rapprocheAt, isNull);
  });

  group('la tentative envoyée porte la preuve', () {
    late WriteRepository writes;

    setUp(() => writes = WriteRepository(db, clock: FakeClock(t0)));

    Future<void> poserPreuve({
      required String kind,
      required String entityId,
      DateTime? lanceA,
    }) => db
        .into(db.preuvesAppel)
        .insert(
          PreuvesAppelCompanion.insert(
            id: 'preuve-$entityId',
            kind: kind,
            entityId: entityId,
            phoneE164: '+221771234567',
            lanceAt: lanceA ?? t0.subtract(const Duration(minutes: 4)),
            mode: 'call',
            journalType: const Value<String?>('sortant'),
            journalDureeS: const Value<int?>(92),
            journalAt: Value<DateTime?>(
              t0.subtract(const Duration(minutes: 3)),
            ),
            rapprocheAt: Value<DateTime?>(t0),
          ),
        );

    test('un appel représentant emporte le type, la durée et l\'heure', () async {
      await poserPreuve(kind: 'representant', entityId: 'rep-1');

      await writes.recordRepCallAttempt(
        representantId: 'rep-1',
        outcome: 'UNREACHABLE',
        createdById: 'me',
      );

      final Map<String, Object?> payload = dernierPayload(await allOutbox(db));
      expect(payload['deviceCallType'], 'sortant');
      expect(payload['deviceCallDurationSeconds'], 92);
      expect(
        payload['deviceCallAt'],
        t0.subtract(const Duration(minutes: 3)).toIso8601String(),
      );
      expect(
        CreateRepCallAttemptDto.fromJson(
          Map<String, dynamic>.from(payload),
        ).deviceCallType?.value,
        'sortant',
      );
      // Consommée : la tentative suivante ne repartira pas avec la même preuve.
      expect((await preuve())!.attemptId, isNotNull);
    });

    test('un appel prospect emporte les mêmes trois champs', () async {
      await poserPreuve(kind: 'prospect', entityId: 'pros-1');

      await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: 'UNREACHABLE',
        createdById: 'me',
      );

      final Map<String, Object?> payload = dernierPayload(await allOutbox(db));
      expect(payload['deviceCallType'], 'sortant');
      expect(payload['deviceCallDurationSeconds'], 92);
      expect((await preuve())!.attemptId, isNotNull);

      // Le DTO du client engendré est le vrai goulot : sans les trois champs,
      // la poussée partirait sans eux, EN SILENCE.
      final SyncEntityDataDto envoye = SyncEntityDataDto.fromJson(
        Map<String, dynamic>.from(payload),
      );
      expect(envoye.deviceCallType?.value, 'sortant');
      expect(envoye.deviceCallDurationSeconds, 92);
      expect(envoye.deviceCallAt, isNotNull);
    });

    // Un numéro composé depuis le téléphone, ou un appel d'il y a trois heures :
    // le serveur ne doit rien recevoir plutôt qu'une confirmation inventée.
    test('sans preuve fraîche, aucune des trois clés ne part', () async {
      await poserPreuve(
        kind: 'representant',
        entityId: 'rep-1',
        lanceA: t0.subtract(const Duration(hours: 4)),
      );

      await writes.recordRepCallAttempt(
        representantId: 'rep-1',
        outcome: 'UNREACHABLE',
        createdById: 'me',
      );

      final Map<String, Object?> payload = dernierPayload(await allOutbox(db));
      expect(payload.containsKey('deviceCallType'), isFalse);
      expect(payload.containsKey('deviceCallDurationSeconds'), isFalse);
      expect(payload.containsKey('deviceCallAt'), isFalse);
      expect((await preuve())!.attemptId, isNull);
    });

    // L'appel retrouvé dans le journal porte `lance_at = journal_at` : consigné
    // dans les trois heures, il emmène ce que le téléphone a inscrit, et sort
    // de la liste « à consigner ».
    test('un appel détecté puis consigné emporte sa preuve', () async {
      await db
          .into(db.preuvesAppel)
          .insert(
            PreuvesAppelCompanion.insert(
              id: 'preuve-detectee',
              kind: 'representant',
              entityId: 'rep-1',
              phoneE164: '+221771234567',
              lanceAt: t0.subtract(const Duration(hours: 2)),
              mode: 'detecte',
              journalType: const Value<String?>('entrant'),
              journalDureeS: const Value<int?>(64),
              journalAt: Value<DateTime?>(
                t0.subtract(const Duration(hours: 2)),
              ),
              rapprocheAt: Value<DateTime?>(t0),
            ),
          );

      await writes.recordRepCallAttempt(
        representantId: 'rep-1',
        outcome: 'UNREACHABLE',
        createdById: 'me',
      );

      final Map<String, Object?> payload = dernierPayload(await allOutbox(db));
      expect(payload['deviceCallType'], 'entrant');
      expect(payload['deviceCallDurationSeconds'], 64);
      expect((await preuve())!.attemptId, isNotNull);
      expect(await db.appelsAConsigner().get(), isEmpty);
    });

    test('une preuve déjà consommée ne repart pas deux fois', () async {
      await poserPreuve(kind: 'representant', entityId: 'rep-1');

      await writes.recordRepCallAttempt(
        representantId: 'rep-1',
        outcome: 'UNREACHABLE',
        createdById: 'me',
      );
      await writes.recordRepCallAttempt(
        representantId: 'rep-1',
        outcome: 'UNREACHABLE',
        createdById: 'me',
      );

      final Map<String, Object?> payload = dernierPayload(await allOutbox(db));
      expect(payload.containsKey('deviceCallType'), isFalse);
    });
  });
}
