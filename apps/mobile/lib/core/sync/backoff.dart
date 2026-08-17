import 'dart:math';

const Duration kMaxRetryAfter = Duration(hours: 1);

class Backoff {
  Backoff({
    this.base = const Duration(seconds: 2),
    this.cap = const Duration(minutes: 15),
    Random? random,
  }) : _random = random ?? Random();

  final Duration base;
  final Duration cap;
  final Random _random;

  Duration ceilingFor(int attempts) {
    if (attempts <= 0) return Duration.zero;
    final int shift = (attempts - 1).clamp(0, 30);
    final int millis = base.inMilliseconds * (1 << shift);
    return millis >= cap.inMilliseconds || millis < 0
        ? cap
        : Duration(milliseconds: millis);
  }

  Duration nextDelay(int attempts) {
    final Duration ceiling = ceilingFor(attempts);
    if (ceiling == Duration.zero) return Duration.zero;
    return Duration(milliseconds: _random.nextInt(ceiling.inMilliseconds + 1));
  }
}
