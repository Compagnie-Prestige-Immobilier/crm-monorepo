import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

extension AsyncValueEchecDAbord<T> on AsyncValue<T> {
  /// Comme `when`, mais l'ECHEC passe avant le chargement.
  ///
  /// Riverpod reessaie indefiniment une lecture en defaut, et pendant chaque
  /// nouvelle tentative l'etat redevient « en chargement » tout en gardant son
  /// erreur. `when` teste le chargement en premier : la branche `error` n'est
  /// donc jamais atteinte, l'indicateur tourne pour toujours, et l'utilisateur
  /// n'apprend jamais ce qui s'est passe. Sur ce parc il n'y a ni console ni
  /// rapport de plantage : une erreur avalee ne se voit nulle part.
  Widget whenEchecDAbord({
    required Widget Function() loading,
    required Widget Function(Object error, StackTrace stack) error,
    required Widget Function(T value) data,
  }) {
    final Object? echec = this.error;
    if (echec != null) return error(echec, stackTrace ?? StackTrace.empty);
    if (!hasValue) return loading();
    return data(requireValue);
  }
}
