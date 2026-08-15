import 'dart:math';

/// Le délai le plus lointain que le moteur ait le droit d'inscrire dans
/// `next_attempt_at`.
///
/// Ce n'est PAS le plafond du back-off : un `Retry-After` va au-delà, et c'est
/// légitime, c'est le serveur qui l'impose. C'est la borne commune des deux
/// écritures d'échéance, et elle doit être unique :
///
/// * `retryAfterOf` s'en sert pour refuser un `Retry-After` aberrant ou
///   hostile, quelle que soit la forme de l'en-tête ;
/// * `SyncEngine.repairClockDrift` s'en sert pour reconnaître une échéance qui
///   ne peut PAS avoir été produite par le moteur, donc qui vient d'une horloge
///   qui a bougé.
///
/// Séparées, les deux bornes se contredisaient : la réparation d'horloge
/// plafonnait à 15 minutes, alors qu'un `Retry-After: 1800` en écrivait 30.
/// Elle effaçait donc, en moins d'une minute, l'attente que le serveur venait
/// d'exiger, et le client repartait pousser dans le limiteur de débit. Le
/// serveur répondait la même limitation, indéfiniment : une boucle que
/// l'utilisateur voit comme une file qui ne se vide jamais.
const Duration kMaxRetryAfter = Duration(hours: 1);

/// Back-off exponentiel à **gigue complète** : Dart pur.
///
/// `min(2 s × 2^(n-1), 15 min)`, puis un tirage uniforme dans `[0, delai]`.
///
/// **Pourquoi la gigue complète et pas la gigue égale.** La gigue égale
/// (`delai/2 + random(0, delai/2)`) garde un plancher synchronisé : quand une
/// antenne revient et que trente appareils se reconnectent dans la même seconde,
/// ils réessaient tous après *au moins* `delai/2`, c'est-à-dire tous ensemble,
/// sur un backhaul qui vient à peine de se rétablir. La gigue complète étale les
/// trente tentatives sur tout l'intervalle. Sur un lien dégradé, une
/// tournée syndicale, une salle de formation : c'est exactement la situation où
/// tous les téléphones ont accumulé une file et retrouvent le réseau au même
/// instant.
///
/// Le **plafond** compte autant que la croissance : sans lui, une panne serveur
/// d'une nuit repousserait le prochain essai à plusieurs jours, et le commercial
/// arriverait au bureau avec une file qui ne repart pas.
class Backoff {
  Backoff({
    this.base = const Duration(seconds: 2),
    this.cap = const Duration(minutes: 15),
    Random? random,
  }) : _random = random ?? Random();

  final Duration base;
  final Duration cap;
  final Random _random;

  /// Borne supérieure déterministe, avant gigue. Testable telle quelle.
  Duration ceilingFor(int attempts) {
    if (attempts <= 0) return Duration.zero;
    // Décalage borné à 30 : au-delà, `1 << shift` déborderait sur les entiers
    // 32 bits de la cible web et rendrait un délai négatif. Le plafond est
    // atteint bien avant, mais un débordement silencieux est le genre de bug
    // qu'on ne retrouve jamais.
    final int shift = (attempts - 1).clamp(0, 30);
    final int millis = base.inMilliseconds * (1 << shift);
    return millis >= cap.inMilliseconds || millis < 0
        ? cap
        : Duration(milliseconds: millis);
  }

  /// Délai effectif : tirage uniforme dans `[0, ceilingFor(attempts)]`.
  Duration nextDelay(int attempts) {
    final Duration ceiling = ceilingFor(attempts);
    if (ceiling == Duration.zero) return Duration.zero;
    return Duration(milliseconds: _random.nextInt(ceiling.inMilliseconds + 1));
  }
}
