import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cpi_go/core/network/retry_after.dart';
import 'package:cpi_go/core/network/retry_interceptor.dart';
import 'package:cpi_go/core/sync/backoff.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Réessai des GET.
///
/// Deux défauts, tous deux invisibles jusqu'à ce qu'un commercial se retrouve
/// déconnecté ou limité :
///
///  1. le rejeu partait sur un `Dio` NEUF, donc sans intercepteur
///     d'authentification : un GET réessayé après expiration du jeton d'accès
///     revenait en 401 brut, poussé vers l'avant, et provoquait une déconnexion
///     alors qu'un jeton de renouvellement valide dormait en stockage ;
///  2. `Retry-After` était ignoré : sur un 429, on repartait après 400 ms, donc
///     on se refaisait limiter aussitôt.
void main() {
  /// Un transport qui imite la chaîne réelle : un intercepteur d'authentification
  /// en amont du réessai, exactement comme dans `dio_factory.dart`.
  ({Dio dio, _RecordingAuth auth, _ScriptedAdapter adapter}) buildDio({
    required List<_Answer> script,
    int maxRetries = 2,
  }) {
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://exemple.test'));
    final _ScriptedAdapter adapter = _ScriptedAdapter(script);
    dio.httpClientAdapter = adapter;
    final _RecordingAuth auth = _RecordingAuth();
    dio.interceptors.addAll(<Interceptor>[
      auth,
      RetryInterceptor(
        dio: dio,
        maxRetries: maxRetries,
        baseDelay: const Duration(milliseconds: 1),
        random: Random(3),
      ),
    ]);
    return (dio: dio, auth: auth, adapter: adapter);
  }

  test('le rejeu retraverse la chaîne : le porteur est reposé', () async {
    // C'est LE point : sur un `Dio` nu, la seconde requête part sans
    // `Authorization`, revient en 401, et le 401 est propagé vers l'avant sans
    // jamais repasser par le renouvellement.
    final ({Dio dio, _RecordingAuth auth, _ScriptedAdapter adapter}) t =
        buildDio(
          script: <_Answer>[
            const _Answer.failure(DioExceptionType.connectionError),
            _Answer.success(<String, Object?>{'ok': true}),
          ],
        );

    final Response<dynamic> response = await t.dio.get<dynamic>('/api/v1/ping');

    expect(response.statusCode, 200);
    expect(
      t.auth.stampedRequests,
      2,
      reason: 'le rejeu doit repasser par l\'intercepteur d\'authentification',
    );
    expect(
      t.adapter.seenAuthorizationHeaders,
      <String?>['Bearer jeton-1', 'Bearer jeton-2'],
      reason: 'le second essai doit porter le jeton COURANT, pas aucun',
    );
  });

  test('un 429 fait attendre ce que le serveur demande', () async {
    final ({Dio dio, _RecordingAuth auth, _ScriptedAdapter adapter}) t =
        buildDio(
          script: <_Answer>[
            const _Answer.throttled(retryAfterSeconds: 1),
            _Answer.success(<String, Object?>{'ok': true}),
          ],
        );

    final Stopwatch clock = Stopwatch()..start();
    final Response<dynamic> response = await t.dio.get<dynamic>('/api/v1/ping');
    clock.stop();

    expect(response.statusCode, 200);
    expect(
      clock.elapsed,
      greaterThanOrEqualTo(const Duration(milliseconds: 900)),
      reason:
          'ignorer Retry-After et repartir après 400 ms, c\'est se refaire '
          'limiter aussitôt',
    );
  });

  /// `Retry-After` est légal sur TOUT statut. Ne le lire que sur 429 fait
  /// insister sur un serveur en maintenance qui vient de demander une pause.
  test('un 503 qui demande une pause est écouté aussi', () async {
    final ({Dio dio, _RecordingAuth auth, _ScriptedAdapter adapter}) t =
        buildDio(
          script: <_Answer>[
            const _Answer.unavailable(retryAfterSeconds: 1),
            _Answer.success(<String, Object?>{'ok': true}),
          ],
        );

    final Stopwatch clock = Stopwatch()..start();
    final Response<dynamic> response = await t.dio.get<dynamic>('/api/v1/ping');
    clock.stop();

    expect(response.statusCode, 200);
    expect(
      clock.elapsed,
      greaterThanOrEqualTo(const Duration(milliseconds: 900)),
    );
  });

  /// Sans plancher, un 429 nu repartait dans les 400 ms : on se refaisait
  /// limiter aussitôt.
  test('un 429 SANS en-tête attend quand même', () async {
    final ({Dio dio, _RecordingAuth auth, _ScriptedAdapter adapter}) t =
        buildDio(
          script: <_Answer>[
            const _Answer.throttled(),
            _Answer.success(<String, Object?>{'ok': true}),
          ],
        );

    final Stopwatch clock = Stopwatch()..start();
    await t.dio.get<dynamic>('/api/v1/ping');
    clock.stop();

    expect(
      clock.elapsed,
      greaterThanOrEqualTo(const Duration(milliseconds: 900)),
    );
  });

  test(
    'un Retry-After déraisonnable rend la main plutôt que de figer',
    () async {
      final ({Dio dio, _RecordingAuth auth, _ScriptedAdapter adapter}) t =
          buildDio(
            script: <_Answer>[const _Answer.throttled(retryAfterSeconds: 3600)],
          );

      await expectLater(
        t.dio.get<dynamic>('/api/v1/ping'),
        throwsA(isA<DioException>()),
      );
      expect(
        t.adapter.calls,
        1,
        reason: 'aucune attente d\'une heure en ligne',
      );
    },
  );

  test('les tentatives restent bornées', () async {
    final ({Dio dio, _RecordingAuth auth, _ScriptedAdapter adapter}) t =
        buildDio(
          script: <_Answer>[
            const _Answer.failure(DioExceptionType.connectionError),
            const _Answer.failure(DioExceptionType.connectionError),
            const _Answer.failure(DioExceptionType.connectionError),
            const _Answer.failure(DioExceptionType.connectionError),
          ],
        );

    await expectLater(
      t.dio.get<dynamic>('/api/v1/ping'),
      throwsA(isA<DioException>()),
    );
    // 1 essai + 2 rejeux. Rejouer à travers la chaîne réelle ne doit pas boucler.
    expect(t.adapter.calls, 3);
  });

  test(
    'une écriture n\'est JAMAIS rejouée ici : c\'est le rôle de l\'outbox',
    () async {
      final ({Dio dio, _RecordingAuth auth, _ScriptedAdapter adapter}) t =
          buildDio(
            script: <_Answer>[
              const _Answer.failure(DioExceptionType.connectionError),
            ],
          );

      await expectLater(
        t.dio.post<dynamic>('/api/v1/sync/push'),
        throwsA(isA<DioException>()),
      );
      expect(t.adapter.calls, 1);
    },
  );

  group('retryAfterOf', () {
    Response<dynamic> withHeader(String value) => Response<dynamic>(
      requestOptions: RequestOptions(path: '/x'),
      headers: Headers.fromMap(<String, List<String>>{
        'retry-after': <String>[value],
      }),
    );

    test('lit la forme en secondes', () {
      expect(retryAfterOf(withHeader('42')), const Duration(seconds: 42));
    });

    test('plafonne une valeur aberrante', () {
      expect(retryAfterOf(withHeader('999999')), const Duration(hours: 1));
    });

    test('lit la forme datée, et jamais négativement', () {
      final String past = DateTime.now()
          .toUtc()
          .subtract(const Duration(minutes: 5))
          .toIso8601String();
      expect(retryAfterOf(withHeader(past)), Duration.zero);
    });

    /// Le plafond ne portait que sur la forme numérique. Les deux formes sont
    /// légales et un proxy peut passer de l'une à l'autre : une date lointaine,
    /// aberrante ou hostile, suspendait la file aussi longtemps qu'elle le
    /// disait, sans qu'aucun mécanisme ne puisse la contredire.
    test('plafonne AUSSI la forme datée', () {
      final String faraway = DateTime.now()
          .toUtc()
          .add(const Duration(days: 3))
          .toIso8601String();
      expect(retryAfterOf(withHeader(faraway)), kMaxRetryAfter);
    });

    /// Et la borne est bien celle que la réparation d'horloge tient pour
    /// plausible : si les deux divergeaient, l'une effacerait le travail de
    /// l'autre.
    test('la borne est celle que le moteur sait écrire', () {
      expect(retryAfterOf(withHeader('999999')), kMaxRetryAfter);
    });

    test('sans en-tête, rien', () {
      expect(
        retryAfterOf(
          Response<dynamic>(requestOptions: RequestOptions(path: '/x')),
        ),
        isNull,
      );
    });
  });
}

