import 'dart:math';

import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Le référentiel des statuts descend par une route DÉDIÉE, hors curseur
/// keyset. Rien d'automatique ne casse si on oublie de la brancher : c'est le
/// seul oubli silencieux de ce travail, et ces tests sont écrits pour lui.
void main() {
  late AppDatabase db;
  late FakeApi api;
  late SyncEngine engine;

  StatutQualificationDto dto(
    String code, {
    StatutQualificationEffect effect = StatutQualificationEffect.REACHED,
    bool requiresCallback = false,
    bool isActive = true,
  }) => StatutQualificationDto(
    id: 'sq-$code',
    code: code,
    label: code,
    effect: effect,
    requiresCallback: requiresCallback,
    priorite: PrioriteTraitement.NORMALE,
    relationStatus: null,
    isActive: isActive,
    isSystem: true,
    minPayloadVersion: 6,
    updatedAt: t0,
  );

  setUp(() async {
    db = await openTestDatabase();
    api = FakeApi();
    engine = SyncEngine(
      database: db,
      api: api,
      tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
      clock: FakeClock(t0),
      random: Random(24),
    );
  });
  tearDown(() => db.close());

  test('le cycle de pull descend les statuts de qualification', () async {
    api.statutsQualification.add(dto('INTERESSE'));

    await engine.pullChanges();

    final List<StatutQualificationRow> rows = await db
        .select(db.statutsQualification)
        .get();
    expect(rows.map((StatutQualificationRow r) => r.code), <String>[
      'INTERESSE',
    ]);
    expect(rows.single.id, 'sq-INTERESSE');
  });

  test('la version déclarée est celle que le serveur compare', () async {
    await engine.pullStatutsQualification();

    expect(api.statutCalls, <int>[6]);
    expect(SyncEngine.payloadVersion, 6);
  });

  test('un statut retiré du serveur quitte le miroir', () async {
    await db
        .into(db.statutsQualification)
        .insert(
          StatutsQualificationCompanion.insert(
            code: 'RETIRE',
            id: 'sq-retire',
            label: 'Retiré',
            effect: 'REACHED',
          ),
        );
    api.statutsQualification.add(dto('INTERESSE'));

    await engine.pullStatutsQualification();

    final Set<String> codes = (await db.select(db.statutsQualification).get())
        .map((StatutQualificationRow r) => r.code)
        .toSet();
    expect(codes, <String>{'INTERESSE'});
  });

  test('un échec du référentiel n\'interrompt pas le pull', () async {
    api.failNextStatutsPull = const ApiException(
      'boom',
      message: 'coupure',
      kind: FailureKind.retryable,
    );

    expect(await engine.pullStatutsQualification(), 0);
  });

  test(
    'le provider sert les statuts actifs dans l\'ordre du serveur',
    () async {
      api.statutsQualification.addAll(<StatutQualificationDto>[
        dto('A_RAPPELER', effect: StatutQualificationEffect.SCHEDULE_CALLBACK),
        dto('INTERESSE'),
        dto('RETIRE_DU_SCRIPT', isActive: false),
      ]);
      await engine.pullStatutsQualification();

      final ProviderContainer container = ProviderContainer(
        overrides: <Override>[appDatabaseProvider.overrideWithValue(db)],
      );
      addTearDown(container.dispose);

      // Le provider se jette dès que personne ne l'écoute : cet abonnement le
      // tient le temps de la première valeur.
      container.listen(statutsQualificationProvider, (_, _) {});
      final List<StatutQualificationRow> servis = await container.read(
        statutsQualificationProvider.future,
      );
      expect(servis.map((StatutQualificationRow r) => r.code), <String>[
        'A_RAPPELER',
        'INTERESSE',
      ]);
    },
  );
}
