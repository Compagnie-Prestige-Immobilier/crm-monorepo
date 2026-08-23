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
    int refreshAttempts = 3,
  }) {
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://exemple.test'));
    dio.httpClientAdapter = _AlwaysUnauthorized();
    final InMemoryTokenStore tokens = InMemoryTokenStore(refreshToken: 'jeton');
    dio.interceptors.add(
      AuthInterceptor(
        tokens: tokens,
        replayDio: Dio(),
        refreshCall: refresh,
        refreshAttempts: refreshAttempts,
        refreshRetryDelay: const Duration(milliseconds: 1),
      ),
    );
    return (dio: dio, tokens: tokens);
  }

  DioException refused(int status, {String contentType = 'application/json'}) =>
      DioException(
        requestOptions: RequestOptions(path: '/api/v1/auth/refresh'),
        type: DioExceptionType.badResponse,
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: '/api/v1/auth/refresh'),
          statusCode: status,
          headers: Headers.fromMap(<String, List<String>>{
            Headers.contentTypeHeader: <String>[contentType],
          }),
        ),
      );

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

    await expectLater(
      t.dio.get<dynamic>('/api/v1/ping'),
      throwsA(isA<DioException>()),
    );
    await Future<void>.delayed(Duration.zero);
  });

  test('deux 401 concurrents ne renouvellent qu\'une fois', () async {
    int refreshes = 0;
    final ({Dio dio, InMemoryTokenStore tokens}) t = buildDio(
      refresh: (String _) async {
        refreshes++;
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return const RefreshedTokens(
          accessToken: 'neuf',
          refreshToken: 'suite',
        );
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

  // ═══ LA RÉPONSE PERDUE SUR 2G DÉCONNECTAIT EN PLEIN TERRAIN ═══
  //
  // Le POST de renouvellement part par un Dio SANS réessai, et
  // `RetryInterceptor` ne rejoue que les GET. Un aller-retour perdu alors que le
  // serveur avait déjà tourné le jeton faisait présenter un jeton révoqué au
  // coup suivant : le serveur y lit un rejeu, révoque la famille entière, et le
  // commercial est déconnecté avec sa file pleine.

  test('un renouvellement coupé est réessayé', () async {
    int calls = 0;
    final ({Dio dio, InMemoryTokenStore tokens}) t = buildDio(
      refresh: (String _) async {
        calls++;
        if (calls < 3) {
          throw DioException(
            requestOptions: RequestOptions(path: '/api/v1/auth/refresh'),
            type: DioExceptionType.connectionError,
          );
        }
        return const RefreshedTokens(
          accessToken: 'neuf',
          refreshToken: 'suite',
        );
      },
    );

    await t.dio
        .get<dynamic>('/api/v1/ping')
        .then<void>((_) {}, onError: (Object _) {});

    expect(calls, 3);
    expect(t.tokens.accessToken, 'neuf');
  });

  test('un 401 explicite n\'est JAMAIS réessayé', () async {
    int calls = 0;
    final ({Dio dio, InMemoryTokenStore tokens}) t = buildDio(
      refresh: (String _) async {
        calls++;
        throw refused(401);
      },
    );

    await expectLater(
      t.dio.get<dynamic>('/api/v1/ping'),
      throwsA(isA<DioException>()),
    );
    expect(calls, 1);
    expect(
      await t.tokens.readRefreshToken(),
      isNull,
      reason: 'le refus vide le coffre',
    );
  });

  test('un 403 du serveur reste une session morte', () async {
    final ({Dio dio, InMemoryTokenStore tokens}) t = buildDio(
      refresh: (String _) async => throw refused(403),
    );

    await expectLater(
      t.dio.get<dynamic>('/api/v1/ping'),
      throwsA(isA<DioException>()),
    );
    expect(await t.tokens.readRefreshToken(), isNull);
  });

  /// ═══ UN PORTAIL CAPTIF VIDAIT LE COFFRE ═══
  ///
  /// Le 403 était lu comme une session morte SANS regarder le `content-type`.
  /// Un pare-feu d'hôtel ou un WAF qui répond 403 en HTML déconnectait donc un
  /// commercial dont la session était parfaitement valide.
  test('un 403 en HTML ne vide pas le coffre', () async {
    final ({Dio dio, InMemoryTokenStore tokens}) t = buildDio(
      refresh: (String _) async => throw refused(403, contentType: 'text/html'),
    );

    await expectLater(
      t.dio.get<dynamic>('/api/v1/ping'),
      throwsA(isA<DioException>()),
    );
    expect(
      await t.tokens.readRefreshToken(),
      'jeton',
      reason: 'ce n\'est pas le serveur qui a répondu',
    );
  });

  test('un échec sans refus explicite ne déconnecte pas', () async {
    final ({Dio dio, InMemoryTokenStore tokens}) t = buildDio(
      refresh: (String _) async => throw DioException(
        requestOptions: RequestOptions(path: '/api/v1/auth/refresh'),
        type: DioExceptionType.connectionError,
      ),
    );

    await expectLater(
      t.dio.get<dynamic>('/api/v1/ping'),
      throwsA(isA<DioException>()),
    );
    expect(await t.tokens.readRefreshToken(), 'jeton');
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
