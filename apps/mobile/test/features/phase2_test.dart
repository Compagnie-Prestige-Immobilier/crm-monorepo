import 'dart:convert';
import 'dart:io';

import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/core/utils/phone.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:sqlite3/common.dart' show SqliteException;
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Tests de la phase 2.
///
/// Le fil directeur : le commercial travaille depuis un **programme papier** qui
/// ne porte que des numéros. Tout ce qui suit protège les deux propriétés dont
/// dépend ce dispositif : une recherche qui trouve toujours la bonne ligne quelle
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
    final InMemoryTokenStore tokens = InMemoryTokenStore();
    await tokens.save(accessToken: 'a', refreshToken: 'r');
    engine = SyncEngine(database: db, api: api, tokens: tokens, clock: clock);
  });

  tearDown(() => db.close());

  Future<void> seedDirectory({
    String prospectId = 'pros-1',
    String phone = '+221771234567',
    String status = Phase2Statuses.pending,
    String? method,
    int rev = 1,
  }) {
    return db
        .into(db.phase2Directory)
        .insert(
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
    test(
      'phase2_directory ne stocke exactement que les six champs autorisés',
      () async {
        final List<QueryRow> columns = await db
            .customSelect('PRAGMA table_info(phase2_directory)')
            .get();
        final Set<String> names = columns
            .map((QueryRow r) => r.read<String>('name'))
            .toSet();

        expect(names, <String>{
          'prospect_id',
          'phone_e164',
          'phase2_status',
          'enrollment_method',
          'rev',
          'updated_at',
        });
      },
    );

    test(
      'aucune colonne nominative n\'a été glissée dans call_attempts',
      () async {
        final List<QueryRow> columns = await db
            .customSelect('PRAGMA table_info(call_attempts)')
            .get();
        final Set<String> names = columns
            .map((QueryRow r) => r.read<String>('name'))
            .toSet();

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
      },
    );

    /// ═══ CE QUE LA DÉCONNEXION A LE DROIT DE DÉTRUIRE ═══
    ///
    /// La purge emportait `call_attempts` en entier et TOUTES les opérations
    /// `call_attempt` de la file. Or l'écran de déconnexion compte les éléments
    /// en attente avec `countPendingOutbox`, qui ne filtre pas sur le type
    /// d'entité : les appels non envoyés étaient donc annoncés à l'utilisateur,
    /// avec la promesse « ces saisies ne partiront qu'à la prochaine connexion
    /// avec ce compte ». Il confirmait, et la purge détruisait ce qu'on venait
    /// de lui garantir, sans que le serveur en ait jamais eu copie.
    ///
    /// Le contrat est désormais celui-ci : **le numéro part, le travail reste**.
    /// Le secret à protéger n'est que dans `phase2_directory` ; le test voisin
    /// vérifie qu'aucune colonne nominative n'a été glissée dans
    /// `call_attempts`, donc garder une tentative non envoyée ne garde aucun
    /// numéro.
    test('la purge de déconnexion emporte l\'annuaire et le curseur, '
        'jamais un appel non envoyé', () async {
      await seedDirectory();
      await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.callback,
        createdById: 'me',
      );
      await directory.writeCursor('curseur-au-milieu');

      // De la phase 1 dans la même base : elle ne doit PAS partir. La purge vise
      // l'annuaire, pas les saisies de prospection qui n'ont pas encore été
      // envoyées : les emporter détruirait le travail de la journée.
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
      await queueOp(
        db,
        id: 'op-p1',
        entityType: 'representant',
        entityId: 'rep-1',
      );

      await directory.purge();

      // Ce qui part : les 500 000 numéros, et le curseur qui ferait croire au
      // prochain utilisateur que son annuaire est à jour.
      expect(await db.countPhase2Directory().getSingle(), 0);
      expect(await directory.readCursor(), isNull);

      // Ce qui reste : l'appel que le serveur n'a jamais vu, et son opération.
      expect(
        await db.countMyAttempts().getSingle(),
        1,
        reason: 'le serveur n\'en a pas copie : la perte serait définitive',
      );
      expect(await db.countPhase2Pending().getSingle(), 1);

      expect(await db.countRepresentants().getSingle(), 1);
      expect(await db.countPendingOutbox().getSingle(), 2);
    });

    /// Le pendant : une tentative DÉJÀ partie n'a plus de raison de rester. Le
    /// serveur la détient, et le prochain utilisateur de l'appareil n'a pas à
    /// lire le journal d'appels de son prédécesseur.
    test('la purge emporte les appels déjà envoyés', () async {
      await seedDirectory();
      final String sent = await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.callback,
        createdById: 'me',
      );
      await seedDirectory(prospectId: 'pros-2', phone: '+221771234568');
      final String unsent = await writes.recordCallAttempt(
        prospectId: 'pros-2',
        outcome: CallOutcomes.refused,
        createdById: 'me',
      );

      // Le premier appel est acquitté, le second est toujours en file.
      await (db.update(
        db.outbox,
      )..where((Outbox o) => o.entityId.equals(sent))).write(
        const OutboxCompanion(status: Value<String>(OutboxStatus.done)),
      );

      await directory.purge();

      final List<String> left = (await db.select(db.callAttempts).get())
          .map((CallAttempt a) => a.id)
          .toList(growable: false);
      expect(left, <String>[unsent]);
      expect(await db.countPhase2Pending().getSingle(), 1);
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
    test(
      'les trois écritures d\'un même numéro retrouvent la même ligne',
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

          final Phase2DirectoryData? found = await directory.lookupByPhone(
            e164!,
          );
          expect(
            found?.prospectId,
            'pros-1',
            reason: '« $typed » doit retrouver la ligne',
          );
        }
      },
    );

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
      // contradictoires et l'écran devrait arbitrer : ce qu'il ne peut pas.
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
      expect(
        api.directoryCalls.map((({String? cursor, int limit}) c) => c.cursor),
        <String?>[null, 'c1'],
      );
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

    test(
      'à révision égale, le serveur l\'emporte sur le miroir optimiste',
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
            await directory.lookupByPhone('+221771234567')
                as Phase2DirectoryData;
        expect(row.phase2Status, Phase2Statuses.methodObtained);
        expect(row.enrollmentMethod, EnrollmentMethods.physical);
      },
    );

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
    test('écrit la ligne, la met en file et ferme le dossier localement', () async {
      await seedDirectory();

      final String attemptId = await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.methodObtained,
        method: EnrollmentMethods.platform,
        createdById: 'me',
      );

      final CallAttempt attempt = await (db.select(
        db.callAttempts,
      )..where((CallAttempts a) => a.id.equals(attemptId))).getSingle();
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
      // `rev` INCHANGÉE : c'est ce qui laisse le prochain pull réconcilier.
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
        final CallAttempt attempt = await (db.select(
          db.callAttempts,
        )..where((CallAttempts a) => a.id.equals(id))).getSingle();
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

      test(
        'la base refuse elle aussi, si un chemin de code contournait Dart',
        () async {
          // La validation Dart donne le message ; le CHECK garantit qu'aucun
          // chemin ne peut l'esquiver.
          await expectLater(
            db.customStatement(
              'INSERT INTO call_attempts '
              '(id, prospect_id, outcome, requires_comment, method, comment, '
              ' client_created_at, created_by_id) '
              'VALUES (?, ?, ?, 1, NULL, NULL, ?, ?)',
              <Object?>['x', 'pros-1', 'OTHER', t0.toIso8601String(), 'me'],
            ),
            throwsA(isA<SqliteException>()),
          );
        },
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Motifs d'issue administrés par le client
  // ───────────────────────────────────────────────────────────────────────────

  /// Un motif tel que le serveur le rend.
  CallOutcomeReasonDto reasonDto({
    required String code,
    required String label,
    CallOutcomeEffect effect = CallOutcomeEffect.KEEP_OPEN,
    bool requiresComment = false,
    bool isActive = true,
    int sortOrder = 100,
  }) => CallOutcomeReasonDto(
    id: 'id-$code',
    code: code,
    label: label,
    effect: effect,
    requiresComment: requiresComment,
    requiresCallback: false,
    countsAsReached: true,
    isActive: isActive,
    isSystem: false,
    sortOrder: sortOrder,
    color: null,
    minPayloadVersion: 2,
    updatedAt: t0,
  );

  Future<void> seedReason({
    required String code,
    required String label,
    String effect = CallEffects.keepOpen,
    bool requiresComment = false,
    bool isActive = true,
    int sortOrder = 100,
  }) {
    return db
        .into(db.callOutcomeReasons)
        .insert(
          CallOutcomeReasonsCompanion.insert(
            code: code,
            label: label,
            effect: effect,
            requiresComment: Value<bool>(requiresComment),
            isActive: Value<bool>(isActive),
            sortOrder: Value<int>(sortOrder),
            minPayloadVersion: const Value<int>(2),
          ),
        );
  }

  group('motifs d\'issue', () {
    test('le référentiel redescend avec le pull et remplace la table', () async {
      api.callOutcomeReasons.addAll(<CallOutcomeReasonDto>[
        reasonDto(code: 'NRP', label: 'Ne répond pas', sortOrder: 15),
        reasonDto(
          code: 'RDV_PRIS',
          label: 'Rendez-vous pris',
          effect: CallOutcomeEffect.SCHEDULE_CALLBACK,
          sortOrder: 35,
        ),
      ]);

      await engine.pullChanges();

      // Le serveur filtre lui-même sur la version de charge utile : l'application
      // ne reçoit que des motifs qu'elle sait émettre.
      expect(api.reasonCalls, <int>[SyncEngine.payloadVersion]);

      final List<CallOutcomeReason> rows = await db
          .select(db.callOutcomeReasons)
          .get();
      expect(rows.map((CallOutcomeReason r) => r.code).toSet(), <String>{
        'NRP',
        'RDV_PRIS',
      });
      expect(
        rows.firstWhere((CallOutcomeReason r) => r.code == 'RDV_PRIS').effect,
        CallEffects.scheduleCallback,
      );
    });

    // Le référentiel est un confort ; la page de saisies, non. Si l'un tombe,
    // l'autre doit passer quand même.
    test(
      'un référentiel injoignable n\'arrête pas le pull des entités',
      () async {
        api.failNextReasonsPull = const ApiException(
          'NETWORK',
          kind: FailureKind.unreachable,
        );

        await expectLater(engine.pullChanges(), completes);
        expect(await db.select(db.callOutcomeReasons).get(), isEmpty);
      },
    );

    test('un motif ajouté par le client se saisit et porte son code', () async {
      await seedDirectory();
      await seedReason(code: 'NRP', label: 'Ne répond pas', sortOrder: 15);

      final String attemptId = await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.unreachable,
        reasonCode: 'NRP',
        createdById: 'me',
      );

      final CallAttempt attempt = await (db.select(
        db.callAttempts,
      )..where((CallAttempts a) => a.id.equals(attemptId))).getSingle();
      expect(attempt.reasonCode, 'NRP');
      expect(attempt.effect, CallEffects.keepOpen);
      // L'issue reste celle de l'effet : `outcome` est une énumération FERMÉE du
      // contrat, et y écrire « NRP » repartirait en `unknown_default_open_api`.
      expect(attempt.outcome, CallOutcomes.unreachable);

      final Map<String, Object?> payload =
          jsonDecode((await allOutbox(db)).single.payload)
              as Map<String, Object?>;
      expect(payload['reasonCode'], 'NRP');
      expect(payload['outcome'], CallOutcomes.unreachable);
    });

    // C'est le défaut que ce lot corrige : le moteur marquait
    // PAYLOAD_SCHEMA_MISMATCH, statut TERMINAL, sur toute issue absente d'un
    // vocabulaire compilé. Un motif neuf n'atteignait jamais le serveur.
    test('un motif de la table locale traverse le moteur', () async {
      await seedDirectory();
      await seedReason(code: 'NRP', label: 'Ne répond pas');
      // Écrite à la main : « NRP » en guise d'issue, ce qu'aucune version
      // antérieure n'aurait su relire. Le moteur la résout par le RÉFÉRENTIEL,
      // et c'est l'effet du motif qui décide de l'issue qui part sur le fil.
      await queueOp(
        db,
        id: 'op-nrp',
        entityType: callAttemptEntity,
        entityId: 'att-1',
        dependencyKey: 'phase2:pros-1',
        payload: <String, Object?>{
          'prospectId': 'pros-1',
          'outcome': 'NRP',
          'clientCreatedAt': t0.toIso8601String(),
        },
      );

      await engine.drain();

      final OutboxData row = await outboxById(db, 'op-nrp');
      expect(row.status, OutboxStatus.done);
      expect(row.lastErrorCode, isNot(ClientErrorCodes.payloadSchemaMismatch));
      final SyncOperationDto sent = api.calls.single.operations.single;
      expect(sent.data?.outcome, CallOutcome.UNREACHABLE);
    });

    test(
      'la file d\'aujourd\'hui part en version de charge utile courante',
      () async {
        await seedDirectory();
        await writes.recordCallAttempt(
          prospectId: 'pros-1',
          outcome: CallOutcomes.unreachable,
          createdById: 'me',
        );

        await engine.drain();

        expect(
          (await allOutbox(db)).single.payloadVersion,
          SyncEngine.payloadVersion,
        );
        expect(api.calls.single.payloadVersion, SyncEngine.payloadVersion);
      },
    );

    test('la note vocale reste en file jusqu’à son envoi', () async {
      await seedDirectory();
      final File recording = File(
        '${Directory.systemTemp.path}/crm-audio-${DateTime.now().microsecondsSinceEpoch}.m4a',
      );
      await recording.writeAsString('audio');
      await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.unreachable,
        createdById: 'me',
        recordingPath: recording.path,
      );

      await engine.drain();

      expect(api.uploadedRecordings, hasLength(1));
      // ignore: avoid_slow_async_io
      expect(await recording.exists(), isFalse);
      expect((await allOutbox(db)).single.status, OutboxStatus.done);
    });

    test('un échec d’envoi conserve la note vocale pour le rejeu', () async {
      await seedDirectory();
      final File recording = File(
        '${Directory.systemTemp.path}/crm-audio-retry-${DateTime.now().microsecondsSinceEpoch}.m4a',
      );
      await recording.writeAsString('audio');
      await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.unreachable,
        createdById: 'me',
        recordingPath: recording.path,
      );
      api.failNextRecordingUpload = const ApiException('NETWORK');

      await engine.drain();

      // ignore: avoid_slow_async_io
      expect(await recording.exists(), isTrue);
      expect((await allOutbox(db)).single.status, OutboxStatus.pending);

      clock.advance(const Duration(minutes: 5));
      await engine.drain();

      // ignore: avoid_slow_async_io
      expect(await recording.exists(), isFalse);
      expect((await allOutbox(db)).single.status, OutboxStatus.done);
    });

    test('un fichier local disparu rend la perte visible', () async {
      await seedDirectory();
      final String missingPath =
          '${Directory.systemTemp.path}/crm-audio-absent-${DateTime.now().microsecondsSinceEpoch}.m4a';
      await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.unreachable,
        createdById: 'me',
        recordingPath: missingPath,
      );

      await engine.drain();

      final OutboxData row = (await allOutbox(db)).single;
      expect(row.status, OutboxStatus.failed);
      expect(row.lastErrorCode, 'CALL_RECORDING_FILE_MISSING');
      expect(api.uploadedRecordings, isEmpty);
    });

    test(
      'un refus DEFINITIF rend la perte visible et conserve la note',
      () async {
        await seedDirectory();
        final File recording = File(
          '${Directory.systemTemp.path}/crm-audio-refus-${DateTime.now().microsecondsSinceEpoch}.m4a',
        );
        await recording.writeAsString('audio');
        await writes.recordCallAttempt(
          prospectId: 'pros-1',
          outcome: CallOutcomes.unreachable,
          createdById: 'me',
          recordingPath: recording.path,
        );
        api.failNextRecordingUpload = const ApiException(
          'CALL_RECORDING_EMPTY',
          statusCode: 400,
          kind: FailureKind.terminal,
        );

        await engine.drain();

        // ignore: avoid_slow_async_io
        expect(await recording.exists(), isTrue);
        final OutboxData row = (await allOutbox(db)).single;
        expect(row.status, OutboxStatus.failed);
        expect(row.lastErrorCode, 'CALL_RECORDING_EMPTY');
      },
    );

    // Un motif retiré du référentiel entre la saisie et l'envoi ne doit pas
    // condamner une tentative déjà faite : le téléconseiller ne peut plus rien y
    // corriger trois semaines plus tard.
    test(
      'un motif désactivé laisse partir une tentative déjà en file',
      () async {
        await seedDirectory();
        await seedReason(code: 'NRP', label: 'Ne répond pas');
        await writes.recordCallAttempt(
          prospectId: 'pros-1',
          outcome: CallOutcomes.unreachable,
          reasonCode: 'NRP',
          createdById: 'me',
        );
        await (db.update(
          db.callOutcomeReasons,
        )..where((CallOutcomeReasons t) => t.code.equals('NRP'))).write(
          const CallOutcomeReasonsCompanion(isActive: Value<bool>(false)),
        );

        await engine.drain();

        expect((await allOutbox(db)).single.status, OutboxStatus.done);
      },
    );

    // Premier lancement : le référentiel n'est pas encore descendu, et la saisie
    // ne peut pas attendre le réseau.
    test('table vide, les six motifs système restent saisissables', () async {
      await seedDirectory();
      expect(await db.select(db.callOutcomeReasons).get(), isEmpty);

      await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.refused,
        createdById: 'me',
      );

      final CallAttempt attempt =
          (await db.select(db.callAttempts).get()).single;
      expect(attempt.effect, CallEffects.closeRefused);
      expect(attempt.reasonCode, CallOutcomes.refused);
      final Phase2DirectoryData row =
          await directory.lookupByPhone('+221771234567') as Phase2DirectoryData;
      expect(row.phase2Status, Phase2Statuses.refused);
    });

    test(
      'un motif que même le repli ignore est refusé, avec un message',
      () async {
        await seedDirectory();
        await expectLater(
          writes.recordCallAttempt(
            prospectId: 'pros-1',
            outcome: CallOutcomes.unreachable,
            reasonCode: 'MOTIF_JAMAIS_DESCENDU',
            createdById: 'me',
          ),
          throwsA(
            isA<CallAttemptInvalid>().having(
              (CallAttemptInvalid e) => e.problem,
              'problem',
              CallAttemptProblem.unknownReason,
            ),
          ),
        );
        expect(await db.countMyAttempts().getSingle(), 0);
      },
    );

    test('un motif du serveur qui exige un commentaire l\'obtient', () async {
      await seedDirectory();
      await seedReason(
        code: 'LITIGE',
        label: 'Litige en cours',
        requiresComment: true,
      );

      await expectLater(
        writes.recordCallAttempt(
          prospectId: 'pros-1',
          outcome: CallOutcomes.unreachable,
          reasonCode: 'LITIGE',
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

      final String id = await writes.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.unreachable,
        reasonCode: 'LITIGE',
        comment: 'Dossier chez l\'avocat.',
        createdById: 'me',
      );
      final CallAttempt attempt = await (db.select(
        db.callAttempts,
      )..where((CallAttempts a) => a.id.equals(id))).getSingle();
      expect(attempt.requiresComment, isTrue);
      expect(attempt.comment, 'Dossier chez l\'avocat.');
    });

    // Le CHECK est le filet du filet : la validation Dart donne le message, le
    // DDL garantit qu'aucun chemin de code ne l'esquive.
    test('la base refuse un motif exigeant sans commentaire', () async {
      await expectLater(
        db.customStatement(
          'INSERT INTO call_attempts '
          '(id, prospect_id, outcome, reason_code, effect, requires_comment, '
          ' client_created_at, created_by_id) '
          'VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
          <Object?>[
            'x',
            'pros-1',
            'UNREACHABLE',
            'LITIGE',
            CallEffects.keepOpen,
            t0.toIso8601String(),
            'me',
          ],
        ),
        throwsA(isA<SqliteException>()),
      );
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
    });

    test('le retour du réseau vide la file par le chemin TYPÉ', () async {
      await seedDirectory(prospectId: 'a', phone: '+221770000001');
      await writes.recordCallAttempt(
        prospectId: 'a',
        outcome: CallOutcomes.methodObtained,
        method: EnrollmentMethods.voiceOrElectronicMessaging,
        createdById: 'me',
      );

      await engine.drain();

      // ═══ IL N'Y A PLUS QU'UN TRANSPORT ═══
      //
      // Une variante brute de `push` existait, au motif que `SyncEntity`
      // ignorait `call_attempt` et que `SyncEntityDataDto` n'avait ni
      // `prospectId`, ni `outcome`, ni `method`, ni `comment`. Le client généré
      // porte les quatre : le contournement était devenu du code mort qui
      // dupliquait la sérialisation d'un lot.
      expect(api.calls, hasLength(1));

      final PushCall call = api.calls.single;
      expect(call.payloadVersion, SyncEngine.payloadVersion);
      final SyncOperationDto sent = call.operations.single;
      expect(sent.entity, SyncEntity.callAttempt);
      expect(sent.op, SyncOp.create);
      // L'identifiant de la TENTATIVE, pas celui du prospect : c'est lui que le
      // serveur retient comme clé d'idempotence.
      expect(sent.entityId, isNot('a'));
      // Sans garde de révision, comme le chemin brut qui n'en envoyait aucune.
      // En envoyer une ferait revenir la tentative en REV_CONFLICT, et le
      // conflit deviendrait la tête de `phase2:<prospect>` : plus aucune
      // tentative sur ce numéro ne partirait ensuite.
      expect(sent.baseRev, isNull);

      // Le point de vigilance de toute la bascule : ces quatre champs sont
      // exactement ceux que le modèle généré laissait tomber en silence quand il
      // ne les déclarait pas. Un `data` amputé part en
      // `CALL_ATTEMPT_INCOMPLETE`, et l'appel est perdu.
      final SyncEntityDataDto data = sent.data!;
      expect(data.prospectId, 'a');
      expect(data.outcome, CallOutcome.METHOD_OBTAINED);
      expect(data.method, EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING);
      expect(data.clientCreatedAt, isNotNull);

      // Et le JSON réellement émis, parce que c'est lui qui voyage : un enum
      // rendu `unknown_default_open_api` passerait toutes les assertions
      // ci-dessus sur les objets et ne se verrait qu'ici.
      final Map<String, dynamic> wire = sent.toJson();
      final Map<String, dynamic> wireData =
          wire['data'] as Map<String, dynamic>;
      expect(wire['entity'], 'call_attempt');
      expect(wireData['prospectId'], 'a');
      expect(wireData['outcome'], CallOutcomes.methodObtained);
      expect(wireData['method'], EnrollmentMethods.voiceOrElectronicMessaging);
      // En UTC sur le fil, et pas en heure locale : le chemin brut recopiait la
      // chaîne stockée, le chemin typé la reconstruit depuis un `DateTime`. Une
      // reconstruction en heure locale décalerait l'appel de l'écart horaire, et
      // le serveur compte les tentatives par journée.
      expect(wireData['clientCreatedAt'], endsWith('Z'));
      expect(
        DateTime.parse(wireData['clientCreatedAt'] as String).toUtc(),
        data.clientCreatedAt!.toUtc(),
      );

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
      // de seconde tentative : c'est ce qui empêche qu'un appel soit compté deux
      // fois dans la commission de fin de mois.
      clock.advance(const Duration(minutes: 5));
      await engine.drain();

      expect(api.rows, hasLength(1));
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
      final CallAttempt kept = await (db.select(
        db.callAttempts,
      )..where((CallAttempts a) => a.id.equals(attemptId))).getSingle();
      expect(kept.outcome, CallOutcomes.methodObtained);
    });

    test('un lot ne dépasse jamais 25 clés de dépendance', () async {
      // Le serveur refuse EN BLOC, en 400, un lot couvrant plus de 25 groupes
      // (`SYNC_MAX_DEPENDENCY_GROUPS`) : donc terminal, donc toutes les
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
      final Set<String?> keys = batch
          .map((OutboxData o) => o.dependencyKey)
          .toSet();
      expect(keys.length, lessThanOrEqualTo(engine.maxBatchGroups));

      // La vidange complète les emporte quand même, en plusieurs lots.
      await engine.drain();
      expect(await db.countPhase2Pending().getSingle(), 0);
      expect(api.calls.length, greaterThan(1));
      for (final PushCall call in api.calls) {
        final Set<String?> callKeys = call.operations
            .map((SyncOperationDto o) => o.data?.prospectId)
            .toSet()
            .cast<String?>();
        expect(callKeys.length, lessThanOrEqualTo(25));
      }
    });

    test('phase 1 et phase 2 partent MÉLANGÉES, dans un seul lot', () async {
      // Elles étaient séparées de force : deux transports, donc un lot mixte
      // sans chemin. Il n'y a plus qu'un transport, et les séparer coûtait un
      // aller-retour réseau de plus à chaque fois qu'un commercial saisit un
      // prospect puis rappelle quelqu'un : c'est-à-dire tous les jours.
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
      expect(
        batch.map((OutboxData o) => o.entityType).toSet(),
        <String>{'representant', callAttemptEntity},
        reason: 'les deux familles tiennent maintenant dans le même lot',
      );

      await engine.drain();
      expect(api.calls, hasLength(1), reason: 'un seul aller-retour, pas deux');
      expect(
        api.calls.single.operations
            .map((SyncOperationDto o) => o.entity)
            .toSet(),
        <SyncEntity>{SyncEntity.representant, SyncEntity.callAttempt},
      );
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
      expect(api.calls, isEmpty);
    });

    test(
      'une issue d\'appel inconnue part en failed, pas en `unknown` sur le fil',
      () async {
        // ═══ LE PIÈGE PROPRE AU CHEMIN TYPÉ ═══
        //
        // Le client est généré avec `enumUnknownDefaultCase: true` : une valeur
        // qu'il ignore devient `unknownDefaultOpenApi` et repart sur le fil en
        // `unknown_default_open_api`. Le chemin brut recopiait la chaîne telle
        // quelle ; sans garde, la bascule transformerait l'issue d'un appel réel
        // en issue bidon, en silence, et la tentative serait comptée pour ce
        // qu'elle n'est pas.
        await seedDirectory(prospectId: 'a', phone: '+221770000001');
        await queueOp(
          db,
          id: 'op-issue-neuve',
          entityType: callAttemptEntity,
          entityId: 'att-9',
          dependencyKey: 'phase2:a',
          payload: <String, Object?>{
            'prospectId': 'a',
            'outcome': 'RAPPEL_PROGRAMME',
            'clientCreatedAt': '2026-08-12T09:00:00.000Z',
          },
        );

        await engine.drain();

        final OutboxData row = await outboxById(db, 'op-issue-neuve');
        expect(row.status, OutboxStatus.failed);
        expect(row.lastErrorCode, ClientErrorCodes.payloadSchemaMismatch);
        expect(
          api.calls,
          isEmpty,
          reason:
              'rien ne doit partir avec une issue que le serveur ne connaît pas',
        );
      },
    );
  });
}
