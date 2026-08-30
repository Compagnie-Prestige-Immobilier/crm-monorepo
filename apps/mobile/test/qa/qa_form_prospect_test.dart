import 'dart:convert';

import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/prospect/presentation/prospect_entry_screen.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// QA formulaires : ce que la saisie d'un prospect laisse passer.
///
/// Chaque test compare ce que l'écran ACCEPTE à ce que le serveur ADMET
/// (`apps/api/src/modules/sync/dto.ts`, `apps/api/src/common/phone.ts`).
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    db = await openTestDatabase();
    api = FakeApi();
    await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
  });

  tearDown(() => db.close());

  Widget host(Widget screen) => ProviderScope(
    overrides: <Override>[
      appDatabaseProvider.overrideWithValue(db),
      apiPortProvider.overrideWithValue(api),
      tokenStoreProvider.overrideWithValue(
        InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
      ),
      syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
    ],
    child: MaterialApp(
      theme: AppTheme.light,
      locale: const Locale('fr'),
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      supportedLocales: const <Locale>[Locale('fr')],
      home: screen,
    ),
  );

  Finder champ(String label) => find.descendant(
    of: find.ancestor(of: find.text(label), matching: find.byType(FTextField)),
    matching: find.byType(TextField),
  );

  CpiButton bouton(WidgetTester tester, String label) => tester
      .widget<CpiButton>(
        find.byWidgetPredicate((Widget w) => w is CpiButton && w.label == label),
      );

  Future<void> ouvrir(WidgetTester tester, Widget screen) async {
    tester.view.physicalSize = const Size(1080, 4000);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(host(screen));
    await tester.pumpAndSettle();
  }

  Future<void> demonter(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  Future<Map<String, Object?>> chargeUtile() async {
    final List<OutboxData> rows = await allOutbox(db);
    final OutboxData prospect = rows.firstWhere(
      (OutboxData r) => r.entityType == 'prospect',
    );
    return jsonDecode(prospect.payload) as Map<String, Object?>;
  }

  Future<void> saisir(WidgetTester tester, String label, String valeur) async {
    await tester.enterText(champ(label), valeur);
    await tester.pump();
  }

  Future<void> continuer(WidgetTester tester) async {
    await tester.tap(find.text('Continuer'));
    await tester.pumpAndSettle();
  }

  Future<void> enregistrerEtSuivant(WidgetTester tester) async {
    await tester.tap(find.text('Enregistrer et suivant'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  // ── FOR-01 ────────────────────────────────────────────────────────────────
  // `SyncEntityDataDto.nom` : @MaxLength(120). Le champ n'a aucun `maxLength`.
  testWidgets('un nom de 121 caractères s\'enregistre et part dans le lot', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester, const ProspectEntryScreen(representantId: 'rep-1'));

    final String trop = 'A' * 121;
    await saisir(tester, 'Nom', trop);
    await saisir(tester, 'Téléphone', '77 123 45 67');
    await tester.pump();

    expect(
      bouton(tester, 'Continuer').onPressed,
      isNotNull,
      reason: 'aucun reproche sur un nom que le serveur refusera',
    );
    await continuer(tester);
    await enregistrerEtSuivant(tester);

    final Prospect ligne = (await db.select(db.prospects).get()).single;
    expect(ligne.nom.length, 121);
    expect((await chargeUtile())['nom'], trop);

    await demonter(tester);
  });

  // ── FOR-02 ────────────────────────────────────────────────────────────────
  // `SyncEntityDataDto.dureeSystemeMois` : @Min(1) @Max(600). Le champ n'a ni
  // borne ni limite de longueur, et `int.tryParse` prend tout.
  testWidgets('l\'ancienneté à 0 mois puis à 9999 mois part telle quelle', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester, const ProspectEntryScreen(projet: 'GRAND_PUBLIC'));

    await saisir(tester, 'Nom', 'Sarr');
    await saisir(tester, 'Téléphone', '77 123 45 67');
    await tester.tap(find.text('Fonctionnaire'));
    await tester.pumpAndSettle();
    await continuer(tester);

    await saisir(tester, 'Ancienneté', '0');
    await continuer(tester);
    await enregistrerEtSuivant(tester);

    expect((await chargeUtile())['dureeSystemeMois'], 0);

    await demonter(tester);
  });

  testWidgets('une ancienneté de 9999 mois passe aussi', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester, const ProspectEntryScreen(projet: 'GRAND_PUBLIC'));

    await saisir(tester, 'Nom', 'Sarr');
    await saisir(tester, 'Téléphone', '77 123 45 68');
    await tester.tap(find.text('Fonctionnaire'));
    await tester.pumpAndSettle();
    await continuer(tester);

    await saisir(tester, 'Ancienneté', '9999');
    await continuer(tester);
    await enregistrerEtSuivant(tester);

    expect((await chargeUtile())['dureeSystemeMois'], 9999);

    await demonter(tester);
  });

  // ── FOR-03 ────────────────────────────────────────────────────────────────
  // `SyncEntityDataDto.profession` : @MaxLength(120). Le même champ est borné
  // à 120 sur la fiche représentant et dans la conversion, pas ici.
  testWidgets('une profession de 121 caractères part dans le lot', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester, const ProspectEntryScreen(projet: 'GRAND_PUBLIC'));

    await saisir(tester, 'Nom', 'Sarr');
    await saisir(tester, 'Téléphone', '77 123 45 69');
    await tester.tap(find.text('Fonctionnaire'));
    await tester.pumpAndSettle();
    await continuer(tester);

    final String trop = 'B' * 121;
    await saisir(tester, 'Profession', trop);
    await continuer(tester);
    await enregistrerEtSuivant(tester);

    expect(((await chargeUtile())['profession']! as String).length, 121);

    await demonter(tester);
  });

  // ── FOR-04 ────────────────────────────────────────────────────────────────
  // Le champ strict jette le « + » et coupe à neuf chiffres : un numéro déjà
  // écrit à l'internationale devient un AUTRE numéro, accepté sur un simple
  // avertissement de préfixe.
  testWidgets('coller « +221 77 123 45 67 » enregistre +221221771234', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester, const ProspectEntryScreen(representantId: 'rep-1'));

    await saisir(tester, 'Nom', 'Sarr');
    await saisir(tester, 'Téléphone', '+221 77 123 45 67');
    await tester.pump();

    expect(
      tester.widget<TextField>(champ('Téléphone')).controller!.text,
      '22 177 12 34',
      reason: 'le masque a mangé l\'indicatif et coupé les deux derniers '
          'chiffres',
    );
    expect(
      find.text('Préfixe inhabituel : vérifiez le numéro. Il sera enregistré.'),
      findsOneWidget,
    );
    expect(bouton(tester, 'Continuer').onPressed, isNotNull);

    await continuer(tester);
    await enregistrerEtSuivant(tester);

    final Prospect ligne = (await db.select(db.prospects).get()).single;
    expect(
      ligne.phoneE164,
      '+221221771234',
      reason: 'le serveur répond PHONE_INVALID sur ce numéro',
    );

    await demonter(tester);
  });
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
