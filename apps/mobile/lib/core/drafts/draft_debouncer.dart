import 'dart:async';

/// Anti-rebond **avec attente maximale** : Dart pur, donc testable sans widget.
///
/// Deux minuteries et pas une seule. C'est la différence entre « on écrit moins
/// souvent » et « on n'écrit jamais » :
///
/// * **[quiet] : 400 ms de traîne.** Un commercial qui tape « Mamadou Diallo »
///   produit quinze changements de champ ; quinze écritures SQLite en 3 s sur un
///   Tecno d'entrée de gamme, c'est un formulaire qui saccade.
/// * **[maxWait] : 3 s d'attente maximale.** Sans elle, quelqu'un qui tape
///   lentement mais sans jamais s'arrêter 400 ms d'affilée n'est **jamais**
///   sauvegardé : chaque frappe repousse l'échéance. C'est précisément le profil
///   de saisie d'un utilisateur peu à l'aise avec un clavier tactile : celui
///   dont on veut le plus protéger la saisie.
///
/// [flush] force l'écriture immédiate. Appelé sur perte de focus d'un champ, sur
/// changement d'étape, et sur `AppLifecycleState.inactive`.
class DraftDebouncer {
  DraftDebouncer({
    required Future<void> Function() onFlush,
    this.quiet = const Duration(milliseconds: 400),
    this.maxWait = const Duration(seconds: 3),
  }) : _onFlush = onFlush;

  final Future<void> Function() _onFlush;
  final Duration quiet;
  final Duration maxWait;

  Timer? _quietTimer;
  Timer? _maxTimer;
  bool _dirty = false;
  bool _disposed = false;

  /// Vrai s'il reste une modification non écrite.
  bool get isDirty => _dirty;

  /// Signale une modification. Relance la traîne, arme l'attente maximale.
  void touch() {
    if (_disposed) return;
    _dirty = true;
    _quietTimer?.cancel();
    _quietTimer = Timer(quiet, flush);
    // `??=` : l'attente maximale ne se réarme PAS à chaque frappe, sinon elle se
    // comporterait comme une seconde traîne et n'apporterait rien.
    _maxTimer ??= Timer(maxWait, flush);
  }

  /// Écrit tout de suite. Sans effet s'il n'y a rien à écrire.
  Future<void> flush() async {
    _quietTimer?.cancel();
    _quietTimer = null;
    _maxTimer?.cancel();
    _maxTimer = null;
    if (!_dirty || _disposed) return;
    _dirty = false;
    await _onFlush();
  }

  /// Abandonne les modifications en attente sans les écrire. Utilisé après un
  /// enregistrement réussi : le brouillon vient d'être supprimé dans la même
  /// transaction, le réécrire le ressusciterait.
  void discard() {
    _quietTimer?.cancel();
    _quietTimer = null;
    _maxTimer?.cancel();
    _maxTimer = null;
    _dirty = false;
  }

  Future<void> dispose() async {
    await flush();
    _disposed = true;
    _quietTimer?.cancel();
    _maxTimer?.cancel();
  }
}
