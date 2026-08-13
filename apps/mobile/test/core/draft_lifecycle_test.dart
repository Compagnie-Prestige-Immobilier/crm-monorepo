import 'package:cpi_go/core/drafts/draft_debouncer.dart';
import 'package:cpi_go/core/drafts/draft_form_mixin.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/draft_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';

void main() {
  group('DraftDebouncer', () {
    testWidgets('400 ms de traîne : quinze frappes, une seule écriture', (
      WidgetTester tester,
    ) async {
      int writes = 0;
      final DraftDebouncer d = DraftDebouncer(onFlush: () async => writes++);
      for (int i = 0; i < 15; i++) {
        d.touch();
        await tester.pump(const Duration(milliseconds: 100));
      }
      // Quinze écritures SQLite en 1,5 s sur un Tecno d'entrée de gamme, c'est
      // un formulaire qui saccade.
      expect(writes, 0);
      await tester.pump(const Duration(milliseconds: 500));
      expect(writes, 1);
      await d.dispose();
    });

    testWidgets('3 s d\'attente maximale : une frappe lente est sauvegardée', (
      WidgetTester tester,
    ) async {
      int writes = 0;
      final DraftDebouncer d = DraftDebouncer(onFlush: () async => writes++);
      // Une frappe toutes les 300 ms : la traîne de 400 ms ne se déclenche
      // JAMAIS. Sans l'attente maximale, cet utilisateur — celui dont on veut le
      // plus protéger la saisie — ne serait jamais sauvegardé.
      for (int i = 0; i < 12; i++) {
        d.touch();
        await tester.pump(const Duration(milliseconds: 300));
      }
      expect(writes, greaterThanOrEqualTo(1));
      await d.dispose();
    });

    testWidgets('discard() abandonne sans écrire', (WidgetTester tester) async {
      int writes = 0;
      final DraftDebouncer d = DraftDebouncer(onFlush: () async => writes++);
      d.touch();
      expect(d.isDirty, isTrue);
      d.discard();
      expect(d.isDirty, isFalse);
      await tester.pump(const Duration(seconds: 5));
      // Le brouillon vient d'être supprimé dans la transaction d'écriture ; le
      // réécrire le ressusciterait.
      expect(writes, 0);
      await d.dispose();
    });

    testWidgets('flush() sans modification n\'écrit rien', (WidgetTester tester) async {
      int writes = 0;
      final DraftDebouncer d = DraftDebouncer(onFlush: () async => writes++);
      await d.flush();
      expect(writes, 0);
      await d.dispose();
    });

    testWidgets('dispose() vide d\'abord', (WidgetTester tester) async {
      int writes = 0;
      final DraftDebouncer d = DraftDebouncer(onFlush: () async => writes++);
      d.touch();
      // Quitter l'écran par le bouton retour ne doit pas perdre les 400
      // dernières millisecondes de frappe.
      await d.dispose();
      expect(writes, 1);
    });
  });

  group('DraftFormMixin — vidange sur AppLifecycleState.inactive', () {
    late AppDatabase db;
    late DraftRepository drafts;

    setUp(() async {
      db = await openTestDatabase();
      drafts = DraftRepository(db, clock: FakeClock(t0));
    });
    tearDown(() => db.close());

    Future<void> pumpForm(WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(home: _DraftForm(repository: drafts)));
      // L'écran démarre au premier plan.
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
    }

    testWidgets('`inactive` écrit le brouillon — `paused` serait trop tard', (
      WidgetTester tester,
    ) async {
      await pumpForm(tester);
      await tester.enterText(find.byType(TextField), 'Mamadou');
      await tester.pump();

      // Rien n'est encore écrit : la traîne court.
      expect(await drafts.read('d-test'), isNull);

      // `inactive` est émis AVANT `paused` : sélecteur d'app, appel entrant,
      // écran verrouillé. Sur les ROM Transsion et Xiaomi, le processus peut
      // être tué avant que `paused` n'ait rendu la main à Dart.
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pumpAndSettle();

      final DraftSnapshot? snapshot = await drafts.read('d-test');
      expect(
        snapshot,
        isNotNull,
        reason: 'flusher à `paused` serait déjà trop tard une fois sur dix',
      );
      expect(snapshot!.values['fullName'], 'Mamadou');
      expect(snapshot.formKey, 'representant.create');
      expect(snapshot.step, 1);
      expect(snapshot.parentId, 'rep-parent');
      // Moins de 60 s : restauration silencieuse, sans poser de question.
      expect(snapshot.age, DraftAge.crash);
    });

    testWidgets('l\'app n\'atteint JAMAIS `paused` et la saisie est déjà sauve', (
      WidgetTester tester,
    ) async {
      await pumpForm(tester);
      await tester.enterText(find.byType(TextField), 'Fatou');
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pumpAndSettle();

      // Le système tue le processus ici : `paused` ne sera jamais délivré.
      expect((await drafts.read('d-test'))!.values['fullName'], 'Fatou');
    });

    testWidgets('quitter l\'écran vide aussi le brouillon', (WidgetTester tester) async {
      await pumpForm(tester);
      await tester.enterText(find.byType(TextField), 'Ousmane');
      await tester.pump();
      await tester.pumpWidget(const MaterialApp(home: SizedBox.shrink()));
      await tester.pumpAndSettle();
      expect((await drafts.read('d-test'))!.values['fullName'], 'Ousmane');
    });

    testWidgets('un formulaire vide ne crée pas de brouillon', (
      WidgetTester tester,
    ) async {
      await pumpForm(tester);
      final _DraftFormState state = tester.state<_DraftFormState>(
        find.byType(_DraftForm),
      );
      state.markDraftDirty();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pumpAndSettle();
      // On ne crée pas un brouillon pour un écran seulement ouvert puis refermé.
      expect(await drafts.read('d-test'), isNull);
    });

    testWidgets('après enregistrement, le brouillon ne ressuscite pas', (
      WidgetTester tester,
    ) async {
      await pumpForm(tester);
      await tester.enterText(find.byType(TextField), 'Aminata');
      await tester.pump();
      tester.state<_DraftFormState>(find.byType(_DraftForm)).discardDraft();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pumpAndSettle();
      expect(await drafts.read('d-test'), isNull);
    });
  });

  group('DraftRepository', () {
    late AppDatabase db;
    late FakeClock clock;
    late DraftRepository drafts;

    setUp(() async {
      db = await openTestDatabase();
      clock = FakeClock(t0);
      drafts = DraftRepository(db, clock: clock);
    });
    tearDown(() => db.close());

    test('moins de 60 s : reprise silencieuse', () async {
      await drafts.save(
        draftId: 'd1',
        formKey: 'representant.create',
        values: <String, Object?>{'fullName': 'A'},
      );
      clock.advance(const Duration(seconds: 30));
      expect((await drafts.read('d1'))!.age, DraftAge.crash);
    });

    test('au-delà de 60 s : on propose, sans bloquer', () async {
      await drafts.save(
        draftId: 'd1',
        formKey: 'representant.create',
        values: <String, Object?>{'fullName': 'A'},
      );
      clock.advance(const Duration(minutes: 5));
      expect((await drafts.read('d1'))!.age, DraftAge.resumable);
    });

    test('au-delà de 7 jours : supprimé à la lecture', () async {
      await drafts.save(
        draftId: 'd1',
        formKey: 'representant.create',
        values: <String, Object?>{'fullName': 'A'},
      );
      clock.advance(const Duration(days: 8));
      expect(await drafts.read('d1'), isNull);
      expect(await db.select(db.formDrafts).get(), isEmpty);
    });

    test('un brouillon illisible est jeté, pas relevé en exception', () async {
      // Relu à chaque ouverture, il rendrait l'app DÉFINITIVEMENT inutilisable
      // pour cet utilisateur s'il remontait en exception.
      await db
          .into(db.formDrafts)
          .insert(
            FormDraftsCompanion.insert(
              draftId: 'd1',
              formKey: 'representant.create',
              payload: 'ceci n\'est pas du JSON',
              updatedAt: t0,
            ),
          );
      expect(await drafts.read('d1'), isNull);
      expect(await db.select(db.formDrafts).get(), isEmpty);
    });

    test('purgeStale nettoie au démarrage', () async {
      await drafts.save(
        draftId: 'vieux',
        formKey: 'representant.create',
        values: <String, Object?>{},
      );
      clock.advance(const Duration(days: 8));
      await drafts.save(
        draftId: 'recent',
        formKey: 'representant.create',
        values: <String, Object?>{},
      );
      expect(await drafts.purgeStale(), 1);
      expect((await db.select(db.formDrafts).get()).single.draftId, 'recent');
    });
  });
}

/// Harnais minimal : un champ, le mixin, rien d'autre.
class _DraftForm extends StatefulWidget {
  const _DraftForm({required this.repository});

  final DraftRepository repository;

  @override
  State<_DraftForm> createState() => _DraftFormState();
}

class _DraftFormState extends State<_DraftForm> with DraftFormMixin<_DraftForm> {
  final TextEditingController _controller = TextEditingController();

  @override
  String get draftId => 'd-test';

  @override
  String get draftFormKey => 'representant.create';

  @override
  int get draftStep => 1;

  @override
  String? get draftParentId => 'rep-parent';

  @override
  DraftRepository get draftRepository => widget.repository;

  @override
  bool get draftIsEmpty => _controller.text.trim().isEmpty;

  @override
  Map<String, Object?> collectDraftValues() => <String, Object?>{
    'fullName': _controller.text,
  };

  @override
  void dispose() {
    // Le mixin vide le brouillon dans `super.dispose()` ; libérer le contrôleur
    // avant lui ferait lire un contrôleur détruit.
    super.dispose();
    _controller.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: TextField(controller: _controller, onChanged: (String _) => markDraftDirty()),
    );
  }
}
