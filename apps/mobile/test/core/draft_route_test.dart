import 'package:cpi_go/core/drafts/draft_form_mixin.dart';
import 'package:cpi_go/core/router/route_memory.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/draft_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/db_fixture.dart';

/// Le trou que ces tests bouchent : la mémoire de route savait déjà conserver
/// `?draft=<id>` — un test le vérifiait — mais **aucun écran ne produisait
/// jamais une telle URL**. `Routes.newRepresentantWithDraft` n'avait pas un seul
/// appelant. Le brouillon était bien écrit en base, sous un identifiant tiré au
/// hasard et gardé en mémoire ; au redémarrage l'écran en tirait un second et
/// cherchait sous une clé qui n'avait jamais servi. Le formulaire revenait vide.
///
/// Vérifier la mémoire de route sur une URL écrite à la main ne pouvait pas
/// attraper ça : il faut vérifier que l'app **émet** l'URL.
void main() {
  late AppDatabase db;

  setUp(() async => db = await openTestDatabase());
  tearDown(() async => db.close());

  testWidgets('un formulaire de création publie ?draft=<id> dans l\'URL', (
    WidgetTester tester,
  ) async {
    final GoRouter router = _router(DraftRepository(db));
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    final String location = router.routerDelegate.currentConfiguration.uri
        .toString();
    expect(
      Uri.parse(location).queryParameters[Routes.draftParam],
      'draft-42',
      reason: 'sans référence dans l\'URL, la restauration cherche à vide',
    );
  });

  testWidgets('l\'URL publiée reste mémorisable par RouteMemory', (
    WidgetTester tester,
  ) async {
    final GoRouter router = _router(DraftRepository(db));
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    final String location = router.routerDelegate.currentConfiguration.uri
        .toString();
    // Publier une URL que la liste blanche rejette reviendrait à ne rien
    // publier du tout.
    expect(RouteMemory.isRestorable(location), isTrue);
  });

  testWidgets('une URL qui porte déjà la référence n\'est pas resubstituée', (
    WidgetTester tester,
  ) async {
    final GoRouter router = _router(
      DraftRepository(db),
      initial: Routes.newRepresentantWithDraft('deja-la'),
    );
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    expect(
      Uri.parse(
        router.routerDelegate.currentConfiguration.uri.toString(),
      ).queryParameters[Routes.draftParam],
      'deja-la',
    );
  });
}

GoRouter _router(DraftRepository repository, {String? initial}) {
  return GoRouter(
    initialLocation: initial ?? Routes.newRepresentant,
    routes: <RouteBase>[
      GoRoute(
        path: Routes.newRepresentant,
        builder: (BuildContext context, GoRouterState state) => _CreateForm(
          repository: repository,
          draftIdFromUrl: state.uri.queryParameters[Routes.draftParam],
        ),
      ),
    ],
  );
}

/// Reproduit le contrat des deux écrans réels : un identifiant venu de l'URL, ou
/// un neuf tiré à la construction.
class _CreateForm extends StatefulWidget {
  const _CreateForm({required this.repository, this.draftIdFromUrl});

  final DraftRepository repository;
  final String? draftIdFromUrl;

  @override
  State<_CreateForm> createState() => _CreateFormState();
}

class _CreateFormState extends State<_CreateForm>
    with DraftFormMixin<_CreateForm> {
  late final String _draftId = widget.draftIdFromUrl ?? 'draft-42';

  @override
  String get draftId => _draftId;

  @override
  String get draftFormKey => 'representant.create';

  @override
  DraftRepository get draftRepository => widget.repository;

  @override
  bool get draftIsEmpty => true;

  @override
  Map<String, Object?> collectDraftValues() => const <String, Object?>{};

  @override
  String? draftRouteWithId() => widget.draftIdFromUrl == null
      ? Routes.newRepresentantWithDraft(_draftId)
      : null;

  @override
  Widget build(BuildContext context) => const Scaffold(body: SizedBox.shrink());
}
