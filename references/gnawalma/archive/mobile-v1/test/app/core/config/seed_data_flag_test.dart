import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gnawalma/app/core/config/app_environment.dart';

/// The seed flag decides whether a build ships with fabricated clients,
/// orders and stock. Getting it wrong in the safe direction wastes a tester's
/// time; getting it wrong in the unsafe direction puts fixture data in front of
/// a real atelier.
///
/// `SEED_DATA` is a compile-time `String.fromEnvironment`, so a test can only
/// observe the value this binary was built with. What is asserted here is the
/// part that holds regardless: production never seeds, and the resolved value
/// agrees with the documented default for the current build mode.
void main() {
  group('AppEnvironment.seedData', () {
    test('never seeds a production build', () {
      if (AppEnvironment.isProduction) {
        expect(
          AppEnvironment.seedData,
          isFalse,
          reason: 'a production build must never carry demo data',
        );
      }
    });

    test('defaults to the build mode when the flag is unset', () {
      const flag = String.fromEnvironment('SEED_DATA', defaultValue: '');
      if (flag.isNotEmpty || AppEnvironment.isProduction) {
        return; // explicitly configured, or covered by the test above
      }
      expect(
        AppEnvironment.seedData,
        kDebugMode,
        reason: 'unset should mean "seed in debug, never in release"',
      );
    });

    test('an explicit flag is honoured', () {
      const flag = String.fromEnvironment('SEED_DATA', defaultValue: '');
      if (flag.isEmpty || AppEnvironment.isProduction) return;
      final expected = ['1', 'true', 'yes'].contains(flag.toLowerCase());
      expect(
        AppEnvironment.seedData,
        expected,
        reason: 'SEED_DATA=$flag should resolve to $expected',
      );
    });
  });
}
