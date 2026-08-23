import 'package:dio/dio.dart';

import '../sync/backoff.dart';

Duration? retryAfterOf(Response<dynamic>? response) {
  final Object? raw = response?.headers.value('retry-after');
  if (raw == null) return null;
  final int? seconds = int.tryParse(raw.toString().trim());
  if (seconds != null) {
    return _clamp(
      Duration(seconds: seconds.clamp(0, kMaxRetryAfter.inSeconds)),
    );
  }
  final DateTime? when = DateTime.tryParse(raw.toString());
  if (when == null) return null;
  final Duration delta = when.toUtc().difference(DateTime.now().toUtc());
  return delta.isNegative ? Duration.zero : _clamp(delta);
}

Duration _clamp(Duration d) => d > kMaxRetryAfter ? kMaxRetryAfter : d;

/// Ce qui distingue une réponse du SERVEUR de celle d'un portail captif ou d'un
/// pare-feu : eux répondent en HTML, jamais en JSON.
bool announcesJson(Response<dynamic>? response) =>
    (response?.headers.value(Headers.contentTypeHeader) ?? '')
        .toLowerCase()
        .contains('json');
