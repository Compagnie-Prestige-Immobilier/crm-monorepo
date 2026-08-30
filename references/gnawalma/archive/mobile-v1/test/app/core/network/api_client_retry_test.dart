import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gnawalma/app/core/network/api_exception.dart';

void main() {
  group('transient failures on a sleeping server', () {
    // The API sleeps on its host and needs the better part of a minute to
    // wake. The first request after an idle period therefore times out on
    // connect — and sign-up and sign-in are POSTs, which the retry policy
    // excluded, so a new user's very first action failed outright with a
    // message that read as a broken service.
    test('a connect timeout is reported as a wake-up, not a dead service', () {
      final failure = ApiException.fromDio(
        DioException(
          requestOptions: RequestOptions(path: '/auth/register'),
          type: DioExceptionType.connectionTimeout,
        ),
      );
      expect(failure.kind, ApiFailureKind.timeout);
      expect(failure.message, contains('réveille'));
      // The reader is told the next attempt is worth making.
      expect(failure.message.toLowerCase(), contains('réessayez'));
    });

    test('a lost connection still reads as a network problem', () {
      final failure = ApiException.fromDio(
        DioException(
          requestOptions: RequestOptions(path: '/auth/login'),
          type: DioExceptionType.connectionError,
        ),
      );
      expect(failure.kind, ApiFailureKind.offline);
      expect(failure.message, contains('réseau'));
    });
  });
}
