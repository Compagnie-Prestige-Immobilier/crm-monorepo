import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:gnawalma/main.dart' as app;

import 'journey_helpers.dart';

/// Every journey a client can take, walked in one run against the live API.
///
/// **One `testWidgets`, not one per journey.** `main()` is not idempotent — it
/// initialises Hive and Isar and registers the GetIt graph — so calling it once
/// per test left the app stuck on its native splash from the second test
/// onwards, with no error and no progress. A person uses the app in one
/// continuous session, and that is what this reproduces.
///
/// Requires the stack up and seeded:
///   docker compose up -d
///   cd apps/api && SEED_DATA=1 npm run seed
///
/// Run with:
///   flutter test integration_test/client_journey_test.dart -d DEVICE_ID
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('client walks every journey', (tester) async {
    await launchApp(tester, () async => app.main(), reset: true);

    // ── Onboarding, space choice, sign-in ─────────────────────────────────
    await completeOnboarding(tester);
    await chooseSpace(tester, atelier: false);
    await signIn(tester, phone: seededClientPhone);

    // ── The home is a discovery surface ───────────────────────────────────
    await waitFor(
      tester,
      find.text('Chercher un atelier'),
      because: 'the persistent search field should be on Accueil',
    );
    expect(find.text('Ateliers autour de vous'), findsOneWidget);

    // The feed must resolve to real ateliers, not the error panel. This is the
    // assertion that would have caught the marketplace answering 500 to every
    // request.
    await waitFor(
      tester,
      find.text(seededAtelierName),
      because: 'the nearby feed did not load — is the API seeded?',
    );
    expect(
      find.text('Ateliers non chargés'),
      findsNothing,
      reason: 'the feed rendered its error state',
    );

    // ── Exactly four destinations ─────────────────────────────────────────
    for (final label in ['Accueil', 'Favoris', 'Activité', 'Profil']) {
      expect(find.text(label), findsWidgets, reason: '$label tab missing');
    }
    // Search is a field on Accueil, not a fifth destination.
    expect(find.text('Rechercher'), findsNothing);

    // ── Search opens, and back returns home ───────────────────────────────
    await tapAndSettle(tester, find.text('Chercher un atelier'));
    await waitFor(tester, find.text('Trouver un atelier'));
    await waitFor(
      tester,
      find.text(seededAtelierName),
      because: 'unfiltered search returned nothing',
    );
    await goBack(tester);
    // Anchor on the pinned search header, not the location row: the feed keeps
    // its scroll position, so the top of the list may well be off-screen when
    // we come back — a home screen that is working perfectly.
    await waitFor(
      tester,
      find.text('Chercher un atelier'),
      because: 'back from search should return to Accueil',
    );

    // ── A category chip actually filters ──────────────────────────────────
    // Every tile used to share one callback and pass no filter, so all six
    // opened the same unfiltered list.
    // Back to the top first: the feed keeps its scroll position across
    // navigation, and the category rail lives near the top of the page. Tapping
    // a chip while the page is scrolled resolves to an offset outside the
    // viewport and silently does nothing.
    await scrollBy(tester, 900);
    await scrollBy(tester, 900);
    // The first chip in the rail, so it is always within the viewport.
    await tapChip(tester, 'Sur mesure');
    await waitFor(tester, find.text('Trouver un atelier'));
    await waitFor(
      tester,
      find.textContaining('ATELIERS TROUVÉS'),
      because: 'the category did not produce a result count',
    );
    expect(
      find.text('Ndiaye Sur Mesure'),
      findsWidgets,
      reason: '"Sur mesure" should match a seeded atelier',
    );
    await goBack(tester);
    await waitFor(tester, find.text('Chercher un atelier'));

    // ── Atelier detail opens from the feed ────────────────────────────────
    await tapAndSettle(tester, find.text(seededAtelierName));
    // The contact bar renders channel-specific actions ("Écrire sur WhatsApp",
    // "Appeler"), so it is not a stable marker. The specialties section is on
    // every profile.
    await waitFor(
      tester,
      find.text('Spécialités'),
      because: 'the atelier profile did not open',
    );
    await goBack(tester);
    await waitFor(tester, find.text('Chercher un atelier'));

    // ── Favourite from a card, then check Favoris ─────────────────────────
    // The icon, not the tooltip: `byTooltip` resolves to the Tooltip's layout
    // surrogate, whose centre hit-tests to a different widget entirely.
    // `.first` is the top card, so the assertion below knows which atelier to
    // look for.
    final heart = find.byIcon(Icons.favorite_border_rounded).first;
    // Safe here, unlike on the chip rail: the feed scrolls vertically, so
    // revealing a card does not remove it from the tree.
    await tester.ensureVisible(heart);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(heart);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));

    await tapAndSettle(tester, find.text('Favoris'));
    await waitFor(
      tester,
      find.text('Ateliers favoris'),
      because: 'the Favoris destination did not open',
    );
    // Wait for the saved atelier rather than asserting the empty state is
    // absent: the list loads asynchronously, so the empty panel is briefly the
    // honest answer and an immediate `findsNothing` races it.
    await waitFor(
      tester,
      find.text(seededAtelierName),
      because: 'the favourite was not persisted',
    );

    // ── Activity and profile ──────────────────────────────────────────────
    await tapAndSettle(tester, find.text('Activité'));
    await waitFor(tester, find.text('Votre activité'));

    await tapAndSettle(tester, find.text('Profil'));
    await waitFor(tester, find.text('Votre profil'));

    // ── Back to the start of the loop ─────────────────────────────────────
    await tapAndSettle(tester, find.text('Accueil'));
    await waitFor(tester, find.text('Chercher un atelier'));
  });
}
