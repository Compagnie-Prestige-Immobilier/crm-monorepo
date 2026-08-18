import 'dart:typed_data';

import 'package:cpi_go/core/network/auth_interceptor.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Le renouvellement de jeton sur 401, vu du terrain : le téléconseiller est en
/// tournée, le jeton d'accès a expiré, le réseau tombe pendant le
/// renouvellement.
void main() {
  ({Dio dio, InMemoryTokenStore tokens}) buildDio({
    required Future<RefreshedTokens> Function(String) refresh,
  }) {
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://exemple.test'));
    dio.httpClientAdapter = _AlwaysUnauthorized();
    final InMemoryTokenStore tokens = InMemoryTokenStore(refreshToken: 'jeton');
    dio.interceptors.add(
      AuthInterceptor(tokens: tokens, replayDio: Dio(), refreshCall: refresh),
    );
    return (dio: dio, tokens: tokens);
  }

  test('un renouvellement coupé en plein vol remonte à l\'appelant', () async {
    // Le nettoyage du vol unique s'accrochait à la future du renouvellement
    // sans jamais lire son issue : l'échec repartait dans le vide en erreur
    // asynchrone orpheline, en plus de celle rendue à l'appelant.
    final ({Dio dio, InMemoryTokenStore tokens}) t = buildDio(
      refresh: (String _) async => throw DioException(
        requestOptions: RequestOptions(path: '/api/v1/auth/refresh'),
        type: DioExceptionType.connectionError,
      ),
    );

    await expectLater(t.dio.get<dynamic>('/api/v1/ping'), throwsA(isA<DioException>()));
    await Future<void>.delayed(Duration.zero);
  });

  test('deux 401 concurrents ne renouvellent qu\'une fois', () async {
    int refreshes = 0;
    final ({Dio dio, InMemoryTokenStore tokens}) t = buildDio(
      refresh: (String _) async {
        refreshes++;
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return const RefreshedTokens(accessToken: 'neuf', refreshToken: 'suite');
      },
    );

    // Le rejeu retombe sur 401 : ce qu'on observe ici est le vol unique, pas
    // l'issue de la requête.
    await Future.wait<void>(<Future<void>>[
      t.dio.get<dynamic>('/a').then<void>((_) {}, onError: (Object _) {}),
      t.dio.get<dynamic>('/b').then<void>((_) {}, onError: (Object _) {}),
    ]);

    expect(refreshes, 1);
    expect(t.tokens.accessToken, 'neuf');
  });
}

class _AlwaysUnauthorized implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      '{"code":"UNAUTHORIZED"}',
      401,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>['application/json'],
      },
    );
  }
}