/// Imite `AuthInterceptor` : pose un porteur, et le fait tourner à chaque appel
/// pour qu'on puisse voir si le rejeu est bien repassé par lui.
class _RecordingAuth extends Interceptor {
  int stampedRequests = 0;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    stampedRequests++;
    options.headers['Authorization'] = 'Bearer jeton-$stampedRequests';
    handler.next(options);
  }
}

/// Une réponse programmée.
class _Answer {
  const _Answer.failure(this.errorType)
    : status = null,
      body = null,
      retryAfterSeconds = null;

  const _Answer.throttled({this.retryAfterSeconds})
    : errorType = DioExceptionType.badResponse,
      status = 429,
      body = null;

  const _Answer.unavailable({this.retryAfterSeconds})
    : errorType = DioExceptionType.badResponse,
      status = 503,
      body = null;

  _Answer.success(Map<String, Object?> payload)
    : errorType = null,
      status = 200,
      body = jsonEncode(payload),
      retryAfterSeconds = null;

  final DioExceptionType? errorType;
  final int? status;
  final String? body;
  final int? retryAfterSeconds;
}

class _ScriptedAdapter implements HttpClientAdapter {
  _ScriptedAdapter(this._script);

  final List<_Answer> _script;

  int calls = 0;
  final List<String?> seenAuthorizationHeaders = <String?>[];

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    seenAuthorizationHeaders.add(options.headers['Authorization'] as String?);
    final _Answer answer = _script[calls.clamp(0, _script.length - 1)];
    calls++;

    if (answer.status == 429 || answer.status == 503) {
      return ResponseBody.fromString(
        '{"code":"BUSY"}',
        answer.status!,
        headers: <String, List<String>>{
          Headers.contentTypeHeader: <String>['application/json'],
          if (answer.retryAfterSeconds != null)
            'retry-after': <String>['${answer.retryAfterSeconds}'],
        },
      );
    }
    if (answer.errorType != null) {
      throw DioException(requestOptions: options, type: answer.errorType!);
    }
    return ResponseBody.fromString(
      answer.body!,
      answer.status!,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>['application/json'],
      },
    );
  }
}
