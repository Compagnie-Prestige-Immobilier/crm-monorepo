import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

/// Shared steps for the end-to-end journeys.
///
/// Every helper here waits for a condition rather than sleeping. The suite this
/// replaces was built for screen recording and paced itself with fixed
/// `pump(Duration(seconds: 8))` calls, which made it both slow and flaky: on a
/// loaded machine the frame budget slipped and the assertion ran before the
/// screen had arrived.

/// Seeded accounts (`apps/api/scripts/seed-dev.sql`). PIN is 1234 for all.
const seededClientPhone = '+221781000001';
const seededAtelierPhone = '+221770000001';
const seededPin = '1234';

/// The *nearest* verified atelier to the default Dakar coordinates (951 m).
///
/// Deliberately the closest one: the feed sorts by availability then distance
/// and builds lazily, so only the first cards exist in the tree. Asserting on
/// an atelier further down the list fails on a screen that is working
/// perfectly — which is exactly what the first run of this suite reported.
const seededAtelierName = 'Aïssatou Bazin';

/// A seeded atelier whose specialties include "Retouches".
const seededRetoucheAtelier = 'Camara Broderie';

/// Clears stored state and starts the app, from onboarding.
///
/// `main()` awaits real plugin work — Hive, Isar, secure storage — before it
/// calls `runApp`. Those futures only resolve on the real event loop, so
/// launching with a bare `app.main()` leaves the app on its native splash for
/// the whole test: the Dart side never reaches its first frame, and every
/// `waitFor` then times out against a screen with no widgets on it.
///
/// [WidgetTester.runAsync] is what lets that initialisation actually run.
Future<void> launchApp(
  WidgetTester tester,
  Future<void> Function() entry, {
  bool reset = false,
}) async {
  await tester.runAsync(() async {
    if (reset) await const FlutterSecureStorage().deleteAll();
    await entry();
  });
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

/// Brings the app to a signed-in state in the requested space.
///
/// Only clears storage when it has to. Wiping it before every test forced each
/// one back through onboarding, space selection and a network sign-in; on a
/// phone-sized emulator that is a few seconds, but on a high-density AVD it was
/// enough work to trip Android's own "System UI isn't responding" watchdog
/// mid-suite. Once signed in, later tests resume the stored session and start
/// at the shell.
Future<void> enterSpace(
  WidgetTester tester,
  Future<void> Function() entry, {
  required bool atelier,
  bool fresh = false,
}) async {
  await launchApp(tester, entry, reset: fresh);

  final landed = atelier ? find.text('Tableau') : find.text('Accueil');
  if (await appears(tester, landed, timeout: const Duration(seconds: 12))) {
    return;
  }

  await completeOnboarding(tester);
  await chooseSpace(tester, atelier: atelier);
  await signIn(tester, phone: atelier ? seededAtelierPhone : seededClientPhone);
  await waitFor(
    tester,
    landed,
    because:
        'sign-in did not reach the ${atelier ? 'atelier' : 'client'} shell',
  );
}

/// Pumps until [finder] matches, or fails with the current screen's text.
///
/// Reports what *was* on screen when it gave up — a bare "timed out waiting for
/// X" tells you nothing about where the app actually went.
Future<void> waitFor(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 30),
  String? because,
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finder.evaluate().isNotEmpty) return;
  }

  final onScreen = tester
      .widgetList<Text>(find.byType(Text))
      .map((widget) => widget.data)
      .whereType<String>()
      .where((value) => value.trim().isNotEmpty)
      .take(25)
      .join(' | ');
  fail(
    'Timed out after ${timeout.inSeconds}s waiting for $finder'
    '${because == null ? '' : ' ($because)'}.\nOn screen: $onScreen',
  );
}

/// True when [finder] appears within [timeout], without failing if it does not.
Future<bool> appears(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 8),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finder.evaluate().isNotEmpty) return true;
  }
  return false;
}

/// Taps [finder] once it is present, scrolling it into view first.
///
/// The scroll matters: the category rail and several lists extend past the
/// viewport, so a chip can exist in the tree while being unhittable. Tapping it
/// with `warnIfMissed: false` then does nothing at all, and the failure surfaces
/// several steps later as "the screen I expected never appeared" — which is how
/// a working category filter looked broken.
Future<void> tapAndSettle(WidgetTester tester, Finder finder) async {
  await waitFor(tester, finder);
  final target = finder.last;
  try {
    await tester.ensureVisible(target);
    await tester.pump(const Duration(milliseconds: 200));
  } catch (_) {
    // Not inside a scrollable; tapping directly is fine.
  }
  await tester.tap(target);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
}

