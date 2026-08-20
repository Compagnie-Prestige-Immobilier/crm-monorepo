import 'dart:async';
import 'dart:developer' as developer;

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

  bool get isDirty => _dirty;

  void touch() {
    if (_disposed) return;
    _dirty = true;
    _quietTimer?.cancel();
    _quietTimer = Timer(quiet, _flushUnattended);
    _maxTimer ??= Timer(maxWait, _flushUnattended);
  }

  Future<void> flush() async {
    _quietTimer?.cancel();
    _quietTimer = null;
    _maxTimer?.cancel();
    _maxTimer = null;
    if (!_dirty || _disposed) return;
    _dirty = false;
    try {
      await _onFlush();
    } on Object {
      _dirty = true;
      rethrow;
    }
  }

  /// Personne n'attend cette écriture : sans journal, une base verrouillée
  /// ferait disparaître la saisie sans un mot.
  Future<void> _flushUnattended() async {
    try {
      await flush();
    } on Object catch (e, stack) {
      developer.log(
        'Brouillon non enregistré, nouvelle tentative à la prochaine frappe',
        name: 'cpi.drafts',
        error: e,
        stackTrace: stack,
      );
    }
  }

  void discard() {
    _quietTimer?.cancel();
    _quietTimer = null;
    _maxTimer?.cancel();
    _maxTimer = null;
    _dirty = false;
  }

  Future<void> dispose() async {
    await _flushUnattended();
    _disposed = true;
    _quietTimer?.cancel();
    _maxTimer?.cancel();
  }
}
