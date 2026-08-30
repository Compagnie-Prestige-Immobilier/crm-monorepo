import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/phase2/presentation/callback_picker.dart';
import 'package:cpi_go/features/phase2/presentation/phase2_screen.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

/// QA formulaires : la conversion (phase 2) et le choix de l'heure d'un rappel.
void main() {
  // ── FOR-05 ────────────────────────────────────────────────────────────────
  // Le motif du client (`write_repository.dart:29`) autorise un domaine de
  // premier niveau d'UNE lettre. Le serveur applique `@IsEmail()` (validator.js,
  // TLD de deux lettres au moins) puis `EMAIL_PATTERN`
  // (`apps/api/src/modules/phase2/attempt-rules.ts:37`), et refuse.
  test('une adresse dont le domaine finit par une seule lettre est acceptée', () {
    expect(WriteRepository.validateCallAttemptEmail('awa@exemple.s'), isNull);
    expect(WriteRepository.validateCallAttemptEmail('awa@exemple.sn'), isNull);

    final Phase2FormFields champs = Phase2FormFields();
    addTearDown(champs.dispose);
    champs.email.text = 'awa@exemple.s';
    expect(
      champs.erreurEmail,
      isNull,
      reason: 'aucun reproche sous le champ, aucune retenue à l\'étape 2',
    );
    expect(champs.manque, isNull);
  });

  // ── FOR-07 ────────────────────────────────────────────────────────────────
  // La puce choisie ne vit que dans l'état du sélecteur, et sa sélection se lit
  // par égalité d'INSTANT. Un parent qui se reconstruit avec un « maintenant »
  // plus tard recalcule « Dans 1 h » sur une autre minute : la puce s'éteint,
  // alors que l'heure promise, elle, reste posée chez l'appelant.
  testWidgets('la puce « Dans 1 h » s\'éteint toute seule à la minute suivante', (
    WidgetTester tester,
  ) async {
    DateTime maintenant = DateTime.utc(2026, 8, 30, 10, 0);
    final List<DateTime?> recus = <DateTime?>[];
    late StateSetter refaire;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        home: Scaffold(
          body: StatefulBuilder(
            builder: (BuildContext context, StateSetter setState) {
              refaire = setState;
              return CallbackPicker(
                now: maintenant,
                required: true,
                onChanged: recus.add,
              );
            },
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Dans 1 h'));
    await tester.pumpAndSettle();

    Iterable<String> choisies() => tester
        .widgetList<CallbackPill>(find.byType(CallbackPill))
        .where((CallbackPill p) => p.selected)
        .map((CallbackPill p) => p.label);

    expect(choisies(), <String>['Dans 1 h']);
    expect(recus.single, DateTime.utc(2026, 8, 30, 11, 0));

    // Une minute plus tard, n'importe quelle reconstruction du parent : l'écran
    // de qualification passe `DateTime.now()` à chaque `build`.
    refaire(() => maintenant = DateTime.utc(2026, 8, 30, 10, 1));
    await tester.pumpAndSettle();

    expect(
      choisies(),
      isEmpty,
      reason: 'plus rien n\'est montré comme choisi',
    );
    expect(
      recus,
      <DateTime>[DateTime.utc(2026, 8, 30, 11, 0)],
      reason: 'l\'heure promise est pourtant toujours celle qui partira',
    );
  });
}