/// Taps a Material chip by its label.
///
/// `find.text('…')` resolves to the label's `RenderParagraph`, which is not the
/// chip's hit target — tapping it reports "the finder was not hit" and nothing
/// happens. Both `ActionChip` (the home rail) and `FilterChip` (the search
/// screen) build a `RawChip`, so that is what gets tapped.
///
/// Only chips already within the rail's viewport can be tapped; the caller
/// should pick one rather than rely on the rail scrolling.
Future<void> tapChip(WidgetTester tester, String label) async {
  final chip = find.ancestor(
    of: find.text(label),
    matching: find.byType(RawChip),
  );
  await waitFor(tester, chip, because: 'no chip labelled "$label"');
  // No `ensureVisible` here. The rail sits near the top of the page, and
  // scrolling to "reveal" a chip pushes the rail itself out of the viewport —
  // the chip is then disposed and the tap fails with "Bad state: No element".
  await tester.tap(chip.first);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
}

/// Goes back one screen.
///
/// `tester.pageBack()` requires a `CupertinoNavigationBarBackButton` (or its
/// Material twin) and fails outright when a screen supplies its own — the
/// atelier profile draws a tooltipped icon button inside a `SliverAppBar`, so
/// the built-in helper cannot find anything to press. Tries the app's own
/// affordances first, then falls back.
Future<void> goBack(WidgetTester tester) async {
  for (final tooltip in const ['Retour', 'Back']) {
    final button = find.byTooltip(tooltip);
    if (button.evaluate().isNotEmpty) {
      await tester.tap(button.last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      return;
    }
  }
  // No visible affordance — several atelier screens rely on the platform back
  // gesture. `handlePopRoute` is that gesture, and works whatever the AppBar
  // happens to draw.
  await tester.binding.handlePopRoute();
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
}

/// Scrolls the first scrollable by [offset].
Future<void> scrollBy(WidgetTester tester, double offset) async {
  final scrollable = find.byType(Scrollable);
  if (scrollable.evaluate().isEmpty) return;
  await tester.drag(scrollable.first, Offset(0, offset));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

/// Walks the three onboarding pages and lands on the space selector.
Future<void> completeOnboarding(WidgetTester tester) async {
  if (await appears(tester, find.text('Comment utiliserez-vous Gnawalma ?'))) {
    return;
  }
  await waitFor(
    tester,
    find.textContaining('mesure'),
    because: 'onboarding did not start',
  );
  for (var page = 0; page < 3; page++) {
    if (await appears(
      tester,
      find.text('Choisir mon espace'),
      timeout: const Duration(seconds: 2),
    )) {
      await tapAndSettle(tester, find.text('Choisir mon espace'));
      return;
    }
    await tapAndSettle(tester, find.text('Continuer'));
  }
}

/// Picks a space on the selector and continues.
Future<void> chooseSpace(WidgetTester tester, {required bool atelier}) async {
  await waitFor(tester, find.text('Comment utiliserez-vous Gnawalma ?'));
  await tapAndSettle(
    tester,
    find.textContaining(
      atelier ? 'Je gère un atelier' : 'Je cherche un atelier',
    ),
  );
  await tapAndSettle(tester, find.textContaining('Continuer'));
}

/// Signs in with an existing account.
///
/// The submit button stays disabled until both fields validate, so the form
/// needs a frame to settle between entering text and tapping — without it the
/// tap lands on a disabled button, nothing happens, and the next `waitFor`
/// blames whatever screen it was expecting instead of the sign-in.
Future<void> signIn(
  WidgetTester tester, {
  required String phone,
  String pin = seededPin,
}) async {
  await waitFor(tester, find.text('Bienvenue sur Gnawalma'));
  final fields = find.byType(TextFormField);
  await waitFor(tester, fields);

  await tester.enterText(fields.at(0), phone);
  await tester.pump(const Duration(milliseconds: 200));
  await tester.enterText(fields.at(1), pin);
  await tester.pump(const Duration(milliseconds: 600));

  final submit = find.text('Se connecter');
  await waitFor(tester, submit);
  await tester.ensureVisible(submit.last);
  await tester.pump(const Duration(milliseconds: 200));
  await tester.tap(submit.last, warnIfMissed: false);

  // Sign-in is a network round trip; wait for the auth screen to go away.
  final deadline = DateTime.now().add(const Duration(seconds: 40));
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 150));
    if (find.text('Bienvenue sur Gnawalma').evaluate().isEmpty) return;
  }

  // Still here: report the form's own error rather than a generic timeout.
  final messages = tester
      .widgetList<Text>(find.byType(Text))
      .map((widget) => widget.data)
      .whereType<String>()
      .where((value) => value.trim().length > 12)
      .take(12)
      .join(' | ');
  fail('Sign-in did not complete for $phone.\nOn screen: $messages');
}
