import 'dart:async';

import 'package:dio/dio.dart';

import '../sync/token_store.dart';
import 'refresh_mutex.dart';
import 'session_expired.dart';

class RefreshedTokens {
  const RefreshedTokens({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;
}

class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required TokenStore tokens,
    required Dio replayDio,
    required Future<RefreshedTokens> Function(String refreshToken) refreshCall,
    void Function()? onSessionExpired,
    RefreshMutex mutex = const NoRefreshMutex(),
  }) : _tokens = tokens,
       _replay = replayDio,
       _refreshCall = refreshCall,
       _onSessionExpired = onSessionExpired,
       _mutex = mutex;

  static const String noAuthFlag = 'cpi.noAuth';

  static const String replayedFlag = 'cpi.replayed';

  final TokenStore _tokens;
  final Dio _replay;
  final Future<RefreshedTokens> Function(String refreshToken) _refreshCall;
  final void Function()? _onSessionExpired;

  final RefreshMutex _mutex;

  Future<String>? _inFlight;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (options.extra[noAuthFlag] == true) {
      handler.next(options);
      return;
    }
    final String? access = _tokens.accessToken;
    if (access != null && access.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $access';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final RequestOptions request = err.requestOptions;
    final bool eligible =
        err.response?.statusCode == 401 &&
        request.extra[noAuthFlag] != true &&
        request.extra[replayedFlag] != true;

    if (!eligible) {
      handler.next(err);
      return;
    }

    final String access;
    try {
      access = await _refreshOnce();
    } on SessionExpired catch (expired) {
      handler.reject(
        DioException(
          requestOptions: request,
          error: expired,
          type: DioExceptionType.badResponse,
          response: err.response,
        ),
      );
      return;
    }

    try {
      final Response<dynamic> replayed = await _replay.fetch<dynamic>(
        request.copyWith(
          headers: <String, dynamic>{
            ...request.headers,
            'Authorization': 'Bearer $access',
          },
          extra: <String, dynamic>{...request.extra, replayedFlag: true},
        ),
      );
      handler.resolve(replayed);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  Future<String> _refreshOnce() {
    final Future<String>? pending = _inFlight;
    if (pending != null) return pending;

    final Future<String> flight = _mutex.protect(_performRefresh);
    _inFlight = flight;
    // `ignore` et non un `catchError` : l'échec est rendu à l'appelant par
    // `flight`, cette dérivation ne sert qu'à libérer le vol unique.
    flight.whenComplete(() {
      if (identical(_inFlight, flight)) _inFlight = null;
    }).ignore();
    return flight;
  }

  Future<String> _performRefresh() async {
    final String? refresh = await _tokens.readRefreshToken();
    if (refresh == null || refresh.isEmpty) {
      await _expire();
      throw const SessionExpired('aucun jeton de renouvellement');
    }
    try {
      final RefreshedTokens fresh = await _refreshCall(refresh);
      await _tokens.save(
        accessToken: fresh.accessToken,
        refreshToken: fresh.refreshToken,
      );
      return fresh.accessToken;
    } on DioException catch (e) {
      final int? status = e.response?.statusCode;
      if (status == 401 || status == 403) {
        await _expire();
        throw SessionExpired(e);
      }
      rethrow;
    }
  }

  Future<void> _expire() async {
    await _tokens.clear();
    _onSessionExpired?.call();
  }
}
