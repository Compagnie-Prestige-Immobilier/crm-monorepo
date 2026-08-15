/// Horloge injectable.
///
/// Dart pur : voir `lib/core/sync/README` en tête de [SyncEngine] : rien dans ce
/// dossier n'importe `package:flutter`.
///
/// Le moteur de synchronisation calcule des back-offs, des baux et des fenêtres
/// de réessai. Avec `DateTime.now()` en dur, aucun de ces calculs n'est
/// testable autrement qu'en faisant vraiment attendre le test.
abstract interface class Clock {
  DateTime now();
}

class SystemClock implements Clock {
  const SystemClock();

  @override
  DateTime now() => DateTime.now().toUtc();
}

/// Horloge de test : avance uniquement quand on le lui demande.
class FakeClock implements Clock {
  FakeClock(this._now);

  DateTime _now;

  @override
  DateTime now() => _now;

  void advance(Duration d) => _now = _now.add(d);
  void set(DateTime value) => _now = value;
}
