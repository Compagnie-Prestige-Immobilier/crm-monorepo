import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';

import '../sync/token_store.dart';
import 'api_environment.dart';
import 'auth_interceptor.dart';
import 'refresh_mutex.dart';
import 'logging_interceptor.dart';
import 'request_id_interceptor.dart';
import 'retry_interceptor.dart';
import 'timeout_profile.dart';

class ApiClientFactory {
  const ApiClientFactory._();

  static ({Dio dio, CrmApiClient client}) build({
    required TokenStore tokens,
    String baseUrl = ApiEnvironment.baseUrl,
    bool verboseLogs = false,
    void Function()? onSessionExpired,
    RefreshMutex mutex = const NoRefreshMutex(),
  }) {
    final BaseOptions options = BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 30),
      receiveTimeout: TimeoutProfile.read.receive,
      headers: <String, dynamic>{'Accept': 'application/json'},
    );

    final Dio dio = Dio(options);

    final Dio bare = Dio(options.copyWith());
    bare.interceptors.add(const TimeoutProfileInterceptor());

    final AuthApi refreshApi = AuthApi(bare);

    dio.interceptors.addAll(<Interceptor>[
      const TimeoutProfileInterceptor(),
      const RequestIdInterceptor(),
      AuthInterceptor(
        tokens: tokens,
        replayDio: bare,
        onSessionExpired: onSessionExpired,
        mutex: mutex,
        refreshCall: (String refreshToken) async {
          final Response<AuthTokensDto> response = await refreshApi.refreshSession(
            userAgent: ApiEnvironment.userAgent,
            refreshDto: RefreshDto(refreshToken: refreshToken),
            extra: <String, dynamic>{
              AuthInterceptor.noAuthFlag: true,
              ...TimeoutProfile.read.extra,
            },
          );
          final AuthTokensDto body = response.data!;
          return RefreshedTokens(
            accessToken: body.accessToken,
            refreshToken: body.refreshToken,
          );
        },
      ),
      RetryInterceptor(dio: dio),
      LoggingInterceptor(enabled: verboseLogs),
    ]);

    return (
      dio: dio,
      client: CrmApiClient(dio: dio, interceptors: const <Interceptor>[]),
    );
  }
}
