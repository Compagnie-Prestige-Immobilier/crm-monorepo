import 'package:dio/dio.dart';

import '../sync/backoff.dart';

/// Lecture de l'en-tête `Retry-After` : **Dart pur**.
///
/// Isolée ici parce que deux couches en ont besoin et qu'elles ne doivent pas
/// se répondre différemment : `DioApi.classify`, qui alimente le back-off de
/// l'outbox, et [RetryInterceptor], qui réessaie les GET. Le second l'ignorait
/// purement et simplement et repartait sur son propre délai de 400 ms : sur un
/// serveur qui vient de dire « revenez dans 60 secondes », c'est la façon la
/// plus sûre de se faire limiter à nouveau, trois fois de suite.
///
/// Les deux formes de l'en-tête sont légales et un serveur peut passer de l'une
/// à l'autre derrière un proxy : un nombre de secondes, ou une date HTTP.
Duration? retryAfterOf(Response<dynamic>? response) {
  final Object? raw = response?.headers.value('retry-after');
  if (raw == null) return null;
  final int? seconds = int.tryParse(raw.toString().trim());
  // Plafonné à [kMaxRetryAfter] : un `Retry-After` aberrant (ou hostile) ne
  // doit pas pouvoir suspendre la synchronisation jusqu'au lendemain.
  if (seconds != null) {
    return _clamp(Duration(seconds: seconds.clamp(0, kMaxRetryAfter.inSeconds)));
  }
  final DateTime? when = DateTime.tryParse(raw.toString());
  if (when == null) return null;
  final Duration delta = when.toUtc().difference(DateTime.now().toUtc());
  // **La forme date était sans borne.** Le plafond ne portait que sur la forme
  // numérique, alors que les deux sont légales et qu'un proxy peut passer de
  // l'une à l'autre : une date lointaine, aberrante ou hostile, suspendait la
  // file aussi longtemps qu'elle le disait. Les deux formes passent désormais
  // par la même borne, qui est aussi celle que la réparation d'horloge
  // considère comme légitime.
  return delta.isNegative ? Duration.zero : _clamp(delta);
}

Duration _clamp(Duration d) => d > kMaxRetryAfter ? kMaxRetryAfter : d;
