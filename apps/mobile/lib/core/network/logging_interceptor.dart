import 'dart:developer' as developer;

import 'package:dio/dio.dart';

import 'request_id_interceptor.dart';

/// Journalisation — **dernier** de la chaîne.
///
/// Dernier, et pas premier : posé en tête il journaliserait la requête *avant*
/// que l'authentification et le rejeu ne l'aient touchée, c'est-à-dire une
/// requête qui n'est pas celle qui part sur le fil. On veut voir ce qui a
/// réellement été émis.
///
/// **Ce qui n'est jamais journalisé** : `Authorization`, le corps de
/// `/auth/login` et `/auth/refresh`. Un jeton dans `logcat` est un jeton
/// exfiltrable par n'importe quelle application capable de lire les journaux sur
/// un appareil rooté — et une bonne part du parc visé l'est.
class LoggingInterceptor extends Interceptor {
  const LoggingInterceptor({this.enabled = true});

  final bool enabled;

  static const int _bodyPreview = 400;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (enabled) {
      _log('→ ${options.method} ${options.uri} ${_rid(options)}');
    }
    handler.next(options);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    if (enabled) {
      _log(
        '← ${response.statusCode} ${response.requestOptions.method} '
        '${response.requestOptions.uri} ${_rid(response.requestOptions)}',
      );
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (enabled) {
      final RequestOptions o = err.requestOptions;
      final String body = _redacted(o)
          ? '[masqué]'
          : (err.response?.data?.toString() ?? '');
      _log(
        '✕ ${err.response?.statusCode ?? err.type.name} ${o.method} ${o.uri} '
        '${_rid(o)} ${body.length > _bodyPreview ? body.substring(0, _bodyPreview) : body}',
      );
    }
    handler.next(err);
  }

  static bool _redacted(RequestOptions o) =>
      o.path.contains('/auth/login') || o.path.contains('/auth/refresh');

  static String _rid(RequestOptions o) =>
      '[${o.headers[RequestIdInterceptor.header] ?? '-'}]';

  static void _log(String message) =>
      developer.log(message, name: 'cpi.http', level: 500);
}
