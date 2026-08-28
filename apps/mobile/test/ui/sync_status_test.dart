import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/ui/widgets/sync_status_icon.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Future<void> monte(
    WidgetTester tester,
    Widget child, {
    double textScale = 1,
    double width = 320,
  }) async {
    tester.view.physicalSize = Size(width, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: MediaQuery(
          data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
          child: Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 120),
                child: child,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  // « À corriger » fait 27 caractères dans un Row en
  // MainAxisSize.min : le seul débordement réel du dépôt Flutter.
  testWidgets('le plus long libellé ne déborde pas, même à 1,76x', (
    WidgetTester tester,
  ) async {
    await monte(
      tester,
      const SyncStatusChip(status: SyncStatus.blocked),
      textScale: 1.76,
    );
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('l\'icône nue dit ce que signifie le nuage barré', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await monte(tester, const SyncStatusIcon(status: SyncStatus.blocked));

    expect(
      find.bySemanticsLabel('État de synchronisation : À corriger'),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    handle.dispose();
  });

  testWidgets('la puce ne double pas l\'annonce', (WidgetTester tester) async {
    await monte(tester, const SyncStatusChip(status: SyncStatus.blocked));

    // Le libellé est déjà écrit et la puce porte sa propre étiquette : une
    // seconde sur l'icône ferait annoncer l'état deux fois de suite.
    expect(find.text('À corriger'), findsOneWidget);
    expect(
      tester.widget<SyncStatusIcon>(find.byType(SyncStatusIcon)).labelled,
      isFalse,
    );

    await tester.pumpWidget(const SizedBox.shrink());
  });
}
