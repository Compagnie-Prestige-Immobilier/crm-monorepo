import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../../data/services/auth_session_store.dart';
import '../../modules/auth/domain/auth_session.dart';
import '../config/app_environment.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient({
    required AuthSessionStore sessionStore,
    required Future<void> Function() onSessionExpired,
  }) : _sessionStore = sessionStore,
       _onSessionExpired = onSessionExpired,
       _dio = Dio(_baseOptions()),
       _refreshDio = Dio(_baseOptions()) {
    _dio.interceptors.add(
      InterceptorsWrapper(onRequest: _onRequest, onError: _onError),
    );

    if (AppEnvironment.enableNetworkLogs && !AppEnvironment.isProduction) {
      _dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: false,
          requestHeader: false,
          responseHeader: false,
          error: true,
          logPrint: (value) => debugPrint('[HTTP] $value'),
        ),
      );
    }
  }

  static const _uuid = Uuid();
  static const _retriedKey = 'auth_retried';
  static const _requiresAuthKey = 'requires_auth';
  static const _attemptKey = 'transient_attempt';

  /// Deliberately small. This is a phone on a slow link, not a backend job —
  /// three total attempts spend at most ~3s before the screen says something.
  static const _maxTransientRetries = 2;

  /// How long to wait for the connection itself.
  ///
  /// The API sleeps on its host and needs the better part of a minute to wake;
  /// `ServerWarmup` starts that wake at launch, but a user who signs in before
  /// it finishes still pays for the rest of it. Twelve seconds cut the very
  /// first request short and reported the wake as a failure. This is the
  /// connect budget only — the request has not been sent yet, so a slow
  /// handshake costs patience, never a duplicated write.
  static const _connectTimeout = Duration(seconds: 40);

  /// Retried automatically: rate limiting, server faults, and the connection
  /// failures that a moving handset produces constantly.
  static bool _isTransient(int? status, DioExceptionType type) {
    if (status == 429) return true;
    if (status != null && status >= 500 && status <= 599) return true;
    return type == DioExceptionType.connectionTimeout ||
        type == DioExceptionType.sendTimeout ||
        type == DioExceptionType.receiveTimeout ||
        type == DioExceptionType.connectionError;
  }

  /// Only replay requests that can be repeated safely.
  ///
  /// POST is excluded even though most of this API's writes carry an
  /// Idempotency-Key: the key is not applied everywhere yet, and replaying an
  /// unkeyed order or payment would be worse than surfacing the error.
  static bool _isIdempotent(String method) {
    final normalised = method.toUpperCase();
    return normalised == 'GET' ||
        normalised == 'HEAD' ||
        normalised == 'PUT' ||
        normalised == 'DELETE';
  }

  /// True when the request provably never reached the server.
  ///
  /// A connect timeout means the TCP/TLS handshake never completed, so not one
  /// byte of the request was delivered and replaying it cannot duplicate
  /// anything — the safety argument that excludes POST from replay does not
  /// apply here. The distinction matters because the API sleeps on its host and
  /// takes the better part of a minute to wake: the first write after an idle
  /// period is exactly the request that times out on connect, and sign-up and
  /// sign-in are POSTs. Refusing to retry them turned "the server is waking"
  /// into "Le serveur met trop de temps à répondre" on the very first screen a
  /// new user sees.
  ///
  /// Send and receive timeouts are deliberately excluded: there, the request
  /// may well have been delivered and processed, and a replay could create a
  /// second order or a second payment.
  static bool _neverReachedServer(DioExceptionType type) {
    return type == DioExceptionType.connectionTimeout ||
        type == DioExceptionType.connectionError;
  }

  /// Exponential backoff, but `Retry-After` wins when the server sent one —
  /// retrying earlier than asked is what turns rate limiting into a loop.
  static Duration _backoffFor(int attempt, Response<dynamic>? response) {
    final header = response?.headers.value('retry-after');
    final seconds = int.tryParse(header ?? '');
    if (seconds != null && seconds > 0) {
      return Duration(seconds: seconds.clamp(1, 10));
    }
    return Duration(milliseconds: 400 * (1 << attempt));
  }

  final AuthSessionStore _sessionStore;

  /// Drops the stored session from this device.
  ///
  /// Exposed so sign-out can clear local state even when the server call
  /// fails — the tokens are held here, so this is the only place that can.
  Future<void> clearStoredSession() => _sessionStore.clear();

  final Future<void> Function() _onSessionExpired;
  final Dio _dio;
  final Dio _refreshDio;
  Future<AuthSession?>? _refreshInFlight;

  static BaseOptions _baseOptions() {
    return BaseOptions(
      baseUrl: AppEnvironment.apiBaseUrl,
      connectTimeout: _connectTimeout,
      sendTimeout: const Duration(seconds: 20),
      // Also generous: the wake finishes while this request is in flight, and
      // the response only starts once the instance is serving.
      receiveTimeout: const Duration(seconds: 40),
      responseType: ResponseType.json,
      contentType: Headers.jsonContentType,
      headers: const {
        'Accept': 'application/json, application/problem+json',
        'X-Client-Platform': 'mobile',
      },
    );
  }

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    bool requiresAuth = true,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _dio.get<T>(
        path,
        queryParameters: queryParameters,
        cancelToken: cancelToken,
        options: Options(extra: {_requiresAuthKey: requiresAuth}),
      );
      return response.data as T;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<T> post<T>(
    String path, {
    Object? data,
    bool requiresAuth = true,
    String? idempotencyKey,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _dio.post<T>(
        path,
        data: data,
        cancelToken: cancelToken,
        options: Options(
          extra: {_requiresAuthKey: requiresAuth},
          headers: {'Idempotency-Key': ?idempotencyKey},
        ),
      );
      return response.data as T;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<T> patch<T>(
    String path, {
    Object? data,
    bool requiresAuth = true,
    String? version,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _dio.patch<T>(
        path,
        data: data,
        cancelToken: cancelToken,
        options: Options(
          extra: {_requiresAuthKey: requiresAuth},
          headers: {'If-Match': ?version},
        ),
      );
      return response.data as T;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> delete(
    String path, {
    Object? data,
    bool requiresAuth = true,
  }) async {
    try {
      await _dio.delete<void>(
        path,
        data: data,
        options: Options(extra: {_requiresAuthKey: requiresAuth}),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    options.headers['X-Request-ID'] = _uuid.v4();

    if (options.extra[_requiresAuthKey] == false) {
      handler.next(options);
      return;
    }

    var session = await _sessionStore.read();
    if (session == null) {
      handler.reject(
        DioException(
          requestOptions: options,
          response: Response<void>(requestOptions: options, statusCode: 401),
          type: DioExceptionType.badResponse,
          message: 'Authentication required',
        ),
      );
      return;
    }

    if (session.isAccessTokenExpired) {
      session = await _refreshOnce();
      if (session == null) {
        handler.reject(
          DioException(
            requestOptions: options,
            response: Response<void>(requestOptions: options, statusCode: 401),
            type: DioExceptionType.badResponse,
            message: 'Session expired',
          ),
        );
        return;
      }
    }

    options.headers['Authorization'] =
        '${session.tokenType} ${session.accessToken}';
    handler.next(options);
  }

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final request = error.requestOptions;
    final status = error.response?.statusCode;

    // Transient failures: rate limiting and server faults. The API runs
    // @fastify/rate-limit and maps 429 to RATE_LIMITED, and the product's
    // stated audience is on unstable connectivity — but the only retry here
    // was the 401 refresh, so one 503 or one burst over the limit surfaced as
    // a hard error the user had to resolve by retrying by hand.
    if (_isTransient(status, error.type)) {
      final attempt = (request.extra[_attemptKey] as int?) ?? 0;
      final replayable =
          _isIdempotent(request.method) || _neverReachedServer(error.type);
      if (attempt < _maxTransientRetries && replayable) {
        await Future<void>.delayed(_backoffFor(attempt, error.response));
        try {
          final retryOptions = request.copyWith(
            headers: {...request.headers, 'X-Request-ID': _uuid.v4()},
            extra: {...request.extra, _attemptKey: attempt + 1},
          );
          handler.resolve(await _dio.fetch<dynamic>(retryOptions));
          return;
        } on DioException catch (retryError) {
          handler.next(retryError);
          return;
        }
      }
    }

    final shouldRetry =
        status == 401 &&
        request.extra[_requiresAuthKey] != false &&
        request.extra[_retriedKey] != true &&
        !request.path.endsWith('/auth/refresh');

    if (!shouldRetry) {
      handler.next(error);
      return;
    }

    final session = await _refreshOnce();
    if (session == null) {
      handler.next(error);
      return;
    }

    try {
      final retryOptions = request.copyWith(
        headers: {
          ...request.headers,
          'Authorization': '${session.tokenType} ${session.accessToken}',
          'X-Request-ID': _uuid.v4(),
        },
        extra: {...request.extra, _retriedKey: true},
      );
      final response = await _dio.fetch<dynamic>(retryOptions);
      handler.resolve(response);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  Future<AuthSession?> _refreshOnce() {
    final current = _refreshInFlight;
    if (current != null) return current;

    final future = _refreshSession();
    _refreshInFlight = future;
    future.whenComplete(() {
      if (identical(_refreshInFlight, future)) {
        _refreshInFlight = null;
      }
    });
    return future;
  }

  Future<AuthSession?> _refreshSession() async {
    final current = await _sessionStore.read();
    if (current == null) return null;

    try {
      final response = await _refreshDio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': current.refreshToken},
        options: Options(extra: {_requiresAuthKey: false}),
      );
      final data = response.data;
      if (data == null) return null;

      final refreshed = AuthSession.fromTokenResponse(data).copyWith(
        accountId: current.accountId,
        displayName: current.displayName,
        role: current.role,
        phone: current.phone,
        email: current.email,
        ateliers: current.ateliers,
      );
      await _sessionStore.write(refreshed);
      return refreshed;
    } on DioException {
      await _sessionStore.clear();
      await _onSessionExpired();
      return null;
    }
  }
}
