import 'dart:convert';
import 'dart:io';

import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/draft_repository.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:drift/drift.dart' hide isNotNull, isNull;
// `isNull`/`isNotNull` existent des deux côtés : ici on parle de matchers, pas
// d'expressions SQL.
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/common.dart';

import '../support/db_fixture.dart';

void main() {
  late AppDatabase db;
  late FakeClock clock;
  late WriteRepository repo;
  late DraftRepository drafts;

  setUp(() async {
    db = await openTestDatabase();
    clock = FakeClock(t0);
    repo = WriteRepository(db, clock: clock);
    drafts = DraftRepository(db, clock: clock);
  });
  tearDown(() => db.close());

  Future<void> seedDraft(String draftId) => drafts.save(
    draftId: draftId,
    formKey: 'representant.create',
    values: <String, Object?>{'fullName': 'Awa Sy'},
  );

  group('l\'invariant d\'enregistrement', () {
    test(
      'ligne métier + opération d\'outbox + suppression du brouillon',
      () async {
        await seedDraft('d1');
        final String id = await repo.createRepresentant(
          fullName: 'Awa Sy',
          phoneE164: '+221770000001',
          departementId: 'dep-1',
          createdById: 'me',
          draftId: 'd1',
        );

        // 1. la ligne métier
        final Representant rep =
            (await db.select(db.representants).get()).single;
        expect(rep.id, id);
        expect(rep.phoneE164, '+221770000001');

        // 2. l'opération d'outbox, avec la clé de dépendance du représentant
        final OutboxData op = (await allOutbox(db)).single;
        expect(op.entityType, 'representant');
        expect(op.entityId, id);
        expect(op.op, 'create');
        expect(op.dependencyKey, id);
        expect(op.status, OutboxStatus.pending);
        expect(op.payloadVersion, SyncEngine.payloadVersion);
        // Éligible tout de suite : le premier essai ne doit pas attendre.
        expect(op.nextAttemptAt, t0);

        // 3. le brouillon a disparu : sinon l'écran proposerait « reprendre la
        //    saisie » d'une fiche déjà enregistrée, que l'utilisateur ressaisirait.
        expect(await drafts.read('d1'), isNull);
        expect(await db.select(db.formDrafts).get(), isEmpty);
      },
    );

    test(
      'si l\'insertion échoue, le brouillon SURVIT et rien n\'est mis en file',
      () async {
        // Le numéro est déjà pris : l'index unique partiel refuse la ligne.
        await insertRepresentant(db, id: 'deja', phone: '+221770000001');
        await seedDraft('d1');

        await expectLater(
          repo.createRepresentant(
            fullName: 'Awa Sy',
            phoneE164: '+221770000001',
            departementId: 'dep-1',
            createdById: 'me',
            draftId: 'd1',
          ),
          throwsA(isA<SqliteException>()),
        );

        // C'est TOUT le point : il n'existe aucun état atteignable où la frappe de
        // l'utilisateur est perdue après qu'il a appuyé sur Enregistrer.
        expect(await drafts.read('d1'), isNotNull);
        expect(await allOutbox(db), isEmpty);
        expect((await db.select(db.representants).get()).single.id, 'deja');
      },
    );

    test(
      'l\'ordre inverse est impossible : le brouillon ne part jamais seul',
      () async {
        await seedDraft('d1');
        // Une clé étrangère invalide fait échouer l'insertion métier.
        await expectLater(
          repo.createRepresentant(
            fullName: 'Awa Sy',
            phoneE164: '+221770000002',
            departementId: 'departement-inexistant',
            createdById: 'me',
            draftId: 'd1',
          ),
          throwsA(isA<SqliteException>()),
        );
        expect(await drafts.read('d1'), isNotNull);
        expect(await allOutbox(db), isEmpty);
        expect(await db.select(db.representants).get(), isEmpty);
      },
    );

    test('les trois écritures sont dans UNE transaction', () async {
      await seedDraft('d1');
      // Une erreur levée dans la transaction de l'appelant doit tout annuler :
      // si les trois instructions committaient séparément, la ligne métier
      // resterait sans opération d'outbox : visible, jamais envoyée.
      await expectLater(
        db.transaction(() async {
          await repo.createRepresentant(
            fullName: 'Awa Sy',
            phoneE164: '+221770000003',
            departementId: 'dep-1',
            createdById: 'me',
            draftId: 'd1',
          );
          throw const _Interrupted();
        }),
        throwsA(isA<_Interrupted>()),
      );
      expect(await db.select(db.representants).get(), isEmpty);
      expect(await allOutbox(db), isEmpty);
      expect(await drafts.read('d1'), isNotNull);
    });

    test('un prospect porte la clé de dépendance de son PARENT', () async {
      final String repId = await repo.createRepresentant(
        fullName: 'Awa Sy',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
        createdById: 'me',
      );
      await seedDraft('d2');
      final String prospectId = await repo.createProspect(
        nom: 'Diallo',
        prenom: 'Mamadou',
        phoneE164: '+221780000001',
        banqueId: 'bq-1',
        syndicatId: 'sy-1',
        representantId: repId,
        createdById: 'me',
        draftId: 'd2',
      );

      final List<OutboxData> ops = await allOutbox(db);
      expect(ops, hasLength(2));
      // Même partition, `seq` supérieur : le prospect ne PEUT pas partir avant
      // son représentant. C'est une propriété de la sélection, pas un contrôle.
      expect(ops[1].dependencyKey, repId);
      expect(ops[1].entityId, prospectId);
      expect(ops[1].seq, greaterThan(ops[0].seq));
      expect(await drafts.read('d2'), isNull);
    });

    test('un même téléphone reçoit un second parcours sans doublon', () async {
      final String chuesId = await repo.createProspect(
        nom: 'Diallo',
        prenom: 'Mamadou',
        phoneE164: '+221780000001',
        projet: 'CHUES',
        createdById: 'me',
      );

      final String grandPublicId = await repo.createProspect(
        nom: 'Diallo',
        prenom: 'Mamadou',
        phoneE164: '+221780000001',
        projet: 'GRAND_PUBLIC',
        createdById: 'me',
      );

      expect(grandPublicId, chuesId);
      final List<Prospect> prospects = await db.select(db.prospects).get();
      expect(prospects, hasLength(1));
      // La fiche ne DÉMÉNAGE pas : elle garde son projet d'entrée et gagne un
      // second parcours. La renommer la retirerait des listes CHUES, où elle a
      // déjà son historique.
      expect(prospects.single.projet, 'CHUES');
      final List<ProspectJourney> parcours = await db
          .select(db.prospectJourneys)
          .get();
      expect(
        parcours.map((ProspectJourney j) => j.projet).toList()..sort(),
        <String>['CHUES', 'GRAND_PUBLIC'],
      );
      final List<OutboxData> operations = await allOutbox(db);
      expect(operations, hasLength(2));
      expect(operations.last.op, 'update');
      final Map<String, Object?> envoi =
          jsonDecode(operations.last.payload) as Map<String, Object?>;
      expect(envoi['projet'], 'GRAND_PUBLIC');
      // Le serveur refuse toute opération de prospect sans numéro, mise à jour
      // comprise : l'omettre bloquait le lot en `invalid`, sans retour possible.
      expect(envoi['phone'], '+221780000001');
    });

    test('une mise à jour connue du serveur emporte sa baseRev', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        rev: 7,
        serverUpdatedAt: t0,
      );
      await repo.updateRepresentant(
        id: 'repA',
        fullName: 'Awa Sy Diop',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
      );
      // `baseRev` transforme une écriture aveugle en écriture conditionnelle.
      expect((await allOutbox(db)).single.baseRev, 7);
    });

    test('une fiche jamais vue du serveur n\'a pas de baseRev', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001', rev: 7);
      await repo.updateRepresentant(
        id: 'repA',
        fullName: 'Awa Sy Diop',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
      );
      expect((await allOutbox(db)).single.baseRev, isNull);
    });

    test('« même numéro » n\'écrit AUCUN numéro WhatsApp local', () async {
      await repo.createRepresentant(
        fullName: 'Awa Sy',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
        createdById: 'me',
        whatsappStatus: 'MEME_NUMERO',
        // L'écran ne devrait pas en fournir ; la règle ne peut pas dépendre de
        // ça. Un second numéro en base, c'est un numéro qui divergera du
        // téléphone à la première correction, sans que rien ne le signale.
        whatsappE164: '+221770000001',
      );

      final Representant rep = (await db.select(db.representants).get()).single;
      expect(rep.whatsappStatus, 'MEME_NUMERO');
      expect(rep.whatsappE164, isNull);

      final Map<String, Object?> payload =
          jsonDecode((await allOutbox(db)).single.payload)
              as Map<String, Object?>;
      expect(payload.containsKey('whatsappE164'), isFalse);
    });

    test('les trois champs partent dans le lot sortant', () async {
      await repo.createRepresentant(
        fullName: 'Awa Sy',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
        createdById: 'me',
        whatsappStatus: 'AUTRE_NUMERO',
        whatsappE164: '+221781112233',
        profession: 'Directeur d\'école',
      );

      final Representant rep = (await db.select(db.representants).get()).single;
      expect(rep.whatsappE164, '+221781112233');
      expect(rep.profession, 'Directeur d\'école');

      final Map<String, Object?> payload =
          jsonDecode((await allOutbox(db)).single.payload)
              as Map<String, Object?>;
      expect(payload['whatsappStatus'], 'AUTRE_NUMERO');
      expect(payload['whatsappE164'], '+221781112233');
      expect(payload['profession'], 'Directeur d\'école');
    });

    test('revenir à « même numéro » efface le numéro déjà enregistré', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        whatsappStatus: 'AUTRE_NUMERO',
        whatsappE164: '+221781112233',
      );
      await repo.updateRepresentant(
        id: 'repA',
        fullName: 'Awa Sy',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
        whatsappStatus: 'MEME_NUMERO',
        whatsappE164: '+221781112233',
      );

      expect(
        (await db.select(db.representants).get()).single.whatsappE164,
        isNull,
      );
      final Map<String, Object?> payload =
          jsonDecode((await allOutbox(db)).single.payload)
              as Map<String, Object?>;
      // Présent ET nul : c'est ce qui distingue un effacement voulu du silence
      // d'une version qui ne connaissait pas le champ.
      expect(payload.containsKey('whatsappE164'), isTrue);
      expect(payload['whatsappE164'], isNull);
    });

    test(
      'supprimer un représentant emporte logiquement ses prospects',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await insertProspect(
          db,
          id: 'p1',
          representantId: 'repA',
          phone: '+221780000001',
        );
        await repo.deleteRepresentant('repA');

        final Representant rep =
            (await db.select(db.representants).get()).single;
        expect(rep.deletedAt, t0);
        expect((await db.select(db.prospects).get()).single.deletedAt, t0);
        expect((await allOutbox(db)).single.op, 'delete');
      },
    );
  });

  group('abandon d\'une opération', () {
    /// Un représentant en conflit, deux prospects derrière lui, et une autre
    /// chaîne parfaitement saine.
    Future<Map<String, int>> seedChains() async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertProspect(
        db,
        id: 'pA1',
        representantId: 'repA',
        phone: '+221780000001',
      );
      await insertProspect(
        db,
        id: 'pA2',
        representantId: 'repA',
        phone: '+221780000002',
      );
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      await insertProspect(
        db,
        id: 'pB1',
        representantId: 'repB',
        phone: '+221780000003',
      );

      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        status: OutboxStatus.conflict,
      );
      await queueOp(
        db,
        id: 'A2',
        entityType: 'prospect',
        entityId: 'pA1',
        dependencyKey: 'repA',
      );
      await queueOp(
        db,
        id: 'A3',
        entityType: 'prospect',
        entityId: 'pA2',
        dependencyKey: 'repA',
      );
      await queueOp(db, id: 'B1', entityType: 'representant', entityId: 'repB');
      await queueOp(
        db,
        id: 'B2',
        entityType: 'prospect',
        entityId: 'pB1',
        dependencyKey: 'repB',
      );

      return <String, int>{
        for (final OutboxData o in await allOutbox(db)) o.id: o.seq,
      };
    }

    test('abandonner un `create` emporte toute la suite de sa clé', () async {
      final Map<String, int> seqs = await seedChains();

      final DiscardResult result = await repo.discardOperation(seqs['A1']!);

      // Sans cette cascade, les prospects partiraient vers un parent qui
      // n'existera jamais côté serveur : REPRESENTANT_NOT_FOUND à chaque
      // tentative, indéfiniment, et une file qui ne se vide pas.
      expect(result.outcome, DiscardOutcome.discarded);
      expect(result.removed, 3);
      final List<OutboxData> left = await allOutbox(db);
      expect(left.map((OutboxData o) => o.id), <String>['B1', 'B2']);

      // Les lignes métier partent avec : les garder afficherait des fiches que
      // rien ne synchronisera plus jamais, avec un badge « en attente » menteur.
      expect(
        (await db.select(db.representants).get()).map((Representant r) => r.id),
        <String>['repB'],
      );
      expect(
        (await db.select(db.prospects).get()).map((Prospect p) => p.id),
        <String>['pB1'],
      );
    });

    test('la chaîne voisine est intacte', () async {
      final Map<String, int> seqs = await seedChains();
      await repo.discardOperation(seqs['A1']!);
      expect((await outboxById(db, 'B1')).status, OutboxStatus.pending);
      expect((await outboxById(db, 'B2')).dependencyKey, 'repB');
    });

    test(
      'abandonner un prospect ne touche ni son parent ni ses frères',
      () async {
        final Map<String, int> seqs = await seedChains();
        final DiscardResult result = await repo.discardOperation(seqs['A2']!);
        expect(result.removed, 1);
        final List<OutboxData> left = await allOutbox(db);
        expect(left.map((OutboxData o) => o.id), <String>[
          'A1',
          'A3',
          'B1',
          'B2',
        ]);
        expect(
          (await db.select(db.prospects).get()).map((Prospect p) => p.id),
          <String>['pA2', 'pB1'],
        );
      },
    );

    test('abandonner un `update` ne supprime que lui-même', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'U1',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        status: OutboxStatus.failed,
      );
      final OutboxData u1 = await outboxById(db, 'U1');
      expect((await repo.discardOperation(u1.seq)).removed, 1);
      expect(await allOutbox(db), isEmpty);
      // La fiche existe côté serveur : la supprimer localement la ferait
      // revenir au prochain pull, en donnant l'illusion d'un bug.
      expect(await db.select(db.representants).get(), hasLength(1));
    });

    test('abandonner une tentative supprime sa note vocale locale', () async {
      final Directory temp = await Directory.systemTemp.createTemp(
        'cpi-recording-',
      );
      addTearDown(() async {
        if (temp.existsSync()) await temp.delete(recursive: true);
      });
      final File recording = File('${temp.path}/attempt.m4a');
      await recording.writeAsBytes(<int>[1, 2, 3]);
      await queueOp(
        db,
        id: 'audio-1',
        entityType: callAttemptEntity,
        entityId: 'attempt-1',
        status: OutboxStatus.failed,
        payload: <String, Object?>{'_recordingPath': recording.path},
      );
      final OutboxData operation = await outboxById(db, 'audio-1');

      expect((await repo.discardOperation(operation.seq)).removed, 1);

      expect(recording.existsSync(), isFalse);
    });

    test('une charge utile illisible reste abandonnable', () async {
      await queueOp(
        db,
        id: 'audio-corrompu',
        entityType: callAttemptEntity,
        entityId: 'attempt-1',
        status: OutboxStatus.failed,
      );
      final OutboxData operation = await outboxById(db, 'audio-corrompu');
      await (db.update(db.outbox)
            ..where((Outbox row) => row.seq.equals(operation.seq)))
          .write(const OutboxCompanion(payload: Value<String>('{')));

      final DiscardResult result = await repo.discardOperation(operation.seq);

      expect(result.outcome, DiscardOutcome.discarded);
      expect(await allOutbox(db), isEmpty);
    });

    test('discardOwnCreateOnly laisse partir les prospects repointés', () async {
      final Map<String, int> seqs = await seedChains();
      expect(seqs, contains('A1'));
      // « Rattacher mes prospects » : la création du représentant est devenue
      // inutile, mais ses prospects viennent d'être repointés et doivent partir.
      final DiscardResult result = await repo.discardOwnCreateOnly('A1');
      expect(result.outcome, DiscardOutcome.discarded);
      expect(result.removed, 1);
      final List<OutboxData> left = await allOutbox(db);
      expect(left.map((OutboxData o) => o.id), <String>[
        'A2',
        'A3',
        'B1',
        'B2',
      ]);
      expect(await db.select(db.prospects).get(), hasLength(3));
    });

    /// Le nom de la méthode dit « create » ; rien ne l'imposait. Un `id` périmé
    /// désignant une modification faisait disparaître une intention utilisateur
    /// que rien ne reconstruit : le prochain tirage ramènerait la valeur d'avant
    /// sans que personne puisse dire pourquoi.
    test(
      'discardOwnCreateOnly ne touche pas une opération qui n\'est pas un create',
      () async {
        await insertRepresentant(
          db,
          id: 'repA',
          phone: '+221770000001',
          serverUpdatedAt: t0,
        );
        await queueOp(
          db,
          id: 'U1',
          entityType: 'representant',
          entityId: 'repA',
          op: 'update',
          status: OutboxStatus.failed,
          payload: <String, Object?>{'fullName': 'Awa Ndiaye'},
        );

        final DiscardResult result = await repo.discardOwnCreateOnly('U1');

        expect(result.outcome, DiscardOutcome.notFound);
        expect(result.removed, 0);
        expect(await allOutbox(db), hasLength(1));
        expect(
          jsonDecode((await outboxById(db, 'U1')).payload),
          <String, Object?>{'fullName': 'Awa Ndiaye'},
        );
      },
    );

    /// Une correction réécrit la ligne sous un `id` NEUF (`_amendInPlace`). La
    /// feuille d'arbitrage, elle, tient l'ANCIEN : sans retour, elle croyait
    /// avoir abandonné une création toujours en file.
    test(
      'discardOwnCreateOnly rend notFound sur un identifiant périmé',
      () async {
        await seedChains();
        final DiscardResult result = await repo.discardOwnCreateOnly(
          'identifiant-mort',
        );
        expect(result.outcome, DiscardOutcome.notFound);
        expect(result.removed, 0);
        expect(await allOutbox(db), hasLength(5));
      },
    );

    test('abandonner une opération inexistante ne fait rien', () async {
      await seedChains();
      expect(
        (await repo.discardOperation(99999)).outcome,
        DiscardOutcome.notFound,
      );
      expect(await allOutbox(db), hasLength(5));
    });

    /// ═══ LA BOÎTE DE CONFIRMATION SOUS-COMPTAIT CE QU'ELLE DÉTRUISAIT ═══
    ///
    /// L'écran comptait sa cascade en filtrant « À corriger », qui ne montre que
    /// `conflict` et `failed`. La suppression, elle, prend `OutboxStatus.open`,
    /// donc `pending` et `syncing` en plus. C'est exactement l'état dans lequel
    /// le moteur laisse les prospects d'un représentant refusé : verdict
    /// `skippedDependencyFailed`, puis `_requeueBlocked` qui les remet en
    /// `pending`. Ils étaient donc invisibles du compte, et un représentant
    /// portant deux prospects annonçait « cette saisie » avant d'en détruire
    /// trois.
    test(
      'previewDiscard voit les prospects `pending`, invisibles de « À corriger »',
      () async {
        final Map<String, int> seqs = await seedChains();
        final DiscardPreview preview = await repo.previewDiscard(seqs['A1']!);

        expect(
          preview.prospects,
          2,
          reason:
              'pA1 et pA2 sont en `pending` : c\'est là que _requeueBlocked les '
              'laisse, et c\'est là que l\'ancien compte ne regardait pas',
        );
        expect(preview.operations, 3);

        // Le compte annoncé et le compte détruit doivent être le même nombre.
        expect(
          (await repo.discardOperation(seqs['A1']!)).removed,
          preview.operations,
        );
      },
    );

    test('previewDiscard ne compte que la ligne visée pour un prospect', () async {
      final Map<String, int> seqs = await seedChains();
      final DiscardPreview preview = await repo.previewDiscard(seqs['A2']!);
      // L'ancien compte filtrait sur la seule `dependencyKey`, sans vérifier que
      // la tête est bien un représentant : il annonçait la chaîne entière alors
      // qu'un prospect ne retire que lui-même.
      expect(preview.operations, 1);
      expect(preview.prospects, 1);
    });

    test('previewDiscard ne détruit rien', () async {
      final Map<String, int> seqs = await seedChains();
      await repo.previewDiscard(seqs['A1']!);
      expect(await allOutbox(db), hasLength(5));
      expect(await db.select(db.prospects).get(), hasLength(3));
    });

    test('previewDiscard rend un compte nul sur un `seq` inconnu', () async {
      await seedChains();
      final DiscardPreview preview = await repo.previewDiscard(99999);
      expect(preview.operations, 0);
      expect(preview.prospects, 0);
    });

    /// « La fiche existe déjà côté serveur » n'est vrai que du seul appelant,
    /// qui vient de la retrouver par lookup. Ce n'est vrai d'aucun prospect :
    /// retirer sa ligne d'outbox et garder sa ligne `prospects` afficherait une
    /// fiche RÉGLÉE qui n'a jamais quitté le téléphone, que plus rien ne peut
    /// faire partir.
    test('discardOwnCreateOnly refuse une création de prospect', () async {
      await seedChains();

      final DiscardResult result = await repo.discardOwnCreateOnly('A2');

      expect(result.outcome, DiscardOutcome.notFound);
      expect(result.removed, 0);
      expect(await allOutbox(db), hasLength(5));
      expect(
        (await db.select(db.prospects).get()).map((Prospect p) => p.id),
        containsAll(<String>['pA1']),
        reason: 'la fiche serait restée sans opération, donc affichée réglée',
      );
    });
  });

  group('reprise manuelle', () {
    test(
      'retryOperation remet le compteur à zéro et rend la ligne due',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
          status: OutboxStatus.failed,
          attempts: 8,
          nextAttemptAt: t0.add(const Duration(days: 1)),
        );
        final OutboxData before = await outboxById(db, 'A1');
        clock.advance(const Duration(minutes: 5));
        await repo.retryOperation(before.seq);

        final OutboxData after = await outboxById(db, 'A1');
        expect(after.status, OutboxStatus.pending);
        // L'utilisateur vient d'agir : conserver huit tentatives épuisées ferait
        // mourir sa correction au premier échec.
        expect(after.attempts, 0);
        expect(after.nextAttemptAt, clock.now());
        expect(after.lastErrorCode, isNull);
        expect(after.leaseUntil, isNull);
      },
    );
  });

  group('payload', () {
    test(
      'qualifier un représentant met à jour la fiche',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');

        await repo.recordRepCallAttempt(
          representantId: 'repA',
          outcome: 'REACHED',
          relationStatus: 'AMBASSADEUR',
          whatsappStatus: 'MEME_NUMERO',
          comment: 'Disponible.',
        );

        final Representant rep = await (db.select(
          db.representants,
        )..where((Representants row) => row.id.equals('repA'))).getSingle();
        expect(rep.relationStatus, 'AMBASSADEUR');
        expect(rep.whatsappStatus, 'MEME_NUMERO');
        final OutboxData op = (await allOutbox(db)).single;
        expect(op.entityType, repCallAttemptEntity);
        expect(jsonDecode(op.payload), containsPair('comment', 'Disponible.'));
      },
    );

    test(
      'un rappel pose un rappel local et le porte dans le payload',
      () async {
        await insertRepresentant(
          db,
          id: 'repA',
          phone: '+221770000001',
          fullName: 'Awa Sy',
        );
        final DateTime rappelAt = t0.add(const Duration(hours: 2));

        final String attemptId = await repo.recordRepCallAttempt(
          representantId: 'repA',
          outcome: 'CALLBACK',
          callbackAt: rappelAt,
        );

        final RepCallbackReminder reminder =
            await (db.select(db.repCallbackReminders)..where(
                  (RepCallbackReminders row) => row.id.equals(attemptId),
                ))
                .getSingle();
        expect(reminder.representantId, 'repA');
        expect(reminder.fullName, 'Awa Sy');
        expect(reminder.scheduledAt, rappelAt);
        expect(reminder.notifiedAt, isNull);

        final OutboxData op = (await allOutbox(db)).single;
        expect(
          jsonDecode(op.payload),
          containsPair('callbackAt', rappelAt.toUtc().toIso8601String()),
        );
      },
    );

    // Rappeler quelqu'un, c'est saisir un appel de plus sur sa fiche : la
    // promesse est alors tenue. Sans cet effacement, le rappel restait dans la
    // liste et son alarme sonnait APRÈS l'appel qu'elle réclamait.
    test('un appel de plus honore le rappel promis', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      final String promis = await repo.recordRepCallAttempt(
        representantId: 'repA',
        outcome: 'CALLBACK',
        callbackAt: t0.add(const Duration(hours: 2)),
      );

      final String tenu = await repo.recordRepCallAttempt(
        representantId: 'repA',
        outcome: 'REACHED',
        relationStatus: 'AMBASSADEUR',
        whatsappStatus: 'MEME_NUMERO',
      );
      final List<String> honores = await repo.honourRepCallbacks(
        representantId: 'repA',
        except: tenu,
      );

      expect(honores, <String>[promis]);
      expect(await db.select(db.repCallbackReminders).get(), isEmpty);
    });

    // Le rappel que l'appel vient lui-même de prendre n'est pas une promesse
    // tenue : l'effacer serait le perdre dans le geste qui le pose.
    test('le rappel que l\'appel vient de promettre survit', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      final String promis = await repo.recordRepCallAttempt(
        representantId: 'repA',
        outcome: 'CALLBACK',
        callbackAt: t0.add(const Duration(hours: 2)),
      );

      expect(
        await repo.honourRepCallbacks(representantId: 'repA', except: promis),
        isEmpty,
      );
      expect((await db.select(db.repCallbackReminders).getSingle()).id, promis);
    });

    // Un « non » n'est pas une impasse : la personne appelée propose souvent
    // quelqu'un d'autre, et c'est le seul moment où on l'a au téléphone.
    test('la personne proposée part avec le compte rendu', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');

      await repo.recordRepCallAttempt(
        representantId: 'repA',
        outcome: 'REFUSED',
        relationStatus: 'REFUS',
        suggestedPhone: '+221771234567',
        suggestedName: '  Fatou Sarr  ',
        suggestedNote: 'Déléguée du personnel.',
      );

      final Object? payload = jsonDecode((await allOutbox(db)).single.payload);
      expect(payload, containsPair('suggestedPhone', '+221771234567'));
      expect(payload, containsPair('suggestedName', 'Fatou Sarr'));
      expect(payload, containsPair('suggestedNote', 'Déléguée du personnel.'));
    });

    // Le serveur ignore le nom et la note sans numéro : les envoyer quand même
    // ferait partir des restes que personne ne pourrait rappeler.
    test('sans numéro, le nom et la note ne partent pas', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');

      await repo.recordRepCallAttempt(
        representantId: 'repA',
        outcome: 'REFUSED',
        suggestedPhone: '   ',
        suggestedName: 'Fatou Sarr',
        suggestedNote: 'Déléguée du personnel.',
      );

      final Map<String, Object?> payload =
          jsonDecode((await allOutbox(db)).single.payload)
              as Map<String, Object?>;
      expect(payload.containsKey('suggestedPhone'), isFalse);
      expect(payload.containsKey('suggestedName'), isFalse);
      expect(payload.containsKey('suggestedNote'), isFalse);
    });

    test(
      'le payload est du JSON brut, relisible après mise à jour de l\'app',
      () async {
        await repo.createRepresentant(
          fullName: 'Awa Sy',
          phoneE164: '+221770000001',
          departementId: 'dep-1',
          createdById: 'me',
          notes: 'Marché de Thiaroye',
        );
        final Map<String, Object?> payload =
            jsonDecode((await allOutbox(db)).single.payload)
                as Map<String, Object?>;
        expect(payload['fullName'], 'Awa Sy');
        expect(payload['phone'], '+221770000001');
        expect(payload['departementId'], 'dep-1');
        expect(payload['notes'], 'Marché de Thiaroye');
        expect(payload['clientCreatedAt'], t0.toIso8601String());
      },
    );

    test('un rappel daté part avec son heure, en UTC', () async {
      final DateTime demain = DateTime.utc(2026, 8, 13, 9);
      await repo.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.callback,
        createdById: 'me',
        callbackAt: demain,
      );

      final CallAttempt attempt =
          (await db.select(db.callAttempts).get()).single;
      expect(attempt.callbackAt, demain);

      final Map<String, Object?> payload =
          jsonDecode((await allOutbox(db)).single.payload)
              as Map<String, Object?>;
      expect(payload['callbackAt'], demain.toIso8601String());
    });

    // Le champ reste FACULTATIF côté serveur pour cette raison exacte : les
    // versions déjà déployées poussent des « À rappeler » sans date, et elles
    // doivent continuer de passer.
    test('un rappel sans heure s\'enregistre et ne porte pas la clé', () async {
      await repo.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.callback,
        createdById: 'me',
      );

      final CallAttempt attempt =
          (await db.select(db.callAttempts).get()).single;
      expect(attempt.callbackAt, isNull);
      final Map<String, Object?> payload =
          jsonDecode((await allOutbox(db)).single.payload)
              as Map<String, Object?>;
      expect(payload.containsKey('callbackAt'), isFalse);
    });

    // Le serveur refuse une heure sur une autre issue : la retenir localement
    // fabriquerait une opération vouée au refus, trois semaines plus tard.
    test('une heure posée sur une autre issue est écartée', () async {
      await repo.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.refused,
        createdById: 'me',
        callbackAt: DateTime.utc(2026, 8, 13, 9),
      );

      final CallAttempt attempt =
          (await db.select(db.callAttempts).get()).single;
      expect(attempt.callbackAt, isNull);
      final Map<String, Object?> payload =
          jsonDecode((await allOutbox(db)).single.payload)
              as Map<String, Object?>;
      expect(payload.containsKey('callbackAt'), isFalse);
    });

    // ═══ LES RENSEIGNEMENTS DE LA CONVERSION ═══
    //
    // Le serveur refuse l'opération par des codes dédiés. Les mêmes règles sont
    // rejouées ici pour que le refus tombe À LA SAISIE, sur le terrain, et non
    // trois semaines plus tard quand plus personne ne peut corriger.

    test('un rendez-vous sans date est refusé à la saisie', () async {
      expect(
        () => repo.recordCallAttempt(
          prospectId: 'pros-1',
          outcome: CallOutcomes.methodObtained,
          method: EnrollmentMethods.appointment,
          createdById: 'me',
        ),
        throwsA(
          isA<CallAttemptInvalid>().having(
            (CallAttemptInvalid e) => e.problem,
            'problem',
            CallAttemptProblem.rendezVousRequired,
          ),
        ),
      );
    });

    test('une date sur une autre méthode est refusée', () async {
      expect(
        () => repo.recordCallAttempt(
          prospectId: 'pros-1',
          outcome: CallOutcomes.methodObtained,
          method: EnrollmentMethods.platform,
          createdById: 'me',
          rendezVousAt: DateTime.utc(2026, 8, 13, 9),
        ),
        throwsA(
          isA<CallAttemptInvalid>().having(
            (CallAttemptInvalid e) => e.problem,
            'problem',
            CallAttemptProblem.rendezVousNotAllowed,
          ),
        ),
      );
    });

    test('un rendez-vous déjà passé est refusé', () async {
      expect(
        () => repo.recordCallAttempt(
          prospectId: 'pros-1',
          outcome: CallOutcomes.methodObtained,
          method: EnrollmentMethods.appointment,
          createdById: 'me',
          rendezVousAt: t0.subtract(const Duration(hours: 1)),
        ),
        throwsA(
          isA<CallAttemptInvalid>().having(
            (CallAttemptInvalid e) => e.problem,
            'problem',
            CallAttemptProblem.rendezVousPast,
          ),
        ),
      );
    });

    // La tolérance existe parce qu'un téléphone de terrain dérive : sans elle,
    // un rendez-vous « tout de suite » serait refusé pour deux minutes.
    test('un rendez-vous dans la tolérance d\'horloge passe', () async {
      await repo.recordCallAttempt(
        prospectId: 'pros-1',
        outcome: CallOutcomes.methodObtained,
        method: EnrollmentMethods.appointment,
        createdById: 'me',
        rendezVousAt: t0.subtract(const Duration(minutes: 2)),
      );

      final CallAttempt attempt =
          (await db.select(db.callAttempts).get()).single;
      expect(attempt.rendezVousAt, t0.subtract(const Duration(minutes: 2)));
    });

    test('un e-mail mal formé est refusé à la saisie', () async {
      expect(
        () => repo.recordCallAttempt(
          prospectId: 'pros-1',
          outcome: CallOutcomes.methodObtained,
          method: EnrollmentMethods.platform,
          createdById: 'me',
          email: 'awa.sow',
        ),
        throwsA(
          isA<CallAttemptInvalid>().having(
            (CallAttemptInvalid e) => e.problem,
            'problem',
            CallAttemptProblem.emailInvalid,
          ),
        ),
      );
    });

    test('une durée hors bornes est refusée à la saisie', () async {
      expect(
        () => repo.recordCallAttempt(
          prospectId: 'pros-1',
          outcome: CallOutcomes.methodObtained,
          method: EnrollmentMethods.platform,
          createdById: 'me',
          dureeEtablissementMois: 900,
        ),
        throwsA(
          isA<CallAttemptInvalid>().having(
            (CallAttemptInvalid e) => e.problem,
            'problem',
            CallAttemptProblem.dureeEtablissementInvalid,
          ),
        ),
      );
    });

    // Le prospect n'est PAS réécrit en local : c'est le serveur qui pose nom,
    // prénom et référentiels sur la fiche liée, et une copie locale divergerait
    // jusqu'au pull suivant.
    test(
      'l\'identité recueillie part dans l\'opération, pas dans la base',
      () async {
        await repo.recordCallAttempt(
          prospectId: 'pros-1',
          outcome: CallOutcomes.methodObtained,
          method: EnrollmentMethods.platform,
          createdById: 'me',
          nom: 'Sow',
          prenom: 'Awa',
          profession: 'Institutrice',
          banqueId: 'bq-1',
          syndicatId: 'sy-1',
          email: 'awa.sow@exemple.sn',
          fonctionnaire: false,
          engagementEnCours: true,
          dureeEtablissementMois: 0,
        );

        final Map<String, Object?> payload =
            jsonDecode((await allOutbox(db)).single.payload)
                as Map<String, Object?>;
        expect(payload['nom'], 'Sow');
        expect(payload['prenom'], 'Awa');
        expect(payload['profession'], 'Institutrice');
        expect(payload['banqueId'], 'bq-1');
        expect(payload['syndicatId'], 'sy-1');
        // `false` et `0` sont des réponses : les omettre les lirait comme
        // « question non posée ».
        expect(payload['fonctionnaire'], isFalse);
        expect(payload['engagementEnCours'], isTrue);
        expect(payload['dureeEtablissementMois'], 0);

        final CallAttempt attempt =
            (await db.select(db.callAttempts).get()).single;
        expect(attempt.email, 'awa.sow@exemple.sn');
        expect(attempt.fonctionnaire, isFalse);
        expect(attempt.dureeEtablissementMois, 0);
      },
    );

    test('une note vide n\'est pas envoyée', () async {
      await repo.createRepresentant(
        fullName: 'Awa Sy',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
        createdById: 'me',
        notes: '',
      );
      final Map<String, Object?> payload =
          jsonDecode((await allOutbox(db)).single.payload)
              as Map<String, Object?>;
      expect(payload.containsKey('notes'), isFalse);
    });
  });

  group('fil de commentaires', () {
    setUp(() => insertRepresentant(db, id: 'rep-1', phone: '+221770000001'));

    // ═══ LA PROPRIÉTÉ QUI DÉFINIT LE LOT ═══
    //
    // Deux téléconseillers hors ligne qui commentent la même fiche produisent
    // DEUX lignes, jamais une fusion. C'est ce qui rend inutile tout arbitrage :
    // sans écrasement possible, il n'y a rien à départager.
    test(
      'deux auteurs sur la même fiche font deux lignes distinctes',
      () async {
        await repo.addRepresentantComment(
          representantId: 'rep-1',
          body: 'Injoignable le matin.',
          authorId: 'u-1',
          authorName: 'Awa Sy',
        );
        clock.advance(const Duration(minutes: 5));
        await repo.addRepresentantComment(
          representantId: 'rep-1',
          body: 'Rappelle à 15 h.',
          authorId: 'u-2',
          authorName: 'Modou Fall',
        );

        final List<RepresentantComment> fil = await db
            .commentsForRepresentant(representantId: 'rep-1', maxRows: 200)
            .get();
        expect(fil, hasLength(2));
        expect(
          fil.map((RepresentantComment c) => c.body),
          <String>['Rappelle à 15 h.', 'Injoignable le matin.'],
          reason: 'le plus récent en tête',
        );
        expect(fil.map((RepresentantComment c) => c.authorName), <String>[
          'Modou Fall',
          'Awa Sy',
        ]);
      },
    );

    test('le fil ne rend que celui de CETTE fiche', () async {
      await insertRepresentant(db, id: 'rep-2', phone: '+221770000002');
      await repo.addRepresentantComment(
        representantId: 'rep-1',
        body: 'Pour la première fiche.',
        authorId: 'u-1',
        authorName: 'Awa Sy',
      );
      await repo.addRepresentantComment(
        representantId: 'rep-2',
        body: 'Pour la seconde fiche.',
        authorId: 'u-1',
        authorName: 'Awa Sy',
      );

      final List<RepresentantComment> fil = await db
          .commentsForRepresentant(representantId: 'rep-1', maxRows: 200)
          .get();
      expect(fil.single.body, 'Pour la première fiche.');
    });

    test('la ligne écrite n\'a pas encore d\'horodatage serveur', () async {
      final String id = await repo.addRepresentantComment(
        representantId: 'rep-1',
        body: '  Marché de Thiaroye.  ',
        authorId: 'u-1',
        authorName: 'Awa Sy',
      );

      final RepresentantComment c =
          (await db.select(db.representantComments).get()).single;
      expect(c.id, id);
      expect(
        c.body,
        'Marché de Thiaroye.',
        reason: 'les blancs de bord sautent',
      );
      expect(c.clientCreatedAt, t0);
      expect(c.serverCreatedAt, isNull);

      final OutboxData op = (await allOutbox(db)).single;
      expect(op.entityType, 'representant_comment');
      expect(op.entityId, id);
      expect(op.dependencyKey, 'rep-1');
      expect(jsonDecode(op.payload), <String, Object?>{
        'representantId': 'rep-1',
        'body': 'Marché de Thiaroye.',
        'clientCreatedAt': t0.toUtc().toIso8601String(),
      });
    });

    test('un commentaire blanc est refusé au lieu d\'être écrit', () async {
      await expectLater(
        repo.addRepresentantComment(
          representantId: 'rep-1',
          body: '   \n ',
          authorId: 'u-1',
          authorName: 'Awa Sy',
        ),
        throwsA(isA<ArgumentError>()),
      );
      expect(await db.select(db.representantComments).get(), isEmpty);
    });
  });

  group('correction d\'une visite', () {
    Future<String> inscrire() => repo.inscrireVisite(
      visitorName: 'Awa Ndiaye',
      date: '2026-08-12',
      time: '09:12',
      entrepriseId: 'e1',
      entrepriseLabel: 'CPI',
      objetId: 'o1',
      objetLabel: 'ACHAT TERRAIN',
      createdById: 'me',
      comment: 'Venu de : BICIS',
    );

    test('pas encore partie : l\'opération est retirée et la visite '
        'réinscrite', () async {
      final String premier = await inscrire();

      final String second = await repo.corrigerVisiteEnFile(
        visiteId: premier,
        visitorName: 'Awa Ndiaye',
        date: '2026-08-12',
        time: '09:12',
        entrepriseId: 'e1',
        entrepriseLabel: 'CPI',
        objetId: 'o2',
        objetLabel: 'SUIVI DE DOSSIER',
        createdById: 'me',
        comment: 'Venu de : BICIS · rappelé',
      );

      expect(second, isNot(premier));
      final Visite ligne = (await db.select(db.visites).get()).single;
      expect(ligne.id, second, reason: 'l\'ancienne ligne a disparu');
      expect(ligne.objetId, 'o2');
      expect(ligne.comment, 'Venu de : BICIS · rappelé');

      // Une seule opération part : le serveur ne verra jamais la fautive.
      final OutboxData op = (await allOutbox(db)).single;
      expect(op.entityId, second);
      expect(op.op, 'create');
      expect((jsonDecode(op.payload) as Map<String, Object?>)['objetId'], 'o2');
    });

    test('une opération déjà réservée n\'est pas corrigeable', () async {
      final String id = await inscrire();
      await (db.update(
        db.outbox,
      )..where((Outbox o) => o.entityId.equals(id))).write(
        const OutboxCompanion(
          status: Value<String>(OutboxStatus.syncing),
          claimToken: Value<String?>('bail'),
        ),
      );

      await expectLater(
        repo.corrigerVisiteEnFile(
          visiteId: id,
          visitorName: 'Awa Ndiaye',
          date: '2026-08-12',
          entrepriseId: 'e1',
          entrepriseLabel: 'CPI',
          objetId: 'o2',
          objetLabel: 'SUIVI DE DOSSIER',
          createdById: 'me',
        ),
        throwsA(isA<CorrectionVisiteImpossible>()),
      );
      expect((await db.select(db.visites).get()).single.id, id);
      expect(await allOutbox(db), hasLength(1));
    });

    test(
      'déjà partie : la correction se recopie en local, sans file',
      () async {
        await insertVisite(
          db,
          id: 'v-partie',
          date: '2026-08-12',
          time: '09:12',
          reference: 'V-2026-000412',
          destinataireId: 't1',
          destinataireLabel: 'MME. NDOYE',
        );
        clock.advance(const Duration(minutes: 3));

        await repo.appliquerCorrectionVisite(
          visiteId: 'v-partie',
          visitorName: 'Awa Ndiaye Sarr',
          entrepriseId: 'e1',
          entrepriseLabel: 'CPI',
          objetId: 'o2',
          objetLabel: 'SUIVI DE DOSSIER',
          destinataireId: null,
          destinataireLabel: null,
        );

        final Visite ligne = (await db.select(db.visites).get()).single;
        expect(ligne.visitorName, 'Awa Ndiaye Sarr');
        expect(ligne.objetId, 'o2');
        expect(
          ligne.destinataireId,
          isNull,
          reason: 'une personne demandée par erreur doit pouvoir se retirer',
        );
        expect(ligne.reference, 'V-2026-000412');
        expect(ligne.date, '2026-08-12');
        expect(ligne.time, '09:12');
        expect(ligne.updatedAt, t0.add(const Duration(minutes: 3)));
        expect(await allOutbox(db), isEmpty);
      },
    );
  });
}

class _Interrupted implements Exception {
  const _Interrupted();
}
