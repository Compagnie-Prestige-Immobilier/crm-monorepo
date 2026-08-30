import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:gnawalma/main.dart' as app;

import 'journey_helpers.dart';

/// Every journey an atelier owner can take, walked in one run.
///
/// One `testWidgets` for the same reason as the client suite — see the note
/// there.
///
/// Requires the stack up and seeded:
///   docker compose up -d
///   cd apps/api && SEED_DATA=1 npm run seed
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('atelier owner walks every journey', (tester) async {
    await launchApp(tester, () async => app.main(), reset: true);

    await completeOnboarding(tester);
    await chooseSpace(tester, atelier: true);
    await signIn(tester, phone: seededAtelierPhone);

    await waitFor(
      tester,
      find.text('Tableau'),
      because: 'the atelier shell did not open',
    );

    // ── Exactly four destinations, sentence case ──────────────────────────
    for (final label in ['Tableau', 'Commandes', 'Clients', 'Plus']) {
      expect(find.text(label), findsWidgets, reason: '$label tab missing');
    }
    // Le stock n'est plus géré par l'application, et les libellés en
    // capitales ont disparu.
    expect(find.text('Stock'), findsNothing);
    expect(find.text('COMMANDES'), findsNothing);

    // ── Every destination opens ───────────────────────────────────────────
    await tapAndSettle(tester, find.text('Commandes'));
    await waitFor(tester, find.textContaining('ommande'));

    await tapAndSettle(tester, find.text('Clients'));
    await waitFor(tester, find.text('Clients'));

    await tapAndSettle(tester, find.text('Plus'));
    await waitFor(tester, find.text('L’atelier'));

    // ── Se déconnecter est atteignable depuis Plus ────────────────────────
    await waitFor(
      tester,
      find.text('Se déconnecter'),
      because: 'the atelier space must offer a way out of the session',
    );

    // ── Preferences ───────────────────────────────────────────────────────
    await tapAndSettle(tester, find.text('Préférences'));
    await waitFor(
      tester,
      find.textContaining('références'),
      because: 'preferences did not open',
    );
    await goBack(tester);
    await waitFor(tester, find.text('L’atelier'));

    // ── Dashboard again ───────────────────────────────────────────────────
    await tapAndSettle(tester, find.text('Tableau'));
    // "Nouvelle commande", not "Caisse": the cash header renders its label in
    // capitals ("CAISSE DU JOUR"), and `textContaining` matches the widget's
    // data, which is case-sensitive.
    await waitFor(
      tester,
      find.textContaining('Nouvelle commande'),
      because: 'the dashboard did not come back',
    );

    // ── Create a client end to end ────────────────────────────────────────
    await tapAndSettle(tester, find.text('Clients'));
    await waitFor(tester, find.textContaining('Ajouter un client'));
    await tapAndSettle(tester, find.textContaining('Ajouter un client'));

    await waitFor(tester, find.textContaining('Qui est le client'));
    final suffix = DateTime.now().millisecondsSinceEpoch.toString().substring(
      8,
    );
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Awa');
    await tester.pump();
    await tester.enterText(fields.at(1), 'Test$suffix');
    await tester.pump();
    await tapAndSettle(tester, find.text('Continuer'));

    await waitFor(tester, find.textContaining('Comment le contacter'));
    await tester.enterText(find.byType(TextFormField).first, '77 55$suffix');
    // The submit button enables only once the phone validates, so the form
    // needs a frame before the tap — otherwise it lands on a disabled button
    // and the wizard silently stays on step 2.
    await tester.pump(const Duration(milliseconds: 800));
    await tapAndSettle(tester, find.textContaining('Ajouter le client'));

    await waitFor(
      tester,
      find.text('Awa Test$suffix'),
      because: 'the new client did not appear in the list',
    );
  });
}
