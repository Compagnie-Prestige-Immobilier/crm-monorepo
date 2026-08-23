import 'dart:async';
import 'dart:math';

import 'package:dio/dio.dart';

import 'retry_after.dart';

class RetryInterceptor extends Interceptor {
  RetryInterceptor({
    required Dio dio,
    this.maxRetries = 2,
    this.baseDelay = const Duration(milliseconds: 400),
    this.maxRetryAfter = const Duration(minutes: 2),
    this.throttleFloor = const Duration(seconds: 1),
    Random? random,
  }) : _dio = dio,
       _random = random ?? Random();

  final Dio _dio;

  final int maxRetries;
  final Duration baseDelay;

  final Duration maxRetryAfter;

  /// Plancher quand le serveur dit « trop d'appels » sans dire combien de temps.
  final Duration throttleFloor;

  final Random _random;

  static const String _attemptKey = 'cpi.getRetryAttempt';

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final RequestOptions request = err.requestOptions;

    if (request.method.toUpperCase() != 'GET' || !_isTransient(err)) {
      handler.next(err);
      return;
    }

    final int attempt = (request.extra[_attemptKey] as int?) ?? 0;
    if (attempt >= maxRetries) {
      handler.next(err);
      return;
    }

    final Duration wait = _delayFor(err, attempt);
    if (wait > maxRetryAfter) {
      handler.next(err);
      return;
    }
    await Future<void>.delayed(wait);

    try {
      final Response<dynamic> response = await _dio.fetch<dynamic>(
        request.copyWith(
          extra: <String, dynamic>{...request.extra, _attemptKey: attempt + 1},
        ),
      );
      handler.resolve(response);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  /// `Retry-After` est légal sur TOUT statut, 503 compris : le lire seulement
  /// sur 429 revient à marteler un serveur qui vient de demander une pause.
  Duration _delayFor(DioException err, int attempt) {
    final Duration? asked = retryAfterOf(err.response);
    if (asked != null) return asked;
    final int ceiling = baseDelay.inMilliseconds << attempt;
    final Duration jittered = Duration(
      milliseconds: _random.nextInt(ceiling + 1),
    );
    final int status = err.response?.statusCode ?? 0;
    if (status != 429 && status != 503) return jittered;
    return jittered < throttleFloor ? throttleFloor : jittered;
  }

  static bool _isTransient(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
      case DioExceptionType.connectionError:
        return true;
      case DioExceptionType.badResponse:
        final int status = err.response?.statusCode ?? 0;
        return status >= 500 || status == 408 || status == 425 || status == 429;
      case DioExceptionType.cancel:
      case DioExceptionType.badCertificate:
      case DioExceptionType.unknown:
        return false;
    }
  }
}
