import 'dart:math';

import 'package:cpi_go/core/sync/backoff.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Backoff : plafond exponentiel', () {
    test('min(2 s × 2^(n-1), 15 min)', () {
      final Backoff b = Backoff(random: Random(1));
      expect(b.ceilingFor(1), const Duration(seconds: 2));
      expect(b.ceilingFor(2), const Duration(seconds: 4));
      expect(b.ceilingFor(3), const Duration(seconds: 8));
      expect(b.ceilingFor(4), const Duration(seconds: 16));
      expect(b.ceilingFor(9), const Duration(seconds: 512));
      // 2 s × 2^9 = 1024 s = 17 min 04 s > 15 min : le plafond mord ici.
      expect(b.ceilingFor(10), const Duration(minutes: 15));
      expect(b.ceilingFor(30), const Duration(minutes: 15));
      // Décalage borné : sans le `clamp(0, 30)`, `1 << 200` déborderait et
      // rendrait un délai négatif : un réessai immédiat en boucle.
      expect(b.ceilingFor(200), const Duration(minutes: 15));
      expect(b.ceilingFor(0), Duration.zero);
      expect(b.ceilingFor(-3), Duration.zero);
    });

    test('le plafond existe pour que la file reparte le lendemain matin', () {
      final Backoff b = Backoff(random: Random(2));
      // Une panne serveur d'une nuit ⇒ une dizaine de tentatives. Sans plafond,
      // 2 s × 2^19 ≈ 12 jours : le commercial arriverait au bureau avec une file
      // qui ne repart pas.
      expect(b.ceilingFor(20), const Duration(minutes: 15));
    });
  });

  group('Backoff : gigue COMPLÈTE, pas égale', () {
    test('un tirage nul donne un délai nul', () {
      // C'est LA propriété qui distingue les deux. Avec une gigue égale
      // (`delai/2 + random(0, delai/2)`), ce délai vaudrait 128 s : jamais zéro,
      // jamais rien en dessous de la moitié.
      final Backoff b = Backoff(random: const _FractionRandom(0));
      expect(b.nextDelay(8), Duration.zero);
      expect(b.nextDelay(1), Duration.zero);
      expect(b.nextDelay(30), Duration.zero);
    });

    test('un tirage maximal donne exactement le plafond', () {
      final Backoff b = Backoff(random: const _FractionRandom(1));
      expect(b.nextDelay(8), const Duration(seconds: 256));
      expect(b.nextDelay(30), const Duration(minutes: 15));
    });

    test('trente appareils qui se reconnectent ensemble ne se resynchronisent pas', () {
      // Le scénario réel : une antenne revient, trente téléphones qui ont
      // accumulé une file repartent dans la même seconde. Avec une gigue
      // égale, ils réessaient TOUS après au moins `delai/2` : c'est-à-dire à
      // nouveau ensemble, sur un backhaul qui vient à peine de se rétablir.
      final Backoff b = Backoff(random: Random(20260812));
      const int attempts = 8; // plafond : 256 000 ms
      const int ceiling = 256000;

      final List<int> draws = <int>[
        for (int i = 0; i < 30; i++) b.nextDelay(attempts).inMilliseconds,
      ];

      expect(draws.every((int d) => d >= 0 && d <= ceiling), isTrue);

      // Sous gigue égale, AUCUN tirage ne peut tomber sous la moitié. Ici il
      // en faut plusieurs, et au moins un dans le premier dixième.
      final int belowHalf = draws.where((int d) => d < ceiling ~/ 2).length;
      expect(
        belowHalf,
        greaterThan(5),
        reason: 'une gigue égale n\'aurait produit aucun tirage sous la moitié',
      );
      expect(
        draws.reduce(min),
        lessThan(ceiling ~/ 10),
        reason: 'le plancher synchronisé de la gigue égale est absent',
      );

      // Étalement effectif : les tirages ne se massent pas dans un dixième.
      expect(draws.reduce(max) - draws.reduce(min), greaterThan(ceiling ~/ 2));
    });

    test('la moyenne tend vers la moitié du plafond', () {
      final Backoff b = Backoff(random: Random(7));
      const int ceiling = 256000;
      int total = 0;
      for (int i = 0; i < 2000; i++) {
        total += b.nextDelay(8).inMilliseconds;
      }
      final double mean = total / 2000;
      // `random(0, delai)` uniforme ⇒ espérance `delai/2`. Bornes larges : le
      // test doit détecter un changement de loi, pas la variance d'un tirage.
      expect(mean, greaterThan(ceiling * 0.42));
      expect(mean, lessThan(ceiling * 0.58));
    });

    test('un plafond nul ne déclenche pas de tirage', () {
      final Backoff b = Backoff(random: const _ExplodingRandom());
      expect(b.nextDelay(0), Duration.zero);
    });
  });
}

/// `Random` déterministe : rend toujours la même fraction de `max`.
class _FractionRandom implements Random {
  const _FractionRandom(this.fraction);

  final double fraction;

  @override
  int nextInt(int max) => ((max - 1) * fraction).round().clamp(0, max - 1);

  @override
  bool nextBool() => false;

  @override
  double nextDouble() => fraction;
}

class _ExplodingRandom implements Random {
  const _ExplodingRandom();

  Never _boom() => throw StateError('aucun tirage attendu');

  @override
  bool nextBool() => _boom();

  @override
  double nextDouble() => _boom();

  @override
  int nextInt(int max) => _boom();
}
