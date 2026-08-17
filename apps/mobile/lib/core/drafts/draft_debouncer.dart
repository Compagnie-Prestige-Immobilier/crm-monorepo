import 'dart:async';

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
    _quietTimer = Timer(quiet, flush);
    _maxTimer ??= Timer(maxWait, flush);
  }

  Future<void> flush() async {
    _quietTimer?.cancel();
    _quietTimer = null;
    _maxTimer?.cancel();
    _maxTimer = null;
    if (!_dirty || _disposed) return;
    _dirty = false;
    await _onFlush();
  }

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
