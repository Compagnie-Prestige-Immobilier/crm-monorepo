import 'dart:convert';

import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/core/utils/phone.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:sqlite3/common.dart' show SqliteException;
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Tests de la phase 2.
///
/// Le fil directeur : le commercial travaille depuis un **programme papier** qui
/// ne porte que des numéros. Tout ce qui suit protège les deux propriétés dont
/// dépend ce dispositif — une recherche qui trouve toujours la bonne ligne quelle
/// que soit la façon dont le numéro a été recopié, et une saisie qui ne se perd
/// jamais entre le trottoir et le serveur.
void main() {
  late AppDatabase db;
  late FakeApi api;
  late FakeClock clock;
  late WriteRepository writes;
  late Phase2DirectorySync directory;
  late SyncEngine engine;

  setUp(() async {
    db = await openTestDatabase();
    api = FakeApi();
    clock = FakeClock(t0);
    writes = WriteRepository(db, clock: clock);
    directory = Phase2DirectorySync(database: db, api: api, clock: clock);
    engine = SyncEngine(
      database: db,
      api: api,
      tokens: InMemoryTokenStore()..save(accessToken: 'a', refreshToken: 'r'),
      clock: clock,
    );
  });

  tearDown(() => db.close());

  Future<void> seedDirectory({
    String prospectId = 'pros-1',
    String phone = '+221771234567',
    String status = Phase2Statuses.pending,
    String? method,
    int rev = 1,
  }) {
    return db.into(db.phase2Directory).insert(
          Phase2DirectoryCompanion.insert(
            prospectId: prospectId,
            phoneE164: phone,
            phase2Status: Value<String>(status),
            enrollmentMethod: Value<String?>(method),
            rev: Value<int>(rev),
            updatedAt: t0,
          ),
        );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Confidentialité
  // ───────────────────────────────────────────────────────────────────────────

  group('frontière de confidentialité', () {
    // CE TEST EST LA FRONTIÈRE, PAS SA DOCUMENTATION.
    //
    // L'annuaire est répliqué hors ligne sur le téléphone personnel de chaque
    // commercial et couvre tout le portefeuille. Y ajouter le nom, la banque ou
    // le syndicat reviendrait à distribuer la base nominative complète à chaque
    // terminal, et une seule perte d'appareil suffirait à la faire fuiter.
    //
    // Ajouter une colonne doit donc casser ici, bruyamment, et obliger celui qui
    // le fait à écrire pourquoi.
    test('phase2_directory ne stocke exactement que les six champs autorisés',
        () async {
      final List<QueryRow> columns =
          await db.customSelect('PRAGMA table_info(phase2_directory)').get();
      final Set<String> names =
          columns.map((QueryRow r) => r.read<String>('name')).toSet();

      expect(names, <String>{
        'prospect_id',
        'phone_e164',
        'phase2_status',
        'enrollment_method',
        'rev',
        'updated_at',
      });
    });

    test('aucune colonne nominative n\'a été glissée dans call_attempts', () async {
      final List<QueryRow> columns =
          await db.customSelect('PRAGMA table_info(call_attempts)').get();
      final Set<String> names =
          columns.map((QueryRow r) => r.read<String>('name')).toSet();

      // Le journal local désigne le dossier par son identifiant. Ni nom, ni
      // téléphone, ni banque : la jointure vers l'annuaire suffit à l'affichage,
      // et dupliquer le numéro ici multiplierait les endroits à purger.
      for (final String forbidden in const <String>[
        'nom',
        'prenom',
        'full_name',
        'phone_e164',
        'banque_id',
        'syndicat_id',
      ]) {
        expect(names, isNot(contains(forbidden)));
      }
    });

    test('la purge de déconnexion n\'oublie ni l\'annuaire, ni les tentatives, '
        'ni la file, ni le curseur', () async {
      await seedDirectory();
      await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.callback,
        createdById: 'me',
      );
      await directory.writeCursor('curseur-au-milieu');

      // De la phase 1 dans la même base : elle ne doit PAS partir. La purge vise
      // la phase 2, pas les saisies de prospection qui n'ont pas encore été
      // envoyées — les emporter détruirait le travail de la journée.
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
      await queueOp(db, id: 'op-p1', entityType: 'representant', entityId: 'rep-1');

      await directory.purge();

      expect(await db.countPhase2Directory().getSingle(), 0);
      expect(await db.countMyAttempts().getSingle(), 0);
      expect(await db.countPhase2Pending().getSingle(), 0);
      expect(await directory.readCursor(), isNull);

      expect(await db.countRepresentants().getSingle(), 1);
      expect(await db.countPendingOutbox().getSingle(), 1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Recherche
  // ───────────────────────────────────────────────────────────────────────────

  group('recherche locale', () {
    // LE test de l'écran. Le commercial recopie un numéro depuis une feuille
    // imprimée ; selon l'humeur, la feuille et l'habitude, il tape la forme
    // nationale, la forme internationale ou le préfixe de sortie UIT. Les trois
    // désignent le même abonné et DOIVENT retrouver la même ligne : sans cela,
    // il conclurait « ce numéro n'est pas dans mon annuaire » et sauterait un
    // dossier, sans que rien ne le signale.
    test('les trois écritures d\'un même numéro retrouvent la même ligne',
        () async {
      await seedDirectory(phone: '+221771234567');

      for (final String typed in const <String>[
        '77 123 45 67',
        '771234567',
        '+221771234567',
        '+221 77 123 45 67',
        '00221771234567',
        '221771234567',
        // Recopié depuis WhatsApp, avec un tiret cadratin.
        '77-123-45-67',
        '77.123.45.67',
        '(77) 123 45 67',
      ]) {
        final String? e164 = Phone.toE164(typed);
        expect(e164, '+221771234567', reason: 'normalisation de « $typed »');

        final Phase2DirectoryData? found = await directory.lookupByPhone(e164!);
        expect(
          found?.prospectId,
          'pros-1',
          reason: '« $typed » doit retrouver la ligne',
        );
      }
    });

    test('un numéro absent de l\'annuaire ne rend rien', () async {
      await seedDirectory(phone: '+221771234567');
      expect(await directory.lookupByPhone('+221780000000'), isNull);
    });

    test('la recherche ne touche jamais le réseau', () async {
      await seedDirectory();
      // `ExplodingApi` fait échouer le test à la moindre requête : c'est ainsi
      // qu'on prouve que l'écran fonctionne dans un village sans couverture.
      final Phase2DirectorySync offline = Phase2DirectorySync(
        database: db,
        api: const ExplodingApi(),
        clock: clock,
      );
      expect(
        (await offline.lookupByPhone('+221771234567'))?.prospectId,
        'pros-1',
      );
    });

    test('deux prospects ne peuvent pas partager un numéro', () async {
      await seedDirectory(prospectId: 'pros-1', phone: '+221771234567');
      // Sans cette contrainte, la recherche exacte rendrait deux lignes
      // contradictoires et l'écran devrait arbitrer — ce qu'il ne peut pas.
      await expectLater(
        seedDirectory(prospectId: 'pros-2', phone: '+221771234567'),
        throwsA(isA<SqliteException>()),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Téléchargement de l'annuaire
  // ───────────────────────────────────────────────────────────────────────────

  group('téléchargement de l\'annuaire', () {
    test('pagine jusqu\'à hasMore == false et rend la progression', () async {
      api.directoryPages.addAll(<Phase2DirectoryPage>[
        directoryPage(
          entries: <Phase2DirectoryEntry>[
            directoryEntry(prospectId: 'p1', phoneE164: '+221770000001'),
            directoryEntry(prospectId: 'p2', phoneE164: '+221770000002'),
          ],
          nextCursor: 'c1',
          hasMore: true,
        ),
        directoryPage(
          entries: <Phase2DirectoryEntry>[
            directoryEntry(prospectId: 'p3', phoneE164: '+221770000003'),
          ],
          nextCursor: 'c2',
        ),
      ]);

      final List<int> progress = <int>[];
      final int applied = await directory.pull(
        onProgress: (int n, bool _) => progress.add(n),
      );

      expect(applied, 3);
      // La progression est rendue APRÈS chaque page écrite : à 2, la base
      // contient déjà deux lignes. Une progression qui devance l'écriture ment.
      expect(progress, <int>[2, 3]);
      expect(await db.countPhase2Directory().getSingle(), 3);
      expect(await directory.readCursor(), 'c2');

      // Le curseur de la deuxième page est bien celui rendu par la première.
      expect(api.directoryCalls.map((({String? cursor, int limit}) c) => c.cursor),
          <String?>[null, 'c1']);
    });

    test('reprend au curseur enregistré après une coupure', () async {
      await directory.writeCursor('curseur-de-la-veille');
      api.directoryPages.add(directoryPage(entries: <Phase2DirectoryEntry>[]));

      await directory.pull();

      expect(api.directoryCalls.single.cursor, 'curseur-de-la-veille');
    });

    test('une page rejouée n\'écrase pas une révision plus récente', () async {
      await seedDirectory(
        prospectId: 'p1',
        phone: '+221770000001',
        status: Phase2Statuses.methodObtained,
        method: EnrollmentMethods.platform,
        rev: 5,
      );
      api.directoryPages.add(
        directoryPage(
          entries: <Phase2DirectoryEntry>[
            directoryEntry(
              prospectId: 'p1',
              phoneE164: '+221770000001',
              rev: 2,
            ),
          ],
        ),
      );

      await directory.pull();

      final Phase2DirectoryData row =
          await directory.lookupByPhone('+221770000001') as Phase2DirectoryData;
      expect(row.rev, 5);
      expect(row.phase2Status, Phase2Statuses.methodObtained);
    });

    test('à révision égale, le serveur l\'emporte sur le miroir optimiste',
        () async {
      // Le scénario de réconciliation : on a marqué localement « refus », le
      // serveur a refusé l'écriture (dossier déjà clos par un collègue) et n'a
      // donc pas bougé sa `rev`. Sans `>=`, ce pull ne corrigerait jamais rien.
      await seedDirectory(rev: 3);
      await db.customStatement(
        'UPDATE phase2_directory SET phase2_status = ? WHERE prospect_id = ?',
        <Object?>[Phase2Statuses.refused, 'pros-1'],
      );

      api.directoryPages.add(
        directoryPage(
          entries: <Phase2DirectoryEntry>[
            directoryEntry(
              prospectId: 'pros-1',
              phoneE164: '+221771234567',
              phase2Status: Phase2Statuses.methodObtained,
              enrollmentMethod: EnrollmentMethods.physical,
              rev: 3,
            ),
          ],
        ),
      );

      await directory.pull();

      final Phase2DirectoryData row =
          await directory.lookupByPhone('+221771234567') as Phase2DirectoryData;
      expect(row.phase2Status, Phase2Statuses.methodObtained);
      expect(row.enrollmentMethod, EnrollmentMethods.physical);
    });

    test('un échec réseau laisse l\'annuaire déjà téléchargé intact', () async {
      await seedDirectory();
      api.failNextDirectoryPull = const ApiException(
        'NETWORK',
        kind: FailureKind.retryable,
      );

      await expectLater(directory.pull(), throwsA(isA<ApiException>()));
      expect(await db.countPhase2Directory().getSingle(), 1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Saisie
  // ───────────────────────────────────────────────────────────────────────────

  group('saisie d\'une tentative', () {
    test('écrit la ligne, la met en file et ferme le dossier localement',
        () async {
      await seedDirectory();

      final String attemptId = await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.methodObtained,
        method: EnrollmentMethods.platform,
        createdById: 'me',
      );

      final CallAttempt attempt = await (db.select(db.callAttempts)
            ..where((CallAttempts a) => a.id.equals(attemptId)))
          .getSingle();
      expect(attempt.outcome, CallOutcomes.methodObtained);
      expect(attempt.method, EnrollmentMethods.platform);

      final OutboxData op = (await allOutbox(db)).single;
      expect(op.entityType, callAttemptEntity);
      expect(op.entityId, attemptId);
      expect(op.status, OutboxStatus.pending);
      // Groupée sur le PROSPECT, comme le serveur : deux tentatives sur le même
      // numéro partent dans l'ordre de saisie.
      expect(op.dependencyKey, 'phase2:pros-1');

      final Map<String, Object?> payload =
          jsonDecode(op.payload) as Map<String, Object?>;
      expect(payload['prospectId'], 'pros-1');
      expect(payload['outcome'], CallOutcomes.methodObtained);
      expect(payload['method'], EnrollmentMethods.platform);
      expect(payload['clientCreatedAt'], isA<String>());

      // Miroir optimiste : retaper le même numéro tombe désormais sur l'écran de
      // lecture seule, pas sur le formulaire.
      final Phase2DirectoryData row =
          await directory.lookupByPhone('+221771234567') as Phase2DirectoryData;
      expect(row.phase2Status, Phase2Statuses.methodObtained);
      expect(row.enrollmentMethod, EnrollmentMethods.platform);
      // `rev` INCHANGÉE — c'est ce qui laisse le prochain pull réconcilier.
      expect(row.rev, 1);
    });

    test('une issue non terminale laisse le dossier ouvert', () async {
      await seedDirectory();
      await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.callback,
        createdById: 'me',
      );
      final Phase2DirectoryData row =
          await directory.lookupByPhone('+221771234567') as Phase2DirectoryData;
      expect(row.phase2Status, Phase2Statuses.pending);
    });

    test('REFUSED et WRONG_NUMBER sont terminales sans méthode', () async {
      await seedDirectory(prospectId: 'a', phone: '+221770000001');
      await seedDirectory(prospectId: 'b', phone: '+221770000002');

      await writes.recordCallAttempt(
        prospectId: 'a',
        outcome: CallOutcomes.refused,
        createdById: 'me',
      );
      await writes.recordCallAttempt(
        prospectId: 'b',
        outcome: CallOutcomes.wrongNumber,
        createdById: 'me',
      );

      expect(
        (await directory.lookupByPhone('+221770000001'))?.phase2Status,
        Phase2Statuses.refused,
      );
      expect(
        (await directory.lookupByPhone('+221770000002'))?.enrollmentMethod,
        isNull,
      );
    });

    group('validation locale', () {
      // Ces quatre règles sont des CHECK PostgreSQL. Les découvrir à la
      // synchronisation, c'est les découvrir potentiellement trois semaines
      // après l'appel, quand le commercial ne se souvient plus de ce qui a été
      // dit et ne peut donc plus corriger. On refuse AVANT d'écrire.

      test('OTHER exige un commentaire non vide', () async {
        await seedDirectory();
        await expectLater(
          writes.recordCallAttempt(
            prospectId: 'pros-1',
            outcome: CallOutcomes.other,
            createdById: 'me',
          ),
          throwsA(
            isA<CallAttemptInvalid>().having(
              (CallAttemptInvalid e) => e.problem,
              'problem',
              CallAttemptProblem.commentRequired,
            ),
          ),
        );
        // Rien n'a été écrit : ni journal, ni file.
        expect(await db.countMyAttempts().getSingle(), 0);
        expect(await db.countPhase2Pending().getSingle(), 0);
      });

      test('un commentaire fait d\'espaces ne vaut pas commentaire', () async {
        await seedDirectory();
        await expectLater(
          writes.recordCallAttempt(
            prospectId: 'pros-1',
            outcome: CallOutcomes.other,
            comment: '   \n\t ',
            createdById: 'me',
          ),
          throwsA(isA<CallAttemptInvalid>()),
        );
      });

      test('OTHER commenté passe, et le commentaire est détouré', () async {
        await seedDirectory();
        final String id = await writes.recordCallAttempt(
          prospectId: 'pros-1',
          outcome: CallOutcomes.other,
          comment: '  Le mari répond à sa place.  ',
          createdById: 'me',
        );
        final CallAttempt attempt = await (db.select(db.callAttempts)
              ..where((CallAttempts a) => a.id.equals(id)))
            .getSingle();
        expect(attempt.comment, 'Le mari répond à sa place.');
      });

      test('METHOD_OBTAINED sans méthode est refusé', () async {
        await seedDirectory();
        await expectLater(
          writes.recordCallAttempt(
            prospectId: 'pros-1',
            outcome: CallOutcomes.methodObtained,
            createdById: 'me',
          ),
          throwsA(
            isA<CallAttemptInvalid>().having(
              (CallAttemptInvalid e) => e.problem,
              'problem',
              CallAttemptProblem.methodRequired,
            ),
          ),
        );
      });

      test('une méthode sur une autre issue est refusée, pas ignorée', () async {
        // Le serveur REFUSE (`PHASE2_METHOD_NOT_ALLOWED`). L'ignorer localement
        // ferait partir une opération condamnée.
        await seedDirectory();
        await expectLater(
          writes.recordCallAttempt(
            prospectId: 'pros-1',
            outcome: CallOutcomes.callback,
            method: EnrollmentMethods.platform,
            createdById: 'me',
          ),
          throwsA(
            isA<CallAttemptInvalid>().having(
              (CallAttemptInvalid e) => e.problem,
              'problem',
              CallAttemptProblem.methodNotAllowed,
            ),
          ),
        );
      });

      test('un commentaire de plus de 2000 caractères est refusé', () async {
        await seedDirectory();
        await expectLater(
          writes.recordCallAttempt(
            prospectId: 'pros-1',
            outcome: CallOutcomes.callback,
            comment: 'a' * 2001,
            createdById: 'me',
          ),
          throwsA(isA<CallAttemptInvalid>()),
        );
      });

      test('la base refuse elle aussi, si un chemin de code contournait Dart',
          () async {
        // La validation Dart donne le message ; le CHECK garantit qu'aucun
        // chemin ne peut l'esquiver.
        await expectLater(
          db.customStatement(
            'INSERT INTO call_attempts '
            '(id, prospect_id, outcome, method, comment, client_created_at, created_by_id) '
            'VALUES (?, ?, ?, NULL, NULL, ?, ?)',
            <Object?>['x', 'pros-1', 'OTHER', t0.toIso8601String(), 'me'],
          ),
          throwsA(isA<SqliteException>()),
        );
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // File d'attente et rejeu
  // ───────────────────────────────────────────────────────────────────────────

  group('outbox et rejeu', () {
    test('hors ligne, la saisie s\'empile et rien n\'est perdu', () async {
      await seedDirectory(prospectId: 'a', phone: '+221770000001');
      await seedDirectory(prospectId: 'b', phone: '+221770000002');
      await seedDirectory(prospectId: 'c', phone: '+221770000003');

      // Le réseau est mort : toute requête ferait échouer le test.
      final WriteRepository offlineWrites = WriteRepository(db, clock: clock);
      await offlineWrites.recordCallAttempt(
        prospectId: 'a',
        outcome: CallOutcomes.methodObtained,
        method: EnrollmentMethods.physical,
        createdById: 'me',
      );
      await offlineWrites.recordCallAttempt(
        prospectId: 'b',
        outcome: CallOutcomes.unreachable,
        createdById: 'me',
      );
      await offlineWrites.recordCallAttempt(
        prospectId: 'c',
        outcome: CallOutcomes.other,
        comment: 'Numéro attribué à une boutique.',
        createdById: 'me',
      );

      expect(await db.countMyAttempts().getSingle(), 3);
      expect(await db.countPhase2Pending().getSingle(), 3);
      expect(api.calls, isEmpty);
      expect(api.rawCalls, isEmpty);
    });

    test('le retour du réseau vide la file par le chemin brut', () async {
      await seedDirectory(prospectId: 'a', phone: '+221770000001');
      await writes.recordCallAttempt(
        prospectId: 'a',
        outcome: CallOutcomes.methodObtained,
        method: EnrollmentMethods.voiceOrElectronicMessaging,
        createdById: 'me',
      );

      await engine.drain();

      // Chemin BRUT et non le chemin typé : le client généré ne connaît pas
      // encore `call_attempt`, et un passage par le chemin typé perdrait
      // silencieusement `prospectId`, `outcome`, `method` et `comment`.
      expect(api.calls, isEmpty);
      expect(api.rawCalls, hasLength(1));

      final RawPushCall call = api.rawCalls.single;
      expect(call.payloadVersion, SyncEngine.payloadVersion);
      expect(call.operations.single['entity'], 'call_attempt');
      expect(call.operations.single['op'], 'create');

      final Map<String, Object?> data = call.dataAt(0);
      expect(data['prospectId'], 'a');
      expect(data['outcome'], CallOutcomes.methodObtained);
      expect(data['method'], EnrollmentMethods.voiceOrElectronicMessaging);
      expect(data['clientCreatedAt'], isA<String>());

      expect(await db.countPhase2Pending().getSingle(), 0);
    });

    test('une réponse perdue ne produit pas de doublon au rejeu', () async {
      await seedDirectory(prospectId: 'a', phone: '+221770000001');
      await writes.recordCallAttempt(
        prospectId: 'a',
        outcome: CallOutcomes.refused,
        createdById: 'me',
      );

      // Le lot EST appliqué côté serveur ; c'est la réponse qui se perd.
      api.loseNextResponse = true;
      await engine.drain();
      expect(await db.countPhase2Pending().getSingle(), 1);

      // Rejeu. L'`opId` est le même, donc le serveur rend `duplicate` sans créer
      // de seconde tentative — c'est ce qui empêche qu'un appel soit compté deux
      // fois dans la commission de fin de mois.
      clock.advance(const Duration(minutes: 5));
      await engine.drain();

      expect(api.rawRows, hasLength(1));
      expect(await db.countPhase2Pending().getSingle(), 0);
    });

    test('PHASE2_ALREADY_COMPLETED laisse un conflit VISIBLE', () async {
      await seedDirectory(prospectId: 'a', phone: '+221770000001');
      final String attemptId = await writes.recordCallAttempt(
        prospectId: 'a',
        outcome: CallOutcomes.methodObtained,
        method: EnrollmentMethods.platform,
        createdById: 'me',
      );
      final OutboxData queued = (await allOutbox(db)).single;
      api.verdicts[queued.id] = conflictOn(
        queued.id,
        errorCode: 'PHASE2_ALREADY_COMPLETED',
        message: 'Ce dossier a déjà été clos.',
      );

      await engine.drain();

      final OutboxData after = await outboxById(db, queued.id);
      expect(after.status, OutboxStatus.conflict);
      expect(after.lastErrorCode, 'PHASE2_ALREADY_COMPLETED');
      // Il remonte dans « À corriger » : le commercial voit que sa saisie n'a
      // pas été retenue, au lieu de la croire partie.
      expect(await db.countPhase2Pending().getSingle(), 1);

      // La saisie locale, elle, n'est PAS effacée : c'est la trace de ce qu'il a
      // réellement fait, et seul un ADMIN peut trancher depuis le web.
      final CallAttempt kept = await (db.select(db.callAttempts)
            ..where((CallAttempts a) => a.id.equals(attemptId)))
          .getSingle();
      expect(kept.outcome, CallOutcomes.methodObtained);
    });

    test('un lot ne dépasse jamais 25 clés de dépendance', () async {
      // Le serveur refuse EN BLOC, en 400, un lot couvrant plus de 25 groupes
      // (`SYNC_MAX_DEPENDENCY_GROUPS`) — donc terminal, donc toutes les
      // opérations partiraient en `failed`. Une matinée hors ligne en produit
      // soixante : sans ce plafond, la première synchronisation au retour du
      // réseau condamnerait la matinée entière.
      for (int i = 0; i < 60; i++) {
        final String id = 'p$i';
        await seedDirectory(
          prospectId: id,
          phone: '+2217700${i.toString().padLeft(5, '0')}',
        );
        await writes.recordCallAttempt(
          prospectId: id,
          outcome: CallOutcomes.unreachable,
          createdById: 'me',
        );
      }

      final List<OutboxData> batch = await engine.selectBatch();
      final Set<String?> keys =
          batch.map((OutboxData o) => o.dependencyKey).toSet();
      expect(keys.length, lessThanOrEqualTo(engine.maxBatchGroups));

      // La vidange complète les emporte quand même, en plusieurs lots.
      await engine.drain();
      expect(await db.countPhase2Pending().getSingle(), 0);
      expect(api.rawCalls.length, greaterThan(1));
      for (final RawPushCall call in api.rawCalls) {
        final Set<Object?> callKeys = call.operations
            .map((Map<String, Object?> o) =>
                (o['data']! as Map<String, Object?>)['prospectId'])
            .toSet();
        expect(callKeys.length, lessThanOrEqualTo(25));
      }
    });

    test('un lot est homogène : phase 1 et phase 2 ne se mélangent jamais',
        () async {
      // Les deux familles empruntent deux transports différents tant que le
      // client généré ignore `call_attempt`. Un lot mixte n'aurait aucun chemin.
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000009');
      await queueOp(
        db,
        id: 'op-rep',
        entityType: 'representant',
        entityId: 'rep-1',
        payload: <String, Object?>{'fullName': 'X', 'phone': '+221770000009'},
      );
      await seedDirectory(prospectId: 'a', phone: '+221770000001');
      await writes.recordCallAttempt(
        prospectId: 'a',
        outcome: CallOutcomes.callback,
        createdById: 'me',
      );

      final List<OutboxData> batch = await engine.selectBatch();
      final Set<String> families =
          batch.map((OutboxData o) => o.entityType).toSet();
      expect(families, hasLength(1));

      await engine.drain();
      expect(api.calls, hasLength(1));
      expect(api.rawCalls, hasLength(1));
      expect(await db.countPendingOutbox().getSingle(), 0);
    });

    test('un payload sans prospectId part en failed, jamais en refus serveur '
        'incompréhensible', () async {
      // Une opération écrite par une version antérieure de l'app, restée en file
      // à travers une mise à jour.
      await queueOp(
        db,
        id: 'op-vieux',
        entityType: callAttemptEntity,
        entityId: 'att-1',
        dependencyKey: 'phase2:inconnu',
        payload: <String, Object?>{'outcome': 'UNREACHABLE'},
      );

      await engine.drain();

      final OutboxData row = await outboxById(db, 'op-vieux');
      expect(row.status, OutboxStatus.failed);
      expect(row.lastErrorCode, ClientErrorCodes.payloadSchemaMismatch);
      expect(api.rawCalls, isEmpty);
    });
  });
}
